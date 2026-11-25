# Encargo 56 — Integrar el modelo de la torreta de la super «sentry»
Modelo hecho en el 55: `assets/equipo3d/sentry_super.glb` (≈1,9 m, 2.832 tris). Hoy `src/game/superfx.ts` (case "sentry", ~línea 259) construye la torreta con cajas y cilindros; `sentryTick` (~línea 482) usa `getObjectByName("head")` y `("tip")`.
## Hacer
1. Carga el GLB con el mismo patrón que `src/game/gadgetmodel.ts`/`grenademodel.ts` (cargador GLB con CACHÉ y RESPALDO procedural: si no carga, se usa la torreta actual de cajas, sin romper nada).
2. Orientación: el GLB mira a +X (cañón); el juego usa −Z. Gira el modelo al cargarlo (grupo envoltorio) para que el cañón apunte a −Z y `head` siga siendo el grupo que gira en yaw/pitch. Conserva nombres `head` y `tip` accesibles por `getObjectByName` (el `tip` del GLB es una malla de 14 mm: úsalo como punto de disparo o crea un Object3D `tip` en su posición).
3. Animación: retroceso de `mov_cañon_l`/`mov_cañon_r` al disparar (alternando), antena `mov_antena` con leve vaivén, y despliegue al plantarla (patas `mov_patas`, escala/elevación breve ~0,4 s). Sin luces reales nuevas.
4. Que todo se retire con `scene.remove` como hasta ahora (no filtrar geometría; reutiliza geometrías/materiales del GLB cacheado).
## Prueba
`tsc` limpio; un test por fichero (nuevo `tests/sentry_model.test.ts`: el GLB se resuelve, tiene `head`, `mov_cañon_l/r`, ≤3.000 tris; respaldo funciona). Captura con Playwright de la torreta plantada (carga el juego, activa la super sentry vía `window.__game`) en `.delegaciones/capturas/sentry_super_juego.png`. No cambies valores esperados de tests; no suite completa; sin commit ni instalaciones; no toques animaciones de armas (`gun.ts`, `poses`).
Informe de 10 líneas.
