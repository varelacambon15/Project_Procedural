// Proving Grounds / Campo de Pruebas: demo jugable de la Fase 1.
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import * as THREE from "three";
import { startMusic } from "./audio";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RARITIES, WeaponGenerator } from "../weapons/generator";
import { WeaponAssembler } from "../weapons/assembler";
import { archName, rarityName, typeName } from "../weapons/labels";
import { displayName, rename } from "../weapons/naming";
import { setAccUid } from "../weapons/accbank";
import type { Manifest, RarityId, WeaponSpec } from "../weapons/types";
import { getLang, onLang, setLang, t, type Lang } from "../i18n";
import { Input } from "./input";
import { buildRange, type Interactable } from "./world";
import { PIXEL_LEVELS, pixelLevel, setPixelLevel } from "../weapons/textures";
import { onSettings, replaceSettings, setSetting, settings, type Settings } from "./settings";
import { PlayerHealth, Waves } from "./waves";
import { spawnDummies, DamageNumbers, type Dummy } from "./dummies";
import { Player } from "./player";
import { Gun } from "./gun";
import { Inventory, makeItem, type Item } from "./inventory";
import { Pickups, type Pickup } from "./pickups";
import { LOOT, LootDirector, type LootSource } from "../weapons/loot";
import { lootChime } from "./audio";
import { installPixelFont } from "./pixelfont";
import { starterWeapons } from "./loadout";
import { $, MenuCursor, MenuNav, ModelView, Thumbnails, esc, weaponCard, type Dir } from "./ui/common";
import { InventoryScreen } from "./ui/inventory";
import { WorkshopScreen } from "./ui/workshop";
import { ShopScreen } from "./ui/shop";
import { StartScreen } from "./ui/start";
import { TextDialog } from "./ui/dialog";
import { AUTO, SLOTS, SAVE_VERSION, SaveManager, type SaveData, type SlotId } from "./save";
import { platformStorage } from "./storage";
import { SHOP, newShopState, type ShopState } from "./shop";

const ASSETS = "./weapons/";
void installPixelFont();
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
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.02, 300);
scene.add(camera);
// Luz de borde ligada a la cámara: perfila el arma en primera persona para que las oscuras no se pierdan en la sala
const rim = new THREE.DirectionalLight(0xbfd8ff, 0.4); rim.position.set(0.8, 0.6, -1.2); camera.add(rim); camera.add(rim.target); rim.target.position.set(0, -0.2, 0.5);
const world = buildRange(scene);
// Postproceso: resplandor (bloom) sobre lo que brilla de verdad (neón, fogonazos); fuerte de noche, suave de día
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.5, 0.82);
composer.addPass(bloom); composer.addPass(new OutputPass());
// Relleno de la vista en primera persona: de noche el arma y los brazos recogen el rebote del neón (cian arriba, magenta abajo)
const fill = new THREE.DirectionalLight(0xe040a0, 0); fill.position.set(-0.6, -0.8, -0.4); camera.add(fill); camera.add(fill.target); fill.target.position.set(0, 0, -1);
const applyLook = () => { world.setNight(settings.night); rim.intensity = settings.night ? 0.8 : 0.4; rim.color.set(settings.night ? 0xc8b0ff : 0xbfd8ff); fill.intensity = settings.night ? 0.5 : 0; bloom.enabled = settings.bloom; bloom.strength = settings.night ? 0.85 : 0.3; renderer.toneMappingExposure = settings.night ? 1.1 : 1.0; };
applyLook(); onSettings(applyLook);
startMusic("./music/ambient-01.ogg");
const draw = () => (settings.bloom ? composer.render() : renderer.render(scene, camera));
function resize() { renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

// ---------- Estado ----------
type State = "title" | "play" | "pause" | "inventory" | "workbench" | "shop";
let state: State = "title";
let inGame = false; // hay una partida empezada (nueva o cargada)
const input = new Input(renderer.domElement);
const player = new Player(world.colliders);
const inv = new Inventory();
let shopState: ShopState = newShopState();
let playSeconds = 0;
const numbers = new DamageNumbers($("numbers"));
const onDummyDamage = (_d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => { if (settings.damageNumbers) numbers.spawn(amount, color, crit, at); };
const dummies: Dummy[] = spawnDummies(scene, world.lanes, $("bars"), onDummyDamage);
const cursor = new MenuCursor();
const nav = new MenuNav(cursor);
const saves = new SaveManager(platformStorage());
onLang(() => dummies.forEach((d) => d.relabel()));
const applySens = () => { input.sensitivity = 0.0022 * settings.sensitivity; input.padSensitivity = 3.2 * settings.sensitivity; };
applySens(); onSettings(applySens);

let toastTimer = 0;
function toast(msg: string) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); toastTimer = 2.2; }

async function boot() {
  const manifest: Manifest = await (await fetch(ASSETS + "manifest.json")).json();
  const gen = new WeaponGenerator(manifest);
  const asm = new WeaponAssembler(gen, ASSETS);
  asm.preloadKit();

  // Números de daño (tecla N) y nivel de pixelado (tecla P): atajos en la sala; también en Ajustes. Se guardan.
  addEventListener("keydown", (e) => {
    if (state !== "play") return;
    if (e.code === "KeyL") { setSetting("night", !settings.night); toast(t(settings.night ? "ui.night" : "ui.day")); }
    if (e.code === "KeyN") { setSetting("damageNumbers", !settings.damageNumbers); toast(t(settings.damageNumbers ? "ui.dmgOn" : "ui.dmgOff")); }
    if (e.code === "KeyP") { const i = PIXEL_LEVELS.indexOf(pixelLevel()); setPixelLevel(PIXEL_LEVELS[(i + 1) % PIXEL_LEVELS.length]); toast(t("ui.pixelLevel", { n: pixelLevel() })); }
  });
  // Estadísticas de la sala (cuadro de datos de la pared)
  const sim = { shots: 0, hits: 0, log: [] as [number, number][], distance: null as number | null, ttk: null as number | null, firstHit: new Map<Dummy, number>(), lastShot: -100 };
  let shake = 0;
  const gun = new Gun(camera, scene, asm, world.shootables, {
    dummies: () => dummies,
    lunge: (dir, dist) => player.lunge(dir, dist),
    onHit(d, _zone, point, dmg, element, crit) {
      const dealt = d.damage(dmg, element, crit, point);
      const now = performance.now() / 1000;
      sim.hits++; sim.log.push([now, dealt]); sim.distance = point.distanceTo(camera.position);
      if (!sim.firstHit.has(d)) sim.firstHit.set(d, now);
      if (element === "fuego" || element === "electrico") d.applyStatus(element, dmg);
      if (!d.respawn) loot.combat(gameTime);
      return dealt;
    },
    onKill(d) {
      if (d.kind.boss) toast(t("ui.bossDown"));
      const t0 = sim.firstHit.get(d); if (t0 != null) { sim.ttk = performance.now() / 1000 - t0; sim.firstHit.delete(d); }
      // Botín y créditos: solo los enemigos de las oleadas (los blancos de práctica reaparecen y no sueltan nada)
      if (!d.respawn) {
        const sc = d.kind.scale ?? 1, src: LootSource = d.kind.boss || sc >= 1.3 ? "big" : sc < 0.85 ? "small" : "normal";
        earn(d.kind.boss ? SHOP.income.boss : SHOP.income[src as "small" | "normal" | "big"]);
        dropLoot(src, d.group.position);
      }
    },
    onShot() { sim.shots++; sim.lastShot = performance.now() / 1000; },
    hurt(dmg) { if (php.hit(dmg)) { waves.stop(); php.reset(); toast(t("ui.simReset")); } },
  });
  gun.env = weaponEnv;
  const pickups = new Pickups(scene, asm, world.colliders);
  inv.onChange(() => { if (gun.item !== inv.current) void gun.equip(inv.current); renderSlots(); });

  // Arma de muestra para la pantalla de título (antes de empezar): una legendaria girando sobre la rejilla
  const showcase = gen.generate(7 + Math.floor(Math.random() * 50) * 97, undefined, "legendaria");

  // ---------- Menús ----------
  const thumbs = new Thumbnails(asm);
  const view = new ModelView(asm);
  const dialog = new TextDialog();
  const onWeaponChanged = (it: Item | null) => { if (it) { gun.forget(it.uid); thumbs.forget(it.uid); if (it === gun.item) void gun.equip(it, true); } renderSlots(); };
  async function renameItem(it: Item) {
    const v = await dialog.ask(t("dlg.renameTitle"), displayName(it.spec), it.spec.name);
    if (v === null) return;
    rename(it.spec, v);
    toast(it.spec.customName ? t("ui.renamed", { n: it.spec.customName }) : t("ui.nameRestored", { n: it.spec.name }));
    renderSlots(); if (invScreen.isOpen) invScreen.render(); if (bench.isOpen) bench.render();
  }
  const invScreen = new InventoryScreen(inv, thumbs, { close: () => resume(), drop: (it) => dropItem(it), rename: (it) => void renameItem(it), toast, changed: onWeaponChanged });
  const bench = new WorkshopScreen(inv, gen, view, thumbs, { close: () => { resume(); autosave(); }, changed: onWeaponChanged, rename: (it) => void renameItem(it), toast });
  const shop = new ShopScreen(inv, () => shopState, {
    close: () => { resume(); autosave(); }, toast, chime: (l) => lootChime(l),
    deliver: (rarity) => deliverPurchase(rarity),
    deliverSpec: (spec) => deliverSpec(spec),
    gameTime: () => playSeconds,
    equipNow: (spec) => { const it = inv.all.find((x) => x.spec === spec); const w = it && inv.find(it.uid); if (it && w) { if (w.area === "pack") inv.move(w, { area: "equip", index: inv.active }); else inv.active = w.index; inv.changed(); } },
  }, gen, thumbs);
  const start = new StartScreen(view, {
    mode: () => (inGame ? "pause" : "title"),
    play: () => resume(), newGame: () => { newGame(); resume(); },
    hasSaves: () => latestSave !== null, continueLatest: () => void (latestSave && loadSlot(latestSave)),
    listSlots: () => saves.list(),
    save: (slot) => saveSlot(slot), load: (slot) => loadSlot(slot), remove: async (slot) => { await saves.remove(slot); toast(t("save.deleted")); await refreshLatest(); },
    exportSlot: (slot) => exportSlot(slot), importSlot: (slot) => importSlot(slot),
    quit: () => quit(), canQuit: () => inGame || !!(window as unknown as { ppApp?: unknown }).ppApp,
    current: () => inv.current?.spec ?? showcase,
  });
  onLang(() => { renderSlots(); if (invScreen.isOpen) invScreen.render(); if (bench.isOpen) bench.render(); if (shop.isOpen) shop.render(); if (start.isOpen) start.render(); });

  function openScreen(s: "inventory" | "workbench" | "shop") {
    state = s; input.unlock();
    if (s === "inventory") invScreen.open(); else if (s === "workbench") bench.open(); else shop.open();
    nav.setRoot($(s === "workbench" ? "workbench" : s)); setTimeout(() => nav.first(), 0);
  }
  function openStart(panel?: "saves") {
    state = inGame ? "pause" : "title"; input.unlock();
    start.open(panel); nav.setRoot($("start")); setTimeout(() => (panel ? undefined : $("start").querySelector<HTMLElement>(".mainmenu button")?.focus()), 0);
  }
  function resume() {
    if (!inGame) { newGame(); }
    if (invScreen.isOpen) { invScreen.isOpen = false; $("inventory").hidden = true; }
    if (bench.isOpen) { bench.isOpen = false; $("workbench").hidden = true; }
    if (shop.isOpen) { shop.isOpen = false; $("shop").hidden = true; }
    start.close(); state = "play"; nav.setRoot(null); document.body.classList.remove("nav-keys");
    input.flush();
    input.lock();
  }
  document.addEventListener("pointerlockchange", () => { if (!input.locked && state === "play") openStart(); });

  // ---------- Partida: nueva, guardar, cargar ----------
  function newGame() {
    inv.clear(); pickups.list.slice().forEach((p) => pickups.remove(p)); waves.stop();
    // Armas iniciales: pistola y fusil equipados; escopeta y subfusil en la mochila. Sin accesorios sueltos.
    for (const spec of starterWeapons(gen)) inv.add(makeItem(spec));
    inv.credits = SHOP.startCredits; shopState = newShopState(); playSeconds = 0; inGame = true;
    inv.changed(); php.reset();
  }
  function collect(name = ""): SaveData {
    const weapons = [...inv.equip.map((it, i) => ({ it, area: "equip" as const, index: i })), ...inv.pack.map((it, i) => ({ it, area: "pack" as const, index: i }))]
      .filter((x) => x.it).map((x) => ({ spec: x.it!.spec, ammo: x.it!.ammo, area: x.area, index: x.index }));
    return { version: SAVE_VERSION, savedAt: "", name, playSeconds: Math.round(playSeconds), credits: inv.credits, weapons, active: inv.active, bank: inv.bank, shop: shopState,
      settings: { ...settings }, lang: getLang(), pixelLevel: pixelLevel() };
  }
  function apply(d: SaveData) {
    inv.clear(); pickups.list.slice().forEach((p) => pickups.remove(p)); waves.stop();
    for (const w of d.weapons) {
      const spec = w.spec;
      spec.rarity = RARITIES.find((r) => r.id === spec.rarity.id) ?? spec.rarity; // rareza con los datos actuales
      try { gen.refresh(spec); } catch { continue; } // estadísticas recalculadas desde las piezas (no se guardan mallas)
      const it = makeItem(spec, Math.min(w.ammo, spec.stats.cargador));
      const list = w.area === "equip" ? inv.equip : inv.pack;
      if (w.index >= 0 && w.index < list.length && !list[w.index]) list[w.index] = it; else inv.add(it);
    }
    inv.bank = d.bank; setAccUid(Math.max(0, ...d.bank.map((a) => a.uid)) + 1);
    inv.credits = d.credits; inv.active = inv.equip[d.active] ? d.active : Math.max(0, inv.equip.findIndex(Boolean));
    shopState = d.shop; playSeconds = d.playSeconds;
    replaceSettings(d.settings as Partial<Settings>); if (d.lang === "es" || d.lang === "en") setLang(d.lang as Lang); setPixelLevel(d.pixelLevel);
    inGame = true; php.reset(); inv.changed();
  }
  let latestSave: SlotId | null = null;
  async function refreshLatest() {
    const list = await saves.list();
    const ok = list.filter((x) => !x.empty && !x.error).sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
    latestSave = ok[0]?.slot ?? null; if (start.isOpen) start.render();
  }
  async function saveSlot(slot: SlotId) {
    if (!inGame) return;
    const prev = await saves.load(slot);
    let name = prev.ok ? prev.data.name : "";
    if (!prev.ok && slot !== AUTO) {
      const v = await dialog.ask(t("dlg.saveTitle"), t("save.defaultName", { n: SLOTS.indexOf(slot as never) + 1 }), t("save.defaultName", { n: SLOTS.indexOf(slot as never) + 1 }), t("dlg.saveHint"));
      if (v === null) return; name = v.trim() || t("save.defaultName", { n: SLOTS.indexOf(slot as never) + 1 });
    }
    try { await saves.save(slot, collect(name)); toast(t("save.saved")); } catch { toast(t("save.err.write")); }
    await refreshLatest();
  }
  async function loadSlot(slot: SlotId) {
    const r = await saves.load(slot);
    if (!r.ok) {
      toast(t(`save.err.${r.error}`));
      // Si falla, se ofrece el autoguardado (sin tocar las demás ranuras)
      if (slot !== AUTO && (await saves.load(AUTO)).ok) openStart("saves");
      return;
    }
    apply(r.data); if (r.dropped) toast(t("save.dropped", { n: r.dropped })); else toast(t("save.loaded"));
    resume();
  }
  let autosaveT = 0, saveDotT = 0;
  function autosave() {
    if (!inGame) return;
    autosaveT = 0;
    saves.save(AUTO, collect(t("save.auto"))).then(() => { saveDotT = 1.4; latestSave = latestSave ?? AUTO; }).catch(() => toast(t("save.err.write")));
  }
  async function exportSlot(slot: SlotId) {
    const txt = await saves.exportSlot(slot); if (!txt) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" }));
    a.download = `proving-grounds-${slot}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(t("save.exported"));
  }
  function importSlot(slot: SlotId) {
    return new Promise<void>((done) => {
      const f = document.createElement("input"); f.type = "file"; f.accept = ".json,application/json";
      f.onchange = async () => {
        const file = f.files?.[0]; if (!file) return done();
        const r = await saves.importSlot(slot, await file.text());
        toast(r.ok ? t("save.imported") : t(`save.err.${r.error}`)); await refreshLatest(); done();
      };
      f.click();
    });
  }
  function quit() {
    const app = (window as unknown as { ppApp?: { quit(): void } }).ppApp;
    if (inGame) { autosave(); inGame = false; waves.stop(); openStart(); return; }
    app?.quit();
  }

  // ---------- Créditos y máquina expendedora ----------
  function earn(n: number) { if (!n) return; inv.credits += n; creditsHud(); }
  function creditsHud() { $("crhud").textContent = `${inv.credits} ${t("unit.cr")}`; }
  let machineT = -1;
  const recentDrops: WeaponSpec[] = [];
  function rollWeapon(rarity: RarityId) {
    const types = gen.types;
    const spec = gen.generateDistinct(Math.floor(Math.random() * 1e9), types[Math.floor(Math.random() * types.length)], recentDrops, rarity);
    recentDrops.push(spec); if (recentDrops.length > 6) recentDrops.shift();
    return spec;
  }
  /** Compra: el arma va a la mochila; si no cabe, la máquina la compila en su bandeja (efecto de escaneo). */
  function deliverPurchase(rarity: RarityId): { spec: WeaponSpec; where: "pack" | "equip" | "tray" } { return deliverSpec(rollWeapon(rarity)); }
  /** Entrega un arma de la tienda: a la mochila; si no cabe, la máquina la compila en su bandeja. */
  function deliverSpec(spec: WeaponSpec): { spec: WeaponSpec; where: "pack" | "equip" | "tray" } {
    gen.refresh(spec);
    const it = makeItem(spec);
    machineT = 0; world.chestGlow.color.set(spec.rarity.color);
    if (inv.add(it)) return { spec, where: inv.find(it.uid)!.area };
    const pos = world.interactables.find((i) => i.id === "chest")!.position;
    const toward = player.pos.clone().sub(pos).setY(0).normalize();
    pickups.spawn(it, pos.clone().add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(toward, 0.3), toward.multiplyScalar(2.2).setY(4.2), { compile: true });
    return { spec, where: "tray" };
  }

  /** Suelta un arma delante del jugador (lo del suelo es temporal: no se guarda). */
  function dropItem(it: Item) {
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    pickups.spawn(it, player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(fwd, 0.6), fwd.multiplyScalar(2.5).setY(1.5));
    toast(t("ui.dropped", { n: displayName(it.spec) }));
  }
  /** Recoge el arma del suelo a la que apunta el jugador. */
  function pickUp(p: Pickup) {
    if (!inv.add(p.item)) { toast(t("ui.packFull")); return; }
    const wasLoot = p.expires != null;
    pickups.remove(p);
    const where = inv.find(p.item.uid);
    toast(`${displayName(p.item.spec)} · ${where?.area === "equip" ? t("ui.equippedTo") : t("ui.storedIn")}`);
    if (wasLoot) autosave();
  }

  // ---------- HUD ----------
  function renderSlots() {
    $("slots").innerHTML = inv.equip.map((it, i) => `<span class="${i === inv.active ? "on" : ""}" style="--c:${it?.spec.rarity.color ?? "#555"}"><kbd>${i + 1}</kbd>${it ? esc(displayName(it.spec)) : t("ui.empty")}</span>`).join("");
    creditsHud();
  }
  const ch = $("crosshair");
  function hud() {
    const it = gun.item, s = it?.spec;
    $("wname").textContent = s ? displayName(s) : t("ui.fists"); $("wname").style.color = s?.rarity.color ?? "";
    $("wtype").textContent = s ? `${rarityName(s)} · ${typeName(s.type)} · ${archName(s)}` : "";
    const ammo = $("ammo");
    ammo.innerHTML = it && s ? (gun.reloading ? `<small>${t("ui.reloading")}</small>` : `${it.ammo}<small> / ${s.stats.cargador}</small>`) : "";
    ammo.classList.toggle("low", !!it && !!s && it.ammo <= Math.ceil(s.stats.cargador * 0.25));
    $("hint").innerHTML = t(input.device === "pad" ? "hint.pad" : "hint.kbm");
    document.body.classList.toggle("pad", input.device === "pad");
    const moving = Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5);
    const spread = gun.spread(moving);
    const radius = 6 + Math.tan(THREE.MathUtils.degToRad(spread)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * innerHeight / 2;
    ch.style.setProperty("--r", `${Math.max(10, radius).toFixed(1)}px`);
    ch.dataset.type = s?.type ?? "fists";
    ch.style.opacity = state !== "play" || player.sprinting ? "0" : String(1 - gun.aimT * (gun.sight === "iron" ? 0.85 : 1));
    ch.classList.toggle("hit", gun.hitmarker > 0); ch.classList.toggle("crit", gun.critmarker > 0); ch.classList.toggle("kill", gun.killmarker > 0);
    document.body.classList.toggle("in-menu", state !== "play");
  }

  // ---------- Oleadas de prueba y vida del jugador ----------
  const php = new PlayerHealth();
  const waves = new Waves(scene, dummies, $("bars"), () => player.pos, onDummyDamage, {
    onWaveEnd: (i, last) => { toast(t("ui.waveDone", { n: i + 1 })); earn(SHOP.income.waveEnd); hooksWaveEnd(i, last); },
    onAllDone: () => { toast(t("ui.wavesDone")); autosave(); },
    onPlayerHit: (dmg) => {
      if (settings.screenShake) shake = Math.min(0.5, shake + 0.18);
      if (php.hit(dmg)) { waves.stop(); php.reset(); toast(t("ui.simReset")); }
      $("dmgflash").classList.remove("on"); void $("dmgflash").offsetWidth; $("dmgflash").classList.add("on");
    },
  });
  const hooksWaveEnd = (_i: number, last: Dummy | null) => dropLoot("waveEnd", last?.group.position ?? new THREE.Vector3(0, 0, 8));
  function healthHud() {
    // Vida del jugador: siempre visible abajo a la izquierda, con cifras (y la oleada en curso encima)
    const el = $("phealth"); const show = state === "play";
    el.hidden = !show; if (!show) return;
    el.querySelector<HTMLElement>("i")!.style.width = `${(php.value / php.max) * 100}%`;
    el.querySelector<HTMLElement>("span")!.textContent = `${Math.ceil(php.value)} / ${php.max}` + (waves.active ? `  ·  ${t("ui.waveN", { n: waves.index + 1, of: waves.total, left: waves.remaining })}` : "");
  }

  // ---------- Botín de enemigos ----------
  // Probabilidad, suelo, tope y rarezas en src/data/loot.json; la lógica (sin dibujo) en weapons/loot.ts.
  const loot = new LootDirector(Math.random);
  let gameTime = 0;
  const LEVEL: Record<string, number> = { comun: 0, poco: 1, rara: 2, epica: 3, legendaria: 4 };
  function dropLoot(source: LootSource, at: THREE.Vector3) {
    const onGround = pickups.list.filter((p) => p.expires != null).length;
    const rarity = loot.kill(source, gameTime, onGround);
    if (!rarity) return;
    const spec = rollWeapon(rarity);
    const a = Math.random() * Math.PI * 2;
    pickups.spawn(makeItem(spec), at.clone().setY(1.1), new THREE.Vector3(Math.cos(a) * 1.2, 3.4, Math.sin(a) * 1.2), { compile: true, expires: LOOT.expireSeconds });
    lootChime(LEVEL[rarity] ?? 0);
    if (LEVEL[rarity] >= 3) toast(t("ui.lootDrop", { r: t(`rarity.${rarity}`), n: spec.name }));
  }

  function nearInteractable(): Interactable | null {
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    for (const i of world.interactables) {
      const to = i.position.clone().sub(player.pos); to.y = 0;
      if (to.length() < i.radius && (to.length() < 1 || to.normalize().dot(fwd) > 0.3)) return i;
    }
    return null;
  }

  // ---------- Navegación de menús: teclado ----------
  const back = () => {
    if (dialog.isOpen) return dialog.cancel();
    if (state === "inventory") invScreen.close();
    else if (state === "workbench") bench.back();
    else if (state === "shop") shop.back();
    else if (state === "pause" || state === "title") start.back();
  };
  const activeScreen = () => (state === "inventory" ? invScreen : state === "workbench" ? bench : null);
  addEventListener("keydown", (e) => {
    if (state === "play" || dialog.isOpen) return;
    const dirs: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    if (dirs[e.code]) { e.preventDefault(); nav.move(dirs[e.code]); return; }
    if (e.code === "Escape" || e.code === "Backspace") { e.preventDefault(); back(); return; }
    if (state === "inventory" && (e.code === "Tab" || e.code === "KeyI")) { e.preventDefault(); invScreen.close(); return; }
    if (state === "workbench" && e.code === "KeyE") { bench.back(); return; }
    if (state === "shop" && (e.code === "KeyE")) { shop.back(); return; }
    if (state === "shop" && shop.isOpen) { shop.skip(); }
    if ((e.code === "Enter" || e.code === "Space") && !nav.current) { e.preventDefault(); nav.first(); return; }
    const scr = activeScreen(); if (scr && scr.key(e.code)) e.preventDefault();
  });
  addEventListener("mousemove", () => document.body.classList.remove("nav-keys"));

  // ---------- Bucle ----------
  const clock = new THREE.Clock();
  let shownPickup: Pickup | null = null;
  const debug = { fire: false, aim: false }; // usado por las pruebas automáticas
  let frameNo = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const edges = input.padEdges();
    const f = input.read(dt, edges);
    if (debug.fire) f.fire = true;
    if (debug.aim) f.aim = true;
    const pad = input.pad();
    const menu = state !== "play";
    cursor.show(menu); gun.hidden = menu;

    if (state === "play") {
      if (f.pause) { input.unlock(); openStart(); }
      if (f.inventory) openScreen("inventory");
      const key = `<kbd>${input.device === "pad" ? "Ⓑ" : "E"}</kbd>`;
      const look = camera.getWorldDirection(new THREE.Vector3());
      const ground = pickups.target(camera.position, look);
      const near = ground ? null : nearInteractable();
      $("prompt").hidden = !ground && !near;
      if (ground) $("prompt").innerHTML = `${key}${t("ui.pickup")}`;
      else if (near) $("prompt").innerHTML = `${key}${t(near.id === "chest" ? "ui.useShop" : near.id === "waves" ? (waves.active ? "ui.wavesStop" : "ui.wavesStart") : near.id === "inspect" ? "ui.inspect" : "ui.useBench")}`;
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
          if (near.id === "chest") openScreen("shop");
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
      const base = settings.fov, aimFov = gun.sight === "scope" ? base / gun.zoom : gun.sight === "iron" ? base / 1.35 : base / 1.6;
      camera.fov = THREE.MathUtils.lerp(player.sprinting ? base + 7 : base, aimFov, gun.aimT); camera.updateProjectionMatrix();
      playSeconds += dt; autosaveT += dt; if (autosaveT > 180) autosave(); // autoguardado cada 3 minutos de juego
    } else {
      $("prompt").hidden = true; $("pickcard").hidden = true; shownPickup = null;
      gun.update(dt, { fire: false, aim: false, moving: 0, sprinting: false, lookX: 0, lookY: 0, vy: 0, grounded: true, inspect: false });
      if (pad && !dialog.isOpen) {
        if (cursor.update(dt, pad.axes[0] ?? 0, pad.axes[1] ?? 0)) document.body.classList.remove("nav-keys");
        if (Math.abs(pad.axes[2] ?? 0) > 0.15 || Math.abs(pad.axes[3] ?? 0) > 0.15) view.rotate((pad.axes[2] ?? 0) * dt * 2.5, (pad.axes[3] ?? 0) * dt * 1.2);
        if ((pad.buttons[7]?.value ?? 0) > 0.2) view.zoomBy(1 - dt * 1.2); if ((pad.buttons[6]?.value ?? 0) > 0.2) view.zoomBy(1 + dt * 1.2);
        if (edges[12]) nav.move("up"); if (edges[13]) nav.move("down"); if (edges[14]) nav.move("left"); if (edges[15]) nav.move("right");
        if (edges[0]) { if (state === "shop") shop.skip(); if (nav.current && document.body.classList.contains("nav-keys")) nav.activate(); else cursor.click(); }
        if (edges[1]) back();
        const scr = activeScreen(); if (scr) for (const b of [2, 3, 4, 5, 11]) if (edges[b]) scr.pad(b);
        if (state === "inventory" && edges[8]) invScreen.close();
        if ((state === "pause") && edges[9]) resume();
      } else if (pad && dialog.isOpen) {
        if (cursor.update(dt, pad.axes[0] ?? 0, pad.axes[1] ?? 0)) document.body.classList.remove("nav-keys");
        nav.setRoot($("dialog"));
        if (edges[12]) nav.move("up"); if (edges[13]) nav.move("down"); if (edges[14]) nav.move("left"); if (edges[15]) nav.move("right");
        if (edges[0]) { if (nav.current && document.body.classList.contains("nav-keys")) nav.activate(); else cursor.click(); }
        if (edges[1]) dialog.cancel();
      }
      if (!dialog.isOpen && nav.current === null && document.activeElement?.closest("#dialog") === null) nav.setRoot($(state === "pause" || state === "title" ? "start" : state === "workbench" ? "workbench" : state));
    }
    player.applyCamera(camera, gun.recoil);
    camera.rotation.y += gun.recoilYaw;
    if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); camera.rotation.x += (Math.random() - 0.5) * shake * 0.04; camera.rotation.z += (Math.random() - 0.5) * shake * 0.03; }

    // Máquina: tapa y luz al entregar
    if (machineT >= 0) {
      machineT += dt;
      world.chestLid.rotation.x = -Math.min(1, machineT / 0.35) * 1.9 * (machineT > 1.6 ? Math.max(0, 1 - (machineT - 1.6) / 0.4) : 1);
      world.chestGlow.intensity = machineT < 1.6 ? 6 : Math.max(0, 6 * (1 - (machineT - 1.6) / 0.4));
      if (machineT > 2) { machineT = -1; world.chestLid.rotation.x = 0; }
    }
    toastTimer -= dt; if (toastTimer <= 0) $("toast").classList.remove("show");
    saveDotT -= dt; $("savedot").hidden = saveDotT <= 0; if (saveDotT > 0) $("savedot").textContent = t("save.autoDot");

    pickups.update(dt);
    if (state === "play") { waves.update(dt); php.update(dt); gameTime += dt; loot.tick(dt, gameTime); }
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
    if (state === "workbench" || state === "pause" || state === "title") view.update(dt);
    if (state === "shop") shop.update(dt);
    hud();
    // Detrás del inventario, el taller y la máquina la sala apenas se ve: se redibuja 1 de cada 4 fotogramas
    // (el inicio y la pausa la mantienen viva). Así abrir un menú no cuesta más que jugar.
    frameNo++;
    if (state === "play" || state === "title" || state === "pause" || frameNo % 4 === 0) draw();
    requestAnimationFrame(frame);
  }
  player.applyCamera(camera, 0);
  await refreshLatest();
  openStart();
  frame();
  (window as unknown as Record<string, unknown>).__game = {
    debug, gen, inv, gun, pickups, pickUp, player, setSetting, dummies, waves, php, bench, shop, start, invScreen, dialog, nav, saves,
    loot, dropLoot, openScreen, openStart, resume, newGame, collect, apply, autosave, setLang, earn,
    cardHTML: (s: WeaponSpec) => weaponCard(s), openChest: () => openScreen("shop"), get state() { return state; }, set state(v: State) { state = v; }, get shopState() { return shopState; },
  };
}

boot().catch((e) => { $("start-text").textContent = t("ui.loadError", { e: e.message }); console.error(e); });
