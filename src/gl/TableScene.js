import * as THREE from 'three'

const VERT = /* glsl */`
void main() {
  gl_Position = vec4(position, 1.0);
}
`

const FRAG = /* glsl */`
precision highp float;

uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uTime;

// --- Hash & noise ---
float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 23.37);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),              hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// Rotated FBM for natural wood distortion
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    v += a * vnoise(p);
    p = rot * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.y = 1.0 - uv.y; // match screen-space Y

  // --- Procedural walnut wood ---
  vec2 wuv = vec2(uv.x * 1.8, uv.y * 5.5);

  // Double-warp for organic rings
  float wx = fbm(wuv * 0.5 + vec2(1.7, 9.2));
  float wy = fbm(wuv * 0.5 + vec2(8.3, 2.8));
  wuv += vec2(wx, wy) * 0.9;

  float rings = fbm(wuv * 0.8);
  rings = sin(rings * 20.0 + uv.y * 3.0) * 0.5 + 0.5;
  rings = pow(rings, 2.0);

  // Fine longitudinal grain
  float grain = fbm(uv * vec2(18.0, 110.0) + vec2(55.1, 0.0)) * 0.55
              + fbm(uv * vec2(6.0,  50.0) + vec2(0.0, 33.2)) * 0.45;

  float wood = clamp(rings * 0.6 + grain * 0.4, 0.0, 1.0);

  // Dark walnut palette
  vec3 c0 = vec3(0.10, 0.06, 0.02);
  vec3 c1 = vec3(0.23, 0.13, 0.06);
  vec3 c2 = vec3(0.38, 0.22, 0.10);
  vec3 c3 = vec3(0.52, 0.33, 0.15);

  vec3 woodColor = mix(c0, c1, smoothstep(0.0, 0.25, wood));
  woodColor      = mix(woodColor, c2, smoothstep(0.25, 0.6, wood));
  woodColor      = mix(woodColor, c3, smoothstep(0.6,  1.0, wood));

  // Very slow shimmer (breathing light)
  woodColor *= 0.97 + 0.03 * sin(uTime * 0.25 + uv.x * 2.0);

  // --- Cursor spotlight ---
  vec2 mUV = uMouse / uResolution;
  mUV.y = 1.0 - mUV.y;

  vec2 diff = uv - mUV;
  diff.x *= uResolution.x / uResolution.y; // aspect correction
  float d = length(diff);

  float spot    = exp(-d * d * 5.5);       // tight hot centre
  float scatter = smoothstep(0.7, 0.0, d) * 0.18; // wide soft fill

  vec3 lampColor = vec3(1.0, 0.87, 0.60);  // warm incandescent
  float totalLight = 0.10 + scatter + spot * 0.95;

  vec3 litColor = woodColor * mix(vec3(1.0), lampColor, spot * 0.75) * totalLight * 3.2;

  // --- Vignette ---
  vec2 vc = uv * 2.0 - 1.0;
  float vignette = 1.0 - dot(vc * vec2(0.65, 0.45), vc * vec2(0.65, 0.45));
  vignette = clamp(pow(vignette, 0.38), 0.0, 1.0);
  litColor *= vignette;

  gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), 1.0);
}
`

export class TableScene {
  constructor(canvas) {
    this.canvas = canvas
    this._mouse = new THREE.Vector2(
      window.innerWidth * 0.5,
      window.innerHeight * 0.5
    )
    this._targetMouse = this._mouse.clone()
    this._animId = null
    this._init()
    this._bindEvents()
  }

  _init() {
    const { canvas } = this
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

    this.scene  = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.uniforms = {
      uResolution: { value: new THREE.Vector2() },
      uMouse:      { value: new THREE.Vector2() },
      uTime:       { value: 0 },
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms:       this.uniforms,
    })

    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat))
    this._resize()
  }

  _resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h)
    this.uniforms.uResolution.value.set(w, h)
  }

  _bindEvents() {
    this._onResize    = () => this._resize()
    this._onMouseMove = (e) => this._targetMouse.set(e.clientX, e.clientY)
    window.addEventListener('resize',    this._onResize)
    window.addEventListener('mousemove', this._onMouseMove)
  }

  start() {
    const tick = (t) => {
      this._animId = requestAnimationFrame(tick)
      this.uniforms.uTime.value = t * 0.001

      // Smooth mouse lag — feels like light gently following
      this._mouse.lerp(this._targetMouse, 0.04)
      this.uniforms.uMouse.value.copy(this._mouse)

      this.renderer.render(this.scene, this.camera)
    }
    tick(0)
  }

  stop() {
    if (this._animId) cancelAnimationFrame(this._animId)
    window.removeEventListener('resize',    this._onResize)
    window.removeEventListener('mousemove', this._onMouseMove)
    this.renderer.dispose()
  }
}
