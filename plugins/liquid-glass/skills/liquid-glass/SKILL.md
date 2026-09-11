---
name: liquid-glass
description: >-
  Build Apple-grade Liquid Glass for the web — a physical frosted MATERIAL, not a
  tinted blur filter. Use when building or styling glass / glassmorphism / frosted
  / translucent / "iOS 26" / "macOS Tahoe" Liquid Glass UI (cards, toolbars, tab
  bars, buttons, sheets, sidebars), or fixing glass that looks flat, muddy, or
  "like a colored sticker on a photo." Covers the material recipe, SVG-displacement
  refraction (Chromium), WebGL (canvas/video/Safari), CSS fallback, and the
  liquid-metal logo variant.
license: MIT
---

# Liquid Glass — build a MATERIAL, not a filter

If your glass looks flat, muddy, or like "a dusty colored sticker on a photo," you
built a **filter** (a see-through tint). Apple's Liquid Glass is a **physical
frosted pane**: it diffuses the backdrop into a smooth wash, catches light on a cut
edge, floats on a shadow, and never lets bright colors bully it into mud.

**Follow ALL FIVE rules below. They are non-negotiable and ordered by impact.**
Rules 1–4 are pure CSS and work in every browser. Rule 5 (refraction) is the
Chromium-only finish. Getting 1–4 right is 90% of the look — do not skip them to
chase refraction.

## The 5 rules (with exact values)

1. **DIFFUSE, don't tint.** `backdrop-filter: blur(24px)` — heavy enough that the
   backdrop becomes a smooth abstract wash. Background *detail must be obliterated*,
   not visible-and-tinted. (Weak blur like 8px is the #1 cause of "filter" look.)

2. **TONE-MANAGE so it never muddies.** Add `saturate(1.9) brightness(1.08)` to the
   backdrop-filter, AND a **strong body wash**: `background: rgba(255,255,255,0.28)`.
   The wash + saturation force bright colors into a clean pastel; without it, orange
   and blue behind the glass turn dull. (Dark glass: `brightness(0.82)`,
   `rgba(22,22,26,0.5)`.)

3. **CUT A PHYSICAL EDGE.** A crisp, bright, ~1px **inner** light-catch — brightest
   at the top — defines where the glass stops. Use an `inset` highlight in
   `box-shadow` plus a masked gradient border. Without it the pane melts into the
   background.

4. **FLOAT it.** A large, soft, diffuse drop shadow lifts the pane off the wallpaper:
   `box-shadow: 0 12px 32px rgba(0,0,0,0.22)`. No shadow = taped to the wall.

5. **THEN the optics (Chromium):** edge-lensing refraction + a specular highlight
   that moves with the pointer + subtle chromatic aberration. This is the finish on
   top of a correct material — never a substitute for rules 1–4.

## Copy-paste recipe (rules 1–4, works in every browser)

```css
.glass {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.28);                                   /* 2 */
  backdrop-filter: blur(24px) saturate(1.9) brightness(1.08);             /* 1+2 */
  -webkit-backdrop-filter: blur(24px) saturate(1.9) brightness(1.08);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.22),          /* 4: soft float shadow */
    0 2px 6px rgba(0, 0, 0, 0.12),
    inset 0 1px 1px rgba(255, 255, 255, 0.75),/* 3: top light-catch */
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),/* 3: hairline cut edge */
    inset 0 -1px 1px rgba(0, 0, 0, 0.06);
  position: relative;
}
```

That alone fixes flat/muddy glass. The skill's `assets/liquid-glass.css` is this
recipe, tunable via CSS variables, plus the moving-specular `::before`/`::after`
layers and a `liquid-glass--dark` preset.

## Add rule 5 — real refraction (Chromium)

Copy `assets/{displacement-map.js, liquid-glass.js, liquid-glass.css}`, then:

```html
<link rel="stylesheet" href="liquid-glass.css" />
<div class="liquid-glass" style="--lg-radius:28px">…content…</div>
<script type="module">
  import { LiquidGlass } from './liquid-glass.js';
  new LiquidGlass(document.querySelector('.liquid-glass'), { radius: 28, scale: 70, chroma: 0.5 });
</script>
```

`liquid-glass.js` composes `backdrop-filter: url(#filter) blur(24px) saturate(1.9)
brightness(1.08)` — refraction **plus** the same heavy frost, so the premium path
diffuses just as hard. On Safari/Firefox it stays the CSS frost (still correct).

**React:** copy the single self-contained file `assets/LiquidGlass.tsx`:
```tsx
<LiquidGlass radius={28} scale={70} chroma={0.5} dark={false} className="w-80 p-6">…</LiquidGlass>
```

## Debug: "it still looks wrong"

| Symptom | Rule you skipped | Fix |
| --- | --- | --- |
| Background detail bleeds through / "sticker" | 1 | raise `blur` to 24–40px |
| Bright colors go dull/muddy | 2 | add `saturate(1.9) brightness(1.08)` + raise tint opacity to 0.3 |
| Pane edges melt into the background | 3 | add the inset light-catch + hairline |
| Looks flush / taped to the wall | 4 | add the large soft drop shadow |
| Refracts but diffuses weakly (Chromium) | — | ensure the SVG filter is chained WITH `blur()`, not replacing it |
| Text on glass hard to read | 2 | raise tint opacity (0.3–0.4) or add a scrim |

## Tiers & files

| Situation | Tier | Asset |
| --- | --- | --- |
| DOM UI on a normal page | **A — SVG displacement** | `liquid-glass.{js,css}` |
| Glass over `<canvas>`/`<video>`/WebGL, or lensing in Safari/Firefox | **B — WebGL** | `webgl-glass.js` |
| Just needs to look glassy on unsupported browsers | **C — CSS frost** | built into A |
| Flowing liquid-**metal** logo | variant | `liquid-metal.frag.glsl` |

```
assets/  displacement-map.js · liquid-glass.css · liquid-glass.js · LiquidGlass.tsx
         webgl-glass.js · liquid-metal.frag.glsl · demo.html · demo-webgl.html
references/  design-principles.md · svg-displacement.md · webgl.md
             liquid-metal.md · browser-support.md
```

**Read next:** `references/design-principles.md` (the material mindset + anti-patterns),
`references/browser-support.md` (SVG refraction is Chromium-only; fallback is built in).

## Guardrails

- Glass is a **layer over content**, not a background. One glass level at a time;
  never stack glass on glass (muddies instantly).
- **Legibility ≥ 4.5:1.** Over busy/unknown backdrops, raise tint opacity or add a
  scrim. Honor `prefers-reduced-transparency` and `prefers-reduced-motion` (the CSS
  does).
- Generate the displacement map on mount/resize, never per frame; animate `scale`.

## Verify

```
python3 -m http.server 8000 --directory assets   # open /demo.html in Chrome
```
Chrome shows full refraction; Safari/Firefox show the frosted fallback (expected).
`/demo-webgl.html` shows Tier B, which refracts in any browser with WebGL2.
