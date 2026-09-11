/**
 * displacement-map.js — Liquid Glass refraction map generator
 *
 * Generates the displacement map that drives the SVG <feDisplacementMap> lensing
 * effect. This is the single most important asset: it encodes, per pixel, how far
 * the backdrop should bend. The magic of "Apple-grade" glass (vs. flat blur) lives
 * here — displacement is strong at the beveled EDGE and zero in the flat CENTER,
 * exactly like light bending through the curved rim of a real lens.
 *
 * Channel encoding (SVG feDisplacementMap convention):
 *   R = horizontal (x) displacement, 128 = neutral (no shift)
 *   G = vertical   (y) displacement, 128 = neutral
 *   Everything OUTSIDE the shape stays neutral (128,128) so it is left untouched.
 *
 * The final pixel offset in CSS is  offset = filterScale * ((channel/255) - 0.5).
 * So this file only encodes DIRECTION and a normalized MAGNITUDE 0..1; the visible
 * strength is set by the `scale` attribute on <feDisplacementMap> at apply time.
 *
 * Browser-only (uses <canvas>). Zero dependencies. Usable as an ES module or via
 * a plain <script> tag (attaches `LiquidGlassMap` to window).
 */

// Signed distance to a rounded rectangle. p and halfSize are relative to center.
// Negative inside, 0 on the boundary, positive outside. Radius is clamped so it
// never exceeds the smaller half-dimension (which makes circles/pills fall out for free).
function sdRoundRect(px, py, halfW, halfH, radius) {
  const r = Math.min(radius, Math.min(halfW, halfH));
  const qx = Math.abs(px) - halfW + r;
  const qy = Math.abs(py) - halfH + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

/**
 * Build a displacement map for a rounded-rectangle (or circle/pill) glass shape.
 *
 * @param {object} o
 * @param {number} o.width         Shape width in px.
 * @param {number} o.height        Shape height in px.
 * @param {number} [o.radius]      Corner radius in px. Use min(w,h)/2 for pill/circle.
 * @param {number} [o.bezel]       Width of the curved "lens rim" in px, measured
 *                                 inward from the edge. Larger = wider, gentler bend.
 * @param {number} [o.curvature]   Falloff shape of the bezel (1 = linear, 2–4 =
 *                                 concentrated at the very edge, glassier).
 * @param {number} [o.dpr]         Device pixel ratio to render at (sharper map).
 * @returns {string} A PNG data URL suitable for <feImage href>.
 */
export function generateDisplacementMap(o) {
  const width = Math.max(1, Math.round(o.width));
  const height = Math.max(1, Math.round(o.height));
  const radius = o.radius ?? Math.min(width, height) * 0.25;
  const bezel = Math.max(1, o.bezel ?? Math.min(width, height) * 0.18);
  const curvature = o.curvature ?? 2;
  const dpr = o.dpr ?? 1;

  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const halfW = w / 2;
  const halfH = h / 2;
  const R = radius * dpr;
  const B = bezel * dpr;

  // Finite-difference step for the surface normal (gradient of the SDF).
  const eps = 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px = x - halfW + 0.5;
      const py = y - halfH + 0.5;

      // Inward distance from the edge: 0 at the boundary, grows toward the center.
      const d = -sdRoundRect(px, py, halfW, halfH, R);

      if (d <= 0) {
        // Outside the shape — leave the backdrop untouched.
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 255;
        continue;
      }

      // t: 0 at outer edge → 1 at the inner flat region.
      const t = Math.min(d / B, 1);
      // Magnitude: strongest at the edge, zero once we reach the flat center.
      const mag = Math.pow(1 - t, curvature);

      // 2D surface normal = normalized gradient of the SDF (points outward).
      const gx =
        sdRoundRect(px + eps, py, halfW, halfH, R) -
        sdRoundRect(px - eps, py, halfW, halfH, R);
      const gy =
        sdRoundRect(px, py + eps, halfW, halfH, R) -
        sdRoundRect(px, py - eps, halfW, halfH, R);
      const glen = Math.hypot(gx, gy) || 1;

      const dispX = (gx / glen) * mag;
      const dispY = (gy / glen) * mag;

      data[i] = clamp255(128 + dispX * 127);
      data[i + 1] = clamp255(128 + dispY * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  if (canvas.convertToBlob) {
    // OffscreenCanvas path — synchronous data URL is not available, so callers on
    // this path should prefer generateDisplacementMapAsync. Fall through to the
    // element canvas for a sync result.
  }
  if (canvas.toDataURL) return canvas.toDataURL('image/png');

  // OffscreenCanvas fallback: copy into a real canvas for a sync data URL.
  const real = Object.assign(document.createElement('canvas'), { width: w, height: h });
  real.getContext('2d').drawImage(canvas, 0, 0);
  return real.toDataURL('image/png');
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

// Attach to window for plain <script> usage.
if (typeof window !== 'undefined') {
  window.LiquidGlassMap = { generateDisplacementMap };
}
