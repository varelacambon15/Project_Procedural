import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator } from "../src/weapons/generator";
import { MemoryStorage } from "../src/game/storage";
import { AUTO, SAVE_VERSION, SaveManager, parseSave, type SaveData } from "../src/game/save";
import { SHOP, buy, machineLevel, newShopState, odds, record, tiers } from "../src/game/shop";
import { mulberry32 } from "../src/weapons/rng";
import { newAcc } from "../src/weapons/accbank";
import type { Manifest } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);
const game = (): SaveData => {
  const a = gen.generate(11), b = gen.generate(40, undefined, "legendaria"); a.customName = "Peñón";
  return {
    version: SAVE_VERSION, savedAt: "", name: "Partida 1", playSeconds: 321, credits: 480,
    weapons: [{ spec: a, ammo: 3, area: "equip", index: 0 }, { spec: b, ammo: b.stats.cargador, area: "pack", index: 4 }],
    active: 0, bank: [newAcc("optic", "acc:reddot", "rara")], shop: { spent: 220, history: [] },
    settings: { fov: 90, sensitivity: 1.3 }, lang: "es", pixelLevel: 48,
  };
};

describe("partidas guardadas", () => {
  it("guarda y carga todo como datos (armas completas, nombre elegido, banco, créditos, máquina, ajustes)", async () => {
    const m = new SaveManager(new MemoryStorage()), g = game();
    await m.save("slot2", g);
    const r = await m.load("slot2"); expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.data.weapons[0].spec).toEqual(g.weapons[0].spec);
    expect(r.data.weapons[0].spec.customName).toBe("Peñón");
    expect(r.data.weapons[1].spec.rarity.id).toBe("legendaria");
    expect(r.data.bank).toEqual(g.bank); expect(r.data.credits).toBe(480); expect(r.data.shop.spent).toBe(220);
    expect(r.data.settings).toEqual({ fov: 90, sensitivity: 1.3 }); expect(r.data.pixelLevel).toBe(48); expect(r.data.lang).toBe("es");
    // Las armas se reconstruyen igual a partir de los datos (no se guardan mallas)
    const again = gen.refresh(structuredClone(r.data.weapons[0].spec));
    expect(again.stats).toEqual(g.weapons[0].spec.stats);
    expect(JSON.stringify(r.data)).not.toMatch(/"geometry"|"uuid"|"matrix"/);
  });

  it("3 ranuras y autoguardado separado, con resumen (créditos, armas, rareza más alta, fecha)", async () => {
    const m = new SaveManager(new MemoryStorage());
    await m.save("slot1", game()); await m.save(AUTO, { ...game(), credits: 5 });
    const list = await m.list();
    expect(list.map((x) => x.slot)).toEqual([AUTO, "slot1", "slot2", "slot3"]);
    const s1 = list.find((x) => x.slot === "slot1")!;
    expect(s1).toMatchObject({ empty: false, credits: 480, weapons: 2, best: "legendaria", name: "Partida 1" });
    expect(Date.parse(s1.savedAt!)).toBeGreaterThan(0);
    expect(list.find((x) => x.slot === AUTO)!.credits).toBe(5);
    expect(list.find((x) => x.slot === "slot3")!.empty).toBe(true);
    await m.remove("slot1"); expect((await m.list()).find((x) => x.slot === "slot1")!.empty).toBe(true);
  });

  it("un guardado corrupto no cuelga nada ni afecta a las otras ranuras", async () => {
    const st = new MemoryStorage(), m = new SaveManager(st);
    await m.save("slot1", game()); await m.save(AUTO, game());
    st.map.set("slot2", "{\"version\":2,\"weap");           // cortado a medias
    st.map.set("slot3", "basura");
    expect(await m.load("slot2")).toEqual({ ok: false, error: "corrupt" });
    const list = await m.list();
    expect(list.find((x) => x.slot === "slot2")!.error).toBe("corrupt");
    expect(list.find((x) => x.slot === "slot1")!.empty).toBe(false);
    expect((await m.load(AUTO)).ok).toBe(true);
    // Un arma dañada dentro de un guardado válido se descarta y el resto carga
    const g = game() as unknown as { weapons: unknown[] }; g.weapons.push({ spec: { type: "rifle" }, area: "pack", index: 2 });
    const r = parseSave(JSON.stringify(g)); expect(r.ok && r.data.weapons.length).toBe(2); expect(r.ok && r.dropped).toBe(1);
    // De una versión más nueva: se avisa, no se intenta cargar
    expect(parseSave(JSON.stringify({ ...game(), version: SAVE_VERSION + 1 }))).toEqual({ ok: false, error: "newer" });
  });

  it("escritura segura ante cortes: si se corta tras escribir la copia temporal, se recupera de ella", async () => {
    const st = new MemoryStorage(), m = new SaveManager(st);
    await m.save("slot1", game());
    const newer = JSON.stringify({ ...game(), credits: 999 });
    st.map.set("slot1.tmp", newer); st.map.set("slot1", newer.slice(0, 40)); // corte durante el reemplazo
    const r = await m.load("slot1"); expect(r.ok && r.data.credits).toBe(999);
    expect(st.map.has("slot1.tmp")).toBe(false);
    expect(await st.list()).not.toContain("slot1.tmp");
  });

  it("migra el formato antiguo (v1) a la versión actual", () => {
    const a = gen.generate(3);
    const v1 = { version: 1, inventory: { equip: [a, null], pack: [null, gen.generate(9)] }, scrap: 35, settings: { fov: 80 }, lang: "es" };
    const r = parseSave(JSON.stringify(v1)); expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.data.version).toBe(SAVE_VERSION); expect(r.data.credits).toBe(35);
    expect(r.data.weapons.map((w) => [w.area, w.index])).toEqual([["equip", 0], ["pack", 1]]);
    expect(r.data.bank).toEqual([]); expect(r.data.shop).toEqual({ spent: 0, history: [] });
  });

  it("exportar e importar JSON; importar algo inválido no toca la ranura", async () => {
    const m = new SaveManager(new MemoryStorage());
    await m.save("slot1", game());
    const txt = (await m.exportSlot("slot1"))!;
    expect((await m.importSlot("slot3", txt)).ok).toBe(true);
    expect((await m.load("slot3")).ok).toBe(true);
    expect((await m.importSlot("slot3", "{nope")).ok).toBe(false);
    const r = await m.load("slot3"); expect(r.ok && r.data.credits).toBe(480);
  });
});

describe("máquina expendedora", () => {
  it("los niveles se desbloquean con lo gastado; precio y suelo de rareza por nivel", () => {
    const st = newShopState();
    expect(tiers(st, 100).map((t) => t.unlocked)).toEqual([true, false, false, false]);
    expect(buy(st, 100, "t2", Math.random)).toEqual({ ok: false, reason: "locked" });
    expect(buy(st, 10, "t1", Math.random)).toEqual({ ok: false, reason: "credits" });
    st.spent = SHOP.tiers[3].unlock; expect(machineLevel(st)).toEqual({ level: 4, next: null });
    for (const t of SHOP.tiers) { const o = odds(t.floor as never); expect(Object.values(o).reduce((a, b) => a + b, 0)).toBeCloseTo(1); }
  });

  it("el suelo se respeta siempre y la legendaria se puede comprar en el nivel alto", () => {
    const r = mulberry32(5), st = newShopState(); st.spent = 1e9;
    const got: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) { const b = buy(st, 1e9, "t4", r); if (b.ok) got[b.rarity] = (got[b.rarity] ?? 0) + 1; }
    expect(got.comun ?? 0).toBe(0); expect(got.poco ?? 0).toBe(0); expect(got.rara ?? 0).toBe(0);
    expect(got.legendaria).toBeGreaterThan(0);
    for (let i = 0; i < 2000; i++) { const b = buy(st, 1e9, "t3", r); if (b.ok) expect(["rara", "epica", "legendaria"]).toContain(b.rarity); }
    for (let i = 0; i < 20; i++) record(st, { tier: "t1", rarity: "comun", name: `x${i}`, price: 60, at: i });
    expect(st.history.length).toBe(SHOP.historySize); expect(st.history[0].name).toBe("x19");
  });
});
