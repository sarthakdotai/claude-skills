#version 300 es
// liquid-metal.frag.glsl — the "liquid logo" / flowing-chrome variant.
//
// A DIFFERENT material from the glass panel: instead of refracting a backdrop
// behind a UI element, this turns an image/logo (its alpha or luminance) into a
// molten, animated liquid-metal surface with fresnel rim light and dispersion.
// Great for hero logos and splash marks; not a general UI material.
//
// Run it with the host in webgl-glass.js: createProgram(gl, thisSource) pairs it
// with the fullscreen vertex shader (which provides v_uv). Upload the logo to
// u_image and animate u_time. Required uniforms are listed below. Feed a source
// image whose SHAPE you want to liquify (a high-contrast / alpha logo).
//
// Core idea: animated flow field -> surface normal -> fresnel + refracted image sample.

precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_image;   // source logo / shape (alpha or luminance = mask)
uniform vec2  u_resolution;  // canvas px
uniform float u_time;        // seconds
uniform float u_flow;        // flow speed          (try 0.6)
uniform float u_scale;       // pattern scale       (try 3.0)
uniform float u_refraction;  // image bend amount   (try 0.08)
uniform float u_dispersion;  // chromatic spread    (try 0.5)
uniform vec3  u_tintA;       // metal colour A      (try vec3(0.98,0.98,1.0))
uniform vec3  u_tintB;       // metal colour B      (try vec3(0.1,0.1,0.12))

// --- Smooth gradient noise ----------------------------------------------------
// A pseudo-random unit gradient at every lattice corner, blended with a quintic
// fade so the field and its slope are continuous. Returns roughly -1..1.
vec2 cornerGradient(ivec2 c){
  uint h = uint(c.x) * 0x5A1F3C97u ^ uint(c.y) * 0xB4E3D12Bu;
  h ^= h >> 15;
  h *= 0x7C9A6E35u;
  h ^= h >> 13;
  float a = float(h) * (6.28318530718 / 4294967296.0);
  return vec2(cos(a), sin(a));
}

float gradientNoise(vec2 p){
  ivec2 c = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n00 = dot(cornerGradient(c), f);
  float n10 = dot(cornerGradient(c + ivec2(1, 0)), f - vec2(1.0, 0.0));
  float n01 = dot(cornerGradient(c + ivec2(0, 1)), f - vec2(0.0, 1.0));
  float n11 = dot(cornerGradient(c + ivec2(1, 1)), f - vec2(1.0, 1.0));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y) * 1.4;
}

// Fractal flow field -> scalar height.
float flowField(vec2 p, float t){
  float h = 0.0, amp = 0.5, freq = 1.0;
  for(int i=0;i<4;i++){
    h += amp * gradientNoise(p*freq + vec2(t*0.3, -t*0.2)*freq);
    freq *= 2.0; amp *= 0.5;
  }
  return h;
}

void main(){
  vec2 uv = v_uv;
  float t = u_time * u_flow;
  vec2 p = (uv - 0.5) * u_scale;

  // Surface height + normal from the animated flow field.
  float eps = 0.002 * u_scale;
  float h  = flowField(p, t);
  float hx = flowField(p + vec2(eps,0.0), t);
  float hy = flowField(p + vec2(0.0,eps), t);
  vec3 normal = normalize(vec3(h - hx, h - hy, 0.35));

  // Refract the source image through the surface (per-channel = dispersion).
  vec2 disp = normal.xy * u_refraction;
  float d = u_dispersion * 0.02;
  vec4 src;
  src.r = texture(u_image, uv + disp*(1.0+d)).r;
  src.g = texture(u_image, uv + disp).g;
  src.b = texture(u_image, uv + disp*(1.0-d)).b;
  src.a = texture(u_image, uv + disp).a;

  // Metallic shading: fresnel rim + specular streak driven by the normal.
  float fres = pow(1.0 - abs(normal.z), 3.0);
  float spec = pow(max(dot(normal, normalize(vec3(0.6,0.7,0.6))), 0.0), 20.0);
  vec3 metal = mix(u_tintB, u_tintA, smoothstep(-0.6, 0.6, h));
  metal += spec;                       // hot specular highlight
  metal = mix(metal, u_tintA, fres);   // bright chrome rim

  // Composite metal onto the logo shape (image alpha = mask).
  vec3 color = mix(src.rgb, metal, 0.85);
  outColor = vec4(color, src.a);
}
