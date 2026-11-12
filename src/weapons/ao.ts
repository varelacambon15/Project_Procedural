// Oclusión de contacto entre piezas, calculada una vez al montar el arma (coste por fotograma: cero).
// Cada pieza trae horneada su propia oclusión (conversor); aquí se añade la que le hacen las piezas vecinas:
// uniones, bajo la mira, alrededor del cargador o de un accesorio. Se multiplica sobre el color de vértice.
import * as THREE from "three";

/**
 * `parts`: objetos ya colocados dentro de `root` (sin centrar). Oscurece los vértices de cada pieza según cuántos
 * rayos cortos (hasta `maxDist`) chocan con OTRAS piezas. Solo se copian las geometrías que cambian.
 */
export function contactAO(root: THREE.Object3D, parts: THREE.Object3D[], maxDist = 0.022, rays = 10, strength = 0.6) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const toRoot = (o: THREE.Object3D) => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
  // Triángulos de todas las piezas en el espacio del arma, con la pieza a la que pertenecen
  const tri: number[] = [], owner: number[] = [];
  const meshesOf = (o: THREE.Object3D) => { const out: THREE.Mesh[] = []; o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.geometry.attributes.position) out.push(m); }); return out; };
  const v = new THREE.Vector3();
  parts.forEach((p, pi) => {
    for (const m of meshesOf(p)) {
      const M = toRoot(m), pos = m.geometry.attributes.position, idx = m.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t + 2 < n; t += 3) {
        for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, idx ? idx.getX(t + k) : t + k).applyMatrix4(M); tri.push(v.x, v.y, v.z); }
        owner.push(pi);
      }
    }
  });
  const C = maxDist, cells = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const T = owner.length;
  for (let t = 0; t < T; t++) {
    const o = t * 9;
    const lo = [0, 1, 2].map((a) => Math.floor(Math.min(tri[o + a], tri[o + 3 + a], tri[o + 6 + a]) / C));
    const hi = [0, 1, 2].map((a) => Math.floor(Math.max(tri[o + a], tri[o + 3 + a], tri[o + 6 + a]) / C));
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 4000) continue; // triángulos enormes: se ignoran
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); let c = cells.get(k); if (!c) cells.set(k, (c = [])); c.push(t); }
  }
  const hitTri = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, o: number) => {
    const e1x = tri[o + 3] - tri[o], e1y = tri[o + 4] - tri[o + 1], e1z = tri[o + 5] - tri[o + 2];
    const e2x = tri[o + 6] - tri[o], e2y = tri[o + 7] - tri[o + 1], e2z = tri[o + 8] - tri[o + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) return -1;
    const inv2 = 1 / det, tx = ox - tri[o], ty = oy - tri[o + 1], tz = oz - tri[o + 2];
    const u = (tx * px + ty * py + tz * pz) * inv2; if (u < 0 || u > 1) return -1;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const w = (dx * qx + dy * qy + dz * qz) * inv2; if (w < 0 || u + w > 1) return -1;
    const d = (e2x * qx + e2y * qy + e2z * qz) * inv2; return d > 0.0003 ? d : -1;
  };
  const dirs = Array.from({ length: rays }, (_, i) => { const z = 1 - (i + 0.5) / rays, r = Math.sqrt(1 - z * z), a = i * 2.39996; return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z); });
  const q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), p = new THREE.Vector3(), nn = new THREE.Vector3(), d = new THREE.Vector3();
  parts.forEach((part, pi) => {
    for (const m of meshesOf(part)) {
      const M = toRoot(m), N = new THREE.Matrix3().getNormalMatrix(M);
      const g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal;
      if (!nor) continue;
      let col: Float32Array | null = null;
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(M); nn.fromBufferAttribute(nor, i).applyMatrix3(N).normalize();
        const ox = p.x + nn.x * 0.0005, oy = p.y + nn.y * 0.0005, oz = p.z + nn.z * 0.0005;
        const cx = Math.floor(ox / C), cy = Math.floor(oy / C), cz = Math.floor(oz / C);
        const cand = new Set<number>();
        for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) { const c = cells.get(key(x, y, z)); if (c) for (const t of c) if (owner[t] !== pi) cand.add(t); }
        if (!cand.size) continue;
        q.setFromUnitVectors(Z, nn);
        let hit = 0;
        for (const dir of dirs) {
          d.copy(dir).applyQuaternion(q);
          let best = Infinity;
          for (const t of cand) { const h = hitTri(ox, oy, oz, d.x, d.y, d.z, t * 9); if (h > 0 && h < best) best = h; }
          if (best <= maxDist) hit += 1 - (best / maxDist) * 0.5;
        }
        if (!hit) continue;
        if (!col) {
          // La geometría es compartida (caché): se copia antes de oscurecerla
          m.geometry = g.clone();
          const base = m.geometry.attributes.color as THREE.BufferAttribute | undefined;
          col = base ? (base.array as Float32Array).slice(0, pos.count * base.itemSize) : new Float32Array(pos.count * 3).fill(1);
          if (!base || base.itemSize !== 3) { const c3 = new Float32Array(pos.count * 3); for (let k = 0; k < pos.count; k++) for (let a = 0; a < 3; a++) c3[k * 3 + a] = base ? base.getX(k) : 1; col = c3; }
          m.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
        }
        const f = 1 - strength * Math.min(1, (hit / rays) * 1.6);
        col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
      }
    }
  });
}
