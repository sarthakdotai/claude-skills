# 1 · Age gate at signup (COPPA)

## Why it matters

- The Children's Online Privacy Protection Act (15 U.S.C. §§ 6501–6506) and
  the FTC's COPPA Rule (16 C.F.R. Part 312) apply to two kinds of operators:
  those whose app or site is directed at children under 13, and
  general-audience operators with **actual knowledge** that they collect
  personal information from a child under 13.
- Civil penalties go up to **$53,088 per violation**. That is the 2025 figure,
  and there was no inflation adjustment in 2026. Each child's data can count
  as a separate violation. Epic Games paid $275 million in 2022.
- A neutral age question at signup is how a general-audience app learns that
  a user is under 13 and stops before collecting their data. Without one, you
  have nothing that shows you tried.
- The amended COPPA Rule has been fully in force since April 22, 2026. It adds
  separate parental consent for sharing children's data with third parties, a
  written data-retention policy, and more. That matters if you do serve kids.
- On Feb 25, 2026, the FTC issued a policy statement for general- and
  mixed-audience operators. It won't bring COPPA cases over personal
  information collected **solely to determine age**, as long as the operator
  uses it only for that, deletes it promptly, and shares it only with third
  parties able to keep it secure. So collect the minimum for the check and
  never reuse it.

## Does it apply?

Yes, if the app creates accounts or profiles, or collects personal
information in any other way. That includes email, name, phone, photo,
voice, precise location, and persistent identifiers used for more than
running the service.

**Escalate instead** if the app looks directed at children: kid-focused
content, characters or games, classrooms, "for kids" in the name or copy. An
age gate isn't enough there. COPPA requires verifiable parental consent,
direct notice to parents and more. Say this plainly, don't try to build
parental consent flows, and recommend a lawyer.

## Detect

- **Every path that creates an account:** email/password forms, OAuth
  buttons ("Continue with Google/Apple/GitHub"), magic links, phone OTP, and
  invite acceptance. Apps that only offer OAuth usually have no gate at all,
  because the provider creates the account before any form appears.
- **An existing gate:** a date-of-birth or age field, `minAge`/`MIN_AGE`, or
  `ageVerified`. Check where it's enforced. If the server accepts a signup
  without it, the gate only exists in the browser, and that is a `FAIL`.
- Scanner signals: `signup`, `oauth`, `ageGate`. Grep fallback:
  `sign[-_ ]?up|createUser|auth\.signUp|signInWithOAuth|GoogleProvider|birth|dob|minAge|age_?gate`.

## Fix

Rules, in order of importance:

1. **Ask neutrally.** Ask for a date of birth, at least month and year. Leave
   the field empty (no default year) and don't hint at the cutoff. A line
   like "You must be 13 or older" next to the field invites kids to lie. So
   does an "I am over 13" checkbox. The FTC's guidance asks for neutral age
   screens.
2. **Enforce on the server** (API route, server action, auth hook or
   database policy). The client-side check is only there for a nicer error
   message.
3. **Under the minimum age, create nothing.** No account row, no stored email
   or name, no analytics event carrying their details. Keep the message
   neutral ("Sorry, we can't create an account right now.") and don't reveal
   which answer would have worked.
4. **Block the instant retry.** Set a short-lived cookie or session flag
   (about 24 hours) so pressing back and entering a different year doesn't
   just work.
5. **Store the minimum.** Store `age_confirmed_at` and the threshold used.
   Keep the full date of birth only if another feature truly needs it, and
   never send it to analytics or ad tools (see the FTC policy statement
   above).
6. **Gate OAuth and magic-link signups in onboarding.** New users land on an
   age step. Middleware blocks the rest of the app until `age_confirmed_at`
   is set. If the user is under the minimum, delete the auth user the
   provider just created and sign them out.
7. **Make the threshold a constant**, e.g. `MIN_SIGNUP_AGE = 13`. Some
   products need more: some EU countries set 16 for consent-based processing,
   and adult, dating or financial products usually require 18. If the Terms
   state an age, match it. If you're unsure, ask.
8. **Terms and Privacy Policy.** Don't edit them. Draft the sentences for the
   user ("You must be at least 13 to use <App>." / "We don't knowingly
   collect personal information from children under 13. If you believe a
   child has given us information, contact <email> and we'll delete it.")
   and list them under NEEDS YOU.

Computing age correctly. Month and day matter; a one-day time-zone
difference doesn't:

```ts
export const MIN_SIGNUP_AGE = 13;

export function ageOn(birth: Date, today = new Date()): number {
  const age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

/** `iso` is the "YYYY-MM-DD" value from the date-of-birth field. Call it on the server. */
export function checkSignupAge(iso: string, today = new Date()): 'ok' | 'invalid' | 'under-age' {
  const birth = new Date(`${iso}T00:00:00Z`);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    !Number.isNaN(birth.getTime()) &&
    birth.toISOString().slice(0, 10) === iso && // rejects 2013-02-30
    birth <= today;
  if (!valid) return 'invalid';
  return ageOn(birth, today) < MIN_SIGNUP_AGE ? 'under-age' : 'ok';
}
```

On `under-age`, set the retry-block cookie, create nothing, and return the
neutral message. On `invalid`, return a normal validation error.

If the form only asks for month and year, treat the birthday as the last day
of that month. That way a child whose birthday hasn't come yet this month
isn't counted as older.

Where to hook the server check, by stack:

| Stack | Where |
|---|---|
| Next.js / Remix / SvelteKit | The server action or route handler that creates the user. For OAuth, add middleware that redirects to `/onboarding/age` until the flag is set. |
| Supabase Auth | Browsers can call `auth.signUp` directly with the anon key, so a form check alone is bypassable. Enforce it in an Auth Hook, a database trigger, or a server endpoint that performs the signup. For OAuth, use the onboarding gate. |
| Clerk | A custom onboarding step that writes a `publicMetadata` flag from the backend, with `clerkMiddleware` redirecting until it's set. |
| Auth.js / NextAuth | The `signIn` callback can't ask questions, so use an onboarding page plus middleware. |
| Firebase Auth | A blocking function (`beforeUserCreated`) or the onboarding gate. |
| Django / Rails / Laravel | A field on the signup form, plus model or form validation on the server. |
| Mobile apps | The same server-side enforcement, with the age step in the native onboarding flow. |

## Verify

- Sign up with a date of birth that makes the user 12. No user row is
  created, no email is stored, and the retry block is set.
- Sign up at exactly 13 (birthday today). It works.
- Call the signup endpoint directly with `curl` and no date of birth. The
  server rejects it.
- Start a new OAuth signup. The user lands on the age step and can't reach
  app pages until it's done.

## Not covered

Verifiable parental consent and child-directed services. Teen protections
under state laws (social media and age-verification laws, age-appropriate
design codes, app-store age laws). GDPR Article 8 consent ages by country.
