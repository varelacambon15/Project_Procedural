// Comprueba que cada clave usada en el código y en index.html existe en los dos idiomas.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { hasKey } from "../src/i18n";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ts")) files.push(p); } };
walk(join(ROOT, "src"));
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const keys = new Set<string>();
for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/\bt\("([a-zA-Z0-9_.\-]+)"/g)) keys.add(m[1]);
// También claves en literales sueltos (p. ej. dentro de un ternario): "ui.algo", "shop.algo"…
for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/"((?:ui|shop|save|set|dlg|zone|socket|sort|hint|c)\.[A-Za-z0-9_.\-]*[A-Za-z0-9])"/g)) keys.add(m[1]);
for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) keys.add(m[1]);
// dinámicas
const fam: Record<string, string[]> = {
  zone: ["optic", "muzzle", "device"], socket: ["optic", "muzzle", "device"], "acc.noZone": ["optic", "muzzle", "device"],
  sort: ["rarity", "level", "damage", "class", "era", "zone"], era: ["classic", "modern", "rustic", "scifi"], "shop.tname": ["t1", "t2", "t3", "t4"],
  "shop.err": ["locked", "credits", "unknown"], "shop.where": ["pack", "equip", "tray"], "save.err": ["missing", "corrupt", "newer", "invalid", "write"],
  set: ["sensitivity", "fov", "volume", "damageNumbers", "impactFx", "screenShake", "arms", "pixel"], "dlg.err": ["tooLong", "invalid"],
  "stat.short": ["precision", "alcance", "manejo", "cadencia", "dano", "cargador"],
  acc: ["reflex", "foregrip", "flashlight", "laser", "laserlight", "factory", "quiet", "same", "noFit", "wrongType", "caliber", "noForegrip", "band", "bandLow", "empty", "noIntegrated"],
};
for (const k of ["ui.useShop","ui.pauseIntro","ui.scrappedAcc","ui.scrappedCr","c.toggles","ui.wavesStart","ui.wavesStop","ui.inspect","ui.useBench","ui.workbench","ui.inventory","ui.yourWeapons","ui.equipped","ui.backpack","ui.preview","ui.finish","ui.title","ui.pause","ui.resume","ui.language","ui.kbm","ui.pad","c.move","c.look","c.fire","c.reload","c.swap","c.sprint","c.inspect","c.use","c.inv","c.pause","c.sticks","c.menus.d","ui.equippedNow","ui.compared","ui.empty","ui.noWeapons","ui.packFull","ui.dropped","ui.equippedTo","ui.storedIn","ui.pickup","ui.lootDrop","label.level","label.damage","unit.rpm","unit.m"]) keys.add(k);
for (const [k, v] of Object.entries(fam)) for (const x of v) keys.add(`${k}.${x}`);
describe("idiomas", () => {
  it("todas las claves de texto que usa el juego existen en inglés y en español (sin textos fijos)", () => {
    for (const lang of ["en", "es"] as const) expect([...keys].filter((k) => !hasKey(lang, k)).sort()).toEqual([]);
  });
});
