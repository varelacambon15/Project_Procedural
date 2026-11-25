# Hoja de ruta para OpenCode Go (preparada por el director, 22/11/2026)
Objetivo del usuario: menor coste global + mayor velocidad + mayor calidad. Los tokens de Claude valen más que los de Go: Go ejecuta lo largo y repetitivo; el director solo diseña, juzga con una imagen/diff y verifica.

## Reglas para TODAS las tandas
- Antes de lanzar: `bash .delegaciones/comprobar_cuota.sh` (una sola sonda). Si dice LIMITE, no lanzar nada.
- Modelo: `opencode-go/mimo-v2.6-flash` por defecto; `mimo-v2.6-pro` SOLO tras un fallo real de validación y una sola vez. Nada de gemini-4-argon sin orden del usuario.
- Tanda = 2-3 tareas, tope 45 min por tarea. Al terminar: el director mira UNA imagen o un diff antes de lanzar la siguiente.
- Revisar la primera entrega a los ~15 min; si el encargo está mal, corregir el encargo, no subir de modelo.
- Al primer aviso de límite (5 h o semanal): parar, no reintentar en bucle ni dejar sondas durante días. Avisar al usuario.
- Medir el gasto de cada tanda con `opencode stats` y anotarlo en `C:\Github\_noche\gasto_go.md`.
- Sin commit ni push. Sin tocar secretos. Sin editar CREDITS.md.

## Tanda 1 — Integración de las armas simplificadas (coder, flash, ~30 min)
Fuente: `Armas simplificadas/<N>/` (AUTOMAG44, MAUSER, MP412REX, GSERIES, FX05; OK.flag; piezas y manifest ya con triángulos actualizados).
1. Copiar a `raw/pack6/<N>/` (sustituye AutoMag y Mauser; añade MP412REX, GSERIES, FX05) y actualizar `raw/pack6/catalogo.json` (tomar los campos del manifest de cada arma, `triangulos_total` actualizado) y `INTEGRADAS.txt`.
2. `npm run assets -- x-p6-` (necesita Playwright; si no está disponible, PARAR y avisar).
3. `npx tsc --noEmit` y `npx vitest run tests/pack6.test.ts`. El test existente debe pasar; no editar valores esperados.
4. Capturas en `C:\Github\_noche\capturas\integracion\`: cada arma en mano en el juego (hoja `window.__bench.lotSheet(n, tipos, 1, "", "x-p6-")`) + una hoja con 4 armas `q-*` al lado para comparar estilo.
Revisión del director: una imagen. Criterio: encajan en estilo con las bases `q-*`; miras y anclas correctas.
NO integrar: MK23MOD0, SMGSUPP, M4LVOAC (`NO_INTEGRAR.txt`).

## Tanda 2 (REVISADA 22/11) — Armas pendientes como DONANTES de piezas (decisión del usuario)
No todas las armas pasadas tienen que servir como base: se pueden quedar solo sus **piezas valiosas** (cañones, guardamanos, culatas, cargadores, bocachas, accesorios) y descartar el arma base. Menos coste que separar y decimar un arma entera.
- **M4A1 Mk II** (31.404 tris, 1.977 islas de geometría; escala ≈ 0,073 m/unidad): donante. Candidatas halladas: culata (≈3.800 tris), dispositivo de boca muy detallado (≈6.200 tris: decimar mucho), pieza superior con raíles (≈7.500), cargador (≈3,4 u de alto), cañón (≈930) y múltiples fragmentos de guardamanos.
- **AK15 y AR-15 Hera**: valorar uno a uno: base completa o donante (cañones, culatas, guardamanos con raíles).
- **Duplicados ya separados** (MK23MOD0, SMGSUPP, M4LVOAC): aprovechar sus accesorios sueltos: LAM láser/linterna y silenciador del MK23 (→ ranura **Módulo** y boca), supresor, holográfica y agarre vertical del SMGSUPP (→ boca, mira y bajo el cañón).
Receta: inspeccionar islas con Blender CLI (`islas.py`), agrupar por caja y posición, elegir 3–6 piezas por donante, exportar como piezas sueltas con anclas y sección de unión según la convención de packs (ver `raw/pack5/piezas_sueltas` y `accesorios`), simplificar con `simplificar_carpeta.py` y validar compatibilidad de mezcla. Revisión del director: una hoja por donante con las piezas montadas en 2–3 armas distintas.

## Tanda 3.0 — Retomar el paso 14 (efectos de combate)
Estado (22/11 16:15): el paso 14 quedó FALLIDO y revertido en los archivos rastreados. Quedan inertes y probados (9 tests verdes) `src/game/fxpool.ts`, `src/game/combatfx.ts` y `tests/fxpool.test.ts`. El parche completo (todo el diff vs 0.19.0, no solo el 14) está en `.delegaciones/noche/fallidos/14-fx.patch`; los hunks propios del 14 están en gun.ts, dummies.ts, waves.ts, game.css e index.html (sin tocar por otros pasos) y en parte de main.ts.
Tarea (coder, flash): conectar `combatfx`/`fxpool` al juego (gun.ts, dummies.ts, waves.ts, main.ts) con los topes de `fxpool.ts`, sin luces reales; sacar capturas de fogonazo, impactos y casquillos. Usar el parche solo como referencia. Verificar build + vitest ligero.

## Tanda 3 — Visual (por orden de impacto; usar los encargos existentes, uno por tanda)
1. (HECHO por el trabajador del paso 13; ver capturas/13/fix2-hall.png) Suelo del hall: aceptable, sin quemarse.
2. `17-atmosfera-iluminacion.md` → `14-fx-combate.md` → `15-hud-ui.md` → `16-animacion-sensacion.md`.
3. Después: 06, 07, 18, 09, 05 (reducido), 04, 08, 11, 19.
Cada encargo: capturas antes/después con las mismas semillas; build y tests ligeros (`--exclude "**/generator.test.ts"`) salvo pasos que toquen armas.

## Qué NO se delega
Juzgar si algo queda bien (lo hace el director con una imagen), decisiones de estilo, cualquier commit/publicación.

## Actualización 22/11 (noche): orden de las primeras tandas al reiniciarse la cuota (lunes 01:00 hora de Madrid)
Modelo por defecto `deepseek-v4.1-flash` (el más barato de la cuota: ~0,15 % del mensual por millón de tokens de entrada y ~0,6 % por millón de salida; la caché cuesta casi nada). Estimación orientativa: una tanda razonable de flash cuesta entre ~0,3 % y ~1 % del mensual. Objetivo semanal ≈ 10–12 %. No usar `gemini-4-argon` ni `step-5`; `mimo-v2.6-pro` solo como excepción.
1. **Encargo 24** — conectar los sonidos nuevos (pasos, salto, puños, rebote de granada). Pequeño.
2. **Encargo 23** — poses reales de la mano en la recarga de fusil (piloto). Mediano.
3. Efectos de combate (paso 14, retomar) con impactos de bala por material.
4. Miras restantes: modelos con la telescópica metida en la malla (Sentry, Longshot, ED-16) y revisión de agarre (feedback de la sesión 1).
Medir con `opencode stats` antes y después de cada tanda; revisar yo una imagen o un diff entre tandas.
