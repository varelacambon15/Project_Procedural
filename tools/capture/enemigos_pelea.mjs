// Tarea 2: pelea real (2 sabuesos, centinela, reparador y un soldado herido) en tres instantes. Uso:
// node tools/capture/enemigos_pelea.mjs <carpeta> <ancho> <alto>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.argv[2], W = +process.argv[3], H = +process.argv[4];
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto((process.env.URL ?? "http://localhost:5199/")); await p.waitForFunction(() => !!window.__game, null, { timeout: 120000 }); await p.waitForTimeout(3000);
await p.evaluate(() => { const g = window.__game; g.setSetting("physics", false); g.newGame(); g.start.close(); g.state = "play"; g.player.pos.set(0, 0, 4); g.player.yaw = Math.PI; g.player.pitch = 0.02; g.debug.manual = true; });
const run = (ms) => p.evaluate((ms) => { const g = window.__game, n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { g.debug.noDraw = i < n - 1; g.step(1 / 60); } g.debug.noDraw = false; }, ms);
await run(1000);
await p.evaluate(() => { const g = window.__game, V = g.player.pos.constructor; g.__en = [["hound", -3, 20], ["hound", 3, 21], ["sentinel", 0, 18], ["repairer", -1, 19], ["basic", 1.5, 17]].map(([k, x, z]) => g.waves.spawnAt(k, new V(x, 0, z))); g.__en[4].layers[0].value *= 0.5; });
await run(900); await p.screenshot({ path: `${OUT}/pelea_1.png` });
await run(900); await p.screenshot({ path: `${OUT}/pelea_2.png` });
await run(900); await p.screenshot({ path: `${OUT}/pelea_3.png` });
const st = await p.evaluate(() => window.__game.__en.map((d) => [d.kind.key, d.alive, +d.group.position.x.toFixed(1), +d.group.position.z.toFixed(1), +(d.health / d.layers[0].max).toFixed(2)]));
console.log(JSON.stringify({ st, errs: errs.slice(0, 5) }));
await b.close();
