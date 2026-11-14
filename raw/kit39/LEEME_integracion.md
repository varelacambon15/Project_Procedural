# Kit de armas por piezas: guía de integración

39 armas completas y una biblioteca de 55 piezas sueltas (16 de ellas miras), todas con las mismas convenciones.

## Convenciones (iguales en todo)
- **Unidades y ejes:** metros a escala real; +X hacia la boca, +Y hacia arriba, Z es el grosor.
- **Origen del arma:** centrado en X y en Z, con la base en Y = 0.
- **Normales:** aristas vivas por encima de 32°.
- **Material:** uno liso por pieza (`mat_<pieza>`), sin texturas ni colores de vértice.
- **Triángulos:** menos de 6.000 por arma. Las piezas sueltas van de 88 a 5.200.
- **Origen de cada pieza:** su punto de unión (tabla de abajo). Para montar basta con trasladar la pieza al ancla correspondiente del arma; no hay rotaciones.
- **GLB del arma:** `<arma>_ensamblada.glb` lleva un nodo por pieza y un nodo vacío por ancla. Cada pieza suelta está en `piezas/<pieza>.glb`.
- **Datos:** `manifest.json` por arma, `catalogo.json` en la raíz y `piezas_sueltas/piezas.json` para la biblioteca.

## Piezas, origen local y ancla de montaje
| Pieza | Origen local / ancla del arma | Notas |
|---|---|---|
| `cuerpo` / `cuerpo_culata` | origen del arma | `cuerpo_culata` solo en bullpups |
| `culata` | `cara_culata` | se extiende hacia −X |
| `guardamanos_canon` | `cara_guardamanos` | incluye cañón; se extiende hacia +X |
| `empunadura` | `cara_empunadura` | con guardamonte |
| `cargador` | `pozo_cargador` | origen en su cara superior; cuelga hacia −Y |
| `mira` | `raíl_superior` | origen en su base |
| `agarre` | `raíl_inferior` | cuelga hacia −Y |
| `bocacha` (solo biblioteca) | `boca` | origen en su cara trasera |
| `tambor` | `eje_tambor` | solo en el revólver; hace de cargador |
| `mira` (alza) | `base_alza` | alzas separadas de 5 armas |

## 1. Miras
**Datos de cada óptica**, en el manifest de su arma o en `piezas.json`:
- **`centro_lente_local`:** en coordenadas de la pieza mira (origen en su base). En el arma montada es `raíl_superior` + `centro_lente_local`. En la base de las ópticas ya ensambladas va también como nodo hijo `centro_lente` del nodo `mira`, y en el GLB ensamblado como ancla `centro_lente`.
- **`tipo_mira` y `aumento`.**
- **`apertura_m`:** solo en las 17 ópticas del kit; es el tamaño de la ventana por la que se mira.

**Dónde cae `centro_lente`:**
- En **punto rojo y holográficas** (aumento 1) está en el centro del cristal.
- En **ACOG, prismas, visores y la térmica** está en el **ocular**, el extremo trasero, que es donde va el ojo.

**Se ve a través de todas.** Las 17 ópticas del kit y las 16 nuevas tienen el túnel óptico abierto, y lo he comprobado con un rayo por `centro_lente`. Si el juego dibuja la retícula en el centro de la pantalla, alinear la cámara con `centro_lente` mirando a +X basta.

**Biblioteca de miras (`piezas_sueltas/miras/`):**
| Tipo | Miras |
|---|---|
| Punto rojo y holográficas | `pr_abierto_compacto`, `pr_abierto_grande` (abiertas); `pr_tubo_30`, `pr_tubo_alto` (de tubo); `holo_caja`, `holo_compacta` |
| Aumento medio | `acog_4x`, `acog_compacto_3x`, `prisma_2x`, `prisma_3x_con_punto` |
| Francotirador | `visor_corto_4x`, `visor_medio_8x`, `visor_largo_10x`, `visor_parasol_12x` |
| Especiales | `termica` (x2, con campo `pantalla`) y `punto_rojo_lupa` |

Dos casos especiales:
- **`prisma_3x_con_punto`** lleva un punto rojo encima, con su propio `centro_lente_punto`, para alternar entre los dos.
- **`punto_rojo_lupa`** lleva la lupa x3 abatida al lado. Su posición en línea es `lupa_en_linea` y el eje de giro `lupa_abatida_eje`.

**Mira integrada (`mira_integrada` en el manifest):**
- **`"alza"`:** las 22 armas sin óptica. Llevan el ancla `linea_mira`, el punto alto de la mira trasera o del cajón. Sirve para el apuntado sin óptica, acercando el arma y haciendo zoom.
- **`null`:** las 17 armas con óptica. Su óptica es una pieza `mira` intercambiable, con `centro_lente` y `aumento`.

## 2. Biblioteca de piezas sueltas (`piezas_sueltas/`)
Cada pieza tiene `seccion_union_m` en `piezas.json`.

| Categoría | Piezas |
|---|---|
| Guardamanos | rieles, M-LOK, madera y perforado, cada uno en corto, medio y largo (12). Llevan cañón y su propio ancla `boca` (y `raíl_inferior` salvo los de madera), para encadenar bocacha y agarre. |
| Culatas | dos macizas, dos de polímero, dos plegables gruesas y dos de madera (8). Ninguna de varilla fina. |
| Cargadores | tres rectos de pistola o subfusil, uno recto de fusil, dos curvos y dos de tambor (8). Los tambores tienen **el disco en el plano XY**, de frente. |
| Empuñaduras | ergonómica, recta y de madera (3), con guardamonte. |
| Agarres | vertical, angulado y tope (3). |
| Bocachas | apagallamas, freno, compensador y supresores corto y largo (5). Encajan en un cañón de 15 mm (`diametro_encaje_m`): escaladlas en Y y Z por `boca_diametro_m / diametro_encaje_m` si hace falta. |

`hojas/prueba_montaje_biblioteca.png` muestra cuatro armas del kit montadas con piezas de la biblioteca, solo con traslaciones.

## 3. Correcciones del kit
- **Manguitos (fusil_1, sniper_1, subfusil_7):** el manguito que rodeaba el cargador ya forma parte de la pieza `cargador`. El cuerpo queda limpio.
- **`pozo_cargador` (AK12, MGP7):** ahora está en la cara inferior del cajón. El cargador se ha movido con el ancla, así que sigue montado igual. En el AR70 ya estaba bien.
- **`raíl_superior`:** en 26 armas estaba metido en el cajón, entre 1 y 46 mm. Ahora está en la superficie, y las ópticas se han recolocado para seguir igual.

## 3b. Piezas desmontables (todas las posibles)
Cada manifest lleva `piezas_ausentes`: lista lo que de verdad no existe en esa arma. 26 de las 39 armas tienen todas las piezas estándar.
- **Culata separada en bullpups** (TAR-21, fusil_7, subfusil_7): `cuerpo_culata` pasa a ser `cuerpo` + `culata`. La culata es la parte trasera, detrás del pozo del cargador. El `chasis` sigue siendo `bullpup`, así que no conviene mezclarla con culatas de armas convencionales.
- **Culata separada en `sin_culata`** (fusil_4, subfusil_6, shotgun_2): la tapa trasera del cajón es ahora la pieza `culata`. Se puede cambiar por cualquier culata de la biblioteca.
- **Depósitos tubulares como `cargador`** (shotgun_2, LEV-12): `tipo_cargador: tubular`. Su origen es el extremo trasero y el tubo va hacia +X. Solo son intercambiables entre sí.
- **sniper_0:** el bloque bajo el cajón es ahora su `cargador`.
- **Alzas separadas** (AR70, MGP7, ZC57, pistol_1, pistol_3): la pieza `mira` es el alza, con `tipo_mira: alza`. Su origen es el ancla `base_alza`, no `raíl_superior`. Al montar una óptica en `raíl_superior` se quita esta pieza.
- **REV-H:** el `tambor` hace de cargador (`equivale_a: cargador`).
- **Lo que no existe y no se ha inventado:**
  - **Culata en pistolas y revólver:** no la tienen, pero tienen el ancla `cara_culata` para montar una de la biblioteca.
  - **Mira en fusil_3, shotgun_1, shotgun_2, subfusil_3, subfusil_4 y pistol_2, 4 y 6:** el alza va fundida con el cajón o no hay. Tienen `mira_integrada: "alza"` y `raíl_superior` para montar óptica.

## 4. Datos nuevos en el manifest
- **`boca_diametro_m`:** el diámetro del cañón en la boca. No existe en sniper_0 y LEV-12, porque la boca es irregular.
- **`raíl_inferior`:** está en 31 armas. No lo tienen el revólver, las escopetas y algunas armas sin sitio, como SMG-W o sniper_2.
- **`era_sugerida`:** solo en las 12 armas donde el diseño la deja clara. En las demás es `null`.

## Chasis y tipos
`chasis` puede ser `convencional`, `bullpup`, `pistola`, `revolver`, `palanca` o `sin_culata`. Bullpup es un atributo del chasis, no un tipo; el tipo está en `tipo_juego`.

## Compatibilidad al intercambiar
Comparad `seccion_union_m` entre la pieza nueva y la del arma base:
- Ratio entre 0,8 y 1,25: usarla tal cual.
- Entre 0,6 y 1,6: escalarla en el plano de la unión.
- Fuera de eso: descartarla.

Para `stock-len`, `barrel-len` y `front-len`, escalad solo en X desde el origen local de la pieza.
