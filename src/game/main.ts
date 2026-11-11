// Campo de Pruebas: demo jugable de la Fase 1.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { WeaponGenerator, TYPE_INFO } from "../weapons/generator";
import { WeaponAssembler } from "../weapons/assembler";
import type { Manifest, WeaponType } from "../weapons/types";
import { Input } from "./input";
import { buildRange, type Interactable } from "./world";
import { spawnDummies, DamageNumbers, type Dummy } from "./dummies";
import { Player } from "./player";
import { Gun } from "./gun";
import { Inventory, makeItem, type Item } from "./inventory";
import { scrap } from "../weapons/workshop";
import { InventoryScreen, WorkbenchScreen, VirtualCursor, damageText } from "./ui";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ASSETS = "./weapons/";

// ---------- Render ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
$("game").appendChild(renderer.domElement);
const scene = new THREE.Scene();
// Entorno de reflejos solo para el arma en mano (el escenario ya tiene su luz).
const weaponEnv = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(75, 1, 0.03, 300);
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
const cursor = new VirtualCursor();

let toastTimer = 0;
function toast(msg: string) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); toastTimer = 2.2; }
let lootTimer = 0;

async function boot() {
  const manifest: Manifest = await (await fetch(ASSETS + "manifest.json")).json();
  const gen = new WeaponGenerator(manifest);
  const asm = new WeaponAssembler(gen, ASSETS);

  const gun = new Gun(camera, scene, asm, world.shootables, {
    dummies: () => dummies,
    onHit(d, zone, point, dmg, element, chance) {
      const dealt = d.damage(dmg, element, zone === "head", point);
      if (element && Math.random() * 100 < chance) d.applyStatus(element, dmg);
      return dealt;
    },
    onKill(d) { if (d.kind.boss) toast("¡Coloso derribado!"); },
  });
  gun.env = weaponEnv;

  // Armas iniciales: una pistola y un fusil comunes equipados, y dos más en la mochila para trastear en el banco.
  const starter = (type: WeaponType, seed0: number) => { for (let s = seed0; ; s++) { const w = gen.generate(s, type); if (w.rarity.id === "comun" || w.rarity.id === "poco") return w; } };
  inv.add(makeItem(starter("pistol", 11)));
  inv.add(makeItem(starter("rifle", 40)));
  inv.add(makeItem(starter("shotgun", 70)));
  inv.add(makeItem(starter("smg", 90)));
  // Caja de piezas inicial: piezas de varias armas desguazadas, para probar el banco desde el principio.
  for (const [type, modular] of [["pistol", true], ["pistol", true], ["rifle", false], ["rifle", false], ["smg", false], ["shotgun", false], ["sniper", false]] as [WeaponType, boolean][]) {
    for (let s = 500 + inv.parts.length * 7; ; s++) {
      const w = gen.generate(s, type);
      if ((w.layout === "modular-pistol") !== modular) continue;
      inv.parts.push(...scrap(w).parts); break;
    }
  }
  inv.onChange(() => { if (gun.item !== inv.current) gun.equip(inv.current); renderSlots(); });
  await gun.equip(inv.current);
  renderSlots();

  const invScreen = new InventoryScreen(inv, () => resume(), toast);
  const bench = new WorkbenchScreen(inv, gen, asm, () => resume(), (it: Item) => { gun.forget(it.uid); if (it === gun.item) gun.equip(it, true); renderSlots(); }, toast);

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
    if (!input.locked && state === "play") { state = "pause"; $("start-title").textContent = "Pausa"; $("play").textContent = "Volver al campo"; $("start").hidden = false; }
  });

  // ---------- Cofre ----------
  let chestT = -1;
  function openChest() {
    if (chestT >= 0) return;
    const types = gen.types;
    const spec = gen.generate(Math.floor(Math.random() * 1e9), types[Math.floor(Math.random() * types.length)]);
    const it = makeItem(spec);
    if (!inv.add(it)) { toast("Mochila llena: desguaza o tira algún arma"); return; }
    chestT = 0;
    world.chestGlow.color.set(spec.rarity.color);
    const l = $("loot");
    l.style.setProperty("--c", spec.rarity.color);
    l.innerHTML = `<div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--c)">${spec.rarity.name} · ${TYPE_INFO[spec.type as keyof typeof TYPE_INFO].name}</div>
      <div style="font-family:var(--display);font-weight:700;font-size:24px;color:var(--c)">${spec.name}</div>
      <div style="color:var(--dim);font-size:12px">${damageText(spec)} de daño · ${Math.round(spec.stats.cadencia)}/min · ${spec.stats.cargador} balas${spec.effects.length ? " · " + spec.effects.map((e) => e.name).join(", ") : ""}</div>
      <div style="color:var(--dim);font-size:11px;margin-top:6px">${inv.find(it.uid)?.area === "equip" ? "Equipada" : "Guardada en la mochila"} · Tab para ver el inventario</div>`;
    l.classList.add("show"); lootTimer = 3.5;
  }

  // ---------- HUD ----------
  function renderSlots() {
    $("slots").innerHTML = inv.equip.map((it, i) => `<span class="${i === inv.active ? "on" : ""}" style="--c:${it?.spec.rarity.color ?? "#555"}"><kbd>${i + 1}</kbd>${it ? it.spec.name : "Vacía"}</span>`).join("");
  }
  function hud() {
    const it = gun.item, s = it?.spec;
    $("wname").textContent = s?.name ?? "Sin arma"; $("wname").style.color = s?.rarity.color ?? "";
    $("wtype").textContent = s ? `${s.rarity.name} · ${TYPE_INFO[s.type as keyof typeof TYPE_INFO].name}` : "";
    const ammo = $("ammo");
    ammo.innerHTML = it && s ? (gun.reloading ? `<small>recargando…</small>` : `${it.ammo}<small> / ${s.stats.cargador}</small>`) : "";
    ammo.classList.toggle("low", !!it && !!s && it.ammo <= Math.ceil(s.stats.cargador * 0.25));
    const pad = input.device === "pad";
    $("hint").innerHTML = pad
      ? `<kbd>RT</kbd>disparar <kbd>LT</kbd>apuntar <kbd>Ⓧ</kbd>recargar <kbd>Ⓨ</kbd>cambiar <kbd>Ⓑ</kbd>usar <kbd>View</kbd>inventario`
      : `<kbd>Clic</kbd>disparar <kbd>Clic der.</kbd>apuntar <kbd>R</kbd>recargar <kbd>1</kbd><kbd>2</kbd>armas <kbd>E</kbd>usar <kbd>Tab</kbd>inventario`;
    // Mira: se abre con la dispersión
    const spread = s ? (s.type === "shotgun" ? 3.2 : (100 - s.stats.precision) * 0.055 + 0.08) * (1 - gun.aimT * 0.75) * (1 + Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5) * 0.6) : 1;
    const gap = 4 + Math.tan(THREE.MathUtils.degToRad(spread)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * innerHeight / 2;
    const ch = $("crosshair");
    ch.style.opacity = player.sprinting ? "0" : String(1 - gun.aimT * 0.7);
    (ch.querySelector(".t") as HTMLElement).style.top = `${-gap - 8}px`; (ch.querySelector(".b") as HTMLElement).style.top = `${gap}px`;
    (ch.querySelector(".l") as HTMLElement).style.left = `${-gap - 8}px`; (ch.querySelector(".r") as HTMLElement).style.left = `${gap}px`;
    const hm = $("hitmarker"); hm.style.opacity = gun.hitmarker > 0 || gun.critmarker > 0 ? "1" : "0"; hm.classList.toggle("crit", gun.critmarker > 0);
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

    if (state === "play") {
      if (f.pause) { input.unlock(); }
      if (f.inventory) openScreen("inventory");
      const near = nearInteractable();
      $("prompt").hidden = !near;
      if (near) $("prompt").innerHTML = `<kbd>${input.device === "pad" ? "Ⓑ" : "E"}</kbd>${near.label}`;
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
      const aimFov = gun.spec && gun.spec.optic ? 32 : 55;
      player.update(dt, f, gun.aimT > 0.5, 1 - gun.aimT * 0.45);
      gun.update(dt, f.fire, f.aim, Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5), player.sprinting);
      camera.fov = THREE.MathUtils.lerp(player.sprinting ? 80 : 75, aimFov, gun.aimT); camera.updateProjectionMatrix();
    } else {
      $("prompt").hidden = true;
      gun.update(dt, false, false, 0, false);
      // Menús con mando: cursor virtual
      const menu = state === "inventory" || state === "workbench";
      cursor.show(menu && input.device === "pad");
      if (menu && pad) {
        cursor.update(dt, pad.axes[0] ?? 0, pad.axes[1] ?? 0);
        if (state === "workbench" && Math.abs(pad.axes[2] ?? 0) > 0.15) bench.rotate((pad.axes[2] ?? 0) * dt * 2.5);
        if (edges[0]) cursor.click();
        if (edges[2]) cursor.click(true);
        if (edges[3] && state === "inventory") invScreen.scrapHovered();
        if (edges[1] || edges[8]) resume();
      }
      if (state === "inventory" && (f.inventory || f.pause)) resume();
      if (state === "workbench" && (f.interact || f.pause)) resume();
      if (state === "pause" && (edges[9] || edges[0])) resume();
    }
    player.applyCamera(camera, gun.recoil);

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
  (window as unknown as Record<string, unknown>).__game = { debug, inv, gun, player, dummies, openChest, openScreen, resume, get state() { return state; }, set state(v: State) { state = v; } };
}

boot().catch((e) => { $("start-text").textContent = `No se pudo cargar el juego: ${e.message}`; console.error(e); });
