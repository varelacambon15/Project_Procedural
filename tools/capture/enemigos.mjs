// Tarea 2 (rama opus/enemigos): sabueso, reparador y centinela. Retrato de los tres, galope, salto con aviso, cura y
// carga del centinela. Uso: node tools/capture/enemigos.mjs <carpeta> [ancho] [alto]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.argv[2], W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto((process.env.URL ?? "http://localhost:5199/")); await p.waitForFunction(() => !!window.__game, null, { timeout: 120000 }); await p.waitForTimeout(3000);
await p.evaluate(() => { const g = window.__game; g.setSetting("physics", false); g.newGame(); g.start.close(); g.state = "play"; const st = document.createElement("style"); st.textContent = "body > *:not(canvas):not(#bars){visibility:hidden !important} canvas{visibility:visible !important}"; document.head.appendChild(st); g.player.pos.set(0, 0, 7); g.player.yaw = Math.PI; g.player.pitch = -0.05; g.debug.manual = true; });
const run = (ms) => p.evaluate((ms) => { const g = window.__game, n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { g.debug.noDraw = i < n - 1; g.step(1 / 60); } g.debug.noDraw = false; }, ms);
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
const spawn = (kind, x, z, yaw, still = true) => p.evaluate(([kind, x, z, yaw, still]) => { const g = window.__game, V = g.player.pos.constructor; const d = g.waves.spawnAt(kind, new V(x, 0, z)); if (still) d.chase = null; d.group.rotation.y = yaw; (g.__en ??= []).push(d); return d.kind.key; }, [kind, x, z, yaw, still]);
const clear = () => p.evaluate(() => { const g = window.__game; for (const d of g.__en ?? []) { g.scene.remove(d.group); d.bar.remove(); const i = g.dummies.indexOf(d); if (i >= 0) g.dummies.splice(i, 1); } g.__en = []; });
await run(1500);
// 1) Retrato de los tres, de tres cuartos
await spawn("hound", -2.4, 11, -0.6); await spawn("sentinel", 0.4, 12.5, 0.3); await spawn("repairer", 2.8, 11, 0.7);
await p.evaluate(() => { const g = window.__game; g.__en[2].group.position.y = 1.5; });
await run(600); await shot("trio");
const fromGlb = await p.evaluate(() => window.__game.__en.map((d) => [d.kind.key, d.model?.fromGlb, d.hitboxes.length]));
await clear();
// 2) Sabueso corriendo (galope) visto de lado, y salto
await spawn("hound", -6, 12, Math.PI / 2, false);
await p.evaluate(() => { const g = window.__game, V = g.player.pos.constructor, d = g.__en[0]; d.chase.target = () => new V(30, 0, 12); });
await run(700); await shot("sabueso_corre_1"); await run(130); await shot("sabueso_corre_2");
await clear();
await spawn("hound", 0, 13.5, Math.PI, false); await p.evaluate(() => { window.__game.__en[0].pounceCd = 0; });
await run(250); await shot("sabueso_agachado"); await run(250); await shot("sabueso_salto"); await run(500); await shot("sabueso_muerde");
await clear();
// 3) Reparador curando a un soldado herido
await spawn("basic", 1.2, 12.5, Math.PI, true); await spawn("repairer", -1.5, 12, 0, false);
await p.evaluate(() => { const g = window.__game, s = g.__en[0]; s.layers[0].value = s.layers[0].max * 0.4; });
await run(1800); await shot("reparador_cura");
const healed = await p.evaluate(() => { const s = window.__game.__en[0]; return +(s.layers[0].value / s.layers[0].max).toFixed(2); });
await clear();
// 4) Centinela: carga y disparo
await spawn("sentinel", 0, 15, 0, false);
await run(1800); await shot("centinela_carga"); await run(500); await shot("centinela_dispara");
const ch = await p.evaluate(() => window.__game.__en[0].charge);
console.log(JSON.stringify({ fromGlb, healed, ch, errs: errs.slice(0, 6) }));
await b.close();
