/**
 * liquid-glass.js — vanilla runtime that turns an element into Liquid Glass.
 *
 *   import { LiquidGlass } from './liquid-glass.js';
 *   new LiquidGlass(document.querySelector('.card'), { radius: 28, scale: 60, chroma: 0.4 });
 *
 * What it does:
 *   1. Detects whether the browser renders SVG filters inside backdrop-filter
 *      (Chromium only today). If not, it leaves the CSS frosted fallback in place.
 *   2. On supported browsers, generates a displacement map and an SVG filter with
 *      three-pass chromatic aberration, then points backdrop-filter at it.
 *   3. Tracks the pointer to move the specular sheen (the "reacts to motion" cue).
 *   4. Rebuilds the map on resize so the lensing always matches the real geometry.
 *
 * Requires liquid-glass.css on the element (class `liquid-glass`) and the
 * displacement-map.js module alongside this file.
 */

import { generateDisplacementMap } from './displacement-map.js';

// --- Feature detection ---------------------------------------------------------
// There is no clean @supports test for "SVG filter INSIDE backdrop-filter": the
// url() syntax parses everywhere but only Chromium actually composites it. We use
// the standard engine heuristic; callers can force it with { forceRefraction }.
function detectRefractionSupport() {
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') return false;
  const syntaxOk =
    CSS.supports('backdrop-filter', 'url(#x)') ||
    CSS.supports('-webkit-backdrop-filter', 'url(#x)');
  const ua = navigator.userAgent;
  const isChromium = /Chrome|Chromium|CriOS|Edg|OPR/.test(ua) && !/Edge\//.test(ua);
  return syntaxOk && isChromium;
}

export const supportsRefraction = detectRefractionSupport();

// --- SVG namespace host --------------------------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg';
let filterHost = null;
let uid = 0;

function ensureHost() {
  if (filterHost) return filterHost;
  filterHost = document.createElementNS(SVG_NS, 'svg');
  filterHost.setAttribute('width', '0');
  filterHost.setAttribute('height', '0');
  filterHost.setAttribute('aria-hidden', 'true');
  Object.assign(filterHost.style, {
    position: 'absolute',
    width: '0',
    height: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
  });
  document.body.appendChild(filterHost);
  return filterHost;
}

// feColorMatrix presets that keep a single channel (plus alpha).
const KEEP = {
  R: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  G: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  B: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
};

/**
 * Build (or rebuild) an SVG <filter> that displaces the backdrop by `map`, with
 * chromatic aberration (R/G/B displaced by slightly different scales) and a final
 * softening blur. Returns the filter id.
 */
function buildFilter(id, { width, height, map, scale, chroma, blur }) {
  const host = ensureHost();
  host.querySelector(`#${id}`)?.remove();

  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  // Userspace region matched to the element so displacement units are pixels.
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', String(width));
  filter.setAttribute('height', String(height));
  filter.setAttribute('filterUnits', 'userSpaceOnUse');

  const feImage = document.createElementNS(SVG_NS, 'feImage');
  feImage.setAttribute('href', map);
  feImage.setAttribute('x', '0');
  feImage.setAttribute('y', '0');
  feImage.setAttribute('width', String(width));
  feImage.setAttribute('height', String(height));
  feImage.setAttribute('result', 'map');
  filter.appendChild(feImage);

  // Per-channel displacement scales — the spread is the aberration amount.
  const scales = {
    R: scale * (1 + chroma * 0.25),
    G: scale,
    B: scale * (1 - chroma * 0.25),
  };

  let prev = null;
  for (const ch of ['R', 'G', 'B']) {
    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', String(scales[ch]));
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    disp.setAttribute('result', `disp${ch}`);
    filter.appendChild(disp);

    const mat = document.createElementNS(SVG_NS, 'feColorMatrix');
    mat.setAttribute('in', `disp${ch}`);
    mat.setAttribute('type', 'matrix');
    mat.setAttribute('values', KEEP[ch]);
    mat.setAttribute('result', `only${ch}`);
    filter.appendChild(mat);

    if (prev) {
      const blend = document.createElementNS(SVG_NS, 'feBlend');
      blend.setAttribute('in', prev);
      blend.setAttribute('in2', `only${ch}`);
      blend.setAttribute('mode', 'screen');
      blend.setAttribute('result', `blend${ch}`);
      filter.appendChild(blend);
      prev = `blend${ch}`;
    } else {
      prev = `only${ch}`;
    }
  }

  if (blur > 0) {
    const gb = document.createElementNS(SVG_NS, 'feGaussianBlur');
    gb.setAttribute('in', prev);
    gb.setAttribute('stdDeviation', String(blur));
    filter.appendChild(gb);
  }

  host.appendChild(filter);
  return id;
}

export class LiquidGlass {
  /**
   * @param {HTMLElement} element  Element carrying the `liquid-glass` class.
   * @param {object} [opts]
   * @param {number} [opts.radius=28]   Corner radius (px). Also sets --lg-radius.
   * @param {number} [opts.bezel]       Lens rim width (px). Default ~18% of min side.
   * @param {number} [opts.curvature=2] Edge falloff shape (2–4 = glassier).
   * @param {number} [opts.scale=60]    Refraction strength in px (feDisplacementMap scale).
   * @param {number} [opts.chroma=0.4]  Chromatic aberration amount (0–1).
   * @param {number} [opts.edgeBlur=1]  Tiny blur inside the filter to clean
   *                                    displacement pixelation. NOT the frost.
   * --- material (rules 1–4; override the CSS defaults when passed) ---
   * @param {number} [opts.frost]       Heavy diffusion blur px → --lg-blur (~24).
   * @param {number} [opts.saturate]    Backdrop saturation → --lg-saturate (~1.9).
   * @param {number} [opts.brightness]  Backdrop brightness → --lg-brightness (~1.08).
   * @param {string} [opts.tint]        Body colour "R G B" → --lg-tint.
   * @param {number} [opts.tintOpacity] Wash strength 0–1 → --lg-tint-opacity.
   * @param {boolean}[opts.sheen=true]  Track pointer to move the specular highlight.
   * @param {boolean}[opts.forceRefraction] Override feature detection.
   */
  constructor(element, opts = {}) {
    this.el = element;
    this.opts = {
      radius: 24,
      curvature: 2,
      scale: 60,
      chroma: 0.4,
      edgeBlur: 1,
      sheen: true,
      ...opts,
    };
    this.id = `lg-filter-${uid++}`;
    this.enabled =
      this.opts.forceRefraction ?? supportsRefraction;

    this.el.classList.add('liquid-glass');
    this.el.style.setProperty('--lg-radius', `${this.opts.radius}px`);
    // Only override the CSS material defaults when explicitly asked.
    if ('frost' in opts) this.el.style.setProperty('--lg-blur', `${opts.frost}px`);
    if ('saturate' in opts) this.el.style.setProperty('--lg-saturate', String(opts.saturate));
    if ('brightness' in opts) this.el.style.setProperty('--lg-brightness', String(opts.brightness));
    if ('tint' in opts) this.el.style.setProperty('--lg-tint', opts.tint);
    if ('tintOpacity' in opts) this.el.style.setProperty('--lg-tint-opacity', String(opts.tintOpacity));

    if (this.enabled) {
      this._ro = new ResizeObserver(() => this.update());
      this._ro.observe(this.el);
      this.update();
    }
    if (this.opts.sheen) this._wireSheen();
  }

  update() {
    if (!this.enabled) return;
    const rect = this.el.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === this._w && height === this._h) return;
    this._w = width;
    this._h = height;

    const map = generateDisplacementMap({
      width,
      height,
      radius: this.opts.radius,
      bezel: this.opts.bezel,
      curvature: this.opts.curvature,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    buildFilter(this.id, {
      width,
      height,
      map,
      scale: this.opts.scale,
      chroma: this.opts.chroma,
      blur: this.opts.edgeBlur,
    });

    // Refraction FIRST, then the SAME heavy frost + tone chain as the CSS
    // fallback (via var refs) — so the premium path diffuses just as hard.
    // Order matters: url() bends the backdrop, then blur() diffuses it.
    const filter =
      `url(#${this.id}) blur(var(--lg-blur)) saturate(var(--lg-saturate)) brightness(var(--lg-brightness))`;
    this.el.style.backdropFilter = filter;
    this.el.style.webkitBackdropFilter = filter;
  }

  _wireSheen() {
    const onMove = (e) => {
      const rect = this.el.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      // Angle from element centre → light comes from the opposite side.
      const angle = (Math.atan2(cy, cx) * 180) / Math.PI + 90;
      this.el.style.setProperty('--lg-angle', `${angle.toFixed(1)}deg`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    this._teardownSheen = () => window.removeEventListener('pointermove', onMove);
  }

  destroy() {
    this._ro?.disconnect();
    this._teardownSheen?.();
    ensureHost().querySelector(`#${this.id}`)?.remove();
    this.el.style.backdropFilter = '';
    this.el.style.webkitBackdropFilter = '';
  }
}

/** Upgrade every element matching `selector` in one call. */
export function applyLiquidGlass(selector, opts) {
  return [...document.querySelectorAll(selector)].map((el) => new LiquidGlass(el, opts));
}
