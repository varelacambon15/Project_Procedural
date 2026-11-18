# Pack 5 — armas y piezas nuevas
Convenciones del pack4 (metros, +X boca, +Y arriba, origen centrado X/Z y base Y=0, un material plano por pieza `mat_<pieza>`, <6.000 tris/arma).

## Contenido
- 10 bases (`<ARMA>/`): MG338, RPD, MG4HK (lmg), LPM1, LPM4 (rifle), VSV (sniper semiauto rústica), DUPLET (sniper cerrojo rústica), MAGNUM (revólver single action), SR410 (escopeta de tambor), ESC1 (escopeta de bombeo). Cada una: `_ensamblada.glb`, `piezas/*.glb`, `manifest.json` (con `funcionamiento` y `accion_detalle`).
- `piezas_sueltas/` (+`piezas.json`): 4 empuñaduras, 3 cargadores, 5 guardamanos, 4 culatas del kit AR (ancla de origen y `seccion_union_m`).
- `accesorios/` (+`accesorios.json`): 5 agarres, 4 bocachas, 2 miras (telescópica y holográfica, con `centro_lente_local`) y los extraídos de las armas.
- `acciones.json`: cómo funciona cada acción. `catalogo.json`.

## Notas
- RPD: el disco bajo el receptor es el cargador (tambor de cinta); sin empuñadura suelta.
- DUPLET y VSV sin empuñadura independiente; DUPLET sin cargador.
- Descartadas por repetidas o desentonar: LP_MG2/5, LP_MG3, Helsing, Bastard Gun, Tikhar, Shambler, Kalash 2012, Liberator y AR15.
- `base_real` es solo interno.

## Miras de hierro
Las 10 bases llevan el ancla `raíl_frontal` (manifest y nodo vacío de la ensamblada), calculada como en los packs anteriores, así que admiten los 13 juegos de `miras_hierro` (filtro por `categorias_compatibles` y algoritmo de LEEME_miras_hierro.md). Si la diferencia de altura alza/punto supera el máximo del alzador (caso probable de SR410), el juego no es compatible y queda el apuntado Black o una óptica.
- LPM1 y LPM4 llevan una pieza `mira` integrada (bloque holográfico / alza); se oculta al montar cualquier mira.
- `raíl_superior` corregido en DUPLET, MG338 y SR410.

## Notas de las últimas tres
- MAGNUM: `revolver_simple` (single action, amartillar a mano). Volteada en X, sin cartucho suelto, escalada a 0,30 m. Empuñadura cortada limpia a y=0,062 m.
- SR410: tambor como pieza propia; empuñadura integrada en la culata.
- ESC1: bombeo; el guardamanos_canon incluye el cargador tubular.
- `acciones.json` incluye `basculante` (escopetas de dos cañones) y el detalle de `revolver_simple`. Ninguna base de este pack es basculante.
