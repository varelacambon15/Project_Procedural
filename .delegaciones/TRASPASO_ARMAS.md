# TRASPASO: cómo se preparaban las armas 3D para Project_Procedural (FUENTE DE VERDAD)

> Texto del chat que preparó los packs anteriores (kit39, pack2..pack5), entregado por el usuario. Léelo entero antes de tocar nada.
> **Aviso importante: `src/weapons/kit.ts` (roles `receiver`, `barrel`…, sockets `Platform`, `Handguard`…) es OTRO sistema (el kit modular `k-*`). NO lo uses para nombrar piezas ni anclas. Se entrega en la CONVENCIÓN DE PACKS de abajo; el conversor del juego (`tools/convert/convert.js`) ya traduce al resto.**

## Qué hacía
Convertía modelos GLB de terceros (packs low-poly, modelos generados) en armas del juego: las orientaba, las escalaba, las cortaba en piezas, las simplificaba y las exportaba con anclas, para que el juego las monte y las combine por piezas. Los packs entregados son kit39 y pack2..pack5 (en `raw/`, IDs `x-`, `x-p2-`… `x-p5-`). Se integran con `tools/weapon-jobs.mjs` + `tools/convert/convert.js` (tipos kit39, kit39part y libsight). Los scripts originales (Python con trimesh y bpy) NO están en el repo: hay que reproducir el método con Blender o con scripts nuevos.

## Convenciones (obligatorias, iguales en todos los packs)
- Metros a escala real. +X = boca, +Y = arriba, Z = grosor (derecha +Z).
- Origen del arma: centrado en X y Z, base en Y = 0.
- Un material liso por pieza llamado `mat_<pieza>`. SIN texturas ni colores de vértice (el color se toma de la textura original: un color medio por pieza, guardado en el manifest).
- Normales con aristas vivas por encima de ~32°; bisel pequeño (~2 mm).
- Menos de 6.000 triángulos por arma.
- `<arma>_ensamblada.glb`: un nodo por pieza y un nodo vacío por ancla. `piezas/<pieza>.glb`. `manifest.json` por arma y `catalogo.json` en la raíz del pack.

## Piezas y origen local (montar = trasladar al ancla, sin rotaciones)
- `cuerpo` / `cuerpo_culata` (solo bullpup) → origen del arma
- `culata` → `cara_culata` (origen en su cara delantera, a la altura del ánima; se extiende hacia −X)
- `guardamanos_canon` → `cara_guardamanos` (origen en su cara trasera; se extiende hacia +X; incluye el cañón)
- `empunadura` → `cara_empunadura` (origen arriba, cuelga hacia −Y)
- `cargador` → `pozo_cargador` (origen en su cara superior)
- `tambor` → `eje_tambor` (revólveres y tambores de cinta; hace de cargador)
- `mira` → `raíl_superior` (origen en su base); las alzas separadas usan `base_alza`
- `agarre` → `raíl_inferior`; `bocacha` → `boca` (origen en su cara trasera, con `diametro_encaje_m`)
Anclas del arma: `boca`, `pozo_cargador`, `raíl_superior`, `cara_culata`, `cara_guardamanos`, `cara_empunadura`, `raíl_inferior`, `linea_mira`, `raíl_frontal` (punto de mira de las miras de hierro) y `eje_tambor` si aplica.
Datos del manifest: `tipo_juego` (pistol, revolver, smg, rifle, shotgun, sniper, lmg), `chasis` (convencional, bullpup, pistola, revolver, sin_culata, basculante), `accion`, `era_sugerida`, `piezas_ausentes`, `boca_diametro_m`, `mira_integrada`, `accesorios_de_serie`, `seccion_union_m` en las piezas sueltas.

## Miras (lo que más se confunde)
- Ópticas: pieza `mira` con origen en `raíl_superior` + `centro_lente_local` (punto por el que mira el ojo: centro del cristal en punto rojo/holográfica; en ACOG, prismas y visores, el ocular trasero) + `tipo_mira` + `aumento` (1 = punto rojo, 1,5–4 medio, 4–12 francotirador) + `apertura_m` + `ve_a_traves` (túnel óptico abierto, comprobado con un rayo por el centro).
- Miras de hierro: ya NO son la base del apuntado. Son accesorios desmontables (alza en `raíl_superior` + punto de mira en `raíl_frontal`); si hay óptica, se quitan. **Toda arma necesita el ancla `raíl_frontal`.** Si el arma trae el alza fusionada en el cuerpo, se marca `mira_integrada: "alza"`.

## Acción (funcionamiento; valores en `raw/pack5/acciones.json`)
- `automatica`: fuego continuo. `semiautomatica`: un disparo por pulsación; en pistolas la corredera ES la pieza `guardamanos_canon` (retrocede ~0,025 m en −X).
- `cerrojo`: ciclar a mano tras cada disparo. `bombeo`: el guardamanos (bomba) se desplaza ~0,08 m en −X; sin pieza cargador (tubo). `basculante`: escopeta de dos cañones.
- `revolver_simple` (single action): amartillar a mano antes de cada disparo. `revolver_doble`: cada pulsación amartilla y dispara.
- El modo de disparo (semi, ráfaga, auto) es otra cosa: una estadística que el juego sortea.

## Método, paso a paso
1. Normalizar orientación por PCA: eje largo = X; arriba por el sesgo de las colas (cargador y empuñadura cuelgan); boca = extremo más estrecho en altura. **REVISAR SIEMPRE A OJO** (fallaron P90, VSV y otras al revés).
2. Escalar a largo real (`largo_m`) y colocar el origen (centrado en X/Z, base en Y = 0).
3. Eliminar lo que sobra: munición suelta, accesorios fusionados (pasan al pool de accesorios), base/soporte.
4. Segmentar con cortes por plano (eje, posición, caja de recorte) + reglas por caja (qué componentes conexos van a cada pieza). Hoja de rejilla con marcas cada 5 cm y vista previa coloreada por pieza; revisar cada corte.
5. Tapar los cortes (caps) para que las piezas no sean cáscaras abiertas.
6. Simplificar por pieza con Decimate, con pesos por pieza (el cuerpo conserva más); pasadas de bisel y suavizado donde se vea cuadrado.
7. Calcular anclas (automático + manual) y exportar cada pieza con origen en su ancla; calcular bounds y `seccion_union_m`.
8. Escribir `manifest.json` y las hojas de contacto de cada pieza y del arma montada.
9. Validar: suma de triángulos de las piezas = arma, orientación +X, metros, < 6.000 tris, y que montada se parezca al modelo original.

## Trampas que ya ocurrieron
- Un corte que atraviesa un cilindro (tambor) parte la pieza en dos: cortar a ambos lados y asignarlo entero.
- Cortes de empuñadura con dientes o restos del armazón: cortar plano a la altura exacta.
- El cargador suele venir fundido con el cuerpo; sacarlo con una caja.
- Armas largas con el punto de mira fundido en el cañón y miras a distinta altura: ajustar `raíl_superior` y `raíl_frontal` para que alza y punto queden a la misma línea.
- Modelos descentrados o inclinados: enderezar antes de cortar.
- Clustering por caja junta armas vecinas; por proximidad separa bien pero deja fuera piezas pequeñas.
- Tambor de cinta (RPD): ese disco es el cargador, no una empuñadura.

## Reglas de diseño (no cambiar)
- Cuatro eras: Clásica, Moderna, Rústica, Sci-fi realista (arma moderna de última generación; nada de celdas, aletas ni pantallas). Sin fabricantes reales en los nombres visibles (`base_real` es solo interno). Sin cel shading.
- Armas nuevas = piezas que varían bases existentes. Si un montaje sale mal, se arregla el montaje; nunca se cambian sus piezas por las de la base.
- Mejor adaptar las piezas que descartarlas; si algo desentona o está repetido, se omite.
- Los tests existentes no cambian sus valores. No preguntar por licencias ni créditos. No editar `CREDITS.md`.

## Cómo trabajar
Parte del pack5 (`raw/pack5`), la guía `raw/kit39/LEEME_integracion.md` y `docs/ESTADO.md`. Para cada arma nueva, entrega una hoja de contacto antes de integrar.
