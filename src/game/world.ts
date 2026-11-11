// Campo de tiro: suelo, muros, puestos de tiro, carteles de distancia, cofre y banco de trabajo.
// Coordenadas: la línea de tiro está en z = 0, hacia -z queda el campo; detrás (z > 0) la zona de equipo.
import * as THREE from "three";

export interface Interactable { id: "chest" | "workbench"; position: THREE.Vector3; radius: number; label: string; object: THREE.Object3D }
export interface World { colliders: THREE.Box3[]; interactables: Interactable[]; chestLid: THREE.Object3D; chestGlow: THREE.PointLight; shootables: THREE.Object3D[]; lanes: number[] }

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function noise(g: CanvasRenderingContext2D, w: number, h: number, base: string, spots: number, alpha: number, size = 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < spots; i++) { const v = Math.random() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`; g.fillRect(Math.random() * w, Math.random() * h, size, size); }
}

export function buildRange(scene: THREE.Scene): World {
  const colliders: THREE.Box3[] = [];
  const shootables: THREE.Object3D[] = [];
  const W = 40, FRONT = -64, BACK = 22;
  const lanes = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];

  const concrete = new THREE.MeshStandardMaterial({ map: canvasTexture(256, 256, (g) => { noise(g, 256, 256, "#8b8a85", 5000, 0.08); g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256); }, [W / 4, (BACK) / 4]), roughness: 0.9 });
  const dirt = new THREE.MeshStandardMaterial({ map: canvasTexture(256, 256, (g) => noise(g, 256, 256, "#6d5f4b", 9000, 0.18, 3), [W / 6, -FRONT / 6]), roughness: 1 });
  const wallMat = new THREE.MeshStandardMaterial({ map: canvasTexture(256, 256, (g) => { noise(g, 256, 256, "#9a978f", 4000, 0.07); g.fillStyle = "rgba(0,0,0,0.18)"; for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 2); for (let x = 0; x < 256; x += 128) g.fillRect(x, 0, 2, 256); }, [8, 1]), roughness: 0.85 });
  const wood = new THREE.MeshStandardMaterial({ map: canvasTexture(256, 64, (g) => { noise(g, 256, 64, "#a07a50", 1500, 0.12); g.strokeStyle = "rgba(60,35,15,0.35)"; for (let y = 6; y < 64; y += 9) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + 3, 170, y - 3, 256, y); g.stroke(); } }), roughness: 0.75 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3c4046, metalness: 0.7, roughness: 0.45 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.95 });

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, collide = true, shoot = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    if (collide) colliders.push(new THREE.Box3().setFromObject(m));
    if (shoot) shootables.push(m);
    return m;
  };

  // Suelos
  const zoneFloor = new THREE.Mesh(new THREE.PlaneGeometry(W, BACK), concrete);
  zoneFloor.rotation.x = -Math.PI / 2; zoneFloor.position.set(0, 0, BACK / 2); zoneFloor.receiveShadow = true; scene.add(zoneFloor); shootables.push(zoneFloor);
  const rangeFloor = new THREE.Mesh(new THREE.PlaneGeometry(W, -FRONT), dirt);
  rangeFloor.rotation.x = -Math.PI / 2; rangeFloor.position.set(0, 0, FRONT / 2); rangeFloor.receiveShadow = true; scene.add(rangeFloor); shootables.push(rangeFloor);

  // Muros perimetrales y talud de tierra al fondo
  box(1, 5, BACK - FRONT, -W / 2 - 0.5, 2.5, (BACK + FRONT) / 2, wallMat);
  box(1, 5, BACK - FRONT, W / 2 + 0.5, 2.5, (BACK + FRONT) / 2, wallMat);
  box(W + 2, 5, 1, 0, 2.5, BACK + 0.5, wallMat);
  const berm = new THREE.Mesh(new THREE.BoxGeometry(W, 8, 6), dirt); berm.position.set(0, 2.2, FRONT - 1); berm.rotation.x = -0.35; berm.receiveShadow = true; scene.add(berm); shootables.push(berm);
  colliders.push(new THREE.Box3(new THREE.Vector3(-W / 2, 0, FRONT - 4), new THREE.Vector3(W / 2, 6, FRONT + 1.5)));
  // Deflectores sobre el campo (vigas a varias distancias)
  for (const z of [-14, -30, -46]) { box(W, 0.6, 0.5, 0, 5.2, z, steel, false); }

  // Línea de tiro: mostradores por calle y separadores, con paso libre por los lados
  for (const x of lanes) {
    box(4.2, 0.08, 0.9, x, 1.0, 0.2, wood);
    box(4.2, 0.95, 0.12, x, 0.48, -0.2, steel);
    box(0.08, 0.9, 0.7, x - 1.7, 0.48, 0.25, steel, false);
    box(0.08, 0.9, 0.7, x + 1.7, 0.48, 0.25, steel, false);
  }
  colliders.push(new THREE.Box3(new THREE.Vector3(-15.2, 0, -0.3), new THREE.Vector3(15.2, 1.05, 0.7)));
  for (const x of [-15, -10, -5, 0, 5, 10, 15]) box(0.1, 2.4, 1.6, x, 1.2, 0.6, new THREE.MeshStandardMaterial({ color: 0x5a5d61, transparent: true, opacity: 0.85, roughness: 0.5 }));
  // Franja amarilla de seguridad
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.25), yellow); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.005, 1.2); scene.add(stripe);

  // Marquesina sobre la zona de equipo
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x4b4f55, roughness: 0.8, metalness: 0.3 }));
  roof.position.set(0, 4.6, 7); roof.castShadow = true; scene.add(roof);
  for (const x of [-19, -9.5, 9.5, 19]) for (const z of [1.6, 12.6]) box(0.35, 4.6, 0.35, x, 2.3, z, steel);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d0, emissiveIntensity: 2 });
  for (const x of [-12, 0, 12]) { const l = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 0.25), lampMat); l.position.set(x, 4.43, 7); scene.add(l); const pl = new THREE.PointLight(0xfff0d8, 8, 14, 1.6); pl.position.set(x, 4.2, 7); scene.add(pl); }

  // Carteles de distancia
  for (const d of [10, 25, 50]) {
    const tex = canvasTexture(256, 128, (g) => { g.fillStyle = "#f3efe4"; g.fillRect(0, 0, 256, 128); g.fillStyle = "#1c1c1c"; g.font = "bold 84px 'Chakra Petch', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${d} m`, 128, 70); g.fillStyle = "#d9a21b"; g.fillRect(0, 0, 256, 12); });
    for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
      s.position.set(x, 2.6, -d); s.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(s);
    }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.12), new THREE.MeshBasicMaterial({ color: 0xe8e1d0 })); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.01, -d); scene.add(line);
  }
  // Barriles y sacos como decoración del campo (cobertura de prueba)
  const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3f5a3a, roughness: 0.6, metalness: 0.4 });
  for (const [x, z] of [[-17, -18], [-16.2, -18.6], [17, -36], [-4.8, -40], [4.9, -22]]) {
    const b = new THREE.Mesh(barrelGeo, barrelMat); b.position.set(x, 0.6, z); b.castShadow = true; b.receiveShadow = true; scene.add(b); shootables.push(b);
    colliders.push(new THREE.Box3().setFromObject(b));
  }

  // ---------- Cofre de botín ----------
  const chest = new THREE.Group(); chest.position.set(-12, 0, 13);
  const chestMat = new THREE.MeshStandardMaterial({ color: 0x2f3a2c, roughness: 0.55, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8d8f91, metalness: 0.8, roughness: 0.35 });
  const baseC = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.9), chestMat); baseC.position.y = 0.3; baseC.castShadow = true; chest.add(baseC);
  for (const x of [-0.78, 0.78]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.92), trim); t.position.set(x, 0.31, 0); chest.add(t); }
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.6, -0.45); chest.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.9), chestMat); lid.position.set(0, 0.11, 0.45); lid.castShadow = true; lidPivot.add(lid);
  const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0xf2a541, emissive: 0xf2a541, emissiveIntensity: 3 }));
  glowStrip.position.set(0, 0.58, 0.46); chest.add(glowStrip);
  const chestGlow = new THREE.PointLight(0xf2a541, 0, 4); chestGlow.position.set(0, 1.1, 0); chest.add(chestGlow);
  scene.add(chest);
  colliders.push(new THREE.Box3(new THREE.Vector3(-12.85, 0, 12.5), new THREE.Vector3(-11.15, 0.85, 13.5)));

  // ---------- Banco de trabajo ----------
  const bench = new THREE.Group(); bench.position.set(12, 0, 13);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.1), wood); top.position.y = 0.95; top.castShadow = true; top.receiveShadow = true; bench.add(top);
  for (const [x, z] of [[-1.2, -0.48], [1.2, -0.48], [-1.2, 0.48], [1.2, 0.48]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), steel); leg.position.set(x, 0.47, z); bench.add(leg); }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.04, 1), steel); shelf.position.y = 0.25; bench.add(shelf);
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 0.05), new THREE.MeshStandardMaterial({ map: canvasTexture(256, 128, (g) => { noise(g, 256, 128, "#55463a", 2500, 0.12); g.fillStyle = "#2a2622"; for (let x = 8; x < 256; x += 12) for (let y = 8; y < 128; y += 12) g.fillRect(x, y, 3, 3); }), roughness: 0.9 }));
  board.position.set(0, 1.75, -0.53); bench.add(board);
  const vise = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0x2c4f7a, metalness: 0.5, roughness: 0.4 })); vise.position.set(-0.9, 1.08, 0.2); bench.add(vise);
  for (let i = 0; i < 5; i++) { const tool = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35 + (i % 2) * 0.15, 0.03), i % 2 ? trim : rubber); tool.position.set(-0.8 + i * 0.4, 1.7, -0.5); bench.add(tool); }
  const lamp = new THREE.PointLight(0xfff0d0, 3, 4); lamp.position.set(0, 2.2, 0.2); bench.add(lamp);
  scene.add(bench);
  colliders.push(new THREE.Box3(new THREE.Vector3(10.6, 0, 12.4), new THREE.Vector3(13.4, 1.0, 13.6)));

  // ---------- Luz ----------
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x6b5a45, 0.7));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(-25, 40, 18); sun.target.position.set(0, 0, -20);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 50, bottom: -50, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  scene.background = new THREE.Color(0xa9c3d6);
  scene.fog = new THREE.Fog(0xa9c3d6, 60, 150);

  return {
    colliders, shootables, lanes, chestLid: lidPivot, chestGlow,
    interactables: [
      { id: "chest", position: new THREE.Vector3(-12, 0, 13), radius: 2.2, label: "Abrir cofre", object: chest },
      { id: "workbench", position: new THREE.Vector3(12, 0, 13), radius: 2.4, label: "Usar banco de trabajo", object: bench },
    ],
  };
}
