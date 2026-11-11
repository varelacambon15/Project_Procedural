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

const TARGET_LENGTH = { pistol: 0.22, revolver: 0.26, smg: 0.5, rifle: 0.9, bullpup: 0.75, shotgun: 1.0, sniper: 1.2, launcher: 1.1, flamethrower: 0.95, accessory: null };

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
  const k = TARGET_LENGTH[type] ? TARGET_LENGTH[type] / len : hint?.scale ?? 1;
  const c = box.getCenter(new THREE.Vector3());
  const t = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  for (const m of all) { m.geometry.applyMatrix4(t); m.geometry.computeVertexNormals(); m.geometry.computeBoundingBox(); }
  return k;
}

// Puntos de anclaje derivados de la geometría montada.
function sockets(parts) {
  const S = {};
  const body = parts.find((p) => p.role === "body" || p.role === "frame");
  const front = parts.filter((p) => ["body", "slide", "barrel"].includes(p.role));
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
  if (body) { const bb = boxOf(parts.filter((p) => ["body", "slide", "frame"].includes(p.role)).map((p) => p.mesh)); S.top = { pos: [(bb.min.x + bb.max.x) / 2, bb.max.y, 0] }; }
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

async function finish(id, type, parts, extra = {}) {
  const meta = roundSockets(sockets(parts));
  const tris = parts.reduce((s, p) => s + p.mesh.geometry.attributes.position.count / 3, 0);
  const glb = await exportGLB(parts);
  return { id, type, parts: parts.map((p) => ({ role: p.role, node: p.mesh.name, source: p.source || "" })), ...meta, triangles: Math.round(tris), ...extra, glb };
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
  misc: { M1911BodyMat: ["#2d3034", 0.45, 0.6], M1911InsideMat: ["#55585c", 0.5, 0.5], M1911HandleMat: ["#5a3a24", 0.8, 0.05], Deagle: ["#6b6e72", 0.4, 0.65] },
};
function applyPalette(mesh, pal) {
  if (!pal) return;
  const fix = (m) => { const p = pal[m.name]; return p ? flatMaterial(m.name, p[0], { roughness: p[1], metalness: p[2] }) : m; };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material);
}
function fixTextured(mesh) {
  const fix = (m) => { if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.magFilter = THREE.NearestFilter; } m.flatShading = true; m.color?.set?.(0xffffff); const s = new THREE.MeshStandardMaterial({ name: m.name, map: m.map || null, color: m.map ? 0xffffff : m.color, roughness: 0.6, metalness: 0.2, flatShading: true }); return s; };
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

async function convertFBX(job) {
  const root = await loadFBX(job.fbx);
  const tex = job.texture ? await loadTexture(job.texture) : null;
  let meshes = bakeMeshes(root);
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
  return finish(job.id, job.type, parts, { pack: job.pack });
}

window.convertJob = async (job) => (job.kind === "obj" ? convertQuaternius(job) : convertFBX(job));
window.listFBX = async (url) => { const root = await loadFBX(url); const out = []; root.updateMatrixWorld(true); root.traverse((o) => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); out.push({ name: o.name, min: b.min.toArray().map((v) => +v.toFixed(1)), max: b.max.toArray().map((v) => +v.toFixed(1)) }); } }); return out; };
window.ready = true;
