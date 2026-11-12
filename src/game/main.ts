// Proving Grounds / Campo de Pruebas: demo jugable de la Fase 1.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { WeaponGenerator, type BaseType } from "../weapons/generator";
import { WeaponAssembler } from "../weapons/assembler";
import { scrap } from "../weapons/workshop";
import { archName, rarityName, typeName } from "../weapons/labels";
import type { Manifest, WeaponSpec } from "../weapons/types";
import { LANGS, applyStatic, getLang, onLang, setLang, t, type Lang } from "../i18n";
import { Input } from "./input";
import { buildRange, type Interactable } from "./world";
import { PIXEL_LEVELS, pixelLevel, setPixelLevel } from "../weapons/textures";
import { setSetting, settings } from "./settings";
import { PlayerHealth, Waves } from "./waves";
import { spawnDummies, DamageNumbers, type Dummy } from "./dummies";
import { Player } from "./player";
import { Gun } from "./gun";
import { Inventory, makeItem, type Item } from "./inventory";
import { InventoryScreen, WorkbenchScreen, MenuCursor, Thumbnails, weaponCard } from "./ui";
import { Pickups, type Pickup } from "./pickups";

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
renderer.localClippingEnabled = true; // escaneo de los muñecos de la simulación
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
$("game").appendChild(renderer.domElement);
const scene = new THREE.Scene();
const weaponEnv = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(75, 1, 0.02, 300);
scene.add(camera);
// Luz de borde ligada a la cámara: perfila el arma en primera persona para que las oscuras no se pierdan en la sala
const rim = new THREE.DirectionalLight(0xbfd8ff, 0.4); rim.position.set(0.8, 0.6, -1.2); camera.add(rim); camera.add(rim.target); rim.target.position.set(0, -0.2, 0.5);
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
const onDummyDamage = (_d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => { if (settings.damageNumbers) numbers.spawn(amount, color, crit, at); };
const dummies: Dummy[] = spawnDummies(scene, world.lanes, $("bars"), onDummyDamage);
const cursor = new MenuCursor();
onLang(() => dummies.forEach((d) => d.relabel()));

let toastTimer = 0;
function toast(msg: string) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); toastTimer = 2.2; }

async function boot() {
  const manifest: Manifest = await (await fetch(ASSETS + "manifest.json")).json();
  const gen = new WeaponGenerator(manifest);
  const asm = new WeaponAssembler(gen, ASSETS);
  asm.preloadKit();

  // Números de daño (tecla N; se guarda)
  addEventListener("keydown", (e) => { if (e.code === "KeyN" && state === "play") { setSetting("damageNumbers", !settings.damageNumbers); toast(t(settings.damageNumbers ? "ui.dmgOn" : "ui.dmgOff")); } });
  // Nivel de pixelado de las texturas (ajuste a ojo en la sala: tecla P; se guarda)
  addEventListener("keydown", (e) => {
    if (e.code !== "KeyP" || state !== "play") return;
    const i = PIXEL_LEVELS.indexOf(pixelLevel());
    setPixelLevel(PIXEL_LEVELS[(i + 1) % PIXEL_LEVELS.length]);
    toast(t("ui.pixelLevel", { n: pixelLevel() }));
  });
  // Estadísticas de la sala (cuadro de datos de la pared)
  const sim = { shots: 0, hits: 0, log: [] as [number, number][], distance: null as number | null, ttk: null as number | null, firstHit: new Map<Dummy, number>(), lastShot: -100 };
  const gun = new Gun(camera, scene, asm, world.shootables, {
    dummies: () => dummies,
    onHit(d, _zone, point, dmg, element, crit) {
      const dealt = d.damage(dmg, element, crit, point);
      // Estadísticas de la sala de simulación
      const now = performance.now() / 1000;
      sim.hits++; sim.log.push([now, dealt]); sim.distance = point.distanceTo(camera.position);
      if (!sim.firstHit.has(d)) sim.firstHit.set(d, now);
      if (element === "fuego" || element === "electrico") d.applyStatus(element, dmg);
      return dealt;
    },
    onKill(d) {
      if (d.kind.boss) toast(t("ui.bossDown"));
      const t0 = sim.firstHit.get(d); if (t0 != null) { sim.ttk = performance.now() / 1000 - t0; sim.firstHit.delete(d); }
    },
    onShot() { sim.shots++; sim.lastShot = performance.now() / 1000; },
  });
  gun.env = weaponEnv;
  const pickups = new Pickups(scene, asm, world.colliders);

  // Armas iniciales: pistola y fusil equipados; escopeta y subfusil en la mochila.
  const starter = (type: BaseType, seed0: number) => { for (let s = seed0; ; s++) { const w = gen.generate(s, type); if (w.rarity.id === "comun" || w.rarity.id === "poco") return w; } };
  inv.add(makeItem(starter("pistol", 11)));
  inv.add(makeItem(starter("rifle", 40)));
  inv.add(makeItem(starter("shotgun", 70)));
  inv.add(makeItem(starter("smg", 90)));
  // Caja de piezas inicial, para probar el banco desde el principio.
  for (const type of ["pistol", "pistol", "rifle", "rifle", "smg", "shotgun", "sniper"] as BaseType[]) {
    inv.parts.push(...scrap(gen.generate(500 + inv.parts.length * 7, type)).parts);
  }
  for (const id of ["acc:reddot", "acc:holo", "acc:acog", "acc:compensator", "acc:suppressor-s"]) inv.parts.push({ uid: 9000 + inv.parts.length, role: id.includes("dot") || id.includes("holo") || id.includes("acog") ? "scope" : "muzzle", from: id });
  inv.onChange(() => { if (gun.item !== inv.current) gun.equip(inv.current); renderSlots(); });
  await gun.equip(inv.current);
  renderSlots();

  const thumbs = new Thumbnails(asm);
  const invScreen = new InventoryScreen(inv, thumbs, () => resume(), toast, (it) => dropItem(it));
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
  const recentDrops: WeaponSpec[] = [];
  function openChest() {
    if (chestT >= 0) return;
    const types = gen.types;
    // Lote: no repite la base de las últimas armas ni saca una casi igual a otra reciente
    const spec = gen.generateDistinct(Math.floor(Math.random() * 1e9), types[Math.floor(Math.random() * types.length)], recentDrops);
    recentDrops.push(spec); if (recentDrops.length > 6) recentDrops.shift();
    chestT = 0;
    world.chestGlow.color.set(spec.rarity.color);
    // El arma sale despedida del cofre hacia el jugador y cae al suelo, lista para recoger
    const chestPos = world.interactables.find((i) => i.id === "chest")!.position;
    const toward = player.pos.clone().sub(chestPos).setY(0).normalize();
    // El terminal "compila" el arma (escaneo de abajo arriba) y la deja en la bandeja
    pickups.spawn(makeItem(spec), chestPos.clone().add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(toward, 0.3), toward.multiplyScalar(2.2).setY(4.2), { compile: true });
  }

  /** Suelta un arma delante del jugador. */
  function dropItem(it: Item) {
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    pickups.spawn(it, player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(fwd, 0.6), fwd.multiplyScalar(2.5).setY(1.5));
    toast(t("ui.dropped", { n: it.spec.name }));
  }

  /** Recoge el arma del suelo a la que apunta el jugador. */
  function pickUp(p: Pickup) {
    if (!inv.add(p.item)) { toast(t("ui.packFull")); return; }
    pickups.remove(p);
    const where = inv.find(p.item.uid);
    toast(`${p.item.spec.name} · ${where?.area === "equip" ? t("ui.equippedTo") : t("ui.storedIn")}`);
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
    ch.style.opacity = player.sprinting ? "0" : String(1 - gun.aimT * (gun.sight === "iron" ? 0.85 : 1));
    ch.classList.toggle("hit", gun.hitmarker > 0); ch.classList.toggle("crit", gun.critmarker > 0); ch.classList.toggle("kill", gun.killmarker > 0);
  }

  // ---------- Oleadas de prueba y vida del jugador ----------
  const php = new PlayerHealth();
  const waves = new Waves(scene, dummies, $("bars"), () => player.pos, onDummyDamage, {
    onWaveEnd: (i, last) => { toast(t("ui.waveDone", { n: i + 1 })); hooksWaveEnd(i, last); },
    onAllDone: () => toast(t("ui.wavesDone")),
    onPlayerHit: (dmg) => { if (php.hit(dmg)) { waves.stop(); php.reset(); toast(t("ui.simReset")); } $("dmgflash").classList.remove("on"); void $("dmgflash").offsetWidth; $("dmgflash").classList.add("on"); },
  });
  let hooksWaveEnd: (i: number, last: Dummy | null) => void = () => undefined;
  function healthHud() {
    const el = $("phealth"); const show = waves.active || php.value < php.max;
    el.hidden = !show; if (!show) return;
    el.querySelector<HTMLElement>("i")!.style.width = `${(php.value / php.max) * 100}%`;
    el.querySelector<HTMLElement>("span")!.textContent = waves.active ? t("ui.waveN", { n: waves.index + 1, of: waves.total, left: waves.remaining }) : "";
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
  let shownPickup: Pickup | null = null;
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
      const key = `<kbd>${input.device === "pad" ? "Ⓑ" : "E"}</kbd>`;
      const look = camera.getWorldDirection(new THREE.Vector3());
      const ground = pickups.target(camera.position, look);
      const near = ground ? null : nearInteractable();
      $("prompt").hidden = !ground && !near;
      if (ground) $("prompt").innerHTML = `${key}${t("ui.pickup")}`;
      else if (near) $("prompt").innerHTML = `${key}${t(near.id === "chest" ? "ui.openCrate" : near.id === "waves" ? (waves.active ? "ui.wavesStop" : "ui.wavesStart") : near.id === "inspect" ? "ui.inspect" : "ui.useBench")}`;
      // Ficha del arma del suelo comparada con la que llevas
      const card = $("pickcard");
      if (ground !== shownPickup) {
        shownPickup = ground;
        card.innerHTML = ground ? weaponCard(ground.item.spec, inv.current && inv.current !== ground.item ? inv.current.spec : null, inv.current ? t("ui.compared") : "") : "";
        card.hidden = !ground;
      }
      if (f.interact) {
        if (ground) pickUp(ground);
        else if (near) {
          if (near.id === "chest") openChest();
          else if (near.id === "waves") { if (waves.active) waves.stop(); else { php.reset(); waves.start(); toast(t("ui.wavesGo")); } }
          else if (near.id === "inspect") { bench.inspect = true; openScreen("workbench"); }
          else { bench.inspect = false; openScreen("workbench"); }
        }
      }
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
      const aimFov = gun.sight === "scope" ? 75 / gun.zoom : gun.sight === "iron" ? 75 / 1.35 : 75 / 1.6;
      camera.fov = THREE.MathUtils.lerp(player.sprinting ? 82 : 75, aimFov, gun.aimT); camera.updateProjectionMatrix();
    } else {
      $("prompt").hidden = true; $("pickcard").hidden = true; shownPickup = null;
      gun.update(dt, { fire: false, aim: false, moving: 0, sprinting: false, lookX: 0, lookY: 0, vy: 0, grounded: true, inspect: false });
      if (pad) {
        cursor.update(dt, pad.axes[0] ?? 0, pad.axes[1] ?? 0);
        if (state === "workbench" && Math.abs(pad.axes[2] ?? 0) > 0.15) bench.rotate((pad.axes[2] ?? 0) * dt * 2.5);
        if (edges[0]) cursor.click();
        if (edges[2]) cursor.click(true);
        if (edges[3] && state === "inventory") invScreen.scrapHovered();
        if (edges[5] && state === "inventory") invScreen.dropHovered();
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

    pickups.update(dt);
    if (state === "play") { waves.update(dt); php.update(dt); }
    healthHud();
    {
      const now = performance.now() / 1000;
      while (sim.log.length && now - sim.log[0][0] > 3) sim.log.shift();
      const dps = sim.log.reduce((a, x) => a + x[1], 0) / 3;
      world.update(dt, { dps, ttk: sim.ttk, accuracy: sim.shots ? Math.min(1, sim.hits / sim.shots) : null, distance: sim.distance, message: t(now - sim.lastShot < 2 ? "sim.active" : "sim.calibrating") });
    }
    // Miras: visor a pantalla completa o retícula de punto rojo / holográfica
    const scopeOn = state === "play" && gun.sight === "scope" && gun.aimT > 0.9;
    $("scope").classList.toggle("on", scopeOn);
    const rd = $("reddot"); rd.dataset.kind = gun.sight;
    rd.style.opacity = state === "play" && (gun.sight === "dot" || gun.sight === "holo") ? String(Math.max(0, (gun.aimT - 0.6) / 0.4)) : "0";
    for (const d of dummies) d.update(dt, camera, innerWidth, innerHeight);
    numbers.update(dt, camera, innerWidth, innerHeight);
    bench.update(dt);
    hud();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  addEventListener("keydown", (e) => { if (e.code === "KeyX" && state === "inventory") invScreen.scrapHovered(); if (e.code === "KeyG" && state === "inventory") invScreen.dropHovered(); });
  player.applyCamera(camera, 0);
  frame();
  (window as unknown as Record<string, unknown>).__game = { debug, gen, inv, gun, pickups, pickUp, player, dummies, waves, php, bench, openChest, openScreen, resume, setLang, get state() { return state; }, set state(v: State) { state = v; } };
}

boot().catch((e) => { $("start-text").textContent = t("ui.loadError", { e: e.message }); console.error(e); });
