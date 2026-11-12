import { describe, expect, it } from "vitest";
import { LOOT, LootDirector, type LootSource } from "../src/weapons/loot";
import { mulberry32 } from "../src/weapons/rng";
import type { RarityId } from "../src/weapons/types";

/** Simula una sesión: bajas cada 1-4 s, orígenes mezclados, fin de oleada cada 12 bajas, el jugador recoge en 5-40 s. */
function simulate(kills: number, seed: number) {
  const r = mulberry32(seed), dir = new LootDirector(mulberry32(seed + 1));
  let now = 0; const drops: { t: number; k: number; rarity: RarityId; source: LootSource }[] = [];
  const ground: number[] = []; // instantes en que cada arma del suelo deja de estar (recogida o caducada)
  for (let k = 1; k <= kills; k++) {
    const dt = 1 + r() * 3; now += dt; dir.tick(dt, now); dir.combat(now);
    for (let i = ground.length - 1; i >= 0; i--) if (ground[i] <= now) ground.splice(i, 1);
    const x = r(); const source: LootSource = k % 12 === 0 ? "waveEnd" : x < 0.08 ? "big" : x < 0.3 ? "small" : "normal";
    const rarity = dir.kill(source, now, ground.length);
    if (rarity) { drops.push({ t: now, k, rarity, source }); ground.push(now + Math.min(LOOT.expireSeconds, 5 + r() * 35)); }
  }
  return drops;
}

describe("botín de enemigos (1000 bajas)", () => {
  const drops = simulate(1000, 7);
  const per100 = drops.length / 10;

  it("las armas por cada 100 bajas caen en una banda razonable", () => {
    expect(per100).toBeGreaterThanOrEqual(8);
    expect(per100).toBeLessThanOrEqual(22);
  });

  it("nunca se supera el tope por tiempo", () => {
    for (let i = 1; i < drops.length; i++) expect(drops[i].t - drops[i - 1].t).toBeGreaterThanOrEqual(LOOT.cap.minInterval);
  });

  it("se cumple el suelo mínimo (nunca una racha larga sin nada)", () => {
    let prev = 0;
    for (const d of drops) { expect(d.k - prev).toBeLessThanOrEqual(LOOT.floor.kills + 5); prev = d.k; }
    expect(1000 - prev).toBeLessThanOrEqual(LOOT.floor.kills + 5);
  });

  it("la distribución de rareza respeta los pesos (y la legendaria es muy rara)", () => {
    // Con muchas tiradas del reparto puro: proporciones cerca de los pesos del origen "normal"
    const dir = new LootDirector(mulberry32(99));
    const n = 20000, count: Record<string, number> = {};
    for (let i = 0; i < n; i++) { const k = dir.rarity("normal"); count[k] = (count[k] ?? 0) + 1; }
    const w = LOOT.rarity.normal as Record<string, number>, total = Object.values(w).reduce((a, b) => a + b, 0);
    for (const [k, v] of Object.entries(w)) expect(Math.abs((count[k] ?? 0) / n - v / total)).toBeLessThan(0.01);
    // En la sesión, la legendaria es muy rara y sale más de grandes y fin de oleada
    const leg = drops.filter((d) => d.rarity === "legendaria").length / drops.length;
    expect(leg).toBeLessThan(0.08);
    expect((LOOT.rarity.big as Record<string, number>).legendaria).toBeGreaterThan((LOOT.rarity.normal as Record<string, number>).legendaria);
  });

  it("tabla de resultados", () => {
    const by = (r: string) => drops.filter((d) => d.rarity === r).length;
    const gaps = drops.map((d, i) => d.k - (i ? drops[i - 1].k : 0));
    console.log(`\nBotín en 1000 bajas (semilla 7)\n| Armas | Por 100 bajas | Hueco máx. (bajas) | Blanca | Verde | Azul | Morada | Legendaria |\n|---|---|---|---|---|---|---|---|\n| ${drops.length} | ${per100.toFixed(1)} | ${Math.max(...gaps)} | ${by("comun")} | ${by("poco")} | ${by("rara")} | ${by("epica")} | ${by("legendaria")} |`);
    expect(drops.length).toBeGreaterThan(0);
  });
});
