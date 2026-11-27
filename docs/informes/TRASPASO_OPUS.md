# Traspaso — trabajo de Opus sobre `docs/BRIEFS_OPUS.md` (actualizado 27/11/2026)

**Léelo entero antes de tocar nada.** Resume qué está hecho, en qué rama, qué ha validado el usuario, qué decisiones
siguen abiertas y cómo comprobar. El detalle de cada tarea está en su informe (`docs/informes/<tarea>.md`), que
está **en su propia rama**. Se actualiza al cerrar cada tarea o cuando el usuario valida algo.

## 1. Reglas del usuario (además de `CLAUDE.md`)
- Responder en español de España, tuteo. Al final de cada respuesta: «Modelo y esfuerzo: <modelo> <esfuerzo>, <motivo>».
- Una rama `opus/<tarea>` por tarea, desde `trabajo-24-11`. **Nunca** commit/push a `main` ni a `trabajo-24-11`; sin
  force push; sin pull requests salvo que los pida. Push a `opus/*` sí.
- No instalar dependencias sin permiso (autorizó `npm ci`). No tocar secretos, `CREDITS.md` ni `assets/weapons/CREDITS.md`.
- No cambiar valores esperados de tests existentes sin avisar. `npx tsc --noEmit` limpio. Tests por fichero.
- **Mirar las capturas uno mismo** a 960×470 y 1280×720, con armas reales, y describirlas con honestidad.
- Lo que el usuario valida queda por escrito (para armas: `docs/informes/armas_validado.md` en `opus/armas`).
- El usuario prefiere decisiones razonables y ver resultados; prueba cuando hay mucho hecho (pide .exe/release).

## 2. Estado por tarea
| Orden | Tarea | Rama (último commit) | Estado | Informe |
|---|---|---|---|---|
| 1.º | 13 Armas: posición, animaciones, gunplay | `opus/armas` (cd8a15e) | Hecha en 5 rondas con el usuario. Probó la v0.20.1: «animaciones mejoradas muchísimo, posiciones de algunas armas también» | `armas.md` + **`armas_validado.md`** |
| 2.º | 8 Suite de tests | `opus/tests` (21c4e45) | ✅ Hecha: suite en verde, de 22,6 a 5,2 min | `tests.md` |
| 3.º | 7 Sonidos | `opus/sonidos` (75dd8a7) | ✅ Hecha (sin verificar de oído: el contenedor no tiene audio) | `sonidos.md` |
| 4.º | 5 Retículas | `opus/reticulas` (02ce5f8) | ✅ Hecha | `reticulas.md` |
| 5.º | 1 Físicas Rapier | `opus/rapier` (af8ac4b) | ✅ Prototipo hecho, desactivable (sin fijar: solo en modo desarrollador) | `rapier.md` |
| 6.º | 2 Enemigos | `opus/enemigos` (sale de `opus/rapier`) | 🔧 **Fases 1 y 2 hechas**: sabueso, dron reparador, centinela, rodante artillero, bombardero, arañitas, mech pesado. Falta: humanoides del pack 14 (asesino, invocador, berserker) | `enemigos.md` |
| 7.º | 3 Campaña Hack | `opus/campana` (sale de `opus/integracion`) | 🔧 **Fases a y b hechas** (datos, guardado, motor con 8 objetivos; los 5 niveles se completan). Faltan c (UI en el hall) y d (jefe nuevo del nivel 5) | `campana.md` |
| — | 4 Ritmo, 6 Miras de hierro, 9 Props, 10 Rendimiento, 11 Auditoría del taller (solo documento), 12 Súperes | — | ⏳ Sin empezar, en ese orden | — |

Releases de prueba: **v0.20.1** (desde `opus/armas`) **v0.21.0** (desde `opus/integracion`, todo junto con la fase 1 de enemigos) y **v0.21.1** (más la fase 2 de enemigos y el arreglo del guardado); .exe, AppImage y APK, con
`.github/workflows/release.yml` (lanzamiento manual sobre una rama; usa la versión de `package.json`).

## 3. Siguiente paso concreto
**Tarea 2, resto** en `opus/enemigos` (fases 1 y 2 hechas y unidas en `opus/integracion`; la v0.21.0 lleva solo la fase 1): asesino,
invocador y berserker (diseños en `.delegaciones/PLAN_ENEMIGOS.md`; incinerador y granadero se quedan como
están; rodante explosivo = kamikaze actual). Modelos en `raw/pack13_robots/` (bombardero, arañita, mech pesado, con
`LEEME`) y `raw/pack14_humanoides/` (asesino…). Patrón a seguir (ya funciona con los tres primeros):
1. Copiar el GLB a `assets/enemigos/` y añadirlo a `FILE`/`MODEL_SCALE`/`zoneOf`/`buildProcedural` en
   `src/game/enemymodels.ts` (+X del GLB = frente; el envoltorio lo gira a +Z, que es el frente en el juego).
2. Tipo nuevo en `Shape` y en `KINDS` de `src/game/dummies.ts` (`cy`/`top` en metros ya escalados; `fly` si vuela).
3. Animación de sus `mov_*` en `Dummy.animModel`; lógica pura nueva en `src/game/enemyai.ts` con test en
   `tests/enemyai.test.ts`.
4. Ataque en `Waves.spawnAt` (`src/game/waves.ts`), datos en `src/data/waves.json`, aparición en `extraWave`.
5. Textos `dummy.<tipo>` ES/EN en `src/i18n.ts`. Capturas con `tools/capture/enemigos*.mjs` y mirarlas.
Pendiente de la fase 1: meter los enemigos nuevos en `raidgen.ts`/`hackgen.ts` (mejor con la tarea 3).

## 4. Rama de integración `opus/integracion` (27/11) y release v0.21.0
Une, sobre `trabajo-24-11`, por este orden: `tests` → `sonidos` → `reticulas` → `armas` → `enemigos` (trae `rapier`).
De ella sale la release **v0.21.0** para que el usuario pruebe todo junto. Conflictos resueltos a mano solo en
`src/game/main.ts`: se quedan los pasos por superficie (sonidos), el paso manual de capturas (uno solo) y la carga
perezosa de la física. Las tareas siguientes pueden partir de `opus/integracion` para no arrastrar conflictos;
si se arregla algo en una rama de tarea, volver a unirla aquí.

## 4 bis. Cómo se unieron las ramas
Todas salen de `trabajo-24-11` (6558c66) salvo `opus/enemigos`, que contiene `opus/rapier`. Orden sugerido para quien
integre (lo decide el usuario): `tests` → `sonidos` → `reticulas` → `armas` → `enemigos` (trae `rapier`).
Choques previsibles: **`src/game/main.ts`** (todas menos `tests`: son añadidos en zonas distintas, a mano), `gun.ts`
(`sonidos` y `armas`), `src/i18n.ts` (`reticulas` y `enemigos`), `dummies.ts` (solo `rapier`/`enemigos`).
`opus/armas` y `opus/rapier` añaden **el mismo** modo de paso manual a `main.ts` (`debug.manual`, `__game.step`): al
unir, quedarse con uno. Tras unir: `npx tsc --noEmit` y los tests de cada rama.

## 4 ter. Arreglos fuera de tarea (en `opus/integracion`)
- **Guardado (27/11)**: `parseSave` no copiaba `progress`, `supersOwned`, `raidsDone`, `reticles`, `armors` ni `worn`
  (se añadieron al formato desde el 20/11): al recargar se perdían nivel, súperes, armaduras y retículas. Arreglado
  con test en `tests/save.test.ts`. **Cualquier campo nuevo del guardado hay que copiarlo también en `parseSave`.**

## 5. Decisiones que esperan al usuario
- **Físicas**: ¿activadas por defecto para todos? ¿Se quedan las 6 cajas y 3 barriles del hall o solo para pruebas?
- **Armas**: retroceso (propuesta: −20 % de patada en subfusiles, más recuperación en ametralladoras; sin aplicar
  porque la sensación actual gusta). Pendientes de su opinión: escopetas, ametralladora, subfusil, revólver (ver
  `armas_validado.md`), inspección de pistola.
- **Retículas**: hitos y orden de desbloqueo (`src/data/reticles.json`).
- **Sonidos**: volúmenes elegidos a ojo; ajustarlos cuando los oiga.
- **Tests**: partir `generator.test.ts` en dos o bajar sus lotes (esto último cambia la cobertura).
- **Enemigos**: altura del dron reparador (2,4 m; propuesta 1,8 m si cuesta verlo).

## 6. Cómo comprobar
- `npm ci` (ya hecho en el clon), `npm run dev` (puerto 5199). El juego expone `window.__game`.
- Capturas: `tools/capture/README_guiones.md` (aquí) y `tools/capture/README.md` + `vmcap.mjs` (en `opus/armas`).
  En este contenedor: Chromium de Playwright con `--use-gl=angle --use-angle=swiftshader`; `NODE_PATH=/opt/node-tools/node_modules`.
- Para trabajar en varias ramas a la vez se usaron `git worktree` con `node_modules` enlazado al del clon principal.
- Lecciones: las capturas en tiempo real con render por software engañan (usar el paso manual); la primera captura de
  un arma a veces sale negra (fallo del guion: repetir); un `rm` con variable en la ruta lo bloquea la comprobación de
  seguridad (usar rutas literales).
