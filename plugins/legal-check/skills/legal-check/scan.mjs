#!/usr/bin/env node
// scan.mjs: find evidence for the six legal-check checks in a project.
//
//   node scan.mjs [dir]        prints { root, files, skipped, truncated, checks } as JSON
//   import { scanDir, scanFiles } from './scan.mjs'
//
// It reads source files line by line and reports what matched and where. Each
// check gets a `hint`, never a verdict: an age gate enforced in a database
// trigger or a switch in a vendor dashboard is invisible to it. The same files
// always give the same result.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// [id, check, pattern]. Patterns run on one line at a time.
const SIGNALS = [
  // 1 · age gate at signup
  ['signup', 'age-gate', /\bsign[-_ ]?up|\bregister(?:Form|Page|Screen|User|Account)|\bcreate_?user|\bUserCreationForm\b|\bRegisteredUserController\b|\bdevise\b|["'`]\/(?:auth\/|accounts?\/)?(?:register|join)\b/i],
  ['oauthOrMagicLink', 'age-gate', /\b(?:Google|GitHub|Apple|Facebook|Discord|Twitter|Microsoft|LinkedIn)Provider\b|\bsignInWith(?:OAuth|Popup|Redirect|IdToken|Otp)\b|\bGoogleAuthProvider\b|\bsendSignInLinkToEmail\b|next-auth\/providers\/|@auth\/[\w-]+\/providers\/|\bpassport-(?:google|github|apple|facebook)|\bomniauth\b|<Sign(?:In|Up)(?:Button)?\b|\buseSign(?:In|Up)\b|\bclerkMiddleware\b|\bsocialProviders\b|@react-native-google-signin\//i],
  ['ageGate', 'age-gate', /\b(?:date[-_ ]?of[-_ ]?birth|birth[-_ ]?(?:date|day|year|month)|dob|min(?:imum)?[-_ ]?(?:signup[-_ ]?)?age|age[-_ ]?(?:gate|verif\w*|check\w*|confirm\w*|screen\w*)|is[-_ ]?over[-_ ]?1[368]|over[-_ ]?1[368]|is[-_ ]?adult|under[-_ ]?13|parental[-_ ]?consent|coppa)\b/i],

  // 2 · fonts
  ['googleFonts', 'fonts', /fonts\.(?:googleapis|gstatic)\.com/i],
  ['otherFontCdn', 'fonts', /\b(?:use|p)\.typekit\.net|\b(?:kit|use)\.fontawesome\.com|\bfast\.fonts\.net|\bcloud\.typography\.com|\bfonts\.bunny\.net|\bfonts\.cdnfonts\.com|\b(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)\/\S*?(?:fonts?\b|\.woff2?\b|font-?awesome|fontsource)/i],
  ['fontLoaderReview', 'fonts', /\bunplugin-fonts\b|\bwebfontloader\b|\bWebFont\.load\b/],
  ['selfHostedFonts', 'fonts', /next\/font\/(?:google|local)|@next\/font|@fontsource(?:-variable)?\/|\bvite-plugin-webfont-dl\b|@nuxt\/fonts|@nuxtjs\/google-fonts|@expo-google-fonts\/|\bexpo-font\b/],
  ['fontFace', 'fonts', /@font-face\b/],

  // 3 · session replay: one signal per vendor, then the evidence that it's handled
  ['posthog', 'session-replay', /\bposthog-js\b|\bposthog\.init\s*\(|\bPostHogProvider\b|\bposthog-react-native\b/],
  ['sentryReplay', 'session-replay', /\breplayIntegration\s*\(|\bnew\s+(?:Sentry\.)?Replay\s*\(|\bSentry\.Replay\b|\breplays(?:Session|OnError)SampleRate\b|\bmobileReplayIntegration\b/],
  ['logrocket', 'session-replay', /\blogrocket\b/i],
  ['fullstory', 'session-replay', /@fullstory\/|\bfullstory\.com\b|\b_fs_org\b|\bFullStory\s*\(/],
  ['hotjar', 'session-replay', /@hotjar\/browser|\bstatic\.hotjar\.com\b|\bhjid\b|\bHotjar\.init\b|\breact-hotjar\b/],
  ['clarity', 'session-replay', /@microsoft\/clarity|\bclarity\.ms\b|\bClarity\.init\s*\(/],
  ['datadogReplay', 'session-replay', /@datadog\/browser-rum|\bsessionReplaySampleRate\b|\bdatadogRum\.init\b/],
  ['mixpanelReplay', 'session-replay', /\brecord_sessions_percent\b|\bstart_session_recording\b/],
  ['amplitudeReplay', 'session-replay', /@amplitude\/(?:plugin-)?session-replay/],
  ['otherReplay', 'session-replay', /\bmouseflow\b|\bsmartlook\b|\bhighlight\.run\b|@highlight-run\/|@openreplay\/|\brrweb\b|\binspectlet\b|\bluckyorange\b|\bcrazyegg\b|\bcontentsquare\b|\bquantummetric\b|\bheapanalytics\b|\bheap-api\.com\b|\buxcam\b|\bglassbox\b/i],
  ['replayOff', 'session-replay', /\bdisable_session_recording\s*:\s*true\b|\bstartCaptureManually\s*:\s*true\b|\b_fs_capture_on_startup\b|\bstartSessionReplayRecordingManually\s*:\s*true\b|\b(?:sessionReplaySampleRate|replaysSessionSampleRate|replaysOnErrorSampleRate)\s*:\s*0(?:\.0+)?(?![.\d])|\brecord_sessions_percent['"]?\s*:\s*0(?:\.0+)?(?![.\d])|\btrackingConsent\s*:\s*['"]not-granted['"]/],
  ['replayMasking', 'session-replay', /\bmaskAll(?:Inputs|Text)\b|\bmaskTextSelector\b|\b(?:input|text)Sanitizer\b|\bdefaultPrivacyLevel\b|\bblockAllMedia\b|\bdata-private\b|\bfs-(?:mask|exclude)\b|\bph-no-capture\b|\bdata-hj-suppress\b|\bdata-clarity-mask\b|\bprivacySetting\b|\bobscure(?:Text|Input)Emails\b/],
  ['consent', 'session-replay', /\bcookie[-_ ]?consent|\bcookiebot|\bonetrust\b|\bOptanonWrapper\b|\bosano\b|\biubenda\b|\btermly\b|\busercentrics\b|\bklaro\b|\bcookieyes\b|\bconsentV2\b|\bopt_in_capturing\b|\bsetTrackingConsent\b|\bhasConsent\b|\bconsentGiven\b|\banalytics_storage\b|\bgtag\(\s*['"]consent['"]/i],

  // 4 · marketing email
  ['emailSend', 'marketing-email', /\bfrom\s+['"](?:resend|@sendgrid\/mail|postmark|mailgun\.js|mailgun-js|nodemailer|@aws-sdk\/client-sesv?2?|loops|@getbrevo\/brevo|sib-api-v3-sdk|@mailchimp\/mailchimp_(?:transactional|marketing)|customerio-node|@plunk\/node|mailersend|sparkpost)['"]|\brequire\(\s*['"](?:resend|@sendgrid\/mail|postmark|mailgun\.js|mailgun-js|nodemailer|@aws-sdk\/client-sesv?2?|loops|mailersend|sparkpost)['"]\s*\)|\bnew\s+Resend\s*\(|\bresend\.(?:emails|batch|broadcasts)\b|\bsgMail\.send|\bSendGridAPIClient\b|\bnodemailer\.createTransport|\bSend(?:Raw)?EmailCommand\b|\bimport\s+(?:smtplib|resend)\b|\bsend_(?:mass_)?mail\s*\(|\bEmailMessage\s*\(|\bdjango\.core\.mail\b|\bflask_mail\b|\bActionMailer\b|\bApplicationMailer\b|\bMail::(?:to|send|queue)\b|\bextends\s+Mailable\b/],
  ['emailTemplate', 'marketing-email', /@react-email\/|\bfrom\s+['"]react-email['"]|<mjml\b|<mj-(?:body|section|column|text)\b|\bApplicationMailer\b|\bextends\s+Mailable\b/],
  ['unsubscribeEndpoint', 'marketing-email', /["'`]\/(?:api\/)?(?:emails?\/)?unsubscribe\b|\bList-Unsubscribe\b/i],
  ['suppression', 'marketing-email', /\bmarketing[-_]?opt[-_]?(?:out|in)\w*|\bunsubscribed[-_]?at\b|\bemail[-_]?opt[-_]?(?:out|in)\w*|\bmarketing[-_]?consent\w*|\bsuppression[-_]?list\b|\bis[-_]?unsubscribed\b/i],

  // 5 · renewal terms
  ['subscription', 'renewal-terms', /\bmode\s*:\s*['"]subscription['"]|\bsubscriptions\.create\b|\bcheckout\.sessions\.create\b|<stripe-(?:pricing-table|buy-button)\b|\bbuy\.stripe\.com\b|\bbillingPortal\b|@paddle\/paddle-js|\bPaddle\.(?:Checkout|Initialize|Setup)\b|\blemon-?squeezy\b|\blemon\.js\b|@polar-sh\/|\bchargebee\b|\brecurly\b|\breact-native-purchases\b|@revenuecat\/|\bRevenueCat\b|\bPurchases\.configure\b|\bStoreKit\b|\bSubscriptionStoreView\b|\bBillingClient\b|\brecurring\s*:\s*\{|\binterval\s*:\s*['"](?:day|week|month|year)['"]/i],
  ['subscribeCta', 'renewal-terms', /(?:>|["'`])\s*(?:Subscribe(?: now)?|Start (?:your |my )?(?:free )?trial|Upgrade(?: now| to \w+| plan)?|Go (?:Pro|Premium)|Get (?:Pro|Premium)|Start subscription|Choose (?:this )?plan|Buy now|Continue to (?:payment|checkout)|Confirm (?:and )?(?:pay|subscribe))\s*(?:<|["'`])|^\s*(?:Subscribe(?: now)?|Start (?:your |my )?(?:free )?trial|Upgrade(?: now)?|Go Pro|Get Pro|Start subscription|Buy now)\s*$/i],
  ['renewalTerms', 'renewal-terms', /auto(?:matically)?[- ]?renew|renews? (?:automatically|monthly|yearly|annually|every|each)|until (?:you )?cancel|cancel (?:any ?time|at any time)|recurring (?:charge|billing|payment)|billed (?:monthly|annually|yearly|every|each)|\bcustom_text\b|\bterms_of_service_acceptance\b|\bconsent_collection\b/i],

  // 6 · DMCA agent
  ['uploads', 'dmca', /\bmulter\b|\bbusboy\b|\bformidable\b|\buploadthing\b|\bcreatePresignedPost\b|\bgetSignedUrl\b|\bPutObjectCommand\b|\.putObject\s*\(|@vercel\/blob|\.storage\s*\.\s*from\s*\(|firebase\/storage|\buploadBytes(?:Resumable)?\b|\bcloudinary\b|\bupload_preset\b|\breact-dropzone\b|\buseDropzone\b|\bfilepond\b|@uppy\/|\btype\s*=\s*\{?\s*["']file["']|\bhas_(?:one|many)_attached\b|\bActiveStorage\b|\b(?:File|Image)Field\s*\(|\brequest\.files\b|\bUploadFile\b|\bStorage::(?:put|putFile|disk)\b|->store(?:As)?\s*\(|\bmove_uploaded_file\b|multipart\/form-data/i],
  ['dmcaPolicy', 'dmca', /\bDMCA\b|\bdesignated agent\b|\bcopyright agent\b|\bnotice of (?:claimed )?infringement\b|\bcounter[- ]?notices?\b|\bcounter[- ]?notification\b|\brepeat infringers?\b|\b512\(c\)/i],
];

// Only checked inside email templates and email-sending files: `unsubscribe()`
// on an RxJS subscription or a street name in a fixture would be noise elsewhere.
const EMAIL_SIGNALS = [
  ['unsubscribe', /(?<![.\w])unsubscribe|\bopt[-_ ]?out\b|\bemail[-_ ]?preferences\b|\bRESEND_UNSUBSCRIBE_URL\b|\*\|UNSUB\|\*|\basm_(?:group|global)_unsubscribe|\bpm:unsubscribe\b/i],
  ['postalAddress', /\b(?:postal|mailing|physical|company|business)[-_ ]?address\b|\bLEGAL_POSTAL_ADDRESS\b|\bP\.?\s?O\.?\s?Box\b|\b\d{1,6}\s+[A-Za-z0-9.' -]{1,40}\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Suite|Ste)\b|\*\|LIST:ADDRESS\|\*|\bSender_Address\b/i],
  ['marketingHint', /\b(?:newsletter|announcement|introducing|launch(?:ed|ing)?|product[-_ ]?update|what'?s[-_ ]new|new features?|big news|early access|digest|promo(?:tion|tional)?|campaign|broadcast|marketing|drip|re-?engage\w*|win[-_ ]?back|upsell|discount|coupon|special offer|limited[- ]time|last chance)\b|\b\d{1,2}% off\b/i],
];

// A shared footer usually lives in its own file, so a template is credited with
// what the files it imports (one level deep) or its footer partial contain.
const IMPORT_RE = /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]|\brequire\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
const INCLUDE_FOOTER_RE = /(?:@include|\binclude|\brender|\bpartial|\{\{>)\s*\(?\s*['"]?[\w./-]*footer/i;
const RESOLVE_SUFFIXES = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

const REPLAY_VENDORS = ['posthog', 'sentryReplay', 'logrocket', 'fullstory', 'hotjar', 'clarity', 'datadogReplay', 'mixpanelReplay', 'amplitudeReplay', 'otherReplay'];
const CHECKS = ['age-gate', 'fonts', 'session-replay', 'marketing-email', 'renewal-terms', 'dmca'];
const CHECK_OF = Object.fromEntries([
  ...SIGNALS.map(([id, check]) => [id, check]),
  ...EMAIL_SIGNALS.map(([id]) => [id, 'marketing-email']),
]);

const EMAIL_DIR = /(?:^|\/)(?:emails?|mail|mailers|\w+_mailer|email[-_]templates|mail[-_]templates)\//i;
const MANIFEST = /(?:^|\/)(?:package\.json|composer\.json|Gemfile|Podfile|requirements\.txt|pyproject\.toml|pubspec\.yaml)$/;
const TEMPLATE_EXT = /\.(?:[jt]sx?|mjs|html?|mjml|hbs|handlebars|mustache|ejs|erb|haml|njk|liquid|twig|php|jinja2?|j2|txt|vue|svelte|astro)$/i;
const MAX_MATCHES = 20;
const MAX_TEXT = 140;

// Long runs of letters AND digits look like keys or tokens; don't echo them.
const redact = (s) => s.replace(/[A-Za-z0-9_-]{24,}/g, (m) => (/\d.*\d/.test(m) && /[A-Za-z].*[A-Za-z]/.test(m) ? `${m.slice(0, 4)}…` : m));
const clip = (s) => {
  const t = redact(s.trim());
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}…` : t;
};

/**
 * Scan in-memory files. `files` is [{ path, text }] with paths relative to the
 * project root, using forward slashes.
 */
export function scanFiles(files) {
  const found = Object.fromEntries(Object.keys(CHECK_OF).map((id) => [id, { count: 0, matches: [] }]));
  const hit = (id, file, line, text) => {
    const s = found[id];
    s.count += 1;
    if (s.matches.length < MAX_MATCHES) s.matches.push({ file, line, text: clip(text) });
  };
  const templates = [];
  const related = new Map(); // template path -> { imports, includesFooter }

  for (const { path, text } of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const lines = String(text ?? '').split(/\r?\n/);
    const own = new Set();
    lines.forEach((line, i) => {
      for (const [id, , re] of SIGNALS) {
        if (re.test(line)) {
          hit(id, path, i + 1, line);
          own.add(id);
        }
      }
    });

    // Signals that come from where a file lives rather than what it says. A file
    // in an emails/ folder counts as a template only if it has markup (or is plain
    // text), so index.ts and helpers there don't show up as footer-less templates.
    const byLocation = EMAIL_DIR.test(path) && TEMPLATE_EXT.test(path) && (/<[A-Za-z]/.test(text) || /\.txt$/i.test(path));
    if (byLocation && !own.has('emailTemplate')) {
      hit('emailTemplate', path, 1, '(email template by location)');
      own.add('emailTemplate');
    }
    if (/\.mjml$/i.test(path) && !own.has('emailTemplate')) {
      hit('emailTemplate', path, 1, '(MJML file)');
      own.add('emailTemplate');
    }
    if (/(?:^|\/)unsubscribe(?:\/|\.|$)/i.test(path) && !own.has('unsubscribeEndpoint')) {
      hit('unsubscribeEndpoint', path, 1, '(unsubscribe route by location)');
    }
    if (/(?:^|\/)(?:dmca|copyright)(?:\/|\.|$)/i.test(path) && !own.has('dmcaPolicy')) {
      hit('dmcaPolicy', path, 1, '(DMCA/copyright page by location)');
    }

    // A dependency manifest shows which SDKs are installed; it is never a template.
    if (MANIFEST.test(path)) continue;
    const isTemplate = own.has('emailTemplate');
    if (!isTemplate && !own.has('emailSend')) continue;
    const seen = new Set();
    lines.forEach((line, i) => {
      for (const [id, re] of EMAIL_SIGNALS) {
        if (re.test(line)) {
          hit(id, path, i + 1, line);
          seen.add(id);
        }
      }
    });
    if (isTemplate) {
      templates.push({
        file: path,
        marketing: seen.has('marketingHint'),
        unsubscribe: seen.has('unsubscribe'),
        postalAddress: seen.has('postalAddress'),
      });
      const imports = [...String(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);
      related.set(path, { imports, includesFooter: INCLUDE_FOOTER_RE.test(text) });
    }
  }

  const byFile = new Map(templates.map((t) => [t.file, t]));
  const footers = templates.filter((t) => /footer/i.test(t.file) && t.unsubscribe && t.postalAddress).map((t) => t.file);
  for (const t of templates) {
    if (t.unsubscribe && t.postalAddress) continue;
    const { imports, includesFooter } = related.get(t.file);
    const specs = imports.flatMap((s) => (/\.jsx?$/.test(s) ? [s, s.replace(/\.jsx?$/, '')] : [s]));
    const sources = specs.flatMap((s) => RESOLVE_SUFFIXES.map((x) => posix.normalize(posix.join(posix.dirname(t.file), s + x))));
    if (includesFooter) sources.push(...footers);
    const via = new Set();
    for (const src of sources) {
      const other = byFile.get(src);
      if (!other || other === t || !(other.unsubscribe || other.postalAddress)) continue;
      t.unsubscribe ||= other.unsubscribe;
      t.postalAddress ||= other.postalAddress;
      via.add(src);
    }
    if (via.size) t.via = [...via];
  }

  const has = (id) => found[id].count > 0;
  const vendors = REPLAY_VENDORS.filter(has);
  const missingFooter = templates.filter((t) => !t.unsubscribe || !t.postalAddress);
  const marketingMissing = missingFooter.filter((t) => t.marketing);
  const hints = {
    'age-gate':
      !has('signup') && !has('oauthOrMagicLink') ? 'no-signup-found'
        : !has('ageGate') ? 'no-age-question-found'
          : 'age-question-found-check-server-enforcement',
    fonts:
      has('googleFonts') ? 'google-fonts-loaded-from-google'
        : has('otherFontCdn') ? 'third-party-font-cdn'
          : has('fontLoaderReview') ? 'font-loader-check-config'
            : has('selfHostedFonts') || has('fontFace') ? 'fonts-look-self-hosted'
              : 'no-web-fonts-found',
    'session-replay':
      vendors.length === 0 ? 'no-replay-tool-found'
        : has('consent') ? 'replay-tool-found-check-consent-gating-and-masking'
          : has('replayOff') ? 'replay-off-switch-found-verify-every-tool'
            : 'replay-tool-found-no-consent-or-off-switch',
    'marketing-email':
      !has('emailSend') && templates.length === 0 ? 'no-email-code-found'
        : templates.length === 0 ? 'sending-code-found-no-templates-located'
          : marketingMissing.length > 0 ? 'marketing-templates-missing-unsubscribe-or-address'
            : missingFooter.length > 0 ? 'some-templates-missing-footer-check-which-are-marketing'
              : 'footers-found-check-every-marketing-email',
    'renewal-terms':
      !has('subscription') ? 'no-subscription-found'
        : !has('renewalTerms') ? 'no-renewal-terms-found'
          : 'renewal-terms-found-check-placement',
    dmca:
      !has('uploads') ? 'no-uploads-found'
        : !has('dmcaPolicy') ? 'uploads-found-no-dmca-page'
          : 'dmca-page-found-check-registration',
  };

  const checks = {};
  for (const check of CHECKS) {
    const signals = Object.fromEntries(Object.entries(found).filter(([id]) => CHECK_OF[id] === check));
    checks[check] = { hint: hints[check], signals };
  }
  checks['session-replay'].vendors = vendors;
  checks['marketing-email'].templates = templates;
  checks['marketing-email'].templatesMissingFooter = missingFooter.length;
  checks['marketing-email'].marketingTemplatesMissingFooter = marketingMissing.length;
  return { files: files.length, checks };
}

const SKIP_DIRS = new Set([
  'node_modules', 'bower_components', 'vendor', '.git', '.hg', '.svn', '.claude',
  '.next', '.nuxt', '.output', '.svelte-kit', '.vercel', '.netlify', '.turbo', '.cache', '.parcel-cache',
  '.expo', '.gradle', '.idea', '.vscode', '.angular', '.docusaurus', '.yarn', '.pnpm-store', '.terraform',
  'dist', 'build', 'out', 'coverage', 'storybook-static', 'tmp', 'target', 'Pods', 'DerivedData',
  'venv', '.venv', '__pycache__',
]);
const EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte', '.astro',
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl', '.mdx', '.json', '.yaml', '.yml', '.toml', '.xml', '.txt',
  '.py', '.rb', '.erb', '.haml', '.slim', '.php', '.twig', '.ejs', '.hbs', '.handlebars', '.mustache', '.njk',
  '.liquid', '.jinja', '.jinja2', '.j2', '.pug', '.mjml', '.go', '.java', '.kt', '.kts', '.swift', '.dart',
  '.cs', '.cshtml', '.razor', '.ex', '.exs', '.heex', '.eex',
]);
const NAMES = new Set(['Gemfile', 'Podfile']);
const LOCKFILES = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'composer.lock',
  'Gemfile.lock', 'poetry.lock', 'Pipfile.lock', 'Cargo.lock', 'go.sum', 'Podfile.lock',
]);
const MAX_BYTES = 512 * 1024;
const MAX_FILES = 20000;
const SELF_DIR = dirname(fileURLToPath(import.meta.url));

/** Walk `root`, read the source files, and scan them. */
export function scanDir(root = '.') {
  const abs = resolve(root);
  const files = [];
  const skipped = { large: 0, binary: 0, unreadable: 0 };
  let truncated = false;

  const walk = (dir) => {
    if (truncated) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (truncated) return;
      const full = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && full !== SELF_DIR) walk(full);
        continue;
      }
      if (!e.isFile() || LOCKFILES.has(e.name) || /\.min\.|\.map$/.test(e.name)) continue;
      if (!EXTENSIONS.has(extname(e.name).toLowerCase()) && !NAMES.has(basename(e.name))) continue;
      if (files.length >= MAX_FILES) {
        truncated = true;
        return;
      }
      let buf;
      try {
        if (statSync(full).size > MAX_BYTES) {
          skipped.large += 1;
          continue;
        }
        buf = readFileSync(full);
      } catch {
        skipped.unreadable += 1;
        continue;
      }
      if (buf.subarray(0, 8000).includes(0)) {
        skipped.binary += 1;
        continue;
      }
      files.push({ path: relative(abs, full).split(sep).join('/'), text: buf.toString('utf8') });
    }
  };

  walk(abs);
  const result = scanFiles(files);
  return { root: abs, files: result.files, skipped, truncated, checks: result.checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? '.';
  let ok = false;
  try {
    ok = statSync(dir).isDirectory();
  } catch {}
  if (!ok) {
    console.error('usage: node scan.mjs [project directory]');
    process.exit(2);
  }
  console.log(JSON.stringify(scanDir(dir), null, 1));
}
