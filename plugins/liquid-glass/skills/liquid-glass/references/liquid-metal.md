# Liquid-metal variant (the "liquid logo" look)

A **different material** from the glass panel. Instead of refracting a backdrop
behind a UI element, this turns an image/logo into a **molten, animated
liquid-chrome surface**. Use it for hero logos, splash marks, and brand moments;
it is *not* a general UI material.

Asset: `assets/liquid-metal.frag.glsl` (fragment shader).

## When to use which

| Want…                                              | Use              |
| -------------------------------------------------- | ---------------- |
| A UI panel/button that refracts what's behind it   | Tier A / Tier B glass |
| A logo/shape that flows like liquid metal          | this variant     |

## How it works

The shape you want to liquify comes in as `u_image` (use a high-contrast or
alpha-masked logo). Then, per fragment:

1. **Animated flow field** — fractal gradient noise scrolling over time builds a
   height field `h`.
2. **Surface normal** from finite differences of `h`.
3. **Refract the source image** through that normal (`u_refraction`), sampling
   R/G/B at slightly offset UVs for **dispersion** (`u_dispersion`).
4. **Metallic shading** — a fresnel rim (bright chrome edge) plus a specular
   streak driven by the normal, colored by two tints (`u_tintA`/`u_tintB`).
5. **Composite** the metal onto the image's shape (alpha = mask).

## Uniforms

| uniform         | meaning                    | try            |
| --------------- | -------------------------- | -------------- |
| `u_image`       | source logo/shape texture  | alpha logo     |
| `u_time`        | seconds                    | live           |
| `u_flow`        | flow speed                 | 0.6            |
| `u_scale`       | pattern scale              | 3.0            |
| `u_refraction`  | image bend amount          | 0.08           |
| `u_dispersion`  | chromatic spread           | 0.5            |
| `u_tintA/B`     | metal colours (bright/dark)| `#FAFAFF` / `#1A1A1F` |

## Running it

It's a standard fullscreen fragment shader (GLSL ES 3.00) — reuse the host in
`assets/webgl-glass.js`: `createProgram(gl, source)` pairs it with the exported
fullscreen vertex shader (which provides `v_uv`). Then upload the logo to
`u_image`, set the uniforms, and animate `u_time` in a `requestAnimationFrame`
loop, drawing with `gl.drawArrays(gl.TRIANGLES, 0, 3)`.
