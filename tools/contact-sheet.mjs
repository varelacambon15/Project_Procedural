// Renderiza todas las armas del manifest en una hoja de contacto (vista lateral) para revisar orientación.
// Uso: node tools/contact-sheet.mjs [salida.png] [filtro]
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = createServer(async (req, res) => { try { const f = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname)); res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".html") ? "text/html" : "application/octet-stream" }); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
await writeFile(path.join(ROOT, "tools/convert/sheet.html"), `<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type="module">
import * as THREE from "three"; import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
window.sheet = async (filter) => {
  const man = await (await fetch("/assets/weapons/manifest.json")).json();
  const list = man.weapons.filter(w => !filter || w.file.includes(filter));
  const CW = 260, CH = 150, cols = 6, rows = Math.ceil(list.length / cols);
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(CW, CH); r.outputColorSpace = THREE.SRGBColorSpace;
  const out = document.createElement("canvas"); out.width = CW * cols; out.height = CH * rows; const g = out.getContext("2d");
  g.fillStyle = "#cfcac0"; g.fillRect(0, 0, out.width, out.height);
  const loader = new GLTFLoader();
  for (let i = 0; i < list.length; i++) {
    const w = list[i]; const gl = await loader.loadAsync("/assets/weapons/" + w.file);
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0xd8d3c8);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2)); const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(1, 2, 3); sc.add(d);
    sc.add(gl.scene);
    const b = new THREE.Box3().setFromObject(gl.scene), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10); const half = Math.max(s.x / 2 * CH / CW, s.y / 2) * 1.15;
    cam.left = -half * CW / CH; cam.right = half * CW / CH; cam.top = half; cam.bottom = -half; cam.position.set(c.x, c.y, c.z + 2); cam.lookAt(c); cam.updateProjectionMatrix();
    r.render(sc, cam); g.drawImage(r.domElement, (i % cols) * CW, Math.floor(i / cols) * CH);
    g.fillStyle = "#222"; g.font = "12px monospace"; g.fillText(w.id + "  " + w.type + "  " + s.x.toFixed(2) + "m", (i % cols) * CW + 6, Math.floor(i / cols) * CH + 14);
  }
  return out.toDataURL("image/png");
};
window.ready = true;</script>`);
const { chromium } = require("playwright");
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] }); const p = await b.newPage();
p.on("pageerror", (e) => console.error(e.message));
await p.goto(base + "/tools/convert/sheet.html"); await p.waitForFunction(() => window.ready);
const url = await p.evaluate((f) => window.sheet(f), process.argv[3] || "");
await writeFile(process.argv[2] || "sheet.png", Buffer.from(url.split(",")[1], "base64"));
await b.close(); server.close();
