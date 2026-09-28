# 4 · Marketing email: unsubscribe link + postal address (CAN-SPAM)

## Why it matters

- The CAN-SPAM Act (15 U.S.C. §§ 7701–7713; FTC rule 16 C.F.R. Part 316)
  covers every **commercial** email, meaning one whose primary purpose is to
  advertise or promote a product or service. A "we launched" announcement to
  your own users counts. There's no exemption for small senders or for B2B
  email.
- Every commercial email must:
  - have honest headers and a subject line that isn't deceptive
  - be identifiable as an ad, unless the recipient opted in
  - include your **valid physical postal address**
  - include a clear, working way to **opt out**
- You must honor opt-outs within 10 business days, and the opt-out link must
  keep working for at least 30 days after sending. You can't charge a fee,
  ask for more than an email address, or require more than a reply or a
  visit to one web page. You can't sell or transfer the addresses of people
  who opted out. You stay responsible when a vendor sends for you.
- Penalty: up to **$53,088 per email**. That's the FTC's 2025 figure,
  unchanged in 2026.
- Transactional and relationship emails (sign-in links, password resets,
  receipts, security alerts, account changes) are mostly exempt, but their
  routing information must still be accurate. When an email mixes both, the
  subject line and most of the content decide which kind it is.
- An accepted postal address can be a street address, a P.O. box registered
  with USPS, or a private mailbox registered with a commercial mail receiving
  agency. Solo founders who don't want to publish a home address can use a
  P.O. box or a virtual mailbox service.
- Deliverability, not just law: since 2024, Gmail and Yahoo have required bulk
  senders (5,000+ messages a day to Gmail) to support one-click unsubscribe
  (`List-Unsubscribe` + `List-Unsubscribe-Post`, RFC 8058) on marketing mail
  and to honor requests within 2 days.

## Detect

- **Sending code** (scanner: `emailSend`): Resend, SendGrid, Postmark, Mailgun,
  AWS SES, Nodemailer, Loops, Brevo, Mailchimp/Mandrill, Customer.io, Plunk,
  MailerSend, SparkPost; Python `smtplib` and Django `send_mail`; Rails
  ActionMailer; Laravel Mailables.
- **Templates** (scanner: `emailTemplate`, plus files under `emails/`,
  `mail/`, `mailers/` or `templates/email*`): React Email components, MJML,
  HTML and text templates.
- **Classify each template.** These are marketing: launch or feature
  announcements, newsletters, digests, promotions, upgrade nudges,
  re-engagement or win-back mail, and drip or onboarding sequences that sell.
  These are transactional: verification, sign-in links, password resets,
  receipts, invoices, security alerts.
- **For each marketing template**, check for an unsubscribe link and a postal
  address. The scanner's `templates` list shows whether each template has
  them, directly or through a footer it imports (`via`). It only follows one
  level of imports, so check deeper ones yourself before calling a footer
  missing. Also check whether an unsubscribe endpoint exists (scanner:
  `unsubscribeEndpoint`) and whether the send path skips people who
  unsubscribed (scanner: `suppression`).
- **Campaigns sent from an email service's dashboard** (Mailchimp, Kit,
  Loops, Resend Broadcasts and similar) aren't in the repo. Most of these
  services add a footer automatically, but the postal address comes from
  account settings. Mark it `REVIEW` and ask the user to confirm it's filled
  in.

## Fix

**1. One shared footer on every marketing template.** It holds the business
name and postal address from config (never a guessed address), a visible
"Unsubscribe" link that works in one click without logging in, and one line
explaining why they got the email. Example with React Email, which fails
closed when the config is missing:

```tsx
import { Hr, Link, Section, Text } from '@react-email/components';

export function MarketingFooter({ unsubscribeUrl }: { unsubscribeUrl: string }) {
  const name = process.env.LEGAL_BUSINESS_NAME;
  const address = process.env.LEGAL_POSTAL_ADDRESS;
  if (!name || !address) {
    throw new Error('Set LEGAL_BUSINESS_NAME and LEGAL_POSTAL_ADDRESS before sending marketing email.');
  }
  return (
    <Section>
      <Hr />
      <Text style={{ fontSize: 12, color: '#6b7280' }}>
        You're getting this because you have a {name} account.{' '}
        <Link href={unsubscribeUrl}>Unsubscribe</Link>
      </Text>
      <Text style={{ fontSize: 12, color: '#6b7280' }}>
        {name} · {address}
      </Text>
    </Section>
  );
}
```

For MJML, HTML or server templates (ERB, Blade, Jinja, Handlebars), make the
same footer a partial and include it in each marketing template.

**2. A signed unsubscribe link and endpoint.** The link must work without
login, and nobody should be able to forge it for someone else:

```ts
// lib/unsubscribe.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function sign(userId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not set');
  return createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('base64url');
}

export function verifyUnsubscribe(userId: string, token: string): boolean {
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Link for the email body: opens a page with one "Unsubscribe" button. */
export function unsubscribePageUrl(userId: string): string {
  const url = new URL('/unsubscribe', process.env.APP_URL);
  url.search = new URLSearchParams({ u: userId, t: sign(userId) }).toString();
  return url.toString();
}

/** Target for the List-Unsubscribe header and the page's button (POST only). */
export function unsubscribeApiUrl(userId: string): string {
  const url = new URL('/api/unsubscribe', process.env.APP_URL);
  url.search = new URLSearchParams({ u: userId, t: sign(userId) }).toString();
  return url.toString();
}
```

- `GET /unsubscribe` shows one page with a single "Unsubscribe" button that
  POSTs to the API URL. Don't unsubscribe on GET: security scanners and link
  previewers fetch links in emails, and would unsubscribe people by accident.
- `POST /api/unsubscribe?u=…&t=…` verifies the token and records the opt-out
  (e.g. sets `marketing_opt_out_at` to now). Calling it twice is harmless. It
  also handles RFC 8058 one-click requests, which POST
  `List-Unsubscribe=One-Click` to the same URL.
- Generate `UNSUBSCRIBE_SECRET` as a new random value and add it to the
  project's env example. Never reuse another secret.

**3. Headers on every marketing send.** Every major sending API accepts
custom headers:

```ts
headers: {
  'List-Unsubscribe': `<${unsubscribeApiUrl(user.id)}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
},
```

**4. Suppression.** Every marketing send skips users who opted out, for
example with `where: { marketingOptOutAt: null }`. Transactional email keeps
going.

**5. Fail closed.** The marketing-send function refuses to run while
`LEGAL_POSTAL_ADDRESS` or `LEGAL_BUSINESS_NAME` is empty, so an email without
an address can't go out.

**6. Campaigns from an email service's dashboard.** Use the service's own
unsubscribe merge tag and sender-address settings. Examples: Mailchimp
`*|UNSUB|*`, Resend Broadcasts `{{{RESEND_UNSUBSCRIBE_URL}}}`, SendGrid
`{{{unsubscribe}}}`. Confirm the tag in the service's docs.

**7. Ad identification.** If recipients never opted in to marketing, the
email has to be recognizable as an ad. A clear subject and clear content
usually do it. If it's unclear, flag it.

## Verify

- Render each marketing template (React Email preview, a snapshot test, or a
  send to a test inbox). The footer shows the address and the unsubscribe
  link.
- A valid token sets the opt-out. A tampered token is rejected. A second
  click changes nothing.
- A marketing send to an opted-out test user is skipped.
- With `LEGAL_POSTAL_ADDRESS` unset, the marketing send refuses to run.
- Transactional emails are unchanged.

## Not covered

Consent to send marketing at all. The EU, the UK and Canada (CASL) generally
require opt-in consent first. Also not covered: text messages (TCPA), cold
outreach rules, and email authentication (SPF, DKIM, DMARC).
