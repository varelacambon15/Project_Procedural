// Banco de armero: genera armas, las monta en 3D y muestra su ficha.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WeaponGenerator, TYPE_INFO, type BaseType } from "../weapons/generator";
import { archName, damageText, effectDesc, effectName, paintName, partLabel, rarityName, roleName, typeName } from "../weapons/labels";
import { setLang, getLang } from "../i18n";
import { WeaponAssembler, type AssembledWeapon } from "../weapons/assembler";
import type { Manifest, PartRole, RarityId, StatKey, WeaponSpec } from "../weapons/types";
import type { PEra } from "../weapons/pistolgen";
type WeaponType = BaseType;
setLang(getLang());

/** Luz de estudio de las hojas: fondo gris medio, relleno, luz principal y contorno fuerte por detrás (las armas negras
 * se recortan del fondo en vez de perderse). */
function studioLights(sc: THREE.Scene, r: THREE.WebGLRenderer, bg = 0x4a4e55) {
  sc.background = new THREE.Color(bg);
  sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  sc.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.5));
  const dl = new THREE.DirectionalLight(0xffffff, 1.9); dl.position.set(1, 2, 3); sc.add(dl);
  const rim = new THREE.DirectionalLight(0xdff0ff, 2.6); rim.position.set(-1.5, 1.5, -3); sc.add(rim);
  const top = new THREE.DirectionalLight(0xffffff, 0.9); top.position.set(0, 4, 0.5); sc.add(top);
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ASSETS = "./weapons/";

const ROLE_NAME = (r: PartRole) => roleName(r);
const STAT_DEF: [StatKey, string, (v: number, s: WeaponSpec) => string][] = [
  ["cadencia", "Cadencia", (v) => `${Math.round(v)}/min`],
  ["precision", "Precisión", (v) => `${Math.round(v)}`],
  ["alcance", "Alcance", (v) => `${Math.round(v)} m`],
  ["manejo", "Manejo", (v) => `${Math.round(v)}`],
  ["cargador", "Cargador", (v) => `${Math.round(v)}`],
];

// ---------- Escena ----------
const viewer = $("viewer");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
viewer.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
// Entorno de estudio para los reflejos del metal + luz principal cálida y contraluz frío.
renderer.toneMappingExposure = 0.95;
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a2018, 0.35));
const key = new THREE.DirectionalLight(0xfff0dd, 1.6); key.position.set(2, 4, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0xa9c8ff, 1.1); rim.position.set(-3, 1.5, -2.5); scene.add(rim);
const rarityLight = new THREE.PointLight(0xffffff, 0.5, 4); rarityLight.position.set(0, -0.3, 0.8); scene.add(rarityLight);

let yaw = -0.5, pitch = 0.15, dist = 1, dragging = false, lastX = 0, lastY = 0, idle = 0;
let exploded = 0, explodeTarget = 0;
const canvas = renderer.domElement;
canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e) => { if (!dragging) return; yaw -= (e.clientX - lastX) * 0.008; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - lastY) * 0.006, -1.2, 1.2); lastX = e.clientX; lastY = e.clientY; idle = 0; });
canvas.addEventListener("pointerup", () => { dragging = false; });
canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom + e.deltaY * 0.001, 0.5, 2.5); }, { passive: false });
let zoom = 1;

// ---------- Estado ----------
let gen: WeaponGenerator, asm: WeaponAssembler;
let current: { spec: WeaponSpec; built: AssembledWeapon } | null = null;
let typeFilter: WeaponType | null = null;
let token = 0;

async function show(seed: number) {
  const my = ++token;
  const spec = gen.generate(seed, typeFilter ?? undefined);
  $("loading").hidden = false;
  const built = await asm.assemble(spec);
  if (my !== token) return; // llegó otra petición mientras cargaba
  if (current) scene.remove(current.built.group);
  scene.add(built.group);
  current = { spec, built };
  dist = built.length * (built.length > 0.6 ? 2.15 : 2.7) + 0.08;
  $("loading").hidden = true;
  render(spec);
}

function render(s: WeaponSpec) {
  document.documentElement.style.setProperty("--rar", s.rarity.color);
  rarityLight.color.set(s.rarity.color);
  $("rarity").textContent = rarityName(s);
  $("name").textContent = s.name;
  $("type").textContent = `${typeName(s.type)} · ${archName(s)}`;
  $("level").textContent = String(s.level);
  $("seed").textContent = String(s.seed);
  $("damage").innerHTML = damageText(s);
  const base = TYPE_INFO[s.type as keyof typeof TYPE_INFO].base;
  $("stats").innerHTML = STAT_DEF.map(([k, n, f]) => {
    const pct = THREE.MathUtils.clamp((s.stats[k] / (k === "precision" || k === "manejo" ? 100 : base[k] * 1.6)) * 100, 4, 100);
    return `<span class="k">${n}</span><span class="meter"><i style="width:${pct}%"></i></span><span class="v">${f(s.stats[k], s)}</span>`;
  }).join("");
  $("effects").innerHTML = s.effects.length
    ? s.effects.map((f) => `<div class="effect"><span class="ico" style="color:${f.color}">${f.icon}</span><div><b style="color:${f.color}">${effectName(f)}</b><small>${effectDesc(f)}</small></div></div>`).join("")
    : `<span class="none">Sin efectos especiales. Chatarra fiable.</span>`;
  const rows = current!.built.parts.map((p) => {
    const note = p.role === "barrel" && s.barrelLength !== 1 ? ` · longitud ×${s.barrelLength.toFixed(2)}` : (p.role === "body" || p.role === "slide") && s.paint.color ? ` · ${paintName(s.paint).toLowerCase()}` : "";
    return `<li><span class="slot">${ROLE_NAME(p.role)}</span><span><span class="src">${partLabel(gen.byId, p.from.id)}</span> <small>${p.from.pack}</small>${note}</span></li>`;
  });
  $("parts").innerHTML = rows.join("");
  const callouts = $("callouts");
  callouts.innerHTML = current!.built.parts.map((p, i) => `<div class="callout" data-i="${i}">${ROLE_NAME(p.role)} · <b>${partLabel(gen.byId, p.from.id)}</b></div>`).join("");
}

function placeCallouts() {
  if (!current) return;
  const rect = viewer.getBoundingClientRect();
  for (const el of $("callouts").children as HTMLCollectionOf<HTMLElement>) {
    const p = current.built.parts[Number(el.dataset.i)];
    const b = new THREE.Box3().setFromObject(p.object), pos = b.getCenter(new THREE.Vector3());
    pos.y = b.max.y; pos.project(camera);
    el.style.left = `${(pos.x * 0.5 + 0.5) * rect.width}px`;
    el.style.top = `${(-pos.y * 0.5 + 0.5) * rect.height - 4}px`;
    el.style.opacity = exploded > 0.6 ? "1" : "0";
  }
}

// ---------- Controles ----------
function buildTypeButtons() {
  const nav = $("types");
  const opts: (WeaponType | null)[] = [null, ...gen.types];
  nav.innerHTML = opts.map((t) => `<button type="button" data-t="${t ?? ""}" aria-pressed="${t === typeFilter}">${t ? typeName(t) : "All"}</button>`).join("");
  nav.onclick = (e) => { const b = (e.target as HTMLElement).closest("button"); if (!b) return; setType((b.dataset.t || null) as WeaponType | null); };
}
function setType(t: WeaponType | null) { typeFilter = t; buildTypeButtons(); newWeapon(); }
function cycleType(d: number) { const opts: (WeaponType | null)[] = [null, ...gen.types]; setType(opts[(opts.indexOf(typeFilter) + d + opts.length) % opts.length]); }
const newWeapon = () => show(Math.floor(Math.random() * 999999));
function toggleExplode() { explodeTarget = explodeTarget ? 0 : 1; $("explode").firstChild!.textContent = explodeTarget ? "Montar" : "Desmontar"; }
$("gen").addEventListener("click", newWeapon);
$("explode").addEventListener("click", toggleExplode);
addEventListener("keydown", (e) => { if (e.code === "KeyG") newWeapon(); if (e.code === "KeyD") toggleExplode(); });

let padPrev: boolean[] = [];
function pollPad(dt: number) {
  const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
  if (!pad) return;
  const pressed = pad.buttons.map((b) => b.pressed);
  const edge = (i: number) => pressed[i] && !padPrev[i];
  if (edge(0)) newWeapon();
  if (edge(2)) toggleExplode();
  if (edge(4)) cycleType(-1);
  if (edge(5)) cycleType(1);
  const rx = pad.axes[2] ?? 0, ry = pad.axes[3] ?? 0;
  if (Math.abs(rx) > 0.15) { yaw -= rx * dt * 2.5; idle = 0; }
  if (Math.abs(ry) > 0.15) { pitch = THREE.MathUtils.clamp(pitch + ry * dt * 1.8, -1.2, 1.2); idle = 0; }
  padPrev = pressed;
}

function resize() { const r = viewer.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(viewer);

const clock = new THREE.Clock();
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  idle += dt;
  pollPad(dt);
  if (!dragging && idle > 2.5 && !reduce) yaw += dt * 0.25;
  exploded += (explodeTarget - exploded) * Math.min(1, dt * 7);
  if (current) for (const p of current.built.parts) p.object.position.copy(p.base).addScaledVector(p.explode, exploded);
  const d = dist * zoom * (1 + 0.35 * exploded);
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
  camera.lookAt(0, (current?.built.length ?? 0) * 0.08 * exploded, 0);
  renderer.render(scene, camera);
  placeCallouts();
  requestAnimationFrame(frame);
}

async function boot() {
  const manifest: Manifest = await (await fetch(ASSETS + "manifest.json")).json();
  const manifestRef = manifest;
  gen = new WeaponGenerator(manifest);
  asm = new WeaponAssembler(gen, ASSETS);
  buildTypeButtons();
  resize();
  frame();
  const q = new URLSearchParams(location.search);
  const t = q.get("type") as WeaponType | null;
  if (t && gen.types.includes(t)) { typeFilter = t; buildTypeButtons(); }
  await show(Number(q.get("seed")) || 4127);
  // Hoja de contacto (revisión visual): n armas despiezadas, cada una en perfil, tres cuartos y vista de empuñadura.
  const sheet = async (n: number, start = 1, types: string[] = ["rifle", "smg", "shotgun", "sniper", "lmg"], layout = "modular-long", pack = "") => {
    const CW = 220, CH = 110, cols = 3, rows = n;
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(CW, CH); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); studioLights(sc, r, 0x4a4e55);
    const out = document.createElement("canvas"); out.width = CW * cols; out.height = CH * rows; const g = out.getContext("2d")!;
    const names: string[] = [];
    let seed = start, i = 0;
    while (i < n) {
      const spec = gen.generate(seed++, types[seed % types.length] as never);
      if (spec.layout !== layout) continue;
      if (pack && gen.byId.get(spec.parts[0].from)?.pack !== pack) continue;
      const built = await asm.assemble(spec); sc.add(built.group);
      const views: [number, number][] = [[0, 0], [-0.75, 0.25], [-0.35, -0.75]];
      views.forEach(([yaw, pitch], v) => {
        built.group.rotation.set(pitch, yaw, 0);
        const b = new THREE.Box3().setFromObject(built.group), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
        const half = Math.max(sz.x / 2 * CH / CW, sz.y / 2) * 1.1;
        const cam = new THREE.OrthographicCamera(-half * CW / CH, half * CW / CH, half, -half, -10, 10); cam.position.set(c.x, c.y, c.z + 3); cam.lookAt(c);
        r.render(sc, cam); g.drawImage(r.domElement, v * CW, i * CH);
      });
      sc.remove(built.group);
      g.fillStyle = "#222"; g.font = "11px monospace";
      const lbl = `${i + 1}. ${spec.parts.filter((p) => ["receiver", "stock", "grip", "front"].includes(p.role)).map((p) => p.role[0].toUpperCase() + ":" + p.from.replace(/^[wk]-/, "")).join(" ")} ${spec.optic ?? ""} ${spec.muzzle ?? ""}`;
      g.fillText(lbl, 4, i * CH + 12); names.push(lbl);
      i++;
    }
    return { url: out.toDataURL("image/png"), names };
  };
  // Escaparate: armas grandes en tres cuartos, con nombre y rareza (para enseñar resultados).
  const showcase = async (picks: { type: string; layout?: string; cross?: boolean; start: number; need?: string }[]) => {
    const CW = 640, CH = 300;
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(CW, CH); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); studioLights(sc, r, 0x4a4e55);
    const out = document.createElement("canvas"); out.width = CW * 2; out.height = CH * Math.ceil(picks.length / 2); const g = out.getContext("2d")!;
    for (const [i, pk] of picks.entries()) {
      let spec = gen.generate(pk.start, pk.type as never);
      for (let s = pk.start; s < pk.start + 3000; s++) {
        const w = gen.generate(s, pk.type as never);
        const packs = new Set(w.parts.map((p) => gen.byId.get(p.from)?.pack ?? "kit"));
        if ((!pk.layout || w.layout === pk.layout) && (!pk.cross || packs.size > 1) && (!pk.need || JSON.stringify(w).includes(pk.need))) { spec = w; break; }
      }
      const built = await asm.assemble(spec); sc.add(built.group);
      built.group.rotation.set(0.12, -0.5, 0);
      const b = new THREE.Box3().setFromObject(built.group), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      const half = Math.max((sz.x / 2) * CH / CW, sz.y / 2) * 1.25;
      const cam = new THREE.OrthographicCamera(-half * CW / CH, half * CW / CH, half, -half, -10, 10); cam.position.set(c.x, c.y - half * 0.08, c.z + 3); cam.lookAt(c.x, c.y - half * 0.08, c.z);
      r.render(sc, cam); const x = (i % 2) * CW, y = Math.floor(i / 2) * CH; g.drawImage(r.domElement, x, y);
      sc.remove(built.group);
      g.fillStyle = spec.rarity.color; g.font = "bold 22px sans-serif"; g.fillText(spec.name, x + 14, y + 32);
      g.fillStyle = "#bbb"; g.font = "14px sans-serif"; g.fillText(`${spec.rarity.id} · ${spec.type} · ${spec.fireMode}`, x + 14, y + 54);
      g.fillStyle = "#888"; g.font = "12px monospace";
      { const txt = `base ${spec.lineage?.base} · era ${spec.era ?? "?"}${spec.modLevel ? ` · mod ${spec.modLevel}` : ""} · parecido ${Math.round((spec.lineage?.similarity ?? 1) * 100)}% · ${spec.paint.id} · cambios: ${spec.lineage?.changes.join(", ") || "—"}`;
        const lines: string[] = []; let line = "";
        for (const w of txt.split(" ")) { const t = line ? line + " " + w : w; if (g.measureText(t).width > CW - 28 && line) { lines.push(line); line = w; } else line = t; }
        lines.push(line); lines.slice(-3).forEach((l, k, arr) => g.fillText(l, x + 14, y + CH - 10 - (arr.length - 1 - k) * 14)); }
    }
    return out.toDataURL("image/png");
  };
  // Hoja de lote en tres vistas: n armas que cumplen el filtro, dos por fila, cada una en perfil, tres cuartos y desde
  // abajo, con etiqueta (base, parecido, era, añadidos). Para revisar lotes grandes (pistolas modulares, culatas…).
  const lotSheet = async (n: number, types: string[], start = 1, layout = "", need = "", sort = "", rarity = "", dupes = false) => {
    const VW = 300, VH = 165, HEAD = 58, per = 2;
    const specs: WeaponSpec[] = [];
    for (let s = start; s < start + 40000 && specs.length < n; s++) {
      const w = gen.generate(s, types[s % types.length] as never, (rarity || undefined) as RarityId | undefined);
      if ((layout && w.layout !== layout) || (need && !JSON.stringify(w).includes(need))) continue;
      // (sin repetir base en la hoja, como en los cofres)
      if (!dupes && specs.some((x) => (x.lineage?.base ?? x.parts[0].from) === (w.lineage?.base ?? w.parts[0].from))) continue;
      specs.push(w);
    }
    if (sort === "era") specs.sort((a, b) => String(a.era).localeCompare(String(b.era)));
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(VW, VH); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); studioLights(sc, r, 0x4a4e55);
    const CW = VW * 3 + 12, CH = VH + HEAD;
    const out = document.createElement("canvas"); out.width = CW * per; out.height = CH * Math.ceil(specs.length / per); const g = out.getContext("2d")!;
    g.fillStyle = "#15171a"; g.fillRect(0, 0, out.width, out.height);
    for (const [i, spec] of specs.entries()) {
      const x0 = (i % per) * CW, y0 = Math.floor(i / per) * CH;
      g.fillStyle = "#1e2023"; g.fillRect(x0, y0, CW - 12, HEAD);
      g.fillStyle = spec.rarity.color; g.font = "bold 17px sans-serif";
      g.fillText(`${i + 1}. ${spec.name} · ${spec.type} · era ${spec.era ?? "?"} · parecido ${Math.round((spec.lineage?.similarity ?? 1) * 100)} %`, x0 + 8, y0 + 20);
      g.fillStyle = "#c8c8c8"; g.font = "13px sans-serif";
      const ch = spec.lineage?.changes ?? [];
      g.fillText(`base ${spec.lineage?.base ?? spec.parts[0].from} · ${ch.length} cambios`, x0 + 8, y0 + 38);
      g.fillStyle = "#9aa"; g.fillText(`añadidos: ${ch.join(", ") || "—"}`.slice(0, 150), x0 + 8, y0 + 53);
      const built = await asm.assemble(spec); sc.add(built.group);
      const views: [number, number][] = [[0, 0], [-0.7, 0.22], [-0.35, -0.7]];
      views.forEach(([yaw, pitch], v) => {
        built.group.rotation.set(pitch, yaw, 0);
        const b = new THREE.Box3().setFromObject(built.group), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
        const half = Math.max((sz.x / 2) * VH / VW, sz.y / 2) * 1.12;
        const cam = new THREE.OrthographicCamera(-half * VW / VH, half * VW / VH, half, -half, -10, 10); cam.position.set(c.x, c.y, c.z + 3); cam.lookAt(c);
        r.render(sc, cam); g.drawImage(r.domElement, x0 + v * VW, y0 + HEAD);
      });
      sc.remove(built.group);
    }
    return out.toDataURL("image/png");
  };
  /**
   * Hoja de criba: cada arma de modelo tal cual viene (su .glb, sin variar), 4 por fila, con su id, pack y tipo.
   * `from`/`count` paginan la lista (sin excluidas, donantes ni accesorios).
   */
  const modelSheet = async (from = 0, count = 24, ids: string[] | null = null) => {
    const list = ids ? ids.map((id) => manifestRef.weapons.find((w) => w.id === id)!).filter(Boolean) : manifestRef.weapons.filter((w) => !w.excluded && !w.donor && w.type !== "accessory").slice(from, from + count);
    const VW = 420, VH = 200, HEAD = 34, per = 4;
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(VW, VH); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); studioLights(sc, r, 0x4a4e55);
    const out = document.createElement("canvas"); out.width = VW * per; out.height = (VH + HEAD) * Math.ceil(list.length / per); const g = out.getContext("2d")!;
    g.fillStyle = "#15171a"; g.fillRect(0, 0, out.width, out.height);
    const loader = new GLTFLoader();
    for (const [i, w] of list.entries()) {
      const x0 = (i % per) * VW, y0 = Math.floor(i / per) * (VH + HEAD);
      try {
        const gl = await loader.loadAsync(ASSETS + w.file); const grp = gl.scene; grp.rotation.set(0.1, -0.35, 0); sc.add(grp);
        const b = new THREE.Box3().setFromObject(grp), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
        const half = Math.max((sz.x / 2) * VH / VW, sz.y / 2) * 1.12;
        const cam = new THREE.OrthographicCamera(-half * VW / VH, half * VW / VH, half, -half, -10, 10); cam.position.set(c.x, c.y, c.z + 3); cam.lookAt(c);
        r.render(sc, cam); g.drawImage(r.domElement, x0, y0 + HEAD); sc.remove(grp);
      } catch { /* sin modelo */ }
      g.fillStyle = "#1e2023"; g.fillRect(x0, y0, VW - 4, HEAD);
      g.fillStyle = "#e8e8e8"; g.font = "bold 15px sans-serif"; g.fillText(`${from + i + 1}. ${w.id}`, x0 + 8, y0 + 15);
      g.fillStyle = "#999"; g.font = "12px sans-serif"; g.fillText(`${w.label} · ${w.type} · ${w.pack}${w.era ? " · " + w.era : ""}`, x0 + 8, y0 + 29);
    }
    return out.toDataURL("image/png");
  };
  /** Inspección: cajas de cada pieza montada de la primera arma que cumpla el filtro (depurar piezas flotantes). */
  const inspect = async (type: string, need: string, start = 1) => {
    for (let s2 = start; s2 < start + 20000; s2++) {
      const w = gen.generate(s2, type as never);
      if (!JSON.stringify(w).includes(need)) continue;
      const built = await asm.assemble(w); built.group.updateMatrixWorld(true);
      return { seed: s2, tweaks: w.tweaks, parts: built.parts.map((p) => { const b = new THREE.Box3().setFromObject(p.object); return { role: p.role, id: p.from.id, min: b.min.toArray().map((v) => +v.toFixed(3)), max: b.max.toArray().map((v) => +v.toFixed(3)) }; }) };
    }
    return null;
  };
  // ---------- Hojas del prompt 06 ----------
  /** Escena de estudio para las hojas (fondo gris, luz suave, borde frío). */
  const studio = (VW: number, VH: number, bg = 0x4a4e55) => {
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(VW, VH); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); studioLights(sc, r, bg);
    return { r, sc };
  };
  /** Cámara ortográfica centrada en el arma; `half` fija la escala (misma escala en toda la hoja). */
  const shoot = (st: { r: THREE.WebGLRenderer; sc: THREE.Scene }, obj: THREE.Object3D, VW: number, VH: number, yaw: number, pitch: number, half?: number, center?: THREE.Vector3) => {
    obj.rotation.set(pitch, yaw, 0);
    const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(new THREE.Vector3()), c = center ?? b.getCenter(new THREE.Vector3());
    const hh = half ?? Math.max((sz.x / 2) * VH / VW, sz.y / 2) * 1.12;
    const cam = new THREE.OrthographicCamera(-hh * VW / VH, hh * VW / VH, hh, -hh, -10, 10); cam.position.set(c.x, c.y, c.z + 3); cam.lookAt(c);
    st.r.render(st.sc, cam); return st.r.domElement;
  };
  /** Silueta plana (negra sobre blanco) de un arma montada. */
  const silhouetteOf = (obj: THREE.Object3D) => {
    const saved: [THREE.Mesh, THREE.Material | THREE.Material[]][] = []; const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
    obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { saved.push([m, m.material]); m.material = black; } });
    return () => { for (const [m, mt] of saved) m.material = mt; };
  };
  const wrapText = (g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number, max = 3) => { let line = "", n = 0; for (const word of text.split(" ")) { const t = line ? line + " " + word : word; if (g.measureText(t).width > w && line) { if (n < max - 1) g.fillText(line, x, y + n * lh); n++; line = word; } else line = t; } if (n < max) g.fillText(line, x, y + n * lh); };
  /**
   * Hoja de decisión (06-A): por cada base, una fila con el original y sus variantes a ~90, ~80 y ~70 % de parecido,
   * en las mismas vistas (perfil y tres cuartos) y a la misma escala, más la silueta sola de cada una.
   */
  const decisionSheet = async (bases: { arch: string; era: string }[], targets = [1, 0.9, 0.8, 0.7], seed = 7) => {
    const CW = 360, PH = 190, QH = 130, SH = 110, HEAD = 64, ROWH = HEAD + PH + QH + SH + 10, LBL = 150;
    const rows = bases.map((b, bi) => targets.map((t, ti) => gen.generatePistolAt(seed + bi * 101 + ti * 7, b.arch, b.era as PEra, t === 1 ? 1 : t, "comun")));
    // Escala común: la del arma más larga de la hoja
    const builts = await Promise.all(rows.map((row) => Promise.all(row.map((w) => asm.assemble(w)))));
    let maxLen = 0, maxH = 0; for (const row of builts) for (const bw of row) { bw.group.rotation.set(0, 0, 0); const sz = new THREE.Box3().setFromObject(bw.group).getSize(new THREE.Vector3()); maxLen = Math.max(maxLen, sz.x); maxH = Math.max(maxH, sz.y); }
    // Misma escala en toda la hoja, que quepa el arma más larga y la más alta
    const halfP = Math.max((maxLen / 2) * (PH / CW), maxH / 2) * 1.1, halfQ = Math.max((maxLen / 2) * (QH / CW), maxH / 2) * 1.2, halfS = Math.max((maxLen / 2) * (SH / CW), maxH / 2) * 1.08;
    const st = studio(CW, PH), stQ = studio(CW, QH), stS = studio(CW, SH, 0xf2f2f2);
    const out = document.createElement("canvas"); out.width = LBL + CW * targets.length; out.height = ROWH * rows.length + 40; const g = out.getContext("2d")!;
    g.fillStyle = "#15171a"; g.fillRect(0, 0, out.width, out.height);
    g.fillStyle = "#ddd"; g.font = "bold 20px sans-serif"; g.fillText(`Hoja de decisión · objetivo de parecido por columna: ${targets.map((t) => (t === 1 ? "base" : `~${Math.round(t * 100)} %`)).join(" · ")} · misma escala en toda la hoja`, 12, 27);
    for (const [ri, row] of rows.entries()) {
      const y0 = 40 + ri * ROWH;
      g.fillStyle = "#1e2023"; g.fillRect(0, y0, out.width, ROWH - 10);
      g.fillStyle = "#e8e8e8"; g.font = "bold 18px sans-serif"; g.fillText(bases[ri].arch, 12, y0 + 30);
      g.fillStyle = "#aaa"; g.font = "14px sans-serif"; g.fillText(`era ${bases[ri].era}`, 12, y0 + 52); g.fillText(`familia ${row[0].tweaks.pistol?.family}`, 12, y0 + 72);
      for (const [ci, w] of row.entries()) {
        const x0 = LBL + ci * CW, bw = builts[ri][ci];
        const sim = w.lineage?.similarity ?? 1, ch = w.lineage?.changes ?? [];
        g.fillStyle = ci === 0 ? "#9fd39f" : "#e0e0e0"; g.font = "bold 16px sans-serif";
        g.fillText(ci === 0 ? "BASE (original)" : `objetivo ~${Math.round(targets[ci] * 100)} % → real ${Math.round(sim * 100)} %`, x0 + 8, y0 + 20);
        g.fillStyle = "#9aa"; g.font = "12px sans-serif"; wrapText(g, ci === 0 ? `${w.name}` : `${ch.length} cambios: ${ch.join(", ")}`, x0 + 8, y0 + 38, CW - 16, 14, 2);
        st.sc.add(bw.group); g.drawImage(shoot(st, bw.group, CW, PH, 0, 0, halfP), x0, y0 + HEAD); st.sc.remove(bw.group);
        stQ.sc.add(bw.group); g.drawImage(shoot(stQ, bw.group, CW, QH, -0.6, 0.25, halfQ), x0, y0 + HEAD + PH); stQ.sc.remove(bw.group);
        const restore = silhouetteOf(bw.group); stS.sc.add(bw.group); g.drawImage(shoot(stS, bw.group, CW, SH, 0, 0, halfS), x0, y0 + HEAD + PH + QH); stS.sc.remove(bw.group); restore();
        g.strokeStyle = "#2c2f33"; g.strokeRect(x0 + 0.5, y0 + 0.5, CW - 1, ROWH - 11);
      }
    }
    return out.toDataURL("image/png");
  };
  /**
   * Hoja de variedad (06-B): un lote generado como el botín (generateDistinct), con el parecido contra su base y
   * contra el arma más cercana del lote (en rojo si pasa de `redAt`), y la matriz de parecido del lote al final.
   */
  const varietySheet = async (n: number, types: string[], start = 1, redAt = 0.92, distinct = true, rarity = "", need = "") => {
    const lot: WeaponSpec[] = [];
    for (let s = start; lot.length < n && s < start + 20000; s++) {
      const t = types[lot.length % types.length] as BaseType;
      const w = distinct ? gen.generateDistinct(s * 104729, t, lot, (rarity || undefined) as RarityId | undefined) : gen.generate(s, t, (rarity || undefined) as RarityId | undefined);
      if (w.layout !== "modular-pistol" || (need && !JSON.stringify(w).includes(need))) continue;
      lot.push(w);
    }
    const M = gen.lotMatrix(lot);
    const VW = 300, VH = 165, HEAD = 74, per = 2, CW = VW * 3 + 12, CH = VH + HEAD;
    const MAT = Math.min(900, 22 * n + 60);
    const out = document.createElement("canvas"); out.width = CW * per; out.height = CH * Math.ceil(lot.length / per) + MAT + 60; const g = out.getContext("2d")!;
    g.fillStyle = "#15171a"; g.fillRect(0, 0, out.width, out.height);
    const st = studio(VW, VH);
    let nearCount = 0;
    for (const [i, spec] of lot.entries()) {
      const x0 = (i % per) * CW, y0 = Math.floor(i / per) * CH;
      const row = M[i].map((v, j) => (j === i ? -1 : v)); const nb = Math.max(...row), nj = row.indexOf(nb);
      if (nb > redAt) nearCount++;
      g.fillStyle = "#1e2023"; g.fillRect(x0, y0, CW - 12, HEAD);
      g.fillStyle = spec.rarity.color; g.font = "bold 16px sans-serif";
      g.fillText(`${i + 1}. ${spec.name} · ${spec.type} · ${spec.fireMode}${spec.burst ? " ×" + spec.burst : ""} · era ${spec.era ?? "?"}`, x0 + 8, y0 + 19);
      g.font = "bold 14px sans-serif"; g.fillStyle = "#cfd8cf"; g.fillText(`vs base ${Math.round((spec.lineage?.similarity ?? 1) * 100)} %`, x0 + 8, y0 + 38);
      g.fillStyle = nb > redAt ? "#ff5a5a" : "#cfd8cf"; g.fillText(`vs más cercana (#${nj + 1}) ${Math.round(nb * 100)} %${nb > redAt ? "  ← casi copia" : ""}`, x0 + 120, y0 + 38);
      const d = spec.tweaks.pistol!; g.fillStyle = "#9aa"; g.font = "12px sans-serif";
      g.fillText(`base ${spec.lineage?.base} · ${d.family}${d.cyl ? " · " + d.cyl.cal : ""} · cargador ${d.mag.kind}${spec.tweaks.pstock ? " · culata " + spec.tweaks.pstock.kind : ""}`, x0 + 8, y0 + 54);
      wrapText(g, `cambios: ${(spec.lineage?.changes ?? []).join(", ") || "—"}`, x0 + 8, y0 + 68, CW - 30, 13, 1);
      const built = await asm.assemble(spec); st.sc.add(built.group);
      ([[0, 0], [-0.7, 0.22], [-0.35, -0.7]] as [number, number][]).forEach(([yaw, pitch], v) => g.drawImage(shoot(st, built.group, VW, VH, yaw, pitch), x0 + v * VW, y0 + HEAD));
      st.sc.remove(built.group);
    }
    // Matriz de parecido del lote (verde bajo, rojo por encima de redAt)
    const my = CH * Math.ceil(lot.length / per) + 20, cell = Math.floor((MAT - 60) / n);
    g.fillStyle = "#ddd"; g.font = "bold 18px sans-serif"; g.fillText(`Matriz de parecido del lote (${n} armas): ${nearCount} con alguna > ${Math.round(redAt * 100)} % (${Math.round((nearCount / n) * 100)} %)`, 12, my + 10);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = M[i][j], x = 50 + j * cell, y = my + 30 + i * cell;
      g.fillStyle = i === j ? "#333" : v > redAt ? "#d33" : `hsl(${Math.round(120 - Math.max(0, Math.min(1, (v - 0.55) / 0.37)) * 100)},55%,${30 + Math.round(v * 20)}%)`;
      g.fillRect(x, y, cell - 1, cell - 1);
      if (cell >= 20 && i !== j) { g.fillStyle = "#fff"; g.font = "9px sans-serif"; g.fillText(String(Math.round(v * 100)), x + 2, y + cell / 2 + 3); }
    }
    g.fillStyle = "#aaa"; g.font = "11px sans-serif"; for (let i = 0; i < n; i++) { g.fillText(String(i + 1), 50 + i * cell + 2, my + 26); g.fillText(String(i + 1), 24, my + 30 + i * cell + cell / 2 + 4); }
    return { url: out.toDataURL("image/png"), near: nearCount, n };
  };
  /**
   * Primeros planos (06-D): armas grandes en tres cuartos y de perfil, con la silueta de un arma real de su categoría
   * (de los modelos del juego) a la misma escala, para comparar proporciones sin copiarla.
   */
  const closeups = async (picks: { arch: string; era: string; target?: number; rarity?: string }[], seed = 3) => {
    const VW = 760, VH = 420, PW = 380, PH = 210, HEAD = 46;
    const realOf = (type: string) => manifestRef.weapons.find((w) => w.type === type && !w.excluded && w.profiles?.body && /m1911|glock|beretta|revolver|python|usp/i.test(w.id)) ?? manifestRef.weapons.find((w) => w.type === type && w.profiles?.body);
    const out = document.createElement("canvas"); out.width = VW + PW; out.height = (VH + HEAD) * picks.length; const g = out.getContext("2d")!;
    g.fillStyle = "#15171a"; g.fillRect(0, 0, out.width, out.height);
    const st = studio(VW, VH), stP = studio(PW, PH);
    for (const [i, pk] of picks.entries()) {
      const w = gen.generatePistolAt(seed + i * 13, pk.arch, pk.era as PEra, pk.target ?? null, (pk.rarity || "rara") as RarityId);
      const y0 = i * (VH + HEAD);
      g.fillStyle = w.rarity.color; g.font = "bold 20px sans-serif"; g.fillText(`${w.name} · ${pk.arch} · era ${pk.era} · ${w.fireMode} · parecido ${Math.round((w.lineage?.similarity ?? 1) * 100)} %`, 10, y0 + 30);
      const built = await asm.assemble(w); st.sc.add(built.group);
      g.drawImage(shoot(st, built.group, VW, VH, -0.55, 0.18), 0, y0 + HEAD);
      st.sc.remove(built.group); stP.sc.add(built.group);
      built.group.rotation.set(0, 0, 0);
      const bsz = new THREE.Box3().setFromObject(built.group).getSize(new THREE.Vector3());
      const half = Math.max((bsz.x / 2) * (PH / PW), bsz.y / 2) * 1.2;
      g.drawImage(shoot(stP, built.group, PW, PH, 0, 0, half), VW, y0 + HEAD);
      stP.sc.remove(built.group);
      // Silueta de un arma real de la categoría, misma escala, debajo
      const real = realOf(w.type);
      g.fillStyle = "#f2f2f2"; g.fillRect(VW, y0 + HEAD + PH, PW, VH - PH);
      if (real?.profiles?.body) {
        const pr = real.profiles.body, sc = PH / (half * 2), N = pr.top.length, cx = VW + PW / 2, cy = y0 + HEAD + PH + (VH - PH) / 2;
        const midX = (pr.x0 + pr.x1) / 2, ys = pr.top.filter((v) => v !== null) as number[], yb = pr.bot.filter((v) => v !== null) as number[], midY = (Math.max(...ys) + Math.min(...yb)) / 2;
        g.save(); g.beginPath(); g.rect(VW, y0 + HEAD + PH, PW, VH - PH); g.clip();
        g.fillStyle = "#555";
        for (let k = 0; k < N; k++) { const t = pr.top[k], b = pr.bot[k]; if (t === null || b === null) continue; const x = cx + (pr.x0 + ((pr.x1 - pr.x0) * k) / N - midX) * sc; g.fillRect(x, cy - (t - midY) * sc, Math.ceil(((pr.x1 - pr.x0) / N) * sc) + 1, (t - b) * sc); }
        g.restore();
        g.fillStyle = "#333"; g.font = "12px sans-serif"; g.fillText(`silueta real de referencia: ${real.label ?? real.id} (misma escala)`, VW + 8, y0 + VH + HEAD - 8);
      }
    }
    return out.toDataURL("image/png");
  };
  // Hoja de parecido (Parte A): armas cerca de cada objetivo de parecido con su base, grandes y en tres vistas.
  const simSheet = async (targets: number[], perTarget: number, types: string[], startSeed = 1) => {
    const VW = 400, VH = 220, HEAD = 70, cols = 3;
    const picks: { spec: WeaponSpec; target: number }[] = [];
    for (const target of targets) {
      const used = new Set<string>(); let ti = 0;
      for (let s = startSeed; s < startSeed + 20000 && picks.filter((p) => p.target === target).length < perTarget; s++) {
        const spec = gen.generate(s, types[ti % types.length] as never);
        if (Math.abs((spec.lineage?.similarity ?? 1) - target) > 0.015 || used.has(spec.parts[0].from)) continue;
        used.add(spec.parts[0].from); picks.push({ spec, target }); ti++;
      }
    }
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(VW, VH); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); studioLights(sc, r, 0x4a4e55);
    const out = document.createElement("canvas"); out.width = VW * cols; out.height = (VH + HEAD) * picks.length; const g = out.getContext("2d")!;
    const wrap = (text: string, x: number, y: number, w: number, lh: number) => { let line = ""; for (const word of text.split(" ")) { const t = line ? line + " " + word : word; if (g.measureText(t).width > w && line) { g.fillText(line, x, y); y += lh; line = word; } else line = t; } g.fillText(line, x, y); return y + lh; };
    for (const [i, { spec, target }] of picks.entries()) {
      const y0 = i * (VH + HEAD);
      g.fillStyle = "#1e2023"; g.fillRect(0, y0, VW * cols, HEAD);
      g.fillStyle = spec.rarity.color; g.font = "bold 20px sans-serif"; g.fillText(`${spec.name}  ·  parecido ${Math.round((spec.lineage?.similarity ?? 1) * 100)} %  (objetivo ~${Math.round(target * 100)} %)`, 12, y0 + 24);
      g.fillStyle = "#c8c8c8"; g.font = "14px sans-serif";
      wrap(`${spec.type} · base ${spec.lineage?.base} · ${spec.lineage?.changes.length} cambios: ${spec.lineage?.changes.join(", ")} · acabado ${spec.paint.id}`, 12, y0 + 46, VW * cols - 24, 17);
      const built = await asm.assemble(spec); sc.add(built.group);
      const views: [number, number][] = [[0, 0], [-0.7, 0.22], [-0.35, -0.7]];
      views.forEach(([yaw, pitch], v) => {
        built.group.rotation.set(pitch, yaw, 0);
        const b = new THREE.Box3().setFromObject(built.group), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
        const half = Math.max((sz.x / 2) * VH / VW, sz.y / 2) * 1.12;
        const cam = new THREE.OrthographicCamera(-half * VW / VH, half * VW / VH, half, -half, -10, 10); cam.position.set(c.x, c.y, c.z + 3); cam.lookAt(c);
        r.render(sc, cam); g.drawImage(r.domElement, v * VW, y0 + HEAD);
      });
      sc.remove(built.group);
    }
    return out.toDataURL("image/png");
  };
  /** Armas largas por código: por cada arquetipo y era, la base (sin cambios) y una variante, en lateral y 3/4. */
  const longSheet = async (picks: { arch: string; era: string; target?: number; rarity?: string }[], seed = 7) => {
    const VW = 420, VH = 200, HEAD = 34, cols = 4;
    const out = document.createElement("canvas"); out.width = VW * cols; out.height = (VH + HEAD) * picks.length; const g = out.getContext("2d")!;
    g.fillStyle = "#15171a"; g.fillRect(0, 0, out.width, out.height);
    const st = studio(VW, VH);
    for (const [i, pk] of picks.entries()) {
      const base = gen.generateLongAt(seed + i * 13, pk.arch, pk.era as never, 1, (pk.rarity || "rara") as RarityId);
      const v = gen.generateLongAt(seed + i * 13 + 5, pk.arch, pk.era as never, pk.target ?? null, (pk.rarity || "rara") as RarityId);
      const y0 = i * (VH + HEAD);
      g.fillStyle = "#c8c8c8"; g.font = "bold 16px sans-serif"; g.fillText(`${pk.arch} · ${pk.era} · base`, 8, y0 + 22);
      g.fillStyle = v.rarity.color; g.fillText(`${v.name} · ${v.type} · ${v.fireMode} · parecido ${Math.round((v.lineage?.similarity ?? 1) * 100)} % · ${(v.lineage?.changes ?? []).join(", ")}`.slice(0, 120), VW * 2 + 8, y0 + 22);
      let col = 0;
      for (const w of [base, v]) {
        const built = await asm.assemble(w); st.sc.add(built.group);
        for (const [yaw, pitch] of [[0, 0], [-0.6, 0.25]] as [number, number][]) { g.drawImage(shoot(st, built.group, VW, VH, yaw, pitch), col * VW, y0 + HEAD); col++; }
        st.sc.remove(built.group);
      }
    }
    return out.toDataURL("image/png");
  };
  /** Coste de un arma montada (informe de rendimiento): mallas, triángulos y llamadas de dibujo de un fotograma. */
  const cost = async (seed: number, type: string, rarity?: string) => {
    const spec = gen.generate(seed, type as never, rarity as never);
    const built = await asm.assemble(spec);
    const sc = new THREE.Scene(); studioLights(sc, renderer, 0x4a4e55);
    sc.add(built.group);
    let meshes = 0, tris = 0;
    built.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { meshes++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    renderer.info.reset();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50); cam.position.set(0, 0, 2); cam.lookAt(0, 0, 0);
    renderer.render(sc, cam);
    const out = { seed, type: spec.type, paint: spec.paint.id, era: spec.era ?? "?", rarity: spec.rarity.id, meshes, triangles: Math.round(tris), drawCalls: renderer.info.render.calls, renderedTris: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    sc.remove(built.group);
    return out;
  };
  (window as unknown as Record<string, unknown>).__bench = { modelSheet, longSheet, inspect, decisionSheet, varietySheet, closeups, lotSheet, simSheet, showcase, sheet, show, cost, setType, toggleExplode, get current() { return current?.spec; }, setView: (y: number, p: number) => { yaw = y; pitch = p; idle = -1e9; } };
}
boot().catch((e) => { $("loading").textContent = `No se pudieron cargar las armas: ${e.message}`; console.error(e); });
