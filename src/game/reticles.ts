// Catálogo de retículas del juego: datos puros (sin DOM ni three).
// Cada forma es un SVG completo con viewBox 100×100; la capa #reddot pinta el que devuelve
// reticleFor() según la óptica montada y, si no hay id conocido, según el tipo de mira.

export type ReticleId =
  | "dot" | "ring" | "ring-dot" | "chevron" | "chevron-bdc"
  | "cross" | "cross-dot" | "mildot" | "triangle" | "crosshair-gap";

export const RETICLE_IDS: readonly ReticleId[] = [
  "dot", "ring", "ring-dot", "chevron", "chevron-bdc",
  "cross", "cross-dot", "mildot", "triangle", "crosshair-gap",
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
};

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
