# Tarea 2 — Enemigos nuevos, fases 1 y 2 (`opus/enemigos`, sale de `opus/rapier`)

## Qué se ha hecho
Tres enemigos completos de `PLAN_ENEMIGOS.md` con los modelos de Blender del pack 13 (copiados a `assets/enemigos/`):

| | Modelo | Comportamiento | Aviso (telegrafía) | Punto débil |
|---|---|---|---|---|
| **Sabueso** (340 PV, 5,6 m/s) | `enemigo_sabueso.glb` ×1,2 | Jaurías de 2–3. De lejos no va recto: abre hacia un flanco; cada uno muerde por su lado | Se agacha 0,32 s con los ojos encendidos y salta (×4,2 velocidad) | Cabeza (cráneo, visor, mandíbula) |
| **Dron reparador** (240 PV, vuela a 2,4 m) | `enemigo_dron_reparador.glb` ×1,15 | Busca al aliado más herido (30 m), se queda a 5 m y le cura un 5 % cada 0,6 s. Sin heridos, flota a 12 m de ti | Brazo soldador baja, haz y chispas verdes visibles | Cámara delantera |
| **Centinela** (900 PV) | `enemigo_centinela_flotante.glb` ×2,1 | Flota y dispara tres esferas en abanico cada 2,6 s. Gira despacio (0,9 rad/s) y solo dispara cuando ya te encara | Las luces cian y el anillo se aceleran 0,75 s antes del disparo | Escudo frontal (8 % de daño): hay que rodearlo; sensor de arriba |

- **`src/game/enemymodels.ts`**: carga y caché de los GLB (patrón de `gadgetmodel.ts`), precarga al arrancar. Respaldo
  procedural con las mismas piezas y pivotes `mov_*` si el GLB no llega; si llega tarde, se cambia en caliente.
  Las mallas del modelo son las cajas de impacto: la zona sale del nombre de la pieza (`zoneOf`).
- **`src/game/enemyai.ts`** (lógica pura): `flankPoint`, `pickHealTarget` (lo usan también los médicos),
  `turnToward`, `chargeLevel`, `pounceState`.
- **Animación por pivotes**: galope del sabueso (patas delanteras contra traseras, cabeceo), mandíbula al morder,
  patas recogidas al agacharse y estiradas en el salto; rotores y brazo del reparador; anillo y retroceso del cañón
  del centinela. Los ojos/luces se avivan en cada aviso.
- **Oleadas**: sabuesos desde la 1.ª generada, reparador desde la 2.ª, centinela desde la 3.ª (`extraWave`).
  Textos ES/EN (`dummy.hound/repairer/sentinel`).

![modelos](img/enemigos_modelos.jpg)
![avisos: agachado, salto, cura, carga](img/enemigos_avisos.jpg)
![pelea (1280×720 y 960×470)](img/enemigos_pelea.jpg)

## Tests
`tests/enemyai.test.ts` (5): flanqueo, fases del salto, elección de curado, giro y carga, zonas por nombre.
Siguen en verde waves, raid, hack, defense, i18n y physics. `npx tsc --noEmit` limpio. Triángulos: 3.424 / 2.628 /
3.476 (presupuesto de robots: 3.500).

## Lo que no me convence (honesto)
- El sabueso, cuando muerde de cerca, asoma por el borde de la pantalla y tapa poco; está bien, pero no tiene
  animación de golpe en el jugador (solo el daño).
- El reparador a 2,4 m queda alto y pequeño desde el suelo; si cuesta verlo, lo bajaría a 1,8 m.
- Médico: ahora mide la distancia en el suelo (antes en 3D): con aliados al mismo nivel es igual.
- Aún no salen en incursiones ni en el Hack (`raidgen`/`hackgen`): lo meto con la campaña (tarea 3).
- El respaldo procedural está probado solo por código (sin captura): con el GLB presente no se ve nunca.

## Fase 2 (27/11): cuatro robots más
| | Modelo | Comportamiento | Aviso |
|---|---|---|---|
| **Rodante artillero** (420 PV) | `enemigo_rodante.glb` ×1,25 (pack 10) | Monociclo: rueda hasta 14 m y dispara ráfagas de 4 balas; la torreta te sigue | Luces naranjas 0,5 s antes de la ráfaga |
| **Dron bombardero** (380 PV, vuela a 4,2 m) | `enemigo_dron_bombardero.glb` ×1,5 | Se pone sobre ti y suelta una bomba (22 de daño en 2,6 m) cada 3,4 s; la bahía queda vacía y «recarga» | Círculo rojo en el suelo que se llena 1,2 s y la bomba que cae |
| **Arañitas** (45 PV) | `enemigo_aranita.glb` ×1,6 | Enjambre de 6+ que corre a 6,2 m/s y muerde flojo (4) | — (mueren de un tiro) |
| **Mech pesado** (6.500 PV, mini-jefe con barra de jefe) | `enemigo_mech_pesado.glb` ×1,25 (3,3 m) | Anda despacio, gira con retraso; ametralladora de 9 balas y cada 7,5 s andanada de 4 misiles: uno donde estás y tres en anillo | Lanzamisiles que sube y brilla 0,8 s; círculos rojos 1,4–1,85 s |

- Explosiones enemigas genéricas en `Waves.strike` (círculo de aviso, proyectil que cae y daño con caída
  `blastDamage`); el efecto lo pinta `gun.explode(..., fxOnly)` y no hiere a otros enemigos.
- Aparición en oleadas generadas: rodante desde la 1.ª, arañitas desde la 2.ª, bombardero desde la 3.ª, mech en la
  4.ª, 6.ª, 8.ª… (no coincide con el jefe de cada 5).
- Tests: `strikePattern` y `blastDamage` en `tests/enemyai.test.ts` (6 tests en total).
- Triángulos: el rodante del pack 10 tiene **3.956** (pasa de 3.500 para robots: habría que recortarlo en Blender);
  mech 5.824 (≤ 6.000 de jefe); bombardero 3.464; arañita 1.404.

![fase 2, modelos: mech, bombardero, rodante, arañita](img/enemigos_fase2_modelos.jpg)
![fase 2: ráfaga, círculos de misiles, bomba cayendo, enjambre](img/enemigos_fase2_pelea.jpg)

Fase 2, honesto: el mech no tiene cabina como punto débil (el GLB tiene solo 5 mallas: torso, brazos y piernas);
los círculos de aviso, desde dentro, se ven como arcos rojos en el suelo (se entienden, pero un sonido de alarma
ayudaría); las arañitas no saltan.

## Siguiente
Humanoides especiales del pack 14 (asesino, invocador, berserker; granadero e incinerador se quedan como están):
usan el cuerpo base del soldado en GLB, que hoy no está integrado (los humanoides son procedurales); conviene
decidirlo con la tarea 3. Jefes nuevos (Colosus, Reina araña, Núcleo) solo si hay tiempo.
