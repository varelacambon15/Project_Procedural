# Pack 14 — humanoides especiales (encargo 43)

Cinco enemigos humanoides construidos sobre el **cuerpo base del soldado ciber**
(`raw/pack11_soldado/soldado_base.glb`, encargos 40/44). Comparten su anatomía,
sus nombres de pieza y sus materiales, pero cada uno **remodela las proporciones**
del cuerpo (alto, ancho de hombros, fondo, grosor de brazos, piernas y cabeza) y
añade un juego de piezas especiales propio. Diseño y modelado por código con
`.delegaciones/blender/soldado/_humanoides.py`, que reutiliza `_soldado.py` y
`.delegaciones/blender/equipo/_comun.py` (VERSION `r1`, **sin modificar**).

## Convención

- Metros reales. **+X = frente**, **+Y arriba** en el GLB (`+Z` arriba en Blender).
- Origen entre los pies; `min.y = 0` en todos los montados y piezas.
- Izquierda del personaje = **−Z** en el GLB (`+Y` en Blender); derecha = `+Z`.
- Una malla por pieza articulada, nombres en español.
- Materiales Principled con ranura fija: `mat_traje`, `mat_oscuro`, `mat_chaleco`,
  `mat_visor` (emisivo) y `mat_acento`. Sin texturas, imágenes, cámaras ni luces.
- **Topes comprobados leyendo los `indices` del GLB** (no la escena de Blender):
  **≤ 4.000 triángulos por enemigo montado** (cuerpo + piezas especiales) y
  **≤ 700 por pieza suelta**. El cuerpo base (3.988) se reduce proporcionalmente
  antes de exportar para dejar sitio a las piezas de cada variante.

## Proporciones de las cinco variantes

El cuerpo base mide 1,80 m. Cada variante escala el conjunto en ancho (Y) y fondo
(X), el grosor local de brazos, piernas y cabeza, y después normaliza el alto total
exacto. Los seis `mov_*` del soldado se recalculan con esas escalas.

| variante | alto | ancho | fondo | brazos | piernas | cabeza | tri montado |
|---|---:|---:|---:|---:|---:|---:|---:|
| `humanoide_asesino` | 1,750 m | 0,86 | 0,92 | 0,84 | 0,92 | 1,00 | **3.836** |
| `humanoide_granadero` | 1,900 m | 1,14 | 1,08 | 1,12 | 1,10 | 1,00 | **3.838** |
| `humanoide_incinerador` | 1,850 m | 1,07 | 1,08 | 1,04 | 1,02 | 1,00 | **3.835** |
| `humanoide_invocador` | 1,800 m | 0,90 | 0,95 | 0,90 | 0,96 | 1,00 | **3.862** |
| `humanoide_berserker` | 2,200 m | 1,18 | 1,14 | 1,22 | 1,24 | 0,94 | **3.860** |

## Variantes montadas (`raw/pack14_humanoides/humanoide_*.glb`)

Todas conservan los **seis nodos móviles** del soldado (`mov_cabeza`, `mov_torso`,
`mov_brazo_izq`, `mov_brazo_der`, `mov_pierna_izq`, `mov_pierna_der`) con el origen
en su articulación, y suman las piezas especiales como mallas independientes
**emparentadas** al nodo que las mueve (cabeza, torso, brazo derecho…), de modo que
acompañan la animación y se pueden quitar sin reexportar.

1. **`humanoide_asesino`** — delgado y ágil. Capucha lisa con visor fino y morado,
   capa corta de tres filas de placas articuladas y dos cuchillas retráctiles
   acopladas a los antebrazos. Líneas emisivas moradas en visor, filos y capa.
   La capa es un **nodo móvil propio** (`mov_capa`) para poder oscilar.
2. **`humanoide_granadero`** — corpulento y muy ancho. Visera ancha en el casco,
   cinturón con cuatro granadas y dos cartucheras, **lanzagranadas de seis tambores**
   en el antebrazo derecho y hombrera reforzada de tres placas en el hombro izquierdo.
   Acento naranja en visor, granadas y recámaras.
3. **`humanoide_incinerador`** — armadura ignífuga. Máscara con respirador y dos
   filtros, **depósito de espalda con dos cilindros, válvulas, manómetro y manguera**
   (está pensado para explotar al morir; esa lógica es del juego) y **lanzallamas**
   en el antebrazo derecho con boquilla, piloto de llama emisivo y manguera.
   Acento rojo.
4. **`humanoide_invocador`** — silueta de hacker. Visor de realidad aumentada grande
   con HUD emisivo, túnica corta tecnológica sobre las caderas, matriz de antenas y
   plato en la espalda, guante proyector emisivo en la mano derecha y **dos mini
   drones** (`mov_dron_1`, `mov_dron_2`) flanqueando los hombros. Acento cian.
5. **`humanoide_berserker`** — gigante de 2,20 m. Torso en barril con placas,
   reactores y escapes; casco con **cuernos de antena** y visor rojo; piernas muy
   gruesas con los refuerzos y pistones del cuerpo base; y dos **exo-brazos
   mecánicos** con hombrera, pistones, antebrazo abultado y puño sobredimensionado
   con nudillos. Acento rojo oscuro.

### Mallas especiales dentro de cada montado

| montado | mallas especiales | mov extra |
|---|---|---|
| asesino | `asesino_capucha`, `mov_capa`, `asesino_cuchilla_i`, `asesino_cuchilla_d` | `mov_capa` |
| granadero | `granadero_visera`, `granadero_cinturon`, `granadero_lanzagranadas`, `granadero_hombrera` | — |
| incinerador | `incinerador_mascara`, `incinerador_deposito`, `incinerador_lanzallamas` | — |
| invocador | `invocador_visor`, `invocador_tunica`, `invocador_antenas`, `invocador_guante`, `mov_dron_1`, `mov_dron_2` | `mov_dron_1`, `mov_dron_2` |
| berserker | `berserker_casco`, `berserker_torso`, `berserker_exobrazo_i`, `berserker_exobrazo_d` | — |

`mov_capa` cuelga de `mov_torso` (pivote en la parte alta de la espalda). Los dos
drones son **raíces con pivote propio** en los laterales del torso, para que el
juego los haga orbitar. El resto de piezas especiales cuelga de `mov_cabeza`,
`mov_torso`, `mov_brazo_izq` o `mov_brazo_der` según su anclaje.

## Piezas sueltas (21 GLB, una malla cada una, ≤ 700 triángulos)

El origen de cada pieza es su punto de anclaje (0,0,0), así que se montan sobre el
cuerpo sin corregir geometría. Las coordenadas de la tabla son del **cuerpo base de
1,80 m**; el montado las pasa por la escala de su variante (ancho/fondo/alto).

| pieza | tri | ancla | se monta en |
|---|---:|---|---|
| `asesino_capucha` | 420 | centro de la abertura del cuello, `(0, 0, 1,590)` | `mov_cabeza` |
| `asesino_capa` | 660 | parte alta de la espalda, `(-0,105, 0, 1,400)` | `mov_capa` → `mov_torso` |
| `asesino_cuchilla_i` | 176 | antebrazo izquierdo, `(0,075, +0,300, 0,960)` | `mov_brazo_izq` |
| `asesino_cuchilla_d` | 176 | antebrazo derecho, `(0,075, −0,300, 0,960)` | `mov_brazo_der` |
| `granadero_visera` | 364 | centro del cuello, `(0, 0, 1,590)` | `mov_cabeza` |
| `granadero_cinturon` | 480 | centro de la cintura, `(0, 0, 1,010)` | `mov_torso` |
| `granadero_lanzagranadas` | 432 | antebrazo derecho, `(0,060, −0,300, 1,000)` | `mov_brazo_der` |
| `granadero_hombrera` | 236 | hombro izquierdo, `(0, 0,215, 1,425)` | `mov_brazo_izq` |
| `incinerador_mascara` | 464 | centro del cuello, `(0, 0, 1,600)` | `mov_cabeza` |
| `incinerador_deposito` | 596 | espalda, `(−0,150, 0, 1,120)` | `mov_torso` |
| `incinerador_lanzallamas` | 320 | antebrazo derecho, `(0,060, −0,300, 1,000)` | `mov_brazo_der` |
| `invocador_visor` | 312 | centro del cuello, `(0, 0, 1,590)` | `mov_cabeza` |
| `invocador_tunica` | 312 | centro de la cintura, `(0, 0, 1,010)` | `mov_torso` |
| `invocador_antenas` | 224 | espalda alta, `(−0,145, 0, 1,300)` | `mov_torso` |
| `invocador_guante` | 268 | mano derecha, `(0,105, −0,315, 0,860)` | `mov_brazo_der` |
| `invocador_dron_1` | 372 | lateral izquierdo, `(0,010, +0,400, 1,500)` | `mov_dron_1` |
| `invocador_dron_2` | 372 | lateral derecho, `(0,010, −0,400, 1,500)` | `mov_dron_2` |
| `berserker_casco` | 412 | centro del cuello, `(0, 0, 1,590)` | `mov_cabeza` |
| `berserker_torso` | 460 | pecho, `(0, 0, 1,150)` | `mov_torso` |
| `berserker_exobrazo_i` | 516 | hombro izquierdo, `(0, +0,215, 1,425)` | `mov_brazo_izq` |
| `berserker_exobrazo_d` | 516 | hombro derecho, `(0, −0,215, 1,425)` | `mov_brazo_der` |

Las piezas de la tabla incluyen placas, correas, cables, conectores, válvulas,
recámaras, filtros, rotores y remates emisivos según el tipo; todas están biseladas
y con suavizado (aristas vivas marcadas por `split`), como el cuerpo base.

## Cómo se generó y se comprueba

Guiones en `.delegaciones/blender/soldado/`:

```
blender.exe -b --python .delegaciones/blender/soldado/humanoides.py          # 5 montados
blender.exe -b --python .delegaciones/blender/soldado/humanoides_piezas.py   # 21 piezas
python .delegaciones/blender/soldado/verificar_humanoides.py                 # GLB y cabeceras PNG
blender -b --factory-startup --python .delegaciones/blender/soldado/verificar_png_humanoides.py
```

`verificar_humanoides.py` lee el JSON de cada GLB y comprueba: tope de 4.000 en los
montados, 700 en las piezas, una malla por pieza suelta, las cinco ranuras de
material, ausencia de texturas/imágenes/cámaras/luces, los seis `mov_*` del soldado
más los extras esperados, el alto exacto (≥ ±3 mm) y el origen en el suelo
(`min Y = 0`). Resultado actual: **FALLOS 0** con 5 montados y 21 piezas.
`verificar_png_humanoides.py` mide la caja opaca de cada montado: **≥ 85 % del alto**
del lienzo (88 % en las cinco variantes) y caja no cortada.

Los 26 PNG (5 montados + 21 piezas) son **640 × 320**, RGBA de 8 bits, fondo
transparente, frame de estudio y vista tres cuartos frontal (`az = 114°`, `el = 11°`,
`alto = 0,88` en los montados; `el = 12°` y `alto = 0,86` en las piezas), los mismos
que usa el soldado. `_humanoides.py` fija `C.SALIDA` a esta carpeta para no escribir
en `pack11_soldado`.

## Pendiente para integrarlo en el juego

Repintar por nombre de material (las paletas de cada variante son la referencia),
colgar el arma en el socket de la mano, animar el giro de `mov_capa` y la órbita de
`mov_dron_1`/`mov_dron_2`, retraer las cuchillas del asesino, disparar el piloto del
lanzallamas, hacer explotar el depósito del incinerador al morir, colliders por zona
y LOD. El cuerpo base no lleva arma: el fusil sigue siendo una pieza del juego.
