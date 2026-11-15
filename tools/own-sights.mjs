// Mira de serie de las armas de los packs del usuario (pieza "mira": alza, punto rojo, holográfica, visor…): tipo,
// aumento y centro de la lente en coordenadas del arma convertida. Se calcula con las anclas del manifest del pack
// (raíl_superior + centro_lente_local) y la escala de la conversión (distancia raíl_superior → boca).
// Uso: node tools/own-sights.mjs  (actualiza assets/weapons/manifest.json; lo llama también build-assets)
import { readFileSync, writeFileSync } from "node:fs";
const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
export function ownSights(man) {
  const packs = [["raw/kit39", "x-"], ["raw/pack2", "x-p2-"], ["raw/pack3", "x-p3-"], ["raw/pack4", "x-p4-"]];
  let n = 0;
  for (const [dir, pre] of packs) for (const w of read(`${dir}/catalogo.json`)) {
    const id = pre + w.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-"), e = man.weapons.find((x) => x.id === id);
    const m = read(`${dir}/${w.nombre}/manifest.json`), mira = w.mira ?? m.mira, rs = m.anclas?.["raíl_superior"], bo = m.anclas?.boca;
    if (!e || !rs || !bo || !e.anchors?.["raíl_superior"] || !e.anchors?.boca || !e.parts.some((p) => p.role === "scope")) continue;
    const kind = mira?.tipo_mira ?? (m.mira_integrada === "alza" || w.mira_integrada === "alza" ? "alza" : null);
    if (!kind) continue;
    const A = e.anchors["raíl_superior"], B = e.anchors.boca, k = Math.hypot(B[0] - A[0], B[1] - A[1]) / Math.hypot(bo[0] - rs[0], bo[1] - rs[1]);
    const cl = mira?.centro_lente_local;
    e.ownSight = { kind, zoom: mira?.aumento ?? 1, lens: cl ? [A[0] + cl[0] * k, A[1] + cl[1] * k] : null };
    n++;
  }
  return n;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const p = new URL("../assets/weapons/manifest.json", import.meta.url), man = JSON.parse(readFileSync(p, "utf8"));
  console.log("miras de serie:", ownSights(man)); writeFileSync(p, JSON.stringify(man, null, 1));
}
