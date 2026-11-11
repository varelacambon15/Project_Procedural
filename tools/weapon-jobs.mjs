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
];

// --- WeaponsOBJ (Cinema 4D, origen sin confirmar, uso privado): 30 armas modernas con cargador separado ---
const W = "raw/weapons-obj/WeaponsOBJ.obj";
// Todo el pack comparte orientación: X lateral, Z longitud, Y arriba.
const WHINT = { side: 0, length: 2, upSign: 1, fwdSign: 1 };
const w = (id, label, type, body, mag) => ({ kind: "objmulti", pack: "modern", id: `w-${id}`, label, obj: W, type, hint: WHINT, objects: [{ match: body, role: "body" }, ...(mag ? [{ match: mag, role: "magazine" }] : [])] });
ALL.push(
  w("vss", "VSS", "sniper", "^VSS_Sniper$", "^VSS_Sniper_Magazine$"),
  w("l115", "L115", "sniper", "^L115_Awp$", "^L115_Awp_Magazine$"),
  w("barrett", "Barrett", "sniper", "^Barett$", "^Barett_Magazine$"),
  w("m249", "M249", "lmg", "^M249(_Top)?$", "^M249_Magazine$"),
  w("m60", "M60", "lmg", "^M60(_Top)?$", "^M60_Magazine$"),
  w("minigun", "Minigun", "lmg", "^Minigun(_Front)?$", null),
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
  w("sawedoff", "Sawed-off", "shotgun", "^SawedOff_(Hold|Barrel)$", null),
  w("glock17", "Glock 17", "pistol", "^Glock17$", "^Pistol_Magazine_1$"),
  w("revolver", "Revolver", "revolver", "^Revolver(_Magazine)?$", null),
  w("deagle", "Desert Eagle", "pistol", "^Deagle$", "^Pistol_Magazine_2$"),
  w("usp45", "USP .45 SD", "pistol", "^Usp45-Silenced$", "^Pistol_Magazine_3$"),
);

export const JOBS = ALL.map((j) => (BODY_ONLY[j.id] ? { ...j, pick: [{ match: BODY_ONLY[j.id], role: "body" }] } : j));
