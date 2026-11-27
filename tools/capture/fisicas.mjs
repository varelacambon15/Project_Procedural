// Tarea 1 (rama opus/rapier o posteriores): ragdoll, desmembramiento con ragdoll, explosión entre cajas y medida con 20
// ragdolls. Necesita la física activa (modo desarrollador). Uso: node tools/capture/fisicas.mjs <carpeta>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto((process.env.URL ?? "http://localhost:5199/")); await p.waitForFunction(() => !!window.__game, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.evaluate(() => { const g = window.__game; g.setSetting("dev", true); g.newGame(); g.start.close(); g.state = "play"; const st = document.createElement("style"); st.textContent = "body > *:not(canvas):not(#bars){visibility:hidden !important} canvas{visibility:visible !important}"; document.head.appendChild(st); g.player.pos.set(0, 0, 7); g.player.yaw = Math.PI; g.player.pitch = -0.12; });
await p.waitForFunction(() => !!window.__phys?.ph, null, { timeout: 60000 });
await p.evaluate(() => { window.__game.debug.manual = true; });
// avanza el juego `ms` milisegundos con paso fijo de 1/60 s (solo dibuja el último fotograma)
const run = (ms) => p.evaluate((ms) => { const g = window.__game, n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { g.debug.noDraw = i < n - 1; g.step(1 / 60); } g.debug.noDraw = false; }, ms);
const stats0 = await p.evaluate(() => window.__phys.stats);
const shot = async (n) => p.screenshot({ path: `${OUT}/${n}.png` });
const kill = (x, z, zone, dmg, crit = false) => p.evaluate(([x, z, zone, dmg, crit]) => {
  const g = window.__game, V = g.player.pos.constructor;
  const d = g.waves.spawnAt("basic", new V(x, 0, z)); d.group.rotation.y = 0; g.__last = d;
  const y = zone === "head" ? 2.13 : zone === "limb" ? 1.5 : 1.6, xo = zone === "limb" ? 0.3 : 0;
  g.__killNext = () => g.gun.hooks.onHit(d, zone, new V(x + xo, y, z), dmg, null, crit);
}, [x, z, zone, dmg, crit]);
// 1) Ragdoll normal en 3 instantes
await kill(0.3, 10.2, "body", 400); await run(400); await shot("vivo"); const z0 = await p.evaluate(() => window.__game.__last.group.position.toArray()); await p.evaluate(() => window.__game.__killNext()); await run(300); await shot("ragdoll_0"); await run(700); await shot("ragdoll_1"); await run(1500); await shot("ragdoll_2"); const z1 = await p.evaluate(() => { const r = [...window.__phys.rags.values()].at(-1); return r ? [...r.segs.values()].map((s) => [s.id, s.pivot.position.toArray().map((x) => +x.toFixed(2))]) : null; }); console.log("Z", JSON.stringify(z0), JSON.stringify(z1));
await run(3500);
// 2) Cabeza por francotirador (desmembramiento) y extremidad por escopeta
await kill(0.3, 10.2, "head", 600, true); await run(400); await p.evaluate(() => window.__game.__killNext()); await run(1300); await shot("cabeza");
await run(4500);
await kill(0.3, 10.2, "limb", 600); await run(400); await p.evaluate(() => window.__game.__killNext()); await run(1300); await shot("extremidad");
await run(4500);
// 3) Explosión entre las cajas
await p.evaluate(() => { const g = window.__game; g.player.yaw = Math.PI + 0.25; });
await run(600); await shot("cajas_antes");
await p.evaluate(() => { const g = window.__game, V = g.player.pos.constructor; g.gun.explode(new V(3.1, 0.1, 10.8), 10, "explosive"); });
await run(250); await shot("cajas_1"); await run(700); await shot("cajas_2");
// 4) Medición: 20 ragdolls + 9 objetos
await p.evaluate(() => { const g = window.__game, V = g.player.pos.constructor; g.player.yaw = Math.PI; for (let i = 0; i < 20; i++) { const d = g.waves.spawnAt("basic", new V(-4 + (i % 5) * 2, 0, 12 + Math.floor(i / 5) * 2)); setTimeout(() => g.gun.hooks.onHit(d, "body", new V(d.group.position.x, 1.6, d.group.position.z), 500, null, false), 400); } });
const samples = [];
for (let i = 0; i < 12; i++) { await run(250); samples.push(await p.evaluate(() => ({ ...window.__phys.stats }))); }
await shot("veinte");
console.log(JSON.stringify({ stats0, samples, errs: errs.slice(0, 5) }));
await b.close();
