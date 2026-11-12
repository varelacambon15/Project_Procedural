import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator } from "../src/weapons/generator";
import { ACCESSORIES } from "../src/weapons/accessories";
import { ACC_KINDS, accZones, accessoriesOf, attach, canDetach, canMount, detach, inBand, mountedAcc, newAcc, type AccKind } from "../src/weapons/accbank";
import { cleanName, displayName, rename, NAME_MAX } from "../src/weapons/naming";
import type { Manifest } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);
const many = (n: number) => Array.from({ length: n }, (_, s) => gen.generate(s * 41 + 3));
// Todos los accesorios que pueden existir (los que llevan las armas al generarse)
const pool: [AccKind, string][] = [
  ...ACCESSORIES.map((a) => [a.kind === "optic" ? "optic" : "muzzle", a.id] as [AccKind, string]),
  ...gen.kit.parts.filter((p) => p.slot === "Device").map((p) => ["device", p.id] as [AccKind, string]),
  ...gen.kit.parts.filter((p) => p.id.startsWith("k-att-") || p.id.startsWith("k-muzzledevice")).map((p) => [/suppressor|muzzledevice/.test(p.id) ? "muzzle" : "optic", p.id] as [AccKind, string]),
];

describe("accesorios desmontables (banco)", () => {
  it("montar cualquier accesorio permitido o desmontar uno nunca saca al arma de su banda de poder", () => {
    let mounts = 0, detaches = 0;
    for (const w of many(250)) {
      expect(inBand(gen, w)).toBe(true);
      for (const [kind, id] of pool) {
        if (!canMount(gen, w, { kind, id }).ok) continue;
        const c = structuredClone(w); attach(gen, c, newAcc(kind, id, "comun")); mounts++;
        expect(inBand(gen, c)).toBe(true);
        expect(mountedAcc(c, kind)).toBe(id);
      }
      for (const k of ACC_KINDS) {
        const c = structuredClone(w); const got = detach(gen, c, k);
        if (got) { detaches++; expect(inBand(gen, c)).toBe(true); expect(mountedAcc(c, k)).toBeNull(); }
        else if (mountedAcc(w, k)) expect(canDetach(gen, w, k).reason).toBe("acc.bandLow");
      }
    }
    expect(mounts).toBeGreaterThan(200); expect(detaches).toBeGreaterThan(100);
  });

  it("solo accesorios: las piezas estructurales y las miras integradas no se desmontan", () => {
    for (const w of many(200)) {
      const before = w.parts.filter((p) => p.role !== "device").map((p) => p.from).join();
      const c = structuredClone(w);
      for (const k of ACC_KINDS) detach(gen, c, k);
      expect(c.parts.filter((p) => p.role !== "device").map((p) => p.from).join()).toBe(before);
      if (w.optic && w.optic === w.parts[0].from) { expect(c.optic).toBe(w.optic); expect(accZones(gen, w)).not.toContain("optic"); }
    }
  });

  it("un accesorio por zona: montar en una zona ocupada devuelve el anterior; montar lo mismo se rechaza con motivo", () => {
    const w = many(400).find((x) => x.muzzle && accZones(gen, x).includes("muzzle") && pool.some(([k, id]) => k === "muzzle" && id !== x.muzzle && canMount(gen, x, { kind: k, id }).ok))!;
    const other = pool.find(([k, id]) => k === "muzzle" && id !== w.muzzle && canMount(gen, w, { kind: k, id }).ok)!;
    const old = w.muzzle;
    const back = attach(gen, w, newAcc("muzzle", other[1], "rara"));
    expect(back?.id).toBe(old); expect(w.muzzle).toBe(other[1]);
    expect(canMount(gen, w, { kind: "muzzle", id: other[1] })).toEqual({ ok: false, reason: "acc.same" });
  });

  it("lo que no encaja dice por qué (zona, tipo, calibre…)", () => {
    const pistol = many(300).find((x) => x.type === "pistol" && !accZones(gen, x).includes("device"))!;
    expect(canMount(gen, pistol, { kind: "device", id: pool.find(([k]) => k === "device")![1] }).reason).toBe("acc.noZone.device");
    const rifleScope = ACCESSORIES.find((a) => a.id === "acc:scope6")!;
    const smg = many(400).find((x) => x.type === "smg" && accZones(gen, x).includes("optic"))!;
    expect(canMount(gen, smg, { kind: "optic", id: rifleScope.id }).ok).toBe(false);
    for (const w of many(150)) for (const [kind, id] of pool) { const f = canMount(gen, w, { kind, id }); if (!f.ok) expect(f.reason).toMatch(/^acc\./); }
  });

  it("al desguazar, los accesorios montados pasan al banco con la rareza del arma", () => {
    for (const w of many(100)) {
      const acc = accessoriesOf(w);
      expect(acc.length).toBe(ACC_KINDS.filter((k) => mountedAcc(w, k)).length);
      for (const a of acc) expect(a.rarity).toBe(w.rarity.id);
    }
  });
});

describe("renombrar armas", () => {
  it("valida longitud, vacíos, saltos de línea y acepta tildes y ñ; vacío vuelve al nombre generado", () => {
    expect(cleanName("Peñón del Águila")).toEqual({ ok: true, value: "Peñón del Águila" });
    expect(cleanName("  a\nb\tc  ")).toEqual({ ok: true, value: "a b c" });
    expect(cleanName("   ")).toEqual({ ok: true, value: null });
    expect(cleanName("x".repeat(NAME_MAX + 1))).toEqual({ ok: false, error: "tooLong" });
    expect(cleanName("<script>")).toEqual({ ok: false, error: "invalid" });
    const w = gen.generate(5), original = w.name, stats = JSON.stringify(w.stats);
    rename(w, "Vieja Fiel");
    expect(displayName(w)).toBe("Vieja Fiel"); expect(w.name).toBe(original); expect(JSON.stringify(w.stats)).toBe(stats);
    rename(w, ""); expect(displayName(w)).toBe(original); expect(w.customName).toBeNull();
    // El nombre elegido sobrevive a un cambio de accesorio (que recalcula la designación técnica)
    rename(w, "Vieja Fiel"); gen.refresh(w); expect(displayName(w)).toBe("Vieja Fiel");
  });
});
