// Convierte los packs de raw/ en assets/weapons/<pack>/<arma>.glb + assets/weapons/manifest.json
// Uso:  npm run assets            (convierte todo)
//       npm run assets -- --list raw/asimov-weapon-pack/Asimov_Weapon_Pack.fbx   (lista mallas de un FBX)
// Necesita Playwright con Chromium (preinstalado en el entorno de Claude Code).
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JOBS } from "./weapon-jobs.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".js": "text/javascript", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg" };

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) throw new Error("fuera de la raíz");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const html = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type="module" src="/tools/convert/convert.js"></script>`;
await writeFile(path.join(ROOT, "tools/convert/index.html"), html);

const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[navegador]", e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.error("[navegador]", m.text()); });
await page.goto(`${base}/tools/convert/index.html`);
await page.waitForFunction(() => window.ready === true);

const args = process.argv.slice(2);
if (args[0] === "--tree") {
  for (const f of args.slice(1)) console.log(f, JSON.stringify(await page.evaluate((u) => window.treeFBX(u), "/" + f)));
} else if (args[0] === "--list") {
  console.log(JSON.stringify(await page.evaluate((u) => window.listFBX(u), "/" + args[1]), null, 1));
} else {
  const only = args[0];
  const manifest = { convention: "metros; +X hacia la boca; +Y arriba; una malla por pieza con nombre de rol", weapons: [] };
  for (const job of JOBS) {
    if (only && !job.id.includes(only) && job.pack !== only) continue;
    const j = { ...job };
    for (const k of ["obj", "mtl", "fbx", "glb"]) if (j[k]) j[k] = "/" + j[k];
    const out = await page.evaluate((jj) => window.convertJob(jj), j);
    if (job.kind === "kitpart") {
      const dir = path.join(ROOT, "assets/weapons/kit"); await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, job.id + ".glb"), Buffer.from(out.glb, "base64")); delete out.glb;
      (manifest.kit ??= []).push({ ...out, file: `kit/${job.id}.glb` });
      console.log(`✓ kit/${job.id}.glb ${out.slot} ${out.caliber} ${Object.keys(out.sockets).join(",")}`);
      continue;
    }
    const dir = path.join(ROOT, "assets/weapons", job.pack);
    await mkdir(dir, { recursive: true });
    const rel = `${job.pack}/${job.id}.glb`;
    await writeFile(path.join(ROOT, "assets/weapons", rel), Buffer.from(out.glb, "base64"));
    delete out.glb;
    const entry = { ...out, file: rel, label: job.label || job.id };
    if (job.quarantine) { entry.quarantine = job.quarantine; entry.approved = []; }
    if (job.excluded) entry.excluded = job.excluded;
    manifest.weapons.push(entry);
    console.log(`✓ ${rel.padEnd(52)} ${String(out.triangles).padStart(6)} tris  ${out.parts.map((p) => p.role).join(",")}`);
  }
  // Conversión parcial: se actualizan solo esas entradas del manifest existente, conservando el orden.
  let out = manifest;
  if (only) {
    const old = JSON.parse(await readFile(path.join(ROOT, "assets/weapons/manifest.json"), "utf8"));
    const fresh = new Map(manifest.weapons.map((w) => [w.id, w]));
    out = { ...old, weapons: old.weapons.map((w) => fresh.get(w.id) ?? w) };
    for (const w of manifest.weapons) if (!old.weapons.some((o) => o.id === w.id)) out.weapons.push(w);
    if (manifest.kit) out.kit = [...(old.kit ?? []).filter((k) => !manifest.kit.some((n) => n.id === k.id)), ...manifest.kit];
  }
  await writeFile(path.join(ROOT, "assets/weapons/manifest.json"), JSON.stringify(out, null, 1));
}
await browser.close();
server.close();
