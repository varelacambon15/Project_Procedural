// Monta en 3D un arma generada: carga los .glb de cada pieza y las coloca en sus puntos de anclaje.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { NO_TWEAKS, type AssetEntry, type PartRole, type WeaponSpec } from "./types";
import { TYPE_LENGTH, bodyZones, drumOf, pieceScale, type WeaponGenerator } from "./generator";
import { midZone, stretchAll, stretchX, type Stretches } from "./variation";
import { KIT_FLIP, isKit, kitLabel, kitPlacements, type KitPart } from "./kit";
import { accessory, buildFrontSight, buildMuzzle, buildOptic } from "./accessories";
import { applyFinish } from "./finish";
import { contactAO } from "./ao";

export interface AssembledPart { object: THREE.Object3D; role: PartRole; from: AssetEntry; explode: THREE.Vector3; base: THREE.Vector3 }
export interface AssembledWeapon {
  group: THREE.Group; parts: AssembledPart[]; length: number;
  /** Punta del cañón (o del accesorio de boca), en coordenadas del grupo. */ muzzle: THREE.Vector3;
  /** Altura de la línea de mira (centro de la mira, si la lleva), en coordenadas del grupo. */ sightY: number | null;
  /** Aumentos de la mira (1 = sin mira). */ zoom: number;
  /** Puntos de agarre (coordenadas del grupo): mano derecha en la empuñadura, izquierda en el guardamanos,
   *  pozo del cargador y palanca de carga. Los usan los brazos (IK) y las animaciones de recarga. */
  handles: { grip: THREE.Vector3; support: THREE.Vector3; magwell: THREE.Vector3; charge: THREE.Vector3 };
}

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);

export class WeaponAssembler {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<THREE.Group>>();

  constructor(private gen: WeaponGenerator, private baseUrl: string) {}

  private load(entry: AssetEntry): Promise<THREE.Group> {
    if (!this.cache.has(entry.id)) this.cache.set(entry.id, this.fetchModel(this.baseUrl + entry.file));
    return this.cache.get(entry.id)!;
  }

  /**
   * Carga un .glb, o un .gltf en JSON con el buffer incrustado en base64. En este segundo caso el buffer se
   * descodifica aquí y se reconstruye un .glb en memoria: algunos visores bloquean que el cargador lea URIs data:.
   */
  private async fetchModel(url: string): Promise<THREE.Group> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    let buf = await res.arrayBuffer();
    if (new Uint32Array(buf, 0, 1)[0] !== 0x46546c67) buf = jsonToGlb(JSON.parse(new TextDecoder().decode(buf)));
    const gltf = await this.loader.parseAsync(buf, "");
    return gltf.scene;
  }

  /** Carga de antemano todas las piezas del kit (son pequeñas): así las armas del kit se montan al instante. */
  preloadKit() { for (const p of this.gen.kit.parts) if (!this.cache.has(p.id)) this.cache.set(p.id, this.fetchModel(this.baseUrl + p.file)); }

  /** Pieza del kit: sus mallas con el acabado común (el cristal de las miras se conserva). */
  private async kitNode(part: KitPart): Promise<THREE.Group> {
    if (!this.cache.has(part.id)) this.cache.set(part.id, this.fetchModel(this.baseUrl + part.file));
    const scene = await this.cache.get(part.id)!;
    const g = new THREE.Group();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const c = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? m.material.map(finish) : finish(m.material));
      c.name = m.name; c.castShadow = true; c.receiveShadow = true;
      g.add(c);
    });
    return g;
  }

  /** Copia las mallas de un rol de un arma (geometría compartida, material propio). */
  private async nodes(entry: AssetEntry, role: PartRole): Promise<THREE.Group> {
    const scene = await this.load(entry);
    const g = new THREE.Group();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && roleOf(m) === role) {
        const c = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? m.material.map(finish) : finish(m.material));
        c.castShadow = true; c.receiveShadow = true;
        g.add(c);
      }
    });
    return g;
  }

  async assemble(spec: WeaponSpec): Promise<AssembledWeapon> {
    const group = new THREE.Group();
    const parts: AssembledPart[] = [];
    const get = (id: string) => this.gen.byId.get(id)!;
    const add = (object: THREE.Object3D, role: PartRole, from: AssetEntry, explode: [number, number, number]) => {
      group.add(object); parts.push({ object, role, from, explode: new THREE.Vector3(...explode), base: object.position.clone() });
    };
    let muzzle: THREE.Vector3 | null = null;
    const first = this.gen.byId.get(spec.parts[0].from);
    const length0 = first ? first.bounds.max[0] - first.bounds.min[0] : TYPE_LENGTH[spec.type] ?? 0.9;
    let muzzleDiameter = 0.03;
    let opticTarget: THREE.Vector3 | null = null;
    let opticLength = 0;

    let sightKit: number | null = null;
    let bodyZoneUsed: Stretches = null;
    if (spec.layout === "kit") {
      // Kit modular: cada pieza en su socket, recorriendo el árbol desde la plataforma
      const { placements, muzzle: mz, opticAt } = kitPlacements(this.gen.kit, spec);
      let frontSightTop: number | null = null;
      // Todas las piezas se cargan a la vez (en paralelo), y luego se colocan en orden
      // El punto de mira del pack se lee como un "4" de perfil: se usa uno limpio hecho a medida
      const nodes = await Promise.all(placements.map((pl) => (pl.part.id === "k-ironsight-front-556barrel-01" ? Promise.resolve(buildFrontSight()) : this.kitNode(pl.part))));
      for (const [i, pl] of placements.entries()) {
        const node = nodes[i];
        node.position.set(...pl.pos); node.scale.x = pl.stretch;
        if (KIT_FLIP.has(pl.part.id)) node.rotation.y = Math.PI;
        if (pl.role === "magazine" && (spec.tweaks?.magLen ?? 1) !== 1) node.scale.y = spec.tweaks!.magLen!;
        const role: PartRole = pl.role === "sight" ? "scope" : pl.role;
        add(node, role, { id: pl.part.id, label: kitLabel(pl.part.id), pack: "kit" } as AssetEntry, KIT_EXPLODE[pl.role] ?? [0, 0.6, 0]);
        if (pl.role === "scope") {
          // Mira del kit: la línea de mira pasa por el centro del cristal
          node.updateMatrixWorld(true);
          const lens = node.children.find((c) => /lens/i.test(c.name)) ?? node;
          const b = new THREE.Box3().setFromObject(lens); sightKit = (b.min.y + b.max.y) / 2;
        }
        if (pl.role === "sight" && /front/.test(pl.part.id)) { node.updateMatrixWorld(true); frontSightTop = new THREE.Box3().setFromObject(node).max.y; }
      }
      if (!spec.optic) {
        // Alzas: la línea pasa por la punta del punto de mira (o por encima de la corredera, en pistola)
        const slide = parts.find((p) => p.role === "slide");
        sightKit = frontSightTop !== null ? frontSightTop - 0.002 : slide ? new THREE.Box3().setFromObject(slide.object).max.y + 0.002 : null;
      }
      const kd = spec.tweaks?.device ? this.gen.kit.byId.get(spec.tweaks.device.id) : null;
      if (kd && spec.tweaks?.device) { const dev = await this.kitNode(kd); dev.scale.setScalar(DEVICE_SCALE(spec.type)); dev.position.set(spec.tweaks.device.at[0], spec.tweaks.device.at[1] + 0.002, 0); add(dev, "device", { id: kd.id, label: kitLabel(kd.id), pack: "kit" } as AssetEntry, [0.4, -1.1, 0]); }
      if (mz) { muzzle = v3(mz); muzzleDiameter = spec.type === "shotgun" ? 0.026 : spec.type === "pistol" ? 0.014 : 0.018; }
      if (opticAt && spec.optic && !isKit(spec.optic)) { opticTarget = v3(opticAt); opticLength = spec.type === "pistol" ? 0.05 : 0.1; }
    } else if (spec.layout === "modular-pistol") {
      const frameE = get(spec.parts.find((p) => p.role === "frame")!.from);
      const slideE = get(spec.parts.find((p) => p.role === "slide")!.from);
      const barrelE = get(spec.parts.find((p) => p.role === "barrel")!.from);
      const frame = await this.nodes(frameE, "frame");
      add(frame, "frame", frameE, [0, 0, 0]);
      // La corredera se apoya en el socket "slide" del armazón (donde iba la corredera original).
      const slide = await this.nodes(slideE, "slide");
      const slideOff = v3(frameE.sockets.slide!.pos).sub(v3(slideE.sockets.slide!.pos));
      slide.position.copy(slideOff);
      add(slide, "slide", slideE, [0, 1, 0]);
      // El cañón va en el socket "barrel" de la corredera, con longitud procedural.
      const barrel = await this.nodes(barrelE, "barrel");
      const src = barrelE.sockets.barrel!, dst = slideE.sockets.barrel!;
      const L = spec.barrelLength;
      barrel.scale.set(L, 1, 1);
      barrel.position.set(dst.pos[0] - src.pos[0] * L, dst.pos[1] - src.pos[1], 0).add(slideOff);
      add(barrel, "barrel", barrelE, [0.8, 1.6, 0]);
      muzzle = new THREE.Vector3(dst.pos[0] + (src.length ?? 0.04) * L, dst.pos[1], 0).add(slideOff);
      muzzleDiameter = (frameE.sockets.muzzle?.diameter ?? 0.03) * 0.6;
    } else {
      const bodyE = get(spec.parts[0].from);
      if (spec.layout === "modular-long") {
        // Cajón en el origen; culata, guardamanos y empuñadura (de otras armas de la familia) en sus juntas.
        const J = bodyE.joints!;
        const recv = await this.nodes(bodyE, "receiver");
        add(recv, "receiver", bodyE, [0, 0, 0]);
        const tw = spec.tweaks ?? NO_TWEAKS;
        // Cada pieza se escala a la sección de su junta y recibe su variación leve (largo, tamaño, ángulo).
        const attach = async (role: "stock" | "front" | "grip", joint: "rear" | "front" | "grip", face: "stockFace" | "frontFace" | "gripFace", explode: [number, number, number]) => {
          const donor = get(spec.parts.find((p) => p.role === role)!.from);
          const node = await this.nodes(donor, role);
          const sv = new THREE.Vector3(...pieceScale(bodyE, donor, role, tw));
          const k = sv.y;
          // Largo por zonas: solo se estira el tramo central; los extremos con detalle quedan intactos
          const prof = donor.profiles?.[role], fx = donor.joints![face].pos[0];
          const zone = !prof ? null : role === "stock" ? midZone(prof.x0, fx, tw.stock, 0.25, 0.2, true) : role === "front" ? midZone(fx, prof.x1, tw.front, 0.15, 0.25) : null;
          if (zone) stretchNode(node, zone);
          node.scale.copy(sv);
          const anchor = v3(J[joint].pos);
          const own = donor === bodyE;
          if (role === "grip") {
            // La empuñadura gira un poco sobre su junta (la propia no se desplaza; la ajena se alinea por su cara)
            const pivot = new THREE.Group(); pivot.position.copy(anchor); pivot.rotation.z = tw.gripAngle;
            node.position.copy(own ? anchor.clone().multiply(new THREE.Vector3(sv.x, sv.y, 1)).negate() : v3(donor.joints![face].pos).multiply(sv).negate());
            pivot.add(node); add(pivot, role, donor, explode);
            return { donor, k, node: pivot, sv, zone };
          }
          const fp = v3(donor.joints![face].pos);
          node.position.copy(own ? new THREE.Vector3(fp.x * (1 - sv.x), anchor.y * (1 - sv.y), 0) : anchor.sub(fp.multiply(sv)));
          add(node, role, donor, explode);
          return { donor, k, node, sv, zone };
        };
        if (!tw.nostock) await attach("stock", "rear", "stockFace", [-1.2, 0, 0]);
        else {
          // Sin culata: una placa trasera cierra el cajón
          const h = J.rear.size?.[0] ?? 0.04, w = (bodyE.bounds.max[2] - bodyE.bounds.min[2]) * 0.8;
          const cap = new THREE.Mesh(new THREE.BoxGeometry(0.012, h * 0.9, w), new THREE.MeshStandardMaterial({ name: "endplate" }));
          cap.position.set(J.rear.pos[0] - 0.005, J.rear.pos[1], 0);
          add(cap, "receiver", bodyE, [-0.5, 0, 0]);
        }
        const fr = await attach("front", "front", "frontFace", [1.1, 0.2, 0]);
        await attach("grip", "grip", "gripFace", [0, -1, 0]);
        if (fr.donor.sockets.muzzle) {
          const m = fr.donor.sockets.muzzle;
          muzzle = new THREE.Vector3(stretchX(m.pos[0], fr.zone), m.pos[1], m.pos[2]).multiply(fr.sv).add(fr.node.position);
          muzzleDiameter = (m.diameter ?? 0.02) * fr.k;
        }
      } else {
        const body = await this.nodes(bodyE, "body");
        // Tramo delantero (cañón) estirado por zonas; la boca y el cajón quedan intactos
        const prof = bodyE.profiles?.body;
        bodyZoneUsed = prof && spec.layout === "body" ? bodyZones(prof, spec.tweaks ?? NO_TWEAKS) : null;
        if (bodyZoneUsed) stretchNode(body, bodyZoneUsed);
        add(body, "body", bodyE, [0, 0, 0]);
        if (bodyE.sockets.muzzle) { const m = bodyE.sockets.muzzle; muzzle = new THREE.Vector3(stretchAll(m.pos[0], bodyZoneUsed), m.pos[1], m.pos[2]); muzzleDiameter = m.diameter ?? 0.03; }
      }
      // Cargador: su parte superior encaja en el pozo del cuerpo; se escala al ancho del pozo original.
      const magPick = spec.parts.find((p) => p.role === "magazine");
      const tw2 = spec.tweaks ?? NO_TWEAKS;
      if (magPick && bodyE.sockets.magazine && tw2.drum) {
        // Cargador de tambor (pieza cilíndrica, como los reales) en el pozo
        const d = drumOf(bodyE);
        const drum = new THREE.Group();
        const can = new THREE.Mesh(new THREE.CylinderGeometry(d.R, d.R, d.w, 24), new THREE.MeshStandardMaterial({ name: "drum" }));
        can.rotation.x = Math.PI / 2; drum.add(can);
        const neck = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.05, d.R), 0.03, d.w * 0.55), new THREE.MeshStandardMaterial({ name: "drum" }));
        neck.position.set(0, d.R, 0); drum.add(neck);
        for (const z of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(d.R * 0.45, d.R * 0.45, 0.004, 16), new THREE.MeshStandardMaterial({ name: "drum" })); cap.rotation.x = Math.PI / 2; cap.position.z = z * (d.w / 2 + 0.002); drum.add(cap); }
        drum.position.set(d.x, d.y, 0);
        add(drum, "magazine", { id: "drum", label: "Drum", pack: "proc" } as AssetEntry, [0, -1.2, 0]);
      } else if (magPick && bodyE.sockets.magazine) {
        const magE = get(magPick.from);
        const mag = await this.nodes(magE, "magazine");
        const want = bodyE.sockets.magazine, have = magE.sockets.magazine!;
        const k = THREE.MathUtils.clamp((want.size?.[0] ?? 1) / (have.size?.[0] ?? 1), 0.6, 1.6);
        const ky = k * (tw2.magLen ?? 1); // cargador alargado: crece hacia abajo desde el pozo
        mag.scale.set(k, ky, k);
        mag.position.copy(v3(want.pos).sub(v3(have.pos).multiply(new THREE.Vector3(k, ky, k))));
        add(mag, "magazine", magE, [0, -1.2, 0]);
      }
      // Detalles añadidos: raíl superior y accesorio real del pack modular bajo el guardamanos
      if (tw2.rail) {
        const [x0, x1, y] = tw2.rail; const L = x1 - x0;
        const rail = new THREE.Group();
        const baseM = new THREE.Mesh(new THREE.BoxGeometry(L, 0.007, 0.021), new THREE.MeshStandardMaterial({ name: "rail" })); baseM.position.set(L / 2, 0.0035, 0); rail.add(baseM);
        for (let x = 0.004; x < L - 0.003; x += 0.01) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.004, 0.021), new THREE.MeshStandardMaterial({ name: "rail" })); t.position.set(x + 0.0025, 0.009, 0); rail.add(t); }
        rail.position.set(x0, y - 0.001, 0);
        add(rail, "scope", { id: "rail", label: "Rail", pack: "proc" } as AssetEntry, [0, 0.8, 0]);
      }
      if (tw2.device) {
        const kp = this.gen.kit.byId.get(tw2.device.id);
        if (kp) { const dev = await this.kitNode(kp); dev.scale.setScalar(DEVICE_SCALE(spec.type)); dev.position.set(tw2.device.at[0], tw2.device.at[1] + 0.002, 0); add(dev, "device", { id: kp.id, label: kitLabel(kp.id), pack: "kit" } as AssetEntry, [0.4, -1.1, 0]); }
      }
      if (bodyE.sockets.optic) { opticTarget = v3(bodyE.sockets.optic.pos); opticLength = bodyE.sockets.optic.size?.[0] ?? 0; }
      else if (bodyE.sockets.rail) { opticTarget = v3(bodyE.sockets.rail.pos); opticLength = bodyE.sockets.rail.length ?? 0.1; }
    }
    let sight: number | null = sightKit, zoom = isKit(spec.optic) ? accessory(spec.optic)?.zoom ?? 1 : 1;

    // Mira: la propia del arma o una de otra arma/accesorio, apoyada en el socket "optic" o en la parte superior.
    const optAcc = accessory(spec.optic);
    if (optAcc && opticTarget && !isKit(spec.optic)) {
      // Mira propia, generada a medida del raíl
      const { group: opt, sightHeight } = buildOptic(optAcc.id, opticLength, length0);
      // Si alguna parte del arma (cajón, culata, alzas) queda por encima de la línea de mira, la mira va sobre
      // un elevador, como en un arma real: así al apuntar siempre se ve por encima del arma.
      const top = new THREE.Box3().setFromObject(group).max.y;
      const riser = Math.max(0, top + 0.006 - (opticTarget.y + sightHeight));
      opt.position.copy(opticTarget).add(new THREE.Vector3(0, riser - 0.002, 0));
      if (riser > 0.002) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.05, riser + 0.004, 0.022), new THREE.MeshStandardMaterial({ name: "Steel", color: 0x1c1d1f, metalness: 0.75, roughness: 0.42 }));
        block.position.y = -riser / 2; opt.add(block);
      }
      opticTarget.y += riser;
      group.add(opt);
      parts.push({ object: opt, role: "scope", from: { id: optAcc.id, label: optAcc.id, pack: "acc" } as AssetEntry, explode: new THREE.Vector3(0, 1.4, 0), base: opt.position.clone() });
      sight = opticTarget.y + sightHeight; zoom = optAcc.zoom ?? 1;
    } else if (isKit(spec.optic) && opticTarget && spec.layout !== "kit") {
      // Mira real (accesorio del kit) sobre el raíl de un arma despiezada o entera, con elevador si hace falta
      const kp = this.gen.kit.byId.get(spec.optic);
      if (kp) {
        const opt = await this.kitNode(kp);
        const lens = opt.children.find((c) => /lens/i.test(c.name));
        const lb = lens ? new THREE.Box3().setFromObject(lens) : null;
        const lensY = lb ? (lb.min.y + lb.max.y) / 2 : kp.bounds.max[1] * 0.6;
        const top = new THREE.Box3().setFromObject(group).max.y;
        const riser = Math.max(0, top + 0.004 - (opticTarget.y + lensY));
        opt.position.copy(opticTarget).add(new THREE.Vector3(0, riser, 0));
        if (riser > 0.002) {
          const block = new THREE.Mesh(new THREE.BoxGeometry(0.05, riser + 0.004, 0.022), new THREE.MeshStandardMaterial({ name: "riser" }));
          block.position.set(opticTarget.x, opticTarget.y + riser / 2, 0); add(block, "scope", { id: "riser", label: "Riser", pack: "proc" } as AssetEntry, [0, 1.2, 0]);
        }
        add(opt, "scope", { id: kp.id, label: kitLabel(kp.id), pack: "kit" } as AssetEntry, [0, 1.4, 0]);
        sight = opticTarget.y + riser + lensY; zoom = accessory(spec.optic)?.zoom ?? 1;
      }
    } else if (spec.optic && opticTarget && !isKit(spec.optic)) {
      const optE = get(spec.optic);
      const opt = await this.nodes(optE, "scope");
      if (optE.id !== spec.parts[0].from) {
        const src = optE.sockets.optic!;
        const k = THREE.MathUtils.clamp(opticLength / (src.size?.[0] ?? opticLength), 0.4, 2.5);
        opt.scale.setScalar(k);
        opt.position.copy(opticTarget.clone().sub(v3(src.pos).multiplyScalar(k)));
      }
      add(opt, "scope", optE, [0, 1.4, 0]);
      const ob = new THREE.Box3().setFromObject(opt); sight = (ob.min.y + ob.max.y) / 2; zoom = 2.5;
    }

    // Accesorio de boca: su parte trasera en la boca del cañón, escalado al diámetro.
    const muzAcc = accessory(spec.muzzle);
    if (isKit(spec.muzzle) && muzzle && spec.layout !== "kit") {
      // Supresor real en la boca, escalado al calibre (diámetro de la boca)
      const kp = this.gen.kit.byId.get(spec.muzzle);
      if (kp) {
        const dev = await this.kitNode(kp);
        const dia = kp.bounds.max[1] - kp.bounds.min[1];
        const k = THREE.MathUtils.clamp((muzzleDiameter * 2.2) / dia, 0.45, 1.15);
        dev.scale.setScalar(k); dev.position.copy(muzzle).add(new THREE.Vector3(-0.002, 0, 0));
        add(dev, "muzzle", { id: kp.id, label: kitLabel(kp.id), pack: "kit" } as AssetEntry, [1.2, 0.3, 0]);
        muzzle = muzzle.clone().add(new THREE.Vector3(kp.bounds.max[0] * k, 0, 0));
      }
    } else if (muzAcc && muzzle && !isKit(spec.muzzle)) {
      // Dispositivo de boca propio, del diámetro exacto del cañón
      const { group: dev, length: dl } = buildMuzzle(muzAcc.id, muzzleDiameter, length0);
      dev.position.copy(muzzle).add(new THREE.Vector3(-0.002, 0, 0));
      group.add(dev);
      parts.push({ object: dev, role: "muzzle", from: { id: muzAcc.id, label: muzAcc.id, pack: "acc" } as AssetEntry, explode: new THREE.Vector3(1.2, 0.3, 0), base: dev.position.clone() });
      muzzle = muzzle.clone().add(new THREE.Vector3(dl, 0, 0));
    } else if (spec.muzzle && muzzle && this.gen.byId.has(spec.muzzle)) {
      const accE = get(spec.muzzle);
      const acc = await this.nodes(accE, "muzzle");
      const h = accE.bounds.max[1] - accE.bounds.min[1];
      const k = THREE.MathUtils.clamp(Math.max(muzzleDiameter * 2.2, length0 * 0.04) / h, 0.05, 4);
      acc.scale.setScalar(k);
      acc.position.set(muzzle.x - accE.bounds.min[0] * k, muzzle.y - ((accE.bounds.min[1] + accE.bounds.max[1]) / 2) * k, 0);
      add(acc, "muzzle", accE, [1.2, 0.3, 0]);
      muzzle = new THREE.Vector3(acc.position.x + (accE.bounds.max[0] - accE.bounds.min[0]) * k, muzzle.y, 0);
    }

    // Acabado único por rol (descarta colores y texturas de origen)
    // Oclusión de contacto entre piezas (una vez por arma montada)
    contactAO(group, parts.map((p) => p.object));
    // Las legendarias: un único detalle pequeño en color vivo (boca, palanca, gatillo o accesorio), nunca el cargador
    const legendary = spec.rarity.id === "legendaria";
    const hl = legendary ? parts.find((p) => p.role === "muzzle") ?? parts.find((p) => p.role === "charging") ?? parts.find((p) => p.role === "trigger") ?? parts.find((p) => p.role === "device") : undefined;
    for (const p of parts) applyFinish(p.object, p.role, spec.paint, legendary, p === hl);

    // Variación leve del largo de las armas enteras
    // (el largo de las armas enteras ya se varió por zonas)
    // Estilos igualados: los modelos más gruesos que un arma real se estrechan un poco.
    const raw = new THREE.Box3().setFromObject(group);
    const thick = raw.max.z - raw.min.z, long = raw.max.x - raw.min.x;
    const maxRatio = MAX_THICKNESS[spec.type] ?? 0.1;
    if (thick / long > maxRatio) group.scale.z = Math.max(0.6, (maxRatio * long) / thick);

    // Centrar y guardar posiciones base para el despiece.
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    center.z = 0; // el eje del arma (cañón, mira) está en z = 0: así al apuntar la mira queda centrada
    const length = box.max.x - box.min.x;
    for (const p of parts) { p.object.position.sub(center); p.base.copy(p.object.position); p.explode.multiplyScalar(length * 0.18); }
    const muzzleOut = (muzzle ?? new THREE.Vector3(box.max.x, center.y, 0)).clone().sub(center);
    group.updateMatrixWorld(true);
    const handles = this.handles(spec, parts, new THREE.Box3().setFromObject(group));
    return { group, parts, length, muzzle: muzzleOut, sightY: sight === null ? null : sight - center.y, zoom, handles };
  }

  /** Estima dónde agarran las manos: empuñadura (junta o detrás del cargador), guardamanos, pozo y palanca. */
  private handles(spec: WeaponSpec, parts: AssembledPart[], box: THREE.Box3) {
    const center = box.getCenter(new THREE.Vector3());
    const L = box.max.x - box.min.x, H = box.max.y - box.min.y;
    const part = (role: PartRole) => parts.find((p) => p.role === role);
    const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
    const handgun = spec.type === "pistol" || spec.type === "revolver";
    const mag = part("magazine"); const magBox = mag ? boxOf(mag.object) : null;
    let grip: THREE.Vector3;
    const gp = part("grip") ?? part("frame");
    if (gp) { const b = boxOf(gp.object); grip = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y - (b.max.y - b.min.y) * 0.35, 0); }
    else if (handgun && magBox) grip = new THREE.Vector3((magBox.min.x + magBox.max.x) / 2, magBox.max.y - (magBox.max.y - magBox.min.y) * 0.3, 0);
    else if (magBox) grip = new THREE.Vector3(magBox.min.x - L * 0.09, box.min.y + H * 0.32, 0);
    else grip = new THREE.Vector3(box.min.x + L * (handgun ? 0.35 : 0.38), box.min.y + H * 0.3, 0);
    const fp = part("pump") ?? part("front");
    const fb = fp ? boxOf(fp.object) : null;
    const support = handgun ? grip.clone().add(new THREE.Vector3(0.01, -0.01, 0))
      : fb ? new THREE.Vector3(fb.min.x + (fb.max.x - fb.min.x) * 0.35, fb.min.y + (fb.max.y - fb.min.y) * 0.15, 0)
      : new THREE.Vector3(box.min.x + L * 0.68, center.y - H * 0.05, 0);
    const magwell = magBox ? new THREE.Vector3((magBox.min.x + magBox.max.x) / 2, magBox.min.y + (magBox.max.y - magBox.min.y) * 0.2, 0) : grip.clone().add(new THREE.Vector3(L * 0.1, -H * 0.1, 0));
    const charge = new THREE.Vector3(handgun ? box.min.x + L * 0.25 : box.min.x + L * 0.5, box.max.y - H * 0.15, 0);
    return { grip, support, magwell, charge };
  }
}

/** Despiece del kit (dirección en la que se separa cada pieza) y qué piezas llevan el color principal o el secundario. */
const KIT_EXPLODE: Partial<Record<string, [number, number, number]>> = {
  receiver: [0, 0, 0], barrel: [1.5, 0, 0], front: [1, 0.25, 0], stock: [-1.2, 0, 0], grip: [-0.2, -1, 0], magazine: [0, -1.2, 0], muzzle: [2, 0.3, 0],
  scope: [0, 1.4, 0], sight: [0, 1, 0], trigger: [0, -0.7, 0], charging: [-0.5, 0.8, 0], slide: [0, 1, 0], pump: [0.8, -0.7, 0], device: [0.6, -1.1, 0],
};

/** Los accesorios bajo el cañón son de tamaño de fusil: en armas cortas se reducen. */
const DEVICE_SCALE = (type: string) => (type === "pistol" || type === "revolver" ? 0.62 : type === "smg" ? 0.85 : 1);

/** Grosor máximo (ancho / largo) según el tipo, como en armas reales. */
const MAX_THICKNESS: Partial<Record<string, number>> = { pistol: 0.17, revolver: 0.2, smg: 0.12, rifle: 0.08, bullpup: 0.1, shotgun: 0.075, sniper: 0.075, lmg: 0.11, launcher: 0.16, flamethrower: 0.16 };

/**
 * Acabado común a todos los packs, para que convivan: colores poco saturados y en el rango de tonos
 * de un arma real (acero, polímero, madera). El metal refleja el entorno; plásticos y madera, poco.
 */
function finish(src: THREE.Material): THREE.Material {
  const m = src.clone() as THREE.MeshStandardMaterial;
  if (!m.isMeshStandardMaterial || /Lens|Glass/i.test(m.name)) return m;
  const wood = /Wood|Handle/i.test(m.name);
  if (!m.map) {
    const hsl = { h: 0, s: 0, l: 0 }; m.color.getHSL(hsl);
    m.color.setHSL(hsl.h, hsl.s * (wood ? 0.6 : 0.3), THREE.MathUtils.clamp(hsl.l, 0.02, wood ? 0.3 : 0.24));
  }
  if (/Wood|Handle/i.test(m.name)) { m.metalness = 0.0; m.roughness = 0.75; }
  else if (/Polymer|Plastic|Black2/i.test(m.name)) { m.metalness = 0.15; m.roughness = 0.6; }
  else { m.metalness = Math.max(m.metalness, 0.6); m.roughness = Math.min(m.roughness, 0.45); }
  m.envMapIntensity = 0.9;
  return m;
}

/** Rol de una malla: el primer antecesor que lo declara (las mallas multimaterial se cargan como grupo + hijos). */
function roleOf(o: THREE.Object3D): string | null {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (typeof n.userData.role === "string") return n.userData.role;
    const m = /^(body|slide|frame|barrel|magazine|scope|muzzle)/.exec(n.name);
    if (m) return m[1];
  }
  return null;
}

/** Estira por zonas la geometría de un nodo (en su propio marco). La geometría se copia: la caché no se toca. */
function stretchNode(node: THREE.Object3D, z: Stretches) {
  if (!z) return;
  node.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    m.geometry = m.geometry.clone();
    const p = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setX(i, stretchAll(p.getX(i), z));
    p.needsUpdate = true; m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere();
  });
}

/** Convierte un glTF JSON con buffer en base64 en un .glb binario. */
function jsonToGlb(json: { buffers?: { uri?: string; byteLength: number }[] }): ArrayBuffer {
  let bin = new Uint8Array(0);
  const uri = json.buffers?.[0]?.uri;
  if (uri?.startsWith("data:")) {
    const raw = atob(uri.slice(uri.indexOf(",") + 1));
    bin = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
    delete json.buffers![0].uri;
  }
  const pad = (n: number) => (n + 3) & ~3;
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jLen = pad(jsonBytes.length), bLen = pad(bin.length);
  const out = new Uint8Array(12 + 8 + jLen + (bin.length ? 8 + bLen : 0));
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, jLen, true); dv.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jLen); out.set(jsonBytes, 20);
  if (bin.length) { const o = 20 + jLen; dv.setUint32(o, bLen, true); dv.setUint32(o + 4, 0x004e4942, true); out.set(bin, o + 8); }
  jsonBytes = new Uint8Array(0);
  return out.buffer;
}
