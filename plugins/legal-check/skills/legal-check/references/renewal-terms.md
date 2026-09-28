# 5 · Renewal terms next to the subscribe button (California ARL)

## Why it matters

- California's Automatic Renewal Law (Cal. Bus. & Prof. Code §§ 17600–17606)
  covers subscriptions sold to California consumers, including free trials
  that turn into paid plans.
- Before the subscription starts, you must show the automatic renewal offer
  terms **clearly and conspicuously, in visual proximity to the request for
  consent**, meaning next to the button that commits the purchase
  (§ 17602(a)(1)). A link to your Terms of Service doesn't count.
- You must also get the consumer's affirmative consent to those terms before
  charging (§ 17602(a)(2)). AB 2863 has applied since July 1, 2025. It
  requires express affirmative consent to the renewal terms themselves, which
  can't be buried in a general Terms checkbox or a pre-checked box. You must
  keep proof of that consent for 3 years, or 1 year after the subscription
  ends, whichever is longer.
- After signup, send an acknowledgment with the terms, the cancellation
  policy and how to cancel (§ 17602(a)(3)). People who signed up online must
  be able to cancel online. The law also requires notice before price
  changes, reminders before long free trials convert, and annual reminders.
- If you charge without meeting these rules, the goods or services count as
  an **unconditional gift** to the consumer (§ 17603). That's how subscribers
  sue to get every renewal charge back.
- The federal ROSCA (clear disclosure, express informed consent, easy
  cancellation) is actively enforced by the FTC. The FTC's 2024
  click-to-cancel rule was struck down in July 2025, and the FTC reopened
  rulemaking in March 2026. New York, Colorado, Minnesota, Virginia and other
  states have their own auto-renewal laws.

The disclosure must include all five **automatic renewal offer terms**
(§ 17601(b)):

1. The subscription continues until the consumer cancels.
2. The cancellation policy: how to cancel, and any deadline.
3. The recurring charge. If the amount can change, say so, and say what it
   will change to if you know.
4. The renewal period, such as monthly or yearly, or that it's continuous.
5. Any minimum purchase obligation.

**Clear and conspicuous** means larger type than the surrounding text, or a
contrasting type, font or color, or set off with symbols or marks, in a way
that clearly draws attention to it. Small grey text below the fold is exactly
what this rules out.

## Detect

- **Subscription flows** (scanner: `subscription`): Stripe (`mode:
  'subscription'`, `subscriptions.create`, Pricing Table, Buy Button, Payment
  Links), Paddle, Lemon Squeezy, Polar, Chargebee, Recurly, Braintree,
  RevenueCat, StoreKit, Google Play Billing.
- **The button that commits the purchase**, such as "Subscribe", "Start
  trial", "Upgrade", "Pay" or "Confirm". With Stripe-hosted Checkout, Payment
  Links or the Pricing Table, that final button is on Stripe's page, so the
  fix goes through Stripe's options, not your pricing page.
- **Renewal wording** (scanner: `renewalTerms`), such as "renews
  automatically", "until you cancel", "cancel anytime", "billed monthly",
  `custom_text` or `consent_collection`. It has to sit next to that button in
  the rendered UI and include all five terms.

## Fix

Take the price, currency, interval and trial length from the same data the
button uses, such as the Stripe price and plan config, so the terms can't
drift from the actual charge. Never guess them.

**Wording template:**

> **Renews automatically at {price}/{interval} until you cancel.**
> {If trial: Free for {N} days, then {price}/{interval}.} Cancel anytime in
> {Settings → Billing}. Cancel before your renewal date to avoid the next
> charge. {Refund policy, e.g. "No refunds for partial billing periods."}

**Consent checkbox**, directly above the button, unchecked, with the button
disabled until it's checked:

> ☐ I agree that my subscription renews automatically at {price}/{interval}
> until I cancel.

Send the consent to the server with the checkout request (timestamp, the
exact wording shown, price and interval), and store it with the
subscription. That's your proof of consent.

**Your own checkout UI (Stripe Elements, Paddle or Lemon Squeezy overlays,
in-app paywalls).** Render the terms immediately above or below the button, no
smaller than body text, in high contrast:

```tsx
type Props = { price: string; interval: 'month' | 'year'; trialDays?: number; agreed: boolean; onAgree: (v: boolean) => void };

export function RenewalTerms({ price, interval, trialDays, agreed, onAgree }: Props) {
  return (
    <div className="renewal-terms">
      <p>
        {trialDays ? <>Free for {trialDays} days, then {price}/{interval}. </> : null}
        <strong>Renews automatically at {price}/{interval} until you cancel.</strong> Cancel anytime in
        Settings → Billing. Cancel before your renewal date to avoid the next charge.
      </p>
      <label>
        <input type="checkbox" checked={agreed} onChange={(e) => onAgree(e.target.checked)} required />{' '}
        I agree that my subscription renews automatically at {price}/{interval} until I cancel.
      </label>
    </div>
  );
}
// <button type="submit" disabled={!agreed}>Subscribe</button> sits right below it.
```

**Stripe-hosted Checkout.** Stripe shows `custom_text.submit.message` right
above its pay button (up to 1,200 characters):

```js
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  consent_collection: { terms_of_service: 'required' },
  custom_text: {
    submit: {
      message:
        'Renews automatically at $12/month until you cancel. Cancel anytime in Settings → Billing. ' +
        'Cancel before your renewal date to avoid the next charge.',
    },
    terms_of_service_acceptance: {
      message: 'I agree that my subscription renews automatically at $12/month until I cancel, and to the [Terms](https://example.com/terms).',
    },
  },
  success_url: `${APP_URL}/billing/success`,
  cancel_url: `${APP_URL}/pricing`,
});
```

Build the message from the price object; don't hardcode "$12/month".
`consent_collection.terms_of_service` needs a Terms of Service URL in the
Stripe Dashboard's public details. Stripe's consent checkbox is the closest
built-in option, so make its label about the renewal terms, as above. Stripe
Payment Links take the same `custom_text` and `consent_collection` options.

**Stripe Pricing Table or Buy Button.** These are configured in the
Dashboard. Put the terms right next to the embed on your page, configure what
the Dashboard allows, and mark the check `NEEDS YOU` for the Dashboard part.

**Pricing page.** Also add one renewal line under each subscribe or upgrade
button ("Renews monthly at $12 until you cancel"). The law is aimed at the
final consent screen, but this line stops the surprise earlier.

**Mobile in-app subscriptions.** Apple (App Store Review Guideline 3.1.2) and
Google Play also require the price, period, auto-renewal and how to cancel
in the purchase flow, with links to your terms and privacy policy. Put the
same terms next to the paywall's purchase button.

**Also check.** These come from the same law. Report any that are missing,
and fix them when it's simple:

- A confirmation email after purchase with the terms, the cancellation policy
  and how to cancel. Stripe's receipts don't include these.
- Online cancellation without contacting support, e.g. a link to the Stripe
  Customer Portal in Settings → Billing.
- Reminders before long free trials convert and before price changes, plus
  annual reminders. Say these exist as requirements; don't build a reminder
  system unless asked.

## Verify

- Open the checkout (Stripe test mode is fine) and look at the button. All
  five terms are visible right next to it, without scrolling or clicking. The
  checkbox starts unchecked, the button stays disabled until it's checked,
  and the consent is stored on the server.
- The numbers match the real price: amount, currency, interval and trial.

## Not covered

Other states' auto-renewal laws in detail, the EU and UK consumer rules
(withdrawal rights), tax display, and refund law.
