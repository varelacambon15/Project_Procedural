// Torreta de la super «sentry» (encargo 56): el GLB existe, se carga con head/cañones/tip orientados a −Z, no pasa de
// 3.000 triángulos y el respaldo de cajas sigue funcionando si falta el modelo.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as THREE from "three";
import { SENTRY_MODEL_HEIGHT, SENTRY_MODEL_URL, buildSentryFallback, loadSentryModel } from "../src/game/sentrymodel";

// El GLTFLoader carga con `new Request(...)` y `fetch`: en Node se sirven los assets desde el disco y las rutas
// relativas se resuelven contra un origen local ficticio.
const root = resolve(__dirname, ".."), realFetch = globalThis.fetch, RealRequest = globalThis.Request;
const absolute = (u: string) => (/^[a-z][a-z0-9+.-]*:/i.test(u) ? u : new URL(u, "http://localhost/").href);
globalThis.Request = class extends RealRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === "string" ? absolute(input) : input, init); }
} as typeof Request;
globalThis.ProgressEvent ??= class extends Event { lengthComputable = false; loaded = 0; total = 0; constructor(type: string, init?: { lengthComputable?: boolean; loaded?: number; total?: number }) { super(type); Object.assign(this, init); } } as unknown as typeof ProgressEvent;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = absolute(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (!url.startsWith("http://localhost/")) return realFetch(input as RequestInfo, init);
  const buf = await readFile(resolve(root, "assets", url.replace(/^http:\/\/localhost\//, "")));
  return new Response(buf, { status: 200, headers: { "content-type": "model/gltf-binary" } });
}) as typeof fetch;

type GlbJson = {
  nodes?: { name?: string }[];
  meshes?: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
  accessors?: { count: number }[];
};

/** JSON del contenedor GLB (cabeza + chunk JSON), sin cargar el modelo. */
function glbJson(): GlbJson {
  const buf = readFileSync(resolve(root, "assets", SENTRY_MODEL_URL.replace(/^\.\//, "")));
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(buf.readUInt32LE(4)).toBe(2);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a); // chunk JSON
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as GlbJson;
}

describe("torreta de la super sentry", () => {
  it("el GLB es válido, tiene head/mov_cañón_l+r y ≤3.000 triángulos", () => {
    const j = glbJson();
    const names = (j.nodes ?? []).map((n) => n.name);
    for (const n of ["head", "tip", "mov_cañon_l", "mov_cañon_r", "mov_antena", "mov_patas"]) expect(names).toContain(n);
    let tris = 0;
    for (const m of j.meshes ?? []) for (const p of m.primitives) {
      tris += (p.indices !== undefined ? j.accessors![p.indices].count : j.accessors![p.attributes.POSITION].count) / 3;
    }
    expect(tris).toBeGreaterThan(0);
    expect(tris).toBeLessThanOrEqual(3000);
  });

  it("el GLB se resuelve, se apoya en el suelo y el cañón mira a −Z", async () => {
    const model = await loadSentryModel();
    expect(model).not.toBeNull();
    const g = model!;
    for (const n of ["head", "mov_cañon_l", "mov_cañon_r", "tip"]) expect(g.getObjectByName(n), n).toBeTruthy();
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
    expect(box.min.y).toBeGreaterThan(-0.02);
    expect(size.y).toBeCloseTo(SENTRY_MODEL_HEIGHT, 1);
    const tipObj = g.getObjectByName("tip")!, tip = tipObj.getWorldPosition(new THREE.Vector3());
    expect(Math.abs(tip.x)).toBeLessThan(0.12); // cañón sobre el eje, no hacia +X
    expect(tip.z).toBeLessThan(-0.4); // delante, en −Z
    // `head.rotation.y` sigue la convención del juego: 0 → −Z y π → +Z (la puntería no necesita corrección).
    const head = g.getObjectByName("head")!, aim = () => {
      g.updateMatrixWorld(true);
      return tipObj.getWorldPosition(new THREE.Vector3()).sub(head.getWorldPosition(new THREE.Vector3())).normalize();
    };
    head.rotation.y = 0; expect(aim().z).toBeLessThan(-0.95);
    head.rotation.y = Math.PI; expect(aim().z).toBeGreaterThan(0.95);
  });

  it("el respaldo de cajas conserva head, tip y un cañón animable", () => {
    const g = buildSentryFallback(0x6ad8ff);
    for (const n of ["head", "tip", "mov_cañon_l", "mov_patas"]) expect(g.getObjectByName(n), n).toBeTruthy();
    g.updateMatrixWorld(true);
    const tip = g.getObjectByName("tip")!.getWorldPosition(new THREE.Vector3());
    expect(tip.z).toBeLessThan(0);
    const box = new THREE.Box3().setFromObject(g);
    expect(Number.isFinite(box.min.y)).toBe(true);
  });
});
