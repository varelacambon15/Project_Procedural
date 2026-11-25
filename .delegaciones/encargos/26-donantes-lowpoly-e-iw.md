# Encargo 26 — Piezas donantes de las armas low poly y de Infinite Warfare (agente coder + Blender; modelo flash)

**Objetivo.** Sacar de los modelos que aportó el usuario (carpeta `Aportes propios/Armas animaciones y sonidos varios/models/weapons`) un lote de **piezas sueltas y accesorios** que el generador pueda montar, **modificadas para que no sean idénticas al original**. Convención: la de `raw/pack5` (leer `raw/pack5/LEEME_pack5.md`, `piezas_sueltas/piezas.json`, `accesorios/accesorios.json`): metros, +X boca, +Y arriba, origen centrado en X/Z y base Y=0, un material plano por pieza (`mat_<pieza>`), ancla y `seccion_union_m` por pieza. Salida nueva: `raw/pack7/` con la misma estructura (`piezas_sueltas/` + `piezas.json`, `accesorios/` + `accesorios.json`, `LEEME_pack7.md`).

**Herramienta ya hecha:** `.delegaciones/herramientas/leer-malla.cjs`:
`node .delegaciones/herramientas/leer-malla.cjs <modelo>.mdl --piezas <carpeta_salida>` escribe un OBJ por grupo de cuerpo + modelo (p. ej. `barrel__AKMBarrel.obj`, `stock__47Stock.obj`, `mag__RPKMag.obj`), ya en metros y con +X hacia la boca (importar en Blender con `forward_axis='X', up_axis='Z'`). Los modelos `c_lowpoly*.mdl` (carpeta `arccw/`) vienen ya partidos en grupos con nombre. Los `v_*_iw.mdl` (carpetas `iw_*`) traen el arma en UNA malla de 20.000-30.000 triángulos (hay que separar por islas con `Armas simplificadas/herramientas/islas.py` o `bmesh`) y sin LOD. Referencia de simplificación para IW: `.delegaciones/herramientas/simplificar_iw.py` (uso: blender -b --python simplificar_iw.py -- entrada.obj salida.obj 1500 0.02; render de comparación: render_obj.py) (descarta islas diminutas y lejanas, disuelve caras planas con ángulo 0,14 rad, decimado).

## Fase A — low poly (24 armas en `arccw/c_lowpoly*.mdl`; 22 accesorios en `arccw/atts/*.mdl`)
Elige piezas **variadas** (no 24 culatas AK iguales): objetivo **40-60 piezas** en total:
- 10-14 culatas (fusil, escopeta, subfusil, francotirador, plegables), 8-12 cargadores (curvos, rectos, de tambor, de caja larga), 8-10 guardamanos, 6-8 empuñaduras, 6-8 bocachas/frenos/supresores, 4-6 miras traseras/delanteras y 4-6 accesorios (de `atts`: miras Aimpoint/reflex/MRO como `accesorios/miras`; las empuñaduras `foregrip_*` son planos sueltos de 2 triángulos: DESCÁRTALOS).
- Descarta el grupo `studio` (brazos) y los de 0 mallas.
- Para cada pieza: inspecciónala en una captura (Blender `-b`, cámara ortográfica de lado, fondo claro) y descarta las rotas, vacías, de <40 triángulos o sin silueta reconocible.

## Fase B — Infinite Warfare (13 armas `iw_*/v_*_iw.mdl`)
Más corta: **10-16 piezas** en total (bocachas, supresores, culatas, guardamanos con raíles, cargadores, linterna/láser, miras) sacadas de las armas más limpias (`m1`, `emc`, `oni`, `stallion44`, `vpr`, `erad`). Máx. **1.500 triángulos por pieza**, **600 de media**. Descarta el cuerpo entero del arma y los brazos (mallas `clamped*`).

## Modificaciones OBLIGATORIAS (en las dos fases)
Ninguna pieza puede quedar igual al original. A cada una aplícale **al menos 2** de estas (en Blender, `bmesh`/modificadores), alternando para que no salgan todas iguales:
1. Escala no uniforme: largo ±10-20 %, alto o ancho ±8-15 %.
2. Cizalla o inclinación suave (culatas, cargadores: curvatura ±3-8°).
3. Quitar o añadir detalle: cortar ventilaciones o raíles, añadir 2-4 nervios/anillos (cilindros cortos), ranuras (extrusión hacia dentro), chaflán en bordes.
4. Espejado parcial (mitad delantera de la pieza espejada) o intercambio de una sección entre dos piezas del mismo tipo (p. ej. frente de una bocacha + cuerpo de otra).
5. Proporción de agarre/cuerpo distinta (más cónico, más cuadrado).
**Criterio de aceptación de la modificación:** el volumen del cuadro delimitador cambia ≥12 % respecto al original y en la captura de comparación (original | modificado, lado a lado) se aprecia a simple vista. Guarda esa captura por pieza en `raw/pack7/comparaciones/<id>.png` y un `modificaciones` (lista de los números aplicados) dentro de cada entrada del json. `origen` debe ser `lowpoly:<arma>` o `iw:<arma>` (solo interno, como `base_real`).

## Ids, materiales y registro
- Ids con prefijo `lp_` o `iw_` + categoría (`lp_cu_01`, `lp_ca_03`, `iw_bo_02`, …). Un material plano por pieza; **no** copies texturas (`.vtf`) ni materiales del origen.
- `triangulos` real (contar) y `anclas`/`seccion_union_m` como en pack5. Reutiliza la forma de calcularlos del pack5 (leer cómo los generó, buscando en `scripts/` o en `.delegaciones/noche/`).
- Registrar en `assets/weapons/manifest.json` solo si el flujo `npm run assets -- <prefijo>` del repo lo hace con packs de piezas sueltas (mirar cómo entró pack5/pack6). Si no está claro, NO registres: deja las piezas listas y documenta en `LEEME_pack7.md` qué falta.

## Restricciones y verificación
- No toques código del juego (`src/`) ni tests existentes. No commit, no instalar dependencias, no crear luces.
- Verificación: `npx tsc --noEmit` (no debe romper nada), un script o test nuevo `tests/pack7.test.ts` que compruebe para cada pieza del json: archivo existe y se abre, `triangulos` coincide, bbox coherente con `largo_m`, ids únicos, `triangulos` ≤ 1.500, `modificaciones` no vacío. `npx vitest run tests/pack7.test.ts`.
- Informe final: nº de piezas por categoría y por fase, lista de descartadas con motivo, `git status --short`, y 2 capturas de comparación de muestra.
- Si algo bloquea (p. ej. no se sabe registrar en el manifest), para y dilo en vez de improvisar. Escribe pasos intermedios en el `LEEME_pack7.md` para poder retomar.
