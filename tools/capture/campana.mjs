// Tarea 3 (rama opus/campana): juega un nivel de la campaña Hack de forma automática (teletransporte por las salas,
// enemigos eliminados por código, se queda en el terminal del hack, recoge el núcleo y sale) y captura cada objetivo.
// Uso: node tools/capture/campana.mjs <carpeta> <nivel h1..h5> [ancho] [alto]. Imprime el registro y el estado final.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.argv[2], LV = process.argv[3] || "h1", W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto(process.env.URL ?? "http://localhost:5199/"); await p.waitForFunction(() => !!window.__game, null, { timeout: 120000 }); await p.waitForTimeout(3000);
await p.evaluate((LV) => {
  const g = window.__game; g.setSetting("physics", false); g.newGame(); g.start.close(); g.state = "play";
  // (desbloquea hasta el nivel pedido como si se hubieran jugado los anteriores)
  const c = { levels: {}, finalReward: false }; for (const id of ["h1", "h2", "h3", "h4", "h5"]) { if (id === LV) break; c.levels[id] = { done: true, stars: [], bestTime: 300, runs: 1 }; } g.camp = c;
  g.php.max = g.php.value = 1e6; g.debug.manual = true;
  window.__log = []; const tt = g.toast; 
  return g.startCampaign(LV, 4242);
}, LV);
const run = (ms) => p.evaluate((ms) => { const g = window.__game, n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { g.debug.noDraw = i < n - 1; g.php.value = g.php.max; g.step(1 / 60); } g.debug.noDraw = false; }, ms);
const shot = (n) => p.screenshot({ path: `${OUT}/${LV}_${n}.png` });
const hud = () => p.evaluate(() => document.querySelector("#hp span, .hp span, #health span")?.textContent ?? "");
const state = () => p.evaluate(() => { const r = window.__game.raid, c = r.campaign; return c ? { idx: c.idx, cur: c.current?.type, hack: +c.hackT.toFixed(1), dest: c.destroyed, waves: c.waves, carry: c.carrying, t: Math.round(c.t), chest: c.chest } : null; });
// salas del camino en orden: [índice, centro x, z, tipo, objetivo]
const rooms = await p.evaluate(() => { const r = window.__game.raid, O = { x: 700, z: 0 }; return r.states.filter((s) => s.room.kind !== "loot").sort((a, b) => a.room.i - b.room.i).map((s) => [s.room.i, O.x + s.room.cx, O.z + s.room.cz, s.room.kind, s.obj?.type ?? null]); });
console.log("salas", JSON.stringify(rooms));
const go = (x, z, yaw = 0) => p.evaluate(([x, z, yaw]) => { const g = window.__game; g.player.pos.set(x, 0, z); g.player.vel.set(0, 0, 0); g.player.yaw = yaw; g.player.pitch = -0.1; }, [x, z, yaw]);
const killAll = (keepPylons = false) => p.evaluate((keep) => { const g = window.__game; for (const d of g.mobs.list) if (!(keep && d.kind.key === "pylon")) d.damage(1e9, null, false, d.center); }, keepPylons);
for (const [i, x, z, kind, obj] of rooms.slice(1)) {
  await go(x + 3, z + 3); await run(600);
  const s0 = await state(); console.log("sala", i, kind, obj, JSON.stringify(s0));
  if (obj) await shot(`sala${i}_${obj}_entrada`);
  if (obj === "eliminate") { const tp = await p.evaluate(() => { const d = window.__game.mobs.list.find((x) => x.group.children.some((c) => c.userData.mark)); return d ? [d.group.position.x, d.group.position.z] : null; }); if (tp) { await p.evaluate(([tx, tz, x, z]) => { const g = window.__game; g.player.yaw = Math.atan2(-(tx - (x + 3)), -(tz - (z + 3))); }, [tp[0], tp[1], x, z]); await run(200); await shot(`sala${i}_marcador`); } }
  if (obj === "hack") { await go(x, z + 6, 0); await run(300); await shot(`sala${i}_terminal`); await go(x, z - 1.5, 0); await run(800); await shot(`sala${i}_hack_dentro`); for (let k = 0; k < 40 && (await state())?.cur === "hack"; k++) { await run(1000); if (k % 3 === 2) await killAll(); } }
  if (obj === "destroy") { await killAll(true); await run(400); await shot(`sala${i}_generadores`); await killAll(); await run(300); }
  if (obj === "survive") for (let k = 0; k < 6 && (await state())?.cur === "survive"; k++) { await killAll(); await run(3200); }
  for (let k = 0; k < 8; k++) { await killAll(); await run(700); }
  if (obj === "retrieve") { await run(400); await shot(`sala${i}_nucleo`); await go(x, z); await run(400); }
  if (obj === "boss") { await run(300); }
  if (kind === "start") { await shot(`salida_antes`); await go(x, z); await run(500); }
  console.log("  tras", JSON.stringify(await state()));
}
await run(500); await shot("final");
const fin = await p.evaluate((LV) => { const g = window.__game; return { camp: g.camp.levels[LV], next: Object.keys(g.camp.levels), finalReward: g.camp.finalReward }; }, LV);
console.log(JSON.stringify({ fin, errs: errs.slice(0, 8) }));
await b.close();
