# Liquid Glass — design principles

What makes Apple's Liquid Glass read as a real optical material instead of the
usual `backdrop-filter: blur()` "glassmorphism." Get these five behaviors right
and it looks Apple-grade; miss them and it looks like every other frosted card.

## Material before optics

The signatures below are perceptual. But there's a build order: **construct a
physical frosted pane first, then add the optics.** The most common failure is a
see-through *tint* (a filter) instead of a diffused *material*. Four fixes turn a
filter into a material — these are rules 1–4 in `SKILL.md`:

- **Diffuse, don't tint** — blur heavily (≥ 20px) so the backdrop is obliterated
  into a smooth wash, not visible-and-tinted.
- **Tame the backdrop** — `saturate()` + `brightness()` + a strong body wash so
  bright colors behind the glass can't turn it muddy and content stays readable.
- **Cut a physical edge** — a crisp inner light-catch defines where glass stops.
- **Float it** — a large soft shadow lifts the pane off the wallpaper.

Only once that pane is right does the lensing/specular finish (signature #1–#2
below) read as premium rather than as lipstick on a flat sticker.

## The five signatures (in priority order)

1. **Lensing (edge-weighted refraction) — the #1 tell.**
   Background content *bends* as it passes through the material, and the bending
   is **concentrated at the beveled edge/rim** while the **center stays clear** —
   exactly like looking through the curved edge of a real lens or a water droplet.
   Uniform blur across the whole panel is the classic mistake. The displacement
   must fall off from the edge to zero in the middle.
   - Implemented by the displacement map: strong R/G deviation at the rim, neutral
     (128,128) in the center. See `references/svg-displacement.md`.

2. **Specular highlights that respond to motion.**
   A thin, bright rim of light runs along the bevel and *moves* — with device tilt
   on iOS, or with the pointer on the web. This is the "wet/liquid" cue. Without a
   moving highlight the glass looks dead and flat.
   - Implemented as a masked gradient border (`::before`) + a screen-blended sheen
     (`::after`) whose angle is driven by pointer/`deviceorientation`.

3. **Chromatic aberration (dispersion).**
   Subtle rainbow fringing at the edges, because real glass refracts red, green,
   and blue by slightly different amounts. Keep it *subtle* — it should be felt at
   the rim, not seen as a rainbow.
   - Implemented by displacing R/G/B channels at slightly different `scale` values
     and recombining with `feBlend mode="screen"`.

4. **Adaptive tint + light bleed + legibility.**
   The material carries a faint body tint, boosts backdrop saturation ("light
   bleeds" from colorful content nearby onto the surface), and **adapts** to keep
   overlaid content legible: over busy/low-contrast backdrops, raise tint opacity
   and/or add a scrim so text never fails contrast. Apple dynamically shifts the
   material lighter/darker based on what's behind it.
   - Practical rule: if content sits on glass, guarantee ≥ 4.5:1 contrast. When the
     backdrop is unknown/busy, bump `--lg-tint-opacity` to ~0.2–0.3 or add a scrim.

5. **Elevation + liquid motion.**
   The material floats above content: a soft drop shadow (which itself catches a
   little light bleed), and on interaction it deforms fluidly — a gel-like squish
   on press, a spring on release, and morphing between shapes rather than hard
   snapping. Motion is springy, not linear.
   - Implemented with `transform: scale()` + spring easing; honor
     `prefers-reduced-motion`.

## Hierarchy & restraint (Apple's own guidance)

- **Glass is a layer, not the content.** Use it for the navigation/control layer
  that floats *over* content (tab bars, toolbars, sheets, sidebars, buttons) — not
  for large content areas or full backgrounds. Overusing it destroys the sense of
  depth and hurts legibility.
- **One glass level at a time.** Avoid stacking glass on glass on glass; nested
  translucency muddies everything. Apple limits concurrent glass.
- **Let content show through, but keep focus on content.** The material should
  recede and defer to what the user is actually doing.
- **Respect the platform.** Rounded, continuous-corner (squircle) shapes; generous
  radii; concentric radii for nested elements.

## Light vs. dark

The material is not a fixed color — it's a lens. In light mode it reads bright and
airy; in dark mode it reads as smoked/tinted glass. Drive the tint and highlight
from theme variables (`--lg-tint`, `--lg-highlight`) rather than hardcoding white.

## Anti-patterns checklist (what "cheap glass" looks like)

- [ ] Uniform blur, no edge lensing → looks like frosted plastic.
- [ ] Static highlight (or none) → looks dead.
- [ ] Heavy rainbow aberration → looks like a bug, not glass.
- [ ] Glass over glass over glass → muddy, no depth.
- [ ] Text directly on a busy backdrop with no scrim → illegible.
- [ ] Hard/linear interaction transitions → not "liquid."
- [ ] Glass used as a page background → defeats the whole metaphor.
```
