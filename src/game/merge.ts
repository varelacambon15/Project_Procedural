// Fusión de mallas estáticas por material (rendimiento): cientos de mallas pequeñas con el mismo material se convierten
// en una sola, de modo que cada material cuesta una llamada de dibujo en vez de una por pieza. Lo que se anima por
// separado (piezas móviles, visibilidad propia) se deja fuera con `skip`.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Fusiona las mallas bajo `root` (sin entrar en `skip`) que comparten material, sombra y orden de dibujo. */
export function mergeStatic(root: THREE.Object3D, skip: Set<THREE.Object3D> = new Set()): number {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[]>();
  const walk = (o: THREE.Object3D) => {
    if (skip.has(o)) return;
    for (const c of o.children) walk(c);
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || !m.visible || m.userData.noMerge) return;
    const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}|${m.renderOrder}|${m.geometry.index ? 1 : 0}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  };
  walk(root);
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Mismos atributos en todas: posición y normal siempre; UV y color solo si todas los tienen
    const has = (k: string) => list.every((m) => !!m.geometry.attributes[k]);
    const keepUv = has("uv"), keepColor = list.some((m) => !!m.geometry.attributes.color);
    const geos = list.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!(k === "position" || k === "normal" || (k === "uv" && keepUv) || (k === "color" && keepColor))) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (keepColor && !g.attributes.color) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
      g = g.index ? g.toNonIndexed() : g;
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder;
    root.add(mesh);
    for (const m of list) { m.parent?.remove(m); removed++; }
  }
  return removed;
}
