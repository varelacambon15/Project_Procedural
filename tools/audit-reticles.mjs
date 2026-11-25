// Inventario de retículas incluidas en los modelos de las ópticas (solo lectura).
// Recorre las miras del manifest (kit `k-att-*`/`k-optic-*`/`k-ironsight-*`, accesorios `q-acc-scope-*` y las
// miras integradas en los GLB de los packs), lee el bloque JSON y el BIN del GLB (sin three) y saca por malla:
// triángulos, material (color base, emisivo, alpha, textura) y tamaño en metros. Además, en las mallas
// sospechosas descompone la geometría en piezas conexas para encontrar micro-retículas planas (p. ej. el punto
// o el aro dibujado delante de la lente) que quedan fundidas en una malla grande.
// Uso: node tools/audit-reticles.mjs  (imprime tablas Markdown por pantalla; no escribe nada)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(root, "assets/weapons/manifest.json");
const accSrcPath = join(root, "src/weapons/accessories.ts");
const glbPath = (file) => join(root, "assets/weapons", file);

const GLTF_MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;

// ---------- GLB (chunks JSON y BIN) ----------
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
  return { json, bin };
}

function readAccessor(gltf, bin, index) {
  const a = gltf.accessors?.[index], bv = gltf.bufferViews?.[a?.bufferView];
  if (!a || !bv || !bin) return null;
  const compSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type] ?? 1;
  const stride = bv.byteStride || compSize * comps;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const float = a.componentType === 5126;
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const o = base + k * stride, v = [];
    for (let c = 0; c < comps; c++) {
      const p = o + c * compSize;
      v.push(float ? bin.readFloatLE(p) : a.componentType === 5125 ? bin.readUInt32LE(p) : a.componentType === 5123 ? bin.readUInt16LE(p) : a.componentType === 5122 ? bin.readInt16LE(p) : bin.readUInt8(p));
    }
    out.push(float ? v : v);
  }
  return out;
}

// ---------- matrices (column-major, como glTF) ----------
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
const apply = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
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

// Piezas conexas planas y diminutas de una primitiva (para retículas fundidas en la malla de la mira).
function microParts(gltf, bin, prim, world) {
  if (!bin || (prim.mode ?? 4) !== 4) return [];
  const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
  if (!pos) return [];
  const idx = prim.indices != null ? readAccessor(gltf, bin, prim.indices).map((v) => v[0]) : pos.map((_, i) => i);
  if (!idx.length) return [];
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
  for (let t = 0; t + 2 < idx.length; t += 3) { union(wid[idx[t]], wid[idx[t + 1]]); union(wid[idx[t + 1]], wid[idx[t + 2]]); }
  const parts = new Map();
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const r = find(wid[idx[t]]);
    if (!parts.has(r)) parts.set(r, { tris: 0, b: box() });
    const p = parts.get(r);
    p.tris++;
    for (let j = 0; j < 3; j++) grow(p.b, apply(world, ...pos[idx[t + j]]));
  }
  return [...parts.values()].map((p) => ({ tris: p.tris, size: boxSize(p.b), center: boxCenter(p.b) }));
}

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "0");
const mm = (s) => [...s].sort((a, b) => b - a).map((v) => fmt(v * 1000, v * 1000 < 10 ? 1 : 0)).join("×");

function materialInfo(g, prim) {
  const m = prim.material != null ? g.materials?.[prim.material] : null;
  const pbr = m?.pbrMetallicRoughness ?? {};
  const sg = m?.extensions?.KHR_materials_pbrSpecularGlossiness;
  const base = pbr.baseColorFactor ?? sg?.diffuseFactor ?? [1, 1, 1, 1];
  let emissive = m?.emissiveFactor ?? [0, 0, 0];
  const strength = m?.extensions?.KHR_materials_emissive_strength?.emissiveStrength;
  if (strength) emissive = emissive.map((v) => v * strength);
  const tex = !!(pbr.baseColorTexture || sg?.diffuseTexture || m?.emissiveTexture);
  const r = base[0] ?? 1, gr = base[1] ?? 1, b = base[2] ?? 1;
  return {
    name: m?.name ?? (prim.material != null ? `mat${prim.material}` : "—"),
    base: [r, gr, b], alpha: base[3] ?? 1, alphaMode: m?.alphaMode ?? "OPAQUE", tex,
    emissive: emissive.some((v) => v > 0.01),
    red: r > 0.12 && r > gr * 3 && r > b * 3,
    blue: b > 0.12 && b > r * 3 && b > gr * 3,
  };
}

function rowsOf(g, opts = {}) {
  const rows = [];
  const used = new Map();
  for (const { node, world } of nodesOf(g)) {
    if (node.mesh == null) continue;
    const mesh = g.json.meshes?.[node.mesh];
    if (!mesh) continue;
    const role = node.extras?.role ?? node.name ?? "";
    if (opts.onlyScope && !/scope/i.test(role)) continue;
    (mesh.primitives ?? []).forEach((prim, pi) => {
      const pos = g.json.accessors?.[prim.attributes?.POSITION];
      if (!pos?.min || !pos?.max) return;
      const b = box();
      for (const x of [pos.min[0], pos.max[0]]) for (const y of [pos.min[1], pos.max[1]]) for (const z of [pos.min[2], pos.max[2]]) grow(b, apply(world, x, y, z));
      const idx = prim.indices != null ? g.json.accessors?.[prim.indices]?.count : pos.count;
      const tris = (prim.mode ?? 4) === 4 ? Math.floor((idx ?? 0) / 3) : (idx ?? 0);
      const mat = materialInfo(g.json, prim);
      const baseName = node.name ?? mesh.name ?? `mesh${node.mesh}`;
      const n = (used.get(baseName) ?? 0) + 1;
      used.set(baseName, n);
      const name = `${baseName}#${n}`;
      rows.push({
        name, role, tris, mat, size: boxSize(b), center: boxCenter(b),
        glass: /lens|glass|vidrio/i.test(`${name} ${mat.name}`),
        prim, world, micro: [],
      });
    });
  }
  return rows;
}

// ---------- tipos de mira del juego ----------
const ownKind = (k) => (k === "alza" ? "irons" : k === "punto_rojo" ? "dot" : k === "holografica" || k === "prisma" || k === "acog" ? "holo" : /^visor/.test(k ?? "") ? "scope" : "—");

function kitSightType(id) {
  if (/ironsight/i.test(id)) return "irons";
  if (id === "k-optic-rear-rail-01") return "holo";
  if (id === "k-optic-rear-rail-02") return "dot";
  if (/^k-att-scope-|ltermica$/i.test(id)) return "scope";
  if (/reddot|reflex/i.test(id)) return "dot";
  if (/holographic|holo/i.test(id)) return "holo";
  if (/magnified|acog|prism/i.test(id)) return "holo";
  if (/scope/i.test(id)) return "scope";
  return "—";
}

function probableForm(id, sight, kind) {
  if (kind === "pack") {
    if (sight === "alza") return "alza + punto (hierro)";
    if (sight === "punto_rojo") return "punto";
    if (sight === "holografica") return "aro + punto";
    if (sight === "prisma") return "chevron/prisma";
    if (sight === "acog") return "chevron (ACOG)";
    if (/^visor/.test(sight ?? "")) return "cruz / mil-dot";
    return "otra (mira de modelo)";
  }
  if (/acog|magnified/i.test(id)) return "chevron (ACOG)";
  if (/prism/i.test(id)) return "chevron/prisma";
  if (/holographic|holo/i.test(id)) return "aro + punto";
  if (/reddot|reflex|punto/i.test(id)) return "punto";
  if (/scope/i.test(id)) return "cruz / mil-dot";
  if (/ironsight/i.test(id)) return "alza + punto";
  return "otra";
}

// ---------- ópticas ----------
const man = JSON.parse(readFileSync(manifestPath, "utf8"));
const optics = [];

for (const k of man.kit ?? []) {
  if (!/^Sights/.test(k.slot ?? "") || !k.file) continue;
  const sight = kitSightType(k.id);
  optics.push({ id: k.id, group: "kit", kind: "kit", slot: k.slot, file: k.file, sight, form: probableForm(k.id, sight, "kit") });
}
for (const w of man.weapons ?? []) {
  if (!w.file) continue;
  if (w.type === "accessory" && (w.parts ?? []).some((p) => p.role === "scope")) {
    optics.push({ id: w.id, group: "acc", kind: "acc", file: w.file, sight: "scope", form: "cruz / mil-dot" });
    continue;
  }
  let g;
  try { g = parseGlb(glbPath(w.file)); } catch { continue; }
  if (!(g.json.nodes ?? []).some((n) => /scope/i.test(n.extras?.role ?? n.name ?? ""))) continue;
  const sight = w.ownSight ? ownKind(w.ownSight.kind) : "—";
  optics.push({
    id: w.id, group: "pack", kind: "pack", file: w.file, sight,
    ownKind: w.ownSight?.kind ?? null, zoom: w.ownSight?.zoom ?? null,
    form: probableForm(w.id, w.ownSight?.kind, "pack"), gltf: g, onlyScope: true,
  });
}

// Procedurales de accessories.ts (sin GLB: los dibuja buildOptic)
const accSrc = readFileSync(accSrcPath, "utf8");
const procIds = [...accSrc.matchAll(/\{\s*id:\s*"([^"]+)",\s*kind:\s*"optic"/g)].map((m) => m[1]);
const PROC = {
  "acc:reddot": { sight: "dot", form: "punto", meshes: "dot (SphereGeometry r=1,2 mm, redDot)", reticle: true },
  "acc:holo": { sight: "holo", form: "aro + punto", meshes: "dot (RingGeometry 2,5–3,5 mm, redDot)", reticle: true },
  "acc:acog": { sight: "holo", form: "chevron (ACOG)", meshes: "— (solo lens CircleGeometry, glass)", reticle: false },
  "acc:acog-c": { sight: "holo", form: "chevron (ACOG)", meshes: "— (solo lens CircleGeometry, glass)", reticle: false },
  "acc:scope2": { sight: "holo", form: "cruz / mil-dot", meshes: "— (solo lens CircleGeometry, glass)", reticle: false },
  "acc:scope6": { sight: "scope", form: "cruz / mil-dot", meshes: "— (solo lens CircleGeometry, glass)", reticle: false },
  "acc:iron": { sight: "irons", form: "alza + punto", meshes: "— (buildFrontSight / modelos iron/*)", reticle: false },
};

// ---------- análisis ----------
for (const o of optics) {
  const g = o.gltf ?? parseGlb(glbPath(o.file));
  o.gltf = g;
  o.rows = rowsOf(g, { onlyScope: o.onlyScope });
  const lens = o.rows.filter((r) => r.glass);
  o.lensBoxes = lens.map((r) => ({ mn: r.center.map((v, i) => v - r.size[i] / 2), mx: r.center.map((v, i) => v + r.size[i] / 2) }));

  for (const r of o.rows) {
    // Candidata a micro-retícula: pieza conexa plana (<0,4 mm), diminuta (≤9 mm) y cerca del eje de la lente.
    const micro = microParts(g.json, g.bin, r.prim, r.world);
    r.micro = micro.filter((p) => Math.min(...p.size) < 0.0004 && Math.max(...p.size) <= 0.009 && p.tris <= 32);
    r.retina = r.micro.some((p) => o.lensBoxes.some((b) => {
      const yc = (b.mn[1] + b.mx[1]) / 2, zc = (b.mn[2] + b.mx[2]) / 2;
      const radial = Math.hypot(p.center[1] - yc, p.center[2] - zc);
      const maxDim = Math.max(...p.size);
      return p.center[0] >= b.mn[0] - 0.004 && p.center[0] <= b.mx[0] + 0.004 && radial <= (maxDim > 0.006 ? 0.01 : 0.025);
    }));
    r.reasons = [];
    if (r.glass) r.reasons.push("lente");
    if (!r.glass && /ret(icle)?|dot|cross|mark|chevron/i.test(`${r.name} ${r.mat.name}`)) r.reasons.push("nombre");
    if (!r.glass && r.mat.emissive) r.reasons.push("emisivo");
    const minDim = Math.min(...r.size), maxDim = Math.max(...r.size);
    if (!r.glass && minDim < 0.001 && maxDim < 0.03) r.reasons.push("plana+pequeña");
    if (!r.glass && (r.mat.red || r.mat.blue)) r.reasons.push(r.mat.red ? "color rojo" : "color azul");
    if (!r.glass && r.mat.tex && maxDim < 0.03) r.reasons.push("textura");
    if (r.retina) r.reasons.push("micro-retícula");
  }

  o.reticles = o.rows.filter((r) => r.retina);
  o.candidates = o.rows.filter((r) => r.reasons.length && !r.glass);
  o.glassCandidates = o.rows.filter((r) => r.reasons.length && r.glass);
  // Los modelos de mira de hierro llevan piezas pequeñas que no son retícula dibujada: se marcan como posible, no como sí.
  o.status = o.reticles.length ? "sí" : o.candidates.length ? "posible" : o.glassCandidates.length ? "lente" : "no";
  if (o.sight === "irons" && !o.reticles.length) o.status = "hierro";
}

const matCell = (m) => `${m.name} (${m.base.map((v) => fmt(v, 2)).join(",")}; α${fmt(m.alpha, 2)}; ${m.alphaMode}${m.tex ? "; tex" : ""}${m.emissive ? "; em" : ""})`;
function flagCell(r) {
  if (r.retina) {
    const dims = [...new Set(r.micro.map((p) => mm(p.size)))];
    return `sí: micro-retícula (${r.micro.length} pieza(s) ≤9 mm: ${dims.slice(0, 4).join(", ")})`;
  }
  if (!r.reasons.length) return r.glass ? "lente (vidrio)" : "—";
  if (r.glass) return "lente (vidrio)";
  return `${r.reasons.join(", ")}`;
}

function printOptic(o) {
  const meta = o.kind === "pack"
    ? `${o.sight}${o.ownKind ? ` (${o.ownKind}${o.zoom ? `, ${o.zoom}x` : ""})` : ""}`
    : o.sight;
  const ret = o.reticles.length ? `sí (${o.reticles.map((r) => r.name).join(", ")})` : o.status === "posible" ? "posible" : "no";
  console.log(`\n**${o.id}** — ${meta} · ${o.file} · ${o.rows.length} malla(s) · retícula propia: **${ret}** · forma: ${o.form}`);
  console.log("\n| malla | tris | material | tamaño (mm) | candidata |");
  console.log("|---|---:|---|---:|---|");
  for (const r of o.rows) console.log(`| ${r.name} | ${r.tris} | ${matCell(r.mat)} | ${mm(r.size)} | ${flagCell(r)} |`);
}

console.log("# Inventario de retículas en modelos de ópticas\n");
console.log("Tamaños = caja envolvente de la malla en ejes del modelo (X largo, Y alto, Z ancho), en mm, lados de mayor a menor.");
console.log("Candidata = nombre de retícula/lente, material emisivo, plana (<1 mm) y pequeña (<3 cm), color rojo/azul, textura pequeña o micro-pieza plana pegada al centro de la lente.");
console.log("Las micro-piezas (≤9 mm, <0,4 mm de grosor) se buscan descomponiendo cada malla en geometría conexa: así se ven retículas fundidas en una malla grande (p. ej. las marcas mil-dot del visor).\n");

const groups = [
  ["A. Ópticas del kit (k-att-*, k-optic-*, k-ironsight-*)", (o) => o.group === "kit"],
  ["B. Accesorios de mira con modelo propio (q-acc-scope-*)", (o) => o.group === "acc"],
  ["C. Miras integradas en modelos de arma (packs)", (o) => o.group === "pack"],
];
for (const [title, filter] of groups) {
  const list = optics.filter(filter);
  console.log(`\n## ${title} (${list.length})`);
  for (const o of list) printOptic(o);
}

console.log(`\n## D. Ópticas procedurales, sin modelo (buildOptic) (${procIds.length})\n`);
console.log("| id | mira del juego | forma | mallas de retícula en el código | ¿retícula en el modelo? |");
console.log("|---|---|---|---|---|");
for (const id of procIds) {
  const p = PROC[id] ?? { sight: "—", form: "—", meshes: "—", reticle: false };
  console.log(`| ${id} | ${p.sight} | ${p.form} | ${p.meshes} | ${p.reticle ? "sí" : "no"} |`);
}

// ---------- resumen ----------
const yes = optics.filter((o) => o.reticles.length);
const possible = optics.filter((o) => !o.reticles.length && o.status === "posible");
const lensOnly = optics.filter((o) => o.status === "lente");
const ironOnly = optics.filter((o) => o.status === "hierro");
const none = optics.filter((o) => o.status === "no");

console.log("\n## Resumen\n");
console.log(`- Ópticas con modelo: **${optics.length}** (kit ${optics.filter((o) => o.kind === "kit").length}, accesorios ${optics.filter((o) => o.kind === "acc").length}, integradas en packs ${optics.filter((o) => o.kind === "pack").length}).`);
console.log(`- Con retícula dibujada en el modelo: **${yes.length}** (${yes.map((o) => o.id).join(", ") || "—"}).`);
console.log(`- Candidata débil (color/textura/pieza pequeña, sin micro-retícula junto a la lente): **${possible.length}**${possible.length ? ` (${possible.map((o) => o.id).join(", ")})` : ""}.`);
console.log(`- Solo lente/vidrio, sin retícula detectada: **${lensOnly.length}**.`);
console.log(`- Miras de hierro (sin retícula dibujada): **${ironOnly.length}** (${ironOnly.map((o) => o.id).join(", ")}).`);
console.log(`- Sin ninguna candidata: **${none.length}**.`);
console.log(`- Ópticas procedurales sin modelo: **${procIds.length}** (${procIds.join(", ")}).`);

console.log("\n### Retículas detectadas\n");
console.log("| óptica | mira del juego | malla(s) | micro-pieza(s) | forma probable |");
console.log("|---|---|---|---|---|");
for (const o of yes) {
  const micros = o.reticles.flatMap((r) => r.micro.filter((p) => r.retina));
  console.log(`| ${o.id} | ${o.sight}${o.ownKind ? ` (${o.ownKind})` : ""} | ${o.reticles.map((r) => r.name).join(", ")} | ${micros.map((p) => mm(p.size)).join(", ")} | ${o.form} |`);
}

console.log("\n## Tabla por óptica\n");
console.log("| id | grupo | mira del juego | retícula propia | malla(s) | forma probable |");
console.log("|---|---|---|---|---|---|");
for (const o of [...optics].sort((a, b) => a.group.localeCompare(b.group) || a.id.localeCompare(b.id))) {
  const ret = o.reticles.length ? `sí (${o.reticles.reduce((n, r) => n + r.micro.length, 0)} micro-pieza${o.reticles.reduce((n, r) => n + r.micro.length, 0) === 1 ? "" : "s"})` : o.status === "posible" ? "posible (adorno)" : o.status === "lente" ? "no (solo lente)" : o.status === "hierro" ? "no (hierro)" : "no";
  const meshes = o.reticles.length ? o.reticles.map((r) => r.name).join(", ") : o.candidates.length ? o.candidates.map((r) => r.name).join(", ") : "—";
  console.log(`| ${o.id} | ${o.kind} | ${o.sight}${o.ownKind ? ` (${o.ownKind})` : ""} | ${ret} | ${meshes} | ${o.form} |`);
}
