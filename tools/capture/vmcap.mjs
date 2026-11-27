// Capturas SECUENCIALES del arma en primera persona (tarea 13). Para cada clase y arma real (semilla + accesorios),
// ejecuta cada acción con un paso de tiempo fijo y guarda ≥16 fotogramas, a 960×470 y 1280×720, más las anclas
// medidas en pantalla (empuñadura, boca, manos) y una hoja de contactos por arma y acción.
//
// Requisitos: servidor de desarrollo en marcha (`npm run dev`, puerto 5199) y Playwright (`npx playwright`).
// Uso:
//   node tools/capture/vmcap.mjs --classes pistol,revolver --actions idle,fire,draw,reload,reloadEmpty,inspect,ads
//        [--sizes 960x470,1280x720] [--frames 16] [--per 2] [--out docs/capturas/armas] [--names "JPV-904,Ox 586"]
// Salida: <out>/<clase>/<arma>/<tamaño>/<acción>_NN.png, <out>/<clase>/<arma>/<tamaño>/<acción>.json (anclas por
// fotograma) y <out>/hojas/<clase>_<arma>_<acción>.png (fotogramas de los dos tamaños, en orden).
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
// (Playwright puede estar instalado fuera del proyecto: se resuelve con require, que respeta NODE_PATH)
const { chromium } = createRequire(import.meta.url)("playwright");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://localhost:5199/");
const CLASSES = arg("classes", "pistol,revolver").split(",");
const ACTIONS = arg("actions", "idle,fire,draw,reload,reloadEmpty,inspect,ads").split(",");
const SIZES = arg("sizes", "960x470,1280x720").split(",").map((s) => s.split("x").map(Number));
const FRAMES = Number(arg("frames", 16)); // (16 o más para evaluar una acción; menos solo para barridos de reposo)
const PER = Number(arg("per", 2));
const OUT = arg("out", "docs/capturas/armas");
const NAMES = (arg("names", "") || "").split(",").filter(Boolean);
const SEEDS = (arg("seeds", "") || "").split(",").filter(Boolean).map((s) => s.split(":")); // clase:semilla
/** Zona de cada fotograma que se ve en la hoja (fracciones x0,y0,x1,y1): por defecto, donde vive el arma. */
const CROP = arg("crop", "0.2,0.12,1,1").split(",").map(Number);

/** Duración (s) de cada acción y cómo se dispara; el arma se deja en reposo antes de cada una. */
const ACTION = {
  idle: { dur: 2.0 },
  fire: { dur: 0.6 },
  burst: { dur: 1.0 },
  draw: { dur: 0 },     // (la del arma: equipDur)
  reload: { dur: 0 },   // (la del arma: reloadDur)
  reloadEmpty: { dur: 0 },
  inspect: { dur: 2.6 },
  ads: { dur: 1.2 },    // entrar (0,6 s) y salir (0,6 s)
  sprint: { dur: 1.2 },
  walk: { dur: 1.2 },
};

async function boot(page) {
  await page.goto(URL_);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__game;
    g.newGame(); g.start.close(); g.state = "play";
    g.debug.manual = true; g.debug.noDraw = true;
    // Fuera HUD y menús: solo el lienzo
    const st = document.createElement("style");
    st.textContent = "body > *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}";
    document.head.appendChild(st);
    g.player.pos.set(0, 0, 6); g.player.yaw = Math.PI; g.player.pitch = -0.05;
    for (let i = 0; i < 30; i++) g.step(1 / 60);
    g.debug.noDraw = false;
  });
}

/** Busca armas de una clase: una sin accesorios (común) y otras con accesorios/óptica, o por nombre. */
async function pickWeapons(page, cls) {
  return page.evaluate(({ cls, per, names, seeds }) => {
    const g = window.__game, out = [];
    for (const [c, s] of seeds) if (c === cls) out.push(g.gen.generate(Number(s), cls));
    if (out.length) return out;
    for (const n of names) {
      for (let s = 0; s < 40000; s++) { const w = g.gen.generate(s, cls); if (w.name.includes(n)) { out.push(w); break; } }
    }
    const nostock = (w) => !(w.tweaks?.pstock && !w.tweaks?.nostock);
    const want = [(w) => w.rarity.id === "comun" && !w.optic && nostock(w), (w) => !!w.optic && nostock(w), (w) => w.rarity.id === "legendaria", (w) => w.rarity.id === "epica" && !!w.muzzle];
    for (const f of want) {
      if (out.length >= per + names.length) break;
      for (let s = 1; s < 600; s++) { const w = g.gen.generate(s * 7 + 3, cls); if (f(w) && !out.some((o) => o.parts[0].from === w.parts[0].from)) { out.push(w); break; } }
    }
    return out;
  }, { cls, per: PER, names: NAMES, seeds: SEEDS });
}

async function equip(page, spec) {
  await page.evaluate(async (spec) => {
    const g = window.__game;
    const it = { uid: 700000 + Math.floor(Math.random() * 99999), spec, ammo: spec.stats.cargador };
    g.inv.equip[0] = it; g.inv.equip[1] = null; g.inv.active = 0;
    g.gun.pending = null; g.gun.holsterT = 0; g.gun.model = null;
    await g.gun.equip(it, true);
    for (let i = 0; i < 400 && !g.gun.model; i++) await new Promise((r) => setTimeout(r, 25));
    g.debug.fire = false; g.debug.aim = false; g.debug.noDraw = true;
    for (let i = 0; i < 120; i++) g.step(1 / 60); // asentado
    g.debug.noDraw = false;
  }, spec);
}

/** Anclas en pantalla (fracciones 0..1) medidas con la cámara del viewmodel. */
const MEASURE = () => {
  const g = window.__game, gun = g.gun, m = gun.model; if (!m) return null;
  const cam = gun.camera, vm = cam.children.find((c) => c.isPerspectiveCamera);
  const V = cam.position.constructor;
  m.group.updateMatrixWorld(true); vm.updateMatrixWorld(true);
  const pr = (x, y, z) => { const v = new V(x, y, z).applyMatrix4(m.group.matrixWorld).project(vm); return [+(0.5 + v.x / 2).toFixed(3), +(0.5 - v.y / 2).toFixed(3)]; };
  const b = { x0: 1, x1: 0, y0: 1, y1: 0 };
  m.group.traverse((o) => { if (!o.isMesh || !o.visible) return; const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i += 7) { const v = new V().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(vm); const x = 0.5 + v.x / 2, y = 0.5 - v.y / 2; b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); } });
  const h = m.handles;
  return { grip: pr(h.grip.x, h.grip.y, h.grip.z), muzzle: pr(m.muzzle.x, m.muzzle.y, m.muzzle.z), box: [b.x0, b.y0, b.x1, b.y1].map((v) => +v.toFixed(3)), phase: gun.reloadPhase?.id ?? null, scale: +gun.vmFit.scale.toFixed(3), depth: gun.hipSol ? +gun.hipSol.depth.toFixed(3) : null, bulk: m.height ? +m.height.toFixed(3) : null };
};

async function runAction(page, act, dir, size) {
  // Preparación según la acción; devuelve la duración real
  const dur = await page.evaluate((act) => {
    const g = window.__game, gun = g.gun, it = gun.item;
    g.debug.fire = false; g.debug.aim = false; gun.inspectT = 0; gun.reloadT = 0; g.debug.noDraw = true;
    for (let i = 0; i < 90; i++) g.step(1 / 60);
    g.debug.noDraw = false;
    if (act === "fire" || act === "burst") { it.ammo = it.spec.stats.cargador; g.debug.fire = true; g.step(1 / 60); if (act === "fire") g.debug.fire = false; return act === "fire" ? 0.6 : 1.0; }
    if (act === "draw") { gun.equipT = gun.equipDur; return gun.equipDur + 0.25; }
    if (act === "reload") { it.ammo = Math.max(1, Math.floor(it.spec.stats.cargador / 3)); gun.startReload(); return gun.reloadDur + 0.3; }
    if (act === "reloadEmpty") { it.ammo = 0; gun.startReload(); return gun.reloadDur + 0.3; }
    if (act === "inspect") { gun.inspectT = 2.6; return 2.8; }
    if (act === "ads") { g.debug.aim = true; return 1.2; }
    return 2.0;
  }, act);
  const rows = [];
  const n = FRAMES, sub = Math.max(1, Math.round((dur / n) * 60));
  for (let f = 0; f < n; f++) {
    const info = await page.evaluate(({ act, f, n, sub }) => {
      const g = window.__game;
      for (let i = 0; i < sub; i++) {
        if (act === "ads" && f >= n / 2) g.debug.aim = false;
        g.debug.noDraw = i < sub - 1; // (solo se dibuja el fotograma que se captura)
        g.step(1 / 60);
      }
      g.debug.noDraw = false;
      return null;
    }, { act, f, n, sub });
    const m = await page.evaluate(MEASURE);
    rows.push({ f, t: +((f + 1) * sub / 60).toFixed(3), ...m });
    await page.screenshot({ path: path.join(dir, `${act}_${String(f).padStart(2, "0")}.png`) });
  }
  await page.evaluate(() => { const g = window.__game; g.debug.fire = false; g.debug.aim = false; });
  await writeFile(path.join(dir, `${act}.json`), JSON.stringify(rows, null, 1));
  return rows;
}

/** Hoja de contactos: fotogramas en orden, con guías (centro, zona de referencia de boca y empuñadura). */
async function sheet(browser, tiles, title, file) {
  const page = await browser.newPage({ viewport: { width: 1800, height: 800 } });
  const { readFile } = await import("node:fs/promises");
  const imgs = await Promise.all(tiles.map(async (t) => ({ ...t, b64: (await readFile(t.file)).toString("base64") })));
  await page.setContent(`<html><body style="margin:0;background:#1b1d21;color:#ddd;font:13px sans-serif">
  <div style="padding:6px 10px;font-weight:bold">${title}</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:4px">
  ${imgs.map((t) => { const [x0, y0, x1, y1] = CROP, cw = x1 - x0, ch = y1 - y0; return `<div style="position:relative;overflow:hidden;aspect-ratio:${(cw * t.w) / (ch * t.h)}"><img src="data:image/png;base64,${t.b64}" style="position:absolute;left:${(-x0 / cw) * 100}%;top:${(-y0 / ch) * 100}%;width:${100 / cw}%;height:${100 / ch}%">
    <div style="position:absolute;left:${((0.5 - x0) / cw) * 100}%;top:${((0.5 - y0) / ch) * 100}%;width:6px;height:6px;margin:-3px;border:1px solid #f0f"></div>
    <div style="position:absolute;left:2px;top:1px;font-size:11px;background:#000a;padding:0 3px">${t.label}</div></div>`; }).join("")}
  </div></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 1800, height: h });
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const results = {};
for (const [W, H] of SIZES) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));
  await boot(page);
  for (const cls of CLASSES) {
    const weapons = await pickWeapons(page, cls);
    for (const spec of weapons) {
      const slug = `${spec.name}`.replace(/[^A-Za-z0-9-]+/g, "_") + "_s" + spec.seed;
      await equip(page, spec);
      for (const act of ACTIONS) {
        const dir = path.join(OUT, cls, slug, `${W}x${H}`);
        await mkdir(dir, { recursive: true });
        const rows = await runAction(page, act, dir, [W, H]);
        (results[`${cls}/${slug}/${act}`] ??= { cls, slug, act, name: spec.name, optic: spec.optic ?? null, rarity: spec.rarity.id, sizes: {} }).sizes[`${W}x${H}`] = rows;
        console.log(`${W}x${H} ${cls} ${spec.name} ${act}: ${rows.length} fotogramas; reposo boca ${JSON.stringify(rows[0]?.muzzle)} empuñadura ${JSON.stringify(rows[0]?.grip)} distancia ${rows[0]?.depth} grosor ${rows[0]?.bulk}`);
      }
    }
  }
  await page.close();
}
await mkdir(path.join(OUT, "hojas"), { recursive: true });
for (const r of Object.values(results)) {
  const tiles = [];
  for (const [sz, rows] of Object.entries(r.sizes)) for (const row of rows) tiles.push({ w: Number(sz.split("x")[0]), h: Number(sz.split("x")[1]), file: path.join(OUT, r.cls, r.slug, sz, `${r.act}_${String(row.f).padStart(2, "0")}.png`), label: `${sz} ${row.t}s${row.phase ? " " + row.phase : ""}` });
  await sheet(browser, tiles, `${r.cls} · ${r.name} (${r.rarity}${r.optic ? ", " + r.optic : ""}) · ${r.act}`, path.join(OUT, "hojas", `${r.cls}_${r.slug}_${r.act}.png`));
}
await writeFile(path.join(OUT, "anclas.json"), JSON.stringify(results));
await browser.close();
console.log("hecho:", Object.keys(results).length, "secuencias");
