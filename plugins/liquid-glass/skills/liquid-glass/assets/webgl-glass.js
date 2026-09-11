/**
 * webgl-glass.js — Tier B: Liquid Glass drawn by a WebGL2 shader over a background texture.
 *
 * Use it when Tier A (SVG displacement inside backdrop-filter) can't apply: the
 * content behind the glass is a <canvas>, <video> or WebGL scene, or you need
 * refraction in Safari/Firefox. The trade-off: you hand it the background as an
 * image source covering the same box as the glass; it cannot read the live DOM.
 *
 *   import { WebGLGlass } from './webgl-glass.js';
 *   const glass = new WebGLGlass(canvasEl, { background: videoEl, radius: 28, scale: 70 });
 *   glass.render();   // once for a still background, every frame for video
 *
 * It paints the same material as Tier A and the CSS recipe: bevel refraction with
 * chromatic dispersion (rule 5), heavy frost (rule 1), saturate + brighten + a
 * white wash (rule 2) and a lit 1px rim, brightest at the top (rule 3). Give the
 * canvas the CSS float shadow yourself (rule 4). Zero dependencies. Throws when
 * WebGL2 is unavailable, so callers can fall back to the CSS frost (Tier C).
 */

// One oversized triangle covers the viewport, so no vertex buffer is needed.
// Exported so other fullscreen shaders (liquid-metal.frag.glsl) can reuse it.
export const FULLSCREEN_VERTEX = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const GLASS_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_backdrop;
uniform vec2  u_size;        // canvas size, device px
uniform float u_radius;      // corner radius, device px
uniform float u_bezel;       // width of the curved rim, device px
uniform float u_curvature;   // how tightly the bend hugs the edge (2-4 = glassier)
uniform float u_scale;       // peak refraction, device px
uniform float u_chroma;      // dispersion, 0-1
uniform float u_frost;       // diffusion radius, device px
uniform float u_saturate;
uniform float u_brightness;
uniform vec4  u_wash;        // body colour (rgb 0-1) and its opacity
uniform vec2  u_light;       // unit vector toward the light, y up
uniform float u_sheen;       // specular strength on the bevel
uniform float u_px;          // device px per CSS px

out vec4 outColor;

const int TAPS = 12;
const float GOLDEN_ANGLE = 2.39996323;

// Distance to the rounded box (negative inside) plus its outward normal, both exact.
float roundedBox(vec2 p, vec2 halfSize, float r, out vec2 normal) {
  vec2 side = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  vec2 q = abs(p) - (halfSize - r);
  if (q.x > 0.0 && q.y > 0.0) {
    normal = side * normalize(q);
    return length(q) - r;
  }
  normal = q.x > q.y ? vec2(side.x, 0.0) : vec2(0.0, side.y);
  return max(q.x, q.y) - r;
}

// Frosted, refracted backdrop. Each tap reads a pre-blurred mip level, so a
// dozen taps spread over the frost radius give a smooth, wide diffusion.
// Red bends a little more than green and blue a little less: dispersion.
vec3 backdrop(vec2 at, vec2 shift) {
  vec2 shiftR = shift * (1.0 + u_chroma * 0.25);
  vec2 shiftB = shift * (1.0 - u_chroma * 0.25);
  float lod = log2(max(u_frost * 0.5, 1.0));
  vec3 sum = vec3(0.0);
  for (int i = 0; i < TAPS; i++) {
    float f = (float(i) + 0.5) / float(TAPS);
    float a = float(i) * GOLDEN_ANGLE;
    vec2 o = vec2(cos(a), sin(a)) * sqrt(f) * u_frost;
    sum.r += textureLod(u_backdrop, (at + shiftR + o) / u_size, lod).r;
    sum.g += textureLod(u_backdrop, (at + shift + o) / u_size, lod).g;
    sum.b += textureLod(u_backdrop, (at + shiftB + o) / u_size, lod).b;
  }
  return sum / float(TAPS);
}

void main() {
  vec2 at = gl_FragCoord.xy;               // device px, origin bottom-left
  vec2 halfSize = u_size * 0.5;
  float r = min(u_radius, min(halfSize.x, halfSize.y));
  vec2 n;
  float dist = roundedBox(at - halfSize, halfSize, r, n);
  float inward = max(-dist, 0.0);

  // Bevel: the bend is strongest at the edge and gone once past the rim,
  // pointing outward like Tier A's displacement map.
  float t = clamp(inward / max(u_bezel, 1.0), 0.0, 1.0);
  float bend = pow(1.0 - t, u_curvature);
  vec3 color = backdrop(at, n * bend * u_scale * 0.5);

  // Tone, in the same order as the CSS: saturate, brighten, then the wash.
  float luma = dot(color, vec3(0.213, 0.715, 0.072));
  color = clamp(mix(vec3(luma), color, u_saturate), 0.0, 1.0);
  color = clamp(color * u_brightness, 0.0, 1.0);
  color = mix(color, u_wash.rgb, u_wash.a);

  // Lit rim: a 1px light-catch all round, brightest along the top edge.
  float rim = 1.0 - smoothstep(0.0, 1.5 * u_px, inward);
  color += rim * (0.16 + 0.6 * max(n.y, 0.0));

  // Specular: the part of the bevel that faces the light.
  color += u_sheen * pow(max(dot(n, u_light), 0.0), 4.0) * bend;

  float alpha = clamp(0.5 - dist, 0.0, 1.0); // 1px antialiased edge
  outColor = vec4(min(color, 1.0) * alpha, alpha);
}`;

const UNIFORMS = [
  'u_backdrop', 'u_size', 'u_radius', 'u_bezel', 'u_curvature', 'u_scale', 'u_chroma',
  'u_frost', 'u_saturate', 'u_brightness', 'u_wash', 'u_light', 'u_sheen', 'u_px',
];

const DEFAULTS = {
  radius: 24,          // corner radius, CSS px
  bezel: null,         // rim width, CSS px; null = 18% of the shorter side
  curvature: 2,
  scale: 60,           // peak refraction, CSS px
  chroma: 0.4,
  frost: 24,           // diffusion radius, CSS px
  saturate: 1.9,
  brightness: null,    // null = 1.08 light, 0.82 dark
  tint: null,          // [r, g, b] 0-255; null = white light, near-black dark
  tintOpacity: null,   // null = 0.28 light, 0.5 dark
  dark: false,
  light: [-0.5, -0.87], // direction to the light in screen space (x right, y down)
  sheen: 0.25,
};

/** Compile a fullscreen program from FULLSCREEN_VERTEX and a fragment shader. */
export function createProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, FULLSCREEN_VERTEX], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`WebGLGlass shader: ${gl.getShaderInfoLog(shader)}`);
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`WebGLGlass program: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

export class WebGLGlass {
  /**
   * @param {HTMLCanvasElement} canvas  Sized to the glass box (width/height in device px).
   * @param {object} [options]          See DEFAULTS; `background` is the image source to refract.
   *                                    Change `glass.options` later and call render() again.
   */
  constructor(canvas, options = {}) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGLGlass needs WebGL2; fall back to the CSS frost.');
    this.canvas = canvas;
    this.gl = gl;
    this.options = { ...DEFAULTS, ...options };
    this.program = createProgram(gl, GLASS_FRAGMENT);
    this.uniforms = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(this.program, name)]));

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    // The rim bends samples outward past the texture's edge; mirroring folds them
    // back inside, so the bevel reads as glass instead of smeared border pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    if (options.background) this.setBackground(options.background);
  }

  /** Image | HTMLVideoElement | HTMLCanvasElement | ImageBitmap covering the glass box. */
  setBackground(source) {
    this.background = source;
    return this;
  }

  render() {
    const { gl, canvas, options: o } = this;
    if (!this.background) return this;
    const w = canvas.width;
    const h = canvas.height;
    const px = w / (canvas.clientWidth || w); // device px per CSS px

    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // texture rows bottom-up, like gl_FragCoord
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.background);
    gl.generateMipmap(gl.TEXTURE_2D);

    const tint = o.tint ?? (o.dark ? [22, 22, 26] : [255, 255, 255]);
    const lightLength = Math.hypot(o.light[0], o.light[1]) || 1;
    const u = this.uniforms;
    gl.uniform1i(u.u_backdrop, 0);
    gl.uniform2f(u.u_size, w, h);
    gl.uniform1f(u.u_radius, o.radius * px);
    gl.uniform1f(u.u_bezel, o.bezel == null ? Math.min(w, h) * 0.18 : o.bezel * px);
    gl.uniform1f(u.u_curvature, o.curvature);
    gl.uniform1f(u.u_scale, o.scale * px);
    gl.uniform1f(u.u_chroma, o.chroma);
    gl.uniform1f(u.u_frost, o.frost * px);
    gl.uniform1f(u.u_saturate, o.saturate);
    gl.uniform1f(u.u_brightness, o.brightness ?? (o.dark ? 0.82 : 1.08));
    gl.uniform4f(u.u_wash, tint[0] / 255, tint[1] / 255, tint[2] / 255, o.tintOpacity ?? (o.dark ? 0.5 : 0.28));
    gl.uniform2f(u.u_light, o.light[0] / lightLength, -o.light[1] / lightLength); // screen y-down to GL y-up
    gl.uniform1f(u.u_sheen, o.sheen);
    gl.uniform1f(u.u_px, px);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this;
  }

  destroy() {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteProgram(this.program);
  }
}
