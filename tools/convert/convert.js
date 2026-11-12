// Conversor de packs de armas a .glb normalizados.
// Se ejecuta dentro de un navegador (Playwright) lanzado por tools/build-assets.mjs.
//
// Convención de salida (todas las armas):
//   - Unidades en metros, +X = hacia la boca del cañón, +Y = arriba, Z = lateral.
//   - Cada arma es un .glb con un nodo por pieza, con nombre de rol:
//       body | slide | frame | barrel | magazine | scope | accessory
//   - La geometría de cada pieza está "horneada" en el espacio del arma montada,
//     así que montar el arma original es poner todas las piezas en el origen.
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const TARGET_LENGTH = { lmg: 1.15, pistol: 0.22, revolver: 0.26, smg: 0.5, rifle: 0.9, bullpup: 0.75, shotgun: 1.0, sniper: 1.2, launcher: 1.1, flamethrower: 0.95, accessory: null };

// ---------- utilidades ----------
async function fetchBuf(url) { const r = await fetch(url); if (!r.ok) throw new Error(`No se pudo leer ${url}`); return r.arrayBuffer(); }
async function fetchText(url) { const r = await fetch(url); if (!r.ok) throw new Error(`No se pudo leer ${url}`); return r.text(); }
function toB64(buf) { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }

function flatMaterial(name, hex, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: opts.roughness ?? 0.6, metalness: opts.metalness ?? 0.3, flatShading: true });
  m.name = name; return m;
}

// Hornea la transformación de mundo en la geometría y devuelve mallas sueltas.
function bakeMeshes(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    const m = new THREE.Mesh(g, o.material);
    m.name = o.name;
    out.push(m);
  });
  return out;
}

function boxOf(meshes) { const b = new THREE.Box3(); for (const m of meshes) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox); } return b; }

// Calcula la rotación que lleva el arma a +X adelante, +Y arriba.
// Eje lateral = el más estrecho. Eje de longitud = el más largo de los otros dos.
// Sentido: la culata/empuñadura (la zona más baja) queda detrás.
function orientationFor(meshes, hint = {}) {
  const box = boxOf(meshes), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const dims = [size.x, size.y, size.z];
  const side = hint.side ?? dims.indexOf(Math.min(...dims));
  const rest = [0, 1, 2].filter((a) => a !== side);
  const len = hint.length ?? (dims[rest[0]] >= dims[rest[1]] ? rest[0] : rest[1]);
  const up = rest.find((a) => a !== len);
  const axis = (i) => new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
  // Sentido de "arriba": la mitad con más volumen de vértices suele ser el cuerpo superior,
  // pero es más fiable mirar dónde está la empuñadura: la parte que sobresale hacia abajo es estrecha.
  let upSign = hint.upSign ?? 0, fwdSign = hint.fwdSign ?? 0;
  const pts = [];
  for (const m of meshes) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) pts.push([p.getX(i), p.getY(i), p.getZ(i)]); }
  const getc = (p, a) => p[a] - [c.x, c.y, c.z][a];
  if (!upSign) {
    // La mitad "inferior" (empuñadura, cargador) ocupa menos longitud que la superior.
    const spread = (sgn) => { let lo = Infinity, hi = -Infinity; for (const p of pts) if (getc(p, up) * sgn > dims[up] * 0.25) { lo = Math.min(lo, p[len]); hi = Math.max(hi, p[len]); } return hi - lo; };
    upSign = spread(1) >= spread(-1) ? 1 : -1;
  }
  if (!fwdSign) {
    // La empuñadura (lo más bajo) está hacia atrás respecto al centro de la longitud.
    let s = 0, n = 0;
    for (const p of pts) if (getc(p, up) * upSign < -dims[up] * 0.3) { s += getc(p, len); n++; }
    fwdSign = n && s / n > 0 ? -1 : 1;
  }
  const X = axis(len).multiplyScalar(fwdSign), Y = axis(up).multiplyScalar(upSign);
  const Z = new THREE.Vector3().crossVectors(X, Y);
  // Matriz que lleva X->(1,0,0), Y->(0,1,0), Z->(0,0,1): la transpuesta de [X Y Z].
  const basis = new THREE.Matrix4().makeBasis(X, Y, Z).transpose();
  return basis;
}

function normalize(parts, type, hint) {
  const all = parts.map((p) => p.mesh);
  const rot = orientationFor(all, hint);
  for (const m of all) m.geometry.applyMatrix4(rot);
  let box = boxOf(all);
  const len = box.max.x - box.min.x;
  // lengthMul: variantes larga/corta del mismo modelo conservan su diferencia de largo
  const k = (TARGET_LENGTH[type] ? TARGET_LENGTH[type] / len : hint?.scale ?? 1) * (hint?.lengthMul ?? 1);
  const c = box.getCenter(new THREE.Vector3());
  const t = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  for (const m of all) { m.geometry.applyMatrix4(t); m.geometry.computeVertexNormals(); m.geometry.computeBoundingBox(); }
  return k;
}

// Puntos de anclaje derivados de la geometría montada.
function sockets(parts) {
  const S = {};
  const body = parts.find((p) => p.role === "body" || p.role === "frame" || p.role === "receiver");
  const front = parts.filter((p) => ["body", "slide", "barrel", "front"].includes(p.role));
  if (front.length) {
    const b = boxOf(front.map((p) => p.mesh)); const fx = b.max.x, tol = (b.max.x - b.min.x) * 0.03;
    let ys = 0, zs = 0, n = 0, ylo = Infinity, yhi = -Infinity;
    for (const p of front) { const a = p.mesh.geometry.attributes.position; for (let i = 0; i < a.count; i++) if (a.getX(i) > fx - tol) { ys += a.getY(i); zs += a.getZ(i); n++; ylo = Math.min(ylo, a.getY(i)); yhi = Math.max(yhi, a.getY(i)); } }
    S.muzzle = { pos: [fx, (ylo + yhi) / 2, n ? zs / n : 0], diameter: Math.max(0.004, yhi - ylo) };
  }
  for (const p of parts) {
    const bb = p.mesh.geometry.boundingBox;
    if (p.role === "magazine") S.magazine = { pos: [(bb.min.x + bb.max.x) / 2, bb.max.y, 0], size: [bb.max.x - bb.min.x, bb.max.y - bb.min.y] };
    if (p.role === "scope") S.optic = { pos: [(bb.min.x + bb.max.x) / 2, bb.min.y, 0], size: [bb.max.x - bb.min.x, bb.max.y - bb.min.y] };
    if (p.role === "slide") S.slide = { pos: [bb.min.x, bb.min.y, 0] };
    if (p.role === "barrel") S.barrel = { pos: [bb.min.x, (bb.min.y + bb.max.y) / 2, 0], length: bb.max.x - bb.min.x };
  }
  if (body) { const bb = boxOf(parts.filter((p) => ["body", "slide", "frame", "receiver"].includes(p.role)).map((p) => p.mesh)); S.top = { pos: [(bb.min.x + bb.max.x) / 2, bb.max.y, 0] }; }
  // Raíl para miras: lo más alto del cuerpo en su tercio central (encima del cajón de mecanismos).
  const recv = parts.filter((p) => p.role === "receiver");
  const bodies = recv.length ? recv : parts.filter((p) => p.role === "body");
  if (bodies.length) {
    const bb = boxOf(bodies.map((p) => p.mesh)); const L = bb.max.x - bb.min.x;
    const x0 = bb.min.x + L * (recv.length ? 0.15 : 0.3), x1 = bb.min.x + L * (recv.length ? 0.85 : 0.62);
    // Altura superior de cada franja; se usa la mediana para no apoyarse en asas, alzas o miras fijas.
    const N = 14, tops = new Array(N).fill(-Infinity);
    for (const p of bodies) { const a = p.mesh.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i); if (x > x0 && x < x1) { const k = Math.min(N - 1, Math.floor(((x - x0) / (x1 - x0)) * N)); tops[k] = Math.max(tops[k], a.getY(i)); } } }
    const valid = tops.filter((v) => v > -Infinity).sort((p, q) => p - q);
    if (valid.length) S.rail = { pos: [(x0 + x1) / 2, valid[Math.floor(valid.length * 0.4)], 0], length: x1 - x0 };
  }
  const all = boxOf(parts.map((p) => p.mesh));
  return { sockets: S, bounds: { min: all.min.toArray().map((v) => +v.toFixed(4)), max: all.max.toArray().map((v) => +v.toFixed(4)) } };
}

async function exportGLB(parts) {
  const scene = new THREE.Scene();
  for (const p of parts) { p.mesh.name = p.role + (p.index ? "_" + p.index : ""); p.mesh.userData = { role: p.role, source: p.source || "" }; scene.add(p.mesh); }
  const buf = await new GLTFExporter().parseAsync(scene, { binary: true });
  return toB64(buf);
}

function roundSockets(o) { return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "number" ? +v.toFixed(4) : v))); }

/** Tipo estándar de cada punto de unión: una pieza solo encaja en una unión de su mismo tipo. */
const CONNECTOR_TYPES = { muzzle: "barrel_thread", magazine: "mag_well", optic: "optic_mount", rail: "rail_top", slide: "slide_rails", barrel: "barrel_seat", top: "top_surface",
  rear: "stock_mount", front: "handguard_mount", grip: "grip_mount", stockFace: "stock_mount", frontFace: "handguard_mount", gripFace: "grip_mount" };


/** Perfil lateral de un conjunto de mallas: en N franjas a lo largo de X, el punto más alto y el más bajo (silueta). */
function profileOf(meshes, N = 24) {
  const b = boxOf(meshes); const x0 = b.min.x, x1 = b.max.x, L = Math.max(1e-6, x1 - x0);
  const top = new Array(N).fill(-Infinity), bot = new Array(N).fill(Infinity);
  for (const m of meshes) {
    const a = m.geometry.attributes.position, idx = m.geometry.index;
    const n = idx ? idx.count : a.count;
    // Por triángulo, para que las franjas sin vértices (caras largas) también cuenten
    for (let t = 0; t + 2 < n; t += 3) {
      const ids = [0, 1, 2].map((k) => (idx ? idx.getX(t + k) : t + k));
      const xs = ids.map((i) => a.getX(i)), ys = ids.map((i) => a.getY(i));
      const k0 = Math.max(0, Math.floor(((Math.min(...xs) - x0) / L) * N)), k1 = Math.min(N - 1, Math.floor(((Math.max(...xs) - x0) / L) * N));
      const lo = Math.min(...ys), hi = Math.max(...ys);
      for (let k = k0; k <= k1; k++) { top[k] = Math.max(top[k], hi); bot[k] = Math.min(bot[k], lo); }
    }
  }
  const r = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);
  return { x0: +x0.toFixed(4), x1: +x1.toFixed(4), top: top.map(r), bot: bot.map(r) };
}
async function finish(id, type, parts, extra = {}) {
  const meta = roundSockets(sockets(parts));
  for (const [k, v] of Object.entries(meta.sockets)) v.type = CONNECTOR_TYPES[k] ?? k;
  if (extra.joints) for (const [k, v] of Object.entries(extra.joints)) v.type = CONNECTOR_TYPES[k] ?? k;
  const tris = parts.reduce((s, p) => s + p.mesh.geometry.attributes.position.count / 3, 0);
  const glb = await exportGLB(parts);
  // Piezas intercambiables aprobadas tras la revisión visual (las demás no se usan sueltas)
  const swappable = ["stock", "grip", "front", "slide", "frame", "barrel", "magazine", "scope"];
  const approved = parts.map((p) => p.role).filter((r) => swappable.includes(r));
  // Caja de cada pieza (por rol) y si es de madera: el generador las usa para la puerta de calidad y el acabado único
  const partBounds = {}, wood = [];
  for (const p of parts) {
    p.mesh.geometry.computeBoundingBox(); const bb = p.mesh.geometry.boundingBox;
    const cur = partBounds[p.role]; const lo = bb.min.toArray(), hi = bb.max.toArray();
    partBounds[p.role] = cur ? { min: cur.min.map((v, i) => Math.min(v, lo[i])), max: cur.max.map((v, i) => Math.max(v, hi[i])) } : { min: lo, max: hi };
    const mats = [].concat(p.mesh.material);
    if (mats.some((m) => /wood|brown|handle/i.test(m.name || "")) && !wood.includes(p.role)) wood.push(p.role);
  }
  const profiles = {};
  for (const role of new Set(parts.map((p) => p.role))) profiles[role] = profileOf(parts.filter((p) => p.role === role).map((p) => p.mesh));
  return { id, type, parts: parts.map((p) => ({ role: p.role, node: p.mesh.name, source: p.source || "" })), ...meta, partBounds: roundSockets(partBounds), wood, profiles, triangles: Math.round(tris), ...extra, approved, glb };
}

// ---------- OBJ (Quaternius) con separación por componentes conexas ----------
function parseOBJ(text, mtlText, boost = 1.7) {
  const V = [], faces = []; let mat = null;
  for (const line of text.split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p[0] === "v") V.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === "usemtl") mat = p[1];
    else if (p[0] === "f") faces.push({ v: p.slice(1).map((s) => parseInt(s.split("/")[0], 10) - 1), mat });
  }
  const mats = {}; let cur = null;
  for (const line of (mtlText || "").split("\n")) { const p = line.trim().split(/\s+/); if (p[0] === "newmtl") cur = p[1]; if (p[0] === "Kd" && cur) mats[cur] = [+p[1], +p[2], +p[3]].map((x) => Math.min(1, x * boost)); }
  return { V, faces, mats };
}
function components(V, faces) {
  const par = V.map((_, i) => i);
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (const f of faces) for (let i = 1; i < f.v.length; i++) { const a = find(f.v[0]), b = find(f.v[i]); if (a !== b) par[a] = b; }
  const groups = new Map();
  faces.forEach((f, i) => { const r = find(f.v[0]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  return [...groups.values()].map((fi) => {
    const box = new THREE.Box3();
    for (const i of fi) for (const v of faces[i].v) box.expandByPoint(new THREE.Vector3(...V[v]));
    return { faces: fi, box };
  });
}
function meshFromFaces(V, faces, faceIdx, mats, matCache) {
  const byMat = new Map();
  for (const i of faceIdx) { const f = faces[i]; if (!byMat.has(f.mat)) byMat.set(f.mat, []); const arr = byMat.get(f.mat); for (let t = 1; t < f.v.length - 1; t++) for (const vi of [f.v[0], f.v[t], f.v[t + 1]]) arr.push(...V[vi]); }
  const geos = [], materials = [];
  for (const [m, arr] of byMat) {
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    geos.push(g);
    if (!matCache[m]) { const c = mats[m] || [0.1, 0.1, 0.1]; const metal = /Metal/.test(m); matCache[m] = new THREE.MeshStandardMaterial({ name: m, color: new THREE.Color(c[0], c[1], c[2]), roughness: /Wood/.test(m) ? 0.8 : metal ? 0.45 : 0.6, metalness: metal ? 0.55 : 0.1, flatShading: true }); }
    materials.push(matCache[m]);
  }
  // Una malla con grupos por material
  const merged = new THREE.BufferGeometry();
  const pos = []; let start = 0;
  geos.forEach((g, i) => { const a = g.attributes.position.array; pos.push(...a); merged.addGroup(start, a.length / 3, i); start += a.length / 3; });
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Mesh(merged, materials);
}

async function convertQuaternius(job) {
  const text = await fetchText(job.obj), mtl = await fetchText(job.mtl).catch(() => "");
  const { V, faces, mats } = parseOBJ(text, mtl);
  const matCache = {};
  let parts;
  if (job.split === "pistol") {
    const C = components(V, faces);
    const upper = C.filter((c) => c.box.min.y > 0.3);
    const slide = upper.reduce((a, b) => (b.faces.length > a.faces.length ? b : a));
    const sb = slide.box;
    const roles = { slide: [], barrel: [], frame: [] };
    for (const c of C) {
      if (c.box.min.y > 0.3 && c.box.max.x > sb.max.x + 0.01) roles.barrel.push(c);
      else if (c.box.min.y >= sb.min.y - 0.03) roles.slide.push(c);
      else roles.frame.push(c);
    }
    parts = Object.entries(roles).map(([role, cs]) => ({ role, source: job.id, mesh: meshFromFaces(V, faces, cs.flatMap((c) => c.faces), mats, matCache) }));
  } else {
    parts = [{ role: job.role || "body", source: job.id, mesh: meshFromFaces(V, faces, faces.map((_, i) => i), mats, matCache) }];
  }
  // Quaternius ya viene con +X adelante e +Y arriba.
  normalize(parts, job.type, { side: 2, length: 0, upSign: 1, fwdSign: 1, scale: job.scale });
  return finish(job.id, job.type, parts, { pack: job.pack });
}

// ---------- OBJ con varios objetos ("o Nombre"): un arma = varios objetos ----------
const objCache = new Map();
async function loadMultiOBJ(url) {
  if (!objCache.has(url)) {
    const V = [], objects = new Map(); let cur = "default";
    for (const line of (await fetchText(url)).split("\n")) {
      const c = line.charCodeAt(0);
      if (c === 118 && line[1] === " ") { const p = line.split(/\s+/); V.push([+p[1], +p[2], +p[3]]); }
      else if (c === 111 && line[1] === " ") { cur = line.slice(2).trim(); if (!objects.has(cur)) objects.set(cur, []); }
      else if (c === 102 && line[1] === " ") { const p = line.trim().split(/\s+/).slice(1).map((x) => parseInt(x.split("/")[0], 10)); if (!objects.has(cur)) objects.set(cur, []); objects.get(cur).push(p.map((i) => (i < 0 ? V.length + i : i - 1))); }
    }
    objCache.set(url, { V, objects });
  }
  return objCache.get(url);
}
// ---------- Despiece de armas largas: culata · cajón · empuñadura · guardamanos/cañón ----------
/** Corta una sopa de triángulos (x,y,z…) por el plano eje = valor. Devuelve [lado negativo, lado positivo]. */
function clipByPlane(arr, axis, value) {
  const neg = [], pos = [];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const emit = (poly, out) => { for (let i = 1; i < poly.length - 1; i++) out.push(...poly[0], ...poly[i], ...poly[i + 1]); };
  for (let i = 0; i < arr.length; i += 9) {
    const v = [[arr[i], arr[i + 1], arr[i + 2]], [arr[i + 3], arr[i + 4], arr[i + 5]], [arr[i + 6], arr[i + 7], arr[i + 8]]];
    const d = v.map((p) => p[axis] - value);
    if (d.every((x) => x <= 0)) { neg.push(...arr.slice(i, i + 9)); continue; }
    if (d.every((x) => x >= 0)) { pos.push(...arr.slice(i, i + 9)); continue; }
    const pn = [], pp = [];
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3], da = d[k], db = d[(k + 1) % 3];
      if (da <= 0) pn.push(a); if (da >= 0) pp.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const m = lerp(a, b, da / (da - db)); pn.push(m); pp.push(m); }
    }
    emit(pn, neg); emit(pp, pos);
  }
  return [neg, pos];
}
/** Cara de corte: centro y alto/ancho de los vértices que quedan sobre el plano. */
function face(arr, axis, value, eps) {
  let n = 0, ylo = Infinity, yhi = -Infinity, xlo = Infinity, xhi = -Infinity, zs = 0, ys = 0;
  for (let i = 0; i < arr.length; i += 3) if (Math.abs(arr[i + axis] - value) < eps) { n++; ylo = Math.min(ylo, arr[i + 1]); yhi = Math.max(yhi, arr[i + 1]); xlo = Math.min(xlo, arr[i]); xhi = Math.max(xhi, arr[i]); ys += arr[i + 1]; zs += arr[i + 2]; }
  if (!n) return null;
  return axis === 0 ? { pos: [value, (ylo + yhi) / 2, 0], size: [yhi - ylo, 0] } : { pos: [(xlo + xhi) / 2, value, 0], size: [xhi - xlo, 0] };
}

/**
 * Despieza el cuerpo de un arma larga. Busca la empuñadura (lo más bajo de la mitad trasera, sin contar el cargador)
 * y el pozo del cargador, y corta: culata detrás de la empuñadura, guardamanos delante del pozo, empuñadura por debajo
 * del cajón. Devuelve piezas y "juntas" (caras de unión) para montar piezas de otras armas.
 */
function splitLongGun(parts) {
  // El cuerpo puede venir en varias mallas (una por material): se corta cada una con los mismos planos.
  const bodies = parts.filter((p) => p.role === "body"), body = bodies[0], mag = parts.find((p) => p.role === "magazine");
  const arrs = bodies.map((p) => Array.from(p.mesh.geometry.attributes.position.array));
  const arr = arrs.flat();
  const box = boxOf(bodies.map((p) => p.mesh)); const x0 = box.min.x, L = box.max.x - box.min.x;
  const N = 48, minY = new Array(N).fill(Infinity), maxY = new Array(N).fill(-Infinity);
  const slice = (x) => Math.min(N - 1, Math.max(0, Math.floor(((x - x0) / L) * N)));
  for (let i = 0; i < arr.length; i += 3) { const k = slice(arr[i]); minY[k] = Math.min(minY[k], arr[i + 1]); maxY[k] = Math.max(maxY[k], arr[i + 1]); }
  const sx = (k) => x0 + ((k + 0.5) / N) * L;
  const mb = mag ? mag.mesh.geometry.boundingBox : null;
  const magTop = mb ? mb.max.y : null;
  // Empuñadura: el punto más bajo entre el 15% y el pozo del cargador (o el 60%)
  const gEnd = mb ? slice(mb.min.x) - 1 : Math.floor(N * 0.6);
  let gk = Math.floor(N * 0.15);
  for (let k = Math.floor(N * 0.15); k <= gEnd; k++) if (minY[k] < minY[gk]) gk = k;
  // Parte inferior del cajón: la parte alta del cargador o la mediana de los mínimos del centro
  const mid = minY.slice(Math.floor(N * 0.35), Math.floor(N * 0.7)).filter(Number.isFinite).sort((a, b) => a - b);
  const yb = magTop ?? mid[Math.floor(mid.length * 0.6)];
  if (!(minY[gk] < yb - L * 0.04)) return null; // sin empuñadura clara: no se despieza
  let g0 = gk, g1 = gk;
  while (g0 > 0 && minY[g0 - 1] < yb - L * 0.015) g0--;
  while (g1 < gEnd && minY[g1 + 1] < yb - L * 0.015) g1++;
  const gx0 = sx(g0) - L / N, gx1 = sx(g1) + L / N * 0.5;
  const a = gx0 - L * 0.02;                               // culata | cajón
  const b = mb ? mb.max.x + L * 0.05 : sx(g1) + L * 0.22;  // cajón | guardamanos
  if (a < x0 + L * 0.08 || b > x0 + L * 0.85 || b - a < L * 0.15) return null;
  const cut = (data) => {
    const [stock, rest] = clipByPlane(data, 0, a);
    const [middle, front] = clipByPlane(rest, 0, b);
    const [left, r1] = clipByPlane(middle, 0, gx0);
    const [m2, right] = clipByPlane(r1, 0, gx1);
    const [grip, above] = clipByPlane(m2, 1, yb);
    return { receiver: [...left, ...above, ...right], stock, grip, front };
  };
  const pieces = arrs.map(cut);
  const join = (k) => pieces.flatMap((p) => p[k]);
  const receiver = join("receiver"), stock = join("stock"), grip = join("grip"), front = join("front");
  const eps = L * 0.004;
  const joints = {
    rear: face(receiver, 0, a, eps), front: face(receiver, 0, b, eps), grip: face(receiver, 1, yb, eps),
    stockFace: face(stock, 0, a, eps), frontFace: face(front, 0, b, eps), gripFace: face(grip, 1, yb, eps),
  };
  if (Object.values(joints).some((j) => !j) || stock.length < 90 || front.length < 90 || grip.length < 45) return null;
  const matOf = (p) => (Array.isArray(p.mesh.material) ? p.mesh.material[0] : p.mesh.material);
  const mk = (data, role, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(data, 3)); g.computeVertexNormals(); g.computeBoundingBox(); return { role, source: body.source, mesh: new THREE.Mesh(g, mat) }; };
  const out = [];
  for (const role of ["receiver", "stock", "grip", "front"]) pieces.forEach((pc, i) => { if (pc[role].length) out.push(mk(pc[role], role, matOf(bodies[i]))); });
  if (mag) out.push(mag);
  return { parts: out, joints };
}

const OBJ_FINISH = { body: ["#33363a", 0.5, 0.55], magazine: ["#232427", 0.6, 0.4] };
async function convertMultiOBJ(job) {
  const { V, objects } = await loadMultiOBJ(job.obj);
  const parts = [];
  for (const rule of job.objects) {
    const names = [...objects.keys()].filter((n) => new RegExp(rule.match).test(n));
    if (!names.length) throw new Error(`${job.id}: no hay objeto ${rule.match}`);
    const pos = [];
    for (const n of names) for (const f of objects.get(n)) for (let t = 1; t < f.length - 1; t++) for (const vi of [f[0], f[t], f[t + 1]]) pos.push(...V[vi]);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const fin = OBJ_FINISH[rule.role] || OBJ_FINISH.body;
    parts.push({ role: rule.role, source: job.id, mesh: new THREE.Mesh(g, flatMaterial(rule.role === "body" ? "Polymer" : "Steel", fin[0], { roughness: fin[1], metalness: fin[2] })) });
  }
  normalize(parts, job.type, job.hint || {});
  if (job.modular) {
    const split = splitLongGun(parts);
    if (split) {
      const r = roundSockets({ joints: split.joints });
      const out = await finish(job.id, job.type, split.parts, { pack: job.pack, joints: r.joints, modular: true });
      // El raíl y la boca salen del cajón y del guardamanos
      return out;
    }
  }
  return finish(job.id, job.type, parts, { pack: job.pack });
}

// ---------- FBX ----------
const fbxCache = new Map();
async function loadFBX(url) {
  if (!fbxCache.has(url)) {
    const manager = new THREE.LoadingManager();
    const done = new Promise((res) => { manager.onLoad = res; setTimeout(res, 4000); });
    const loader = new FBXLoader(manager);
    const obj = loader.parse(await fetchBuf(url), url.slice(0, url.lastIndexOf("/") + 1));
    await done;
    fbxCache.set(url, obj);
  }
  return fbxCache.get(url);
}

const PALETTES = {
  asimov: { GunMetalNewPallete: ["#6a7078", 0.45, 0.5], PlasticNewPallete: ["#3a3e44", 0.75, 0.05] },
  misc: { M1911BodyMat: ["#2d3034", 0.45, 0.6], M1911InsideMat: ["#55585c", 0.5, 0.5], M1911HandleMat: ["#5a3a24", 0.8, 0.05], Deagle: ["#6b6e72", 0.4, 0.65], Mat_Dark: ["#2e3034", 0.5, 0.55] },
};
function applyPalette(mesh, pal) {
  if (!pal) return;
  const fix = (m) => { const p = pal[m.name]; return p ? flatMaterial(m.name, p[0], { roughness: p[1], metalness: p[2] }) : m; };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material);
}
function fixTextured(mesh) {
  const fix = (m) => { if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.magFilter = THREE.NearestFilter; } m.flatShading = true; if (m.map) m.color?.set?.(0xffffff); const s = new THREE.MeshStandardMaterial({ name: m.name, map: m.map || null, color: m.map ? 0xffffff : m.color, roughness: 0.6, metalness: 0.2, flatShading: true }); return s; };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material);
}

const texCache = new Map();
async function loadTexture(url) {
  if (!texCache.has(url)) {
    const t = await new THREE.TextureLoader().loadAsync(url);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = true;
    texCache.set(url, t);
  }
  return texCache.get(url);
}

/** Separa una malla multimaterial en una malla por material (sin índices). */
function splitByMaterial(mesh) {
  if (!Array.isArray(mesh.material) || !mesh.geometry.groups.length) return [mesh];
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const pos = g.attributes.position.array;
  const out = [];
  mesh.material.forEach((mat, mi) => {
    const data = [];
    for (const gr of g.groups) if (gr.materialIndex === mi) for (let v = gr.start; v < gr.start + gr.count; v++) data.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    if (!data.length) return;
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(data, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.name = mesh.name + "_" + (mat.name || mi); out.push(m);
  });
  return out;
}

async function convertFBX(job) {
  const root = await loadFBX(job.fbx);
  const tex = job.texture ? await loadTexture(job.texture) : null;
  let meshes = bakeMeshes(root);
  if (job.modular) meshes = meshes.flatMap(splitByMaterial);
  if (job.pick) meshes = meshes.filter((m) => job.pick.some((rule) => new RegExp(rule.match).test(m.name)));
  const parts = meshes.map((m) => {
    const rule = (job.pick || []).find((r) => new RegExp(r.match).test(m.name));
    let role = rule ? rule.role : /charg|mag/i.test(m.name) ? "magazine" : /scope/i.test(m.name) ? "scope" : "body";
    if (job.palette) applyPalette(m, PALETTES[job.palette]);
    else if (tex) m.material = new THREE.MeshStandardMaterial({ name: "palette", map: tex, roughness: 0.65, metalness: 0.15, flatShading: true });
    else fixTextured(m);
    if (rule && rule.raw) m.geometry.translate(...rule.raw);
    return { role, source: job.id, mesh: m };
  });
  // Si el cargador viene separado y lejos del arma (pack con piezas repartidas), se recoloca en el pozo.
  normalize(parts, job.type, job.hint || {});
  if (job.modular) {
    const split = splitLongGun(parts);
    if (split) { const r = roundSockets({ joints: split.joints }); return finish(job.id, job.type, split.parts, { pack: job.pack, joints: r.joints, modular: true }); }
  }
  return finish(job.id, job.type, parts, { pack: job.pack });
}


// ---------- Kit modular (sschocolate): cada pieza trae su origen en su punto de unión y sus propios sockets ----------
// Unidades del pack: cm, +Z hacia la boca, +Y arriba. Se pasa a metros y +X hacia la boca: (x, y, z) -> (z, y, -x) / 100.
const KIT_M = new THREE.Matrix4().makeRotationY(Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(0.01, 0.01, 0.01));
/** Nombre de socket sin el sufijo de duplicado de Blender ("Socket_Barrel001" -> "Barrel", "Socket_Device_01001" -> "Device"). */
const socketKey = (n) => n.replace(/^Socket_/, "").replace(/\d{3}$/, "").replace(/_0\d$/, "");
async function convertKitPart(job) {
  const root = await loadFBX(job.fbx);
  const tex = await loadTexture(job.texture);
  root.updateMatrixWorld(true);
  const sockets = {};
  root.traverse((o) => {
    if (!/^Socket_/.test(o.name)) return;
    const p = o.getWorldPosition(new THREE.Vector3()).applyMatrix4(KIT_M);
    (sockets[socketKey(o.name)] ??= []).push(p.toArray().map((v) => +v.toFixed(4)));
  });
  const seen = new Set();
  const parts = [];
  for (const m of bakeMeshes(root)) {
    m.geometry.applyMatrix4(KIT_M);
    m.geometry.computeBoundingBox();
    const key = m.geometry.boundingBox.min.toArray().concat(m.geometry.boundingBox.max.toArray()).map((v) => v.toFixed(4)).join();
    if (seen.has(key)) continue; // mallas duplicadas en el archivo
    seen.add(key);
    const lens = /Lens/i.test(m.name);
    m.material = lens ? new THREE.MeshStandardMaterial({ name: "Lens", color: 0x4a7a8c, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.45 })
      : new THREE.MeshStandardMaterial({ name: "kit", map: tex, roughness: 0.55, metalness: 0.35, flatShading: true });
    parts.push({ role: lens ? "lens" : "kit", source: job.id, mesh: m });
  }
  const box = boxOf(parts.map((p) => p.mesh));
  const tris = parts.reduce((s, p) => s + p.mesh.geometry.attributes.position.count / 3, 0);
  const glb = await exportGLB(parts);
  return { id: job.id, slot: job.slot, caliber: job.caliber, sockets, profile: profileOf(parts.map((p) => p.mesh), 16), bounds: { min: box.min.toArray().map((v) => +v.toFixed(4)), max: box.max.toArray().map((v) => +v.toFixed(4)) }, triangles: Math.round(tris), glb };
}

window.convertJob = async (job) => (job.kind === "kitpart" ? convertKitPart(job) : job.kind === "obj" ? convertQuaternius(job) : job.kind === "objmulti" ? convertMultiOBJ(job) : convertFBX(job));
window.treeFBX = async (url) => { const root = await loadFBX(url); const out = []; root.traverse((o) => out.push({ n: o.name, t: o.type, p: o.position.toArray().map((v) => +v.toFixed(2)), r: o.rotation.toArray().slice(0, 3).map((v) => +v.toFixed(2)), s: +o.scale.x.toFixed(3), mat: o.isMesh ? [].concat(o.material).map((m) => m.name + (m.map ? "*" : "")) : undefined })); return out; };
window.listFBX = async (url) => { const root = await loadFBX(url); const out = []; root.updateMatrixWorld(true); root.traverse((o) => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); out.push({ name: o.name, min: b.min.toArray().map((v) => +v.toFixed(1)), max: b.max.toArray().map((v) => +v.toFixed(1)) }); } }); return out; };
window.ready = true;
