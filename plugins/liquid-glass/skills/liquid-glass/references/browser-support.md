# Browser support, fallback, performance, accessibility

The single most important production fact about web Liquid Glass:

> **SVG filters inside `backdrop-filter` render only in Chromium.**
> Safari and Firefox (and, ironically, every iOS browser — all WebKit) do **not**
> composite `backdrop-filter: url(#svg)`. They must fall back to frosted glass.

Design for this from the start. Never ship the SVG path as the only path.

## Compatibility matrix (Tier A — SVG displacement)

| Engine              | Real refraction? | Falls back to        |
| ------------------- | ---------------- | -------------------- |
| Chrome / Edge / Opera / Brave (Chromium) | ✅ yes | — |
| Safari (macOS/iOS, all WebKit)           | ❌ no  | `backdrop-filter: blur()` frost |
| Firefox                                  | ❌ no  | `backdrop-filter: blur()` frost |

`backdrop-filter: blur()` *itself* is widely supported (Safari needs the
`-webkit-` prefix; both are set in `liquid-glass.css`). Only the **SVG-filter
refraction** is Chromium-only.

## Fallback strategy (already built in)

There is no clean `@supports` test for "SVG filter *inside* backdrop-filter": the
`url()` syntax parses everywhere but only Chromium renders it. So detection is
engine-based, done in JS:

```js
const ok = CSS.supports('backdrop-filter','url(#x)') ||
           CSS.supports('-webkit-backdrop-filter','url(#x)');
const chromium = /Chrome|Chromium|CriOS|Edg|OPR/.test(navigator.userAgent) &&
                 !/Edge\//.test(navigator.userAgent);
const supportsRefraction = ok && chromium;
```

Layering that makes it robust:
1. **Base CSS** = frosted glass (`blur()` + tint + rim + shadow). Works everywhere;
   this is what Safari/Firefox users see. It already looks good.
2. **JS upgrade**: only when `supportsRefraction`, generate the map and overwrite
   `backdrop-filter` with `url(#filter)` for true lensing.
3. **Need real refraction in Safari/Firefox too?** Use **Tier B (WebGL)** for those
   surfaces — it doesn't rely on `backdrop-filter`. See `references/webgl.md`.

So the honest promise to users: *Apple-grade lensing in Chromium; a clean frosted
fallback everywhere else; opt into WebGL if you need lensing cross-browser.*

## Performance

- **Map generation is the cost.** It's an O(w·h) per-pixel loop → a PNG. Generate
  on mount and on resize (debounced via ResizeObserver), **never per frame**.
- **Animating is cheap** if you only tween the `<feDisplacementMap scale>` (or CSS
  vars) — no map rebuild. Great for press/hover "liquid" reactions.
- Cap DPR at ~2 for the map; beyond that you pay a lot for little.
- Keep `feGaussianBlur` modest; large blur radii on large surfaces are expensive.
- Limit the number of concurrent glass elements; each is its own filter + backdrop
  raster. A handful is fine; dozens will jank.
- SVG displacement lacks supersampling → slight pixelation at high `scale`; a
  small trailing blur hides it.

## Accessibility

- **Contrast is the real risk.** Translucent surfaces can drop text below WCAG
  4.5:1. Over unknown/busy backdrops, raise `--lg-tint-opacity` (~0.2–0.3) or add a
  scrim behind text. Test the *worst-case* backdrop, not a friendly one.
- **`prefers-reduced-transparency`**: honor it — collapse to a solid/near-solid
  surface. `@media (prefers-reduced-transparency: reduce) { .liquid-glass { background: rgb(var(--lg-tint) / 0.9); backdrop-filter: none; } }`
- **`prefers-reduced-motion`**: kill the moving sheen and the press squish (already
  handled in the CSS).
- **Don't encode meaning in the glass alone** — it's decoration over real content;
  keep focus rings, labels, and roles intact.

## Quick decision: which tier?

- DOM UI (cards, bars, buttons, sheets) on a normal page → **Tier A**. Ships with
  Tier C fallback automatically.
- Glass over `<canvas>` / `<video>` / WebGL, or lensing required in Safari/Firefox
  → **Tier B (WebGL)**.
- Only need it to look glassy on unsupported browsers → **Tier C** (the CSS
  fallback) is already there; do nothing extra.
- A flowing liquid-chrome logo → the **liquid-metal variant**.
```
