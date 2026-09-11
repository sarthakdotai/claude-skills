/**
 * LiquidGlass.tsx — self-contained React drop-in for the Liquid Glass material.
 *
 * Copy this ONE file into your project. No external CSS or deps required; it
 * injects its own styles and generates the SVG displacement filter at runtime.
 *
 *   <LiquidGlass radius={28} scale={70} chroma={0.5} className="p-6 w-80">
 *     <h2>Refraction, not blur</h2>
 *   </LiquidGlass>
 *
 * On Chromium it renders true edge-lensing refraction + chromatic aberration.
 * Everywhere else it degrades to a frosted-glass fallback (never looks broken).
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Displacement-map generation (see displacement-map.js for the annotated version)
// ---------------------------------------------------------------------------
function sdRoundRect(px: number, py: number, hw: number, hh: number, radius: number) {
  const r = Math.min(radius, Math.min(hw, hh));
  const qx = Math.abs(px) - hw + r;
  const qy = Math.abs(py) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function makeMap(width: number, height: number, radius: number, bezel: number, curvature: number, dpr: number) {
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const hw = w / 2;
  const hh = h / 2;
  const R = radius * dpr;
  const B = Math.max(1, bezel * dpr);
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px = x - hw + 0.5;
      const py = y - hh + 0.5;
      const dist = -sdRoundRect(px, py, hw, hh, R);
      if (dist <= 0) {
        d[i] = d[i + 1] = d[i + 2] = 128;
        d[i + 3] = 255;
        continue;
      }
      const t = Math.min(dist / B, 1);
      const mag = Math.pow(1 - t, curvature);
      const gx = sdRoundRect(px + 1, py, hw, hh, R) - sdRoundRect(px - 1, py, hw, hh, R);
      const gy = sdRoundRect(px, py + 1, hw, hh, R) - sdRoundRect(px, py - 1, hw, hh, R);
      const gl = Math.hypot(gx, gy) || 1;
      d[i] = clamp(128 + (gx / gl) * mag * 127);
      d[i + 1] = clamp(128 + (gy / gl) * mag * 127);
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

// One-time feature detection + style injection ------------------------------
function detectRefraction() {
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') return false;
  const ok = CSS.supports('backdrop-filter', 'url(#x)') || CSS.supports('-webkit-backdrop-filter', 'url(#x)');
  const ua = navigator.userAgent;
  return ok && /Chrome|Chromium|CriOS|Edg|OPR/.test(ua) && !/Edge\//.test(ua);
}

const STYLE_ID = 'liquid-glass-styles';
function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
.lg-root{position:relative;isolation:isolate;border-radius:var(--lg-radius,24px);
  background:rgb(var(--lg-tint,255 255 255)/var(--lg-tint-opacity,.28));
  -webkit-backdrop-filter:blur(var(--lg-blur,24px)) saturate(var(--lg-sat,1.9)) brightness(var(--lg-br,1.08));
  backdrop-filter:blur(var(--lg-blur,24px)) saturate(var(--lg-sat,1.9)) brightness(var(--lg-br,1.08));
  box-shadow:0 12px 32px rgba(0,0,0,.22),0 2px 6px rgba(0,0,0,.12),
    inset 0 1px 1px rgb(var(--lg-hl,255 255 255)/var(--lg-edge,.75)),
    inset 0 0 0 1px rgb(var(--lg-hl,255 255 255)/var(--lg-hair,.16)),
    inset 0 -1px 1px rgb(0 0 0/.06);}
.lg-root::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;
  background:linear-gradient(var(--lg-angle,135deg),rgb(var(--lg-hl,255 255 255)/.9),
    rgb(var(--lg-hl,255 255 255)/.3) 35%,rgb(var(--lg-hl,255 255 255)/.25) 65%,rgb(var(--lg-hl,255 255 255)/.63));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;
  pointer-events:none;z-index:1;}
.lg-root::after{content:'';position:absolute;inset:0;border-radius:inherit;
  background:linear-gradient(var(--lg-angle,135deg),rgb(var(--lg-hl,255 255 255)/.18),rgb(var(--lg-hl,255 255 255)/0) 45%);
  mix-blend-mode:screen;pointer-events:none;z-index:1;transition:background 120ms linear;}
.lg-root>*{position:relative;z-index:2;}
@media (prefers-reduced-transparency:reduce){.lg-root{background:rgb(var(--lg-tint,255 255 255)/.92);backdrop-filter:none;-webkit-backdrop-filter:none}}
@media (prefers-reduced-motion:reduce){.lg-root::after{transition:none}}`;
  document.head.appendChild(el);
}

const KEEP = {
  R: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  G: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  B: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
} as const;

export interface LiquidGlassProps {
  as?: ElementType;
  radius?: number;
  bezel?: number;
  curvature?: number;
  scale?: number;
  chroma?: number;
  edgeBlur?: number;      // tiny in-filter blur (pixelation cleanup), NOT the frost
  frost?: number;         // heavy diffusion blur px (the "material" look)
  tint?: string;          // "255 255 255"
  tintOpacity?: number;
  saturate?: number;
  brightness?: number;
  dark?: boolean;         // smoked-glass preset (dark backdrops)
  sheen?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function LiquidGlass({
  as: Tag = 'div',
  radius = 24,
  bezel,
  curvature = 2,
  scale = 60,
  chroma = 0.4,
  edgeBlur = 1,
  frost = 24,
  tint,
  tintOpacity,
  saturate = 1.9,
  brightness,
  dark = false,
  sheen = true,
  className = '',
  style,
  children,
}: LiquidGlassProps) {
  const ref = useRef<HTMLElement>(null);
  const rawId = useId().replace(/[:]/g, '');
  const filterId = `lg-${rawId}`;
  const [enabled] = useState(detectRefraction);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => injectStyles(), []);

  // Track size for map regeneration.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const ro = new ResizeObserver(() => {
      const r = node.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [enabled]);

  const map = useMemo(
    () =>
      enabled && size.w > 0
        ? makeMap(
            size.w,
            size.h,
            radius,
            bezel ?? Math.min(size.w, size.h) * 0.18,
            curvature,
            Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
          )
        : null,
    [enabled, size.w, size.h, radius, bezel, curvature],
  );

  const scales = { R: scale * (1 + chroma * 0.25), G: scale, B: scale * (1 - chroma * 0.25) };

  // Pointer sheen.
  useEffect(() => {
    if (!sheen) return;
    const node = ref.current;
    if (!node) return;
    const onMove = (e: PointerEvent) => {
      const r = node.getBoundingClientRect();
      const a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
      node.style.setProperty('--lg-angle', `${a.toFixed(1)}deg`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [sheen]);

  // Light vs. smoked-glass presets; explicit props override.
  const preset = dark
    ? { tint: '22 22 26', tintOpacity: 0.5, brightness: 0.82, hl: '255 255 255', edge: 0.4, hair: 0.1 }
    : { tint: '255 255 255', tintOpacity: 0.28, brightness: 1.08, hl: '255 255 255', edge: 0.75, hair: 0.16 };

  const cssVars = {
    '--lg-radius': `${radius}px`,
    '--lg-tint': tint ?? preset.tint,
    '--lg-tint-opacity': tintOpacity ?? preset.tintOpacity,
    '--lg-blur': `${frost}px`,
    '--lg-sat': saturate,
    '--lg-br': brightness ?? preset.brightness,
    '--lg-hl': preset.hl,
    '--lg-edge': preset.edge,
    '--lg-hair': preset.hair,
  } as CSSProperties;

  // Refraction FIRST, then the SAME heavy frost + tone chain as the fallback,
  // so the premium path diffuses just as hard (not a weak filter).
  const backdrop = map
    ? `url(#${filterId}) blur(${frost}px) saturate(${saturate}) brightness(${brightness ?? preset.brightness})`
    : undefined;

  return (
    <Tag
      ref={ref as any}
      className={`lg-root ${className}`}
      style={{
        ...cssVars,
        ...(backdrop ? ({ backdropFilter: backdrop, WebkitBackdropFilter: backdrop } as CSSProperties) : null),
        ...style,
      }}
    >
      {map && (
        <svg width={0} height={0} aria-hidden style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id={filterId} colorInterpolationFilters="sRGB" x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse">
            <feImage href={map} x="0" y="0" width={size.w} height={size.h} result="map" />
            {(['R', 'G', 'B'] as const).map((ch) => (
              <feDisplacementMap key={`d${ch}`} in="SourceGraphic" in2="map" scale={scales[ch]} xChannelSelector="R" yChannelSelector="G" result={`disp${ch}`} />
            ))}
            <feColorMatrix in="dispR" type="matrix" values={KEEP.R} result="onlyR" />
            <feColorMatrix in="dispG" type="matrix" values={KEEP.G} result="onlyG" />
            <feColorMatrix in="dispB" type="matrix" values={KEEP.B} result="onlyB" />
            <feBlend in="onlyR" in2="onlyG" mode="screen" result="rg" />
            <feBlend in="rg" in2="onlyB" mode="screen" result="rgb" />
            {edgeBlur > 0 && <feGaussianBlur in="rgb" stdDeviation={edgeBlur} />}
          </filter>
        </svg>
      )}
      {children}
    </Tag>
  );
}

export default LiquidGlass;
