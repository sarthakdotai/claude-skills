# claude-skills

Skills for [Claude Code](https://code.claude.com), packaged as a plugin marketplace.

| Plugin | What it does |
| --- | --- |
| [`liquid-glass`](plugins/liquid-glass/skills/liquid-glass/SKILL.md) | Apple-grade Liquid Glass for the web: the frosted material recipe, SVG-displacement refraction (Chromium), a WebGL2 tier for canvas/video and Safari/Firefox, a CSS fallback, and a liquid-metal logo shader. Ships runnable assets and demos. |
| [`grammar-check`](plugins/grammar-check/skills/grammar-check/SKILL.md) | Grammarly-style check of a file or pasted text: correctness, clarity, engagement and delivery, with numbered fixes, a computed score, a deterministic AI-pattern score and an optional apply-fixes pass. |
| [`legal-check`](plugins/legal-check/skills/legal-check/SKILL.md) | Audits an app for six legal traps common in AI-built apps: no age gate at signup (COPPA), Google-hosted fonts (GDPR), session replay without consent (CIPA), marketing email without an unsubscribe link or postal address (CAN-SPAM), no renewal terms by the subscribe button (California auto-renewal law), and no registered DMCA agent. Fixes what code can fix and walks you through the rest. **Not legal advice** ([disclaimer](plugins/legal-check/skills/legal-check/DISCLAIMER.md)). |

## Install

In Claude Code:

```
/plugin marketplace add sarthakdotai/claude-skills
/plugin install liquid-glass@sarthakdotai
/plugin install grammar-check@sarthakdotai
/plugin install legal-check@sarthakdotai
```

Or copy a skill folder (for example `plugins/grammar-check/skills/grammar-check`) into `~/.claude/skills/`.

## Try them

- **liquid-glass**: ask Claude to "make this card Liquid Glass", or open the demos:
  ```
  python3 -m http.server 8000 --directory plugins/liquid-glass/skills/liquid-glass/assets
  ```
  then `/demo.html` (SVG tier, Chromium) and `/demo-webgl.html` (WebGL tier, any browser with WebGL2).
- **grammar-check**: ask Claude to grammar-check a file, or run `/grammar-check:grammar-check <file or text>`
  (`/grammar-check` if you copied the skill folder). The AI-pattern detector also runs on its own:
  ```
  node plugins/grammar-check/skills/grammar-check/detector.mjs <file>
  ```
  Tests: `cd plugins/grammar-check/skills/grammar-check && node --test`
- **legal-check**: ask Claude to "audit my app for legal risks", or run `/legal-check:legal-check [app dir]`
  (`/legal-check` if you copied the skill folder). Add `audit` to get the report without any code changes.
  It's built from this prompt:
  > Audit my app for these 6 legal risks and fix them: add an age gate to signup, self-host my fonts, turn off session replay (or add consent + input masking), add an unsubscribe link and postal address to every marketing email, show renewal terms right next to the subscribe button, and walk me through registering a DMCA agent.

  The scanner also runs on its own:
  ```
  node plugins/legal-check/skills/legal-check/scan.mjs <app dir>
  ```
  Tests: `cd plugins/legal-check/skills/legal-check && node --test`

## Disclaimer (legal-check)

`legal-check` checks six common problems only. It is not legal advice. It never guarantees that
your app meets all legal requirements, and passing all six checks does not make an app legally
compliant. The author, sarthakdotai, and contributors are not liable for anything that results from
using it. You are responsible for your app's compliance. Full text:
[DISCLAIMER.md](plugins/legal-check/skills/legal-check/DISCLAIMER.md).

## License

[MIT](LICENSE) © 2026 sarthakdotai
