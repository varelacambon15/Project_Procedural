// Proving Grounds / Campo de Pruebas: demo jugable de la Fase 1.
import { DeathFx } from "./deathfx";
import { FURNITURE, HallProps, type FurnCat, type HallPropId } from "./hallprops";
import { HallBot } from "./hallbot";
import { Post } from "./post";
import { SessionRecorder, type SessionIO } from "./session";
import * as THREE from "three";
import { GADGET_KINDS, GADGET_KIND_LIST, GADGET_RARITY, makeGadget, setGadgetUid, type GadgetKind, type GadgetRarity, type GadgetSpec } from "./gadgets";
import { GadgetFx } from "./gadgetfx";
import { GRENADE_KIND_LIST, GRENADE_RARITY, GrenadePouch, isGadgetGrenade, makeGrenade, setGrenadeUid, type GrenadeRarity, type GrenadeSpec } from "./grenades";
import { GrenadeFx } from "./grenadefx";
import { SuperFx } from "./superfx";
import { MODULE_CHANCE, SUPER_IDS, SuperMeter, rollModule, type SuperId } from "./supers";
import { PROGRESS, addXp, killXp, migrateProgress, overPenalty, perks as skillPerks, playerHealthMult, rollWeaponLevel, waveXp, xpToNext, MAX_LEVEL } from "./progress";
import { grenadeObject, loadGrenadeModel } from "./grenademodel";
import { applyEvent, claimAll, refreshContracts, type Contract, type ContractState } from "./contracts";
import { audio, initSounds, loadSamples, out, playSample, sample, soundManifest, startMusic } from "./audio";
import showcaseWeapon from "../data/showcase-weapon.json";
import { RARITIES, WeaponGenerator } from "../weapons/generator";
import { WeaponAssembler } from "../weapons/assembler";
import { archName, rarityName, typeName } from "../weapons/labels";
import { displayName, rename } from "../weapons/naming";
import { newAcc, setAccUid, type AccKind } from "../weapons/accbank";
import { BUILD, BUILDS, BUILD_BETWEEN, BUILD_TIME, EARLY_BONUS, HUNTERS, SPAWN_GAP, START_CREDITS, coreWave, killReward, sellValue, waveReward } from "./defense";
import { DefenseFx, type Pad } from "./defensefx";
import { rng as seedRng } from "./raidgen";
import { DEATH_LOSS, HACK_BUFFS, HACK_BUFF_VALUE, type HackBuff, type HackNode } from "./hackgen";
import type { Manifest, RarityId, WeaponSpec } from "../weapons/types";
import { getLang, onLang, setLang, t, type Lang } from "../i18n";
import { DEFAULT_BINDS, DEFAULT_PAD, Input, PAD_NAMES } from "./input";
import { buildRange, type Interactable } from "./world";
import { applyEnvIntensity, envIntensityFor, makeEnv } from "./envmap";
import { PIXEL_LEVELS, pixelLevel, setPixelLevel } from "../weapons/textures";
import { onSettings, replaceSettings, setSetting, settings, type Settings } from "./settings";
import { BOSS_EVERY, PlayerHealth, Waves } from "./waves";
import { WaveArena } from "./arena";
import { ARMOR_RARITY, armorTotals, damageTaken, makeArmor, setArmorUid, type ArmorRarity, type ArmorSpec } from "./armor";
import { armorObject, fillArmorThumbs } from "./armormodel";
import { generateArena, mutateArena } from "./arenagen";
import { Raid, RAID_ORIGIN } from "./raid";
import { spawnDummies, DamageNumbers, type Dummy } from "./dummies";
import { Player } from "./player";
import { Gun } from "./gun";
import { VM_FOV } from "./anim";
import { VM_BACK } from "./vmfit";
import { RETICLES, reticleFor } from "./reticles";
import { Inventory, makeItem, type Item } from "./inventory";
import type { PhysicsLayer } from "./physworld";
import { Pickups, type Pickup } from "./pickups";
import { LOOT, LootDirector, type LootSource } from "../weapons/loot";
import { lootChime } from "./audio";
import { installPixelFont } from "./pixelfont";
import { CARD, armorCard, gadgetCard, grenadeCard, $, MenuCursor, MenuNav, ModelView, Thumbnails, esc, weaponCard, type Dir } from "./ui/common";
import { InventoryScreen } from "./ui/inventory";
import { WorkshopScreen } from "./ui/workshop";
import { ShopScreen, fillNadeThumbs } from "./ui/shop";
import { StartScreen } from "./ui/start";
import { TextDialog } from "./ui/dialog";
import { AUTO, SLOTS, SAVE_VERSION, SaveManager, type SaveData, type SlotId } from "./save";
import { platformStorage } from "./storage";
import { preloadEnemyModels } from "./enemymodels";
import { SHOP, newShopState, type ShopState } from "./shop";

const ASSETS = "./weapons/";
/** Con menos créditos que esto al entrar al hall, el asistente comenta que toca practicar en el campo de tiro. */
const LOW_CREDITS_BOT = 50;
void installPixelFont();
setLang(getLang());

// ---------- Render ----------
const renderer = new THREE.WebGLRenderer({ antialias: true }); // (sin profundidad logarítmica: caro en Android; las calcomanías usan polygonOffset, ver decal())
renderer.localClippingEnabled = true; // escaneo de los muñecos de la simulación
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false; // el coste del fotograma se acumula en draw() y lo lee el contador de FPS
$("game").appendChild(renderer.domElement);
const scene = new THREE.Scene();
// Mapa de entorno (PMREM de un interior de estudio; NO es una luz): metal, polímero y suelos devuelven el entorno en
// vez de verse planos. La intensidad se escala con «Calidad gráfica» (ENV_INTENSITY), ver applyLook()
const weaponEnv = makeEnv(renderer);
scene.environment = weaponEnv;
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.02, 300);
scene.add(camera);
// Luz de borde ligada a la cámara: perfila el arma en primera persona para que las oscuras no se pierdan en la sala
const rim = new THREE.DirectionalLight(0xbfd8ff, 0.4); rim.position.set(0.8, 0.6, -1.2); camera.add(rim); camera.add(rim.target); rim.target.position.set(0, -0.2, 0.5);
const world = buildRange(scene);
// Asistente del hall: pantalla con cara en la pared derecha del hall (x = 24), mirando hacia dentro; se le puede disparar
const hallBot = new HallBot({ pos: new THREE.Vector3(23.82, 3.7, 9), rotY: -Math.PI / 2, name: () => settings.playerName ?? "", volume: () => settings.volume, voice: () => settings.botVoice !== false });
scene.add(hallBot.mesh); world.shootables.push(...hallBot.hitMeshes);
// Postproceso: resplandor (bloom) sobre lo que brilla de verdad (neón, fogonazos); fuerte de noche, suave de día
// Cámara del arma (como en los shooters, «viewmodel FOV»): arma y brazos se dibujan encima con un campo de visión más
// estrecho, retrasada para que el tamaño aparente no cambie; con el campo de visión del mundo (75°) las armas largas se
// deformaban (culata enorme, boca diminuta y el cañón «subiendo» hacia el centro). Mismo eje: al apuntar sigue centrada.
const deathFx = new DeathFx(camera);
const vmCam = new THREE.PerspectiveCamera(VM_FOV, 1, 0.02, 30); vmCam.position.z = VM_BACK; vmCam.layers.set(1); camera.add(vmCam);
// Cadena de postprocesado (post.ts): tono filmic, bloom, viñeta, grano y aberración al recibir daño.
// El nivel de calidad decide qué entra; si falla, se cae sola a Bajo (render directo) sin errores.
const post = new Post(renderer, scene, camera, vmCam, settings.quality);
// Intensidad del mapa de entorno según «Calidad gráfica» y día/noche; se re-aplica cada pocos fotogramas para que
// lo que se añade después (armas, enemigos) herede el mismo ajuste
let envI = envIntensityFor(settings.quality, settings.night);
let lightSync = 0;
function syncLayers() {
  for (const c of camera.children) { if (c === vmCam) continue; c.traverse((o) => { const want = (o as THREE.Light).isLight ? 3 : 2; if (o.layers.mask !== want) o.layers.mask = want; }); }
  if (--lightSync <= 0) {
    lightSync = 45;
    scene.traverse((o) => { if ((o as THREE.Light).isLight) o.layers.enable(1); });
    applyEnvIntensity(scene, envI);
  }
}
// Relleno de la vista en primera persona: de noche el arma y los brazos recogen el rebote del neón (cian arriba, magenta abajo)
const fill = new THREE.DirectionalLight(0xe040a0, 0); fill.position.set(-0.6, -0.8, -0.4); camera.add(fill); camera.add(fill.target); fill.target.position.set(0, 0, -1);
// Contorno extra para armas oscuras: según la luminancia del color principal del acabado (negro → más contorno)
let darkBoost = 0;
const weaponDarkness = (spec: WeaponSpec | null | undefined) => {
  const c = spec?.paint?.color; if (!c) return 0.5;
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return Math.max(0, Math.min(1, (0.35 - lum) / 0.3));
};
const applyLook = () => { world.setNight(settings.night); rim.intensity = (settings.night ? 0.8 : 0.4) + darkBoost * 1.1; rim.color.set(settings.night ? 0xc8b0ff : 0xbfd8ff); fill.intensity = settings.night ? 0.5 : 0; envI = envIntensityFor(settings.quality, settings.night); applyEnvIntensity(scene, envI); post.setQuality(settings.quality); post.bloomLook(settings.bloom, settings.night ? 0.55 : 0.3); renderer.toneMappingExposure = settings.night ? 1.25 : 1.0; };
applyLook(); onSettings(applyLook);
// Resolución del render (ajuste) y contador de FPS
const applyScale = () => { const pr = Math.min(devicePixelRatio, 1.5) * (settings.renderScale ?? 1); if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) { renderer.setPixelRatio(pr); resize(); } };
const fpsEl = (() => { const e = document.createElement("div"); e.id = "fps"; e.style.cssText = "position:fixed;top:6px;right:8px;z-index:50;font:12px monospace;color:#7affc8;background:rgba(0,0,0,0.5);padding:2px 6px;pointer-events:none"; e.hidden = true; document.body.appendChild(e); return e; })();
let fpsN = 0, fpsT = performance.now();
const fpsTick = () => { if (!settings.showFps) { fpsEl.hidden = true; return; } fpsN++; const n = performance.now(); if (n - fpsT >= 500) { fpsEl.hidden = false; fpsEl.textContent = `${Math.round((fpsN * 1000) / (n - fpsT))} FPS · ${renderer.info.render.calls} dc · ${Math.round(renderer.info.render.triangles / 1000)}k tri`; fpsN = 0; fpsT = n; } };
applyScale(); onSettings(applyScale);
startMusic("./music/ambient-03.ogg");
// Pack de sonidos (assets/sonidos): manifest ahora; las muestras de cada arma se cargan al equiparla
void initSounds("./sonidos/").then((m) => { if (m) void loadSamples(["melee_cuchillo_swing", "melee_cuchillo_golpe", "melee_culatazo", "recoger_arma", "explosion"].flatMap((k) => m.efectos[k] ?? [])); });
// ---------- Registro de sesión (modo desarrollador): capturas, notas y registro para revisar después ----------
const grabShot = async (): Promise<string | null> => {
  try {
    const c = renderer.domElement, w = Math.min(960, c.width), h = Math.round(c.height * (w / c.width));
    const o = document.createElement("canvas"); o.width = w; o.height = h; o.getContext("2d")!.drawImage(c, 0, 0, w, h);
    return o.toDataURL("image/jpeg", 0.6).split(",")[1];
  } catch { return null; }
};
let sessionCtx: () => Record<string, unknown> = () => ({}); // (se rellena más abajo, donde existen el modo de juego y el inventario)
// Registro de sesión en el navegador: sin el puente de escritorio (window.ppSession) los archivos van al servidor de
// desarrollo (POST /__session/write → Documentos/ProvingGrounds/sesiones); si no hay servidor (build de producción),
// quedan en memoria y F10 descarga un solo paquete .json. Las notas se apuntan además en localStorage.
const NOTES_KEY = "pp.session.notes";
const readNotes = (): string[] => {
  try { const v: unknown = JSON.parse(localStorage.getItem(NOTES_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
};
const addNote = (text: string) => { const s = text.trim().slice(0, 300); if (!s) return; try { localStorage.setItem(NOTES_KEY, JSON.stringify([...readNotes(), s])); } catch { /* sin almacenamiento */ } };
const sessionFiles = new Map<string, string>();
const browserSessionIo: SessionIO = {
  write: async (rel, b64) => {
    try {
      const r = await fetch("/__session/write", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rel, b64 }) });
      if (!r.ok) throw new Error(`write ${r.status}`);
    } catch { sessionFiles.set(rel, b64); } // sin servidor de desarrollo: respaldo para F10
  },
};
function downloadSession() {
  const notes = readNotes();
  if (!sessionFiles.size && !notes.length) return;
  const blob = new Blob([JSON.stringify({ version: 1, files: Object.fromEntries(sessionFiles), notas: notes })], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `sesion_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const session = new SessionRecorder((globalThis as unknown as { ppSession?: SessionIO }).ppSession ?? browserSessionIo, grabShot,
  () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  () => sessionCtx());
{
  const box = document.createElement("div"); box.id = "sessionnote"; box.hidden = true;
  box.innerHTML = `<input type="text" maxlength="300" autocomplete="off" spellcheck="false">`;
  const input = box.querySelector("input")!; input.placeholder = t("set.sessionNote");
  const dot = document.createElement("div"); dot.id = "sessiondot"; dot.textContent = "● REC"; dot.hidden = true;
  document.body.append(box, dot);
  const close = (save: boolean) => { if (save) { session.note(input.value); addNote(input.value); } input.value = ""; box.hidden = true; session.noteOpen = false; input.blur(); };
  for (const type of ["keydown", "keyup", "keypress"] as const) input.addEventListener(type, (e) => { e.stopPropagation(); if (type === "keydown") { if ((e as KeyboardEvent).key === "Enter") close(true); else if ((e as KeyboardEvent).key === "Escape") close(false); } });
  window.addEventListener("keydown", (e) => {
    if (!session.active) return;
    if (e.key === "F8") { e.preventDefault(); session.mark(); }
    else if (e.key === "F10") { e.preventDefault(); void downloadSession(); }
    else if (e.key === "F9" && !session.noteOpen) { e.preventDefault(); session.noteOpen = true; box.hidden = false; input.focus(); }
  });
  window.addEventListener("error", (e) => session.error(`${e.message} @ ${(e.filename ?? "").split("/").pop()}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => session.error(`promesa rechazada: ${String(e.reason).slice(0, 160)}`));
  setInterval(() => { dot.hidden = !session.active; }, 500);
}
const draw = (dt: number) => {
  syncLayers();
  renderer.info.reset(); // (aquí empieza la cuenta de llamadas de dibujo y triángulos del fotograma)
  post.render(dt);
  session.afterRender(); // (la captura pendiente del registro de sesión, justo tras dibujar)
};
function resize() { renderer.setSize(innerWidth, innerHeight); post.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vmCam.aspect = camera.aspect; vmCam.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

// ---------- Estado ----------
type State = "title" | "play" | "pause" | "inventory" | "workbench" | "shop" | "contracts" | "raidmenu" | "furniture";
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
const dummies: Dummy[] = spawnDummies(scene, world.lanes, $("bars"), onDummyDamage, world.rangePt);
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
  // Objetos del hall (armero, drones, radio, máquina de bebidas, fuente, tablón, saco de boxeo y decoración)
  const hallProps = new HallProps(scene, world.colliders, world.shootables, {
    assemble: (spec) => asm.assemble(spec),
    rackItems: () => inv.storage.slice(0, 6),
    openStorage: () => openScreen("inventory", true),
    toast: (s) => toast(s),
    spend: (n) => { if (inv.credits < n) return false; inv.credits -= n; return true; },
    drink: (sec) => { injectT = sec; injectK = 0.15; applyPerks(); },
    droneShot: () => hallBot.defendDrone(),
    say: (text) => { toast(text); try { const ss = window.speechSynthesis; if (ss && settings.botVoice !== false) { const u = new SpeechSynthesisUtterance(text.includes(": ") ? text.slice(text.indexOf(": ") + 2) : text); u.lang = getLang() === "es" ? "es-ES" : "en-US"; u.pitch = 1.9; u.rate = 1.3; u.volume = settings.volume; ss.speak(u); } } catch { /* sin voz */ } },
    coffee: () => { if (inv.gadget) gpouch.charges = inv.gadget.charges; },
    beep: (f, len) => { try { const a = audio(), o = a.createOscillator(), g = a.createGain(); o.type = "square"; o.frequency.value = f; g.gain.setValueAtTime(0.06, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + len); o.connect(g); g.connect(out()); o.start(); o.stop(a.currentTime + len + 0.02); } catch { /* sin audio */ } },
  });
  const HALL_PROP = new Set(["rack", "radio", "vending", "cooler", "board", "coffee", "arcade", "furniture"]);
  asm.preloadKit(); asm.asyncAO = true;

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
  /** La baja la hace una granada o un súper (no cuenta para el contador del arma). */ let notGun = false;
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
      // Parón al recibir: el enemigo frena un instante (más en la cabeza y con críticos); los jefes, casi nada
      if (d.alive && dealt > 0) { const k = d.kind.boss ? 0.15 : 1; d.slow((0.12 + (crit ? 0.1 : 0) + (zone === "head" ? 0.08 : 0)) * k, zone === "head" || crit ? 0.15 : 0.45); }
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
      if (run && raid.active && !d.respawn) { run.kills++; if (lastHit.get(d)?.head) run.heads++; }
      // Contador de bajas del arma (accesorio): solo las bajas hechas con ella, no con granadas ni súperes
      if (dmode.active && !d.respawn) dmode.credits += killReward(d.kind.key ?? "", !!d.kind.boss);
      if (!notGun && gun.item && !d.respawn) { gun.item.spec.kills = (gun.item.spec.kills ?? 0) + 1; gun.refreshCounter(); }
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
    onHit(d, point, dmg, element) { const alive = d.alive; notGun = true; gun.hooks.onHit(d, "body", point, dmg, element, false); if (alive && !d.alive) gun.hooks.onKill?.(d); notGun = false; },
  });
  // Súper: se carga con bajas (y algo con el tiempo); V / cruceta arriba / ✦ lo invoca con su animación en primera persona
  const meter = new SuperMeter();
  /** Últimos segundos de posición y vida (Rebobinado). */
  const rewindHist: { t: number; p: THREE.Vector3; hp: number }[] = [];
  /** Último movimiento pedido (dirección del Impulso). */ const lastMove = { x: 0, z: 0 };
  const sfx = new SuperFx(scene, {
    dummies: () => dummies,
    onHit(d, point, dmg, element) { const alive = d.alive; notGun = true; gun.hooks.onHit(d, "body", point, dmg, element, false); if (alive && !d.alive) gun.hooks.onKill?.(d); notGun = false; },
    shake: (n) => { if (settings.screenShake) shake = Math.min(0.8, shake + n); },
    aim(max) {
      // Punto del suelo al que se mira (o el más lejano en esa dirección si se mira al horizonte)
      const o = camera.getWorldPosition(new THREE.Vector3()), dir = camera.getWorldDirection(new THREE.Vector3());
      const d = dir.y < -0.02 ? Math.min(max, -o.y / dir.y) : max; return o.addScaledVector(dir, d).setY(0);
    },
    heal: (n) => { php.value = n == null ? php.max : Math.min(php.max, php.value + n); },
    levitate: (sec, h) => player.levitate(sec, h),
    sig: (id) => superSig(id),
    hand: (): THREE.Vector3 => camera.localToWorld(new THREE.Vector3(0.04, -0.14, -0.55)),
    dash(dist) {
      // Dirección: la que se pulsa (o hacia delante si no se pulsa ninguna)
      const mx = lastMove.x, mz = lastMove.z, dir = Math.hypot(mx, mz) > 0.2 ? new THREE.Vector3(mx, 0, -mz).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw).normalize() : new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      const from = player.pos.clone(); player.lunge(dir, dist, 0.16); return { from, to: from.clone().addScaledVector(dir, dist) };
    },
    view: () => ({ o: camera.getWorldPosition(new THREE.Vector3()), dir: camera.getWorldDirection(new THREE.Vector3()) }),
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
    timestop: { f0: 55, f1: 900, wave: "sine", len: 0.9, noise: 0.15, lp: 3000, vol: 0.22, chord: [1.5, 2] },
    leech: { f0: 140, f1: 90, wave: "sawtooth", len: 0.9, noise: 0.2, lp: 900, vol: 0.12, chord: [1.06] },
    decoy: { f0: 700, f1: 1100, wave: "triangle", len: 0.6, noise: 0.05, lp: 4000, vol: 0.08, chord: [1.33] },
    spirit: { f0: 70, f1: 30, wave: "sawtooth", len: 2.2, noise: 0.6, lp: 1400, vol: 0.32, chord: [1.5, 2] },
    railgun: { f0: 2400, f1: 180, wave: "sawtooth", len: 0.7, noise: 0.25, lp: 7000, vol: 0.12, chord: [1.01] },
    dash: { f0: 300, f1: 1400, wave: "sawtooth", len: 0.35, noise: 0.5, lp: 5000, vol: 0.12 },
    dome: { f0: 220, f1: 330, wave: "triangle", len: 1.2, noise: 0.05, lp: 2500, vol: 0.14, chord: [1.5, 2] },
    core: { f0: 70, f1: 30, wave: "sawtooth", len: 1.1, noise: 0.6, lp: 1200, vol: 0.34 },
    torrent: { f0: 1800, f1: 2400, wave: "triangle", len: 0.6, noise: 0.3, lp: 7000, vol: 0.1 },
    shards: { f0: 2600, f1: 3600, wave: "triangle", len: 0.45, noise: 0.15, lp: 8000, vol: 0.08, chord: [1.26, 1.5] },
  };
  let wasInZone = false;
  let wasInHall = false; // (para avisar al asistente al entrar al hall con pocos créditos)
  let wasStopped = false, tsInvT = 0, tsTick = 0;
  /** Parada del tiempo: zumbido grave que sube y se corta en seco, tictac de reloj y reanudación con un barrido que cae. */
  function timeSnd(k: "stop" | "tick" | "resume") {
    try {
      const a = audio(), t0 = a.currentTime, g = a.createGain(); g.connect(out());
      const osc = (type: OscillatorType, f0: number, f1: number, len: number, vol: number, at = 0) => {
        const o = a.createOscillator(), gg = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0 + at); o.frequency.exponentialRampToValueAtTime(f1, t0 + at + len);
        gg.gain.setValueAtTime(0.0001, t0 + at); gg.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.02); gg.gain.exponentialRampToValueAtTime(0.0005, t0 + at + len);
        o.connect(gg); gg.connect(g); o.start(t0 + at); o.stop(t0 + at + len + 0.05);
      };
      g.gain.value = 1;
      if (k === "stop") { osc("sawtooth", 60, 1400, 0.55, 0.12); osc("sine", 40, 1800, 0.6, 0.2); osc("triangle", 880, 110, 1.6, 0.18, 0.58); osc("sine", 55, 50, 2.2, 0.3, 0.58); osc("square", 1760, 1700, 0.05, 0.1, 0.58); }
      else if (k === "tick") { osc("square", 2400, 1800, 0.035, 0.1); osc("sine", 900, 700, 0.06, 0.08); }
      else { osc("sine", 1600, 60, 0.9, 0.2); osc("sawtooth", 900, 40, 0.7, 0.07); osc("sine", 50, 45, 0.6, 0.25, 0.05); }
    } catch { /* sin audio */ }
  }
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
    const stopped = state === "play" && sfx.activeId === "timestop";
    if (stopped && !wasStopped) { tsInvT = 0.45; timeSnd("stop"); tsTick = Math.ceil(sfx.activeLeft); }
    if (!stopped && wasStopped && state === "play") timeSnd("resume");
    if (stopped && sfx.activeLeft < tsTick - 1 && tsTick > 1) { tsTick--; timeSnd("tick"); }
    wasStopped = stopped; document.body.classList.toggle("timestop", stopped); document.body.classList.toggle("tsinv", stopped && tsInvT > 0);
    document.body.classList.toggle("chrono", state === "play" && chronoT > 0);
    const left = sfx.activeLeft, pct = left > 0 ? Math.round((left / sfx.activeTotal) * 100) : Math.round(meter.charge * 100);
    el.className = left > 0 ? "on" : meter.ready ? "ready" : "";
    document.body.classList.toggle("deadeye", state === "play" && sfx.activeId === "deadeye"); document.body.classList.toggle("aegis", state === "play" && sfx.activeId === "aegis");
    el.innerHTML = `<span>${t(`sp.${inv.superId}`)}</span><span class="bar"><i style="width:${pct}%"></i></span><b>${left > 0 ? Math.ceil(left) + " s" : meter.ready ? `<kbd>${input.device === "pad" ? "LB+RB" : input.binds.super.replace(/^Key/, "")}</kbd>` : pct + " %"}</b>`;
  };
  // ---------- Equipamiento (LB / X): cargas como las granadas y efecto en gadgetfx ----------
  /** Equipamiento que se lanza con la mano (gesto de lanzar); el resto se despliega o activa en la cadera. */
  const GADGET_THROW: ReadonlySet<GadgetKind> = new Set<GadgetKind>(["orb", "knife", "mine", "chain", "harpoon", "teleport"]);
  const gpouch = new GrenadePouch(); // (mismo contador de cargas: solo usa charges y recharge)
  const syncGadget = () => { if (gpouch.g !== (inv.gadget as unknown)) { const fresh = gpouch.g == null; gpouch.equip(inv.gadget as never); if (fresh && inv.gadget) gpouch.charges = inv.gadget.charges; } };
  const gadgetHud = () => {
    const el = $("gadgethud"), g = inv.gadget; el.hidden = !g; if (!g) return;
    el.style.color = GADGET_RARITY[g.rarity].color;
    el.innerHTML = `<span>${t(`gd.${g.kind}`)}</span>${Array.from({ length: g.charges }, (_, i) => `<span class="pip${i < gpouch.charges ? " on" : ""}"></span>`).join("")}${gpouch.charges < g.charges ? `<span class="rc"><i style="width:${Math.round(gpouch.progress * 100)}%"></i></span>` : ""}`;
  };
  const syncNade = () => { if (pouch.g !== inv.grenade) { const fresh = pouch.g == null; pouch.equip(inv.grenade); if (fresh && inv.grenade) pouch.charges = inv.grenade.charges; } };
  const nadeHud = () => {
    const el = $("nadehud"), g = inv.grenade; el.hidden = !g; if (!g) return;
    el.style.color = GRENADE_RARITY[g.rarity].color;
    el.innerHTML = `<span>${t(`gr.${g.kind}`)}</span>${Array.from({ length: g.charges }, (_, i) => `<span class="pip${i < pouch.charges ? " on" : ""}"></span>`).join("")}${pouch.charges < g.charges ? `<span class="rc"><i style="width:${Math.round(pouch.progress * 100)}%"></i></span>` : ""}`;
  };
  gun.actionOf = (sp) => gen.byId.get(sp.parts[0].from)?.action;
  const pickups = new Pickups(scene, asm, world.colliders);
  const gadgets = new GadgetFx(scene, {
    enemies: () => [...mobs.list, ...waves.list, ...dummies.filter((d) => d.alive)],
    onHit(d, point, dmg, element) { const alive = d.alive; notGun = true; gun.hooks.onHit(d, "body", point, dmg, element, false); if (alive && !d.alive) gun.hooks.onKill?.(d); notGun = false; },
    colliders: world.colliders, shootables: world.shootables,
    view: () => ({ eye: camera.getWorldPosition(new THREE.Vector3()), dir: camera.getWorldDirection(new THREE.Vector3()) }),
    feet: () => player.pos.clone(),
    lunge: (dir, dist, time) => player.lunge(dir, dist, time),
    launch: (vy) => { player.vel.y = vy; player.onGround = false; },
    refill: () => { const it = gun.item; if (it) { it.ammo = it.spec.stats.cargador; inv.changed(); } const l = soundManifest?.efectos.recoger_municion; if (l?.length) playSample(sample(l[Math.floor(Math.random() * l.length)]), 0.5); },
    boost: (sec, k) => { injectT = sec; injectK = k; applyPerks(); },
    slowTime: (sec, k) => { chronoT = sec; chronoK = k; },
    moveDir: () => { const v = player.vel.clone().setY(0); return v.length() > 0.5 ? v.normalize() : null; },
    teleport: (p) => { player.pos.set(p.x, 0, p.z); player.vel.set(0, 0, 0); },
    sound: (k) => {
      // Sonidos propios del equipamiento con las muestras del pack (antes no hacía nada)
      const e = soundManifest?.efectos; if (!e) return;
      if (k === "boom") { const x = e.explosion; if (x?.length) playSample(sample(x[Math.floor(Math.random() * x.length)]), 0.45, 1.1); const g = e.explosion_grave; if (g?.length) playSample(sample(g[0]), 0.55); }
      else if (k === "zap") { const l = e.flash_aturdidora; if (l?.length) playSample(sample(l[Math.floor(Math.random() * l.length)]), 0.3, 1.6); }
      else if (k === "swing") { const l = e.melee_cuchillo_swing; if (l?.length) playSample(sample(l[Math.floor(Math.random() * l.length)]), 0.5, 1.05 + Math.random() * 0.1); }
      else if (k === "shot") { // bala de la mini torreta: disparo lejano de pistola, agudo y bajo; si no, chasquido agudo
        const l = soundManifest?.tipos.pistol.lejano; const f = l?.length ? l[Math.floor(Math.random() * l.length)] : null;
        if (f && playSample(sample(f), 0.1, 2.1)) return;
        const l2 = e.flash_aturdidora; if (l2?.length) playSample(sample(l2[0]), 0.08, 2.6);
      }
    },
  });
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
    toHub: () => toHub(), canHub: () => raid.active || waves.active,
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
      else if (a === "acc") {
        // Para probar: una pieza legendaria de cada accesorio que el generador puede ofrecer (ópticas, bocas, bajo el cañón y módulos)
        const found = new Map<string, AccKind>();
        for (const type of gen.types) for (let sd = 1; sd <= 30; sd++) {
          try { const w = gen.generate(sd * 17 + 3, type); for (const id of gen.opticOptions(w)) found.set(id, "optic"); for (const id of gen.muzzleOptions(w)) found.set(id, "muzzle"); } catch { /* arma sin opciones */ }
        }
        const lights = new Set(gen.lightPool().map((x) => x.id));
        for (const id of lights) found.set(id, "light");
        for (const d of gen.kit.options("Device", "any")) if (!lights.has(d.id)) found.set(d.id, "device");
        let n = 0;
        for (const [id, kind] of found) { if (id.startsWith("iron:")) continue; if (!inv.bank.some((b) => b.id === id && b.rarity === "legendaria")) { inv.bank.push(newAcc(kind, id, "legendaria")); n++; } }
        toast(t("set.dev.accDone", { n }));
      }
      else if (a === "gear") {
        // Para probar: una granada y un equipamiento legendarios de cada tipo que aún no se tenga (sin el tope de 8 del botín)
        let g = 0, e = 0;
        for (const k of GRENADE_KIND_LIST) if (!inv.grenades.some((x) => x.kind === k)) { inv.grenades.push(makeGrenade(Math.floor(Math.random() * 1e9), k, "legendaria")); g++; }
        for (const k of GADGET_KIND_LIST) if (!inv.gadgets.some((x) => x.kind === k)) { inv.gadgets.push(makeGadget(Math.floor(Math.random() * 1e9), k, "legendaria")); e++; }
        if (inv.grenadeActive < 0 && inv.grenades.length) inv.grenadeActive = 0;
        if (inv.gadgetActive < 0 && inv.gadgets.length) inv.gadgetActive = 0;
        toast(t("set.dev.gearDone", { g, e }));
      }
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
  // ---------- Tienda de mobiliario (terminal del hall): se compra lo que aparece en el hall ----------
  let furnCat: FurnCat | "all" = "all";
  function openFurniture() {
    state = "furniture"; input.unlock();
    const el = $("furniture"); el.hidden = false; const lvl = inv.progress.level, own = new Set(inv.furniture);
    const cats: (FurnCat | "all")[] = ["all", "fun", "util", "life", "decor"];
    const row = (f: (typeof FURNITURE)[number]) => {
      const have = own.has(f.id), locked = lvl < f.level, poor = inv.credits < f.price;
      const btn = have ? `<span class="fs-own">${t("fs.owned")}</span>` : locked ? `<span class="fs-lock">${t("fs.level", { n: f.level })}</span>`
        : `<button type="button" class="btn sm" data-buyfurn="${f.id}" ${poor ? "disabled" : ""}>${t("shop.buy", { c: f.price })}</button>`;
      return `<div class="fs-row${have ? " own" : ""}${locked ? " locked" : ""}"><span class="fs-ico">${FURN_ICON[f.cat]}</span><span class="fs-what"><b>${t(`fs.n.${f.id}`)}</b><small>${t(`fs.d.${f.id}`)}</small></span><span class="fs-cat">${t(`fs.cat.${f.cat}`)}</span>${btn}</div>`;
    };
    el.innerHTML = `<div class="term"><header class="termbar"><span class="sim">SIM//</span><h1>${t("fs.title")}</h1><span class="credits">${inv.credits} CR</span><button type="button" class="btn ghost sm" data-close>${t("ui.back")}</button></header>
      <section class="panel fs-list"><div class="seg">${cats.map((c) => `<button type="button" class="chip ${c === furnCat ? "on" : ""}" data-fcat="${c}">${t(`fs.cat.${c}`)}</button>`).join("")}</div>
      <p class="note">${t("fs.note", { n: own.size, of: FURNITURE.length })}</p>
      ${FURNITURE.filter((f) => furnCat === "all" || f.cat === furnCat).map(row).join("")}</section></div>`;
    nav.setRoot(el); setTimeout(() => nav.first(), 0);
  }
  function closeFurniture() { $("furniture").hidden = true; resume(); }
  $("furniture").addEventListener("click", (e) => {
    const tg = e.target as HTMLElement;
    if (tg.closest("[data-close]")) return closeFurniture();
    const c = tg.closest<HTMLElement>("[data-fcat]"); if (c) { furnCat = c.dataset.fcat as FurnCat | "all"; return openFurniture(); }
    const b = tg.closest<HTMLElement>("[data-buyfurn]");
    if (b) {
      const f = FURNITURE.find((x) => x.id === b.dataset.buyfurn); if (!f || inv.furniture.includes(f.id) || inv.credits < f.price || inv.progress.level < f.level) return;
      inv.credits -= f.price; inv.furniture.push(f.id); hallProps.apply(new Set(inv.furniture)); creditsHud(); autosave();
      toast(t("fs.bought", { n: t(`fs.n.${f.id}`) }));
      if (inv.furniture.length >= FURNITURE.length) hallBot.event("furnitureFull"); // (mobiliario completo)
      else hallBot.say(t("bot.furn", { n: t(`fs.n.${f.id}`) }), "excited"); openFurniture();
    }
  });
  const FURN_ICON: Record<FurnCat, string> = { fun: "♫", util: "⚙", life: "❀", decor: "◆" };
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
    rouletteCancel();
    if (raid.active) raid.end();
    inv.clear(); pickups.list.slice().forEach((p) => pickups.remove(p)); waves.stop();
    // Se empieza sin nada: puños y 0 créditos. El primer dinero sale de golpear o disparar a los muñecos de práctica.
    inv.gadgets = [makeGadget(Date.now() & 0xffff, "turret", "comun")]; inv.gadgetActive = 0; hallProps.apply(new Set(inv.furniture)); // (equipamiento inicial: una mini torreta)
    inv.credits = SHOP.newGameCredits; practice.acc = 0; practice.window = []; shopState = newShopState(); playSeconds = 0; inGame = true;
    applyPerks(); inv.changed(); php.reset();
    toast(t("ui.practiceTip"));
  }
  // Ruleta de armas (supervivencia, opcional): cada 30 s las armas equipadas se cambian por otras al azar; al salir vuelven las tuyas.
  const survOpt = { roulette: false };
  const roulette = { active: false, t: 0, saved: [null, null] as (Item | null)[], savedActive: 0, uids: new Set<number>() };
  const ROULETTE_EVERY = 30, ROULETTE_FIRST = 5; // (la primera ruleta llega a los 5 s; las siguientes, cada 30)
  const ROULETTE_RARITY: [RarityId, number][] = [["comun", 30], ["poco", 30], ["rara", 22], ["epica", 14], ["legendaria", 4]];
  /** Con la ruleta en curso se guardan las armas de verdad, no las prestadas. */
  function collect(name = ""): SaveData {
    if (!roulette.active) return collectRaw(name);
    const cur = [inv.equip[0], inv.equip[1]], act = inv.active;
    inv.equip[0] = roulette.saved[0]; inv.equip[1] = roulette.saved[1]; inv.active = roulette.savedActive;
    try { return collectRaw(name); } finally { inv.equip[0] = cur[0]; inv.equip[1] = cur[1]; inv.active = act; }
  }
  function collectRaw(name = ""): SaveData {
    const weapons = [...inv.equip.map((it, i) => ({ it, area: "equip" as const, index: i })), ...inv.pack.map((it, i) => ({ it, area: "pack" as const, index: i })), ...inv.storage.map((it, i) => ({ it, area: "storage" as const, index: i }))]
      .filter((x) => x.it).map((x) => ({ spec: x.it!.spec, ammo: x.it!.ammo, area: x.area, index: x.index }));
    return { version: SAVE_VERSION, savedAt: "", name, playSeconds: Math.round(playSeconds), credits: inv.credits, weapons, active: inv.active, bank: inv.bank, shop: shopState,
      settings: { ...settings }, lang: getLang(), pixelLevel: pixelLevel(), contracts, grenades: inv.grenades, grenadeActive: inv.grenadeActive, gadgets: inv.gadgets, gadgetActive: inv.gadgetActive, furniture: inv.furniture, superId: inv.superId, progress: inv.progress, supersOwned: inv.supersOwned, raidsDone: inv.raidsDone, armors: inv.armors, worn: inv.worn };
  }
  function apply(d: SaveData) {
    rouletteCancel();
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
    inv.furniture = (d.furniture ?? []).map((x) => (x === "pet" ? "roomba" : x)); hallProps.apply(new Set(inv.furniture));
    inv.gadgets = d.gadgets?.length ? d.gadgets : [makeGadget(4242, "turret", "comun")]; inv.gadgetActive = inv.gadgets[d.gadgetActive ?? -1] ? d.gadgetActive! : 0; setGadgetUid(Math.max(0, ...inv.gadgets.map((g) => g.uid)) + 1); // (partidas anteriores: una mini torreta de regalo)
    if (d.superId === "chrono") d.superId = "timestop";
    inv.superId = (SUPER_IDS as string[]).includes(d.superId ?? "") ? (d.superId as SuperId) : "shockwave"; meter.charge = 0;
    // Súperes: las partidas de antes de los módulos conservan el que tenían elegido
    inv.supersOwned = (d.supersOwned ?? (d.superId ? [d.superId] : [])).map((x) => (x === "chrono" ? "timestop" : x)).filter((x): x is SuperId => (SUPER_IDS as string[]).includes(x)); inv.raidsDone = d.raidsDone ?? 0;
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
  /** Partida del modo Hack en curso. */
  const hack = { active: false, seed: 0, depth: 0, data: 0, node: null as HackNode | null, extractable: false, path: [] as HackNode["kind"][], buffs: { damage: 0, rate: 0, health: 0, speed: 0, crit: 0 } as Record<HackBuff, number> };
  /** Defensa del núcleo en curso. */
  const dmode = { active: false, wave: 0, credits: 0, phase: "build" as "build" | "wave", t: 0, queue: [] as string[], spawnT: 0, rnd: Math.random };
  let injectT = 0, injectK = 0, chronoT = 0, chronoK = 1;
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
    // Modo Hack: mejoras temporales de la partida
    if (injectT > 0) { gun.perks.rate *= 1 + injectK; player.speedMult *= 1 + injectK * 0.6; } // (inyector)
    if (hack.active) { const b = hack.buffs; gun.perks.dmg *= 1 + b.damage; gun.perks.rate *= 1 + b.rate; gun.perks.critMult *= 1 + b.crit; php.setMax(php.max * (1 + b.health)); player.speedMult *= 1 + b.speed; }
    xpShown = "";
  }
  /** Módulo de súper: desbloquea uno que no tengas (si ya los tienes todos, se cambia por créditos). */
  function grantModule() {
    const id = rollModule(inv.supersOwned, Math.random());
    if (!id) { earn(400); toast(t("sp.moduleDup", { c: 400 })); return; }
    inv.supersOwned.push(id); if (!inv.supersOwned.includes(inv.superId)) inv.superId = id;
    lootChime(4); toast(t("sp.moduleGot", { n: t(`sp.${id}`) })); autosave(); hallBot.event("newSuper");
  }
  function gainXp(n: number) {
    const up = addXp(inv.progress, n * curPerks.fortune); xpShowT = 4; // (la barra se ve unos segundos al ganar experiencia)
    if (up) {
      applyPerks(); php.value = php.max; lootChime(3);
      toast(t("pg.levelUp", { l: inv.progress.level, p: up })); hallBot.event("levelUp");
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
  // ---------- Equipar desde el suelo (mantener usar): el objeto vuela a la mano y sustituye al que llevas ----------
  const PICK_HOLD = 0.45;
  let pickT = -1, pickDone = false;
  const flyers: { obj: THREE.Object3D; from: THREE.Vector3; t: number; done: () => void }[] = [];
  function flyToHand(obj: THREE.Object3D, done: () => void) { flyers.push({ obj, from: obj.position.clone(), t: 0, done }); }
  function updateFlyers(dt: number) {
    for (const fl of [...flyers]) {
      fl.t += dt / 0.28; const k = Math.min(1, fl.t), e = k * k * (3 - 2 * k);
      const hand = camera.getWorldPosition(new THREE.Vector3()).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.45)).add(new THREE.Vector3(0, -0.25, 0));
      fl.obj.position.lerpVectors(fl.from, hand, e); fl.obj.position.y += Math.sin(k * Math.PI) * 0.35; fl.obj.rotation.y += dt * 14; fl.obj.scale.setScalar(1 - 0.6 * e);
      if (k >= 1) { flyers.splice(flyers.indexOf(fl), 1); scene.remove(fl.obj); fl.done(); }
    }
  }
  function equipFromGround(ground: Pickup | null, gnade: (typeof nadeDrops)[number] | null, garmor: (typeof armorDrops)[number] | null, ggad: (typeof gadgetDrops)[number] | null) {
    { const l = soundManifest?.efectos.recoger_arma; if (l?.length) playSample(sample(l[0]), 0.55, 1.15); }
    if (ground) {
      // (fuera de la lista para que no se pueda volver a apuntar; al llegar a la mano se libera como siempre)
      const it = ground.item, root = ground.root; pickups.list.splice(pickups.list.indexOf(ground), 1);
      flyToHand(root, () => {
        pickups.list.push(ground); pickups.remove(ground);
        const slot = inv.active, old = inv.equip[slot];
        if (old) { const free = inv.pack.indexOf(null); inv.set({ area: "equip", index: slot }, null); if (free >= 0) inv.set({ area: "pack", index: free }, old); else dropItem(old); }
        inv.set({ area: "equip", index: slot }, it); inv.changed();
        toast(`${displayName(it.spec)} · ${t("ui.equippedTo")}`); autosave();
      });
    } else if (gnade) {
      if (inv.grenades.length >= 8) { toast(t("gr.full")); return; }
      nadeDrops.splice(nadeDrops.indexOf(gnade), 1);
      flyToHand(gnade.mesh, () => { inv.grenades.push(gnade.g); inv.grenadeActive = inv.grenades.length - 1; toast(t("ui.equippedNade", { n: t(`gr.${gnade.g.kind}`) })); });
    } else if (garmor) {
      if (inv.armors.length >= 12) { toast(t("ar.full")); return; }
      armorDrops.splice(armorDrops.indexOf(garmor), 1);
      flyToHand(garmor.mesh, () => { inv.armors.push(garmor.a); inv.worn[garmor.a.slot] = garmor.a.uid; applyPerks(); toast(t("ui.equippedNade", { n: t(`ar.name.${garmor.a.slot}.${garmor.a.variant}`) })); });
    } else if (ggad) {
      if (inv.gadgets.length >= 8) { toast(t("gd.full")); return; }
      gadgetDrops.splice(gadgetDrops.indexOf(ggad), 1);
      flyToHand(ggad.mesh, () => { inv.gadgets.push(ggad.g); inv.gadgetActive = inv.gadgets.length - 1; toast(t("ui.equippedNade", { n: t(`gd.${ggad.g.kind}`) })); });
    }
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
  preloadEnemyModels(); // (sabueso, reparador y centinela: GLB de assets/enemigos)
  const waves = new Waves(scene, dummies, $("bars"), () => player.pos, onDummyDamage, {
    onWaveStart: (_i, mod) => { php.noRegen = mod === "noregen"; if (mod) toast(t("wm.start", { m: t(`wm.${mod}`), d: t(`wm.d.${mod}`) })); },
    onWaveEnd: (i, last, reward) => {
      contractEvent({ type: "wave", reached: i + 1, clean: !waveHurt }); waveHurt = false; toast(t("ui.waveDone", { n: i + 1 })); earn(Math.round(SHOP.income.waveEnd * reward * curPerks.fortune)); gainXp(waveXp(i + 1, inv.progress.level) * reward); windUsed = false; hooksWaveEnd(i, last);
      if ((i + 1) % BOSS_EVERY === 0 && arena.layout) { arena.set(mutateArena(arena.layout, arena.bounds), true, player.pos); toast(t("ui.arenaShift")); } },
    onAllDone: () => { toast(t("ui.wavesDone")); autosave(); },
    onSelfDestruct: (d) => selfDestruct(d), onBlast: (at) => { gun.explode(at, 0, "explosive", undefined, 0xff7a3a, true); if (settings.screenShake) shake = Math.min(0.6, shake + 0.12); },
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
    // (mientras está el señuelo los enemigos le atacan a él: sus golpes no te llegan; dentro de la cúpula, tampoco los de fuera)
    if (deathFx.active) return;
    if (sfx.decoyPos) return;
    if (sfx.shieldsPlayer(player.pos)) return;
    dmg *= sfx.guard * curPerks.guard * damageTaken(armorT, kind) * gadgets.guardAt(player.pos); // (la cúpula del equipamiento protege dentro) // (armadura: reducción y resistencias)
    gun.gesture.hurt(dmg); // (el daño recibido nunca cancela el gesto de manos en curso: regla del encargo 34)
    if (curPerks.secondWind && !windUsed && php.value - dmg <= 0) { windUsed = true; php.value = php.max * 0.4; toast(t("pg.secondWind")); return; }
    if (dmg > 0) post.hit(dmg); // (la aberración cromática solo al recibir daño)
    if (php.hit(dmg)) {
      windUsed = false;
      // Animación de muerte (la mano se desintegra) y, al acabar, lo que toque según dónde estés
      session.event("muerte", { modo: sessionCtx().modo }); deathFx.start(() => {
        if (raid.active && hack.active) { hackEnd(false); return; }
        if (raid.active && dmode.active) { defenseEnd(); return; }
        if (raid.active) { toast(t("rd.lost")); returnHub(false); return; }
        if (waves.active) { leaveSurvival(); return; }
        waves.stop(); php.reset(); toast(t("ui.simReset"));
      });
    }
  }
  // ---------- Incursiones (ordenador de la sala B) ----------
  const mobs = new Waves(scene, dummies, $("bars"), () => player.pos, onDummyDamage, {
    onWaveEnd() {}, onAllDone() {}, onSelfDestruct: (d) => selfDestruct(d), onBlast: (at) => { gun.explode(at, 0, "explosive", undefined, 0xff7a3a, true); if (settings.screenShake) shake = Math.min(0.6, shake + 0.12); },
    onPlayerHit: (dmg, kind) => { if (settings.screenShake) shake = Math.min(0.5, shake + 0.18); hurtPlayer(dmg, kind); $("dmgflash").classList.remove("on"); void $("dmgflash").offsetWidth; $("dmgflash").classList.add("on"); },
  });
  mobs.playerLevel = () => inv.progress.level;
  waves.decoy = () => sfx.decoyPos ?? gadgets.decoyPos; mobs.decoy = () => sfx.decoyPos ?? gadgets.decoyPos ?? (dmode.active ? defense.decoyPos : null);
  let raidOpt: { rooms: number; difficulty: 0 | 1 | 2 } = { rooms: 6, difficulty: 0 }, raidReturnT = -1;
  const RAID_DIFF = [{ rarity: "rara", cr: 1, xp: 0.3 }, { rarity: "epica", cr: 1.6, xp: 0.45 }, { rarity: "legendaria", cr: 2.4, xp: 0.6 }] as const;
  const raid = new Raid(scene, {
    mobs, colliders: world.colliders, shootables: world.shootables, toast,
    announce: (k, p) => toast(t(k, p)),
    onBossPhase: () => { if (settings.screenShake) shake = Math.min(0.8, shake + 0.6); lootChime(2); },
    onClear: (n, of) => hack.active ? hackRoom() : toast(t("rd.cleared", { n, of: of - 1 })),
    onChest: (at) => { if (Math.random() < MODULE_CHANCE.raidChest) grantModule(); for (let i = 0; i < 2; i++) dropLoot("big", at.clone().add(new THREE.Vector3((i - 0.5) * 0.8, 0, 0))); toast(t("rd.chest")); },
    onWin: () => {
      if (hack.active) { hackSectorDone(); return; }
      const D = RAID_DIFF[raidOpt.difficulty], k = raidOpt.rooms / 6;
      const rarity = (D.rarity === "legendaria" && Math.random() < 0.5 ? "epica" : D.rarity) as RarityId;
      if (rarity === "legendaria") session.event("botin-legendario"); const it = makeItem(rollWeapon(rarity));
      if (!inv.add(it)) { const i = inv.storage.indexOf(null); if (i >= 0) { inv.storage[i] = it; inv.changed(); } }
      const cr = Math.round((120 + 12 * inv.progress.level) * D.cr * k * curPerks.fortune); earn(cr);
      gainXp(xpToNext(inv.progress.level) * D.xp * k);
      lootChime(4); toast(t("rd.won", { n: it.spec.name, c: cr })); if (run) { run.loot = it.spec.name; run.lootColor = it.spec.rarity.color; run.result = "won"; }
      inv.raidsDone++;
      if (inv.raidsDone === 1 || Math.random() < MODULE_CHANCE.raidBoss + MODULE_CHANCE.raidBossPerDifficulty * raidOpt.difficulty) setTimeout(grantModule, 1800); // (la primera incursión, seguro)
      raidReturnT = 6;
    },
  });
  /** Vuelve al vestíbulo (sala B, junto al ordenador) al ganar o morir. Al ganar, el botín del suelo viene contigo. */
  // ---------- Resumen al acabar una incursión o un hack ----------
  type Run = { mode: "raid" | "hack"; t0: number; kills: number; heads: number; cr0: number; lv0: number; loot?: string; lootColor?: string; result?: "won" | "lost" | "extracted" | "left"; rooms?: number; fights?: number };
  let run: Run | null = null;
  const beginRun = (mode: Run["mode"]) => { run = { mode, t0: playSeconds, kills: 0, heads: 0, cr0: inv.credits, lv0: inv.progress.level }; };
  function showRunSummary() {
    const r = run; run = null; if (!r) return;
    const res = r.result ?? "lost", secs = Math.max(0, Math.round(playSeconds - r.t0)), mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    const color = res === "won" || res === "extracted" ? "#7affc8" : res === "left" ? "#e8a040" : "#ff5a5a";
    const row = (k: string, v: string) => `<div class="sumrow"><span>${k}</span><b>${v}</b></div>`;
    const prog = r.mode === "raid" ? row(t("sum.rooms"), `${r.rooms ?? 0} / ${r.fights || "—"}`) : row(t("sum.depth"), String(hack.depth));
    state = "raidmenu"; input.unlock(); const el = $("raidmenu"); el.hidden = false;
    el.innerHTML = `<div class="term"><header class="termbar"><span class="sim">${r.mode === "raid" ? "RAID//" : "HACK//"}</span><h1 style="color:${color}">${t(`sum.${res}`)}</h1></header>
      <section class="panel ct-list summary">${prog}${row(t("sum.time"), mm)}${row(t("sum.kills"), String(r.kills))}${row(t("sum.heads"), String(r.heads))}
      ${row(t("sum.credits"), `+${Math.max(0, inv.credits - r.cr0)}`)}${inv.progress.level > r.lv0 ? row(t("sum.level"), `${r.lv0} → ${inv.progress.level}`) : ""}
      ${r.loot ? `<div class="sumrow"><span>${t("sum.loot")}</span><b style="color:${r.lootColor}">${r.loot}</b></div>` : ""}
      <div class="actions"><button type="button" class="btn" data-sumok="1" data-nav>${t("sum.ok")}</button></div></section></div>`;
    nav.setRoot(el); setTimeout(() => el.querySelector<HTMLElement>("[data-sumok]")?.focus(), 0);
  }
  $("raidmenu").addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("[data-sumok]")) { $("raidmenu").hidden = true; resume(); } });
  function returnHub(won: boolean) {
    session.event("fin-incursion", { ganada: won });
    const loot = won ? pickups.list.filter((p) => raid.contains(p.root.position)) : [];
    const summary = !!run && !dmode.active; if (run && !run.result) run.result = won ? "won" : "lost"; if (run) { run.rooms = raid.cleared; run.fights = raid.fights; }
    raid.end(); raidReturnT = -1; sfx.reset(); hallBot.event(won ? "raidWon" : "raidLost");
    const pc = world.interactables.find((i) => i.id === "raid")!.position;
    player.pos.set(pc.x - 2.5, 0, pc.z); player.vel.set(0, 0, 0); player.yaw = Math.PI / 2; player.pitch = 0;
    loot.forEach((p, i) => { p.root.position.set(pc.x - 4.5, 1.1, pc.z - 2 + i * 0.9); p.vel.set(0, 0, 0); p.resting = false; });
    php.reset(); autosave();
    if (summary) setTimeout(showRunSummary, 400);
  }
  /** Al hall, junto al ordenador de modos (sin tocar la incursión). */
  function toHall() {
    const pc = world.interactables.find((i) => i.id === "raid")!.position;
    player.pos.set(pc.x - 2.5, 0, pc.z); player.vel.set(0, 0, 0); player.yaw = Math.PI / 2; player.pitch = 0;
  }
  // ---------- Supervivencia: oleadas sin fin en la arena cerrada (se entra desde el ordenador de modos) ----------
  function rouletteRarity(): RarityId { let r = Math.random() * 100; for (const [id, w] of ROULETTE_RARITY) { if ((r -= w) < 0) return id; } return "comun"; }
  function rouletteStash(it: Item) { const free = inv.pack.indexOf(null); if (free >= 0) inv.set({ area: "pack", index: free }, it); else dropItem(it); }
  function rouletteRoll() {
    const names: string[] = [];
    for (let i = 0; i < inv.equip.length; i++) {
      const old = inv.equip[i]; if (old && !roulette.uids.has(old.uid)) rouletteStash(old); // botín recogido durante la ruleta: a la mochila
      const it = makeItem(rollWeapon(rouletteRarity())); roulette.uids.add(it.uid); inv.set({ area: "equip", index: i }, it); names.push(displayName(it.spec));
    }
    inv.changed(); toast(t("sv.rouletteNew", { names: names.join(" · ") }));
  }
  function rouletteStart() {
    roulette.saved = [inv.equip[0], inv.equip[1]]; roulette.savedActive = inv.active; roulette.uids.clear(); roulette.active = true; roulette.t = ROULETTE_EVERY - ROULETTE_FIRST;
    // Se empieza con las manos vacías (puños): las armas llegan con la ruleta, la primera a los 5 s.
    for (let i = 0; i < inv.equip.length; i++) inv.set({ area: "equip", index: i }, null);
    inv.active = 0; inv.changed();
  }
  function rouletteEnd() {
    if (!roulette.active) return; roulette.active = false;
    for (let i = 0; i < inv.pack.length; i++) { const it = inv.pack[i]; if (it && roulette.uids.has(it.uid)) inv.set({ area: "pack", index: i }, null); }
    const kept: Item[] = [];
    for (let i = 0; i < inv.equip.length; i++) { const it = inv.equip[i]; if (it && !roulette.uids.has(it.uid)) kept.push(it); inv.set({ area: "equip", index: i }, roulette.saved[i]); }
    for (const it of kept) rouletteStash(it);
    inv.active = inv.equip[roulette.savedActive] ? roulette.savedActive : Math.max(0, inv.equip.findIndex(Boolean));
    roulette.uids.clear(); inv.changed(); toast(t("sv.rouletteEnd"));
  }
  /** Al cargar otra partida las armas prestadas ya no existen: se descarta sin devolver nada. */
  function rouletteCancel() { roulette.active = false; roulette.uids.clear(); }
  function startSurvival() {
    session.event("inicio", { modo: "supervivencia" });
    if (raid.active) return;
    const at = world.survivalAt; sfx.reset();
    player.pos.copy(at.pos); player.vel.set(0, 0, 0); player.yaw = at.yaw; player.pitch = 0;
    php.reset(); arena.set(generateArena((Math.random() * 2 ** 31) | 0, arena.bounds), true, player.pos); waves.start(); toast(t("ui.wavesGo"));
    if (survOpt.roulette) rouletteStart();
  }
  function leaveSurvival() {
    const n = waves.index + 1; waves.stop(); sfx.reset(); php.reset(); toHall(); autosave();
    toast(t("sv.end", { n }));
  }
  /** Botón de pausa «Volver al hall»: sale del modo en curso (como rendirse; en el hack, si se puede, extrae). */
  function toHub() {
    if (hack.active) hackEnd(hack.extractable);
    else if (dmode.active) defenseEnd();
    else if (raid.active) { toast(t("rd.left2")); if (run) run.result = "left"; returnHub(false); }
    else if (waves.active) leaveSurvival();
    resume();
  }
  function startRaid() {
    session.event("inicio", { modo: "incursion" });
    beginRun("raid");
    mobs.mod = null; php.noRegen = false;
    const at = raid.start((Math.random() * 2 ** 31) | 0, raidOpt);
    mobs.index = raidOpt.difficulty * 5; // (nivel de los enemigos: +1 por cada 5)
    player.pos.copy(at.pos); player.vel.set(0, 0, 0); player.yaw = at.yaw; player.pitch = 0;
    php.reset(); waves.stop(); toast(t("rd.go"));
  }
  // ---------- Defensa del núcleo: construir entre oleadas en las plataformas y aguantar con el núcleo en pie ----------
  const defense = new DefenseFx(scene, {
    enemies: () => mobs.list,
    onHit(d, point, dmg, element) { const alive = d.alive; notGun = true; gun.hooks.onHit(d, "body", point, dmg, element, false); if (alive && !d.alive) gun.hooks.onKill?.(d); notGun = false; },
    sound: (k) => { const e = soundManifest?.efectos; if (!e) return; if (k === "boom") { const x = e.explosion; if (x?.length) playSample(sample(x[Math.floor(Math.random() * x.length)]), 0.25, 1.2); } else if (k === "zap") { const l = e.flash_aturdidora; if (l?.length) playSample(sample(l[0]), 0.12, 1.8); } },
  });
  let waveTerm: THREE.Group | null = null;
  function startDefense() {
    session.event("inicio", { modo: "defensa" });
    const seed = (Math.random() * 2 ** 31) | 0, at = raid.startNode(seed, "fight", [], 0, Math.floor(Math.random() * 5), true), room = raid.map!.rooms[1];
    Object.assign(dmode, { active: true, wave: 0, credits: START_CREDITS, phase: "build", t: BUILD_TIME, queue: [], spawnT: 0, rnd: seedRng(seed) });
    defense.setup(new THREE.Vector3(RAID_ORIGIN.x + room.cx, 0, RAID_ORIGIN.z + room.cz), Math.min(room.w, room.d) / 2 - 2, seedRng(seed ^ 77), room.covers.map((c) => ({ x: RAID_ORIGIN.x + c.x, z: RAID_ORIGIN.z + c.z, r: Math.max(c.w, c.d) / 2 })));
    mobs.core = { pos: defense.core.pos, targets: (k) => !HUNTERS.has(k), hit: (dmg) => { if (defense.hitCore(dmg)) defenseEnd(); } };
    player.pos.copy(defense.core.pos).add(new THREE.Vector3(0, 0, 4)); player.vel.set(0, 0, 0); player.yaw = 0; player.pitch = 0; void at;
    // Terminal junto al núcleo: E para adelantar la oleada
    if (waveTerm) scene.remove(waveTerm);
    waveTerm = new THREE.Group(); waveTerm.position.copy(defense.core.pos).add(new THREE.Vector3(3.2, 0, 1.5)); waveTerm.rotation.y = -0.6;
    { const st = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.5, roughness: 0.5 }), gl = new THREE.MeshStandardMaterial({ color: 0xff4a3a, emissive: 0xff4a3a, emissiveIntensity: 1.4 });
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.45), st); ped.position.y = 0.5; waveTerm.add(ped);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.55), st); top.position.y = 1.04; top.rotation.x = -0.35; waveTerm.add(top);
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), gl); btn.position.set(0, 1.09, 0.02); btn.rotation.x = -0.35; waveTerm.add(btn);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.02), gl); strip.position.set(0, 0.95, 0.24); waveTerm.add(strip); }
    scene.add(waveTerm);
    php.reset(); waves.stop(); toast(t("df.go", { s: BUILD_TIME }));
  }
  function defenseTick(dt: number, f: { interact: boolean; holdUse?: boolean; reload: boolean }) {
    defense.update(dt, dmode.phase === "wave");
    if (dmode.phase === "build") {
      dmode.t -= dt;
      // E lejos de las plataformas: lanzar ya la oleada (con premio por cada segundo adelantado)
      if (f.interact && waveTerm && player.pos.distanceTo(waveTerm.position) < 2 && dmode.t < (dmode.wave ? BUILD_BETWEEN : BUILD_TIME) - 1.5) { const bonus = Math.round(dmode.t * EARLY_BONUS); if (bonus > 0) { dmode.credits += bonus; toast(t("df.early", { c: bonus })); } dmode.t = 0; }
      if (dmode.t <= 0) { dmode.wave++; dmode.phase = "wave"; dmode.queue = coreWave(dmode.wave, dmode.rnd); dmode.spawnT = 0.5; mobs.index = Math.floor(dmode.wave * 0.8); defense.waveStart(); toast(t("df.wave", { n: dmode.wave })); }
    } else {
      if (dmode.queue.length) { dmode.spawnT -= dt; if (dmode.spawnT <= 0) { dmode.spawnT = SPAWN_GAP; for (let k = 0; k < 2 && dmode.queue.length; k++) { const room = raid.map!.rooms[1], side = Math.floor(Math.random() * 3), u = (Math.random() - 0.5) * Math.min(room.w * 0.8, 46);
        const ox = RAID_ORIGIN.x + room.cx, oz = RAID_ORIGIN.z + room.cz, hx = Math.min(room.w / 2 - 2, 26), hz = Math.min(room.d / 2 - 2, 26); /* (en la arena grande aparecen a ~26 m del núcleo: llegan antes) */ const pos = side === 0 ? new THREE.Vector3(ox + u, 0, oz + hz) : side === 1 ? new THREE.Vector3(ox + hx, 0, oz + u) : new THREE.Vector3(ox - hx, 0, oz + u);
        mobs.spawnAt(dmode.queue.shift() as never, pos); } } }
      else if (mobs.living === 0) { const gain = waveReward(dmode.wave) + defense.income(); dmode.credits += gain; dmode.phase = "build"; dmode.t = BUILD_BETWEEN; toast(t("df.cleared", { n: dmode.wave, c: gain, s: BUILD_BETWEEN })); lootChime(2); }
    }
    // Construir: junto a una plataforma, E (o mantener Ⓧ)
    const pad = defense.padNear(player.pos);
    if (pad && (f.interact || f.holdUse)) openBuildMenu(pad);
  }
  let buildPad: Pad | null = null;
  function openBuildMenu(pad: Pad) {
    buildPad = pad; state = "raidmenu"; input.unlock(); const el = $("raidmenu"); el.hidden = false;
    const p = pad.placed, head = `<header class="termbar"><span class="sim">CORE//</span><h1>${t("df.title")}</h1><span class="credits">⚡ ${dmode.credits}</span><button type="button" class="btn ghost sm" data-dfclose="1">${t("ui.back")}</button></header>`;
    let body = "";
    if (p) {
      const nx = p.level < 3 ? p.b.cost[p.level] : 0;
      body = `<h2>${t(`df.b.${p.b.id}`)} · ${t("df.lvl", { n: p.level })}</h2><p class="note">${t(`df.d.${p.b.id}`)}</p>
        <div class="actions">${p.level < 3 ? `<button type="button" class="btn" data-dfup="1" data-nav ${dmode.credits < nx ? "disabled" : ""}>${t("df.upgrade", { c: nx })}</button>` : `<span class="note">${t("df.max")}</span>`}
        <button type="button" class="btn ghost" data-dfsell="1" data-nav>${t("df.sell", { c: sellValue(p.b, p.level) })}</button></div>`;
    } else {
      const cats = ["turret", "trap", "structure", "support"] as const;
      body = cats.map((c) => `<h2>${t(`df.cat.${c}`)}</h2><div class="hknodes">${BUILDS.filter((b) => b.cat === c).map((b) => `<button type="button" class="tile hknode" style="border-color:#${b.color.toString(16).padStart(6, "0")}" data-dfb="${b.id}" data-nav ${dmode.credits < b.cost[0] ? "aria-disabled=\"true\"" : ""}><b>${t(`df.b.${b.id}`)}</b><span>${t(`df.d.${b.id}`)}</span><i>⚡ ${b.cost[0]}</i></button>`).join("")}</div>`).join("");
    }
    el.innerHTML = `<div class="term">${head}<section class="panel ct-list">${body}</section></div>`;
    nav.setRoot(el); setTimeout(() => el.querySelector<HTMLElement>("[data-nav]")?.focus(), 0);
  }
  function closeBuildMenu() { $("raidmenu").hidden = true; buildPad = null; resume(); }
  $("raidmenu").addEventListener("click", (e) => {
    if (!dmode.active || !buildPad) return; const tg = e.target as HTMLElement, pad = buildPad;
    if (tg.closest("[data-dfclose]")) return closeBuildMenu();
    const b = tg.closest<HTMLElement>("[data-dfb]"); if (b) { const id = b.dataset.dfb!, c = BUILD[id].cost[0]; if (dmode.credits < c) { toast(t("df.noCr")); return; } dmode.credits -= c; defense.build(pad, id); closeBuildMenu(); return; }
    if (tg.closest("[data-dfup]") && pad.placed && pad.placed.level < 3) { const c = pad.placed.b.cost[pad.placed.level]; if (dmode.credits < c) { toast(t("df.noCr")); return; } dmode.credits -= c; defense.upgrade(pad); openBuildMenu(pad); return; }
    if (tg.closest("[data-dfsell]") && pad.placed) { dmode.credits += sellValue(pad.placed.b, pad.placed.level); defense.sell(pad); closeBuildMenu(); }
  });
  function defenseEnd() {
    if (!dmode.active) return; dmode.active = false; mobs.core = null;
    const cr = Math.round(dmode.wave * (60 + inv.progress.level * 4) * curPerks.fortune); if (cr > 0) earn(cr);
    gainXp(xpToNext(inv.progress.level) * Math.min(2, dmode.wave * 0.1));
    toast(t("df.end", { n: dmode.wave, c: cr })); defense.clear(); if (waveTerm) { scene.remove(waveTerm); waveTerm = null; } $("raidmenu").hidden = true; returnHub(false); resume();
  }

  // ---------- Modo Hack: carrera continua por sectores (mapas de 5 salas con un guardián al final) ----------
  // Cada sala despejada da datos; tras el guardián se elige una mejora y se decide: extraer (cobrar) o bajar al
  // siguiente sector, más duro. Si caes, pierdes buena parte de los datos.
  const HACK_ROOMS = 5;
  const roomData = () => Math.round((40 + hack.depth * 18) * curPerks.fortune * (mobs.mod ? 1.4 : 1));
  function startHack() {
    session.event("inicio", { modo: "hack" });
    beginRun("hack");
    Object.assign(hack, { active: true, seed: (Math.random() * 2 ** 31) | 0, depth: 1, data: 0, node: null, extractable: false, path: [] });
    for (const k of HACK_BUFFS) hack.buffs[k] = 0;
    applyPerks(); php.reset(); waves.stop(); hackSector();
  }
  function hackSector() {
    $("raidmenu").hidden = true; resume();
    hack.extractable = false;
    const at = raid.start((hack.seed + hack.depth * 7919) >>> 0, { rooms: HACK_ROOMS, difficulty: Math.min(2, Math.floor((hack.depth - 1) / 2)) as 0 | 1 | 2 });
    mobs.index = hack.depth * 3;
    // Regla del sector (desde el 2): enemigos rápidos, duros, letales o sin regeneración; más datos a cambio
    const mods = ["fast", "tough", "lethal", "noregen"] as const;
    mobs.mod = hack.depth >= 2 ? mods[Math.floor(Math.random() * mods.length)] : null; php.noRegen = mobs.mod === "noregen";
    player.pos.copy(at.pos); player.vel.set(0, 0, 0); player.yaw = at.yaw; player.pitch = 0;
    toast(t("hk.sector", { n: hack.depth }));
    if (mobs.mod) setTimeout(() => { if (hack.active && mobs.mod) toast(t("wm.start", { m: t(`wm.${mobs.mod}`), d: t(`wm.d.${mobs.mod}`) })); }, 2600);
  }
  function hackRoom() { const n = roomData(); hack.data += n; lootChime(1); toast(t("hk.roomData", { n })); }
  function hackPanel(body: string) {
    state = "raidmenu"; input.unlock();
    const el = $("raidmenu"); el.hidden = false;
    const buffs = HACK_BUFFS.filter((b) => hack.buffs[b] > 0).map((b) => `${t(`hk.buff.${b}`)} +${Math.round(hack.buffs[b] * 100)} %`).join(" · ") || "—";
    el.innerHTML = `<div class="term"><header class="termbar"><span class="sim">HACK//</span><h1>${t("hk.title")}</h1><span class="credits">${t("hk.sectorN", { n: hack.depth })} · ${t("hk.data", { n: hack.data })}</span></header>
      <section class="panel ct-list"><p class="note">${t("hk.buffs")}: ${buffs}</p>${body}</section></div>`;
    nav.setRoot(el); setTimeout(() => el.querySelector<HTMLElement>("[data-nav]")?.focus(), 0);
  }
  let hackBuffOpts: HackBuff[] = [];
  /** Guardián derrotado: premio grande, elegir mejora y luego extraer o bajar. */
  function hackSectorDone() {
    const bonus = Math.round(roomData() * 3.5); hack.data += bonus; hack.extractable = true; lootChime(4);
    toast(t("hk.guardDown", { n: bonus }));
    setTimeout(() => {
      if (!hack.active) return;
      hackBuffOpts = [...HACK_BUFFS].sort(() => Math.random() - 0.5).slice(0, 3);
      hackPanel(`<h2>${t("hk.pickBuff")}</h2><div class="hknodes">${hackBuffOpts.map((b, i) => `<button type="button" class="tile hknode buff" data-hkb="${i}" data-nav><b>${t(`hk.buff.${b}`)}</b><i>+${Math.round(HACK_BUFF_VALUE[b] * 100)} %</i></button>`).join("")}</div>`);
    }, 2200);
  }
  function hackChoice() {
    hackPanel(`<h2>${t("hk.sectorClear", { n: hack.depth })}</h2>
      <div class="actions"><button type="button" class="btn" data-hkgo="1" data-nav>${t("hk.deeper", { n: hack.depth + 1 })}</button>
      <button type="button" class="btn ghost" data-hkx="1" data-nav>${t("hk.extract", { n: hack.data })}</button></div>
      <p class="note">${t("hk.extractNote", { p: Math.round(DEATH_LOSS * 100) })}</p>`);
  }
  function hackEnd(extracted: boolean) {
    if (run) run.result = extracted ? "extracted" : "lost";
    const pay = Math.round(hack.data * (extracted ? 1 : 1 - DEATH_LOSS));
    hack.active = false; mobs.mod = null; php.noRegen = false; applyPerks();
    if (pay > 0) earn(pay);
    gainXp(xpToNext(inv.progress.level) * Math.min(1.5, hack.depth * 0.25));
    toast(t(extracted ? "hk.extracted" : "hk.lost", { n: pay, d: hack.depth }));
    $("raidmenu").hidden = true; returnHub(extracted); resume();
  }
  $("raidmenu").addEventListener("click", (e) => {
    if (!hack.active) return; const tg = e.target as HTMLElement;
    const b = tg.closest<HTMLElement>("[data-hkb]"); if (b) { const id = hackBuffOpts[Number(b.dataset.hkb)]; hack.buffs[id] += HACK_BUFF_VALUE[id]; applyPerks(); toast(t("hk.gotBuff", { b: t(`hk.buff.${id}`) })); hackChoice(); return; }
    if (tg.closest("[data-hkgo]")) { hack.depth++; hackSector(); return; }
    if (tg.closest("[data-hkx]")) hackEnd(true);
  });
  let modeMenu: "raid" | "survival" | "defense" | "hack" = "raid";
  /** Menú del ordenador de un modo (cada modo tiene el suyo en la sala de modos). */
  function openRaidMenu(mode: typeof modeMenu = modeMenu) {
    modeMenu = mode;
    state = "raidmenu"; input.unlock();
    const el = $("raidmenu"); el.hidden = false;
    const chip = (k: string, v: number, on: boolean, label: string) => `<button type="button" class="chip ${on ? "on" : ""}" data-${k}="${v}" data-nav>${label}</button>`;
    const title = mode === "raid" ? t("rd.title") : mode === "survival" ? t("sv.title") : mode === "defense" ? t("df.title") : t("hk.title");
    const body = mode === "raid" ? `<p class="note">${t("rd.desc")}</p>
      <h2>${t("rd.length")}</h2><div class="chips">${[4, 6, 8].map((n) => chip("rooms", n, raidOpt.rooms === n, t(`rd.len${n}`, { n }))).join("")}</div>
      <h2>${t("rd.difficulty")}</h2><div class="chips">${[0, 1, 2].map((d) => chip("diff", d, raidOpt.difficulty === d, t(`rd.diff${d}`))).join("")}</div>
      <p class="note">${t(`rd.diffd${raidOpt.difficulty}`)}</p>
      <div class="actions"><button type="button" class="btn" data-go="1" data-nav>${t("rd.start")}</button></div>`
      : mode === "survival" ? `<p class="note">${t("sv.desc")}</p>
      <h2>${t("sv.roulette")}</h2><div class="chips">${chip("rou", 0, !survOpt.roulette, t("sv.rouletteOff"))}${chip("rou", 1, survOpt.roulette, t("sv.rouletteOn"))}</div>
      <p class="note">${t("sv.rouletteDesc")}</p><div class="actions"><button type="button" class="btn" data-surv="1" data-go="1" data-nav>${t("sv.start")}</button></div>`
      : mode === "defense" ? `<p class="note">${t("df.desc")}</p><div class="actions"><button type="button" class="btn" data-def="1" data-go="1" data-nav>${t("df.start")}</button></div>`
      : `<p class="note">${t("hk.desc")}</p><div class="actions"><button type="button" class="btn" data-hack="1" data-go="1" data-nav>${t("hk.start")}</button></div>`;
    el.innerHTML = `<div class="term"><header class="termbar"><span class="sim">SIM//</span><h1>${title}</h1><span class="credits">${t("pg.lv")} ${inv.progress.level}</span><button type="button" class="btn ghost sm" data-close="1">${t("ui.back")}</button></header>
      <section class="panel ct-list">${body}</section></div>`;
    nav.setRoot(el); setTimeout(() => el.querySelector<HTMLElement>("[data-go]")?.focus(), 0);
  }
  function closeRaidMenu() { $("raidmenu").hidden = true; resume(); }
  $("raidmenu").addEventListener("click", (e) => {
    const tg = e.target as HTMLElement;
    if (hack.active || dmode.active) return;
    if (tg.closest("[data-close]")) return closeRaidMenu();
    const r = tg.closest<HTMLElement>("[data-rooms]"); if (r) { raidOpt.rooms = Number(r.dataset.rooms); return openRaidMenu(); }
    const d = tg.closest<HTMLElement>("[data-diff]"); if (d) { raidOpt.difficulty = Number(d.dataset.diff) as 0 | 1 | 2; return openRaidMenu(); }
    const ru = tg.closest<HTMLElement>("[data-rou]"); if (ru) { survOpt.roulette = ru.dataset.rou === "1"; return openRaidMenu(); }
    if (tg.closest("[data-surv]")) { closeRaidMenu(); startSurvival(); return; }
    if (tg.closest("[data-hack]")) { $("raidmenu").hidden = true; startHack(); return; }
    if (tg.closest("[data-def]")) { $("raidmenu").hidden = true; resume(); startDefense(); return; }
    if (tg.closest("[data-go]")) { closeRaidMenu(); startRaid(); }
  });
  // Arena de oleadas: al azar al empezar; cambia un poco tras cada jefe
  const arena = new WaveArena(scene, world.colliders, world.shootables, { x0: world.wavesRoom.x0, x1: world.wavesRoom.x1, z0: world.wavesRoom.z0 + 0.5, z1: world.wavesRoom.z1 });
  arena.set(generateArena((Math.random() * 2 ** 31) | 0, arena.bounds), false);
  const hooksWaveEnd = (_i: number, last: Dummy | null) => { session.event("fin-oleada", { n: _i + 1 }); dropLoot("waveEnd", last?.group.position ?? new THREE.Vector3(0, 0, 8)); };
  function healthHud() {
    // Vida del jugador: siempre visible abajo a la izquierda, con cifras (y la oleada en curso encima)
    const el = $("phealth"); const show = state === "play";
    el.hidden = !show; if (!show) return;
    el.querySelector<HTMLElement>("i")!.style.width = `${(php.value / php.max) * 100}%`;
    el.querySelector<HTMLElement>("span")!.textContent = `${Math.ceil(php.value)} / ${php.max}` + (waves.active ? `  ·  ${t("ui.waveN", { n: waves.index + 1, of: "∞", left: waves.remaining })}${waves.mod ? ` · ${t(`wm.${waves.mod}`)}` : ""}${roulette.active ? ` · ${t("sv.rouletteIn", { s: Math.ceil(ROULETTE_EVERY - roulette.t) })}` : ""}` : raid.active && dmode.active ? `  ·  ${t("df.hud", { w: dmode.wave, hp: Math.ceil(defense.core.hp), max: defense.core.max, c: dmode.credits })}${defense.core.shield > 0 ? ` · 🛡 ${Math.ceil(defense.core.shield)}` : ""}${dmode.phase === "build" ? ` · ${t("df.buildT", { s: Math.ceil(dmode.t) })}` : raid.enemiesLeft || mobs.living ? ` · ${t("rd.left", { n: mobs.living + dmode.queue.length })}` : ""}`: raid.active && hack.active ? `  ·  HACK · ${t("hk.sectorN", { n: hack.depth })}${mobs.mod ? ` · ${t(`wm.${mobs.mod}`)}` : ""} · ${t("rd.hud", { n: raid.cleared, of: raid.fights })} · ${t("hk.data", { n: hack.data })}${raid.enemiesLeft ? ` · ${t("rd.left", { n: raid.enemiesLeft })}` : ""}${raid.timeLeft !== null ? ` · ⏱ ${Math.ceil(raid.timeLeft)} s` : ""}` : raid.active ? `  ·  ${t("rd.hud", { n: raid.cleared, of: raid.fights })}${raid.enemiesLeft ? ` · ${t("rd.left", { n: raid.enemiesLeft })}` : ""}${raid.timeLeft !== null ? ` · ⏱ ${Math.ceil(raid.timeLeft)} s` : ""}` : "");
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
  // Equipamiento en el suelo: un cristal girando del color de su rareza, con su haz; se recoge con usar
  const gadgetDrops: { g: GadgetSpec; mesh: THREE.Group; t: number }[] = [];
  function dropGadget(g: GadgetSpec, at: THREE.Vector3) {
    const grp = new THREE.Group(), col = new THREE.Color(GADGET_RARITY[g.rarity].color), body = new THREE.Group(); grp.add(body);
    body.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0x20242c, metalness: 0.6, roughness: 0.35, emissive: col, emissiveIntensity: 0.6 })));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 6, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = Math.PI / 2; body.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.y = 1.1; grp.add(beam);
    grp.position.copy(at).setY(0.35); scene.add(grp); gadgetDrops.push({ g, mesh: grp, t: LOOT.expireSeconds });
    lootChime(LEVEL[g.rarity] ?? 0);
  }
  function updateGadgetDrops(dt: number) {
    for (const n of [...gadgetDrops]) { n.t -= dt; n.mesh.rotation.y += dt * 2; n.mesh.children[0].position.y = Math.sin(gameTime * 3) * 0.05; if (n.t <= 0) { scene.remove(n.mesh); gadgetDrops.splice(gadgetDrops.indexOf(n), 1); } }
  }
  function gadgetTarget(look: THREE.Vector3) {
    let best: (typeof gadgetDrops)[number] | null = null, bd = 1e9;
    for (const n of gadgetDrops) { const to = n.mesh.position.clone().sub(camera.position), d = to.length(); if (d < 3 && to.normalize().dot(look) > 0.86 && d < bd) { bd = d; best = n; } }
    return best;
  }
  function pickGadget(n: (typeof gadgetDrops)[number]) {
    if (inv.gadgets.length >= 8) { toast(t("gd.full")); return; }
    inv.gadgets.push(n.g); if (inv.gadgetActive < 0) inv.gadgetActive = inv.gadgets.length - 1;
    toast(t("gd.found", { n: t(`gd.${n.g.kind}`), r: t(`rarity.${n.g.rarity}`) }));
    hallBot.event("newGadget");
    { const l = soundManifest?.efectos.recoger_granada; if (l?.length) playSample(sample(l[0]), 0.6, 1.3); }
    scene.remove(n.mesh); gadgetDrops.splice(gadgetDrops.indexOf(n), 1);
  }
  function dropLoot(source: LootSource, at: THREE.Vector3) {
    const onGround = pickups.list.filter((p) => p.expires != null).length;
    const rarity = loot.kill(source, gameTime, onGround);
    if (!rarity) return;
    const a = Math.random() * Math.PI * 2;
    // De vez en cuando, en lugar del arma cae una granada de esa rareza (menos común que las armas)
    if (Math.random() < 0.12) { dropGadget(makeGadget(Math.floor(Math.random() * 1e9), undefined, rarity as GadgetRarity), at); return; } // (a veces, equipamiento)
    if (Math.random() < 0.2) { dropNade(makeGrenade(Math.floor(Math.random() * 1e9), undefined, rarity as GrenadeRarity), at); return; }
    if (Math.random() < 0.15) { dropArmor(makeArmor(Math.floor(Math.random() * 1e9), undefined, rarity as ArmorRarity), at); return; } // (a veces, una pieza de armadura)
    const spec = rollWeapon(rarity);
    pickups.spawn(makeItem(spec), at.clone().setY(1.1), new THREE.Vector3(Math.cos(a) * 1.2, 3.4, Math.sin(a) * 1.2), { compile: true, expires: LOOT.expireSeconds });
    lootChime(LEVEL[rarity] ?? 0);
    if (LEVEL[rarity] >= 3) toast(t("ui.lootDrop", { r: t(`rarity.${rarity}`), n: spec.name }));
  }

  function nearInteractable(): Interactable | null {
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    for (const i of [...world.interactables, ...hallProps.activeProps()] as Interactable[]) {
      const to = i.position.clone().sub(player.pos); to.y = 0;
      if (to.length() < i.radius && (to.length() < 1 || to.normalize().dot(fwd) > 0.3)) return i;
    }
    return null;
  }

  // ---------- Navegación de menús: teclado ----------
  const back = () => {
    if (dialog.isOpen) return dialog.cancel();
    if (state === "contracts") closeContracts();
    if (state === "furniture") closeFurniture();
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
  // usado por las pruebas automáticas; `manual`: el bucle se detiene y solo avanza con `__game.step(dt)` (capturas
  // fotograma a fotograma con un paso fijo, tools/capture/)
  const debug = { fire: false, aim: false, manual: false, noDraw: false };
  const loop = () => frame();
  let frameNo = 0;
  sessionCtx = () => ({ modo: hack.active ? "hack" : dmode.active ? "defensa" : raid.active ? "incursion" : waves.active ? "supervivencia" : "hall", arma: inv.current ? displayName(inv.current.spec) : "puños", nivel: inv.progress.level });
  // ---------- Tarea 1: física con Rapier (prototipo; solo si está activa: por defecto, en modo desarrollador) ----------
  let phys: PhysicsLayer | null = null, physLoading = false;
  function physicsTick(dt: number) {
    if (!phys && !physLoading && (settings.physics ?? settings.dev)) {
      physLoading = true;
      // (carga perezosa: Rapier y la capa solo se descargan al activar la física)
      void import("./physworld").then(({ PhysicsLayer }) => {
        phys = new PhysicsLayer(scene, world.shootables, camera);
        // Explosiones: se engancha a las de las armas y las granadas sin tocar su código (envolviendo el método)
        const gx = gun.explode.bind(gun);
        gun.explode = (at, dmg, el, except, color, fxOnly) => { phys?.explode(at, 5, 6); return gx(at, dmg, el, except, color, fxOnly); };
        const nx = (nades as unknown as { explode: (g: { radius: number }, at: THREE.Vector3, scale: number) => void });
        const ng = nx.explode.bind(nades);
        nx.explode = (g, at, scale) => { phys?.explode(at, g.radius * 1.3, 7 * scale); return ng(g, at, scale); };
        (window as unknown as Record<string, unknown>).__phys = phys;
      });
    }
    phys?.update(dt, [...dummies, ...waves.list, ...mobs.list]);
  }
  function frame(manualDt?: number) {
    if (debug.manual && manualDt === undefined) { clock.getDelta(); requestAnimationFrame(loop); return; }
    const dt = manualDt ?? Math.min(clock.getDelta(), 0.05);
    if (settings.sessionLog && inGame && !session.active) session.start(); else if (session.active && (!settings.sessionLog || !inGame)) session.stop();
    if (session.noteOpen) { if (manualDt === undefined) requestAnimationFrame(loop); return; } // escribiendo una nota: el juego espera
    session.tick(dt);
    const edges = input.padEdges();
    if (session.active && edges[8]) session.mark(); // botón Atrás del mando = marca
    const f = input.read(dt, edges);
    // Muriendo: sin control (la animación de muerte manda)
    if (deathFx.active) { f.moveX = f.moveZ = f.lookX = f.lookY = 0; f.fire = f.aim = f.jump = f.reload = f.interact = f.swap = f.sprint = f.crouch = false; f.grenade = f.gadget = f.super = f.kick = f.inspect = f.holdUse = f.useHeld = false; f.inventory = false; }
    if (debug.fire) f.fire = true;
    if (debug.aim) f.aim = true;
    const pad = input.pad();
    const menu = state !== "play";
    cursor.show(menu); gun.hidden = menu || deathFx.active;

    if (state === "play") {
      if (f.pause) { input.unlock(); openStart(); }
      // Inventario: primero el gesto (la mano izquierda pulsa un botón del casco) y se abre al pulsar
      if (f.inventory && !gun.helmetBusy && !gun.superPose) { gun.helmetTap(); setTimeout(() => { if (state === "play") openScreen("inventory"); }, Gun.HELMET_PRESS * 1000); }
      syncNade();
      if (settings.dev) meter.charge = 1;
      if (f.super && !inv.hasSuper(inv.superId)) toast(t("sp.noModule"));
      else if (f.super && !sfx.casting && !sfx.busy) { if (meter.use()) sfx.cast(inv.superId); else toast(t("sp.notReady")); }
      if (f.gadget) {
        if (!inv.gadget) toast(t("gd.none"));
        else if (inv.gadget.kind === "teleport" && gadgets.tryTeleport()) gun.gadgetGesture("activate"); // (segunda pulsación: viaje sin gastar carga)
        else if (gpouch.charges <= 0) toast(t("gd.empty"));
        else if (gadgets.use(inv.gadget)) { gpouch.use(); gun.gadgetGesture(GADGET_THROW.has(inv.gadget.kind) ? "throw" : "activate"); } else toast(t("gd.fail"));
      }
      if (f.grenade) {
        const g = inv.grenade;
        if (!g) toast(t("gr.none"));
        else if (isGadgetGrenade(g.kind)) {
          // Reclasificadas desde equipamiento: mismo efecto, pero con las cargas y recarga de la granada (pouch).
          if (pouch.charges > 0) {
            const d = GADGET_KINDS[g.kind];
            const spec: GadgetSpec = { uid: g.uid, kind: g.kind, rarity: g.rarity, seed: g.seed, power: g.damage, radius: g.radius, duration: d.duration, charges: g.charges, recharge: g.recharge };
            if (gadgets.use(spec)) { pouch.use(); gun.gadgetGesture("throw"); }
          }
        }
        else if (pouch.use()) { gun.gadgetGesture("throw"); const dir = camera.getWorldDirection(new THREE.Vector3()); nades.throw(g, camera.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.15, 0)), dir); }
      }
      const key = input.device === "pad" ? `<kbd class="hold" style="--p:${Math.round(input.useHold * 100)}%">${PAD_NAMES[input.padBinds.useReload]}</kbd>${t("ui.holdBtn")} ` : `<kbd>${input.binds.use.replace(/^Key/, "")}</kbd>`;
      const look = camera.getWorldDirection(new THREE.Vector3());
      const ground = pickups.target(camera.position, look);
      const gnade = ground ? null : nadeTarget(look), garmor = ground || gnade ? null : armorTarget(look), ggad = ground || gnade || garmor ? null : gadgetTarget(look);
      const near = ground || gnade || garmor || ggad ? null : nearInteractable();
      $("prompt").hidden = !ground && !near && !gnade && !garmor && !ggad;
      if (ground) $("prompt").innerHTML = `${key}${t("ui.pickup")}`;
      else if (gnade) $("prompt").innerHTML = `${key}${t("ui.pickupNade")}`;
      else if (garmor) $("prompt").innerHTML = `${key}${t("ar.pickup")}`;
      else if (ggad) $("prompt").innerHTML = `${key}${t("gd.pickup")}`;
      else if (near && near.id === "furniture") $("prompt").innerHTML = `${key}${t("fs.use")}`;
      else if (near && HALL_PROP.has(near.id)) $("prompt").innerHTML = `${key}${hallProps.prompt(near.id as HallPropId)}`;
      else if (near) $("prompt").innerHTML = `${key}${t(near.id === "chest" ? "ui.useShop" : near.id === "waves" ? (waves.active ? "ui.wavesStop" : "ui.wavesStart") : near.id === "storage" ? "ui.useStorage" : near.id === "contracts" ? "ct.use" : near.id === "raid" ? "rd.use" : near.id === "survival" ? "sv.use" : near.id === "defense" ? "df.use" : near.id === "hack" ? "hk.use" : "ui.useBench")}`;
      // Plataforma de construcción cerca: qué hay y qué se puede hacer
      if (dmode.active && !near && !ground && !gnade && !garmor) { const pad = defense.padNear(player.pos); if (pad) { $("prompt").hidden = false; $("prompt").innerHTML = `${key}${pad.placed ? t("df.padUpgrade", { n: t(`df.b.${pad.placed.b.id}`), l: pad.placed.level }) : t("df.padBuild")}`; } }
      if (dmode.active && dmode.phase === "build" && waveTerm && player.pos.distanceTo(waveTerm.position) < 2) { $("prompt").hidden = false; $("prompt").innerHTML = `${key}${t("df.startNow")}`; }
      // Ficha del arma del suelo comparada con la que llevas
      const card = $("pickcard");
      if ((ground ?? gnade ?? garmor ?? ggad) !== shownPickup) {
        shownPickup = ground ?? gnade ?? garmor ?? ggad;
        const worn = garmor ? inv.wornOf(garmor.a.slot) : null;
        card.innerHTML = ground ? weaponCard(ground.item.spec, inv.current && inv.current !== ground.item ? inv.current.spec : null, inv.current ? t("ui.compared") : "") : gnade ? grenadeCard(gnade.g, inv.grenade ? t("ui.compared") : "", inv.grenade) : garmor ? armorCard(garmor.a, worn ? t("ui.compared") : "", worn) : ggad ? gadgetCard(ggad.g, inv.gadget ? t("gd.compared") : "", inv.gadget) : "";
        card.hidden = !ground && !gnade && !garmor && !ggad; if (gnade) fillNadeThumbs(card); if (garmor) fillArmorThumbs(card);
      }
      // Objetos del suelo: pulsar usar (X / E) los guarda; mantenerlo (PICK_HOLD) los equipa en lugar del que llevas,
      // con el objeto volando a la mano. Mientras se decide no se recarga (en el mando, Ⓧ también es recargar).
      const target = (ground ?? gnade ?? garmor ?? ggad) as object | null;
      if (f.useHeld && target && (pickT >= 0 || f.interact || input.device === "pad")) {
        if (pickT < 0) { pickT = 0; pickDone = false; } pickT += dt; f.reload = false;
        if (!pickDone && pickT >= PICK_HOLD) { pickDone = true; equipFromGround(ground, gnade, garmor, ggad); }
      } else if (!f.useHeld && pickT >= 0) {
        if (!pickDone && target) { if (ground) pickUp(ground); else if (gnade) pickNade(gnade); else if (garmor) pickArmor(garmor); else if (ggad) pickGadget(ggad); }
        pickT = -1; f.reload = false;
      }
      if (target) $("prompt").innerHTML = `${input.device === "pad" ? `<kbd class="hold" style="--p:${Math.round(Math.max(0, pickT) / PICK_HOLD * 100)}%">${PAD_NAMES[input.padBinds.useReload]}</kbd>` : `<kbd>${input.binds.use.replace(/^Key/, "")}</kbd>`} ${t("ui.pickTap")} · ${t("ui.pickHold")}`;
      // Ⓧ del mando: mantener = usar lo que hay cerca (pulsar y soltar recarga)
      if (f.holdUse && !target && near) f.interact = true;
      if (f.interact) {
        if (target) { /* (recoger y equipar del suelo: arriba, al soltar o al mantener) */ }
        else if (near && near.id === "furniture") openFurniture();
        else if (near && HALL_PROP.has(near.id)) hallProps.interact(near.id as HallPropId);
        else if (near) {
          if (near.id === "chest") openScreen("shop");
          else if (near.id === "waves") { if (waves.active) waves.stop(); else { php.reset(); arena.set(generateArena((Math.random() * 2 ** 31) | 0, arena.bounds), true, player.pos); waves.start(); toast(t("ui.wavesGo")); } }
          else if (near.id === "storage") openScreen("inventory", true);
          else if (near.id === "contracts") openContracts();
          else if (near.id === "raid" || near.id === "survival" || near.id === "defense" || near.id === "hack") openRaidMenu(near.id);
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
      if (f.light) { const on = gun.toggleDevice(); if (on !== null) toast(t(on ? "ui.lightOn" : "ui.lightOff")); }
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
        const scr = activeScreen(); if (scr) for (const b of [2, 3, 4, 5, 6, 7, 11]) if (edges[b]) scr.pad(b);
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
    { const d = deathFx.update(state === "play" ? dt : 0); if (d.drop) { camera.rotation.x += d.pitch; camera.rotation.z += d.roll; camera.position.y -= d.drop; } }
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
      if (tsInvT > 0) tsInvT -= dt; if (chronoT > 0) chronoT -= dt;
      const ts = sfx.timeScale * (chronoT > 0 ? chronoK : 1); // (parada del tiempo / inyección temporal)
      const wdt = hitstop > 0 ? 0 : dt;
      waves.update(wdt * ts); arena.update(dt);
      if (roulette.active) { if (!waves.active) rouletteEnd(); else if ((roulette.t += dt) >= ROULETTE_EVERY) { roulette.t = 0; rouletteRoll(); } }
      if (raid.active) { mobs.update(wdt * ts); raid.update(dt, player.pos); if (dmode.active) defenseTick(dt, f); if (raidReturnT > 0 && (raidReturnT -= dt) <= 0) returnHub(true); }
      // Nova espiritual: hay que quedarse quieto mientras se carga; si te mueves se cancela y pierdes la carga
      if (sfx.castingId === "spirit" && !sfx.castHit && (Math.abs(f.moveX) > 0.15 || Math.abs(f.moveZ) > 0.15 || f.jump)) { sfx.cancel(); toast(t("sp.spiritCancel")); }
      lastMove.x = f.moveX; lastMove.z = f.moveZ;
      rewindHist.push({ t: performance.now(), p: player.pos.clone(), hp: php.value }); while (rewindHist.length > 2 && performance.now() - rewindHist[0].t > 6000) rewindHist.shift();
      if (!sfx.casting && !sfx.busy) meter.update(dt); sfx.update(dt, player.pos); superHud();
      // Círculo de pruebas del campo de tiro: súper siempre cargada y equipamiento sin gastar cargas mientras estás dentro
      { const inZone = !raid.active && Math.hypot(player.pos.x - world.testZone.x, player.pos.z - world.testZone.z) < 1.5;
        if (inZone) { meter.charge = 1; if (inv.gadget) gpouch.charges = inv.gadget.charges; }
        if (inZone && !wasInZone) toast(t("ui.testZone")); wasInZone = inZone; }
      syncGadget(); gpouch.update(dt); gadgets.update(state === "play" ? dt : 0); gadgetHud();
      if (injectT > 0 && (injectT -= dt) <= 0) applyPerks();
      physicsTick(dt);
      pouch.update(dt * curPerks.nadeRecharge * armorNade); updateArmorDrops(dt); updateGadgetDrops(dt); updateFlyers(dt); nades.update(dt); nadeHud(); updateNadeDrops(dt); php.update(dt); gameTime += dt; loot.tick(dt, gameTime);
    }
    healthHud(); xpHud(dt);
    {
      const now = performance.now() / 1000;
      while (sim.log.length && now - sim.log[0][0] > 3) sim.log.shift();
      const dps = sim.log.reduce((a, x) => a + x[1], 0) / 3;
      { const p = player.pos, inHall = state === "play" && !raid.active && p.x > -24 && p.x < 24 && p.z > 0 && p.z < 28;
        // Entras al hall con menos de 50 CR: el asistente se ríe un poco de tu bolsillo (si no hay otra cosa pendiente)
        if (inHall && !wasInHall && inv.credits < LOW_CREDITS_BOT && !hallBot.hasPending) hallBot.event("lowCredits");
        wasInHall = inHall;
        hallBot.update(dt, inHall, p, camera.getWorldDirection(new THREE.Vector3())); hallProps.update(dt, p, inHall); }
      world.update(dt, { dps, ttk: sim.ttk, accuracy: sim.shots ? Math.min(1, sim.hits / sim.shots) : null, distance: sim.distance, message: t(now - sim.lastShot < 2 ? "sim.active" : "sim.calibrating") });
    }
    // Miras: visor a pantalla completa o retícula de punto rojo / holográfica
    const scopeOn = state === "play" && gun.sight === "scope" && gun.aimT > 0.9;
    $("scope").classList.toggle("on", scopeOn);
    const rd = $("reddot");
    const reticle = reticleFor(gun.item?.spec.optic ?? null, gun.sight);
    if (rd.dataset.reticle !== reticle) { rd.dataset.reticle = reticle; rd.innerHTML = reticle ? RETICLES[reticle] : ""; }
    rd.style.opacity = state === "play" && (gun.sight === "dot" || gun.sight === "holo") ? String(Math.max(0, (gun.aimT - 0.6) / 0.4)) : "0";
    // (pausa, inventario y demás menús paran el mundo: los enemigos no se mueven ni atacan)
    const stop = (state === "play" && hitstop > 0) || state !== "play"; hitstop = Math.max(0, hitstop - dt);
    for (const d of dummies) d.update(stop ? 0 : dt * sfx.timeScale * (chronoT > 0 ? chronoK : 1), camera, innerWidth, innerHeight);
    numbers.update(state === "play" ? dt : 0, camera, innerWidth, innerHeight);
    if (state === "workbench" || state === "pause" || state === "title") view.update(dt);
    if (state === "shop") shop.update(dt);
    hud();
    // Detrás del inventario, el taller y la máquina la sala apenas se ve: se redibuja 1 de cada 4 fotogramas
    // (el inicio y la pausa la mantienen viva). Así abrir un menú no cuesta más que jugar.
    frameNo++; fpsTick();
    // Sombras: solo en el complejo (la luz que las proyecta no llega a la incursión) y cada 2 fotogramas
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = !raid.active && frameNo % 2 === 0;
    if (!debug.noDraw && (state === "play" || state === "title" || state === "pause" || frameNo % 4 === 0)) draw(dt);
    if (manualDt === undefined) requestAnimationFrame(loop);
  }
  player.applyCamera(camera, 0);
  await refreshLatest();
  openStart();
  // Precalentado (en la pantalla de inicio): se montan armas de muestra de cada tipo y se compilan sus materiales,
  // también los recortados del efecto de aparición, aquí y en el renderizador de miniaturas. Así la primera vez que
  // aparece un arma en la tienda, el suelo o la mano no hay que compilar nada en mitad del juego.
  setTimeout(async () => {
    const warm = new THREE.Group(); warm.position.set(0, -60, 0); scene.add(warm);
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);
    const types = ["rifle", "smg", "pistol", "shotgun", "sniper", "lmg", "bullpup", "revolver"] as const;
    for (let i = 0; i < types.length * 2; i++) {
      try {
        const spec = gen.generate(7001 + i * 37, types[i % types.length]);
        const built = await asm.assemble(spec);
        warm.add(built.group);
        const clipped = built.group.clone(); clipped.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = ([] as THREE.Material[]).concat(m.material).map((x) => { const c = x.clone(); c.clippingPlanes = [clip]; return c; })[0]; }); warm.add(clipped);
        thumbs.warm(built.group);
      } catch { /* (un arma de muestra que falle no importa) */ }
      await new Promise((r) => setTimeout(r, 30));
    }
    try { await renderer.compileAsync(scene, camera); } catch { /* sin compilación en paralelo: se compila al dibujar */ }
    scene.remove(warm);
  }, 1500);
  frame();
  (window as unknown as Record<string, unknown>).__game = { hallBot, deathFx, hallProps,
    debug, step: (dt = 1 / 60) => frame(dt), gen, inv, gun, nades, pickups, pickUp, player, setSetting, renderer, scene, dummies, waves, php, bench, shop, start, invScreen, dialog, nav, saves,
    makeGadget, gadgets, loot, dropLoot, openScreen, openStart, resume, newGame, collect, apply, autosave, setLang, earn, meter, sfx, gainXp, applyPerks, world, raid, startRaid, startHack, startDefense, defense, dmode, returnHub, mobs, openRaidMenu, arena, mutateArena,
    cardHTML: (s: WeaponSpec) => weaponCard(s), openChest: () => openScreen("shop"), get state() { return state; }, set state(v: State) { state = v; }, get shopState() { return shopState; },
  };
}

boot().catch((e) => { $("start-text").textContent = t("ui.loadError", { e: e.message }); console.error(e); });
