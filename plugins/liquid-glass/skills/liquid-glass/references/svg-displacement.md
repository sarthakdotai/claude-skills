# Tier A — SVG displacement refraction (the core technique)

This is the primary, Apple-grade path for **DOM UI** (cards, toolbars, buttons,
sheets). It refracts the *live* backdrop behind an element, so text and controls
underneath stay real and interactive. Verified working in Chromium.

Assets: `assets/displacement-map.js`, `assets/liquid-glass.js`,
`assets/liquid-glass.css`, `assets/demo.html`.

## How it works, end to end

1. **Generate a displacement map** (a PNG data URL) sized to the element. Each
   pixel encodes, in its **R** and **G** channels, how far the backdrop should
   shift at that point:
   - `R = 128 + dx*127`, `G = 128 + dy*127`, where `(dx,dy)` is the in-plane
     refraction vector normalized to −1..1. **128 = neutral (no shift).**
   - The vector direction is the shape's outward surface normal (gradient of the
     rounded-rect signed-distance field). The magnitude is **strong at the edge,
     zero in the flat center** — this is the lensing.
   - Outside the shape: neutral `(128,128)` so those pixels are left untouched.

2. **Feed it to an SVG filter** and point `backdrop-filter` at that filter:
   ```
   <filter id="glass" color-interpolation-filters="sRGB"
           x="0" y="0" width="W" height="H" filterUnits="userSpaceOnUse">
     <feImage href="{mapDataURL}" width="W" height="H" result="map"/>
     <feDisplacementMap in="SourceGraphic" in2="map"
                        scale="{S}" xChannelSelector="R" yChannelSelector="G"/>
   </filter>
   ```
   ```css
   .glass { backdrop-filter: url(#glass) blur(2px); }
   ```
   `feDisplacementMap` moves each backdrop pixel by
   `offset = scale * ((channel/255) − 0.5)`. So `scale` is the peak displacement
   in px. Because the map is normalized to ±1 at the rim, `scale` reads directly
   as "max edge bend in pixels" (try 40–90).

## The math (displacement map generation)

Signed distance to a rounded rect (center-relative point `p`, half-size `h`,
radius `r`):
```
q = |p| − h + r
sd = length(max(q, 0)) + min(max(q.x, q.y), 0) − r    // <0 inside
```
Per pixel:
```
d   = max(−sd, 0)                 // inward distance from the edge
t   = clamp(d / bezel, 0, 1)      // 0 at edge → 1 at flat interior
mag = pow(1 − t, curvature)       // 1 at edge → 0 at center (curvature 2–4 = glassier)
n   = normalize(∇sd)              // 2D outward normal (finite differences)
R   = 128 + n.x * mag * 127
G   = 128 + n.y * mag * 127
```
`bezel` = width of the curved rim in px; `curvature` = how sharply the bend
concentrates at the very edge. Circle = radius `min(w,h)/2`; pill = radius `h/2`.

A more physically exact route exists (height function → normal → Snell's law with
n≈1.5); the SDF-normal approximation above is simpler, general to any radius, and
visually indistinguishable for UI.

## Chromatic aberration

Run the displacement **three times** with slightly different scales, isolate each
to one channel, and screen them back together:
```
scale_R = S*(1+chroma*0.25)   scale_G = S   scale_B = S*(1−chroma*0.25)
```
```
<feDisplacementMap ... scale="{scale_R}" result="dispR"/>
<feColorMatrix in="dispR" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="onlyR"/>
   ...same for G (keep green) and B (keep blue)...
<feBlend in="onlyR" in2="onlyG" mode="screen" result="rg"/>
<feBlend in="rg"    in2="onlyB" mode="screen" result="rgb"/>
<feGaussianBlur in="rgb" stdDeviation="{blur}"/>
```
Keep `chroma` ≈ 0.3–0.6. The trailing `feGaussianBlur` both frosts the glass and
hides SVG displacement's lack of supersampling (slight pixelation at high scale).

## The material layers (CSS)

Displacement only handles the *refraction*. The rest of the look is CSS on the
element (see `liquid-glass.css`):
- **Body tint**: `background: rgb(var(--lg-tint) / var(--lg-tint-opacity))`.
- **Backdrop saturation**: `saturate(1.6)` for the light-bleed cue.
- **Lit rim**: a gradient painted into a 1px border via `mask-composite: exclude`.
- **Moving sheen**: a screen-blended gradient whose `--lg-angle` follows the pointer.
- **Elevation**: layered `box-shadow` (outer drop + inner rim light).

## Applying at runtime

`liquid-glass.js` does all of it: feature-detect → generate map → build filter →
set `backdrop-filter` → wire pointer sheen → rebuild on resize (ResizeObserver).
```js
import { LiquidGlass } from './liquid-glass.js';
new LiquidGlass(el, { radius: 28, scale: 70, chroma: 0.5, blur: 2 });
```

## Gotchas

- **Rebuild on resize.** The map is baked to a specific px size; regenerate when
  the element resizes or DPR changes, or the lensing won't line up with the edge.
- **`filterUnits="userSpaceOnUse"` + explicit `width/height`** so displacement
  units are real pixels, not fractions of the bounding box.
- **Cost.** Regenerating the map is the expensive part; animating only the
  `scale` attribute is cheap. Don't regenerate every frame.
- **Browser support is the big caveat** — see `references/browser-support.md`.
  Chromium renders it; Safari/Firefox need the CSS fallback (already built in).
