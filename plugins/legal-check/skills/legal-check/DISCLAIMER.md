# Disclaimer

**legal-check is not legal advice.**

## What it is

A checklist tool. It looks for six common legal problems in a software project
and suggests or makes code changes for them:

1. No age gate at signup (COPPA)
2. Fonts loaded from Google's servers (GDPR)
3. Session replay without consent or input masking (California Invasion of Privacy Act)
4. Marketing email without an unsubscribe link or postal address (CAN-SPAM)
5. Subscription checkout without renewal terms next to the button (California Automatic Renewal Law)
6. User uploads without a registered DMCA agent (17 U.S.C. § 512)

## What it is not

- **It checks these six problems only, and it never guarantees that your app
  meets all, or any, legal requirements.** Passing every check does not mean
  your app is legally compliant. Many laws that apply to apps are outside its
  scope: privacy policies, cookie consent, data-protection rights,
  accessibility, consumer protection, tax, industry-specific rules, and the
  laws of most countries.
- It is not legal advice and does not create an attorney–client relationship.
  It does not replace advice from a qualified lawyer licensed where you
  operate.
- Its detection is automated and heuristic. It can miss real problems and flag
  things that aren't problems. An AI model writes its code changes, and they
  can contain mistakes. Review every change before you ship it.
- Laws, penalty amounts and court decisions change. The figures and citations
  in this skill were checked in September 2026 and may be out of date when you
  read them.

## No liability

To the maximum extent permitted by applicable law, the author (sarthakdotai)
and contributors provide this skill "as is", without warranty of any kind,
express or implied. They are not liable for any claim, damages, fines,
penalties, losses or other liability, whether direct, indirect, incidental,
special, consequential or punitive, that arises from or relates to using or
being unable to use this skill, its output, or any change it makes to your
code.

You alone are responsible for your app's legal compliance and for deciding
whether and how to use anything this skill produces. If you need certainty,
talk to a lawyer.

This disclaimer adds to the repository's [MIT License](../../../../LICENSE),
which also disclaims all warranties and liability.
