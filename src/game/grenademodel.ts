// Modelo 3D de las granadas (assets/grenade/grenade.glb, aportado por el usuario): se carga una vez y se clona para
// el lanzamiento, el suelo y las fotos de la tienda y el inventario. Cada tipo tiene su color y proporciones; la
// rareza añade brillo (de nada en común a un resplandor claro en legendaria).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GRENADE_KINDS, GRENADE_RARITY, type GrenadeKind, type GrenadeRarity } from "./grenades";

let base: Promise<THREE.Group | null> | null = null;
/** Carga el modelo (centrado, con 1 de alto y el eje hacia arriba). null si falla: se usa una esfera. */
export function loadGrenadeModel(url = "./grenade/grenade.glb"): Promise<THREE.Group | null> {
  base ??= new GLTFLoader().loadAsync(url).then((g) => {
    const s = g.scene; s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.y, size.z), wrap = new THREE.Group();
    s.position.sub(c).multiplyScalar(1); s.scale.multiplyScalar(1); const inner = new THREE.Group(); inner.add(s); inner.scale.setScalar(k); inner.position.copy(c).multiplyScalar(-k);
    s.position.set(0, 0, 0); inner.position.set(-c.x * k, -c.y * k, -c.z * k);
    wrap.add(inner); return wrap;
  }).catch(() => null);
  return base;
}

/** Proporciones por tipo (ancho, alto): piña clásica, incendiaria alargada, racimo achatada… */
const SHAPE: Record<GrenadeKind, [number, number]> = { frag: [1, 1], incendiary: [0.82, 1.3], shock: [0.95, 1.05], cluster: [1.25, 0.85], singularity: [1.1, 1.1], sticky: [1.05, 0.92] };

/** Copia del modelo con el color del tipo y el brillo de la rareza, de `height` metros de alto. */
export function grenadeObject(model: THREE.Group | null, kind: GrenadeKind, rarity: GrenadeRarity, height = 0.12): THREE.Object3D {
  const col = new THREE.Color(GRENADE_KINDS[kind].color), rar = new THREE.Color(GRENADE_RARITY[rarity].color);
  const glow = { comun: 0, poco: 0.12, rara: 0.22, epica: 0.35, legendaria: 0.55 }[rarity];
  if (!model) return new THREE.Mesh(new THREE.SphereGeometry(height / 2, 12, 8), new THREE.MeshStandardMaterial({ color: col, emissive: rar, emissiveIntensity: glow }));
  const o = model.clone(true);
  o.traverse((m) => {
    const mesh = m as THREE.Mesh; if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial, mat = src.clone();
    // El cuerpo toma el color del tipo (sobre su textura); el anillo, el de la rareza
    const ring = /ring/i.test(mesh.name) || /ring/i.test(mesh.parent?.name ?? "");
    mat.color = ring ? rar.clone() : col.clone().lerp(new THREE.Color(0xffffff), 0.25);
    mat.emissive = ring ? rar.clone() : col.clone(); mat.emissiveIntensity = ring ? 0.25 + glow : glow * 0.6;
    mesh.material = mat; mesh.castShadow = true;
  });
  const [w, h] = SHAPE[kind]; o.scale.set(height * w, height * h, height * w);
  return o;
}

/** Foto de la granada (tienda, inventario): se dibuja una vez por tipo y rareza y se guarda. */
const thumbs = new Map<string, Promise<string>>();
let rr: THREE.WebGLRenderer | null = null;
export function grenadeThumb(kind: GrenadeKind, rarity: GrenadeRarity): Promise<string> {
  const key = `${kind}:${rarity}`;
  if (!thumbs.has(key)) thumbs.set(key, loadGrenadeModel().then((model) => {
    rr ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    rr.setSize(160, 120); rr.setClearColor(0x000000, 0);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 3, 4); sc.add(d);
    const o = grenadeObject(model, kind, rarity, 1); o.rotation.set(0.25, -0.6, 0.15); sc.add(o);
    const cam = new THREE.PerspectiveCamera(30, 160 / 120, 0.1, 10); cam.position.set(0, 0.1, 2.6); cam.lookAt(0, 0, 0);
    rr.render(sc, cam); return rr.domElement.toDataURL("image/png");
  }));
  return thumbs.get(key)!;
}
