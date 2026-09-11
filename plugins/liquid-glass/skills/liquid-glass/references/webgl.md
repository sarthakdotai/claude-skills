# Tier B — WebGL glass

Use this when Tier A (SVG + `backdrop-filter`) can't apply:

- The content behind the glass is a `<canvas>`, `<video>`, WebGL/Three.js scene,
  or map — `backdrop-filter` over those is unreliable and can't be displaced.
- You need refraction in **Safari/Firefox** (Tier A's refraction is Chromium-only;
  this shader path works cross-browser because it doesn't use `backdrop-filter`).

Asset: `assets/webgl-glass.js` (self-contained, zero deps, WebGL2).
Demo: `assets/demo-webgl.html`.

## The trade-off

Tier A reads the *live DOM backdrop* for free. Tier B does **not** — you must hand
it the background as a **texture** (an `Image`, `<video>`, `<canvas>` or
`ImageBitmap` that covers the same box as the glass). That's natural for "glass
over a photo/video/scene." For a full-page backdrop you would have to snapshot the
page into a canvas and re-snapshot on scroll/resize — heavy and fragile, so prefer
Tier A for DOM UIs.

## Usage

```js
import { WebGLGlass } from './webgl-glass.js';

const glass = new WebGLGlass(canvasEl, {
  background: videoEl, // Image | Video | Canvas | ImageBitmap covering the glass box
  radius: 28,          // corner radius, px
  scale: 70,           // peak edge refraction, px
  chroma: 0.5,         // dispersion, 0–1
  frost: 24,           // diffusion radius, px (rule 1)
  // also: bezel, curvature, saturate, brightness, tint, tintOpacity, dark, light, sheen
});

glass.render();                                                   // still background: once
function loop() { glass.render(); requestAnimationFrame(loop); }  // video: every frame
loop();
```

Options use the same names and defaults as Tier A's `LiquidGlass`, so a pane looks
the same on either path. `dark: true` switches to the dark preset (brightness 0.82,
near-black wash at 0.5). Change `glass.options.*` and call `render()` again to
retune; set `light` to the pointer's offset from the pane's centre to move the
specular.

Size the canvas to the glass box: `canvas.width/height` in device px, CSS size in
CSS px (px options are scaled by the ratio). Position it over the content it
refracts and give it the float shadow from the CSS recipe (rule 4).

## How the shader works

Same optics as Tier A, done per fragment (see `GLASS_FRAGMENT` in the asset):

1. **Rounded-box distance** gives the inward distance `d` from the edge and the
   exact outward **normal** `n`.
2. **Bevel**: `bend = (1 − clamp(d / bezel, 0, 1))^curvature` — 1 at the edge, 0
   past the rim. The sample shifts outward by `n · bend · scale / 2`, the same
   field Tier A bakes into its displacement map. Samples that land past the
   texture's edge mirror back inside (`MIRRORED_REPEAT`), so the rim reads as a
   bevel even though the background stops at the glass edge.
3. **Dispersion + frost**: R, G and B are sampled at slightly different shifts
   (`1 ± chroma·0.25`), each over 12 golden-angle taps that read a pre-blurred mip
   level, so a small tap count still gives a wide, smooth frost.
4. **Tone** in CSS order: `saturate`, `brightness`, then the body **wash**.
5. **Rim light** (1px, brightest along the top), a **specular** on the bevel facing
   `light`, and a 1px **antialiased** shape mask.

`createProgram(gl, fragmentSource)` and `FULLSCREEN_VERTEX` are exported, so other
fullscreen effects (like `liquid-metal.frag.glsl`) can reuse the same host.

## When NOT to use Tier B

- Plain DOM UI on a normal page → Tier A is lighter, sharper, and reads the live
  backdrop automatically.
- You only need it to *look* like glass on unsupported browsers → the CSS frosted
  fallback (Tier C, built into `liquid-glass.css`) is far cheaper than standing up
  WebGL.
