# 2 · Self-host fonts (GDPR)

## Why it matters

- When a page loads a font from `fonts.googleapis.com` or `fonts.gstatic.com`,
  every visitor's browser sends its IP address to Google, before any consent
  and whether or not the visitor ever sees a cookie banner.
- On 20 January 2022 the Regional Court of Munich (LG München I, case
  3 O 17493/20) ruled on exactly this. A site had embedded Google Fonts from
  Google's servers, which passed a visitor's IP address to Google without
  consent. The court ordered the operator to pay that visitor **€100 in
  damages** under Art. 82 GDPR and to stop. It noted that the fonts could
  have been self-hosted. The ruling set off a wave of mass demand letters in
  Germany.
- This applies when you have visitors in the EU or EEA (GDPR Art. 3). It's the
  cheapest risk on the list to remove: self-hosting is free and usually makes
  pages load faster.

## Detect

Third-party font requests, fix these:

| Signature | Notes |
|---|---|
| `fonts.googleapis.com`, `fonts.gstatic.com` | In an HTML `<link>`, a CSS `@import`, JS, or templates. A CSP header entry on its own loads nothing, but remove it once fixed. |
| `fonts.googleapis.com/icon?family=Material+Icons`, Material Symbols | An icon font is still a font request. |
| `use.typekit.net`, `p.typekit.net` (Adobe Fonts) | Adobe's license doesn't allow self-hosting. Load them only after consent, or switch fonts. |
| `kit.fontawesome.com`, `use.fontawesome.com` | Font Awesome kits load from a CDN. |
| Font files or CSS from `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com`, `fonts.cdnfonts.com` | The same problem with a different host. |
| `unplugin-fonts` with a `google:` option | Injects Google Fonts links at build time. |
| `fonts.bunny.net` | Lower risk: EU-hosted, and Bunny says it doesn't log IPs. Still a third party, so report it as info. Self-hosting is the only zero-transfer option. |

Already self-hosted, leave these alone:

| Signature | Why it's fine |
|---|---|
| `next/font/google`, `next/font/local`, `@next/font` | Next.js downloads the files at build time and serves them from your own domain. |
| `@fontsource/*`, `@fontsource-variable/*` | npm packages that bundle the font files. |
| `@nuxtjs/google-fonts` with `download: true` (the default in v3), `@nuxt/fonts` | These download the fonts. Confirm in the built output. |
| `vite-plugin-webfont-dl` | Downloads the fonts at build time. |
| `@font-face` with `src: url('/fonts/…')` | Local files. Check that the `src` really is local. |

HTML email templates can load web fonts too (the request happens when the
recipient opens the email). That's lower priority, but mention it.

Scanner signals: `googleFonts`, `otherFontCdn`, `selfHostedFonts`, `fontFace`.

## Fix

**Next.js: use `next/font`.**

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

Remove every Google Fonts `<link>` in `app/layout.tsx`, `pages/_document.tsx`
and `pages/_app.tsx`, and every `@import url(https://fonts.googleapis.com/…)`
in CSS. With Tailwind, point the font family at the variable: `var(--font-inter)`
in `theme.fontFamily` (v3), or `@theme inline { --font-sans: var(--font-inter); }`
(v4).

**Any npm-based project (Vite, Remix, SvelteKit, Astro, Vue, Angular, CRA):
use Fontsource.**

```bash
npm install @fontsource-variable/inter
```

```js
// in the entry file: main.tsx, root layout, +layout.svelte, etc.
import '@fontsource-variable/inter';
```

```css
body { font-family: 'Inter Variable', system-ui, sans-serif; }
```

For static weights instead of a variable font, install `@fontsource/inter`,
import `@fontsource/inter/400.css` and `@fontsource/inter/700.css`, and use
`font-family: 'Inter'`. The package name is the font name in lowercase with
hyphens, e.g. `@fontsource/roboto-mono`. Check fontsource.org to see whether a
variable version exists. Use the project's package manager (npm, pnpm, yarn,
bun).

**No bundler (static HTML, Rails, Django, Laravel, PHP, WordPress theme):
download the files.**

Get the `.woff2` files from the Fontsource site or from google-webfonts-helper
(`gwfh.mranftl.com`). Put them in the public or static folder, then:

```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-400-normal.woff2') format('woff2');
}
```

Add one `@font-face` per weight and style. For a variable font, use one rule
with `font-weight: 100 900`.

**Icon fonts.** Use the `material-symbols` npm package or
`@fontsource/material-icons`. For Font Awesome, use
`@fortawesome/fontawesome-free` or SVG icons.

**Adobe Fonts.** They can't be self-hosted under Adobe's license. Load them
only after consent, or switch to an open-license font. That's a design
decision, so mark the check `NEEDS YOU`.

Then clean up:

- Delete `<link rel="preconnect">` and `dns-prefetch` tags for the Google font
  hosts, and remove those hosts from the CSP.
- Keep the same family names so the design doesn't shift, and keep
  `font-display: swap`.
- Licensing: Google Fonts are under the SIL Open Font License or Apache 2.0,
  so self-hosting is allowed. For commercial fonts, check the license first.
- Look at the project's `.gitignore`. If it ignores `*.woff2` or `*.ttf`,
  committed font files won't ship. Prefer the npm-package route, or ask
  before changing the ignore rule.

## Verify

- Re-run the scanner. `googleFonts` should be gone from source files.
- If the project builds, grep the build output (`.next`, `dist`, `build`,
  `out`) for `fonts.googleapis.com` and `fonts.gstatic.com`.
- If you can run the app and Playwright is installed, record the page's
  requests:

  ```js
  // save to a temp file, run: node check-fonts.mjs http://localhost:3000
  import { chromium } from 'playwright';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const hits = [];
  page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) hits.push(r.url()); });
  await page.goto(process.argv[2], { waitUntil: 'networkidle' });
  await browser.close();
  console.log(hits.length ? hits : 'No Google Fonts requests.');
  ```

- Check that the text still renders in the intended font, not the fallback.

## Not covered

Other third-party requests made before consent: Google Maps and YouTube
embeds, reCAPTCHA, analytics and ad pixels, CDN-hosted scripts, Gravatar. The
same principle applies, but this skill doesn't check them.
