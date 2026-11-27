// Tarea 2: un enemigo girado 0°, 90°, 180° y 270° (comprueba que mira al frente). Uso:
// node tools/capture/enemigos_giro.mjs <carpeta> <tipo> [distancia] [cabeceo]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.argv[2], KIND = process.argv[3], DIST = +(process.argv[4] || 3.5), PY = +(process.argv[5] || 0);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto((process.env.URL ?? "http://localhost:5199/")); await p.waitForFunction(() => !!window.__game, null, { timeout: 120000 }); await p.waitForTimeout(3000);
await p.evaluate(([PY]) => { const g = window.__game; g.setSetting("physics", false); g.newGame(); g.start.close(); g.state = "play"; const st = document.createElement("style"); st.textContent = "body > *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}"; document.head.appendChild(st); g.player.pos.set(0, 0, 7); g.player.yaw = Math.PI; g.player.pitch = PY; g.debug.manual = true; g.gun.group && (g.gun.group.visible = false); }, [PY]);
const run = (ms) => p.evaluate((ms) => { const g = window.__game, n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { g.debug.noDraw = i < n - 1; g.step(1 / 60); } g.debug.noDraw = false; }, ms);
await run(1200);
await p.evaluate(([k, D]) => { const g = window.__game, V = g.player.pos.constructor; const d = g.waves.spawnAt(k, new V(0, 0, 7 + D)); d.chase = null; g.__d = d; }, [KIND, DIST]);
for (const [i, yaw] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) { await p.evaluate((y) => { window.__game.__d.group.rotation.y = y; }, yaw); await run(400); await p.screenshot({ path: `${OUT}/${KIND}_${i}.png` }); }
console.log(JSON.stringify(errs));
await b.close();
