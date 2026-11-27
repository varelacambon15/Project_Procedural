// Tarea 7 (rama opus/sonidos): cuenta los sonidos que suenan al andar, saltar y disparar (sin audio real). Uso:
// node tools/capture/sonidos.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 960, height: 470 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.addInitScript(() => {
  // cuenta los sonidos que se reproducen (AudioBufferSourceNode.start)
  window.__plays = 0; const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__plays++; return o.apply(this, a); };
});
await p.goto((process.env.URL ?? "http://localhost:5199/")); await p.waitForFunction(() => !!window.__game, null, { timeout: 120000 }); await p.waitForTimeout(3000);
await p.evaluate(() => { const g = window.__game; g.newGame(); g.start.close(); g.state = "play"; });
await p.mouse.click(480, 235);
await p.waitForTimeout(1500);
const before = await p.evaluate(() => ({ plays: window.__plays, pos: window.__game.player.pos.toArray() }));
await p.keyboard.down("KeyW"); await p.waitForTimeout(3000); await p.keyboard.press("Space"); await p.waitForTimeout(1500); await p.keyboard.up("KeyW");
const after = await p.evaluate(() => ({ plays: window.__plays, pos: window.__game.player.pos.toArray() }));
console.log(JSON.stringify({ before, after, errs: errs.slice(0, 5) }));
await b.close();
