# 3 · Session replay: off, or consent + masking (CIPA)

## Why it matters

- Session-replay scripts record what visitors do: mouse movement, clicks,
  scrolling, and, unless masked, what they type. Plaintiffs argue that a
  third party is intercepting communications without consent, which is
  wiretapping under the California Invasion of Privacy Act (Cal. Penal Code
  § 631).
- CIPA gives **$5,000 per violation** in statutory damages (§ 637.2), with no
  need to prove harm. That makes it a favorite for class actions over
  website tracking.
- Courts are split. Some cases were dismissed because the vendor was treated
  as the site's own tool. Others went forward, and the Ninth Circuit held in
  *Javier v. Assurance IQ* (2022) that consent has to come **before**
  recording starts. Similar suits have been brought under Pennsylvania's
  wiretap law (*Popa v. Harriet Carter Gifts*, 3d Cir. 2022) and other
  states' laws.
- California SB 690 passed the Legislature on Aug 28, 2026. As of Sept 28,
  2026 it was waiting on the Governor, who had until Sept 30 to act. If it
  becomes law, only the Attorney General could bring § 638.51
  ("pen register") claims over website and app tracking, from Jan 1, 2027. It
  does not change § 631 wiretap claims, which are the ones session-replay
  suits rely on.
- In the EU and UK, replay needs opt-in consent under ePrivacy and GDPR
  anyway.
- Replay is often on without anyone deciding it. Sentry's documented setup
  adds `replayIntegration()` with `replaysSessionSampleRate: 0.1` and
  `replaysOnErrorSampleRate: 1.0`. PostHog records whenever the project's
  dashboard setting is on. Clarity, Hotjar, FullStory and LogRocket record by
  default once loaded.

## Detect

| Tool | Signature | Recording is on when |
|---|---|---|
| PostHog | `posthog-js`, `posthog.init(` | `disable_session_recording: true` is missing from `init` and recordings are enabled in the PostHog project settings. The code can't show that dashboard switch, so mark it `REVIEW` unless the option is set. |
| Sentry | `replayIntegration(`, `new Replay(`, `Sentry.Replay` | Either sample rate is above 0. Error-only mode (`replaysOnErrorSampleRate`) still records into a buffer in the browser and uploads it when an error happens. |
| LogRocket | `logrocket`, `LogRocket.init(` | Always, once `init` runs. |
| FullStory | `@fullstory/browser`, `edge.fullstory.com`, `_fs_org` | Unless `startCaptureManually: true` (npm) or `_fs_capture_on_startup = false` (snippet) is set. |
| Hotjar | `@hotjar/browser`, `static.hotjar.com`, `hjid` | Recordings are enabled in Hotjar (the default). |
| Microsoft Clarity | `@microsoft/clarity`, `clarity.ms/tag`, `Clarity.init(` | Always, once loaded. |
| Datadog RUM | `@datadog/browser-rum` | `sessionReplaySampleRate` is above 0 (the default is 0 in current versions) and `startSessionReplayRecordingManually` isn't set. |
| Mixpanel | `mixpanel-browser` | `record_sessions_percent` is above 0 (the default is 0). |
| Amplitude | `@amplitude/plugin-session-replay-browser`, `@amplitude/session-replay-browser` | The plugin is added. |
| Others | `mouseflow`, `smartlook`, `highlight.run`, `@highlight-run/*`, `@openreplay/tracker`, `rrweb`, `inspectlet`, `luckyorange`, `crazyegg`, `contentsquare`, `quantummetric`, Heap | Treat as on. |

Check every init file: client configs, `instrumentation-client.ts`,
`sentry.client.config.*`, layout and root components, `<head>` scripts, and
tag-manager snippets. If Google Tag Manager is present, replay may be loaded
from inside GTM, where the code can't show it. Mark it `REVIEW` and tell the
user to check their GTM tags.

Also look for a consent manager (CookieYes, Cookiebot, OneTrust, Osano,
Termly, iubenda, Usercentrics, Klaro, vanilla-cookieconsent,
react-cookie-consent, or a custom banner), and check whether replay actually
waits for it. A banner that shows up while recording has already started is
not consent.

Scanner signals: one per vendor, plus `replayOff`, `replayMasking`, `consent`.

## Fix — Path A: turn it off (the default)

| Tool | Change |
|---|---|
| Sentry | Remove `Sentry.replayIntegration()` from `integrations`, and remove `replaysSessionSampleRate` and `replaysOnErrorSampleRate` (or set both to `0`). Do this in every Sentry init file. |
| PostHog | Add `disable_session_recording: true` to `posthog.init`. Also tell the user to turn recordings off in the PostHog project settings. |
| Datadog | `sessionReplaySampleRate: 0`. |
| Mixpanel | Remove `record_sessions_percent`, or set it to `0`. |
| Amplitude | Remove the session-replay plugin. |
| LogRocket, FullStory, Clarity, Hotjar, Mouseflow, Smartlook, others | These are replay products. Remove the script or `init` call and the dependency. |

Remove env vars and packages only when they're clearly unused. If the
privacy policy mentions session recording, list the needed edit under NEEDS
YOU.

## Fix — Path B: keep it, behind consent and masking

1. **Record nothing until the user opts in.** Consent given after recording
   has started doesn't cover what was already recorded.
2. **Mask every input and, where the tool allows, all text.** Block images and
   video too. Unmask only specific, harmless UI.
3. **Never record sensitive pages**: sign-in and signup, checkout and payment,
   and settings or forms with personal, health or financial data.
4. **Stop when consent is withdrawn**, and re-check stored consent on every
   page load before starting.
5. **Disclose it** in the privacy policy: name the vendor and say what's
   recorded. Draft this for the user; don't edit the policy yourself.

**PostHog**

```js
posthog.init(POSTHOG_KEY, {
  api_host: POSTHOG_HOST,
  disable_session_recording: true, // nothing is recorded until consent
  session_recording: { maskAllInputs: true, maskTextSelector: '*' },
});

// on opt-in (and on each page load while consent is stored):
posthog.startSessionRecording();
// on opt-out:
posthog.stopSessionRecording();
```

If all analytics should wait for consent, add
`opt_out_capturing_by_default: true` and call `posthog.opt_in_capturing()` on
opt-in. Add the `ph-no-capture` class to elements that must never be
recorded.

**Sentry**

```js
Sentry.init({
  dsn: SENTRY_DSN,
  // don't list replayIntegration() here
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// on opt-in:
Sentry.addIntegration(
  Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
);
// on opt-out:
await Sentry.getReplay()?.stop();
```

The three masking options are `true` by default. Write them out anyway, so
nobody turns them off later without noticing.

**Datadog RUM**

```js
datadogRum.init({
  // ...applicationId, clientToken, site, service
  trackingConsent: 'not-granted',
  sessionReplaySampleRate: 100,
  startSessionReplayRecordingManually: true,
  defaultPrivacyLevel: 'mask',
});

// on opt-in:
datadogRum.setTrackingConsent('granted');
datadogRum.startSessionReplayRecording();
// on opt-out:
datadogRum.stopSessionReplayRecording();
datadogRum.setTrackingConsent('not-granted');
```

**FullStory**

```js
import { init, FullStory } from '@fullstory/browser';

init({ orgId: FULLSTORY_ORG_ID, startCaptureManually: true });
// on opt-in:
FullStory('start');
// on opt-out:
FullStory('shutdown');
```

With the snippet instead of npm, set `window['_fs_capture_on_startup'] = false`
before the snippet and call `FS('start')` on opt-in. Turn on "Private by
Default" in FullStory's settings, and use the `fs-mask` or `fs-exclude`
classes on sensitive elements.

**LogRocket.** Call `init` only after opt-in:

```js
LogRocket.init(LOGROCKET_APP_ID, { dom: { inputSanitizer: true, textSanitizer: true } });
```

The browser SDK has no stop call. On opt-out, stop calling `init`, which
takes effect on the next page load. Put `data-private` on sensitive elements.

**Clarity and Hotjar.** Load them only after opt-in: `Clarity.init(projectId)`
or `Hotjar.init(siteId, 6)`, or inject their script tag at that point. For
Clarity, set the masking mode to Strict in its project settings and use
`data-clarity-mask="true"`. For Hotjar, turn on text suppression and use
`data-hj-suppress`. Clarity's consent API (`Clarity.consentV2`) controls
cookies and storage, not whether it records, so gate the load itself.

**Mixpanel.** Keep `record_sessions_percent: 0` in `init` and call
`mixpanel.start_session_recording()` on opt-in. Check the masking options for
the installed SDK version.

**Wiring to a consent manager.** Call the start function from the consent
manager's "analytics accepted" hook, and the stop function from its
"withdrawn" hook. For example, with vanilla-cookieconsent that's
`onConsent`/`onChange` plus `CookieConsent.acceptedCategory('analytics')`;
with Cookiebot, the `CookiebotOnAccept` event; with OneTrust,
`OptanonWrapper`. Check the installed CMP's docs for its exact API. If the
app has no consent manager, a small banner with Accept and Decline buttons
that stores the choice in `localStorage` is enough to gate replay. Record
nothing until the user clicks Accept.

## Verify

- In a fresh browser profile, without consenting, the Network tab shows no
  requests to the replay vendor's hosts. For SDKs that also do analytics or
  error tracking (PostHog, Sentry, Datadog), check that no recording or
  snapshot payloads are sent.
- After accepting, recording starts, and a test session's replay shows
  inputs masked.
- After withdrawing consent, recording stops.
- Re-run the scanner. `replayOff` or the consent gating shows up next to
  every vendor signal.

## Not covered

Other trackers and pixels (Meta, TikTok, Google Analytics, LinkedIn), chat
widgets (chat transcripts are another common CIPA target), CCPA/CPRA notices,
and cookie banners in general.
