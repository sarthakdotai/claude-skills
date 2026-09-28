// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDir, scanFiles } from './scan.mjs';

const hint = (files, check) => scanFiles(files).checks[check].hint;
const count = (files, check, signal) => scanFiles(files).checks[check].signals[signal].count;

test('an empty project finds nothing to check', () => {
  const r = scanFiles([{ path: 'src/index.ts', text: 'export const add = (a: number, b: number) => a + b;' }]);
  assert.deepEqual(Object.values(r.checks).map((c) => c.hint), [
    'no-signup-found', 'no-web-fonts-found', 'no-replay-tool-found',
    'no-email-code-found', 'no-subscription-found', 'no-uploads-found',
  ]);
});

test('signup without an age question is flagged, with file and line', () => {
  const files = [{ path: 'app/signup/page.tsx', text: "'use client';\nexport default function SignupPage() {\n  return <form />;\n}" }];
  assert.equal(hint(files, 'age-gate'), 'no-age-question-found');
  const [m] = scanFiles(files).checks['age-gate'].signals.signup.matches;
  assert.deepEqual([m.file, m.line], ['app/signup/page.tsx', 2]);
});

test('OAuth-only apps still need an age gate', () => {
  const files = [{ path: 'lib/auth.ts', text: "import Google from 'next-auth/providers/google';" }];
  assert.equal(hint(files, 'age-gate'), 'no-age-question-found');
});

test('a date-of-birth check moves the age gate to server verification', () => {
  const files = [
    { path: 'app/signup/page.tsx', text: 'export default function SignUp() { return <input name="birthDate" type="date" /> }' },
    { path: 'lib/age.ts', text: 'export const MIN_SIGNUP_AGE = 13;' },
  ];
  assert.equal(hint(files, 'age-gate'), 'age-question-found-check-server-enforcement');
});

test('age words inside other words are not an age gate', () => {
  const files = [{ path: 'a.ts', text: 'const page = usage + image; res.setHeader("Cache-Control", "max-age=60");' }];
  assert.equal(count(files, 'age-gate', 'ageGate'), 0);
});

test('Google-hosted fonts are flagged; next/font and Fontsource are self-hosted', () => {
  const link = [{ path: 'index.html', text: '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">' }];
  const cssImport = [{ path: 'src/app.css', text: "@import url('https://fonts.googleapis.com/css2?family=Inter');" }];
  assert.equal(hint(link, 'fonts'), 'google-fonts-loaded-from-google');
  assert.equal(hint(cssImport, 'fonts'), 'google-fonts-loaded-from-google');
  assert.equal(hint([{ path: 'app/layout.tsx', text: "import { Inter } from 'next/font/google';" }], 'fonts'), 'fonts-look-self-hosted');
  assert.equal(hint([{ path: 'src/main.ts', text: "import '@fontsource-variable/inter';" }], 'fonts'), 'fonts-look-self-hosted');
});

test('other font CDNs are reported separately', () => {
  assert.equal(hint([{ path: 'a.html', text: '<link rel="stylesheet" href="https://use.typekit.net/abc.css">' }], 'fonts'), 'third-party-font-cdn');
});

test('session replay: Sentry defaults are found, and consent or an off switch changes the hint', () => {
  const sentry = { path: 'sentry.client.config.ts', text: 'Sentry.init({\n  integrations: [Sentry.replayIntegration()],\n  replaysSessionSampleRate: 0.1,\n  replaysOnErrorSampleRate: 1.0,\n});' };
  const r = scanFiles([sentry]).checks['session-replay'];
  assert.deepEqual(r.vendors, ['sentryReplay']);
  assert.equal(r.hint, 'replay-tool-found-no-consent-or-off-switch');
  const off = { path: 'app/providers.tsx', text: "posthog.init(key, { disable_session_recording: true });" };
  assert.equal(hint([off], 'session-replay'), 'replay-off-switch-found-verify-every-tool');
  const banner = { path: 'app/banner.tsx', text: "import CookieConsent from 'react-cookie-consent';" };
  assert.equal(hint([sentry, banner], 'session-replay'), 'replay-tool-found-check-consent-gating-and-masking');
});

test('a non-zero sample rate is not an off switch; zero is', () => {
  assert.equal(count([{ path: 'a.ts', text: 'replaysSessionSampleRate: 0.5,' }], 'session-replay', 'replayOff'), 0);
  assert.equal(count([{ path: 'a.ts', text: 'replaysSessionSampleRate: 0,' }], 'session-replay', 'replayOff'), 1);
  assert.equal(count([{ path: 'a.ts', text: 'sessionReplaySampleRate: 0.0,' }], 'session-replay', 'replayOff'), 1);
});

test('marketing templates without unsubscribe or address are listed', () => {
  const files = [
    { path: 'emails/launch.tsx', text: "import { Html, Text } from '@react-email/components';\nexport default () => <Html><Text>We launched!</Text></Html>;" },
    { path: 'lib/email.ts', text: "import { Resend } from 'resend';\nconst resend = new Resend(process.env.RESEND_API_KEY);" },
  ];
  const r = scanFiles(files).checks['marketing-email'];
  assert.equal(r.hint, 'marketing-templates-missing-unsubscribe-or-address');
  assert.deepEqual(r.templates, [{ file: 'emails/launch.tsx', marketing: true, unsubscribe: false, postalAddress: false }]);
});

test('a footer imported from another file counts for the template', () => {
  const files = [
    { path: 'emails/launch.tsx', text: "import { Footer } from './footer';\nexport default () => <Html><Text>We launched!</Text><Footer /></Html>;" },
    { path: 'emails/footer.tsx', text: 'export const Footer = () => <Text><Link href={url}>Unsubscribe</Link> · {process.env.LEGAL_POSTAL_ADDRESS}</Text>;' },
  ];
  const r = scanFiles(files).checks['marketing-email'];
  assert.equal(r.hint, 'footers-found-check-every-marketing-email');
  assert.deepEqual(r.templates.find((t) => t.file === 'emails/launch.tsx').via, ['emails/footer.tsx']);
});

test('unsubscribe() on a subscription outside email code is not an email signal', () => {
  const files = [{ path: 'src/store.ts', text: 'const sub = source$.subscribe(); sub.unsubscribe();' }];
  assert.equal(count(files, 'marketing-email', 'unsubscribe'), 0);
});

test('helpers in an emails folder are not templates, and manifests never are', () => {
  const files = [
    { path: 'emails/index.ts', text: "export { default as Launch } from './launch';" },
    { path: 'package.json', text: '{ "dependencies": { "@react-email/components": "1.0.0" } }' },
  ];
  assert.deepEqual(scanFiles(files).checks['marketing-email'].templates, []);
});

test('subscriptions without renewal wording are flagged; custom_text clears it', () => {
  const checkout = "const s = await stripe.checkout.sessions.create({ mode: 'subscription', line_items });";
  assert.equal(hint([{ path: 'api/checkout.ts', text: checkout }], 'renewal-terms'), 'no-renewal-terms-found');
  const withTerms = `${checkout}\ncustom_text: { submit: { message: 'Renews automatically until you cancel.' } },`;
  assert.equal(hint([{ path: 'api/checkout.ts', text: withTerms }], 'renewal-terms'), 'renewal-terms-found-check-placement');
});

test('uploads without a DMCA page are flagged; a /dmca route clears it', () => {
  const upload = { path: 'src/upload.tsx', text: '<input type="file" accept="image/*" />' };
  assert.equal(hint([upload], 'dmca'), 'uploads-found-no-dmca-page');
  assert.equal(hint([upload, { path: 'app/dmca/page.tsx', text: 'export default function Page() {}' }], 'dmca'), 'dmca-page-found-check-registration');
});

test('long tokens are redacted from match text', () => {
  const files = [{ path: 'lib/email.ts', text: "const resend = new Resend('re_9aB3cD4eF5gH6iJ7kL8mN9oP0qR');" }];
  const [m] = scanFiles(files).checks['marketing-email'].signals.emailSend.matches;
  assert.ok(!m.text.includes('9aB3cD4eF5gH6iJ7kL8mN9oP0qR'), m.text);
});

test('same input, same result', () => {
  const files = [
    { path: 'b.tsx', text: '<link href="https://fonts.googleapis.com/css2?family=Inter">' },
    { path: 'a.tsx', text: 'Sentry.replayIntegration()' },
  ];
  assert.deepEqual(scanFiles(files), scanFiles([...files].reverse()));
});

test('the directory walk skips dependencies and build output', () => {
  const root = mkdtempSync(join(tmpdir(), 'legal-check-'));
  try {
    for (const dir of ['src', 'node_modules/pkg', '.next/static', 'dist']) mkdirSync(join(root, dir), { recursive: true });
    const font = '<link href="https://fonts.googleapis.com/css2?family=Inter">';
    writeFileSync(join(root, 'node_modules/pkg/index.html'), font);
    writeFileSync(join(root, '.next/static/page.html'), font);
    writeFileSync(join(root, 'dist/index.html'), font);
    writeFileSync(join(root, 'src/index.html'), '<p>hello</p>');
    const r = scanDir(root);
    assert.equal(r.files, 1);
    assert.equal(r.checks.fonts.hint, 'no-web-fonts-found');
    writeFileSync(join(root, 'src/index.html'), font);
    assert.equal(scanDir(root).checks.fonts.signals.googleFonts.matches[0].file, 'src/index.html');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
