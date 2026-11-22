// Postprocesado de la simulación: cadena de EffectComposer con tono filmic (ACES), bloom de lo que
// brilla de verdad (neón, tiras de luz, legendarias), viñeta suave, grano de película muy sutil,
// aberración cromática solo al recibir daño y antialiasing barato (FXAA). El nivel de calidad decide
// qué entra en la cadena y a qué resolución va el bloom; si el dispositivo no puede con ella, se cae
// sola a Bajo (render directo, sin postprocesado) sin errores en consola. El arma se dibuja en una
// segunda pasada con su propia cámara (como en los shooters) y el visor de francotirador sigue siendo
// una capa CSS sobre el lienzo: aquí no se toca.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { setSetting, type Quality } from "./settings";

// ---------- Lógica pura (con tests) ----------
/** Qué entra en la cadena según el nivel de calidad. */
export interface PostPlan {
  /** false = render directo sin postprocesado (Bajo). */ chain: boolean;
  /** Tamaño de la cadena de bloom relativo al render (0.5 = media resolución, 1 = completa). */ bloomScale: number;
  /** Viñeta suave. */ vignette: boolean;
  /** Grano de película muy sutil. */ grain: boolean;
  /** Aberración cromática solo al recibir daño. */ aberration: boolean;
  /** Antialiasing barato (FXAA). */ fxaa: boolean;
}
export function postPlan(q: Quality): PostPlan {
  if (q === "high") return { chain: true, bloomScale: 1, vignette: true, grain: true, aberration: true, fxaa: true };
  if (q === "medium") return { chain: true, bloomScale: 0.5, vignette: true, grain: false, aberration: false, fxaa: true };
  return { chain: false, bloomScale: 0, vignette: false, grain: false, aberration: false, fxaa: false };
}
/** Tope de la aberración cromática (desplazamiento en UV hacia la esquina). */
export const ABER_MAX = 0.012;
/** Impulso de aberración al recibir `dmg` de daño: se acumula con tope. */
export function hitAberration(prev: number, dmg: number): number {
  return Math.min(ABER_MAX, Math.max(prev, 0) + 0.005 + Math.min(Math.max(dmg, 0), 60) * 0.00008);
}
/** Caída exponencial de un impulso hacia 0 (τ = constante de tiempo en segundos). */
export function decayAberration(v: number, dt: number, tau = 0.12): number {
  return v <= 0 ? 0 : v * Math.exp(-Math.max(dt, 0) / tau);
}

// ---------- Cadena WebGL ----------
/** Segunda pasada: el arma y los brazos con su propia cámara, encima de la escena y sin tocar el fondo. */
class ViewmodelPass extends RenderPass {
  override render(r: THREE.WebGLRenderer, w: THREE.WebGLRenderTarget, rd: THREE.WebGLRenderTarget, dt: number, mask: boolean) { const bg = this.scene.background; this.scene.background = null; super.render(r, w, rd, dt, mask); this.scene.background = bg; }
}
/** Bloom con la cadena de desenfoques a escala (media resolución en Medio, completa en Alto). */
class ScaledBloom extends UnrealBloomPass {
  scale = 1;
  override setSize(width: number, height: number) { super.setSize(Math.max(2, Math.round(width * this.scale)), Math.max(2, Math.round(height * this.scale))); }
}
/** Viñeta + grano + aberración (el último paso: todo sobre el tono ya aplicado, muy sutil). */
const FinishShader = {
  name: "FinishShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.26 },
    uGrain: { value: 0.03 },
    uAber: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uAber;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 col;
      if (uAber > 0.0) {
        // Radial: los canales se separan solo hacia los bordes, más donde el error de lente pesa
        vec2 o = d * uAber * r2 * 2.0;
        col.r = texture2D(tDiffuse, vUv + o).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - o).b;
      } else col = texture2D(tDiffuse, vUv).rgb;
      col *= 1.0 - uVignette * smoothstep(0.25, 1.05, r2 * 2.0);
      if (uGrain > 0.0) col += (hash(vUv * 917.0 + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  /** Bloom (null si la cadena no llegó a montarse). */ bloom: ScaledBloom | null = null;
  private composer: EffectComposer | null = null;
  private fxaa: ShaderPass | null = null;
  private finish: ShaderPass | null = null;
  private plan: PostPlan;
  /** La cadena falló: se queda en Bajo el resto de la partida. */ private fallen = false;
  private aber = 0;
  private time = 0;
  private bloomOn = true;
  private bloomStrength = 0.3;
  private w = 1;
  private h = 1;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.Camera, private vmCam: THREE.Camera, quality: Quality) {
    this.plan = postPlan(quality);
    if (this.plan.chain && !this.ensureChain()) this.fallback();
  }

  /** ¿El dispositivo puede con la cadena (medio flotante para los destellos)? */
  private supported() {
    try { return this.renderer.capabilities.isWebGL2 || !!this.renderer.extensions.get("EXT_color_buffer_half_float"); } catch { return false; }
  }
  /** Monta la cadena; si algo falla, devuelve false y todo sigue en Bajo. */
  private ensureChain(): boolean {
    if (this.composer) return true;
    if (this.fallen || !this.supported()) return false;
    try {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const vmPass = new ViewmodelPass(this.scene, this.vmCam); vmPass.clear = false; vmPass.clearDepth = true;
      composer.addPass(vmPass);
      const bloom = new ScaledBloom(new THREE.Vector2(this.w, this.h), 0.8, 0.5, 0.82);
      composer.addPass(bloom);
      composer.addPass(new OutputPass()); // tono filmic (ACES) + salida sRGB
      const fxaa = new ShaderPass(FXAAShader);
      composer.addPass(fxaa);
      const finish = new ShaderPass(FinishShader);
      composer.addPass(finish);
      this.composer = composer; this.bloom = bloom; this.fxaa = fxaa; this.finish = finish;
      this.sync();
      return true;
    } catch { return false; }
  }
  /** Cae a Bajo sin errores en consola (y deja el ajuste acorde para que la interfaz lo cuente). */
  private fallback() {
    if (this.fallen) return;
    this.fallen = true;
    this.plan = postPlan("low");
    this.sync();
    try { setSetting("quality", "low"); } catch { /* sin ajustes: solo se renderiza en directo */ }
  }
  /** Activa cada efecto según el plan (el bloom además sigue el ajuste «Resplandor del neón»). */
  private sync() {
    if (this.bloom) { this.bloom.scale = this.plan.bloomScale; this.bloom.enabled = this.plan.chain && this.bloomOn && this.plan.bloomScale > 0; this.bloom.strength = this.bloomStrength; }
    if (this.fxaa) this.fxaa.enabled = this.plan.fxaa;
    if (this.finish) this.finish.enabled = this.plan.chain && (this.plan.vignette || this.plan.grain || this.plan.aberration);
  }

  /** Cambia el nivel de calidad (Bajo no usa cadena). */
  setQuality(q: Quality) {
    const plan = postPlan(this.fallen ? "low" : q);
    if (plan.chain && !this.ensureChain()) { this.fallback(); return; }
    const resize = plan.bloomScale !== this.plan.bloomScale;
    this.plan = plan;
    this.sync();
    if (resize) this.setSize(this.w, this.h); // (el tamaño de la cadena de bloom cambia con la calidad)
  }
  /** Ajuste «Resplandor del neón»: enciende el bloom y con qué fuerza (suave de día, fuerte de noche). */
  bloomLook(on: boolean, strength: number) {
    this.bloomOn = on; this.bloomStrength = strength;
    if (this.bloom) { this.bloom.strength = strength; this.bloom.enabled = this.plan.chain && on && this.plan.bloomScale > 0; }
  }
  /** Al recibir daño: la aberración cromática sube un momento y se deshace sola. */
  hit(dmg: number) { if (this.plan.aberration) this.aber = hitAberration(this.aber, dmg); }
  /** Tamaño de la ventana (la escala de render ya viene en el pixelRatio del renderizador). */
  setSize(w: number, h: number) {
    this.w = w; this.h = h;
    if (!this.composer) return;
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    if (this.fxaa) this.fxaa.uniforms.resolution.value.set(1 / Math.max(1, w * pr), 1 / Math.max(1, h * pr));
  }
  /** Un fotograma: pasa el tiempo al grano, baja la aberración y dibuja (cadena o render directo). */
  render(dt: number) {
    this.time += dt;
    this.aber = decayAberration(this.aber, dt);
    if (this.finish) { this.finish.uniforms.uTime.value = this.time; this.finish.uniforms.uAber.value = this.aber; }
    if (!this.composer || !this.plan.chain) { this.plain(); return; }
    try { this.composer.render(dt); } catch { this.fallback(); this.plain(); }
  }
  /** Render directo (Bajo): escena y, encima, el arma con su cámara; sin postprocesado. */
  private plain() {
    const r = this.renderer;
    // Si la cadena falló a mitad de fotograma, puede dejar un render target intermedio enlazado:
    // el render directo tiene que ir al lienzo, no a ese buffer (si no, pantalla en blanco).
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
    const ac = r.autoClear, bg = this.scene.background;
    r.autoClear = false; r.clearDepth(); this.scene.background = null;
    r.render(this.scene, this.vmCam); this.scene.background = bg; r.autoClear = ac;
  }
}
