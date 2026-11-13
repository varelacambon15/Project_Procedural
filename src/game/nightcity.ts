// Campo de tiro de noche: callejón urbano de ciudad nocturna (estética propia, pixelada). Cielo verde azulado con luna
// y estrellas, edificios con ventanas encendidas detrás de los muros, muros de ladrillo sucio, asfalto mojado con
// charcos, rótulos de neón sueltos (cada uno con su luz y su reflejo en el suelo), cables, aparatos de aire,
// tuberías, carteles pegados, bolsas de basura, bolardos y cuervos. Todo por código; solo se ve de noche.
import * as THREE from "three";

export interface NightCity {
  group: THREE.Group;
  /** Texturas de muro y suelo de noche. */
  wallMap: THREE.Texture; floorMap: THREE.Texture;
  /** Puntos de luz de los rótulos (las luces de la sala se recolocan aquí de noche). */
  spots: { pos: THREE.Vector3; color: number; power: number }[];
  /** Las 8 que llevan luz real (repartidas por la sala; el resto solo tiene halo pintado, sin coste de luz). */
  keyLights: { pos: THREE.Vector3; color: number; power: number }[];
  update(dt: number): void;
}

/** Generador pseudoaleatorio con semilla (la ciudad sale siempre igual). */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number], smooth = false) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (!smooth) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; }
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

const NEON = { red: 0xff3a6a, pink: 0xff4fc8, cyan: 0x6ab8ff, amber: 0xffd060, green: 0xff7ae0, violet: 0xb07aff };

export function buildNightCity(scene: THREE.Scene, d: { W: number; FRONT: number; BACK: number; H: number }): NightCity {
  const { W, FRONT, BACK, H } = d;
  const r = rng(20261113);
  const g = new THREE.Group(); g.name = "nightcity"; scene.add(g);
  const spots: NightCity["spots"] = [];
  const flickers: { m: THREE.MeshBasicMaterial; base: number; ph: number; rate: number }[] = [];
  // Halo pintado (gradiente radial aditivo): simula la luz de un neón o una farola sin luz real
  const haloTex = canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.35, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); }, undefined, true);
  const halo = (pos: THREE.Vector3, color: number, size: number, opacity: number, rotX = 0, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: haloTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); m.rotation.set(rotX, rotY, 0, "YXZ"); g.add(m); return m;
  };

  // ---------- Texturas ----------
  // Ladrillo sucio verde azulado, con churretes, manchas de humedad y algún desconchón
  const wallMap = canvasTex(64, 64, (c) => {
    c.fillStyle = "#2a1c1c"; c.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < 64; x += 16) {
      const v = 46 + Math.floor(r() * 22); c.fillStyle = `rgb(${v + 22},${v - 4},${v - 8})`; c.fillRect(x + 1, y + 1, 15, 7);
    }
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(0,0,0,${r() * 0.25})`; c.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 1); }
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 64), l = 8 + Math.floor(r() * 30); c.fillStyle = "rgba(14,8,10,0.4)"; c.fillRect(x, 0, 2, l); }
    c.fillStyle = "rgba(20,14,18,0.35)"; c.fillRect(Math.floor(r() * 40), 40 + Math.floor(r() * 16), 18, 8);
  }, [W / 3, 1.2]);
  // Asfalto oscuro con grietas, juntas y manchas
  const floorMap = canvasTex(64, 64, (c) => {
    c.fillStyle = "#24222a"; c.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 700; i++) { const v = Math.floor(r() * 40); c.fillStyle = `rgba(${v + 38},${v + 34},${v + 44},${0.25 + r() * 0.3})`; c.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 1); }
    c.strokeStyle = "rgba(4,8,10,0.7)"; c.lineWidth = 1;
    for (let k = 0; k < 3; k++) { c.beginPath(); let x = r() * 64, y = r() * 64; c.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 16; y += (r() - 0.5) * 16; c.lineTo(x, y); } c.stroke(); }
    c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(0, 0, 64, 1); c.fillRect(0, 0, 1, 64);
  }, [W / 4, (BACK - FRONT) / 4]);

  // ---------- Cielo, estrellas y luna ----------
  const skyTex = canvasTex(4, 128, (c) => {
    const gr = c.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "#07061a"); gr.addColorStop(0.45, "#151338"); gr.addColorStop(0.62, "#2a2150"); gr.addColorStop(1, "#3a2a58");
    c.fillStyle = gr; c.fillRect(0, 0, 4, 128);
  }, undefined, true);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; g.add(sky);
  const starPos: number[] = [];
  for (let i = 0; i < 500; i++) { const th = r() * Math.PI * 2, ph = 0.15 + r() * 1.2; starPos.push(Math.cos(th) * Math.cos(ph) * 225, Math.sin(ph) * 225, Math.sin(th) * Math.cos(ph) * 225); }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3)), new THREE.PointsMaterial({ color: 0xd8d0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  g.add(stars);
  const moonTex = canvasTex(64, 64, (c) => {
    const gl = c.createRadialGradient(32, 32, 10, 32, 32, 32); gl.addColorStop(0, "rgba(160,200,230,0.35)"); gl.addColorStop(1, "rgba(160,200,230,0)"); c.fillStyle = gl; c.fillRect(0, 0, 64, 64);
    c.fillStyle = "#b9cfe0"; c.beginPath(); c.arc(32, 32, 17, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#8aa3bb"; for (const [x, y, rr] of [[26, 27, 4], [37, 35, 5], [30, 40, 3], [39, 25, 2.5], [24, 36, 2]]) { c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = "rgba(10,20,40,0.35)"; c.beginPath(); c.arc(38, 30, 17, 0, Math.PI * 2); c.fill();
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  moon.position.set(25, 70, -200); moon.scale.setScalar(0.6); moon.lookAt(0, 0, 0); moon.renderOrder = -9; g.add(moon);

  // ---------- Edificios del fondo (ventanas encendidas) ----------
  const windowsTex = () => canvasTex(16, 32, (c) => {
    c.fillStyle = "#000"; c.fillRect(0, 0, 16, 32);
    const pal = ["#e8e2ff", "#c8c0ff", "#ffd890", "#ff8ad0", "#ffffff"];
    for (let y = 1; y < 32; y += 3) for (let x = 1; x < 16; x += 3) if (r() < 0.11) { c.fillStyle = pal[Math.floor(r() * (r() < 0.75 ? 2 : pal.length))]; c.fillRect(x, y, 2, 2); }
  });
  const facade = canvasTex(16, 16, (c) => { c.fillStyle = "#14112a"; c.fillRect(0, 0, 16, 16); for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(60,50,90,${r() * 0.4})`; c.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); } });
  const wins = [windowsTex(), windowsTex(), windowsTex()];
  const building = (x: number, z: number, w: number, dpt: number, h: number) => {
    const em = wins[Math.floor(r() * wins.length)].clone(); em.needsUpdate = true; em.wrapS = em.wrapT = THREE.RepeatWrapping; em.repeat.set(Math.max(1, w / 2.2), Math.max(1, h / 4.5));
    const fm = facade.clone(); fm.needsUpdate = true; fm.wrapS = fm.wrapT = THREE.RepeatWrapping; fm.repeat.set(w / 4, h / 4);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), new THREE.MeshLambertMaterial({ map: fm, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0.55 }));
    m.position.set(x, h / 2, z); g.add(m);
    // Remate del tejado: depósito, antena o caja de máquinas
    const k = r();
    if (k < 0.4) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 8), new THREE.MeshLambertMaterial({ color: 0x100e1e })); t.position.set(x + (r() - 0.5) * w * 0.5, h + 1.1, z); g.add(t); }
    else if (k < 0.7) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.15, 6, 0.15), new THREE.MeshLambertMaterial({ color: 0x0c1418 })); a.position.set(x, h + 3, z); g.add(a); const blink = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: NEON.red })); blink.position.set(x, h + 6, z); g.add(blink); }
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 2, dpt * 0.4), new THREE.MeshLambertMaterial({ color: 0x0b1316 })); b.position.set(x, h + 1, z); g.add(b); }
    // Algún rótulo vertical en la fachada
    if (r() < 0.35 && h > 18) {
      const col = Object.values(NEON)[Math.floor(r() * 6)];
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 1.4), new THREE.MeshBasicMaterial({ color: col }));
      s.position.set(x + (x > 0 ? -w / 2 - 0.3 : w / 2 + 0.3), h * (0.4 + r() * 0.3), z + (r() - 0.5) * dpt * 0.5); g.add(s);
    }
  };
  // (sin edificios alrededor: lo que cuenta es el tono y la luz del callejón; queda la función por si se quieren a lo lejos)
  void building;

  // ---------- Rótulos de neón en los muros del callejón ----------
  // Texto propio (palabras genéricas de una galería de tiro y de la calle), dibujado con halo; detrás, una chapa oscura
  const neonSign = (lines: string[], color: number, at: THREE.Vector3, facing: number, vertical: boolean, size = 1) => {
    const hex = "#" + color.toString(16).padStart(6, "0");
    const cw = vertical ? 32 : 32 + 16 * Math.max(...lines.map((l) => l.length)), ch = vertical ? 32 * lines[0].length + 8 : 26 * lines.length + 8;
    const tex = canvasTex(cw, ch, (c) => {
      c.clearRect(0, 0, cw, ch); c.strokeStyle = hex; c.fillStyle = hex; c.shadowColor = hex; c.shadowBlur = 6;
      c.lineWidth = 2; c.strokeRect(3, 3, cw - 6, ch - 6);
      c.font = "bold 22px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      if (vertical) [...lines[0]].forEach((chr, i) => c.fillText(chr, cw / 2, 20 + i * 32));
      else lines.forEach((l, i) => c.fillText(l, cw / 2, 17 + i * 26));
    }, undefined, true);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    const sw = (cw / 32) * 0.55 * size, sh = (ch / 32) * 0.55 * size;
    const back = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.1, sh + 0.1, 0.08), new THREE.MeshLambertMaterial({ color: 0x0b1114 }));
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat); plane.position.z = 0.05;
    const holder = new THREE.Group(); holder.add(back, plane); holder.position.copy(at); holder.rotation.y = facing; g.add(holder);
    flickers.push({ m: mat, base: 1, ph: r() * 10, rate: 0.2 + r() * 0.5 });
    // Luz y reflejo en el suelo mojado (mancha alargada del mismo color)
    const normal = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    spots.push({ pos: at.clone().addScaledVector(normal, 1.2), color, power: 10 + sh * 4 });
    halo(at.clone().addScaledVector(normal, 0.03), color, Math.max(sw, sh) * 2.0, 0.2, 0, facing);            // resplandor en el muro
    const foot = at.clone().addScaledVector(normal, 1.6); foot.y = 0.025; halo(foot, color, 3 + sh * 1.5, 0.3, -Math.PI / 2); // charco de luz en el suelo
    const refl = canvasTex(16, 64, (c) => { const gr = c.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; for (let y = 0; y < 64; y += 2) c.fillRect(4 + Math.floor(r() * 3), y, 8 - Math.floor(r() * 3), 1); }, undefined, true);
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(sw * 0.9, 2.2 + sh), new THREE.MeshBasicMaterial({ map: refl, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    rm.rotation.x = -Math.PI / 2; rm.rotation.z = facing; rm.position.copy(at).addScaledVector(normal, 1.2 + sh * 0.3); rm.position.y = 0.02; g.add(rm);
  };
  const L = -W / 2 + 0.12, R = W / 2 - 0.12;
  neonSign(["射撃場"], NEON.red, new THREE.Vector3(L, 4.6, -9), Math.PI / 2, true, 1.3);
  neonSign(["AMMO", "24H"], NEON.pink, new THREE.Vector3(R, 3.6, -14), -Math.PI / 2, false);
  neonSign(["BAR"], NEON.pink, new THREE.Vector3(L, 3.2, -24), Math.PI / 2, false, 1.2);
  neonSign(["弾"], NEON.red, new THREE.Vector3(R, 5.2, -30), -Math.PI / 2, true, 1.6);
  neonSign(["HOTEL"], NEON.violet, new THREE.Vector3(L, 5.4, -40), Math.PI / 2, false);
  neonSign(["夜"], NEON.green, new THREE.Vector3(R, 4.4, -46), -Math.PI / 2, true, 1.4);
  neonSign(["OPEN"], NEON.red, new THREE.Vector3(-6, 4.8, FRONT + 0.12), 0, false, 1.4);
  neonSign(["RANGE"], NEON.amber, new THREE.Vector3(7, 3.6, FRONT + 0.12), 0, false, 1.2);
  neonSign(["KEEP OUT"], NEON.amber, new THREE.Vector3(L, 3.4, 9), Math.PI / 2, false, 0.9);
  // Pared de la zona de equipo (detrás del jugador al empezar)
  neonSign(["ARMORY"], NEON.pink, new THREE.Vector3(-9, 4.6, BACK - 0.12), Math.PI, false, 1.3);
  neonSign(["修理"], NEON.amber, new THREE.Vector3(9, 4.2, BACK - 0.12), Math.PI, true, 1.2);
  neonSign(["NO", "REFUNDS"], NEON.violet, new THREE.Vector3(0, 5.2, BACK - 0.12), Math.PI, false, 0.9);
  neonSign(["工房"], NEON.pink, new THREE.Vector3(R, 4.4, 10), -Math.PI / 2, true, 1.1);

  // ---------- Detalles del callejón ----------
  const dark = new THREE.MeshLambertMaterial({ color: 0x141c1f }), metal = new THREE.MeshStandardMaterial({ color: 0x2a3438, metalness: 0.6, roughness: 0.5 });
  const add = (m: THREE.Object3D) => { g.add(m); return m; };
  // Aparatos de aire acondicionado con su rejilla, en lo alto de los muros
  const grill = canvasTex(8, 8, (c) => { c.fillStyle = "#26302f"; c.fillRect(0, 0, 8, 8); c.fillStyle = "#0e1414"; for (let y = 1; y < 8; y += 2) c.fillRect(1, y, 6, 1); });
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1, z = BACK - 6 - r() * (BACK - FRONT - 10);
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.9), new THREE.MeshLambertMaterial({ map: grill }));
    ac.position.set(side * (W / 2 - 0.45), 4.2 + r() * 2.2, z); add(ac);
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.9), metal); br.position.copy(ac.position).add(new THREE.Vector3(0, -0.33, 0)); add(br);
  }
  // Tuberías verticales y bajantes
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, z = BACK - 2 - r() * (BACK - FRONT - 4), rr = 0.05 + r() * 0.05;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, H, 8), metal); p.position.set(side * (W / 2 - 0.12 - rr), H / 2, z); add(p);
    for (let y = 1; y < H; y += 1.8) { const cl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.12), dark); cl.position.set(p.position.x, y, z); add(cl); }
  }
  // Cables colgando de muro a muro (catenaria)
  for (let i = 0; i < 9; i++) {
    const z = BACK - 3 - r() * (BACK - FRONT - 8), y = H - 0.3 - r() * 1.2, sag = 0.6 + r() * 1.2;
    const pts = Array.from({ length: 13 }, (_, k) => { const t = k / 12; return new THREE.Vector3(-W / 2 + t * W, y - sag * 4 * t * (1 - t), z + (r() - 0.5) * 0.2); });
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 4), new THREE.MeshBasicMaterial({ color: 0x05080a })));
  }
  // Carteles pegados y pintadas (planos sobre los muros)
  const poster = () => canvasTex(16, 24, (c) => {
    const pal = ["#c23b4a", "#2c8a8a", "#d2a040", "#6a4aa0", "#c8c8b0"]; c.fillStyle = pal[Math.floor(r() * pal.length)]; c.fillRect(0, 0, 16, 24);
    c.fillStyle = "rgba(0,0,0,0.45)"; for (let y = 3; y < 22; y += 4) c.fillRect(2, y, 6 + Math.floor(r() * 7), 2);
    c.clearRect(Math.floor(r() * 12), 18 + Math.floor(r() * 5), 6, 6); // esquina rota
  });
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1, z = BACK - 4 - r() * (BACK - FRONT - 8);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.05), new THREE.MeshLambertMaterial({ map: poster(), transparent: true }));
    pm.position.set(side * (W / 2 - 0.02), 1.4 + r() * 1.6, z); pm.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; pm.rotation.z = (r() - 0.5) * 0.12; add(pm);
  }
  const tag = () => canvasTex(48, 24, (c) => {
    c.clearRect(0, 0, 48, 24); const pal = ["#e8e8e8", "#7fe0d0", "#e05a8a", "#e0c050"]; c.strokeStyle = pal[Math.floor(r() * pal.length)]; c.lineWidth = 2;
    c.beginPath(); let x = 4, y = 12; c.moveTo(x, y); for (let k = 0; k < 14; k++) { x += 3; y = 6 + r() * 12; c.lineTo(x, y); } c.stroke();
    c.lineWidth = 1; c.beginPath(); c.moveTo(4, 20); c.lineTo(44, 19); c.stroke();
  });
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, z = BACK - 8 - r() * (BACK - FRONT - 14);
    const tm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshLambertMaterial({ map: tag(), transparent: true }));
    tm.position.set(side * (W / 2 - 0.03), 0.9 + r() * 0.6, z); tm.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; add(tm);
  }
  // Bolsas de basura y cajas junto a los muros
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, z = BACK - 3 - r() * (BACK - FRONT - 6);
    if (r() < 0.6) { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + r() * 0.2, 0), new THREE.MeshStandardMaterial({ color: 0x0b0f12, roughness: 0.25, metalness: 0.1 })); b.scale.y = 0.7; b.position.set(side * (W / 2 - 0.6 - r() * 0.4), 0.22, z); b.rotation.y = r() * 3; add(b); }
    else { const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), new THREE.MeshLambertMaterial({ color: 0x2a2620 })); c.position.set(side * (W / 2 - 0.6), 0.3, z); c.rotation.y = r() * 0.6; add(c); }
  }
  // Bolardos a lo largo de los muros, con franja reflectante
  const stripe = new THREE.MeshStandardMaterial({ color: 0xcfd6c8, roughness: 0.3, emissive: 0x404840, emissiveIntensity: 0.4 });
  for (let z = BACK - 4; z > FRONT + 4; z -= 7) for (const side of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.9, 8), metal); b.position.set(side * (W / 2 - 1.5), 0.45, z); add(b);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 8), stripe); s.position.set(b.position.x, 0.75, z); add(s);
  }
  // Charcos: planos muy lisos y algo metálicos (recogen los brillos de las luces)
  const puddle = new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.05, metalness: 0.85 });
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.6 + r() * 1.4, 10), puddle); p.rotation.x = -Math.PI / 2; p.scale.set(1, 0.5 + r() * 0.6, 1);
    p.position.set((r() - 0.5) * (W - 6), 0.011, BACK - 2 - r() * (BACK - FRONT - 6)); add(p);
  }
  // Cuervos: siluetas sencillas posadas en lo alto de los muros y en algún bolardo
  const crowMat = new THREE.MeshLambertMaterial({ color: 0x050607 });
  const crow = (x: number, y: number, z: number, rot: number) => {
    const c = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.3), crowMat); body.position.y = 0.1; body.rotation.x = -0.35; c.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), crowMat); head.position.set(0, 0.22, -0.13); c.add(head);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.08), crowMat); beak.position.set(0, 0.21, -0.21); c.add(beak);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.16), crowMat); tail.position.set(0, 0.05, 0.2); tail.rotation.x = 0.4; c.add(tail);
    c.position.set(x, y, z); c.rotation.y = rot; add(c);
  };
  for (let i = 0; i < 7; i++) crow((i % 2 ? 1 : -1) * (W / 2 + 0.1), H + 0.01, BACK - 6 - r() * (BACK - FRONT - 12), (r() - 0.5) * 2);
  crow(-(W / 2 - 1.5), 0.92, BACK - 11, 0.8); crow(W / 2 - 1.5, 0.92, BACK - 25, -0.5);
  // Farolas de vapor de sodio en lo alto de los muros (brazo, cabeza y su luz anaranjada)
  for (const [x, z] of [[-W / 2 + 0.2, -4], [W / 2 - 0.2, -20], [-W / 2 + 0.2, -36], [W / 2 - 0.2, -52], [W / 2 - 0.2, 6], [-W / 2 + 0.2, 14], [W / 2 - 0.2, 16]] as [number, number][]) {
    const s = Math.sign(-x);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.07), metal); arm.position.set(x + s * 0.7, H - 0.6, z); add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), new THREE.MeshBasicMaterial({ color: 0xffb060 })); head.position.set(x + s * 1.35, H - 0.68, z); add(head);
    spots.push({ pos: new THREE.Vector3(x + s * 1.35, H - 1.0, z), color: 0xff9a40, power: 26 });
    halo(new THREE.Vector3(x + s * 1.6, 0.03, z), 0xff9a40, 7, 0.28, -Math.PI / 2);
  }

  // ---------- Más calle: persianas metálicas, valla al fondo, andamio, rejilla de desagüe, alcantarilla y foco ----------
  const shutterTex = canvasTex(16, 32, (c) => { c.fillStyle = "#4a3a3e"; c.fillRect(0, 0, 16, 32); for (let y = 0; y < 32; y += 2) { c.fillStyle = "#2c2226"; c.fillRect(0, y, 16, 1); } for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(140,90,70,${r() * 0.4})`; c.fillRect(Math.floor(r() * 16), Math.floor(r() * 32), 1, 1); } });
  for (const [side, z] of [[-1, -6], [1, -18], [-1, -31], [1, -42], [-1, 14]] as [number, number][]) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.8), new THREE.MeshLambertMaterial({ map: shutterTex }));
    sh.position.set(side * (W / 2 - 0.03), 1.4, z); sh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; add(sh);
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 2.8), metal); box2.position.set(side * (W / 2 - 0.12), 2.95, z); add(box2);
  }
  // Valla de malla delante del muro del fondo, con tablones cruzados
  const meshTex = canvasTex(16, 16, (c) => { c.clearRect(0, 0, 16, 16); c.strokeStyle = "#8a8a96"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(16, 16); c.moveTo(16, 0); c.lineTo(0, 16); c.stroke(); }, [W / 1.2, 3]);
  const fence = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, 3.6), new THREE.MeshLambertMaterial({ map: meshTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
  fence.position.set(0, 1.8, FRONT + 2.2); add(fence);
  for (let x = -W / 2 + 1; x <= W / 2 - 1; x += 4) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.7, 6), metal); post.position.set(x, 1.85, FRONT + 2.2); add(post); }
  for (let i = 0; i < 5; i++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.04), new THREE.MeshLambertMaterial({ color: 0x5a3a28 })); pl.position.set(-14 + i * 7 + r() * 2, 0.8 + r() * 1.6, FRONT + 2.1); pl.rotation.z = (r() - 0.5) * 0.6; add(pl); }
  // Andamio de tubos en un tramo del muro derecho
  const scaf = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.7, roughness: 0.45 });
  for (let z = -8; z >= -20; z -= 3) for (const x of [W / 2 - 0.3, W / 2 - 1.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, H - 0.6, 6), scaf); p.position.set(x, (H - 0.6) / 2, z); add(p); }
  for (let y = 1.6; y < H - 0.5; y += 1.7) {
    for (const x of [W / 2 - 0.3, W / 2 - 1.5]) { const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 12.2, 6), scaf); rl.rotation.x = Math.PI / 2; rl.position.set(x, y, -14); add(rl); }
    for (let z = -8; z >= -20; z -= 3) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 6), scaf); tr.rotation.z = Math.PI / 2; tr.position.set(W / 2 - 0.9, y, z); add(tr); }
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 12), new THREE.MeshLambertMaterial({ color: 0x3a2a22 })); plank.position.set(W / 2 - 0.9, y + 0.05, -14); add(plank);
  }
  // Rejilla de desagüe de lado a lado (detrás de la línea de tiro) y una tapa de alcantarilla
  const grate = canvasTex(4, 4, (c) => { c.fillStyle = "#7a4a2a"; c.fillRect(0, 0, 4, 4); c.fillStyle = "#1a0e08"; c.fillRect(1, 0, 1, 4); c.fillRect(3, 0, 1, 4); }, [W * 2.5, 1]);
  const gr2 = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, 0.35), new THREE.MeshStandardMaterial({ map: grate, metalness: 0.6, roughness: 0.5 })); gr2.rotation.x = -Math.PI / 2; gr2.position.set(0, 0.013, -3.2); add(gr2);
  const manhole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), new THREE.MeshStandardMaterial({ map: canvasTex(16, 16, (c) => { c.fillStyle = "#3a3236"; c.fillRect(0, 0, 16, 16); c.strokeStyle = "#1a1418"; for (let k = 2; k < 8; k += 2) { c.beginPath(); c.arc(8, 8, k, 0, Math.PI * 2); c.stroke(); } }), metalness: 0.7, roughness: 0.35 }));
  manhole.rotation.x = -Math.PI / 2; manhole.position.set(-8, 0.014, -16); add(manhole);
  // Foco de pared de luz blanca fría (contrapunto al neón) y contenedor de basura
  const lampW = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: 0xf0f4ff })); lampW.position.set(W / 2 - 0.3, 5.6, -24); add(lampW);
  spots.push({ pos: new THREE.Vector3(W / 2 - 1, 5.2, -24), color: 0xdde4ff, power: 22 });
  const bin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x8a5a8e, roughness: 0.6 })); bin.position.set(-W / 2 + 1.1, 0.55, -27); add(bin);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 1.05), new THREE.MeshStandardMaterial({ color: 0x5a3a5e })); lid.position.set(-W / 2 + 1.1, 1.14, -27); lid.rotation.z = 0.08; add(lid);

  // ---------- Toque de simulación: columnas holográficas de datos que caen y pilares de luz ----------
  // (el callejón es una simulación: a ratos se le ven las costuras)
  const rainCanvas = document.createElement("canvas"); rainCanvas.width = 64; rainCanvas.height = 128;
  const rainTex = new THREE.CanvasTexture(rainCanvas); rainTex.magFilter = THREE.NearestFilter; rainTex.minFilter = THREE.NearestFilter; rainTex.colorSpace = THREE.SRGBColorSpace;
  const drops = Array.from({ length: 8 }, () => ({ y: r() * 128, v: 30 + r() * 50 }));
  const rainMat = new THREE.MeshBasicMaterial({ map: rainTex, color: 0x7ae0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (const [x, z, w, h, ry] of [[-11, FRONT + 0.2, 3, 6, 0], [13, FRONT + 0.2, 2.2, 5, 0], [L + 0.05, -20, 2, 5.5, Math.PI / 2], [R - 0.05, -36, 2.4, 6, -Math.PI / 2]] as [number, number, number, number, number][]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rainMat); pl.position.set(x, h / 2 + 0.3, z); pl.rotation.y = ry; add(pl);
  }
  let rainT = 0;
  const drawRain = (dt: number) => {
    const c = rainCanvas.getContext("2d")!;
    c.fillStyle = "rgba(0,0,0,0.28)"; c.fillRect(0, 0, 64, 128); c.font = "8px monospace";
    drops.forEach((dr, i) => {
      dr.y += dr.v * dt; if (dr.y > 140) { dr.y = -8; dr.v = 30 + Math.random() * 50; }
      c.fillStyle = "#ffffff"; c.fillText(String(Math.floor(Math.random() * 10)), i * 8, dr.y);
      c.fillStyle = "rgba(160,230,255,0.7)"; c.fillText(String(Math.floor(Math.random() * 10)), i * 8, dr.y - 9);
    });
    rainTex.needsUpdate = true;
  };
  // Pilares de luz verticales al fondo (zona de aparición de los blancos)
  const beamTex = canvasTex(16, 4, (c) => { const gr = c.createLinearGradient(0, 0, 16, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, 16, 4); }, undefined, true);
  const beams: THREE.MeshBasicMaterial[] = [];
  for (const [x, z, col] of [[-16, -56, 0xff7ad8], [16, -56, 0x9ad8ff]] as [number, number, number][]) {
    const bm = new THREE.MeshBasicMaterial({ map: beamTex, color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); beams.push(bm);
    for (const ry of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 40), bm); b.position.set(x, 20, z); b.rotation.y = ry; add(b); }
    spots.push({ pos: new THREE.Vector3(x, 2, z), color: col, power: 18 });
  }

  // ---------- Recinto del campo de tiro (de noche): muros altos, cubierta, deflectores y parapeto ----------
  const TOP = 15; // altura de los muros de noche
  const brick = new THREE.MeshStandardMaterial({ map: (() => { const t2 = wallMap.clone(); t2.needsUpdate = true; t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set((BACK - FRONT) / 3, (TOP - H) / 5); return t2; })(), roughness: 0.9 });
  const concrete = new THREE.MeshStandardMaterial({ map: canvasTex(32, 32, (c) => { c.fillStyle = "#3a3440"; c.fillRect(0, 0, 32, 32); for (let i = 0; i < 260; i++) { const v = Math.floor(r() * 30); c.fillStyle = `rgba(${v + 20},${v + 16},${v + 26},0.5)`; c.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1, 1); } c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(0, 0, 32, 1); c.fillRect(0, 0, 1, 32); }, [8, 2]), roughness: 0.95 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x24222c, metalness: 0.6, roughness: 0.55 });
  const corr = new THREE.MeshStandardMaterial({ map: canvasTex(16, 8, (c) => { for (let x = 0; x < 16; x++) { c.fillStyle = x % 4 < 2 ? "#3a3646" : "#2a2634"; c.fillRect(x, 0, 1, 8); } }, [W / 2, 6]), metalness: 0.5, roughness: 0.6, side: THREE.DoubleSide });
  const blk = (w: number, h: number, dd: number, x: number, y: number, z: number, m: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), m); b.position.set(x, y, z); add(b); return b; };
  const LEN = BACK - FRONT, MID = (BACK + FRONT) / 2;
  // Muros laterales que siguen hacia arriba (ladrillo), con una cornisa de hormigón y un remate
  for (const side of [-1, 1]) {
    blk(1, TOP - H, LEN + 2, side * (W / 2 + 0.5), (H + TOP) / 2, MID, brick);
    blk(1.3, 0.4, LEN + 2, side * (W / 2 + 0.35), H + 0.2, MID, concrete);       // cornisa sobre la parte baja
    blk(1.4, 0.5, LEN + 2, side * (W / 2 + 0.4), TOP + 0.25, MID, concrete);       // remate
    // Pilastras de hormigón cada 8 m (dan ritmo de nave)
    for (let z = BACK - 4; z > FRONT; z -= 8) blk(0.5, TOP, 0.9, side * (W / 2 - 0.2), TOP / 2, z, concrete);
  }
  // Muro del fondo y muro de la zona de equipo, también altos
  blk(W + 2, TOP - H, 1, 0, (H + TOP) / 2, FRONT - 0.5, brick);
  blk(W + 2, TOP - H, 1, 0, (H + TOP) / 2, BACK + 0.5, brick);
  // Parapeto de tiro al fondo: rampa inclinada de chapas oscuras que recoge las balas (con su zócalo de hormigón)
  const berm = new THREE.Mesh(new THREE.PlaneGeometry(W, 9), corr); berm.rotation.x = -Math.PI / 2 + 0.75; berm.position.set(0, 3.1, FRONT + 3.0); add(berm);
  blk(W, 1.2, 1.2, 0, 0.6, FRONT + 6.2, concrete);
  // Cubierta de chapa sobre la línea de tiro y la zona de equipo, sobre vigas de acero
  const roofZ0 = -1.5, roofLen = BACK - roofZ0;
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(W + 1, roofLen), corr); roof.rotation.x = Math.PI / 2 - 0.06; roof.position.set(0, H + 1.2, (BACK + roofZ0) / 2); add(roof);
  for (let z = BACK - 1; z >= roofZ0; z -= 4) blk(W + 1, 0.35, 0.25, 0, H + 0.85, z, steelDark);
  blk(W + 1, 0.5, 0.35, 0, H + 0.7, roofZ0, steelDark); // viga del borde (aquí acaba la cubierta)
  { const e = new THREE.Mesh(new THREE.BoxGeometry(W - 1, 0.05, 0.06), new THREE.MeshBasicMaterial({ color: NEON.pink })); e.position.set(0, H + 0.42, roofZ0 - 0.2); add(e); }
  // Deflectores colgados sobre las calles (los de los campos de tiro reales): paneles inclinados cada 9 m,
  // de muro a muro; entre ellos se ve el cielo
  for (const z of [-17, -33, -48]) {
    const baf = new THREE.Mesh(new THREE.BoxGeometry(W, 1.6, 0.16), concrete); baf.position.set(0, H + 2.2, z); baf.rotation.x = -0.45; add(baf);
    blk(W, 0.22, 0.28, 0, H + 1.45, z + 0.35, steelDark);
    // Tira de luz bajo cada deflector (alterna rosa y ámbar): ilumina las calles desde arriba
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: Math.round(z / 9) % 2 ? NEON.pink : NEON.amber })); strip.position.set(0, H + 1.3, z + 0.35); add(strip);
  }
  // Pasarela de mantenimiento a media altura en el muro izquierdo, con barandilla
  blk(1.4, 0.12, LEN - 6, -W / 2 + 0.7, 5.2, MID - 2, steelDark);
  for (let z = BACK - 6; z > FRONT + 4; z -= 2.5) blk(0.05, 1.0, 0.05, -W / 2 + 1.35, 5.75, z, steelDark);
  blk(0.05, 0.05, LEN - 6, -W / 2 + 1.35, 6.25, MID - 2, steelDark);

  // Optimización: solo 8 luces reales (las de la sala, recolocadas de noche). Se eligen las más potentes que estén
  // repartidas (a más de 9 m entre sí); el resto se apoya en su halo pintado.
  const keyLights: typeof spots = [];
  for (const sp of [...spots].sort((a2, b2) => b2.power - a2.power)) {
    if (keyLights.length >= 8) break;
    if (keyLights.every((k2) => k2.pos.distanceTo(sp.pos) > 9)) keyLights.push(sp);
  }
  for (const sp of spots) if (keyLights.length < 8 && !keyLights.includes(sp)) keyLights.push(sp);

  let t = 0;
  return {
    group: g, wallMap, floorMap, spots, keyLights,
    update(dt: number) {
      t += dt;
      // Rótulos: casi siempre fijos; de vez en cuando uno titila un instante
      for (const f of flickers) { f.ph += dt * f.rate; f.m.opacity = Math.sin(f.ph * 3.1) > 0.985 ? 0.25 + Math.random() * 0.5 : 1; }
      stars.material.opacity = 0.7 + 0.1 * Math.sin(t * 0.5);
      rainT += dt; if (rainT > 0.06) { drawRain(rainT); rainT = 0; }
      beams.forEach((b, i) => { b.opacity = 0.45 + 0.12 * Math.sin(t * 1.3 + i * 2); });
    },
  };
}
