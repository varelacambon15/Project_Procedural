# Pack 6 — armas adaptadas de `Armas separadas/`

Mismas convenciones que el kit y los packs 2–5 (metros, +X hacia la boca, +Y arriba, origen centrado en X y Z con la base en Y = 0, un material liso por pieza `mat_<pieza>`, aristas vivas a 32°, menos de 6.000 triángulos por arma y cada pieza con el origen en su ancla). Cada arma trae `<ARMA>_ensamblada.glb`, `piezas/*.glb` y `manifest.json`; `catalogo.json` está en la raíz. Entra en el pack del juego `kit39` con ids `x-p6-<nombre>`.

Solo se copian aquí las carpetas de `Armas separadas/<NOMBRE>/` con `OK.flag` (validador automático) y sin `NO_INTEGRAR.txt` (decisión del director). `INTEGRADAS.txt` registra lo ya integrado para no repetirlo.

## Armas (2)

| Arma | Base | `tipo_juego` | `accion` | Triángulos | Largo (m) | Piezas ausentes | Accesorios de serie |
|---|---|---|---|---|---|---|---|
| AUTOMAG44 | Pistola semiautomática .44 de acero inoxidable de cañón largo (años 70) | `pistol` | `semiautomatica` | 2059 | 0.292 | culata, mira | — |
| MAUSER | Mauser C96 de chasis táctico con raíles y compensador (moderna) | `pistol` | `semiautomatica` | 5858 | 0.288 | culata, mira | — |

Las dos son pistolas de corredera (`chasis: pistola` + `accion: semiautomatica`, ver `raw/pack5/acciones.json`): la pieza `guardamanos_canon` ES la corredera y retrocede ~0,025 m en −X al disparar. Martillo, gatillo y gatillera van dentro del `cuerpo`. Cargador extraíble en `piezas/cargador.glb`.

## Miras

Las dos llevan alza y punto de mira **fundidos en la corredera** (pieza `guardamanos_canon`), por eso `mira_integrada: "alza"` con ancla `linea_mira` y `mira` en `piezas_ausentes`: no hay pieza de óptica. Las miras de hierro desmontables del juego se pueden montar encima (anclas `raíl_superior` + `raíl_frontal`, presentes en las dos).

## Anclas

Las dos traen las 8 anclas del estándar: `boca`, `cara_guardamanos`, `cara_empunadura`, `pozo_cargador`, `raíl_frontal`, `linea_mira`, `raíl_superior`, `cara_culata`. No hay `raíl_inferior` (no llevan riel inferior) ni `eje_tambor`.

## Notas por arma

- **AUTOMAG44:** cachas de madera en la empuñadura (el único color no metal). La línea de mira del modelo original queda el punto de mira 1,9 mm por encima del alza (desviación de la fuente, sin tocar en esta entrega).
- **MAUSER:** cargador extraíble delante del gatillo (estilo C96 "broomhandle"); compensador de boca fusionado en `guardamanos_canon` (no es accesorio suelto). Bisel de 2 mm solo en aristas largas para no pasarse de 6.000 tris (5.858).
- **MK23MOD0** (`Armas separadas/`, con `OK.flag`): NO integrada — `NO_INTEGRAR.txt` del director (duplica `raw/pack4/MK23`). Los originales de `Armas separadas/` no se modifican.
