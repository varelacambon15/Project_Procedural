// Banco de armero: genera armas, las monta en 3D y muestra su ficha.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { WeaponGenerator, TYPE_INFO, type BaseType } from "../weapons/generator";
import { archName, damageText, effectDesc, effectName, paintName, partLabel, rarityName, roleName, typeName } from "../weapons/labels";
import { setLang, getLang } from "../i18n";
import { WeaponAssembler, type AssembledWeapon } from "../weapons/assembler";
import type { Manifest, PartRole, StatKey, WeaponSpec } from "../weapons/types";
type WeaponType = BaseType;
setLang(getLang());

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
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0xcfc9bd);
    sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(1, 2, 3); sc.add(dl);
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
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x2b2d31);
    sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.3)); const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(1, 2, 3); sc.add(dl);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.2); rim.position.set(-2, 1, -3); sc.add(rim); // luz de borde
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
      { const txt = `base ${spec.lineage?.base} · parecido ${Math.round((spec.lineage?.similarity ?? 1) * 100)}% · ${spec.paint.id} · cambios: ${spec.lineage?.changes.join(", ") || "—"}`;
        const lines: string[] = []; let line = "";
        for (const w of txt.split(" ")) { const t = line ? line + " " + w : w; if (g.measureText(t).width > CW - 28 && line) { lines.push(line); line = w; } else line = t; }
        lines.push(line); lines.slice(-3).forEach((l, k, arr) => g.fillText(l, x + 14, y + CH - 10 - (arr.length - 1 - k) * 14)); }
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
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x3a3d42);
    sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.3)); const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(1, 2, 3); sc.add(dl);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.2); rim.position.set(-2, 1, -3); sc.add(rim);
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
  (window as unknown as Record<string, unknown>).__bench = { simSheet, showcase, sheet, show, setType, toggleExplode, get current() { return current?.spec; }, setView: (y: number, p: number) => { yaw = y; pitch = p; idle = -1e9; } };
}
boot().catch((e) => { $("loading").textContent = `No se pudieron cargar las armas: ${e.message}`; console.error(e); });
