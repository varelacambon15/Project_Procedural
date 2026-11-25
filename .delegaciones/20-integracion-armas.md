# Encargo 20 — Integrar en el juego las armas nuevas de `Armas separadas/`
Agente: coder, modelo mimo-v2.6-pro. Idempotente: se puede ejecutar varias veces.
## Contexto
El chat de Blender deja armas adaptadas en `Armas separadas/<NOMBRE>/` (glb ensamblado, `piezas/`, `accesorios/`, `manifest.json`, `hoja.png`, `informe.md`). Solo son integrables las carpetas con el archivo `OK.flag` (pasaron un validador automático).
El juego carga packs desde `raw/<pack>/` convertidos a `assets/weapons/` (kit39 y packs 2–5; ids `x-p4-…`). Lee: `docs/ESTADO.md` (rondas 16–19 y 36), `docs/ENCARGO_KITS.md`, `raw/pack4/LEEME_pack4.md`, `tools/weapon-jobs.mjs`, `tools/convert/convert.js`, `tools/build-assets.mjs`, `src/weapons/kit.ts`, `src/weapons/generator.ts` (`RETIRED`, `WHOLE_OUT`, eras, `actionHint`).
## Pasos
1. Lista las carpetas con `OK.flag` que NO estén en `raw/pack6/INTEGRADAS.txt` **y que NO tengan un archivo `NO_INTEGRAR.txt`** (decisión del director: duplicados de armas ya existentes; se omiten). Si no hay ninguna, termina diciéndolo.
2. Para cada una: cópiala a `raw/pack6/<NOMBRE>/` (con su `manifest.json`, glb y piezas); crea o actualiza `raw/pack6/catalogo.json` con el mismo esquema que `raw/pack4/catalogo.json` y `raw/pack6/LEEME_pack6.md`.
3. Regístralas como trabajos de conversión (id `x-p6-<nombre>`) en `tools/weapon-jobs.mjs` y ejecuta `npm run assets -- x-p6-` (necesita Playwright; si no está disponible, PARA y repórtalo: no escribas glb a mano).
4. Asegura que el generador las ve (tipo, era, `accion`, accesorios de serie) y que salen en el sorteo y en el banco. Respeta `RETIRED` y `WHOLE_OUT`. **Si el `informe.md` dice que es casi idéntica a un modelo ya existente y NO tiene `NO_INTEGRAR.txt` (el director aún no la ha revisado), intégrala y añade una línea `# DUPLICADO DE <id>` en `INTEGRADAS.txt`. Las que tienen `NO_INTEGRAR.txt` ya se excluyeron en el paso 1: no las toques.**
5. Registra cada arma integrada en `raw/pack6/INTEGRADAS.txt`.
6. Tests: añade un test nuevo (p. ej. `tests/pack6.test.ts`) que compruebe para cada `x-p6-*`: carga, anclas esperadas, menos de 6.000 triángulos y que `generate()` puede producirla. No cambies los valores de tests existentes (si un test de recuento se rompe por añadir armas, avísalo en el informe en vez de editarlo).
7. Hoja de contacto con `window.__bench.lotSheet(n, tipos, 1, "", "x-p6-")` en `C:\Github\_noche\capturas\20\`.
## Restricciones
No tocar `CREDITS.md` ni preguntar por licencias. No modificar los glb originales de `Armas separadas/`. Respeta las reglas de armas del usuario: naturales y pulidas, no amalgamas; adaptar mejor que descartar; el bullpup es variante de fusil.
