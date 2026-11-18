// Proving Grounds / Campo de Pruebas: demo jugable de la Fase 1.
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import * as THREE from "three";
import { GRENADE_RARITY, GrenadePouch, makeGrenade, setGrenadeUid, type GrenadeRarity, type GrenadeSpec } from "./grenades";
import { GrenadeFx } from "./grenadefx";
import { SuperFx } from "./superfx";
import { MODULE_CHANCE, SUPER_IDS, SuperMeter, rollModule, type SuperId } from "./supers";
import { PROGRESS, addXp, killXp, migrateProgress, overPenalty, perks as skillPerks, playerHealthMult, rollWeaponLevel, waveXp, xpToNext, MAX_LEVEL } from "./progress";
import { grenadeObject, loadGrenadeModel } from "./grenademodel";
import { applyEvent, claimAll, refreshContracts, type Contract, type ContractState } from "./contracts";
import { audio, initSounds, loadSamples, out, playSample, sample, soundManifest, startMusic } from "./audio";
import showcaseWeapon from "../data/showcase-weapon.json";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RARITIES, WeaponGenerator } from "../weapons/generator";
import { WeaponAssembler } from "../weapons/assembler";
import { archName, rarityName, typeName } from "../weapons/labels";
import { displayName, rename } from "../weapons/naming";
import { setAccUid } from "../weapons/accbank";
import type { Manifest, RarityId, WeaponSpec } from "../weapons/types";
import { getLang, onLang, setLang, t, type Lang } from "../i18n";
import { DEFAULT_BINDS, DEFAULT_PAD, Input, PAD_NAMES } from "./input";
import { buildRange, type Interactable } from "./world";
import { PIXEL_LEVELS, pixelLevel, setPixelLevel } from "../weapons/textures";
import { onSettings, replaceSettings, setSetting, settings, type Settings } from "./settings";
import { BOSS_EVERY, PlayerHealth, Waves } from "./waves";
import { WaveArena } from "./arena";
import { ARMOR_RARITY, armorTotals, damageTaken, makeArmor, setArmorUid, type ArmorRarity, type ArmorSpec } from "./armor";
import { armorObject, fillArmorThumbs } from "./armormodel";
import { generateArena, mutateArena } from "./arenagen";
import { Raid } from "./raid";
import { spawnDummies, DamageNumbers, type Dummy } from "./dummies";
import { Player } from "./player";
import { Gun } from "./gun";
import { Inventory, makeItem, type Item } from "./inventory";
import { Pickups, type Pickup } from "./pickups";
import { LOOT, LootDirector, type LootSource } from "../weapons/loot";
import { lootChime } from "./audio";
import { installPixelFont } from "./pixelfont";
import { CARD, armorCard, grenadeCard, $, MenuCursor, MenuNav, ModelView, Thumbnails, esc, weaponCard, type Dir } from "./ui/common";
import { InventoryScreen } from "./ui/inventory";
import { WorkshopScreen } from "./ui/workshop";
import { ShopScreen, fillNadeThumbs } from "./ui/shop";
import { StartScreen } from "./ui/start";
import { TextDialog } from "./ui/dialog";
import { AUTO, SLOTS, SAVE_VERSION, SaveManager, type SaveData, type SlotId } from "./save";
import { platformStorage } from "./storage";
import { SHOP, newShopState, type ShopState } from "./shop";

const ASSETS = "./weapons/";
void installPixelFont();
setLang(getLang());

// ---------- Render ----------
const renderer = new THREE.WebGLRenderer({ antialias: true }); // (sin profundidad logarítmica: caro en Android; las calcomanías usan polygonOffset, ver decal())
renderer.localClippingEnabled = true; // escaneo de los muñecos de la simulación
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
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
// Contorno extra para armas oscuras: según la luminancia del color principal del acabado (negro → más contorno)
let darkBoost = 0;
const weaponDarkness = (spec: WeaponSpec | null | undefined) => {
  const c = spec?.paint?.color; if (!c) return 0.5;
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return Math.max(0, Math.min(1, (0.35 - lum) / 0.3));
};
const applyLook = () => { world.setNight(settings.night); rim.intensity = (settings.night ? 0.8 : 0.4) + darkBoost * 1.1; rim.color.set(settings.night ? 0xc8b0ff : 0xbfd8ff); fill.intensity = settings.night ? 0.5 : 0; bloom.enabled = settings.bloom; bloom.strength = settings.night ? 0.55 : 0.3; renderer.toneMappingExposure = settings.night ? 1.25 : 1.0; };
applyLook(); onSettings(applyLook);
startMusic("./music/ambient-03.ogg");
// Pack de sonidos (assets/sonidos): manifest ahora; las muestras de cada arma se cargan al equiparla
void initSounds("./sonidos/").then((m) => { if (m) void loadSamples(["melee_cuchillo_swing", "melee_cuchillo_golpe", "melee_culatazo", "recoger_arma", "explosion"].flatMap((k) => m.efectos[k] ?? [])); });
const draw = () => (settings.bloom ? composer.render() : renderer.render(scene, camera));
function resize() { renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

// ---------- Estado ----------
type State = "title" | "play" | "pause" | "inventory" | "workbench" | "shop" | "contracts" | "raidmenu";
let state: State = "title";
let inGame = false; // hay una partida empezada (nueva o cargada)
const input = new Input(renderer.domElement);
const player = new Player(world.colliders);
const inv = new Inventory();
let contracts: ContractState = refreshContracts(null, new Date());
  let shopState: ShopState = newShopState();
let playSeconds = 0;
const numbers = new DamageNumbers($("numbers"));
const onDummyDamage = (d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => { if (settings.damageNumbers) numbers.spawn(amount, color, crit, at, d); };
/** Pausa mínima del mundo (hitstop) al matar o al hacer crítico: da peso a los impactos. */
let hitstop = 0;
const dummies: Dummy[] = spawnDummies(scene, world.lanes, $("bars"), onDummyDamage);
const cursor = new MenuCursor();
const nav = new MenuNav(cursor);
const saves = new SaveManager(platformStorage());
onLang(() => dummies.forEach((d) => d.relabel()));
const applySens = () => {
  input.sensitivity = 0.0022 * settings.sensitivity; input.padSensitivity = 3.2 * settings.sensitivity * settings.padSens;
  input.toggles = { sprint: settings.sprintToggle, aim: settings.aimToggle, crouch: settings.crouchToggle }; input.invertY = settings.invertY;
  input.binds = { ...DEFAULT_BINDS, ...settings.binds }; input.padBinds = { ...DEFAULT_PAD, ...settings.padBinds };
};
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
  // Contratos: último impacto de cada enemigo (para saber con qué arma, a qué distancia y dónde murió)
  const lastHit = new WeakMap<object, { head: boolean; dist: number; weapon: string | null }>();
  const contractEvent = (e: Parameters<typeof applyEvent>[1]) => {
    contracts = refreshContracts(contracts, new Date());
    for (const c of applyEvent(contracts, e)) toast(t("ct.done", { what: contractText(c), c: c.reward }));
  };
  const contractText = (c: Contract) => t(`ct.${c.kind}`, { n: c.goal, w: c.weapon ? t(`type.${c.weapon}`) : t("ct.any"), d: c.dist ?? 0 });
  const gun = new Gun(camera, scene, asm, world.shootables, {
    dummies: () => dummies,
    lunge: (dir, dist) => player.lunge(dir, dist),
    onHit(d, zone, point, dmg, element, crit) {
      lastHit.set(d, { head: zone === "head", dist: point.distanceTo(camera.position), weapon: gun.item ? (gun.spec?.type === "bullpup" ? "rifle" : gun.spec?.type ?? null) : null });
      // Escudo del guardián: casi todo rebota (chispas); sus piernas son su punto débil
      if (zone === "shield") { dmg *= 0.08; crit = false; } else if (d.kind.shield && zone === "limb") dmg *= 1.5;
      const wasAlive = d.alive, dealt = d.damage(dmg, element, crit, point);
      // Respuesta física al impacto (retroceso por zona, partículas, marca, destello) y pausa mínima al matar o hacer crítico
      d.react(zone, point, point.clone().sub(camera.position).normalize(), dmg, crit, settings.impactFx);
      if (wasAlive && !d.alive) hitstop = Math.max(hitstop, d.kind.boss ? 0.12 : 0.05); else if (crit) hitstop = Math.max(hitstop, 0.025);
      // Desmembramiento pixelado con impactos muy fuertes en cabeza o extremidades (francotirador, revólver, escopeta…),
      // solo con el golpe que lo mata (antes podía quitarle la cabeza y seguir vivo)
      if (!d.alive && (zone === "head" || zone === "limb") && settings.impactFx && (dmg >= 120 || (zone === "head" && crit && dmg >= 80) || (gun.spec?.type === "shotgun" && dmg * 8 >= 150 && point.distanceTo(camera.position) < 7))) {
        // Desmembramiento: que se note (pausa más larga, sacudida y crujido grave)
        d.dismember(zone, point); hitstop = Math.max(hitstop, 0.13); if (settings.screenShake) shake = Math.min(0.8, shake + 0.2);
        { const l = soundManifest?.efectos.explosion_grave; if (l?.length) playSample(sample(l[0]), 0.35, 1.6); }
      }
      const now = performance.now() / 1000;
      sim.hits++; sim.log.push([now, dealt]); sim.distance = point.distanceTo(camera.position);
      if (!sim.firstHit.has(d)) sim.firstHit.set(d, now);
      if (element === "fuego" || element === "electrico") d.applyStatus(element, dmg);
      if (!d.respawn) loot.combat(gameTime);
      else practiceEarn(dealt);
      return dealt;
    },
    onKill(d) {
      { const h = lastHit.get(d); contractEvent({ type: "kill", weapon: h?.weapon ?? null, head: !!h?.head, dist: h?.dist ?? 0, boss: !!d.kind.boss }); }
      if (d.kind.boss) toast(t("ui.bossDown"));
      if (d.kind.key === "roller") gun.explode(d.center, 220, "explosive", d); // (el kamikaze revienta sobre los suyos)
      if (!d.respawn && !sfx.casting && !sfx.busy) meter.kill(!!d.kind.boss);
      const t0 = sim.firstHit.get(d); if (t0 != null) { sim.ttk = performance.now() / 1000 - t0; sim.firstHit.delete(d); }
      // Botín y créditos: solo los enemigos de las oleadas (los blancos de práctica reaparecen y no sueltan nada)
      if (!d.respawn) {
        const sc = d.kind.scale ?? 1, src: LootSource = d.kind.boss || sc >= 1.3 ? "big" : sc < 0.85 ? "small" : "normal";
        earn(Math.round((d.kind.boss ? SHOP.income.boss : SHOP.income[src as "small" | "normal" | "big"]) * curPerks.fortune));
        gainXp(killXp(d.kind.key, d.kind.level));
        if (Math.random() < (d.kind.boss ? MODULE_CHANCE.boss : src === "big" ? MODULE_CHANCE.big : MODULE_CHANCE.kill)) grantModule();
        dropLoot(src, d.group.position);
      }
    },
    onShot() { sim.shots++; sim.lastShot = performance.now() / 1000; },
    hurt(dmg) { hurtPlayer(dmg); },
  });
  gun.env = weaponEnv;
  // Granadas: la equipada se lanza con G / RB / botón táctil; sus cargas se recargan solas
  const pouch = new GrenadePouch(null);
  const nades = new GrenadeFx(scene, {
    dummies: () => dummies,
    onHit(d, point, dmg, element) { const alive = d.alive; gun.hooks.onHit(d, "body", point, dmg, element, false); if (alive && !d.alive) gun.hooks.onKill?.(d); },
  });
  // Súper: se carga con bajas (y algo con el tiempo); V / cruceta arriba / ✦ lo invoca con su animación en primera persona
  const meter = new SuperMeter();
  const sfx = new SuperFx(scene, {
    dummies: () => dummies,
    onHit(d, point, dmg, element) { const alive = d.alive; gun.hooks.onHit(d, "body", point, dmg, element, false); if (alive && !d.alive) gun.hooks.onKill?.(d); },
    shake: (n) => { if (settings.screenShake) shake = Math.min(0.8, shake + n); },
    aim(max) {
      // Punto del suelo al que se mira (o el más lejano en esa dirección si se mira al horizonte)
      const o = camera.getWorldPosition(new THREE.Vector3()), dir = camera.getWorldDirection(new THREE.Vector3());
      const d = dir.y < -0.02 ? Math.min(max, -o.y / dir.y) : max; return o.addScaledVector(dir, d).setY(0);
    },
    heal: (n) => { php.value = n == null ? php.max : Math.min(php.max, php.value + n); },
    levitate: (sec, h) => player.levitate(sec, h),
    sig: (id) => superSig(id),
    hand: () => camera.localToWorld(new THREE.Vector3(0.15, -0.15, -0.6)),
    sound(kind) {
      const e = soundManifest?.efectos; if (!e) return;
      if (kind === "boom") { const l = e.explosion_grave; if (l?.length) playSample(sample(l[0]), 0.7); const x = e.explosion; if (x?.length) playSample(sample(x[Math.floor(Math.random() * x.length)]), 0.5, 0.8); }
      else { const l = e.flash_aturdidora; if (l?.length) playSample(sample(l[Math.floor(Math.random() * l.length)]), kind === "zap" ? 0.35 : kind === "shot" ? 0.08 : 0.5, kind === "zap" ? 1.5 : kind === "shot" ? 2.6 : 1); }
    },
  });
  /**
   * Firma sonora de cada súper (sintetizada): tono base, forma de onda, barrido de frecuencia, ruido y duración.
   * Suena al desatarse, por encima de los efectos del pack (explosión, descarga).
   */
  const SIG: Record<SuperId, { f0: number; f1: number; wave: OscillatorType; len: number; noise: number; lp: number; vol: number; chord?: number[] }> = {
    overload: { f0: 120, f1: 520, wave: "sawtooth", len: 0.7, noise: 0.1, lp: 2400, vol: 0.12, chord: [1.5] },
    shockwave: { f0: 90, f1: 35, wave: "sine", len: 0.8, noise: 0.5, lp: 900, vol: 0.3 },
    storm: { f0: 900, f1: 200, wave: "square", len: 0.5, noise: 0.4, lp: 4000, vol: 0.07 },
    inferno: { f0: 180, f1: 70, wave: "sawtooth", len: 0.9, noise: 0.7, lp: 1600, vol: 0.12 },
    stasis: { f0: 1400, f1: 2600, wave: "sine", len: 1.1, noise: 0.15, lp: 6000, vol: 0.08, chord: [1.26, 1.5] },
    orbital: { f0: 2200, f1: 600, wave: "triangle", len: 0.6, noise: 0.05, lp: 5000, vol: 0.09, chord: [0.5] },
    seekers: { f0: 600, f1: 1400, wave: "square", len: 0.35, noise: 0.2, lp: 3000, vol: 0.06 },
    aegis: { f0: 330, f1: 440, wave: "triangle", len: 1.0, noise: 0, lp: 3000, vol: 0.12, chord: [1.25, 1.5] },
    deadeye: { f0: 1800, f1: 1600, wave: "sine", len: 0.5, noise: 0, lp: 6000, vol: 0.08, chord: [2] },
    vortex: { f0: 300, f1: 60, wave: "sawtooth", len: 1.2, noise: 0.3, lp: 1200, vol: 0.12, chord: [0.75] },
    sentry: { f0: 500, f1: 900, wave: "square", len: 0.3, noise: 0.1, lp: 2500, vol: 0.06, chord: [1.5] },
    zerog: { f0: 200, f1: 800, wave: "sine", len: 1.4, noise: 0.1, lp: 3000, vol: 0.14, chord: [1.5, 2] },
    chrono: { f0: 800, f1: 100, wave: "triangle", len: 1.5, noise: 0.05, lp: 2000, vol: 0.12, chord: [0.5] },
    leech: { f0: 140, f1: 90, wave: "sawtooth", len: 0.9, noise: 0.2, lp: 900, vol: 0.12, chord: [1.06] },
    decoy: { f0: 700, f1: 1100, wave: "triangle", len: 0.6, noise: 0.05, lp: 4000, vol: 0.08, chord: [1.33] },
  };
  function superSig(id: SuperId) {
    try {
      const a = audio(), t0 = a.currentTime, s = SIG[id], g = a.createGain(), f = a.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = s.lp; f.connect(g); g.connect(out());
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(s.vol, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0008, t0 + s.len);
      for (const k of [1, ...(s.chord ?? [])]) { const o = a.createOscillator(); o.type = s.wave; o.frequency.setValueAtTime(s.f0 * k, t0); o.frequency.exponentialRampToValueAtTime(s.f1 * k, t0 + s.len); o.connect(f); o.start(t0); o.stop(t0 + s.len + 0.05); }
      if (s.noise) { const b = a.createBuffer(1, Math.ceil(a.sampleRate * s.len), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2) * s.noise; const n = a.createBufferSource(); n.buffer = b; n.connect(f); n.start(t0); }
    } catch { /* sin audio */ }
  }
  const superHud = () => {
    const el = $("superhud"); el.hidden = state !== "play" || !inv.hasSuper(inv.superId);
    document.body.classList.toggle("chrono", state === "play" && sfx.activeId === "chrono");
    const left = sfx.activeLeft, pct = left > 0 ? Math.round((left / sfx.activeTotal) * 100) : Math.round(meter.charge * 100);
    el.className = left > 0 ? "on" : meter.ready ? "ready" : "";
    document.body.classList.toggle("deadeye", state === "play" && sfx.activeId === "deadeye"); document.body.classList.toggle("aegis", state === "play" && sfx.activeId === "aegis");
    el.innerHTML = `<span>${t(`sp.${inv.superId}`)}</span><span class="bar"><i style="width:${pct}%"></i></span><b>${left > 0 ? Math.ceil(left) + " s" : meter.ready ? `<kbd>${input.device === "pad" ? PAD_NAMES[input.padBinds.super] : input.binds.super.replace(/^Key/, "")}</kbd>` : pct + " %"}</b>`;
  };
  const syncNade = () => { if (pouch.g !== inv.grenade) { const fresh = pouch.g == null; pouch.equip(inv.grenade); if (fresh && inv.grenade) pouch.charges = inv.grenade.charges; } };
  const nadeHud = () => {
    const el = $("nadehud"), g = inv.grenade; el.hidden = !g; if (!g) return;
    el.style.color = GRENADE_RARITY[g.rarity].color;
    el.innerHTML = `<span>${t(`gr.${g.kind}`)}</span>${Array.from({ length: g.charges }, (_, i) => `<span class="pip${i < pouch.charges ? " on" : ""}"></span>`).join("")}${pouch.charges < g.charges ? `<span class="rc"><i style="width:${Math.round(pouch.progress * 100)}%"></i></span>` : ""}`;
  };
  gun.actionOf = (sp) => gen.byId.get(sp.parts[0].from)?.action;
  const pickups = new Pickups(scene, asm, world.colliders);
  // Compilación de shaders en segundo plano (KHR_parallel_shader_compile): armas nuevas sin congelar el juego
  const prewarm = (o: THREE.Object3D) => { o.updateMatrixWorld(true); return renderer.compileAsync(o, camera, scene); };
  gun.prewarm = prewarm; pickups.prewarm = prewarm;
  inv.devUnlock = settings.dev; onSettings(() => (inv.devUnlock = settings.dev));
  inv.onChange(() => { if (gun.item !== inv.current) void gun.equip(inv.current); darkBoost = weaponDarkness(inv.current?.spec); applyLook(); renderSlots(); });

  // Arma de muestra para la pantalla de título (antes de empezar): una legendaria girando sobre la rejilla
  // Storm Caller: la legendaria de referencia de calidad, congelada (su ficha no depende de cambios del generador)
  const showcase = structuredClone(showcaseWeapon) as unknown as WeaponSpec;

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
  const invScreen = new InventoryScreen(inv, thumbs, { close: () => resume(), drop: (it) => dropItem(it), dropNade: (g) => dropNade(g, player.pos.clone().add(new THREE.Vector3(-Math.sin(player.yaw) * 1.5, 0, -Math.cos(player.yaw) * 1.5)), true), rename: (it) => void renameItem(it), toast, changed: onWeaponChanged, perks: () => { applyPerks(); autosave(); }, armorChanged: () => { applyPerks(); autosave(); }, dropArmor: (a) => dropArmor(a, player.pos.clone().add(new THREE.Vector3(-Math.sin(player.yaw) * 1.5, 0, -Math.cos(player.yaw) * 1.5)), true) });
  const bench = new WorkshopScreen(inv, gen, view, thumbs, { close: () => { resume(); autosave(); }, changed: onWeaponChanged, rename: (it) => void renameItem(it), toast });
  const shop = new ShopScreen(inv, () => shopState, {
    close: () => { resume(); autosave(); }, toast, chime: (l) => lootChime(l), sold: (it) => { gun.forget(it.uid); onWeaponChanged(null); },
    deliver: (rarity) => deliverPurchase(rarity),
    deliverSpec: (spec) => deliverSpec(spec),
    armorChanged: () => applyPerks(),
    gameTime: () => playSeconds,
    weaponLevel: (seed) => rollWeaponLevel(inv.progress.level, ((seed * 2654435761) >>> 0) / 2 ** 32), playerLevel: () => inv.progress.level,
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
    bindPad: (action, done) => input.capturePad((btn) => { if (btn >= 0) setSetting("padBinds", { ...settings.padBinds, [action]: btn }); done(); }),
    bindKey: (action, done) => input.captureKey((code) => { if (code) setSetting("binds", { ...settings.binds, [action]: code }); done(); }),
    dev(a) {
      if (!inGame) { toast(t("set.dev.needGame")); return; }
      if (a === "lvl1" || a === "lvl10") { const p = inv.progress, n = a === "lvl1" ? 1 : 10; let need = 0; for (let l = p.level; l < Math.min(MAX_LEVEL, p.level + n); l++) need += xpToNext(l); gainXp(Math.max(0, need - p.xp)); toast(t("pg.levelUp", { l: inv.progress.level, p: n })); }
      else if (a === "cr") earn(10000);
      else if (a === "modules") { inv.supersOwned = [...SUPER_IDS]; toast(t("set.dev.modulesDone")); }
      else if (a === "raid") { inv.raidsDone = 0; toast(t("set.dev.raidDone")); }
      else if (a === "armor") { for (const sl of ["head", "torso", "legs"] as const) for (const v of ["light", "heavy"] as const) if (inv.armors.length < 12) inv.armors.push(makeArmor(Math.floor(Math.random() * 1e9), sl, "epica", v)); toast(t("set.dev.armorDone")); }
      autosave();
    },
  });
  onLang(() => { renderSlots(); if (invScreen.isOpen) invScreen.render(); if (bench.isOpen) bench.render(); if (shop.isOpen) shop.render(); if (start.isOpen) start.render(); });

  function openScreen(s: "inventory" | "workbench" | "shop", storage = false) {
    state = s; input.unlock();
    if (s === "inventory") invScreen.open(storage); else if (s === "workbench") bench.open(); else shop.open();
    nav.setRoot($(s === "workbench" ? "workbench" : s)); setTimeout(() => nav.first(), 0);
  }
  /** Tablero de contratos: lista, progreso y cobro de los completados. */
  function openContracts() {
    contracts = refreshContracts(contracts, new Date());
    state = "contracts"; input.unlock();
    const el = $("contracts"); el.hidden = false;
    const row = (c: Contract) => `<div class="ct-row${c.done ? " done" : ""}${c.claimed ? " claimed" : ""}"><span class="ct-what">${contractText(c)}</span>
      <span class="ct-bar"><i style="width:${Math.round((c.progress / c.goal) * 100)}%"></i></span><span class="ct-n">${c.progress}/${c.goal}</span><span class="ct-cr">${c.claimed ? t("ct.claimed") : `${c.reward} CR`}</span></div>`;
    const ready = contracts.list.filter((c) => c.done && !c.claimed).length;
    el.innerHTML = `<div class="term"><header class="termbar"><span class="sim">SIM//</span><h1>${t("ct.title")}</h1><span class="credits">${inv.credits} CR</span><button type="button" class="btn ghost sm" data-close="1">${t("ui.back")}</button></header>
      <section class="panel ct-list"><h2>${t("ct.daily")}</h2>${contracts.list.filter((c) => c.period === "day").map(row).join("")}
      <h2>${t("ct.weekly")}</h2>${contracts.list.filter((c) => c.period === "week").map(row).join("")}
      <div class="actions"><button type="button" class="btn" data-claim="1" ${ready ? "" : "disabled"}>${t("ct.claim", { n: ready })}</button></div></section></div>`;
    nav.setRoot(el); setTimeout(() => nav.first(), 0);
  }
  function closeContracts() { $("contracts").hidden = true; resume(); }
  $("contracts").addEventListener("click", (e) => {
    const tg = e.target as HTMLElement;
    if (tg.closest("[data-close]")) return closeContracts();
    if (tg.closest("[data-claim]")) { const n = claimAll(contracts); if (n) { earn(n); gainXp(n * PROGRESS.contractXpPerCredit); toast(t("ct.paid", { c: n })); autosave(); } openContracts(); }
  });

  function openStart(panel?: "saves") {
    state = inGame ? "pause" : "title"; input.unlock(); if (inGame) autosave(); // guardar al pausar
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
    if (raid.active) raid.end();
    inv.clear(); pickups.list.slice().forEach((p) => pickups.remove(p)); waves.stop();
    // Se empieza sin nada: puños y 0 créditos. El primer dinero sale de golpear o disparar a los muñecos de práctica.
    inv.credits = SHOP.newGameCredits; practice.acc = 0; practice.window = []; shopState = newShopState(); playSeconds = 0; inGame = true;
    applyPerks(); inv.changed(); php.reset();
    toast(t("ui.practiceTip"));
  }
  function collect(name = ""): SaveData {
    const weapons = [...inv.equip.map((it, i) => ({ it, area: "equip" as const, index: i })), ...inv.pack.map((it, i) => ({ it, area: "pack" as const, index: i })), ...inv.storage.map((it, i) => ({ it, area: "storage" as const, index: i }))]
      .filter((x) => x.it).map((x) => ({ spec: x.it!.spec, ammo: x.it!.ammo, area: x.area, index: x.index }));
    return { version: SAVE_VERSION, savedAt: "", name, playSeconds: Math.round(playSeconds), credits: inv.credits, weapons, active: inv.active, bank: inv.bank, shop: shopState,
      settings: { ...settings }, lang: getLang(), pixelLevel: pixelLevel(), contracts, grenades: inv.grenades, grenadeActive: inv.grenadeActive, superId: inv.superId, progress: inv.progress, supersOwned: inv.supersOwned, raidsDone: inv.raidsDone, armors: inv.armors, worn: inv.worn };
  }
  function apply(d: SaveData) {
    if (raid.active) returnHub(false);
    inv.clear(); pickups.list.slice().forEach((p) => pickups.remove(p)); waves.stop();
    for (const w of d.weapons) {
      const spec = w.spec;
      spec.rarity = RARITIES.find((r) => r.id === spec.rarity.id) ?? spec.rarity; // rareza con los datos actuales
      try { gen.refresh(spec); } catch { continue; } // estadísticas recalculadas desde las piezas (no se guardan mallas)
      const it = makeItem(spec, Math.min(w.ammo, spec.stats.cargador));
      const list = inv.list(w.area);
      if (w.index >= 0 && w.index < list.length && !list[w.index]) list[w.index] = it; else inv.add(it);
    }
    inv.bank = d.bank; setAccUid(Math.max(0, ...d.bank.map((a) => a.uid)) + 1);
    inv.credits = d.credits; inv.active = inv.equip[d.active] ? d.active : Math.max(0, inv.equip.findIndex(Boolean));
    shopState = d.shop; playSeconds = d.playSeconds; contracts = refreshContracts(d.contracts, new Date());
    inv.armors = d.armors ?? []; inv.worn = { head: null, torso: null, legs: null, ...(d.worn ?? {}) }; setArmorUid(Math.max(0, ...inv.armors.map((a) => a.uid)) + 1);
    inv.grenades = d.grenades ?? []; inv.grenadeActive = inv.grenades[d.grenadeActive ?? -1] ? d.grenadeActive! : -1; setGrenadeUid(Math.max(0, ...inv.grenades.map((g) => g.uid)) + 1); pouch.equip(null);
    inv.superId = (SUPER_IDS as string[]).includes(d.superId ?? "") ? (d.superId as SuperId) : "shockwave"; meter.charge = 0;
    // Súperes: las partidas de antes de los módulos conservan el que tenían elegido
    inv.supersOwned = (d.supersOwned ?? (d.superId ? [d.superId] : [])).filter((x): x is SuperId => (SUPER_IDS as string[]).includes(x)); inv.raidsDone = d.raidsDone ?? 0;
    inv.progress = migrateProgress(d.progress, inv.all.map((it) => it.spec.level)); applyPerks();
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
  // Autoguardado también al salir de la pestaña o cerrar la ventana (sin perder lo último)
  addEventListener("visibilitychange", () => { if (document.hidden) autosave(); });
  addEventListener("pagehide", () => autosave());
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
  // Muñecos de práctica: créditos por daño, con tope por minuto de juego (ventana deslizante)
  const practice = { acc: 0, window: [] as [number, number][] };
  function practiceEarn(dealt: number) {
    const P = SHOP.practice; practice.acc += dealt * P.perDamage;
    const whole = Math.floor(practice.acc); if (whole < 1) return;
    practice.acc -= whole;
    practice.window = practice.window.filter(([t]) => playSeconds - t < 60);
    const room = P.capPerMinute - practice.window.reduce((a, [, n]) => a + n, 0);
    const n = Math.min(whole, Math.max(0, room)); if (!n) return;
    practice.window.push([playSeconds, n]); earn(n);
  }
  function earn(n: number) { if (!n) return; inv.credits += n; creditsHud(); }
  function creditsHud() { $("crhud").textContent = `${inv.credits} ${t("unit.cr")}`; }
  // ---------- Nivel y habilidades ----------
  let curPerks = skillPerks(inv.progress), windUsed = false, xpShown = "", xpShowT = 0, armorT = armorTotals([]);
  /** Aplica el árbol y el nivel: arma, vida, regeneración, súper, granadas y velocidad. */
  function applyPerks() {
    const p = curPerks = skillPerks(inv.progress); CARD.playerLevel = inv.progress.level;
    gun.perks.rate = p.rate; gun.perks.critMult = p.critMult; gun.perks.ammoSave = p.ammoSave; gun.perks.dmg = p.dmg;
    php.setMax(PlayerHealth.BASE * playerHealthMult(inv.progress.level) * p.health); php.regenMult = p.regen; php.delayMult = p.regenDelay;
    meter.gain = p.superGain; sfx.power = p.superPower; sfx.span = p.superSpan; player.speedMult = p.speed;
    // Armadura puesta: reducción de daño (en hurtPlayer) y sus ventajas sobre lo anterior
    const A = armorT = armorTotals(inv.wornList), q = A.perk;
    php.setMax(php.max * (1 + q.health)); php.regenMult *= 1 + q.regen; php.delayMult *= Math.max(0.3, 1 - q.regenDelay);
    player.speedMult *= Math.max(0.7, 1 + q.speed - A.slow); meter.gain *= 1 + q.superGain; gun.perks.critMult *= 1 + q.critDmg; gun.perks.reload = q.reload;
    armorNade = 1 + q.nadeRecharge;
    xpShown = "";
  }
  /** Módulo de súper: desbloquea uno que no tengas (si ya los tienes todos, se cambia por créditos). */
  function grantModule() {
    const id = rollModule(inv.supersOwned, Math.random());
    if (!id) { earn(400); toast(t("sp.moduleDup", { c: 400 })); return; }
    inv.supersOwned.push(id); if (!inv.supersOwned.includes(inv.superId)) inv.superId = id;
    lootChime(4); toast(t("sp.moduleGot", { n: t(`sp.${id}`) })); autosave();
  }
  function gainXp(n: number) {
    const up = addXp(inv.progress, n * curPerks.fortune); xpShowT = 4; // (la barra se ve unos segundos al ganar experiencia)
    if (up) {
      applyPerks(); php.value = php.max; lootChime(3);
      toast(t("pg.levelUp", { l: inv.progress.level, p: up }));
      if (invScreen.isOpen) invScreen.render();
    }
  }
  function xpHud(dt = 0) {
    const el = $("xphud"); el.hidden = state !== "play"; if (el.hidden) return;
    xpShowT = Math.max(0, xpShowT - dt); el.classList.toggle("showbar", xpShowT > 0);
    const p = inv.progress, need = xpToNext(p.level), key = `${p.level}:${p.xp}:${getLang()}`;
    if (key === xpShown) return; xpShown = key;
    const max = p.level >= MAX_LEVEL;
    el.innerHTML = `<b>${t("pg.lv")} ${p.level}</b><span class="bar"><i style="width:${max ? 100 : Math.round((p.xp / need) * 100)}%"></i></span><small>${max ? t("pg.max") : `${p.xp} / ${need} XP`}</small>`;
  }
  let machineT = -1;
  const recentDrops: WeaponSpec[] = [];
  function rollWeapon(rarity: RarityId) {
    // (el bullpup no es categoría propia: sale como una variante de fusil, 1 de cada 4)
    const types = gen.types.filter((t) => t !== "bullpup");
    let type: (typeof gen.types)[number] = types[Math.floor(Math.random() * types.length)];
    if (type === "rifle" && gen.types.includes("bullpup") && Math.random() < 0.25) type = "bullpup";
    const spec = gen.generateDistinct(Math.floor(Math.random() * 1e9), type, recentDrops, rarity);
    spec.level = rollWeaponLevel(inv.progress.level, Math.random()); gen.refresh(spec); // (al nivel del jugador)
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
    if (inv.add(it)) return { spec, where: inv.find(it.uid)!.area as "pack" | "equip" };
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
    { const l = soundManifest?.efectos.recoger_arma; if (l?.length) playSample(sample(l[0]), 0.5); }
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
    // Escopeta: círculo algo más pequeño (su dispersión es muy grande y el aro llenaba la pantalla)
    ch.style.setProperty("--r", `${((Math.max(10, radius) + gun.crossKick * 9) * (s?.type === "shotgun" ? 0.65 : 1)).toFixed(1)}px`);
    ch.dataset.type = s?.type ?? "fists";
    // Francotirador: sin punto de mira salvo al apuntar (con su mira o con el zoom del arma)
    const sniperHidden = s?.type === "sniper" && (gun.aimT < 0.4 || (gun.sight === "scope" && gun.aimT > 0.9)); // (con visor a pantalla completa, el visor ya trae su retícula)
    ch.style.opacity = state !== "play" || sniperHidden ? "0" : player.sprinting ? "0.9" : String(1 - gun.aimT * (gun.sight === "iron" ? 0.35 : 1));
    ch.classList.toggle("sprint", state === "play" && player.sprinting);
    ch.classList.toggle("hit", gun.hitmarker > 0); ch.classList.toggle("crit", gun.critmarker > 0); ch.classList.toggle("kill", gun.killmarker > 0);
    document.body.classList.toggle("in-menu", state !== "play");
  }

  // ---------- Oleadas de prueba y vida del jugador ----------
  const php = new PlayerHealth();
  let waveHurt = false;
  const waves = new Waves(scene, dummies, $("bars"), () => player.pos, onDummyDamage, {
    onWaveStart: (_i, mod) => { php.noRegen = mod === "noregen"; if (mod) toast(t("wm.start", { m: t(`wm.${mod}`), d: t(`wm.d.${mod}`) })); },
    onWaveEnd: (i, last, reward) => {
      contractEvent({ type: "wave", reached: i + 1, clean: !waveHurt }); waveHurt = false; toast(t("ui.waveDone", { n: i + 1 })); earn(Math.round(SHOP.income.waveEnd * reward * curPerks.fortune)); gainXp(waveXp(i + 1, inv.progress.level) * reward); windUsed = false; hooksWaveEnd(i, last);
      if ((i + 1) % BOSS_EVERY === 0 && arena.layout) { arena.set(mutateArena(arena.layout, arena.bounds), true, player.pos); toast(t("ui.arenaShift")); } },
    onAllDone: () => { toast(t("ui.wavesDone")); autosave(); },
    onSelfDestruct: (d) => selfDestruct(d),
    onPlayerHit: (dmg, kind) => {
      waveHurt = true;
      if (settings.screenShake) shake = Math.min(0.5, shake + 0.18);
      hurtPlayer(dmg, kind);
      $("dmgflash").classList.remove("on"); void $("dmgflash").offsetWidth; $("dmgflash").classList.add("on");
    },
  });
  waves.playerLevel = () => inv.progress.level;
  /** Kamikaze que llega al jugador: explota (también daña a los suyos) y desaparece sin dar recompensa. */
  function selfDestruct(d: Dummy) { const at = d.center; d.damage(1e9, null, false, at); gun.explode(at, 140, "explosive", d); if (settings.screenShake) shake = Math.min(0.8, shake + 0.35); }
  /** Daño al jugador: Égida y resistencia del árbol; Segundo aliento salva una vez por oleada. */
  function hurtPlayer(dmg: number, kind: "melee" | "orb" | "explosive" = "melee") {
    dmg *= sfx.guard * curPerks.guard * damageTaken(armorT, kind); // (armadura: reducción y resistencias)
    if (curPerks.secondWind && !windUsed && php.value - dmg <= 0) { windUsed = true; php.value = php.max * 0.4; toast(t("pg.secondWind")); return; }
    if (php.hit(dmg)) {
      windUsed = false;
      if (raid.active) { toast(t("rd.lost")); returnHub(false); return; }
      waves.stop(); php.reset(); toast(t("ui.simReset"));
    }
  }
  // ---------- Incursiones (ordenador de la sala B) ----------
  const mobs = new Waves(scene, dummies, $("bars"), () => player.pos, onDummyDamage, {
    onWaveEnd() {}, onAllDone() {}, onSelfDestruct: (d) => selfDestruct(d),
    onPlayerHit: (dmg, kind) => { if (settings.screenShake) shake = Math.min(0.5, shake + 0.18); hurtPlayer(dmg, kind); $("dmgflash").classList.remove("on"); void $("dmgflash").offsetWidth; $("dmgflash").classList.add("on"); },
  });
  mobs.playerLevel = () => inv.progress.level;
  waves.decoy = mobs.decoy = () => sfx.decoyPos;
  let raidOpt: { rooms: number; difficulty: 0 | 1 | 2 } = { rooms: 6, difficulty: 0 }, raidReturnT = -1;
  const RAID_DIFF = [{ rarity: "rara", cr: 1, xp: 0.3 }, { rarity: "epica", cr: 1.6, xp: 0.45 }, { rarity: "legendaria", cr: 2.4, xp: 0.6 }] as const;
  const raid = new Raid(scene, {
    mobs, colliders: world.colliders, shootables: world.shootables, toast,
    onClear: (n, of) => toast(t("rd.cleared", { n, of: of - 1 })),
    onChest: (at) => { if (Math.random() < MODULE_CHANCE.raidChest) grantModule(); for (let i = 0; i < 2; i++) dropLoot("big", at.clone().add(new THREE.Vector3((i - 0.5) * 0.8, 0, 0))); toast(t("rd.chest")); },
    onWin: () => {
      const D = RAID_DIFF[raidOpt.difficulty], k = raidOpt.rooms / 6;
      const rarity = (D.rarity === "legendaria" && Math.random() < 0.5 ? "epica" : D.rarity) as RarityId;
      const it = makeItem(rollWeapon(rarity));
      if (!inv.add(it)) { const i = inv.storage.indexOf(null); if (i >= 0) { inv.storage[i] = it; inv.changed(); } }
      const cr = Math.round((120 + 12 * inv.progress.level) * D.cr * k * curPerks.fortune); earn(cr);
      gainXp(xpToNext(inv.progress.level) * D.xp * k);
      lootChime(4); toast(t("rd.won", { n: it.spec.name, c: cr }));
      inv.raidsDone++;
      if (inv.raidsDone === 1 || Math.random() < MODULE_CHANCE.raidBoss + MODULE_CHANCE.raidBossPerDifficulty * raidOpt.difficulty) setTimeout(grantModule, 1800); // (la primera incursión, seguro)
      raidReturnT = 6;
    },
  });
  /** Vuelve al vestíbulo (sala B, junto al ordenador) al ganar o morir. Al ganar, el botín del suelo viene contigo. */
  function returnHub(won: boolean) {
    const loot = won ? pickups.list.filter((p) => raid.contains(p.root.position)) : [];
    raid.end(); raidReturnT = -1; sfx.reset();
    const pc = world.interactables.find((i) => i.id === "raid")!.position;
    player.pos.set(pc.x - 2.5, 0, pc.z); player.vel.set(0, 0, 0); player.yaw = Math.PI / 2; player.pitch = 0;
    loot.forEach((p, i) => { p.root.position.set(pc.x - 4.5, 1.1, pc.z - 2 + i * 0.9); p.vel.set(0, 0, 0); p.resting = false; });
    php.reset(); autosave();
  }
  function startRaid() {
    const at = raid.start((Math.random() * 2 ** 31) | 0, raidOpt);
    mobs.index = raidOpt.difficulty * 5; // (nivel de los enemigos: +1 por cada 5)
    player.pos.copy(at.pos); player.vel.set(0, 0, 0); player.yaw = at.yaw; player.pitch = 0;
    php.reset(); waves.stop(); toast(t("rd.go"));
  }
  function openRaidMenu() {
    state = "raidmenu"; input.unlock();
    const el = $("raidmenu"); el.hidden = false;
    const chip = (k: string, v: number, on: boolean, label: string) => `<button type="button" class="chip ${on ? "on" : ""}" data-${k}="${v}" data-nav>${label}</button>`;
    el.innerHTML = `<div class="term"><header class="termbar"><span class="sim">SIM//</span><h1>${t("rd.title")}</h1><span class="credits">${t("pg.lv")} ${inv.progress.level}</span><button type="button" class="btn ghost sm" data-close="1">${t("ui.back")}</button></header>
      <section class="panel ct-list"><p class="note">${t("rd.desc")}</p>
      <h2>${t("rd.length")}</h2><div class="chips">${[4, 6, 8].map((n) => chip("rooms", n, raidOpt.rooms === n, t(`rd.len${n}`, { n }))).join("")}</div>
      <h2>${t("rd.difficulty")}</h2><div class="chips">${[0, 1, 2].map((d) => chip("diff", d, raidOpt.difficulty === d, t(`rd.diff${d}`))).join("")}</div>
      <p class="note">${t(`rd.diffd${raidOpt.difficulty}`)}</p>
      <div class="actions"><button type="button" class="btn" data-go="1" data-nav>${t("rd.start")}</button></div></section></div>`;
    nav.setRoot(el); setTimeout(() => el.querySelector<HTMLElement>("[data-go]")?.focus(), 0);
  }
  function closeRaidMenu() { $("raidmenu").hidden = true; resume(); }
  $("raidmenu").addEventListener("click", (e) => {
    const tg = e.target as HTMLElement;
    if (tg.closest("[data-close]")) return closeRaidMenu();
    const r = tg.closest<HTMLElement>("[data-rooms]"); if (r) { raidOpt.rooms = Number(r.dataset.rooms); return openRaidMenu(); }
    const d = tg.closest<HTMLElement>("[data-diff]"); if (d) { raidOpt.difficulty = Number(d.dataset.diff) as 0 | 1 | 2; return openRaidMenu(); }
    if (tg.closest("[data-go]")) { closeRaidMenu(); startRaid(); }
  });
  // Arena de oleadas: al azar al empezar; cambia un poco tras cada jefe
  const arena = new WaveArena(scene, world.colliders, world.shootables, { x0: world.wavesRoom.x0, x1: world.wavesRoom.x1, z0: world.wavesRoom.z0 + 0.5, z1: world.wavesRoom.z1 });
  arena.set(generateArena((Math.random() * 2 ** 31) | 0, arena.bounds), false);
  const hooksWaveEnd = (_i: number, last: Dummy | null) => dropLoot("waveEnd", last?.group.position ?? new THREE.Vector3(0, 0, 8));
  function healthHud() {
    // Vida del jugador: siempre visible abajo a la izquierda, con cifras (y la oleada en curso encima)
    const el = $("phealth"); const show = state === "play";
    el.hidden = !show; if (!show) return;
    el.querySelector<HTMLElement>("i")!.style.width = `${(php.value / php.max) * 100}%`;
    el.querySelector<HTMLElement>("span")!.textContent = `${Math.ceil(php.value)} / ${php.max}` + (waves.active ? `  ·  ${t("ui.waveN", { n: waves.index + 1, of: "∞", left: waves.remaining })}${waves.mod ? ` · ${t(`wm.${waves.mod}`)}` : ""}` : raid.active ? `  ·  ${t("rd.hud", { n: raid.cleared, of: raid.fights })}${raid.enemiesLeft ? ` · ${t("rd.left", { n: raid.enemiesLeft })}` : ""}` : "");
  }

  // ---------- Botín de enemigos ----------
  // Probabilidad, suelo, tope y rarezas en src/data/loot.json; la lógica (sin dibujo) en weapons/loot.ts.
  const loot = new LootDirector(Math.random);
  let gameTime = 0;
  const LEVEL: Record<string, number> = { comun: 0, poco: 1, rara: 2, epica: 3, legendaria: 4 };
  // Granadas en el suelo: esfera brillante con haz; se recogen al pasar por encima y caducan como el botín
  const nadeDrops: { g: GrenadeSpec; mesh: THREE.Group; t: number; wait: number }[] = [];
  // Armaduras en el suelo: como las granadas (pieza girando con su haz de rareza; se recogen con usar)
  let armorNade = 1;
  const armorDrops: { a: ArmorSpec; mesh: THREE.Group; t: number; wait: number }[] = [];
  function dropArmor(a: ArmorSpec, at: THREE.Vector3, byPlayer = false) {
    const grp = new THREE.Group(), col = new THREE.Color(ARMOR_RARITY[a.rarity].color);
    const body = armorObject(a.slot, a.variant, a.rarity); body.scale.setScalar(0.9); grp.add(body);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.y = 1.1; grp.add(beam);
    grp.position.copy(at).setY(0.35); scene.add(grp); armorDrops.push({ a, mesh: grp, t: LOOT.expireSeconds, wait: byPlayer ? 2.5 : 0 });
    lootChime(LEVEL[a.rarity] ?? 0);
  }
  function updateArmorDrops(dt: number) {
    for (const n of [...armorDrops]) { n.t -= dt; n.wait = Math.max(0, n.wait - dt); n.mesh.rotation.y += dt * 1.5; n.mesh.children[0].position.y = Math.sin(gameTime * 3) * 0.05; if (n.t <= 0) { scene.remove(n.mesh); armorDrops.splice(armorDrops.indexOf(n), 1); } }
  }
  function armorTarget(look: THREE.Vector3) {
    let best: (typeof armorDrops)[number] | null = null, bd = 1e9;
    for (const n of armorDrops) { if (n.wait > 0) continue; const to = n.mesh.position.clone().sub(camera.position), d = to.length(); if (d < 3 && to.normalize().dot(look) > 0.86 && d < bd) { bd = d; best = n; } }
    return best;
  }
  function pickArmor(n: (typeof armorDrops)[number]) {
    if (inv.armors.length >= 12) { toast(t("ar.full")); return; }
    inv.armors.push(n.a); if (inv.worn[n.a.slot] == null) { inv.worn[n.a.slot] = n.a.uid; applyPerks(); }
    toast(t("ar.found", { n: t(`ar.name.${n.a.slot}.${n.a.variant}`), r: t(`rarity.${n.a.rarity}`) }));
    { const l = soundManifest?.efectos.recoger_arma; if (l?.length) playSample(sample(l[0]), 0.5, 0.8); }
    scene.remove(n.mesh); armorDrops.splice(armorDrops.indexOf(n), 1);
  }
  function dropNade(g: GrenadeSpec, at: THREE.Vector3, byPlayer = false) {
    const grp = new THREE.Group(), col = new THREE.Color(GRENADE_RARITY[g.rarity].color);
    const body = new THREE.Group(); grp.add(body); void loadGrenadeModel().then((m) => body.add(grenadeObject(m, g.kind, g.rarity, 0.22)));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.y = 1.1; grp.add(beam);
    grp.position.copy(at).setY(0.2); scene.add(grp); nadeDrops.push({ g, mesh: grp, t: LOOT.expireSeconds, wait: byPlayer ? 2.5 : 0 });
    lootChime(LEVEL[g.rarity] ?? 0);
  }
  function updateNadeDrops(dt: number) {
    for (const n of [...nadeDrops]) {
      n.t -= dt; n.wait = Math.max(0, n.wait - dt); n.mesh.rotation.y += dt * 2; n.mesh.children[0].position.y = Math.sin(gameTime * 3) * 0.05;
      // (las que suelta el jugador no se recogen hasta que se aleja un momento)
      if (n.t <= 0) { scene.remove(n.mesh); nadeDrops.splice(nadeDrops.indexOf(n), 1); }
    }
  }
  /** Granada del suelo a la que se mira (como las armas: se recoge con usar). */
  function nadeTarget(look: THREE.Vector3) {
    let best: (typeof nadeDrops)[number] | null = null, bd = 1e9;
    for (const n of nadeDrops) {
      if (n.wait > 0) continue; const to = n.mesh.position.clone().sub(camera.position), d = to.length();
      if (d < 3 && to.normalize().dot(look) > 0.86 && d < bd) { bd = d; best = n; }
    }
    return best;
  }
  function pickNade(n: (typeof nadeDrops)[number]) {
    if (inv.grenades.length >= 8) { toast(t("gr.full")); return; }
    inv.grenades.push(n.g); if (inv.grenadeActive < 0) inv.grenadeActive = inv.grenades.length - 1;
    toast(t("gr.found", { n: t(`gr.${n.g.kind}`), r: t(`rarity.${n.g.rarity}`) }));
    { const l = soundManifest?.efectos.recoger_granada; if (l?.length) playSample(sample(l[0]), 0.6); }
    scene.remove(n.mesh); nadeDrops.splice(nadeDrops.indexOf(n), 1);
  }
  function dropLoot(source: LootSource, at: THREE.Vector3) {
    const onGround = pickups.list.filter((p) => p.expires != null).length;
    const rarity = loot.kill(source, gameTime, onGround);
    if (!rarity) return;
    const a = Math.random() * Math.PI * 2;
    // De vez en cuando, en lugar del arma cae una granada de esa rareza (menos común que las armas)
    if (Math.random() < 0.2) { dropNade(makeGrenade(Math.floor(Math.random() * 1e9), undefined, rarity as GrenadeRarity), at); return; }
    if (Math.random() < 0.15) { dropArmor(makeArmor(Math.floor(Math.random() * 1e9), undefined, rarity as ArmorRarity), at); return; } // (a veces, una pieza de armadura)
    const spec = rollWeapon(rarity);
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
    if (state === "contracts") closeContracts();
    else if (state === "raidmenu") closeRaidMenu();
    else if (state === "inventory") invScreen.close();
    else if (state === "workbench") bench.back();
    else if (state === "shop") shop.back();
    else if (state === "pause" || state === "title") start.back();
  };
  // Botón o gesto "atrás" de Android (APK): cierra el menú abierto; jugando, pausa. Sin esto, Android cerraba la app.
  // (Plugin App de Capacitor, instalado al compilar la APK; en escritorio y navegador no existe y no hace nada)
  const capApp = (window as unknown as { Capacitor?: { Plugins?: { App?: { addListener?: (ev: string, cb: () => void) => void } } } }).Capacitor?.Plugins?.App;
  capApp?.addListener?.("backButton", () => { if (state === "play") { input.unlock(); openStart(); } else back(); });
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
  let shownPickup: object | null = null;
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
      syncNade();
      if (settings.dev) meter.charge = 1;
      if (f.super && !inv.hasSuper(inv.superId)) toast(t("sp.noModule"));
      else if (f.super && !sfx.casting && !sfx.busy) { if (meter.use()) sfx.cast(inv.superId); else toast(t("sp.notReady")); }
      if (f.grenade) {
        if (!inv.grenade) toast(t("gr.none"));
        else if (pouch.use()) { const dir = camera.getWorldDirection(new THREE.Vector3()); nades.throw(inv.grenade, camera.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.15, 0)), dir); }
      }
      const key = input.device === "pad" ? `<kbd class="hold" style="--p:${Math.round(input.useHold * 100)}%">${PAD_NAMES[input.padBinds.useReload]}</kbd>${t("ui.holdBtn")} ` : `<kbd>${input.binds.use.replace(/^Key/, "")}</kbd>`;
      const look = camera.getWorldDirection(new THREE.Vector3());
      const ground = pickups.target(camera.position, look);
      const gnade = ground ? null : nadeTarget(look), garmor = ground || gnade ? null : armorTarget(look);
      const near = ground || gnade || garmor ? null : nearInteractable();
      $("prompt").hidden = !ground && !near && !gnade && !garmor;
      if (ground) $("prompt").innerHTML = `${key}${t("ui.pickup")}`;
      else if (gnade) $("prompt").innerHTML = `${key}${t("ui.pickupNade")}`;
      else if (garmor) $("prompt").innerHTML = `${key}${t("ar.pickup")}`;
      else if (near) $("prompt").innerHTML = `${key}${t(near.id === "chest" ? "ui.useShop" : near.id === "waves" ? (waves.active ? "ui.wavesStop" : "ui.wavesStart") : near.id === "storage" ? "ui.useStorage" : near.id === "contracts" ? "ct.use" : near.id === "raid" ? "rd.use" : "ui.useBench")}`;
      // Ficha del arma del suelo comparada con la que llevas
      const card = $("pickcard");
      if ((ground ?? gnade ?? garmor) !== shownPickup) {
        shownPickup = ground ?? gnade ?? garmor;
        const worn = garmor ? inv.wornOf(garmor.a.slot) : null;
        card.innerHTML = ground ? weaponCard(ground.item.spec, inv.current && inv.current !== ground.item ? inv.current.spec : null, inv.current ? t("ui.compared") : "") : gnade ? grenadeCard(gnade.g, inv.grenade ? t("ui.compared") : "", inv.grenade) : garmor ? armorCard(garmor.a, worn ? t("ui.compared") : "", worn) : "";
        card.hidden = !ground && !gnade && !garmor; if (gnade) fillNadeThumbs(card); if (garmor) fillArmorThumbs(card);
      }
      // Ⓧ del mando: mantener = recoger o usar lo que hay cerca (pulsar y soltar recarga)
      if (f.holdUse && (ground || near || gnade || garmor)) f.interact = true;
      if (f.interact) {
        if (ground) pickUp(ground);
        else if (gnade) pickNade(gnade);
        else if (garmor) pickArmor(garmor);
        else if (near) {
          if (near.id === "chest") openScreen("shop");
          else if (near.id === "waves") { if (waves.active) waves.stop(); else { php.reset(); arena.set(generateArena((Math.random() * 2 ** 31) | 0, arena.bounds), true, player.pos); waves.start(); toast(t("ui.wavesGo")); } }
          else if (near.id === "storage") openScreen("inventory", true);
          else if (near.id === "contracts") openContracts();
          else if (near.id === "raid") openRaidMenu();
          else { bench.inspect = false; openScreen("workbench"); }
        }
      }
      if (f.slot1 && inv.equip[0]) { inv.active = 0; inv.changed(); }
      if (f.slot2 && inv.equip[1]) { inv.active = 1; inv.changed(); }
      if (f.swap && inv.equip[1 - inv.active]) { inv.active = 1 - inv.active; inv.changed(); }
      if (f.reload && !sfx.casting) gun.startReload();
      // Asistencia de apuntado con mando: la mira se frena sobre un muñeco
      input.assist = 1;
      if (input.device === "pad") {
        const fwd = camera.getWorldDirection(new THREE.Vector3());
        for (const d of dummies) { if (!d.alive) continue; const to = d.center.sub(camera.position); const dist = to.length(); if (fwd.angleTo(to) < Math.max(0.03, 0.6 / dist)) { input.assist = 0.45; break; } }
      }
      player.update(dt, f, gun.aimT > 0.5, (1 - gun.aimT * (1 - 1 / Math.max(1.5, gun.zoom))) * (1 + (settings.adsSens - 1) * gun.aimT));
      gun.update(dt, { kick: f.kick && !sfx.casting, fire: f.fire && !sfx.casting, aim: f.aim && !sfx.casting, moving: Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5), sprinting: player.sprinting, lookX: f.lookX, lookY: f.lookY, vy: player.vel.y, grounded: player.onGround, inspect: f.inspect });
      const base = settings.fov, aimFov = gun.sight === "scope" || gun.sight === "irons" ? base / gun.zoom : gun.sight === "iron" ? base / 1.35 : base / 1.6;
      camera.fov = THREE.MathUtils.lerp((player.sprinting ? base + 7 : base) + 9 * player.slideK, aimFov, gun.aimT);
      const sp = sfx.pose(); gun.superPose = sp; gun.buff = sfx.buff;
      gun.perks.dmg = curPerks.dmg * (gun.spec ? overPenalty(gun.spec.level, inv.progress.level) : 1);
      if (sp) camera.fov += sp.fov;
      camera.updateProjectionMatrix();
      playSeconds += dt; autosaveT += dt; if (autosaveT > 60) autosave(); // autoguardado cada minuto de juego
    } else {
      $("prompt").hidden = true; $("pickcard").hidden = true; shownPickup = null; sfx.cancel(); gun.superPose = null; $("superhud").hidden = true;
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
    { const sp = sfx.pose(); if (sp) camera.rotation.z += THREE.MathUtils.degToRad(sp.roll); }
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

    pickups.update(state === "play" ? dt : 0); // (en los menús el botín del suelo tampoco caduca)
    if (state === "play") {
      // Las oleadas viven en su sala: salir por la puerta las detiene
      if (waves.active && (player.pos.z < world.wavesRoom.z0 || player.pos.z > world.wavesRoom.z1)) { waves.stop(); toast(t("ui.wavesLeft")); }
      const ts = sfx.timeScale; // (Dilatación temporal: enemigos y esferas a cámara lenta)
      const wdt = hitstop > 0 ? 0 : dt;
      waves.update(wdt * ts); arena.update(dt);
      if (raid.active) { mobs.update(wdt * ts); raid.update(dt, player.pos); if (raidReturnT > 0 && (raidReturnT -= dt) <= 0) returnHub(true); }
      if (!sfx.casting && !sfx.busy) meter.update(dt); sfx.update(dt, player.pos); superHud();
      pouch.update(dt * curPerks.nadeRecharge * armorNade); updateArmorDrops(dt); nades.update(dt); nadeHud(); updateNadeDrops(dt); php.update(dt); gameTime += dt; loot.tick(dt, gameTime);
    }
    healthHud(); xpHud(dt);
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
    // (pausa, inventario y demás menús paran el mundo: los enemigos no se mueven ni atacan)
    const stop = (state === "play" && hitstop > 0) || state !== "play"; hitstop = Math.max(0, hitstop - dt);
    for (const d of dummies) d.update(stop ? 0 : dt * sfx.timeScale, camera, innerWidth, innerHeight);
    numbers.update(state === "play" ? dt : 0, camera, innerWidth, innerHeight);
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
    debug, gen, inv, gun, nades, pickups, pickUp, player, setSetting, renderer, scene, dummies, waves, php, bench, shop, start, invScreen, dialog, nav, saves,
    loot, dropLoot, openScreen, openStart, resume, newGame, collect, apply, autosave, setLang, earn, meter, sfx, gainXp, applyPerks, world, raid, startRaid, returnHub, mobs, openRaidMenu, arena, mutateArena,
    cardHTML: (s: WeaponSpec) => weaponCard(s), openChest: () => openScreen("shop"), get state() { return state; }, set state(v: State) { state = v; }, get shopState() { return shopState; },
  };
}

boot().catch((e) => { $("start-text").textContent = t("ui.loadError", { e: e.message }); console.error(e); });
