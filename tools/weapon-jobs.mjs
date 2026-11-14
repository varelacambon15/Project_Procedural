import { readFileSync } from "node:fs";
// Lista de conversiones: qué archivo de raw/ se convierte en qué arma y con qué piezas.
const Q = "raw/quaternius-ultimate-gun-pack/OBJ";
const C = "raw/cosmo-low-poly-guns";
const A = "raw/asimov-weapon-pack/Asimov_Weapon_Pack.fbx";
const CTEX = "/raw/cosmo-low-poly-guns/uv_palette_modern.png";
const QSCALE = 0.122; // escala del pack de Quaternius (pistola de 1,8 u -> 0,22 m), para accesorios

const q = (file, type, extra = {}) => ({ kind: "obj", pack: "quaternius", id: `q-${file.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: file.replace(/_/g, " "), obj: `${Q}/${file}.obj`, mtl: `${Q}/${file}.mtl`, type, ...extra });
const range = (n, from = 1) => Array.from({ length: n }, (_, i) => i + from);

// Armas cuyas piezas hijas vienen mal transformadas en el FBX: se usa solo el cuerpo.
const BODY_ONLY = { "c-smg-9": "^subfusil_9$", "c-rifle-6": "^fusil_6$" };

const ALL = [
  // --- Quaternius (CC0) ---
  ...range(6).map((i) => q(`Pistol_${i}`, "pistol", { split: "pistol" })),
  ...range(5).map((i) => q(`Revolver_${i}`, "revolver")),
  ...range(5).map((i) => q(`SubmachineGun_${i}`, "smg")),
  ...range(5).map((i) => q(`AssaultRifle_${i}`, "rifle")),
  ...range(4).map((i) => q(`AssaultRifle2_${i}`, "rifle")),
  ...range(3).map((i) => q(`Bullpup_${i}`, "bullpup")),
  ...range(4).map((i) => q(`Shotgun_${i}`, "shotgun")),
  q("Shotgun_SawedOff", "shotgun"), q("Shotgun_ShortStock", "shotgun"),
  ...range(6).map((i) => q(`SniperRifle_${i}`, "sniper")),
  ...["Silencer_1", "Silencer_2", "Silencer_3", "Silencer_Short", "Silencer_long"].map((f) => q(`Accessories/${f}`, "accessory", { id: `q-acc-${f.toLowerCase().replace(/_/g, "-")}`, role: "muzzle", scale: QSCALE })),
  ...["Scope_1", "Scope_2", "Scope_3"].map((f) => q(`Accessories/${f}`, "accessory", { id: `q-acc-${f.toLowerCase().replace(/_/g, "-")}`, role: "scope", scale: QSCALE })),

  // --- cosmo-art "low poly guns" (CC0): cuerpo + cargador (+ mira) ya separados ---
  ...range(6).map((i) => ({ kind: "fbx", pack: "cosmo", id: `c-pistol-${i}`, label: `Pistol ${i}`, fbx: `${C}/pistols/pistol_${i}.fbx`, type: "pistol", texture: CTEX })),
  ...range(10).map((i) => ({ kind: "fbx", pack: "cosmo", id: `c-smg-${i}`, label: `Subfusil ${i}`, fbx: `${C}/subfusil/subfusil_${i}.fbx`, texture: CTEX, type: "smg" })),
  { kind: "fbx", pack: "cosmo", id: "c-flamethrower", label: "Flamethrower", fbx: `${C}/subfusil/flamethrower.fbx`, texture: CTEX, type: "flamethrower" },
  ...range(7).map((i) => ({ kind: "fbx", pack: "cosmo", id: `c-rifle-${i}`, label: `Fusil ${i}`, fbx: `${C}/fusil/fusil_${i}.fbx`, texture: CTEX, type: "rifle" })),
  ...range(2).map((i) => ({ kind: "fbx", pack: "cosmo", id: `c-shotgun-${i}`, label: `Shotgun ${i}`, fbx: `${C}/shotguns/shotgun_${i}.fbx`, texture: CTEX, type: "shotgun" })),
  ...range(3, 0).map((i) => ({ kind: "fbx", pack: "cosmo", id: `c-sniper-${i}`, label: `Sniper ${i}`, fbx: `${C}/snipers/sniper_${i}.fbx`, texture: CTEX, type: "sniper" })),

  // --- Asimov Weapon Pack (Hans Woofington; licencia sin confirmar, uso privado) ---
  // Los cargadores vienen colocados aparte, desplazados en X: se devuelven al pozo del arma.
  ...[
    ["a-pistol", "Pistol", "Asimov_Pistol$", "Asimov_Pistol_MagFull", -88.4],
    ["a-compact", "Compact", "Asimov_Conceal_Carry_Body", "Asimov_Conceal_Carry_MagFull", -88.4],
    ["a-smg", "SMG", "Asimov_SMG_Body", "Asimov_SMG_MagFull", -22.5],
    ["a-rifle", "Assault Rifle", "Asimov_AssaultRifle_Body", "Asimov_AssaultRifle_MagFull", -99.5],
    ["a-sniper", "Sniper Rifle", "Asimov_Sniper_Rifle_Body", "Asimov_Sniper_Rifle_MagFull", -157.6],
    ["a-shotgun", "Shotgun", "Asimov_Shotgun_Body", null, 0],
    ["a-launcher", "Rocket Launcher", "Asimov_Rocket_Launcher_Body", null, 0],
  ].map(([id, label, body, mag, dx]) => ({
    kind: "fbx", pack: "asimov", id, label, fbx: A, palette: "asimov",
    type: { "a-pistol": "pistol", "a-compact": "pistol", "a-smg": "smg", "a-rifle": "rifle", "a-sniper": "sniper", "a-shotgun": "shotgun", "a-launcher": "launcher" }[id],
    pick: [{ match: body, role: "body" }, ...(mag ? [{ match: mag, role: "magazine", raw: [dx, 0, 0] }] : [])],
  })),

  // --- Modelos sueltos (origen sin confirmar, uso privado) ---
  { kind: "fbx", pack: "misc", id: "m-m1911", label: "M1911", fbx: "raw/misc/M1911.fbx", type: "pistol", palette: "misc" },
  { kind: "fbx", pack: "misc", id: "m-deagle", label: "Desert Eagle", fbx: "raw/misc/DesertEagle.fbx", type: "pistol", palette: "misc" },
  // Segunda tanda (origen sin confirmar, uso privado)
  { kind: "fbx", pack: "misc", id: "m-m1911t", label: "M1911 Tactical", fbx: "raw/misc2/M1911Tactical.fbx", type: "pistol", palette: "misc" },
  { kind: "fbx", pack: "misc", id: "m-m4a1", label: "M4A1", fbx: "raw/misc2/M4A1.fbx", type: "rifle", palette: "misc" },
  { kind: "fbx", pack: "misc", id: "m-mp5", label: "MP5", fbx: "raw/misc2/MP5.fbx", type: "smg", palette: "misc" },
  { kind: "fbx", pack: "misc", id: "m-mp7", label: "MP7", fbx: "raw/misc2/MP7.fbx", type: "smg", palette: "misc" },
  // El archivo trae dos revólveres separados: cañón corto y cañón largo
  { kind: "fbx", pack: "misc", id: "m-revolver", label: "Revolver", fbx: "raw/demo-gun/demo.fbx", type: "revolver", texture: "/raw/demo-gun/Baked_Texture.png", pick: [{ match: "^Cylinder001$", role: "body" }] },
  { kind: "fbx", pack: "misc", id: "m-revolver-l", label: "Long Revolver", fbx: "raw/demo-gun/demo.fbx", type: "revolver", texture: "/raw/demo-gun/Baked_Texture.png", pick: [{ match: "^Cylinder006$", role: "body" }] },
];

// --- WeaponsOBJ (Cinema 4D, origen sin confirmar, uso privado): 30 armas modernas con cargador separado ---
const W = "raw/weapons-obj/WeaponsOBJ.obj";
// Todo el pack comparte orientación: X lateral, Z longitud, Y arriba.
const WHINT = { side: 0, length: 2, upSign: 1, fwdSign: 1 };
// Armas largas que se despiezan en culata / cajón / empuñadura / guardamanos (las bullpup y las de forma rara, no).
// Revisión del piloto (hoja de contacto, 100 armas): Sten, Garand y VSS no trocean limpio (piezas sueltas o huecos),
// así que se quedan como armas enteras. Las que no se pudieron cortar (PPSh, MP5K, SPAS-12) también.
const MODULAR = new Set(["m249", "m60", "xm8", "scarh", "m16a4", "g36", "ak47", "aa12", "uzi", "vector", "l115", "barrett"]);
const w = (id, label, type, body, mag) => ({ kind: "objmulti", pack: "modern", id: `w-${id}`, label, obj: W, type, hint: WHINT, modular: MODULAR.has(id), objects: [{ match: body, role: "body" }, ...(mag ? [{ match: mag, role: "magazine" }] : [])] });
ALL.push(
  w("vss", "VSS", "sniper", "^VSS_Sniper$", "^VSS_Sniper_Magazine$"),
  w("l115", "L115", "sniper", "^L115_Awp$", "^L115_Awp_Magazine$"),
  w("barrett", "Barrett", "sniper", "^Barett$", "^Barett_Magazine$"),
  w("m249", "M249", "lmg", "^M249(_Top)?$", "^M249_Magazine$"),
  w("m60", "M60", "lmg", "^M60(_Top)?$", "^M60_Magazine$"),
  w("sten", "Sten", "smg", "^Sten$", "^StenMagazine$"),
  w("ppsh", "PPSh", "smg", "^PPHS$", "^PPHS_Magazine$"),
  w("m1911", "M1911", "pistol", "^M1911$", "^Pistol_Magazine$"),
  w("garand", "M1 Garand", "rifle", "^M1Garand$", null),
  w("luger", "Luger P08", "pistol", "^LugerP08$", "^LugerP08_Magazine$"),
  w("xm8", "XM8", "rifle", "^XM8$", "^XM8_Magazine$"),
  w("scarh", "SCAR-H", "rifle", "^ScarH$", "^ScarH_Magazine$"),
  w("m16a4", "M16A4", "rifle", "^M16A4$", "^M16A4_Magazine$"),
  w("g36", "G36", "rifle", "^G36$", "^G36_Magazine$"),
  w("ak47", "AK-47", "rifle", "^AK47$", "^AK47_Magazine_Out$"),
  w("aa12", "AA-12", "shotgun", "^AA12$", "^AA12_Magazine_Out$"),
  w("uzi", "Uzi", "smg", "^Uzi$", "^Uzi_Magazine$"),
  w("p90", "P90", "smg", "^P90$", "^P90_Magazine$"),
  w("mp5k", "MP5K", "smg", "^Mp5K$", "^Mp5K_Magazine$"),
  w("vector", "Vector", "smg", "^Kriss_Vector$", "^Kriss_Vector_Magazine$"),
  w("f2000", "F2000", "bullpup", "^FN2000$", "^FN2000_Magazine$"),
  w("famas", "FAMAS", "bullpup", "^Famas$", "^Famas_Magazine$"),
  w("spas12", "SPAS-12", "shotgun", "^Spas-12$", null),
  { ...w("sawedoff", "Sawed-off", "shotgun", "^SawedOff_(Hold|Barrel)$", null), hint: { ...WHINT, lengthMul: 0.62 } },
  w("glock17", "Glock 17", "pistol", "^Glock17$", "^Pistol_Magazine_1$"),
  w("revolver", "Revolver", "revolver", "^Revolver(_Magazine)?$", null),
  w("deagle", "Desert Eagle", "pistol", "^Deagle$", "^Pistol_Magazine_2$"),
  w("usp45", "USP .45 SD", "pistol", "^Usp45-Silenced$", "^Pistol_Magazine_3$"),
);

// --- Wp-Pack-2 (estilo antiguo: madera y acero) y Zsky Weapons Pack (moderno low poly) ---
// Mallas enteras con varios materiales. Revisión del piloto: en Zsky los cortes caen en mal sitio (culatas sueltas,
// bullpups), así que se usan como armas enteras; del Wp-Pack-2 se despiezan solo los fusiles y carabinas de madera,
// que mezclan bien entre sí. Las armas largas se despiezan conservando madera y metal, y solo
// intercambian piezas dentro de su propia familia. Las variantes larga/media/corta conservan su largo relativo.
const LEN = { Long: 1.1, Medium: 1, Short: 0.86, Complete: 1.05, Mini: 0.85, SawOff: 0.72 };
const W2 = (dir, file, type, extra = {}) => {
  const variant = (file.match(/-(Long|Medium|Short|Complete|Mini|SawOff)$/) || [])[1];
  return { kind: "fbx", pack: "wp2", id: "v-" + file.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: file.replace(/-/g, " "), fbx: `raw/wp2/${dir}/${file}.fbx`, type,
    hint: { lengthMul: LEN[variant] ?? 1 }, ...extra };
};
ALL.push(
  ...["A", "B"].flatMap((v) => ["Long", "Medium", "Short"].map((l) => W2("Rifles", `BoltAction-Rifles-${v}-${l}`, l === "Short" ? "rifle" : "sniper", { modular: true }))),
  ...["Long", "Medium", "Short"].map((l) => W2("Rifles", `Lever-Rifles-${l}`, "rifle", { modular: true })),
  ...["Long", "Medium", "Short"].map((l) => W2("Rifles", `Revolver-Rifles-${l}`, "rifle", { modular: true })),
  ...["Carabine-Shotgun-Long", "Carabine-Shotgun-Short", "Hunter-Shotgun-Complete", "Hunter-Shotgun-Mini", "Lever-Shotgun", "Pump-Shotgun-Long", "Pump-Shotgun-Short", "SemiAutomati-Schotgun"].map((f) => W2("Shotgun", f, "shotgun", { modular: true })),
  W2("Shotgun", "Hunter-Shotgun-SawOff", "shotgun"),
  // Subfusiles enteros: empuñaduras verticales y culatas de alambre no se cortan limpio
  ...["M3GG", "M3GG-Drum", "PPSH", "PPSH-Drum"].map((f) => W2("SMG", f, "smg", { hint: { flipX: true } })),
  ...["Long", "Medium", "Short"].map((l) => W2("Pistols", `MSR-C96-${l}`, "pistol")),
  ...["A-Long", "A-Medium", "A-Short", "B-Long", "B-Medium", "B-Short"].map((v) => W2("Pistols", `Revolver-${v}`, "revolver")),
);
// Descartados por no encajar: Lanchester (orientación invertida) y el revólver retorcido (modelo de broma).
const ZS = (file, type, hint) => ({ hint, kind: "fbx", pack: "zsky", id: "z-" + file.toLowerCase().replace(/_/g, "-"), label: file.replace(/_/g, " "), fbx: `raw/zsky/${file}.fbx`, type });
ALL.push(
  ...[1, 2].map((i) => ZS(`AssaultRifle_0${i}`, "rifle")), ZS("AssaultRifle_03", "bullpup"),
  ...[1, 2, 3, 4, 5].map((i) => ZS(`SubmachineGun_0${i}`, "smg")),
  ...[1, 2, 3].map((i) => ZS(`Shotgun_0${i}`, "shotgun", i === 3 ? { lengthMul: 0.65 } : undefined)),
  ...[1, 2].map((i) => ZS(`SniperRifle_0${i}`, "sniper")),
  ...[1, 2, 3].map((i) => ZS(`Pistol_0${i}`, "pistol")),
  ...[1, 2].map((i) => ZS(`Revolver_0${i}`, "revolver")),
);

// Cuarentena: piezas que no se usan sueltas, con el motivo (revisión del piloto de despiece).
const QUARANTINE = {
  "w-garand": "Al trocear desaparece el cajón: se usa como arma entera.",
  "w-sten": "La culata queda suelta al trocear: se usa como arma entera.",
  "w-vss": "Queda un bloque suelto detrás del cajón: se usa como arma entera.",
};
for (const j of ALL) if (QUARANTINE[j.id]) j.quarantine = QUARANTINE[j.id];

// Fuera del botín (revisión visual): estilo que no casa o modelos toscos. Se conservan convertidos por si acaso.
const EXCLUDED = {
  cosmo: "Estilo ciencia ficción con camuflaje verde: parece de juguete al lado del resto.",
  "q-submachinegun-1": "Bloque tosco.", "q-submachinegun-4": "Bloque tosco.", "q-bullpup-1": "Bloque tosco.", "q-bullpup-2": "Bloque tosco.", "q-bullpup-3": "Bloque tosco.",
  "q-assaultrifle-1": "Proporciones raras (culata enana).", "m-revolver": "Textura fotográfica oxidada: no casa con el estilo.", "m-revolver-l": "Textura fotográfica oxidada: no casa con el estilo.", "q-pistol-6": "Forma rara.", "q-shotgun-sawedoff": "Escala de escopeta larga.", "q-shotgun-shortstock": "Escala de escopeta larga.",
};
for (const j of ALL) { const why = EXCLUDED[j.id] ?? EXCLUDED[j.pack]; if (why) j.excluded = why; }

// --- Modular Firearms Pack (sschocolate): piezas sueltas con sockets propios, se montan por sockets ---
// Cada pieza encaja en el socket del mismo nombre de otra pieza del mismo calibre (o de calibre "any").
const K = "raw/modular-firearms";
const KIT_FILES = ["Platform_5.56mm_01", "Platform_9mm_01", "Platform_9mm_02", "Platform_12ga_01",
  "Barrel_5.56mm_16in_01", "Barrel_5.56mm_16in_02", "Barrel_9mm_4.5in_01", "Barrel_9mm_4.5in_02", "Barrel_12ga_18in_01", "Barrel_12ga_18in_02",
  "Handguard_5.56mm_16in_01", "Handguard_5.56mm_16in_02", "Stock_Rod_01", "Stock_Rod_02", "Stock_Rod_03", "Handle_01", "Handle_02",
  "Trigger_01", "Trigger_02", "ChargingHandle_5.56mm_01", "ChargingHandle_5.56mm_02", "Slide_9mm_01", "Slide_9mm_02",
  "PumpHandle_12ga_01", "PumpHandle_12ga_02", "PumpHandle_12ga_03",
  "Magazine_5.56mm_01", "Magazine_5.56mm_02", "Magazine_5.56mm_03", "Magazine_9mm_01", "Magazine_9mm_02", "Magazine_12ga_6Shell", "Magazine_12ga_8Shell",
  "MuzzleDevice_5.56mm_01", "MuzzleDevice_5.56mm_02", "MuzzleDevice_5.56mm_03", "MuzzleDevice_9mm_01", "MuzzleDevice_9mm_02", "MuzzleDevice_9mm_03",
  "MuzzleDevice_12ga_01", "MuzzleDevice_12ga_02", "MuzzleDevice_12ga_03",
  "Optic_Rear_Rail_01", "Optic_Rear_Rail_02", "IronSight_Rear_Rail_01", "IronSight_Rear_Welded_01", "IronSight_Front_5.56mmBarrel_01", "IronSight_Front_Welded_01",
  "Device_Foregrip_01", "Device_Foregrip_02", "Device_Flashlight_01", "Device_Laser_01", "Device_LaserLight_01"];
const KIT_SLOT = [[/^Platform/, "Platform"], [/^Barrel/, "Barrel"], [/^Handguard/, "Handguard"], [/^Stock/, "Stock"], [/^Handle/, "Handle"], [/^Trigger/, "Trigger"],
  [/^ChargingHandle/, "ChargingHandle"], [/^Slide/, "Slide"], [/^PumpHandle/, "PumpHandle"], [/^Magazine/, "Magazine"], [/^MuzzleDevice/, "Muzzle"],
  [/^(Optic|IronSight)_Rear_Rail/, "Sights_Rear"], [/^IronSight_Rear_Welded/, "Sights_Rear_Welded"], [/^IronSight_Front_5/, "Sights_Front"], [/^IronSight_Front_Welded/, "Sights_Front_Welded"], [/^Device/, "Device"]];
const kitJobs = KIT_FILES.map((f) => ({
  kind: "kitpart", pack: "kit", id: "k-" + f.toLowerCase().replace(/\.|_\d+in|mm/g, "").replace(/[^a-z0-9]+/g, "-"),
  fbx: `${K}/MW1_${f}.fbx`, texture: `/${K}/Master_Texture.png`,
  slot: KIT_SLOT.find(([re]) => re.test(f))[1], caliber: /5\.56/.test(f) ? "556" : /9mm/.test(f) ? "9mm" : /12ga/.test(f) ? "12ga" : "any",
}));

// --- Polygonal Modern Weapons Collection 1 (OpenGameArt, CC-BY-SA 3.0 / GPL 3.0): armas enteras de una malla con atlas.
// Las largas se despiezan con el cortador (solo mezclan dentro de su familia); el color de origen se descarta (acabado único).
const PM = (file, type, extra = {}) => ({ kind: "fbx", pack: "pmw", id: "p-" + file.replace(/_/g, "-"), label: file.replace(/_/g, " "), fbx: `raw/pmw/${file}.fbx`, type, texture: "/raw/pmw/atlass_1_diffuse.png", ...extra });
ALL.push(
  ...[1, 2, 3].map((i) => PM(`rifle_${i}`, "sniper", { modular: true })),
  ...[1, 2, 3, 4, 5, 6, 7].map((i) => PM(`machine_gun_${i}`, "rifle", { modular: true })),
  ...[1, 2, 3, 4, 5].map((i) => PM(`submachine_gun_${i}`, "smg", { modular: true })),
  ...[1, 2, 3].map((i) => PM(`shotgun_${i}`, "shotgun", { modular: true })),
  ...[1, 2, 3].map((i) => PM(`pistol_${i}`, "pistol")),
);

// --- Flat Gun Attachments (CC0, OpenGameArt): accesorios reales con origen en su punto de montaje y frente hacia -Z ---
// Miras en el socket superior, empuñaduras y linternas bajo el guardamanos, supresores en la boca y láseres en el lateral.
const FA = "raw/flat-attachments";
const ATT = { RedDot: "Sights_Rear", Reflex: "Sights_Rear", Holographic: "Sights_Rear", Magnified: "Sights_Rear", Scope: "Sights_Rear",
  Foregrip: "Device", Flashlight: "Device", Laser: "Laser", Suppressor: "Muzzle" };
const attJobs = Object.entries(ATT).flatMap(([name, slot]) => ["East", "West"].map((v) => ({
  kind: "kitpart", pack: "kit", id: `k-att-${name.toLowerCase()}-${v.toLowerCase()}`, fbx: `${FA}/${name}_${v}.fbx`, negZ: true, slot, caliber: "any",
})));

// --- Kit de 39 armas del usuario (raw/kit39): piezas en anclas con nombre, escala real, normales con aristas vivas ---
{
  // Packs con las mismas convenciones (raw/pack3 y raw/pack4) entran en el mismo pack del juego: comparten piezas.
  // (Su catálogo puede no traer las piezas: se leen del manifest de cada arma.)
  const KIT = "raw/kit39", read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
  const cat = [["raw/kit39", "x-"], ["raw/pack3", "x-p3-"], ["raw/pack4", "x-p4-"]].flatMap(([dir, pre]) =>
    read(`${dir}/catalogo.json`).map((w) => ({ ...w, dir, pre, piezas: w.piezas ?? read(`${dir}/${w.nombre}/manifest.json`).piezas })));
  const typeOf = (w) => (w.chasis === "bullpup" && w.tipo_juego === "rifle" ? "bullpup" : w.tipo_juego);
  // Largo real relativo dentro del tipo (mediana = 1), acotado: variedad sin salirse de la escala del juego
  const med = {}; for (const t of new Set(cat.map(typeOf))) { const ls = cat.filter((w) => typeOf(w) === t).map((w) => w.largo_m).sort((a, b) => a - b); med[t] = ls[Math.floor(ls.length / 2)]; }
  for (const w of cat) {
    const type = typeOf(w), modular = w.chasis === "convencional" && !!w.piezas.culata && !!w.piezas.empunadura && ["rifle", "smg", "sniper", "shotgun"].includes(type);
    ALL.push({ kind: "kit39", pack: "kit39", id: w.pre + w.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: w.nombre, type, modular, action: w.accion,
      glb: `${w.dir}/${w.nombre}/${w.nombre}_ensamblada.glb`, sections: Object.fromEntries(Object.entries(w.piezas).map(([k, v]) => [k, v.seccion_union_m ?? {}])),
      lengthMul: Math.min(1.15, Math.max(0.87, w.largo_m / med[type])) });
  }
  // Piezas sueltas de la biblioteca (culatas, guardamanos, empuñaduras): "donantes" del pack kit39. No salen como arma;
  // solo prestan su pieza a las armas modulares del kit (mixLong), con la escala de un fusil medio del kit.
  const lib = JSON.parse(readFileSync(new URL(`../${KIT}/piezas_sueltas/piezas.json`, import.meta.url), "utf8"));
  const ROLE = { culatas: "stock", guardamanos: "front", empunaduras: "grip" };
  for (const p of lib.filter((x) => ROLE[x.categoria])) {
    ALL.push({ kind: "kit39part", pack: "kit39", id: "x-lib-" + p.id.replace(/[^a-z0-9]+/g, "-"), label: p.id, type: "rifle", role: ROLE[p.categoria],
      glb: `${KIT}/piezas_sueltas/${p.archivo}`, section: p.seccion_union_m ?? {}, realScale: 0.9 / med.rifle, wood: /madera/.test(p.id) });
  }
}

// --- Miras y bocachas de la biblioteca del kit (raw/kit39/piezas_sueltas) y del pool del pack 4 (raw/pack4/accesorios) ---
const libSightJobs = [];
{
  const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
  const libs = [["raw/kit39/piezas_sueltas", "piezas.json", ""], ["raw/pack4", "accesorios/accesorios.json", "p4"]];
  const kindOf = (t) => (/^punto_rojo/.test(t) ? "reddot" : t === "holografica" ? "holographic" : /^visor|^telescopica/.test(t) ? "scope" : "magnified");
  const muzzleOf = { supresor: "suppressor", freno: "brake", compensador: "compensator", apagallamas: "flashhider" };
  const slug = (id) => id.replace(/[^a-z0-9]+/g, "");
  for (const [dir, file, pre] of libs) for (const p of read(`${dir}/${file}`)) {
    if (p.categoria === "miras")
      libSightJobs.push({ kind: "libsight", id: `k-att-${kindOf(p.tipo_mira)}-l${pre}${slug(p.id)}`, label: p.id, glb: `${dir}/${p.archivo}`,
        lens: p.centro_lente_local, zoom: p.aumento, seeThrough: p.ve_a_traves !== false, height: p.bbox_max[1] - p.bbox_min[1] });
    else if (p.categoria === "agarres") // (agarre bajo el guardamanos: origen en la cara superior, colgando hacia −Y)
      libSightJobs.push({ kind: "libsight", slot: "Device", id: `k-device-foregrip-l${pre}${slug(p.id)}`, label: p.id, glb: `${dir}/${p.archivo}` });
    else if (p.categoria === "bocachas" && muzzleOf[p.tipo_bocacha])
      libSightJobs.push({ kind: "libsight", slot: "Muzzle", id: `k-att-${muzzleOf[p.tipo_bocacha]}-l${pre}${slug(p.id)}`, label: p.id, glb: `${dir}/${p.archivo}` });
  }
}

// --- Armas pulidas por el usuario (piezas separadas a mano, textura pixelada de 16 colores) ---
const AP = "raw/armas-pulidas";
ALL.push(
  { kind: "glbparts", pack: "modern", id: "u-fusil-a", label: "Fusil A", type: "rifle", glb: `${AP}/fusil_A/fusil_A_piezas_ensambladas.glb`, modular: true },
  { kind: "glbparts", pack: "pulidas", id: "u-bullpup-b", label: "Bullpup B", type: "bullpup", glb: `${AP}/bullpup_B/bullpup_B_piezas_ensambladas.glb`, modular: false },
);

export const JOBS = ALL.map((j) => (BODY_ONLY[j.id] ? { ...j, pick: [{ match: BODY_ONLY[j.id], role: "body" }] } : j)).concat(kitJobs, attJobs, libSightJobs);
