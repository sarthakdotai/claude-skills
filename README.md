# claude-skills

Skills for [Claude Code](https://code.claude.com), packaged as a plugin marketplace.

| Plugin | What it does |
| --- | --- |
| [`liquid-glass`](plugins/liquid-glass/skills/liquid-glass/SKILL.md) | Apple-grade Liquid Glass for the web: the frosted material recipe, SVG-displacement refraction (Chromium), a WebGL2 tier for canvas/video and Safari/Firefox, a CSS fallback, and a liquid-metal logo shader. Ships runnable assets and demos. |
| [`grammar-check`](plugins/grammar-check/skills/grammar-check/SKILL.md) | Grammarly-style check of a file or pasted text: correctness, clarity, engagement and delivery, with numbered fixes, a computed score, a deterministic AI-pattern score and an optional apply-fixes pass. |

## Install

In Claude Code:

```
/plugin marketplace add sarthakdotai/claude-skills
/plugin install liquid-glass@sarthakdotai
/plugin install grammar-check@sarthakdotai
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

## License

[MIT](LICENSE) © 2026 sarthakdotai
