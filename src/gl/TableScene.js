import {
  Vector2, WebGLRenderer, Scene, OrthographicCamera,
  DataTexture, TextureLoader, ShaderMaterial, Mesh, PlaneGeometry,
  ClampToEdgeWrapping, LinearFilter,
} from 'three'

// PSD canvas dimensions — must match tableLayout.js
const TEX_W = 2816
const TEX_H = 1536

const VERT = /* glsl */`
void main() {
  gl_Position = vec4(position, 1.0);
}
`

const FRAG = /* glsl */`
precision highp float;

uniform vec2      uResolution;
uniform vec2      uMouse;
uniform float     uTime;
uniform sampler2D uWood;
uniform vec2      uTexSize;   // texture natural size in pixels

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.y = 1.0 - uv.y; // flip Y to match CSS

  // --- Cover-fit UV for wood texture ---
  float canvasAR = uResolution.x / uResolution.y;
  float texAR    = uTexSize.x    / uTexSize.y;
  vec2 woodUV    = uv;
  if (canvasAR >= texAR) {
    // Canvas wider → scale by width, crop top/bottom
    float rendH  = canvasAR / texAR;
    woodUV.y     = (uv.y - (1.0 - rendH) * 0.5) / rendH;
  } else {
    // Canvas taller → scale by height, crop sides
    float rendW  = texAR / canvasAR;
    woodUV.x     = (uv.x - (1.0 - rendW) * 0.5) / rendW;
  }

  // Clamp to avoid any edge-pixel bleed from floating-point imprecision
  woodUV = clamp(woodUV, 0.001, 0.999);
  vec3 woodColor = texture2D(uWood, woodUV).rgb;

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

  vec3 lampColor   = vec3(1.0, 1.0, 1.0);    // neutral white
  float totalLight = 0.62 + scatter + spot * 0.95;

  vec3 litColor = woodColor * mix(vec3(1.0), lampColor, spot * 0.75) * totalLight;

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
    // Init in CSS pixels; _resize() will correct to physical once PR is known
    this._mouse = new Vector2(
      window.innerWidth * 0.5,
      window.innerHeight * 0.5
    )
    this._targetMouse = this._mouse.clone()
    this._animId = null
    this._woodReady = false
    this._init()
    this._bindEvents()
  }

  _init() {
    const { canvas } = this
    this.renderer = new WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

    this.scene  = new Scene()
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // 1×1 neutral placeholder so shader compiles before texture loads
    const placeholder = new DataTexture(
      new Uint8Array([128, 128, 128, 255]), 1, 1
    )
    placeholder.needsUpdate = true

    this.uniforms = {
      uResolution: { value: new Vector2() },
      uMouse:      { value: new Vector2() },
      uTime:       { value: 0 },
      uWood:       { value: placeholder },
      uTexSize:    { value: new Vector2(TEX_W, TEX_H) },
    }

    const mat = new ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms:       this.uniforms,
    })

    this.scene.add(new Mesh(new PlaneGeometry(2, 2), mat))
    this._resize()
    // Correct initial mouse to physical pixels now that renderer (and PR) exist
    const pr = this.renderer.getPixelRatio()
    this._mouse.multiplyScalar(pr)
    this._targetMouse.copy(this._mouse)

    // Load real wood texture (served from /public/table/)
    new TextureLoader().load('/table/wood.png', (tex) => {
      tex.wrapS = tex.wrapT = ClampToEdgeWrapping
      tex.minFilter = LinearFilter
      tex.magFilter = LinearFilter
      this.uniforms.uWood.value = tex
      this._woodReady = true
    })
  }

  _resize() {
    const w  = window.innerWidth
    const h  = window.innerHeight
    const pr = this.renderer.getPixelRatio()
    this.renderer.setSize(w, h)
    // uResolution must match gl_FragCoord which uses physical (device) pixels
    this.uniforms.uResolution.value.set(w * pr, h * pr)
  }

  _bindEvents() {
    this._onResize    = () => this._resize()
    this._onMouseMove = (e) => {
      const pr = this.renderer.getPixelRatio()
      this._targetMouse.set(e.clientX * pr, e.clientY * pr)
    }
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
    this._onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(this._animId)
        this._animId = null
      } else if (!this._animId) {
        tick(performance.now())
      }
    }
    document.addEventListener('visibilitychange', this._onVisibility)
    tick(0)
  }

  stop() {
    if (this._animId) cancelAnimationFrame(this._animId)
    document.removeEventListener('visibilitychange', this._onVisibility)
    window.removeEventListener('resize',    this._onResize)
    window.removeEventListener('mousemove', this._onMouseMove)
    this.renderer.dispose()
  }
}
