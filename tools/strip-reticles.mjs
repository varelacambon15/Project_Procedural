// Quita de los GLB de las ópticas del kit las micro-retículas fundidas en la malla grande.
// Reproduce el criterio de tools/audit-reticles.mjs (pieza conexa plana <0,4 mm, ≤9 mm, ≤32 tris,
// pegada al eje de la lente), elimina esos triángulos y reescribe el GLB con sus accessors y BIN
// reempaquetados. Guarda una copia de los originales en raw/opticas_originales/ y verifica después:
// el GLB se parsea, conserva mallas/materiales y ya no detecta micro-retículas.
// Uso: node tools/strip-reticles.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(root, "assets/weapons/manifest.json");
const backupDir = join(root, "raw/opticas_originales");
const glbPath = (file) => join(root, "assets/weapons", file);

// Las 10 ópticas del kit que traen retícula dibujada en el modelo (informe 29 §3).
const TARGETS = [
  "k-att-reddot-east", "k-att-reddot-west",
  "k-att-reflex-east", "k-att-reflex-west",
  "k-att-holographic-east", "k-att-holographic-west",
  "k-att-magnified-east", "k-att-magnified-west",
  "k-att-scope-east", "k-att-scope-west",
];
// Micro-piezas esperadas por el informe 29 (solo para avisar de desviaciones, no bloquea).
const EXPECTED = {
  "k-att-reddot-east": 3, "k-att-reddot-west": 1,
  "k-att-reflex-east": 3, "k-att-reflex-west": 3,
  "k-att-holographic-east": 5, "k-att-holographic-west": 2,
  "k-att-magnified-east": 5, "k-att-magnified-west": 3,
  "k-att-scope-east": 13, "k-att-scope-west": 21,
};

const GLTF_MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;

// ---------- GLB ----------
function parseGlb(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== GLTF_MAGIC) throw new Error(`${file}: no es un GLB`);
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), start = off + 8;
    if (type === CHUNK_JSON) json = JSON.parse(buf.toString("utf8", start, start + len).replace(/\0+$/, ""));
    if (type === CHUNK_BIN) bin = buf.subarray(start, start + len);
    off = start + len;
  }
  if (!json) throw new Error(`${file}: GLB sin chunk JSON`);
  return { json, bin: bin ?? Buffer.alloc(0) };
}

const COMP_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMP_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function readElement(bin, base, componentType) {
  switch (componentType) {
    case 5120: return bin.readInt8(base);
    case 5121: return bin.readUInt8(base);
    case 5122: return bin.readInt16LE(base);
    case 5123: return bin.readUInt16LE(base);
    case 5125: return bin.readUInt32LE(base);
    default: return bin.readFloatLE(base);
  }
}

function readAccessor(gltf, bin, index) {
  const a = gltf.accessors?.[index], bv = gltf.bufferViews?.[a?.bufferView];
  if (!a || !bv || !bin) return null;
  const compSize = COMP_SIZE[a.componentType], comps = COMP_COUNT[a.type] ?? 1;
  const stride = bv.byteStride || compSize * comps;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const o = base + k * stride, v = [];
    for (let c = 0; c < comps; c++) v.push(readElement(bin, o + c * compSize, a.componentType));
    out.push(v);
  }
  return out;
}

function encodeAccessor(accessor, values) {
  const compSize = COMP_SIZE[accessor.componentType], comps = COMP_COUNT[accessor.type] ?? 1;
  const buf = Buffer.alloc(values.length * comps * compSize);
  let o = 0;
  for (const v of values) for (let c = 0; c < comps; c++) {
    const x = v[c] ?? 0;
    switch (accessor.componentType) {
      case 5120: buf.writeInt8(x, o); break;
      case 5121: buf.writeUInt8(x, o); break;
      case 5122: buf.writeInt16LE(x, o); break;
      case 5123: buf.writeUInt16LE(x, o); break;
      case 5125: buf.writeUInt32LE(x, o); break;
      default: buf.writeFloatLE(x, o);
    }
    o += compSize;
  }
  return buf;
}

// ---------- matrices ----------
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
};
function nodeMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
const box = () => ({ mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity] });
const grow = (b, p) => { for (let k = 0; k < 3; k++) { if (p[k] < b.mn[k]) b.mn[k] = p[k]; if (p[k] > b.mx[k]) b.mx[k] = p[k]; } };
const boxSize = (b) => b.mx.map((v, i) => v - b.mn[i]);
const boxCenter = (b) => b.mx.map((v, i) => (v + b.mn[i]) / 2);

function nodesOf(g) {
  const scene = g.json.scenes?.[g.json.scene ?? 0];
  const roots = scene?.nodes ?? (g.json.nodes ?? []).map((_, i) => i);
  const out = [];
  const seen = new Set();
  const walk = (i, parent) => {
    if (seen.has(i)) return;
    seen.add(i);
    const n = g.json.nodes?.[i];
    if (!n) return;
    const world = mul(parent, nodeMatrix(n));
    out.push({ node: n, world });
    for (const c of n.children ?? []) walk(c, world);
  };
  for (const r of roots) walk(r, I4);
  return out;
}

// ---------- filas (malla/primitiva) ----------
function materialName(gltf, prim) {
  return prim.material != null ? gltf.materials?.[prim.material]?.name ?? `mat${prim.material}` : "—";
}

function rowsOf(g) {
  const rows = [];
  const used = new Map();
  for (const { node, world } of nodesOf(g)) {
    if (node.mesh == null) continue;
    const mesh = g.json.meshes?.[node.mesh];
    if (!mesh) continue;
    (mesh.primitives ?? []).forEach((prim) => {
      const baseName = node.name ?? mesh.name ?? `mesh${node.mesh}`;
      const n = (used.get(baseName) ?? 0) + 1;
      used.set(baseName, n);
      const name = `${baseName}#${n}`;
      const matName = materialName(g.json, prim);
      rows.push({
        name, mesh: node.mesh, prim, world,
        glass: /lens|glass|vidrio/i.test(`${name} ${matName}`),
      });
    });
  }
  return rows;
}

// Componentes conexos de una primitiva (mismo criterio que audit-reticles.mjs).
function components(gltf, bin, row) {
  const prim = row.prim;
  if ((prim.mode ?? 4) !== 4) return null;
  const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
  if (!pos) return null;
  const ind = prim.indices != null ? readAccessor(gltf, bin, prim.indices).map((v) => v[0]) : pos.map((_, i) => i);
  if (!ind.length) return null;
  const key = (v) => v.map((x) => Math.round(x * 1e5)).join(",");
  const weld = new Map(), wid = [];
  for (let i = 0; i < pos.length; i++) {
    const k = key(pos[i]);
    if (!weld.has(k)) weld.set(k, weld.size);
    wid[i] = weld.get(k);
  }
  const parent = Array.from({ length: weld.size }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  for (let t = 0; t + 2 < ind.length; t += 3) { union(wid[ind[t]], wid[ind[t + 1]]); union(wid[ind[t + 1]], wid[ind[t + 2]]); }
  const parts = new Map();
  for (let t = 0; t + 2 < ind.length; t += 3) {
    const r = find(wid[ind[t]]);
    if (!parts.has(r)) parts.set(r, { tris: [], b: box() });
    const p = parts.get(r);
    p.tris.push(t / 3);
    for (let j = 0; j < 3; j++) grow(p.b, apply(row.world, pos[ind[t + j]]));
  }
  return { ind, pos, parts: [...parts.values()].map((p) => ({ tris: p.tris, size: boxSize(p.b), center: boxCenter(p.b) })) };
}

// Micro-retícula: plana (<0,4 mm), diminuta (≤9 mm), ≤32 tris y junto al eje de alguna lente.
function isReticlePiece(p, lensBoxes) {
  return Math.min(...p.size) < 0.0004 && Math.max(...p.size) <= 0.009 && p.tris.length <= 32 &&
    lensBoxes.some((b) => {
      const yc = (b.mn[1] + b.mx[1]) / 2, zc = (b.mn[2] + b.mx[2]) / 2;
      const radial = Math.hypot(p.center[1] - yc, p.center[2] - zc);
      const maxDim = Math.max(...p.size);
      return p.center[0] >= b.mn[0] - 0.004 && p.center[0] <= b.mx[0] + 0.004 &&
        radial <= (maxDim > 0.006 ? 0.01 : 0.025);
    });
}

function lensBoxesOf(g) {
  const out = [];
  for (const row of rowsOf(g)) {
    if (!row.glass) continue;
    const pos = readAccessor(g.json, g.bin, row.prim.attributes.POSITION);
    if (!pos) continue;
    const b = box();
    for (const p of pos) grow(b, apply(row.world, p));
    out.push(b);
  }
  return out;
}

function triangleCount(g, row) {
  const prim = row.prim;
  if ((prim.mode ?? 4) !== 4) return 0;
  const n = prim.indices != null ? g.json.accessors?.[prim.indices]?.count : g.json.accessors?.[prim.attributes.POSITION]?.count;
  return Math.floor((n ?? 0) / 3);
}

// ---------- reempaquetado del GLB ----------
function writeGlb(gltf, bin, modified, file) {
  // Un bufferView nuevo, compacto, por accessor; los que no se tocan se copian des-interleaved.
  const views = [], chunks = [];
  const oldAccessorBvs = new Set(gltf.accessors.map((a) => a.bufferView));
  let total = 0;
  const pad = () => { const p = (4 - (total % 4)) % 4; if (p) { chunks.push(Buffer.alloc(p)); total += p; } };

  gltf.accessors.forEach((a, i) => {
    pad();
    const oldBv = gltf.bufferViews[a.bufferView];
    const data = modified.has(i) ? encodeAccessor(a, modified.get(i)) : accessorCopy(gltf, bin, a);
    views.push({ buffer: 0, byteOffset: total, byteLength: data.length, ...(oldBv?.target ? { target: oldBv.target } : {}) });
    chunks.push(data);
    total += data.length;
    a.bufferView = i;
    a.byteOffset = 0;
    if (modified.has(i)) {
      const values = modified.get(i);
      a.count = values.length;
      const comps = COMP_COUNT[a.type] ?? 1;
      const min = new Array(comps).fill(Infinity), max = new Array(comps).fill(-Infinity);
      for (const v of values) for (let c = 0; c < comps; c++) { min[c] = Math.min(min[c], v[c]); max[c] = Math.max(max[c], v[c]); }
      if (a.min || a.max) { a.min = min; a.max = max; }
    }
  });

  // bufferViews huérfanos (imágenes embebidas): se copian tal cual.
  gltf.bufferViews.forEach((bv, i) => {
    if (oldAccessorBvs.has(i)) return;
    pad();
    const data = Buffer.from(bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength));
    views.push({ buffer: 0, byteOffset: total, byteLength: data.length, ...(bv.name ? { name: bv.name } : {}), ...(bv.target ? { target: bv.target } : {}) });
    chunks.push(data);
    total += data.length;
  });

  gltf.bufferViews = views;
  gltf.buffers[0] = { byteLength: total };

  let json = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPad = (4 - (json.length % 4)) % 4;
  if (jsonPad) json = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);
  const binPad = (4 - (total % 4)) % 4;
  const binOut = Buffer.concat([...chunks, ...(binPad ? [Buffer.alloc(binPad)] : [])]);
  const length = 12 + 8 + json.length + 8 + binOut.length;
  const head = Buffer.alloc(12);
  head.writeUInt32LE(GLTF_MAGIC, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(length, 8);
  const jHead = Buffer.alloc(8); jHead.writeUInt32LE(json.length, 0); jHead.writeUInt32LE(CHUNK_JSON, 4);
  const bHead = Buffer.alloc(8); bHead.writeUInt32LE(binOut.length, 0); bHead.writeUInt32LE(CHUNK_BIN, 4);
  writeFileSync(glbPath(file), Buffer.concat([head, jHead, json, bHead, binOut]));
}

function accessorCopy(gltf, bin, a) {
  const bv = gltf.bufferViews[a.bufferView];
  const compSize = COMP_SIZE[a.componentType], comps = COMP_COUNT[a.type] ?? 1;
  const stride = bv.byteStride || compSize * comps;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = Buffer.alloc(a.count * comps * compSize);
  for (let k = 0; k < a.count; k++) {
    Buffer.from(bin.subarray(base + k * stride, base + k * stride + comps * compSize)).copy(out, k * comps * compSize);
  }
  return out;
}

// ---------- auditoría de un GLB (para verificar el resultado) ----------
function auditFile(file) {
  const g = parseGlb(file);
  const lenses = lensBoxesOf(g);
  const rows = rowsOf(g);
  let tris = 0, reticlePieces = 0, lensTris = 0, reticleTris = 0;
  for (const row of rows) {
    const n = triangleCount(g, row);
    tris += n;
    if (row.glass) lensTris += n;
    const c = components(g.json, g.bin, row);
    if (!c) continue;
    for (const p of c.parts) if (isReticlePiece(p, lenses)) { reticlePieces++; reticleTris += p.tris.length; }
  }
  return { json: g.json, tris, lensTris, reticlePieces, reticleTris, meshes: g.json.meshes?.length ?? 0, prims: rows.length, materials: g.json.materials?.length ?? 0 };
}

// Claves de triángulo en coordenadas de mundo (para probar que el resto de la malla no cambia).
function triangleKeys(file) {
  const g = parseGlb(file);
  const keys = new Map();
  for (const row of rowsOf(g)) {
    const prim = row.prim;
    if ((prim.mode ?? 4) !== 4) continue;
    const pos = readAccessor(g.json, g.bin, prim.attributes.POSITION);
    if (!pos) continue;
    const ind = prim.indices != null ? readAccessor(g.json, g.bin, prim.indices).map((v) => v[0]) : pos.map((_, i) => i);
    for (let t = 0; t + 2 < ind.length; t += 3) {
      const k = [ind[t], ind[t + 1], ind[t + 2]]
        .map((i) => apply(row.world, pos[i]).map((v) => Math.round(v * 1e5)).join(","))
        .sort().join("|");
      keys.set(k, (keys.get(k) ?? 0) + 1);
    }
  }
  return keys;
}

const sumCounts = (m) => [...m.values()].reduce((a, b) => a + b, 0);

// ---------- principal ----------
const man = JSON.parse(readFileSync(manifestPath, "utf8"));
mkdirSync(backupDir, { recursive: true });

const report = [];
for (const id of TARGETS) {
  const entry = (man.kit ?? []).find((k) => k.id === id);
  if (!entry?.file) throw new Error(`manifest sin ${id}`);
  const file = glbPath(entry.file);
  if (!existsSync(file)) throw new Error(`falta ${file}`);
  const backup = join(backupDir, `${id}.glb`);
  if (!existsSync(backup)) copyFileSync(file, backup);

  const before = auditFile(backup);
  const g = parseGlb(file);
  const lenses = lensBoxesOf(g);
  const rows = rowsOf(g);
  const modified = new Map();
  let pieces = 0, removedTris = 0;

  for (const row of rows) {
    if (row.glass) continue;
    const c = components(g.json, g.bin, row);
    if (!c) continue;
    const dropTri = new Set();
    for (const p of c.parts) {
      if (!isReticlePiece(p, lenses)) continue;
      pieces++;
      for (const t of p.tris) dropTri.add(t);
    }
    if (!dropTri.size) continue;
    const prim = row.prim;

    if (prim.indices != null) {
      const ind = c.ind.map((v) => [v]);
      const kept = ind.filter((_, t) => !dropTri.has(t));
      modified.set(prim.indices, kept);
      removedTris += ind.length - kept.length;
    } else {
      const keepVertex = new Set();
      for (let t = 0; t + 2 < c.ind.length; t += 3) if (!dropTri.has(t / 3)) for (let j = 0; j < 3; j++) keepVertex.add(c.ind[t + j]);
      for (const [name, acc] of Object.entries(prim.attributes)) {
        if (acc == null) continue;
        const values = readAccessor(g.json, g.bin, acc).filter((_, i) => keepVertex.has(i));
        modified.set(acc, values);
      }
      removedTris += dropTri.size;
    }
  }

  if (!removedTris) { console.log(`${id}: sin micro-piezas que quitar (¿ya limpiado?)`); report.push({ id, before: before.tris, removed: 0, pieces: 0 }); continue; }

  writeGlb(g.json, g.bin, modified, entry.file);

  // Verificación del resultado.
  const after = auditFile(file);
  const jsonOk = after.meshes === before.meshes && after.prims === before.prims && after.materials === before.materials;
  const lensOk = after.lensTris === before.lensTris;
  const trisOk = after.tris === before.tris - removedTris;
  const reticleOk = after.reticlePieces === 0;
  const beforeKeys = triangleKeys(backup), afterKeys = triangleKeys(file);
  const meshOk = sumCounts(afterKeys) === sumCounts(beforeKeys) - removedTris &&
    [...afterKeys].every(([k, n]) => n <= (beforeKeys.get(k) ?? 0));
  if (!jsonOk || !lensOk || !trisOk || !reticleOk || !meshOk) {
    throw new Error(`${id}: verificación fallida (mallas ${jsonOk}, lente ${lensOk}, tris ${trisOk}, retícula ${reticleOk}, resto de la malla ${meshOk})`);
  }
  if (EXPECTED[id] !== pieces) console.log(`  aviso ${id}: ${pieces} micro-piezas (informe esperaba ${EXPECTED[id]})`);
  report.push({ id, before: before.tris, removed: removedTris, after: after.tris, pieces });
  console.log(`${id}: ${before.tris} → ${after.tris} tris (−${removedTris}), ${pieces} micro-pieza(s) quitada(s); GLB válido, lente y materiales intactos.`);
}

console.log("\n| óptica | tris antes | quitados | tris después | micro-piezas |");
console.log("|---|---:|---:|---:|---:|");
for (const r of report) console.log(`| ${r.id} | ${r.before} | ${r.removed} | ${r.before - r.removed} | ${r.pieces} |`);
