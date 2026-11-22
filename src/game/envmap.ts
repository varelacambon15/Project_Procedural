// Mapa de entorno (PMREM, generado por código desde un interior de estudio): no es una luz — no cuenta para las 8
// luces de la escena ni cambia los programas al moverlo — pero hace que metal, polímero y suelos devuelvan el entorno
// en vez de verse planos. La intensidad se escala con la calidad gráfica (ENV_INTENSITY) y se aplica a todos los
// materiales estándar de la escena; cada material puede matizarla con `userData.envBoost` (las armas, para no perder
// su brillo al bajar la calidad).
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Quality } from "./settings";

/** Intensidad del mapa de entorno por calidad gráfica: Bajo casi plano, Medio equilibrado, Alto reflejos completos. */
export const ENV_INTENSITY: Record<Quality, number> = { low: 0.3, medium: 0.5, high: 0.8 };

/**
 * Intensidad efectiva para una calidad y una hora (día/noche). De noche el entorno de interior cede protagonismo al
 * neón, así que baja algo. `boost` multiplica por material (las armas lo usan para mantener su look).
 */
export function envIntensityFor(quality: Quality, night = false, boost = 1): number {
  return ENV_INTENSITY[quality] * (night ? 0.7 : 1) * boost;
}

/** Genera el mapa de entorno (una vez por renderizador; se comparte escena, arma y miniaturas). */
export function makeEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  return new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
}

/**
 * Aplica una intensidad de entorno a todos los materiales estándar de un subárbol (los Lambert no llevan envMap y
 * se quedan como están). Idempotente y barata: se puede re-aplicar cada pocos fotogramas para cubrir lo que se
 * añade después (armas, enemigos) sin coste de compilación.
 */
export function applyEnvIntensity(root: THREE.Object3D, intensity: number) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of ([] as THREE.Material[]).concat(mesh.material)) {
      const sm = m as THREE.MeshStandardMaterial;
      if (sm.isMeshStandardMaterial) sm.envMapIntensity = intensity * ((sm.userData.envBoost as number | undefined) ?? 1);
    }
  });
}
