// Equipamiento (botón LB / X): objetos de apoyo con tipo, rareza y cargas que se recargan solas, como las granadas
// pero en su propia sección. Datos y generación puros (sin DOM ni three); el efecto en juego está en gadgetfx.ts.
import { GADGET_GRENADE_KINDS } from "./grenades";

export type GadgetKind = "turret" | "shield" | "dome" | "orb" | "hook" | "mine" | "gravity" | "slowfield" | "jump" | "beacon" | "knife" | "chain" | "harpoon" | "decoy" | "glitch" | "ammo" | "inject" | "thrust" | "teleport" | "chrono";
export type GadgetRarity = "comun" | "poco" | "rara" | "epica" | "legendaria";
export interface GadgetSpec {
  uid: number; kind: GadgetKind; rarity: GadgetRarity; seed: number;
  /** Potencia: daño por segundo, daño del impacto, cura por segundo o vida del escudo (según el tipo). */ power: number;
  /** Duración en segundos (0 = instantáneo). */ duration: number;
  /** Alcance o radio en metros. */ radius: number;
  /** Cargas máximas y segundos por carga. */ charges: number; recharge: number;
}

interface KindDef { power: number; duration: number; radius: number; charges: number; recharge: number; color: number }
export const GADGET_KINDS: Record<GadgetKind, KindDef> = {
  turret: { power: 26, duration: 12, radius: 18, charges: 1, recharge: 22, color: 0xffd060 },   // mini torreta: dispara sola un rato
  shield: { power: 600, duration: 10, radius: 2.2, charges: 1, recharge: 18, color: 0x4a90e8 }, // escudo desplegable: muro que para disparos y enemigos
  dome: { power: 0.7, duration: 7, radius: 5, charges: 1, recharge: 26, color: 0x7ab8ff },      // cúpula: dentro recibes mucho menos daño
  orb: { power: 340, duration: 0, radius: 4, charges: 2, recharge: 12, color: 0xb070ff },       // bola de energía: proyectil que estalla
  hook: { power: 0, duration: 0, radius: 26, charges: 2, recharge: 7, color: 0x9fe8ff },        // gancho: te lleva hasta donde apuntas
  mine: { power: 420, duration: 30, radius: 3.5, charges: 2, recharge: 14, color: 0xff4040 },   // mina de proximidad
  gravity: { power: 60, duration: 4, radius: 7, charges: 1, recharge: 20, color: 0xa070ff },    // generador de gravedad: atrae a un punto
  slowfield: { power: 0.35, duration: 8, radius: 6, charges: 1, recharge: 18, color: 0x9fe8ff },// campo de ralentización
  jump: { power: 11, duration: 20, radius: 1.4, charges: 2, recharge: 10, color: 0xf2c040 },     // plataforma de salto
  beacon: { power: 0, duration: 8, radius: 30, charges: 1, recharge: 16, color: 0xff7a2a },     // baliza de pulso: marca enemigos a través de paredes
  knife: { power: 260, duration: 0, radius: 30, charges: 3, recharge: 5, color: 0xd0d8e0 },     // cuchillo arrojadizo: instantáneo
  chain: { power: 200, duration: 0, radius: 3.5, charges: 1, recharge: 15, color: 0xff9a40 },   // cargas en cadena: tres estallidos seguidos
  harpoon: { power: 180, duration: 3, radius: 6, charges: 2, recharge: 11, color: 0x6ad8ff },   // arpón eléctrico: ensarta y descarga a los cercanos
  decoy: { power: 0, duration: 7, radius: 12, charges: 1, recharge: 18, color: 0x50f0ff },      // señuelo holográfico: atrae a los enemigos
  glitch: { power: 0, duration: 6, radius: 6, charges: 1, recharge: 20, color: 0x3fd0ff },      // granada de fallo: los afectados se atacan entre ellos
  ammo: { power: 1, duration: 0, radius: 0, charges: 1, recharge: 30, color: 0xe8c060 },        // caja de munición: recarga el arma al momento
  inject: { power: 0.35, duration: 6, radius: 0, charges: 1, recharge: 22, color: 0x9aff5a },   // inyector: más velocidad y cadencia un rato
  thrust: { power: 9, duration: 0, radius: 0, charges: 2, recharge: 6, color: 0x9fe8ff },       // propulsor: impulso hacia donde te mueves
  teleport: { power: 0, duration: 10, radius: 0, charges: 1, recharge: 14, color: 0xa070ff },   // teleportador: lanza la baliza y vuelve a pulsar para ir
  chrono: { power: 0.3, duration: 4, radius: 0, charges: 1, recharge: 34, color: 0x80c0ff },   // inyección temporal: todo menos tú a cámara lenta
};
// Los 5 tipos reclasificados como granadas siguen en GADGET_KINDS porque gadgetfx/gadgetthumb consultan ahí su color
// y su duración al lanzarlos desde GADGET_KIND_LIST no intervienen: el equipamiento generable son los otros 15.
export const GADGET_KIND_LIST = (Object.keys(GADGET_KINDS) as GadgetKind[]).filter((k) => !(GADGET_GRENADE_KINDS as readonly string[]).includes(k));

/** Mejora por rareza: potencia, duración, radio, cargas extra y recarga más rápida. */
export const GADGET_RARITY: Record<GadgetRarity, { mult: number; dur: number; radius: number; charges: number; recharge: number; color: string; price: number }> = {
  comun: { mult: 1, dur: 1, radius: 1, charges: 0, recharge: 1, color: "#c9c9c9", price: 110 },
  poco: { mult: 1.12, dur: 1.1, radius: 1.04, charges: 0, recharge: 0.92, color: "#5fc26a", price: 190 },
  rara: { mult: 1.25, dur: 1.2, radius: 1.08, charges: 0, recharge: 0.85, color: "#4a90e8", price: 300 },
  epica: { mult: 1.45, dur: 1.35, radius: 1.14, charges: 1, recharge: 0.76, color: "#a35cf0", price: 480 },
  legendaria: { mult: 1.7, dur: 1.5, radius: 1.22, charges: 1, recharge: 0.66, color: "#f2a541", price: 780 },
};
export const GADGET_RARITIES = Object.keys(GADGET_RARITY) as GadgetRarity[];

function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
let uid = 1;
export const setGadgetUid = (n: number) => { uid = Math.max(uid, n); };

/** Equipamiento nuevo de un tipo y rareza, con una pequeña variación por semilla. */
export function makeGadget(seed: number, kind?: GadgetKind, rarity?: GadgetRarity): GadgetSpec {
  const r = rng(seed);
  const k = kind ?? GADGET_KIND_LIST[Math.floor(r() * GADGET_KIND_LIST.length)];
  const ra = rarity ?? (["comun", "comun", "comun", "poco", "poco", "rara", "epica", "legendaria"] as GadgetRarity[])[Math.floor(r() * 8)];
  const d = GADGET_KINDS[k], q = GADGET_RARITY[ra], v = () => 0.94 + r() * 0.12;
  return {
    uid: uid++, kind: k, rarity: ra, seed,
    power: k === "dome" || k === "slowfield" || k === "inject" || k === "ammo" || k === "chrono" ? d.power : Math.round(d.power * q.mult * v()),
    duration: +(d.duration * q.dur * v()).toFixed(1), radius: +(d.radius * q.radius).toFixed(1),
    charges: d.charges + q.charges, recharge: +(d.recharge * q.recharge * v()).toFixed(1),
  };
}
export const gadgetPrice = (g: GadgetSpec) => GADGET_RARITY[g.rarity].price;
