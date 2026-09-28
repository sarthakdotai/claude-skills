---
name: legal-check
description: >-
  Audit an app's code for six common legal traps in AI-built apps, then fix
  them: signup with no age gate (COPPA), Google Fonts loaded from Google's
  servers (GDPR), session replay recording visitors without consent (CIPA
  wiretap suits), marketing email with no unsubscribe link or postal address
  (CAN-SPAM), subscription checkout without renewal terms next to the button
  (California auto-renewal law), and user uploads with no registered DMCA
  agent. Use whenever the user wants their app checked for legal, compliance
  or privacy risks, is getting ready to launch, or is adding signup, analytics
  or session replay, a launch or marketing email, subscriptions, or user
  uploads, even if they never say "legal". Checks common problems only: not
  legal advice, no guarantee of compliance.
argument-hint: "[app directory] [audit]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node ${CLAUDE_SKILL_DIR}/scan.mjs *)
license: MIT
---

# Legal Check

Find and fix six legal traps that show up in most AI-built apps. Each one is
cheap to fix and expensive to ignore.

> **Disclaimer.** This skill checks six common problems. It is not legal
> advice. It never guarantees that an app meets every legal requirement, and
> passing all six checks does not make an app legally compliant. The author
> (sarthakdotai) and contributors are not liable for any outcome of using it.
> Full text: [DISCLAIMER.md](DISCLAIMER.md). Every report opens and closes with
> the notices in step 6, so anyone who sees only the report still sees these
> limits.

The request this skill was built from, kept word for word:

> "Audit my app for these 6 legal risks and fix them: add an age gate to
> signup, self-host my fonts, turn off session replay (or add consent + input
> masking), add an unsubscribe link and postal address to every marketing
> email, show renewal terms right next to the subscribe button, and walk me
> through registering a DMCA agent."

Input: **$ARGUMENTS**

## The six checks

| # | Check | Law | Exposure (as of Sept 2026) | Reference |
|---|---|---|---|---|
| 1 | Age gate at signup | COPPA | up to $53,088 per violation | `references/age-gate.md` |
| 2 | Fonts self-hosted | GDPR | €100 to a single visitor (Munich court, 2022) | `references/fonts.md` |
| 3 | Session replay off, or consent + masking | CIPA, Cal. Penal Code § 631 | $5,000 per violation | `references/session-replay.md` |
| 4 | Unsubscribe link + postal address in marketing email | CAN-SPAM | up to $53,088 per email | `references/marketing-email.md` |
| 5 | Renewal terms next to the subscribe button | California ARL | charges can be deemed a gift, so refundable | `references/renewal-terms.md` |
| 6 | Registered DMCA agent for user uploads | DMCA § 512(c) | up to $150,000 per work (willful) | `references/dmca-agent.md` |

Read a check's reference before you judge or fix it. Each one has the legal
background with citations, what to search for, fix recipes by stack, and how
to verify.

## 1. Resolve the input — follow this rule, do not improvise

| Condition (test in order) | Action |
|---|---|
| `$ARGUMENTS` contains `audit`, or the user asked for a report only | `MODE=audit`. Run steps 2, 3 and 6. Change nothing. |
| otherwise | `MODE=fix`. Run every step. |

The target is the first argument that is an existing directory. Otherwise it
is the current working directory.

If there is no code to read (a no-code builder, or the user only described the
app), run the checks as a short interview instead. Explain each check, ask
only what you need, give steps for their platform's settings, and mark
anything you couldn't see as `REVIEW`.

## 2. Scan — run this first, always

```bash
node ${CLAUDE_SKILL_DIR}/scan.mjs <target>
```

It walks the project and skips dependencies, build output and VCS folders.
It prints JSON with a `hint` for each check and the `signals` it matched,
each with `file`, `line` and `text`. For check 4 it also lists every email
template, with whether it has an unsubscribe link and a postal address,
either directly or through a footer it imports (listed as `via`).

Treat the scan as a map, not a verdict. It matches text. It follows email
imports one level deep, but it can't see an age gate enforced in a database
trigger or a setting stored in a vendor dashboard, and it misses flows
worded in ways it doesn't know. If `node` is missing or the command fails,
say so in the report. Then search with Grep, using the patterns in each
reference.

## 3. Judge each check

Open the files behind the signals and give each check exactly one status:

| Status | Meaning |
|---|---|
| `PASS` | The problem this check looks for is not there. This is not a statement that the app is compliant. |
| `FIXED` | You changed code in this run and the problem is gone. |
| `FAIL` | The problem is there and you didn't change it (audit mode, or the user declined the fix). |
| `NEEDS YOU` | Only the user can finish it: a fact you must not guess (postal address, legal entity name, DMCA agent details), a vendor-dashboard setting, or the DMCA registration itself. |
| `REVIEW` | The code can't tell you. Say what you couldn't see. |
| `N/A` | The feature doesn't exist: no signup, no email, no subscriptions, or no user content. Say what you searched for. |

Back every status with `file:line` evidence, or, for `N/A`, with what you
searched for. If you fixed part of a check and the user must finish the rest,
report `NEEDS YOU` and list what you fixed in its details.

If the app looks aimed at children under 13 (kids' content or characters,
classrooms, "for kids"), stop at check 1 and say so plainly. An age gate
isn't enough there, because COPPA then requires verifiable parental consent
and more. They need a lawyer before launch. Finish the other checks as usual.

## 4. Fix (fix mode)

Before editing, print one line per check saying what you're about to do, so
the user can stop you. Then work through checks 1 to 6.

These rules apply to every fix:

- **Match the project.** Use its framework, file layout, components, styling
  and config pattern. Keep diffs small, with no drive-by refactors.
- **Never invent legal facts.** Take the postal address, legal entity name,
  DMCA agent details, prices, trial length and cancellation or refund policy
  from the code or config (for example, the Stripe price the button already
  uses). If a fact isn't there, add one clearly named config value (such as
  `LEGAL_POSTAL_ADDRESS`), use it everywhere, and list it under NEEDS YOU. A
  made-up address in a legal footer is worse than a visible TODO.
- **Enforce on the server.** A check that only runs in the browser can be
  skipped by anyone who calls the API directly.
- **Fail closed where it's cheap.** For example, make the marketing-send path
  refuse to send while `LEGAL_POSTAL_ADDRESS` is empty.
- **Don't rewrite legal documents silently.** If the Terms or Privacy Policy
  needs a sentence (minimum age, repeat-infringer policy, session recording),
  draft it and list it under NEEDS YOU. The one exception is the DMCA page in
  check 6: the safe harbor requires the agent's details on the site.
- **Don't delete user data or weaken security** to make a check pass.

What each fix looks like (the code is in each reference):

1. **Age gate.** Ask a neutral date-of-birth question on every signup path,
   including OAuth and magic links. Enforce it on the server. Below the
   minimum age (13 unless the product needs more), create no account and
   store nothing they typed. Keep only what the age check needs.
2. **Fonts.** Replace Google-hosted fonts with self-hosted files (`next/font`,
   Fontsource or a local `@font-face`). Remove the `<link>`, `@import`,
   preconnect and CSP entries that pointed at Google.
3. **Session replay.** Follow this rule:

   | Condition (test in order) | Action |
   |---|---|
   | The user said to keep replay | Path B: record only after opt-in consent, mask all inputs and text, exclude sensitive pages |
   | The app already has a consent manager or cookie banner | Path B, wired to that consent manager |
   | otherwise | Path A: turn replay off (remove the replay integration or set its sample rate to 0), and offer Path B as a follow-up |

4. **Marketing email.** Add one shared footer to every marketing template: the
   business name, the postal address from config, and an unsubscribe link.
   Add a signed one-click unsubscribe endpoint and `List-Unsubscribe` plus
   `List-Unsubscribe-Post` headers. Skip opted-out users on every marketing
   send.
5. **Renewal terms.** Put all five required terms right next to the button
   that commits the purchase, at least as prominent as the text around them.
   Add an unchecked consent checkbox, and store the consent on the server. On
   Stripe-hosted Checkout, use `custom_text.submit.message`.
6. **DMCA agent.** If users can upload or post content, create a `/dmca` (or
   `/copyright`) page. It holds placeholders for the agent's details,
   instructions for notices and counter-notices, and a repeat-infringer
   policy. Link it from the footer and the Terms. Then walk the user through
   registration in the report.

## 5. Verify

- Re-run the scanner and compare it with the first run.
- Run the project's own fast checks (typecheck, lint, unit tests, build) when
  they exist. Report failures exactly as they are.
- Do the "Verify" steps in each reference that you can run, and say which ones
  you couldn't.

A fix you couldn't verify is reported as unverified, not as done.

## 6. Report — use this format

```
LEGAL CHECK — <project name>
Not legal advice. Checks 6 common problems only; passing them does not mean your app is legally compliant.

 #  Check                         Status      Law · exposure
 1  Age gate at signup            FIXED       COPPA · up to $53,088 per violation
 2  Fonts self-hosted             PASS        GDPR · €100 to a single visitor (Munich, 2022)
 3  Session replay                FIXED       CIPA · $5,000 per violation
 4  Marketing email footer        NEEDS YOU   CAN-SPAM · up to $53,088 per email
 5  Renewal terms by the button   FIXED       Cal. ARL · renewals can be deemed a gift
 6  DMCA agent                    NEEDS YOU   DMCA § 512 · up to $150,000 per work

1 · Age gate at signup — FIXED
    Found:    <file:line — what was wrong>
    Changed:  <file — what you did>
    Verified: <what you ran, or "not verified: why">
…

NEEDS YOU
 [ ] <exact action, and which placeholder or config key it fills>

DMCA AGENT — HOW TO REGISTER
 <the steps from references/dmca-agent.md, filled in with the brand names and domains you found>

NOT CHECKED
 Privacy policy · cookie consent for analytics and ads · GDPR/CCPA data rights ·
 accessibility (ADA/WCAG) · EU/UK/Canada email consent · state privacy and
 children's laws · app store rules · tax. Ask a lawyer about these.

This is a check for 6 common problems, not legal advice, and no guarantee of
compliance. The author of this skill (sarthakdotai) and contributors are not
liable for any outcome of using it. You are responsible for your app's
compliance. Figures as of September 2026.
```

Keep the table at exactly six rows, in this order. For an `N/A` check, replace
the details block with one line saying what you searched for. Leave out the
DMCA section when check 6 is `N/A`, or when the user confirms an active
registration that matches the page. In audit mode, end with: "Run this skill
again without `audit` to apply the fixes."

## Language

Say "passes this check" or "fixes this issue". Never call the app
"compliant", "legal", "safe", "covered" or "guaranteed". The user may repeat
your words to someone who relies on them.

Give penalties as "up to" amounts and keep the "as of" date. They are legal
maximums, not predictions. Laws differ by place and change often. If the user
asks about something outside these six checks, say it is outside this skill's
scope and suggest a lawyer.
