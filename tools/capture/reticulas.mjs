// Tarea 5 (rama opus/reticulas): retículas en una óptica holográfica a los dos tamaños. Uso: node tools/capture/reticulas.mjs <carpeta>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [W, H] of [[1280, 720], [960, 470]]) {
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto((process.env.URL ?? "http://localhost:5199/")); await p.waitForFunction(() => !!window.__game, null, { timeout: 120000 }); await p.waitForTimeout(3000);
const name = await p.evaluate(async () => {
  const g = window.__game; g.newGame(); g.start.close(); g.state = "play";
  let spec = null; for (let s = 1; s < 4000 && !spec; s++) { const w = g.gen.generate(s, "rifle"); if (w.optic && w.optic.startsWith("k-att-holographic")) spec = w; }
  g.inv.reticles.unlocked.push("diamond", "bracket", "dot-ring-ticks", "chevron-dot"); g.inv.reticles.kills = { holo: 130 };
  const it = { uid: 990001, spec, ammo: spec.stats.cargador }; g.inv.equip[0] = it; g.inv.active = 0; g.inv.changed();
  await new Promise((r) => setTimeout(r, 3000));
  g.openScreen("workbench"); return spec.name + " " + spec.optic;
});
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/taller_${W}.png` });
// elegir rombo y cian en el taller (clic real en el selector)
await p.click('[data-reticle="diamond"]'); await p.click('[data-rcolor="cian"]'); await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/taller2_${W}.png` });
await p.evaluate(() => { const g = window.__game; g.resume?.(); g.state = "play"; for (const id of ["workbench"]) { const el = document.getElementById(id); if (el) el.hidden = true; } g.debug.aim = true; });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/ads_${W}.png` });
console.log(W, name, JSON.stringify(errs.slice(0, 3)));
await p.close();
}
await b.close();
