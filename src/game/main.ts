// Proving Grounds / Campo de Pruebas: demo jugable de la Fase 1.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { WeaponGenerator, type BaseType } from "../weapons/generator";
import { WeaponAssembler } from "../weapons/assembler";
import { scrap } from "../weapons/workshop";
import { archName, damageText, effectName, rarityName, typeName } from "../weapons/labels";
import type { Manifest } from "../weapons/types";
import { LANGS, applyStatic, getLang, onLang, setLang, t, type Lang } from "../i18n";
import { Input } from "./input";
import { buildRange, type Interactable } from "./world";
import { spawnDummies, DamageNumbers, type Dummy } from "./dummies";
import { Player } from "./player";
import { Gun } from "./gun";
import { Inventory, makeItem, type Item } from "./inventory";
import { InventoryScreen, WorkbenchScreen, MenuCursor, Thumbnails } from "./ui";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ASSETS = "./weapons/";

// ---------- Idioma ----------
const langSel = $<HTMLSelectElement>("lang");
langSel.innerHTML = LANGS.map((l) => `<option value="${l.id}">${l.name}</option>`).join("");
langSel.value = getLang();
langSel.addEventListener("change", () => setLang(langSel.value as Lang));
setLang(getLang());

// ---------- Render ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
$("game").appendChild(renderer.domElement);
const scene = new THREE.Scene();
const weaponEnv = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(75, 1, 0.02, 300);
scene.add(camera);
const world = buildRange(scene);
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

// ---------- Estado ----------
type State = "start" | "play" | "inventory" | "workbench" | "pause";
let state: State = "start";
const input = new Input(renderer.domElement);
const player = new Player(world.colliders);
const inv = new Inventory();
const numbers = new DamageNumbers($("numbers"));
const dummies: Dummy[] = spawnDummies(scene, world.lanes, $("bars"), (_d, amount, color, crit, at) => numbers.spawn(amount, color, crit, at));
const cursor = new MenuCursor();
onLang(() => dummies.forEach((d) => d.relabel()));

let toastTimer = 0;
function toast(msg: string) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); toastTimer = 2.2; }
let lootTimer = 0;

async function boot() {
  const manifest: Manifest = await (await fetch(ASSETS + "manifest.json")).json();
  const gen = new WeaponGenerator(manifest);
  const asm = new WeaponAssembler(gen, ASSETS);

  const gun = new Gun(camera, scene, asm, world.shootables, {
    dummies: () => dummies,
    onHit(d, _zone, point, dmg, element, chance, crit) {
      const dealt = d.damage(dmg, element, crit, point);
      if (element && Math.random() * 100 < chance) d.applyStatus(element, dmg);
      return dealt;
    },
    onKill(d) { if (d.kind.boss) toast(t("ui.bossDown")); },
  });
  gun.env = weaponEnv;

  // Armas iniciales: pistola y fusil equipados; escopeta y subfusil en la mochila.
  const starter = (type: BaseType, seed0: number) => { for (let s = seed0; ; s++) { const w = gen.generate(s, type); if (w.rarity.id === "comun" || w.rarity.id === "poco") return w; } };
  inv.add(makeItem(starter("pistol", 11)));
  inv.add(makeItem(starter("rifle", 40)));
  inv.add(makeItem(starter("shotgun", 70)));
  inv.add(makeItem(starter("smg", 90)));
  // Caja de piezas inicial, para probar el banco desde el principio.
  for (const [type, modular] of [["pistol", true], ["pistol", true], ["rifle", false], ["rifle", false], ["smg", false], ["shotgun", false], ["sniper", false]] as [BaseType, boolean][]) {
    for (let s = 500 + inv.parts.length * 7; ; s++) {
      const w = gen.generate(s, type);
      if ((w.layout === "modular-pistol") !== modular) continue;
      inv.parts.push(...scrap(w).parts); break;
    }
  }
  for (const id of ["acc:reddot", "acc:holo", "acc:acog", "acc:compensator", "acc:suppressor-s"]) inv.parts.push({ uid: 9000 + inv.parts.length, role: id.includes("dot") || id.includes("holo") || id.includes("acog") ? "scope" : "muzzle", from: id });
  inv.onChange(() => { if (gun.item !== inv.current) gun.equip(inv.current); renderSlots(); });
  await gun.equip(inv.current);
  renderSlots();

  const thumbs = new Thumbnails(asm);
  const invScreen = new InventoryScreen(inv, thumbs, () => resume(), toast);
  const bench = new WorkbenchScreen(inv, gen, asm, thumbs, () => resume(), (it: Item) => { gun.forget(it.uid); if (it === gun.item) gun.equip(it, true); renderSlots(); }, toast);
  onLang(() => { renderSlots(); if (invScreen.isOpen) invScreen.render(); if (bench.isOpen) bench.render(); });

  function openScreen(s: "inventory" | "workbench") {
    state = s; input.unlock();
    if (s === "inventory") invScreen.open(); else bench.open();
  }
  function resume() {
    if (state === "inventory" && invScreen.isOpen) invScreen.close();
    if (state === "workbench" && bench.isOpen) bench.close();
    $("start").hidden = true; state = "play"; input.lock();
  }
  $("play").addEventListener("click", () => resume());
  document.addEventListener("pointerlockchange", () => {
    if (!input.locked && state === "play") { state = "pause"; $("start-title").dataset.i18n = "ui.pause"; $("play").dataset.i18n = "ui.resume"; applyStatic(); $("start").hidden = false; }
  });

  // ---------- Cofre ----------
  let chestT = -1;
  function openChest() {
    if (chestT >= 0) return;
    const types = gen.types;
    const spec = gen.generate(Math.floor(Math.random() * 1e9), types[Math.floor(Math.random() * types.length)]);
    const it = makeItem(spec);
    if (!inv.add(it)) { toast(t("ui.packFull")); return; }
    chestT = 0;
    world.chestGlow.color.set(spec.rarity.color);
    const l = $("loot");
    l.style.setProperty("--c", spec.rarity.color);
    l.innerHTML = `<div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--c)">${rarityName(spec)} · ${typeName(spec.type)} · ${archName(spec)}</div>
      <div style="font-family:var(--display);font-weight:700;font-size:24px;color:var(--c)">${spec.name}</div>
      <div style="color:var(--dim);font-size:12px">${damageText(spec)} ${t("label.damage")} · ${Math.round(spec.stats.cadencia)}${t("unit.rpm")} · ${spec.stats.cargador}${spec.effects.length ? " · " + spec.effects.map(effectName).join(", ") : ""}</div>
      <div style="color:var(--dim);font-size:11px;margin-top:6px">${inv.find(it.uid)?.area === "equip" ? t("ui.equippedTo") : t("ui.storedIn")} · ${t("ui.tabToSee")}</div>`;
    l.classList.add("show"); lootTimer = 3.5;
    thumbs.get(it).then((url) => { const img = document.createElement("img"); img.src = url; img.className = "loot-thumb"; l.prepend(img); }).catch(() => undefined);
  }

  // ---------- HUD ----------
  function renderSlots() {
    $("slots").innerHTML = inv.equip.map((it, i) => `<span class="${i === inv.active ? "on" : ""}" style="--c:${it?.spec.rarity.color ?? "#555"}"><kbd>${i + 1}</kbd>${it ? it.spec.name : t("ui.empty")}</span>`).join("");
  }
  const ch = $("crosshair");
  function hud() {
    const it = gun.item, s = it?.spec;
    $("wname").textContent = s?.name ?? t("ui.noWeapon"); $("wname").style.color = s?.rarity.color ?? "";
    $("wtype").textContent = s ? `${rarityName(s)} · ${typeName(s.type)} · ${archName(s)}` : "";
    const ammo = $("ammo");
    ammo.innerHTML = it && s ? (gun.reloading ? `<small>${t("ui.reloading")}</small>` : `${it.ammo}<small> / ${s.stats.cargador}</small>`) : "";
    ammo.classList.toggle("low", !!it && !!s && it.ammo <= Math.ceil(s.stats.cargador * 0.25));
    $("hint").innerHTML = t(input.device === "pad" ? "hint.pad" : "hint.kbm");
    // Retícula estilo Destiny: punto central + anillo que se abre con la dispersión
    const moving = Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5);
    const spread = gun.spread(moving);
    const radius = 6 + Math.tan(THREE.MathUtils.degToRad(spread)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * innerHeight / 2;
    ch.style.setProperty("--r", `${radius.toFixed(1)}px`);
    ch.dataset.type = s?.type ?? "";
    ch.style.opacity = player.sprinting ? "0" : String(1 - gun.aimT * 0.85);
    ch.classList.toggle("hit", gun.hitmarker > 0); ch.classList.toggle("crit", gun.critmarker > 0); ch.classList.toggle("kill", gun.killmarker > 0);
  }

  function nearInteractable(): Interactable | null {
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    for (const i of world.interactables) {
      const to = i.position.clone().sub(player.pos); to.y = 0;
      if (to.length() < i.radius && (to.length() < 1 || to.normalize().dot(fwd) > 0.3)) return i;
    }
    return null;
  }

  // ---------- Bucle ----------
  const clock = new THREE.Clock();
  const debug = { fire: false, aim: false }; // usado por las pruebas automáticas
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const edges = input.padEdges();
    const f = input.read(dt, edges);
    if (debug.fire) f.fire = true;
    if (debug.aim) f.aim = true;
    const pad = input.pad();
    const menu = state !== "play";
    cursor.show(menu);

    if (state === "play") {
      if (f.pause) input.unlock();
      if (f.inventory) openScreen("inventory");
      const near = nearInteractable();
      $("prompt").hidden = !near;
      if (near) $("prompt").innerHTML = `<kbd>${input.device === "pad" ? "Ⓑ" : "E"}</kbd>${t(near.id === "chest" ? "ui.openCrate" : "ui.useBench")}`;
      if (near && f.interact) { if (near.id === "chest") openChest(); else openScreen("workbench"); }
      if (f.slot1 && inv.equip[0]) { inv.active = 0; inv.changed(); }
      if (f.slot2 && inv.equip[1]) { inv.active = 1; inv.changed(); }
      if (f.swap && inv.equip[1 - inv.active]) { inv.active = 1 - inv.active; inv.changed(); }
      if (f.reload) gun.startReload();
      // Asistencia de apuntado con mando: la mira se frena sobre un muñeco
      input.assist = 1;
      if (input.device === "pad") {
        const fwd = camera.getWorldDirection(new THREE.Vector3());
        for (const d of dummies) { if (!d.alive) continue; const to = d.center.sub(camera.position); const dist = to.length(); if (fwd.angleTo(to) < Math.max(0.03, 0.6 / dist)) { input.assist = 0.45; break; } }
      }
      player.update(dt, f, gun.aimT > 0.5, 1 - gun.aimT * (1 - 1 / Math.max(1.5, gun.zoom)));
      gun.update(dt, { fire: f.fire, aim: f.aim, moving: Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5), sprinting: player.sprinting, lookX: f.lookX, lookY: f.lookY, vy: player.vel.y, grounded: player.onGround, inspect: f.inspect });
      const aimFov = 75 / Math.max(1.35, gun.zoom * 1.1);
      camera.fov = THREE.MathUtils.lerp(player.sprinting ? 82 : 75, aimFov, gun.aimT); camera.updateProjectionMatrix();
    } else {
      $("prompt").hidden = true;
      gun.update(dt, { fire: false, aim: false, moving: 0, sprinting: false, lookX: 0, lookY: 0, vy: 0, grounded: true, inspect: false });
      if (pad) {
        cursor.update(dt, pad.axes[0] ?? 0, pad.axes[1] ?? 0);
        if (state === "workbench" && Math.abs(pad.axes[2] ?? 0) > 0.15) bench.rotate((pad.axes[2] ?? 0) * dt * 2.5);
        if (edges[0]) cursor.click();
        if (edges[2]) cursor.click(true);
        if (edges[3] && state === "inventory") invScreen.scrapHovered();
        if ((edges[1] || edges[8]) && (state === "inventory" || state === "workbench")) resume();
      }
      if (state === "inventory" && (f.inventory || f.pause)) resume();
      if (state === "workbench" && (f.interact || f.pause)) resume();
      if (state === "pause" && edges[9]) resume();
    }
    player.applyCamera(camera, gun.recoil);
    camera.rotation.y += gun.recoilYaw;

    // Cofre: tapa y luz
    if (chestT >= 0) {
      chestT += dt;
      world.chestLid.rotation.x = -Math.min(1, chestT / 0.35) * 1.9 * (chestT > 1.6 ? Math.max(0, 1 - (chestT - 1.6) / 0.4) : 1);
      world.chestGlow.intensity = chestT < 1.6 ? 6 : Math.max(0, 6 * (1 - (chestT - 1.6) / 0.4));
      if (chestT > 2) { chestT = -1; world.chestLid.rotation.x = 0; }
    }
    toastTimer -= dt; if (toastTimer <= 0) $("toast").classList.remove("show");
    lootTimer -= dt; if (lootTimer <= 0) $("loot").classList.remove("show");

    for (const d of dummies) d.update(dt, camera, innerWidth, innerHeight);
    numbers.update(dt, camera, innerWidth, innerHeight);
    bench.update(dt);
    hud();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  addEventListener("keydown", (e) => { if (e.code === "KeyX" && state === "inventory") invScreen.scrapHovered(); });
  player.applyCamera(camera, 0);
  frame();
  (window as unknown as Record<string, unknown>).__game = { debug, gen, inv, gun, player, dummies, openChest, openScreen, resume, setLang, get state() { return state; }, set state(v: State) { state = v; } };
}

boot().catch((e) => { $("start-text").textContent = t("ui.loadError", { e: e.message }); console.error(e); });
