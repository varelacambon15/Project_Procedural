// Catálogo de retículas del juego: datos puros (sin DOM ni three).
// Cada forma es un SVG completo con viewBox 100×100; la capa #reddot pinta el que devuelve
// reticleFor() según la óptica montada y, si no hay id conocido, según el tipo de mira.

export type ReticleId =
  | "dot" | "ring" | "ring-dot" | "chevron" | "chevron-bdc"
  | "cross" | "cross-dot" | "mildot" | "triangle" | "crosshair-gap"
  // Tarea 5: 10 formas más (coleccionables)
  | "dot-ring-ticks" | "t-dot" | "circle-cross" | "bracket" | "triangle-dot"
  | "diamond" | "horseshoe" | "crosshair-dot" | "chevron-dot" | "dots-vertical";

export const RETICLE_IDS: readonly ReticleId[] = [
  "dot", "ring", "ring-dot", "chevron", "chevron-bdc",
  "cross", "cross-dot", "mildot", "triangle", "crosshair-gap",
  "dot-ring-ticks", "t-dot", "circle-cross", "bracket", "triangle-dot",
  "diamond", "horseshoe", "crosshair-dot", "chevron-dot", "dots-vertical",
];

const RED = "#ff3b2a";
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;

export const RETICLES: Record<ReticleId, string> = {
  // Punto redondo (red dot, reflex y punto rojo procedural).
  dot: svg(`<circle cx="50" cy="50" r="7" fill="${RED}"/>`),
  // Aro fino sin punto.
  ring: svg(`<circle cx="50" cy="50" r="44" fill="none" stroke="${RED}" stroke-width="4"/>`),
  // Aro + punto central (holográfica).
  "ring-dot": svg(
    `<circle cx="50" cy="50" r="44" fill="none" stroke="${RED}" stroke-width="4"/>` +
    `<circle cx="50" cy="50" r="6" fill="${RED}"/>`,
  ),
  // Chevron de ACOG / mira de aumentos.
  chevron: svg(`<path d="M50 28 L72 72 L59 72 L50 53 L41 72 L28 72 Z" fill="${RED}"/>`),
  // Chevron con marcas de caída (BDC).
  "chevron-bdc": svg(
    `<path d="M50 22 L68 58 L57 58 L50 43 L43 58 L32 58 Z" fill="${RED}"/>` +
    `<path d="M42 66 H58 M44 76 H56 M46 86 H54" stroke="${RED}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  ),
  // Cruz simple con hueco central (visores de tubo y acc:scope2/6).
  cross: svg(`<path d="M12 50 H44 M56 50 H88 M50 12 V44 M50 56 V88" stroke="${RED}" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  // Cruz + punto central iluminado.
  "cross-dot": svg(
    `<path d="M12 50 H44 M56 50 H88 M50 12 V44 M50 56 V88" stroke="${RED}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<circle cx="50" cy="50" r="5" fill="${RED}"/>`,
  ),
  // Cruz mil-dot: 12 marcas y punto central (visor del kit).
  mildot: svg(
    `<path d="M8 50 H92 M50 8 V92" stroke="${RED}" stroke-width="2" fill="none"/>` +
    `<path d="M46 20 H54 M46 30 H54 M46 40 H54 M46 60 H54 M46 70 H54 M46 80 H54" stroke="${RED}" stroke-width="3" fill="none"/>` +
    `<path d="M20 46 V54 M30 46 V54 M40 46 V54 M60 46 V54 M70 46 V54 M80 46 V54" stroke="${RED}" stroke-width="3" fill="none"/>` +
    `<circle cx="50" cy="50" r="4" fill="${RED}"/>`,
  ),
  // Triángulo de puntería.
  triangle: svg(`<path d="M50 26 L70 72 L30 72 Z" fill="none" stroke="${RED}" stroke-width="5" stroke-linejoin="round"/>`),
  // Cruz con hueco central amplio, sin punto.
  "crosshair-gap": svg(`<path d="M10 50 H40 M60 50 H90 M50 10 V40 M50 60 V90" stroke="${RED}" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  // ---- Tarea 5: coleccionables ----
  // Punto con aro y cuatro marcas exteriores.
  "dot-ring-ticks": svg(
    `<circle cx="50" cy="50" r="34" fill="none" stroke="${RED}" stroke-width="3.5"/>` +
    `<circle cx="50" cy="50" r="5" fill="${RED}"/>` +
    `<path d="M50 4 V14 M50 86 V96 M4 50 H14 M86 50 H96" stroke="${RED}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  ),
  // «T» invertida con punto (sin trazo superior).
  "t-dot": svg(
    `<path d="M14 50 H42 M58 50 H86 M50 58 V88" stroke="${RED}" stroke-width="4" stroke-linecap="round" fill="none"/>` +
    `<circle cx="50" cy="50" r="4.5" fill="${RED}"/>`,
  ),
  // Círculo atravesado por una cruz.
  "circle-cross": svg(
    `<circle cx="50" cy="50" r="30" fill="none" stroke="${RED}" stroke-width="3.5"/>` +
    `<path d="M8 50 H92 M50 8 V92" stroke="${RED}" stroke-width="2.5" fill="none"/>`,
  ),
  // Corchetes en las esquinas con punto.
  bracket: svg(
    `<path d="M22 34 V22 H34 M66 22 H78 V34 M78 66 V78 H66 M34 78 H22 V66" stroke="${RED}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
    `<circle cx="50" cy="50" r="4.5" fill="${RED}"/>`,
  ),
  // Triángulo hueco con punto central.
  "triangle-dot": svg(
    `<path d="M50 20 L78 72 L22 72 Z" fill="none" stroke="${RED}" stroke-width="4" stroke-linejoin="round"/>` +
    `<circle cx="50" cy="55" r="5" fill="${RED}"/>`,
  ),
  // Rombo hueco con punto.
  diamond: svg(
    `<path d="M50 16 L84 50 L50 84 L16 50 Z" fill="none" stroke="${RED}" stroke-width="4" stroke-linejoin="round"/>` +
    `<circle cx="50" cy="50" r="4.5" fill="${RED}"/>`,
  ),
  // Herradura (aro abierto abajo) con punto.
  horseshoe: svg(
    `<path d="M30 78 A32 32 0 1 1 70 78" fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="50" cy="50" r="5" fill="${RED}"/>`,
  ),
  // Cruz fina larga con punto grande.
  "crosshair-dot": svg(
    `<path d="M6 50 H38 M62 50 H94 M50 6 V38 M50 62 V94" stroke="${RED}" stroke-width="2.5" stroke-linecap="round" fill="none"/>` +
    `<circle cx="50" cy="50" r="6.5" fill="${RED}"/>`,
  ),
  // Chevron hueco con punto en la punta.
  "chevron-dot": svg(
    `<path d="M24 72 L50 34 L76 72" fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="50" cy="26" r="5" fill="${RED}"/>`,
  ),
  // Columna de puntos (caída de bala).
  "dots-vertical": svg(
    `<circle cx="50" cy="50" r="5" fill="${RED}"/>` +
    `<circle cx="50" cy="64" r="3.5" fill="${RED}"/><circle cx="50" cy="76" r="3" fill="${RED}"/><circle cx="50" cy="87" r="2.5" fill="${RED}"/>` +
    `<path d="M32 50 H40 M60 50 H68" stroke="${RED}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  ),
};

/** Tarea 5: colores elegibles de la retícula (el rojo es el de siempre). */
export type ReticleColor = "rojo" | "verde" | "azul" | "blanco" | "amarillo" | "cian";
export const RETICLE_COLORS: Record<ReticleColor, string> = {
  rojo: RED, verde: "#3dff6a", azul: "#3a8cff", blanco: "#f4f6ff", amarillo: "#ffd23a", cian: "#36f0ff",
};
export const isReticleId = (x: unknown): x is ReticleId => typeof x === "string" && (RETICLE_IDS as readonly string[]).includes(x);
export const isReticleColor = (x: unknown): x is ReticleColor => typeof x === "string" && x in RETICLE_COLORS;
/** SVG de una forma en un color (el catálogo base es rojo). */
export function reticleSvg(id: ReticleId, color: ReticleColor = "rojo"): string {
  return RETICLES[id].split(RED).join(RETICLE_COLORS[color]);
}
/** Brillo del contorno (drop-shadow de #reddot) a juego con el color. */
export function reticleGlow(color: ReticleColor = "rojo"): string {
  const h = RETICLE_COLORS[color], r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return `drop-shadow(0 0 4px rgba(${r}, ${g}, ${b}, .85))`;
}
/**
 * Retícula que se ve con un arma: la elegida en el taller (si está desbloqueada) o la de su óptica; sin óptica que
 * pinte retícula, ninguna (las miras de hierro no la llevan).
 */
export function reticleShown(optic: string | null, sight: string, chosen: ReticleId | undefined, unlocked: ReadonlySet<string>): ReticleId | "" {
  const base = reticleFor(optic, sight);
  if (!base) return "";
  return chosen && unlocked.has(chosen) ? chosen : base;
}

/** Id de retícula para una óptica montada (`optic`, puede ser null) y un tipo de mira (`sight`). */
export function reticleFor(optic: string | null, sight: string): ReticleId | "" {
  if (optic) {
    if (optic.startsWith("k-att-reddot") || optic.startsWith("k-att-reflex") || optic === "acc:reddot") return "dot";
    if (optic.startsWith("k-att-holographic") || optic === "acc:holo") return "ring-dot";
    if (optic.startsWith("k-att-magnified")) return "chevron";
    if (optic.startsWith("k-att-scope")) return "mildot";
    if (optic === "acc:scope2" || optic === "acc:scope6") return "cross";
  }
  switch (sight) {
    case "dot": return "dot";
    case "holo": return "ring-dot";
    case "scope": return "cross";
    default: return "";
  }
}
