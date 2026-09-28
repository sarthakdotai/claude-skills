# 6 · DMCA designated agent (user uploads)

## Why it matters

- If users can upload or post content that you store, such as images, files,
  video, text, comments or profiles, you can be sued over their copyright
  infringement. The DMCA safe harbor (17 U.S.C. § 512(c)) protects you, but
  only if you meet its conditions.
- One condition is a **designated agent** to receive takedown notices. You
  must publish the agent's contact details on your site **and** register them
  with the U.S. Copyright Office (§ 512(c)(2)). Registration costs **$6** and
  lasts **3 years**. It lapses unless you renew it by amending or resubmitting
  the designation, which costs another $6.
- Without the safe harbor, statutory damages run up to $30,000 per work
  infringed, or up to **$150,000 per work** for willful infringement
  (17 U.S.C. § 504(c)).
- The safe harbor has other conditions too. You need a repeat-infringer
  policy that you adopt, publish and actually enforce (§ 512(i)). You must
  remove material quickly after a valid notice. You can't have actual or
  "red flag" knowledge of the infringement, or profit directly from
  infringement you're able to control.
- This is US law. It's still worth doing if you're outside the US but have US
  users, since foreign services can register too.

## Does it apply?

Look for upload handling or user content (scanner: `uploads`): multer,
busboy, formidable, UploadThing, S3 presigned uploads, Vercel Blob, Supabase
Storage, Firebase Storage, Cloudinary, `<input type="file">`, react-dropzone,
Uppy, Active Storage, Django `FileField`/`ImageField`, Laravel `Storage`. Also
count features where people publish text or media to others, such as posts,
comments, reviews and profiles. If there's no user content, the check is
`N/A`. Note that it becomes relevant if user content is added later.

## What to do in code

1. **Create a Copyright / DMCA page** (`/dmca` or `/copyright`) in the app's
   own page format. Link it from the site footer and the Terms of Service.
   Use the template below. The agent's details stay as clearly marked
   placeholders until the user registers. Never invent them.
2. **Repeat-infringer policy.** If a Terms page exists, draft this sentence
   for it and list it under NEEDS YOU: "We terminate, in appropriate
   circumstances, the accounts of users who repeatedly infringe copyright."
3. **Takedown ability.** Check that an admin can disable a piece of content
   quickly, through an admin action, a flag or a script. If nothing like that
   exists, report it; the safe harbor needs quick removal. Adding a "Report"
   link on user content is a good small addition.

Page template (adapt it to the app's markup and styling):

```text
Copyright and DMCA Policy

<App> respects copyright. If you believe content on <App> infringes your
copyright, send a notice to our designated agent:

  Designated agent: [AGENT NAME OR TITLE, e.g. "Copyright Agent"]
  Organization:     [LEGAL NAME OF SERVICE PROVIDER]
  Address:          [AGENT MAILING ADDRESS]
  Phone:            [AGENT PHONE]
  Email:            [AGENT EMAIL, e.g. dmca@yourdomain.com]

Your notice must include (17 U.S.C. § 512(c)(3)):
 1. Your physical or electronic signature (as the owner or someone
    authorized to act for them).
 2. Identification of the copyrighted work you say is infringed.
 3. Identification of the infringing material and enough information for us
    to find it (for example, its URL).
 4. Your contact information: address, phone number and email.
 5. A statement that you believe in good faith that the use isn't authorized
    by the copyright owner, its agent or the law.
 6. A statement that the information in the notice is accurate and, under
    penalty of perjury, that you're authorized to act for the owner.

Counter-notice. If your content was removed and you believe that was a
mistake or misidentification, send our agent a counter-notice
(17 U.S.C. § 512(g)(3)) with:
 1. Your physical or electronic signature.
 2. Identification of the removed material and where it appeared.
 3. A statement under penalty of perjury that you believe in good faith it
    was removed by mistake or misidentification.
 4. Your name, address and phone number, and a statement that you consent to
    the jurisdiction of the federal district court for your address (or, if
    you're outside the US, any judicial district where <App> may be found),
    and that you'll accept service of process from the person who sent the
    original notice.
We forward counter-notices to the complaining party. Unless they tell us
they've filed a court action, we may restore the material 10 to 14 business
days after we receive the counter-notice.

Repeat infringers. We terminate, in appropriate circumstances, the accounts
of users who repeatedly infringe copyright.

Knowingly misrepresenting that material is infringing, or that it was
removed by mistake, can make you liable for damages (17 U.S.C. § 512(f)).
```

## Walk the user through registering

Only the user can do this. Put these steps in the report, filled in with the
brand names, app names and domains you found in the code.

**Have ready:**
- The service provider's full legal name: the company (LLC, Inc., Ltd), or
  your own name if you operate as an individual.
- Its physical street address. A P.O. box is allowed only with a waiver from
  the Copyright Office, granted in exceptional cases such as a threat to
  someone's personal safety.
- Every name the service goes by: brand names, app names, website names and
  URLs.
- The agent's name or title, mailing address, phone and email.
- A card for the $6 fee.

**Steps:**
1. Go to the U.S. Copyright Office's DMCA Designated Agent Directory
   (copyright.gov/dmca-directory) and create an account. You'll be asked for
   points of contact for the Office's own communications.
2. Start a new designation. Enter the service provider's legal name and
   street address.
3. **Alternate names:** list every name you do business under, including
   website names and addresses and app names (e.g. "Acme", "Acme Photos",
   "acme.app", "www.acme.app"). This is how people find your agent. A
   separate legal entity, such as a subsidiary, needs its own designation.
4. **Designated agent:** this can be a person ("Jane Doe"), a role ("Copyright
   Agent"), or an organization such as a law firm or a DMCA agent service.
   Give a mailing address, phone and email. Use a role inbox that someone
   actually reads, like `dmca@yourdomain`.
5. Review everything, confirm the attestation, and pay the $6.
6. Save the confirmation and write down the expiration date, which is 3 years
   out. Set a reminder about two months before it. Any change (address,
   email, agent) means amending the designation for $6, which also starts a
   new 3-year period.
7. Put exactly the same agent details on the `/dmca` page, replacing the
   placeholders, or give them to Claude to fill in.
8. Keep it running: someone reads the inbox, removes material quickly after a
   valid notice, tells the uploader, handles counter-notices, and keeps
   track of repeat infringers.

## Verify

- The `/dmca` page loads and is linked from the footer and the Terms. After
  registration, its placeholders are filled and match the directory entry
  exactly.
- A directory search at copyright.gov/dmca-directory finds the service under
  every alternate name, with an active status.

## Not covered

The EU Digital Services Act's notice-and-action and point-of-contact duties.
Trademark complaints. Reporting child sexual abuse material to NCMEC, which
US providers must do once they know of it (18 U.S.C. § 2258A). Content
moderation, defamation and Section 230. Licensing for content you post
yourself.
