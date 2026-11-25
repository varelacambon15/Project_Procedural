# Encargo 30 — Mano de apoyo: encuadre en pantalla y anclajes que faltan

Problema medido (23/11/2026): el perfil de agarre de las armas largas es a dos manos, pero en primera persona la mano de apoyo queda en la esquina inferior derecha casi fuera de pantalla y sin antebrazo visible, así que parece que van a una mano. Además hay armas sin anclaje de la mano de apoyo: pistolas con culata (anclaje `frame` ausente en 7 de 19), escopetas de bombeo (`pump` ausente 7 de 10) y con agarre vertical (`vgrip` ausente 4 de 5), y algún arma con coordenadas inválidas (NaN/Infinity, p. ej. un subfusil con cargador). Cuando falta el anclaje, `at()` en `src/game/gun.ts` (~línea 965) cae a `A.grip` (la mano izquierda queda encima de la derecha).

Herramientas ya hechas (copias en `.delegaciones/herramientas/capturas/`, usan Playwright de `C:/Users/varel/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright` y el servidor de desarrollo en http://localhost:5199, que ya está levantado):
- `fp.cjs <prefijo> <tipos...>`: captura la vista en primera persona de un arma generada (seed 11) por tipo (rifle lmg smg shotgun sniper pistol revolver...).
- `manos.cjs`: mide por clase la distancia de la mano de apoyo a la empuñadura y los anclajes ausentes/inválidos.
- Posición en cadera: `src/data/anim.json` (`hip` por clase: x≈0.14 a la derecha, y≈-0.14).

Tareas:
1. **Anclajes que faltan** (`src/weapons/assembler.ts` ~líneas 851-881 y `at()` en gun.ts): si falta `frame`, `pump`, `vgrip` o `mag`, usar `front`/`support` (guardamanos), nunca la empuñadura en armas largas ni en pistolas con culata. Proteger contra NaN/Infinity (si una coordenada no es finita, usar `support`).
2. **Pistola o revólver con culata de hombro**: no pueden tener agarre a una mano (`none`) en `src/weapons/grip.ts`: las variantes `one` y `switch` no se ofrecen con culata (`stock`), solo las de dos manos.
3. **Encuadre de la mano de apoyo**: que en la cadera la mano izquierda entre en pantalla con parte del antebrazo visible en fusiles, ametralladoras, subfusiles, escopetas y francotiradores. Ajusta primero los valores de `hip` en `src/data/anim.json` (acercar el arma al centro, p. ej. x de 0.14 hacia 0.10 y un poco más arriba) y, si no basta, lo mínimo en `gun.ts`. Que al apuntar (ADS) no cambie nada.
4. Tests: añade `tests/handhold.test.ts` con (a) ninguna pistola/revólver con culata tiene hold `none`, (b) en 300 armas de cada clase ninguna tiene anclaje no finito. No cambies los valores esperados de tests existentes; si alguno falla por el ajuste de `hip`, para y cuéntalo.
5. Capturas: antes y después con `fp.cjs` (rifle, lmg, smg, shotgun, sniper) guardadas en `.delegaciones/capturas/agarres_antes_*.png` y `agarres_despues_*.png`.

Restricciones: no toques generador de armas, culatas, ni Blender. Sin commit ni instalaciones. `npx tsc --noEmit` limpio y `npx vitest run tests/handhold.test.ts tests/grip.test.ts tests/anim.test.ts` en verde. Informe de 10 líneas con ficheros tocados.
