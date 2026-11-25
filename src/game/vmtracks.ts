// Pistas de poses clave por clase y acción (tarea 13). Datos, no código: cada pista es una lista corta de poses con su
// curva de llegada (ver vmpose.ts). Fuentes: .delegaciones/POSES_PISTOLA_REVOLVER.md (vídeos del usuario: CoD Ghosts
// M9A1 y .44, MW2019 .50 GS, Destiny…) y, para las largas, el patrón común de los shooters tácticos modernos
// (inclinar el arma hacia la mano de apoyo → sacar el cargador → pausa → meter con golpe seco → montar si estaba
// vacía → asentado con micro-rebote). La mano derecha NUNCA suelta la empuñadura; la izquierda hace la recarga.
//
// Convenios (los de vmpose.ts): `gun` = [x, y, z, cabeceo, guiñada, alabeo] en la cámara, con pivote en la
// empuñadura; cabeceo + = boca arriba; guiñada + = boca a la izquierda; alabeo + = el lomo cae a la izquierda.
// `left.off` en la cámara (m); `left.offW` en el arma (m; +X = hacia la boca, +Y = arriba).
import type { Gun6, Key, LeftKey, MagKey, Track } from "./vmpose";

export type VmAction = "reload" | "reloadEmpty" | "inspect" | "draw";
const Z: Gun6 = [0, 0, 0, 0, 0, 0];
/** Cartuchera / bolsillo: abajo a la izquierda, fuera de cuadro (la mano sale y entra por el borde inferior). */
const POUCH: LeftKey = { at: "cam", off: [-0.2, -0.46, -0.32], hand: "grab" };

// ---------------------------------------------------------------- Pistola
// Recarga táctica (1,2–1,6 s): sube y rola para enseñar el brocal, cae el cargador, la izquierda entra en diagonal con
// el nuevo, lo mete (golpe seco con la palma) y el arma vuelve a cadera con un pequeño rebote.
const pistolGun: Key<Gun6>[] = [
  { t: 0, v: Z },
  { t: 0.1, v: [0.004, -0.008, 0, -0.05, 0, 0.03], e: "o" },              // anticipación: cae un poco
  { t: 0.26, v: [-0.05, 0.025, 0.015, 0.32, -0.12, -0.55], e: "o" },      // sube hacia el centro, lomo a la derecha:
  { t: 0.6, v: [-0.054, 0.028, 0.015, 0.34, -0.13, -0.58], e: "io" },     //   el brocal mira a la mano izquierda (pausa)
  { t: 0.68, v: [-0.05, 0.04, 0.012, 0.42, -0.12, -0.55], e: "s" },       // palmada: sacudida arriba
  { t: 0.76, v: [-0.045, 0.026, 0.015, 0.3, -0.1, -0.48], e: "o" },
  { t: 0.94, v: [0.002, -0.006, 0, -0.03, 0, -0.02], e: "io" },           // baja a cadera (~0,4 s) y se pasa un poco
  { t: 1, v: Z, e: "o" },
];
const pistolLeftTac: Key<LeftKey>[] = [
  { t: 0, v: { at: "rest" } },
  { t: 0.16, v: { at: "rest" } },
  { t: 0.3, v: POUCH, e: "i" },                                               // sale a por el cargador nuevo
  { t: 0.44, v: POUCH },
  // (los dedos hacia arriba y a la derecha: el antebrazo baja hacia la esquina inferior izquierda; si apuntaban hacia
  //  delante, el antebrazo venía hacia la cámara y se veía la boca de la manga como un disco)
  { t: 0.58, v: { at: "magwell", off: [-0.03, -0.1, 0.0], dir: [0.45, 0.85, -0.25], up: [-0.85, 0.15, 0.5], hand: "pinch" }, e: "o" },
  { t: 0.66, v: { at: "magwell", off: [-0.005, -0.035, 0], dir: [0.45, 0.85, -0.25], up: [-0.85, 0.15, 0.5], hand: "pinch" }, e: "io" },
  { t: 0.7, v: { at: "magwell", off: [0, -0.014, 0], dir: [0.35, 0.9, -0.25], up: [-0.85, 0.15, 0.5], hand: "palm" }, e: "s" }, // palmada
  { t: 0.78, v: { at: "magwell", off: [-0.02, -0.06, 0.02], hand: "open" }, e: "o" },
  { t: 1, v: { at: "rest" }, e: "io" },
];
const pistolMagTac: Key<MagKey>[] = [
  { t: 0, v: { mode: "seat" } },
  { t: 0.22, v: { mode: "well", out: 0 } },
  { t: 0.3, v: { mode: "well", out: 0.06 }, e: "i" },                    // se suelta y cae
  { t: 0.31, v: { mode: "hide" } },
  { t: 0.5, v: { mode: "hand" } },                                         // el nuevo viene en la mano
  { t: 0.66, v: { mode: "well", out: 0.035 } },
  { t: 0.7, v: { mode: "well", out: 0 }, e: "s" },
  { t: 0.71, v: { mode: "seat" } },
  { t: 1, v: { mode: "seat" } },
];
// En vacío: el cargador viejo se suelta (cae) en vez de guardarse, y al encajar el nuevo la palmada suelta la corredera
// bloqueada (palanca de retenida, como en MW2019): cierre seco y sacudida mayor. La izquierda no pasa por encima del
// arma (con la cámara tan cerca, su antebrazo tapaba media pantalla).
const pistolGunEmpty: Key<Gun6>[] = pistolGun.map((k) => (k.t === 0.68 ? { ...k, v: [-0.05, 0.05, 0.01, 0.5, -0.12, -0.55] as Gun6 } : k));
const pistolLeftEmpty = pistolLeftTac;
const pistolMagEmpty: Key<MagKey>[] = pistolMagTac;
const pistolSlideEmpty: Key<number>[] = [{ t: 0, v: 1 }, { t: 0.69, v: 1 }, { t: 0.71, v: 0, e: "s" }, { t: 1, v: 0 }];

// Inspección (≈2,6 s): gira de lado y sube con la boca arriba (enseña el costado derecho), pausa, vuelve sobre sí
// misma para enseñar el izquierdo y regresa con un rebote. Sin acercarla a la cámara.
const pistolInspect: Key<Gun6>[] = [
  { t: 0, v: Z },
  { t: 0.06, v: [0.004, -0.006, 0, -0.04, 0, -0.04], e: "o" },
  { t: 0.2, v: [0.005, 0.035, -0.01, 0.34, -0.12, 0.95], e: "io" },     // (se queda a la derecha: no cruza al centro)
  { t: 0.42, v: [0.004, 0.038, -0.01, 0.38, -0.1, 1.02], e: "io" },
  { t: 0.58, v: [-0.01, 0.03, -0.01, 0.2, -0.45, -0.35], e: "io" },
  { t: 0.8, v: [-0.012, 0.032, -0.01, 0.22, -0.5, -0.4], e: "io" },
  { t: 0.93, v: [0.002, -0.006, 0, -0.03, 0, 0.03], e: "io" },
  { t: 1, v: Z, e: "o" },
];
const leftAway: Key<LeftKey>[] = [{ t: 0, v: { at: "rest" } }, { t: 0.12, v: POUCH, e: "io" }, { t: 0.86, v: POUCH }, { t: 1, v: { at: "rest" }, e: "io" }];
// Sacar (0,3–0,6 s): sube desde abajo a la derecha, rolada y con la boca baja; llega con un rebote corto.
const pistolDraw: Key<Gun6>[] = [
  { t: 0, v: [0.05, -0.24, 0.04, -0.5, -0.04, -0.4] },
  { t: 0.62, v: [-0.002, 0.008, 0, 0.07, 0.01, 0.05], e: "o" },
  { t: 0.82, v: [0, -0.003, 0, -0.02, 0, -0.01], e: "io" },
  { t: 1, v: Z, e: "io" },
];
const leftDraw: Key<LeftKey>[] = [{ t: 0, v: POUCH }, { t: 0.35, v: POUCH }, { t: 1, v: { at: "rest" }, e: "o" }];

// ---------------------------------------------------------------- Revólver
// Recarga (2,5–3,5 s): la izquierda entra; el arma rola a la izquierda y sube; se abre el tambor; boca arriba y
// sacudida para vaciar; se tumba casi horizontal con el tambor abierto; la izquierda trae el cargador rápido, lo mete,
// lo suelta; cierra el tambor con la palma (golpe seco) y vuelve a cadera.
const revolverGun: Key<Gun6>[] = [
  { t: 0, v: Z },
  { t: 0.07, v: [0.004, -0.008, 0, -0.05, 0, -0.04], e: "o" },
  { t: 0.18, v: [-0.012, 0.02, -0.02, 0.3, 0.12, 0.7], e: "io" },        // rola a la izquierda: tambor a la vista
  { t: 0.3, v: [-0.015, 0.04, -0.03, 0.72, 0.05, 0.5], e: "io" },         // boca arriba (sin irse al centro ni acercarse)
  { t: 0.33, v: [-0.015, 0.05, -0.03, 0.8, 0.05, 0.5], e: "s" },          // sacudida: caen las vainas
  { t: 0.42, v: [-0.03, 0.012, -0.02, 0.0, 0.22, 1.2], e: "io" },         // se tumba (boca a la izquierda)
  { t: 0.7, v: [-0.032, 0.014, -0.02, 0.02, 0.24, 1.24], e: "io" },       // (pausa: carga)
  { t: 0.8, v: [-0.015, 0.02, -0.02, 0.22, 0.14, 0.65], e: "io" },        // se endereza
  { t: 0.84, v: [-0.013, 0.028, -0.02, 0.27, 0.12, 0.56], e: "s" },       // cierre seco
  { t: 0.95, v: [0.002, -0.006, 0, -0.03, 0, 0.03], e: "io" },
  { t: 1, v: Z, e: "o" },
];
const revolverLeft: Key<LeftKey>[] = [
  { t: 0, v: { at: "rest" } },
  { t: 0.14, v: { at: "cyl", off: [-0.04, -0.05, 0.03], hand: "open" }, e: "io" },
  { t: 0.22, v: { at: "cyl", off: [-0.012, -0.02, 0.01], dir: [0.6, 0.6, -0.5], up: [-0.6, 0.0, 0.8], hand: "grab" }, e: "io" }, // abre el tambor
  { t: 0.3, v: { at: "cyl", off: [-0.01, -0.02, 0.01], dir: [0.6, 0.6, -0.5], up: [-0.6, 0.0, 0.8], hand: "grab" } },
  { t: 0.4, v: POUCH, e: "i" },
  { t: 0.5, v: POUCH },
  { t: 0.62, v: { at: "cyl", offW: [-0.035, 0, 0], off: [0, -0.01, 0.02], dir: [0.8, 0.2, -0.5], up: [-0.3, 0.9, 0.3], hand: "pinch" }, e: "o" },
  { t: 0.68, v: { at: "cyl", offW: [-0.01, 0, 0], off: [0, -0.01, 0.02], dir: [0.8, 0.2, -0.5], up: [-0.3, 0.9, 0.3], hand: "pinch" }, e: "io" },
  { t: 0.74, v: { at: "cyl", off: [-0.03, -0.04, 0.03], hand: "open" }, e: "o" },
  { t: 0.81, v: { at: "cyl", off: [-0.04, 0, 0.01], dir: [0.9, 0.2, -0.3], up: [0, 0.3, 1], hand: "palm" }, e: "io" },
  { t: 0.84, v: { at: "cyl", off: [-0.005, 0, 0.005], dir: [0.9, 0.2, -0.3], up: [0, 0.3, 1], hand: "palm" }, e: "s" },  // palmada al tambor
  { t: 1, v: { at: "rest" }, e: "io" },
];
const revolverCyl: Key<number>[] = [{ t: 0, v: 0 }, { t: 0.18, v: 0 }, { t: 0.24, v: 1, e: "s" }, { t: 0.82, v: 1 }, { t: 0.84, v: 0, e: "s" }, { t: 1, v: 0 }];

// ---------------------------------------------------------------- Largas con cargador (subfusil, fusil, bullpup,
// ametralladora, francotirador). Una plantilla; la clase solo ajusta amplitudes.
function longMag(k: { roll: number; lift: number; pitch: number }, empty: boolean): Track {
  const S = (t: number) => (empty ? t * 0.82 : t); // (en vacío, todo un poco antes para dejar sitio a montar)
  const gun: Key<Gun6>[] = [
    { t: 0, v: Z },
    { t: S(0.09), v: [0.004, -0.01, 0.004, -0.03, 0, 0.04], e: "o" },
    { t: S(0.22), v: [-0.02, k.lift, 0, k.pitch, 0.1, -k.roll], e: "io" },
    { t: S(0.62), v: [-0.022, k.lift + 0.004, 0, k.pitch + 0.02, 0.11, -k.roll - 0.03], e: "io" },
    { t: S(0.7), v: [-0.02, k.lift + 0.02, -0.004, k.pitch + 0.08, 0.1, -k.roll + 0.04], e: "s" },   // golpe al encajar
    { t: S(0.78), v: [-0.016, k.lift * 0.7, 0, k.pitch * 0.8, 0.08, -k.roll * 0.7], e: "o" },
  ];
  if (empty) gun.push(
    { t: 0.77, v: [-0.012, k.lift * 0.6, 0, k.pitch * 0.6, 0.1, -k.roll * 0.85], e: "io" },
    { t: 0.8, v: [-0.004, k.lift * 0.6 + 0.008, -0.004, k.pitch * 0.6 + 0.05, 0.08, -k.roll * 0.7], e: "s" },  // palmada: el cerrojo cierra
    { t: 0.86, v: [-0.01, k.lift * 0.5, 0, k.pitch * 0.5, 0.08, -k.roll * 0.7], e: "o" },
  );
  gun.push({ t: 0.94, v: [0.002, -0.006, 0, -0.025, 0, 0.02], e: "io" }, { t: 1, v: Z, e: "o" });
  const left: Key<LeftKey>[] = [
    { t: 0, v: { at: "rest" } },
    { t: S(0.1), v: { at: "rest" } },
    { t: S(0.24), v: { at: "mag", off: [-0.005, -0.02, 0.01], dir: [0.3, 0.8, -0.4], up: [-0.9, 0.1, 0.3], hand: "grab" }, e: "io" },
    { t: S(0.3), v: { at: "mag", off: [-0.005, -0.02, 0.01], dir: [0.3, 0.8, -0.4], up: [-0.9, 0.1, 0.3], hand: "grab" } },
    { t: S(0.42), v: POUCH, e: "io" },
    { t: S(0.48), v: POUCH },
    { t: S(0.6), v: { at: "magwell", off: [-0.01, -0.12, 0.02], dir: [0.3, 0.8, -0.4], up: [-0.9, 0.1, 0.3], hand: "grab" }, e: "o" },
    { t: S(0.68), v: { at: "magwell", off: [-0.005, -0.03, 0.01], dir: [0.3, 0.8, -0.4], up: [-0.9, 0.1, 0.3], hand: "grab" }, e: "io" },
    { t: S(0.71), v: { at: "magwell", off: [0, -0.01, 0], dir: [0.3, 0.8, -0.4], up: [-0.9, 0.1, 0.3], hand: "palm" }, e: "s" },
  ];
  // En vacío: palmada al retén del cerrojo (lateral izquierdo, sobre el brocal), como en los tácticos modernos. Ir a la
  // palanca de carga (arriba y atrás, junto a la cámara) dejaba el antebrazo como un poste en mitad de la pantalla.
  if (empty) left.push(
    { t: 0.76, v: { at: "magwell", offW: [0.015, 0.05, 0], off: [-0.045, 0.0, 0.0], dir: [0.6, 0.7, -0.4], up: [-0.9, 0.1, 0.3], hand: "palm" }, e: "io" },
    { t: 0.8, v: { at: "magwell", offW: [0.015, 0.05, 0], off: [-0.012, 0.0, 0.0], dir: [0.6, 0.7, -0.4], up: [-0.9, 0.1, 0.3], hand: "palm" }, e: "s" },
    { t: 0.86, v: { at: "magwell", off: [-0.05, -0.04, 0.0], hand: "open" }, e: "o" },
  );
  left.push({ t: 1, v: { at: "rest" }, e: "io" });
  const mag: Key<MagKey>[] = [
    { t: 0, v: { mode: "seat" } },
    { t: S(0.25), v: { mode: "well", out: 0 } },
    { t: S(0.31), v: { mode: "well", out: 0.08 }, e: "o" },
    // táctica: el viejo se lleva en la mano a la cartuchera; en vacío se suelta y cae
    ...(empty ? [{ t: S(0.32), v: { mode: "hide" as const } }] : [{ t: S(0.32), v: { mode: "hand" as const } }, { t: S(0.44), v: { mode: "hide" as const } }]),
    { t: S(0.5), v: { mode: "hand" } },
    { t: S(0.68), v: { mode: "well", out: 0.03 } },
    { t: S(0.71), v: { mode: "well", out: 0 }, e: "s" },
    { t: S(0.72), v: { mode: "seat" } },
    { t: 1, v: { mode: "seat" } },
  ];
  // (en vacío el cerrojo está atrás hasta la palmada: la palanca de carga acompaña con un golpe corto)
  const slide: Key<number>[] | undefined = empty ? [{ t: 0, v: 0.6 }, { t: 0.79, v: 0.6 }, { t: 0.81, v: 0, e: "s" }, { t: 1, v: 0 }] : undefined;
  return { dur: 2.2, gun, left, mag, slide };
}
function longInspect(k: { roll: number }): Track {
  return {
    dur: 2.6,
    gun: [
      { t: 0, v: Z },
      { t: 0.06, v: [0.004, -0.006, 0, -0.03, 0, 0.03], e: "o" },
      { t: 0.22, v: [-0.04, 0.04, -0.02, 0.12, 0.35, k.roll], e: "io" },        // enseña el costado izquierdo
      { t: 0.45, v: [-0.042, 0.044, -0.02, 0.14, 0.38, k.roll + 0.06], e: "io" },
      { t: 0.62, v: [-0.01, 0.02, -0.01, 0.05, -0.2, -k.roll * 0.7], e: "io" },  // y el derecho
      { t: 0.82, v: [-0.012, 0.022, -0.01, 0.06, -0.22, -k.roll * 0.75], e: "io" },
      { t: 0.94, v: [0.002, -0.006, 0, -0.025, 0, 0.02], e: "io" },
      { t: 1, v: Z, e: "o" },
    ],
    left: [{ t: 0, v: { at: "rest" } }, { t: 1, v: { at: "rest" } }],
  };
}
const longDraw: Track = {
  dur: 0.6,
  gun: [
    { t: 0, v: [0.06, -0.3, 0.06, -0.55, -0.1, -0.7] },
    { t: 0.6, v: [-0.002, 0.01, 0, 0.05, 0.01, 0.06], e: "o" },
    { t: 0.82, v: [0, -0.004, 0, -0.015, 0, -0.01], e: "io" },
    { t: 1, v: Z, e: "io" },
  ],
  left: [{ t: 0, v: POUCH }, { t: 0.3, v: POUCH }, { t: 0.85, v: { at: "rest" }, e: "o" }, { t: 1, v: { at: "rest" } }],
};

const LONG: Record<string, { roll: number; lift: number; pitch: number }> = {
  smg: { roll: 0.42, lift: 0.025, pitch: 0.14 },
  rifle: { roll: 0.38, lift: 0.025, pitch: 0.12 },
  bullpup: { roll: 0.3, lift: 0.015, pitch: 0.1 },
  lmg: { roll: 0.22, lift: 0.012, pitch: 0.08 },
  sniper: { roll: 0.3, lift: 0.018, pitch: 0.1 },
};

export const TRACKS: Record<string, Partial<Record<VmAction, Track>>> = {
  pistol: {
    reload: { dur: 1.4, gun: pistolGun, left: pistolLeftTac, mag: pistolMagTac },
    reloadEmpty: { dur: 1.7, gun: pistolGunEmpty, left: pistolLeftEmpty, mag: pistolMagEmpty, slide: pistolSlideEmpty },
    inspect: { dur: 2.6, gun: pistolInspect, left: leftAway },
    draw: { dur: 0.45, gun: pistolDraw, left: leftDraw },
  },
  revolver: {
    reload: { dur: 2.8, gun: revolverGun, left: revolverLeft, cyl: revolverCyl },
    inspect: { dur: 2.6, gun: pistolInspect, left: leftAway },
    draw: { dur: 0.5, gun: pistolDraw, left: leftDraw },
  },
  ...Object.fromEntries(Object.entries(LONG).map(([c, k]) => [c, { reload: longMag(k, false), reloadEmpty: longMag(k, true), inspect: longInspect(k), draw: longDraw }])),
};
TRACKS.revolver.reloadEmpty = TRACKS.revolver.reload;
for (const c of ["shotgun", "launcher", "flamethrower"]) TRACKS[c] = { inspect: longInspect({ roll: 0.32 }), draw: longDraw };

/** Pista de una clase y acción (o null: se usa la animación procedural de antes). */
export function trackFor(type: string, action: VmAction): Track | null {
  return TRACKS[type]?.[action] ?? null;
}

// ---------------------------------------------------------------- Escopeta de tubo: cartucho a cartucho
/** Ventana de carga (bajo el cajón, justo delante de la empuñadura), en el arma: el «brocal» de una escopeta de tubo es
 *  el propio tubo, muy por delante, y la mano cargaba en la punta. */
const PORT: Pick<LeftKey, "at" | "offW"> = { at: "grip", offW: [0.085, 0.05, 0] };
/** Pista de la recarga cartucho a cartucho con las MISMAS fases que el sonido (`tilt`, n × `shell`, `rack`, `settle`):
 *  inclinar el arma para enseñar la ventana, y por cada cartucho la mano lo trae desde abajo, lo empuja dentro (con un
 *  pequeño golpe del arma) y vuelve; si estaba vacía, bombea al final. */
export function shotgunShells(phases: [string, number][]): Track {
  const gun: Key<Gun6>[] = [{ t: 0, v: Z }];
  const left: Key<LeftKey>[] = [{ t: 0, v: { at: "rest" } }];
  const slide: Key<number>[] = [{ t: 0, v: 0 }];
  const TILT: Gun6 = [-0.025, 0.012, 0, 0.1, 0.1, -0.55];
  const PICK: LeftKey = { ...PORT, off: [-0.05, -0.1, 0.01], dir: [0.6, 0.75, -0.25], up: [-0.8, 0.0, 0.6], hand: "pinch" };
  const IN: LeftKey = { ...PORT, off: [-0.012, -0.022, 0], dir: [0.6, 0.75, -0.25], up: [-0.8, 0.0, 0.6], hand: "pinch" };
  const PUSH: LeftKey = { at: "grip", offW: [0.07, 0.05, 0], off: [-0.006, -0.012, 0], dir: [0.7, 0.65, -0.2], up: [-0.8, 0.0, 0.6], hand: "palm" };
  let acc = 0;
  for (const [id, w] of phases) {
    const a = acc, b = acc + w; acc = b;
    if (id === "tilt") {
      gun.push({ t: a + w * 0.25, v: [0.004, -0.008, 0, -0.03, 0, 0.03], e: "o" }, { t: b, v: TILT, e: "io" });
      left.push({ t: a + w * 0.3, v: { at: "rest" } }, { t: b, v: PICK, e: "io" });
    } else if (id === "shell") {
      // (el cartucho entra al 55 % de la fase, que es cuando suena)
      left.push({ t: a + w * 0.45, v: IN, e: "io" }, { t: a + w * 0.58, v: PUSH, e: "s" }, { t: b, v: PICK, e: "io" });
      gun.push({ t: a + w * 0.55, v: TILT }, { t: a + w * 0.6, v: [TILT[0], TILT[1] + 0.006, TILT[2], TILT[3] + 0.035, TILT[4], TILT[5]], e: "s" }, { t: b, v: TILT, e: "o" });
    } else if (id === "rack") {
      // bombeo: la mano vuelve al guardamanos, tira atrás y empuja adelante (golpe seco)
      left.push({ t: a + w * 0.3, v: { at: "rest" }, e: "io" }, { t: a + w * 0.55, v: { at: "rest", offW: [-0.085, 0, 0] }, e: "s" }, { t: a + w * 0.8, v: { at: "rest" }, e: "s" });
      slide.push({ t: a + w * 0.3, v: 0 }, { t: a + w * 0.55, v: 1, e: "s" }, { t: a + w * 0.8, v: 0, e: "s" });
      gun.push({ t: a + w * 0.3, v: [-0.01, 0.006, 0, 0.05, 0.05, -0.25], e: "io" }, { t: a + w * 0.55, v: [-0.01, 0.0, 0.02, 0.09, 0.05, -0.2], e: "s" }, { t: a + w * 0.8, v: [-0.01, 0.008, -0.01, 0.02, 0.04, -0.2], e: "s" });
    } else if (id === "settle") {
      if (left[left.length - 1].v.at !== "rest") left.push({ t: a + w * 0.5, v: { at: "rest" }, e: "io" });
      gun.push({ t: a + w * 0.75, v: [0.002, -0.006, 0, -0.025, 0, 0.02], e: "io" });
    }
  }
  gun.push({ t: 1, v: Z, e: "o" }); left.push({ t: 1, v: { at: "rest" } }); slide.push({ t: 1, v: 0 });
  return { dur: 3, gun, left, slide };
}
TRACKS.shotgun.reload = longMag({ roll: 0.38, lift: 0.02, pitch: 0.1 }, false); // (escopetas con cargador de caja)
TRACKS.shotgun.reloadEmpty = longMag({ roll: 0.38, lift: 0.02, pitch: 0.1 }, true);
