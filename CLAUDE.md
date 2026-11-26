# CLAUDE.md — Project Procedural / Proving Grounds

Looter-shooter FPS procedural. TypeScript + Three.js r160 + Vite + Vitest; Electron (PC) y Capacitor (Android). Repositorio PRIVADO.

## Cómo trabajar con el usuario
- Habla en **español de España, tuteo**. Responde siempre en español. Textos de juego siempre en español e inglés (`src/i18n.ts`, `src/i18n-menus.ts`).
- Al final de cada respuesta: «Modelo y esfuerzo: <modelo> <esfuerzo>, <motivo en una frase>».
- El usuario prueba el juego cuando hay mucho implementado y pulido; prefiere que tomes decisiones razonables y le enseñes capturas o resultados. Sus notas de prueba reales quedan en `Documentos\ProvingGrounds\sesiones\` (JSON de eventos + capturas), no en el repo.
- **Antes de dar por bueno cualquier cambio visual, MIRA las capturas tú mismo** y describe con honestidad lo que ves. Las métricas «verdes» ya han dado resultados feos. Prueba a 960×470 y a 1280×720 y con las armas reales, no solo semillas sueltas.
- Sin `git commit`/`push` a `main`, sin borrados masivos, sin instalar dependencias sin que lo pida. Trabaja en ramas `opus/<tarea>` desde `trabajo-24-11`. No toques secretos.

## Decisiones ya cerradas (no re-litigar)
- Estilo visual: el usuario dijo que era «muy pobre, parece de juguete y plastilina». Le gusta la calidad de los modelos hechos en Blender (`.delegaciones/blender/equipo/_comun.py` y los packs `raw/pack*`). Extender esa calidad: enemigos, props, equipamiento, soldado, brazos.
- Una sola mira por arma; sin desalineación de miras; escopetas: la dispersión al apuntar está bien, NO tocar. Puntitos de tritio/rojos solo en armas futuristas.
- Retículas unificadas (una `#reddot` por óptica, catálogo en `src/game/reticles.ts`).
- Munición de reserva: se queda como está. Lanzagranadas y lanzallamas no son necesarios.
- Hack → campaña por niveles (5 niveles, jefe final con legendaria garantizada). Combate con más ritmo.
- Enemigos nuevos aprobados (`.delegaciones/PLAN_ENEMIGOS.md`). Incinerador y granadero se quedan como están. Rodante explosivo = kamikaze actual. Desmembramiento en píxeles (`Dummy.dismember`): MANTENER, también con ragdoll.
- Motor: no migrar por ahora; probar Rapier y según el informe valorar Godot/Unity/Babylon.
- Brazos: sin verde. Manga gris pizarra `#4b5462`, guante coyote `#43392f`, parche naranja.
- El balanceo de armas al andar y la respiración actuales GUSTAN: no tocar.
- Animaciones de armas: los recorridos remapeados de otros juegos (`poses.json`, `handpath.ts`) se vieron antinaturales (el usuario: «terribles e inaturales, peores que las de antes»); hay un interruptor `REAL_PATHS_OFF` en `gun.ts`. **El área «posición de las armas, animaciones y gunplay» (`arms.ts`, `armmodel.ts`, `gun.ts`, `anim.ts`, `handpath.ts`, `vmfit.ts`, `poses.json`, `anim.json`) es ahora tuya (tarea 13 de `docs/BRIEFS_OPUS.md`) y es la PRIORIDAD de la semana.** Solo `superfx.ts` y `sentrymodel.ts` (torreta de la super) siguen siendo del director.

## Reglas duras
- No cambies valores esperados de tests existentes sin avisar. `npx tsc --noEmit` limpio. Tests por fichero (`npx vitest run tests/<fichero>`); la suite completa es lenta (la tarea 8 de `docs/BRIEFS_OPUS.md` la arregla).
- No edites `CREDITS.md` ni `assets/weapons/CREDITS.md`. No añadas luces reales nuevas a la escena.
- Presupuesto de triángulos: soldado ≤4.000, robots ≤3.500, props ≤3.000, equipamiento ≤3.000, jefes ≤6.000.
- Convención GLB (modelos propios): metros, +X frente, +Y arriba, origen en el suelo, malla por pieza, pivotes `mov_*` para animar por código, Principled, sin texturas/luces/cámaras.

## Estructura útil
- `src/game/` juego (dummies = enemigos, gun = arma en primera persona, arms = brazos, raidgen/hackgen/arenagen = niveles, save = guardado, ui/ = menús y taller).
- `src/weapons/` generador procedural de armas. `src/data/` datos. `tests/` tests. `raw/pack*` modelos GLB propios y donantes. `assets/` recursos del juego.
- `.delegaciones/` notas de trabajo: `PROGRESO.md`, `TRASPASO_COMPLETO_24-11.md`, `PLAN_ENEMIGOS.md`, `PLAN_COMBATE_Y_CAMPANA.md`, `LISTA_PENDIENTES.md`, `encargos/` (47–59), tablas de poses, referencias. `docs/` documentación (`ESTADO.md`, `DISENO.md`, `ECONOMIA.md`).
- Trabajo asignado a esta sesión: `docs/BRIEFS_OPUS.md`. **Empieza por la tarea 13 (posición de armas, animaciones y gunplay)**; el resto de tareas (1–12) van después, en el orden recomendado.
- El juego expone `window.__game` (en `src/game/main.ts`) para pruebas con Playwright; dev server `npm run dev` (puerto 5199).
