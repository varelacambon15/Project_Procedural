// Tarea 2, fase 2 (rama opus/enemigos): bombardero soltando una bomba con aviso, andanada de misiles del mech,
// rodante artillero y enjambre de arañitas en una pelea real. Uso: node tools/capture/enemigos_fase2.mjs <carpeta> <ancho> <alto>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.argv[2], W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto(process.env.URL ?? "http://localhost:5199/"); await p.waitForFunction(() => !!window.__game, null, { timeout: 120000 }); await p.waitForTimeout(3000);
await p.evaluate(() => { const g = window.__game; g.setSetting("physics", false); g.newGame(); g.start.close(); g.state = "play"; g.player.pos.set(0, 0, 3); g.player.yaw = Math.PI; g.player.pitch = -0.08; g.debug.manual = true; });
const run = (ms) => p.evaluate((ms) => { const g = window.__game, n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { g.debug.noDraw = i < n - 1; g.step(1 / 60); } g.debug.noDraw = false; }, ms);
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
const spawn = (list) => p.evaluate((list) => { const g = window.__game, V = g.player.pos.constructor; g.__en = list.map(([k, x, z]) => g.waves.spawnAt(k, new V(x, 0, z))); }, list);
const hp = () => p.evaluate(() => Math.round(window.__game.php.value));
await run(1000);
await spawn([["mech", 0, 20], ["gunroller", -4, 14], ["bomber", 3, 12]]);
await p.evaluate(() => { window.__game.php.max = window.__game.php.value = 1e6; });
await run(1500); await shot("f2_1");
await run(2000); await shot("f2_2");
await run(1500); await shot("f2_3");
await run(1200); await shot("f2_4");
await p.evaluate(() => { const g = window.__game; for (const d of g.__en) { d.damage(1e9, null, false, d.center); } });
await run(3000);
await spawn([["swarmling", -2, 12], ["swarmling", -1, 12.5], ["swarmling", 0, 12], ["swarmling", 1, 12.5], ["swarmling", 2, 12], ["swarmling", 0.5, 13]]);
await run(900); await shot("f2_enjambre");
console.log(JSON.stringify({ errs: errs.slice(0, 6) }));
await b.close();
