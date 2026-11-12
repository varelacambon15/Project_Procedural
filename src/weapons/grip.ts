// Perfil de agarre de cada arma (prompt 05-E), en datos: dónde va la mano de apoyo en la cadera y al apuntar, y la
// postura. Sale de la forma del arma y de sus accesorios (roles y sockets de las piezas), no se anima a mano por arma.
// Al generar el arma se elige una variante entre las compatibles y se guarda en el arma (y en la partida); si un
// cambio en el taller la deja sin soporte (p. ej. se quita la empuñadura vertical), se reasigna otra compatible.
// Solo lógica (sin Three.js): la posición de cada soporte la calcula el ensamblador (assembler.handles).
import type { WeaponSpec } from "./types";

/** Dónde va la mano de apoyo: ninguna (a una mano), en la propia empuñadura (dos manos), guardamanos, empuñadura
 * delantera, cargador, bajo el armazón, corredera de bombeo o cañón. */
export type Support = "none" | "grip" | "front" | "vgrip" | "mag" | "frame" | "pump";
/** Postura: cadera (armas cortas), al hombro (culata) o pegada al pecho (bullpup). */
export type Stance = "hip" | "shoulder" | "chest";
export interface GripProfile { variant: string; hip: Support; ads: Support; stance: Stance }

const P = (variant: string, hip: Support, ads: Support, stance: Stance): GripProfile => ({ variant, hip, ads, stance });
const handgun = (s: Pick<WeaponSpec, "type">) => s.type === "pistol" || s.type === "revolver";

/** Rasgos del arma que deciden el agarre. */
export function gripTraits(spec: Pick<WeaponSpec, "type" | "layout" | "tweaks" | "fireMode">) {
  const tw = spec.tweaks;
  const d = tw?.pistol ?? null;
  const vgrip = !!(d?.frame.vgrip && d.frame.vgrip !== "none") || !!tw?.device?.id?.includes("foregrip");
  const stock = !!tw?.pstock && !tw.nostock;
  const front = !!tw?.pfront || !!d?.barrel.guard;
  const frontMag = d?.mag.kind === "front";
  const heavyCal = d?.cyl?.cal === "heavy" || d?.cyl?.cal === "magnum";
  const lightCal = d?.cyl?.cal === "light";
  return { vgrip, stock, front, frontMag, heavyCal, lightCal, pump: spec.fireMode === "pump" };
}

/** Variantes de agarre compatibles con las piezas y accesorios del arma (la primera es la preferida). */
export function gripOptions(spec: Pick<WeaponSpec, "type" | "layout" | "tweaks" | "fireMode">): GripProfile[] {
  const t = gripTraits(spec);
  if (handgun(spec)) {
    // Con culata: al hombro y con dos manos (en la empuñadura delantera, el guardamanos, el cargador o bajo el armazón)
    if (t.stock) return [P("stock", t.vgrip ? "vgrip" : t.front ? "front" : t.frontMag ? "mag" : "frame", t.vgrip ? "vgrip" : t.front ? "front" : t.frontMag ? "mag" : "frame", "shoulder")];
    if (t.vgrip) return [P("vgrip", "vgrip", "vgrip", "hip")];
    const out: GripProfile[] = [];
    if (t.front) out.push(P("front", "front", "front", "hip"));
    if (t.frontMag) out.push(P("mag", "mag", "mag", "hip"));
    // Los calibres pesados favorecen las dos manos; los ligeros, una
    out.push(P("two", "grip", "grip", "hip"), P("switch", "none", "grip", "hip"));
    if (!t.heavyCal && !t.front) out.push(P("one", "none", "none", "hip"));
    if (t.lightCal) out.unshift(P("one", "none", "none", "hip"));
    return dedupe(out);
  }
  const stance: Stance = spec.type === "bullpup" ? "chest" : "shoulder";
  if (t.pump) return [P("pump", "pump", "pump", stance)];
  const out: GripProfile[] = [];
  if (t.vgrip) out.push(P("vgrip", "vgrip", "vgrip", stance));
  out.push(P("front", "front", "front", stance));
  // Subfusiles: a veces agarrados por el cargador (sin tambor)
  if (spec.type === "smg" && !spec.tweaks?.drum && !t.vgrip) out.push(P("mag", "mag", "mag", stance));
  return dedupe(out);
}
const dedupe = (l: GripProfile[]) => l.filter((g, i) => l.findIndex((h) => h.variant === g.variant) === i);

const same = (a: GripProfile, b: GripProfile) => a.variant === b.variant && a.hip === b.hip && a.ads === b.ads && a.stance === b.stance;
/** ¿Es la variante guardada compatible con el arma tal como está ahora? */
export const gripValid = (spec: Pick<WeaponSpec, "type" | "layout" | "tweaks" | "fireMode">, g: GripProfile | null | undefined) => !!g && gripOptions(spec).some((o) => same(o, g));

/** Elige (de forma estable por arma) una variante compatible. */
export function chooseGrip(spec: Pick<WeaponSpec, "type" | "layout" | "tweaks" | "fireMode" | "statSeed">): GripProfile {
  const opts = gripOptions(spec);
  // La preferida pesa el doble; el resto, por igual
  const w = opts.map((_, i) => (i === 0 ? 2 : 1)), tot = w.reduce((a, b) => a + b, 0);
  let x = (((spec.statSeed ?? 0) * 2654435761) >>> 0) % 1000 / 1000 * tot;
  for (let i = 0; i < opts.length; i++) { x -= w[i]; if (x < 0) return { ...opts[i] }; }
  return { ...opts[0] };
}

/** Mantiene la variante del arma si sigue siendo compatible; si no (o no tiene), le asigna una. */
export function ensureGrip(spec: WeaponSpec): GripProfile {
  if (!gripValid(spec, spec.hold)) spec.hold = chooseGrip(spec);
  return spec.hold!;
}
