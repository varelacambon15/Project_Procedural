# Kit de armas por piezas: guía de integración

39 armas, todas con el mismo esquema:
- 28 del pack low-poly (el lanzallamas se ha quitado).
- 6 modelos low-poly sueltos, reducidos y cortados: AK12, AR70, MGP7, MP9, SMG45 y ZC57.
- 5 rehechos en hard-surface a partir de Hunyuan: TAR-21, ARX-160, SMG-W (subfusil con culata de alambre), REV-H (revólver) y LEV-12 (escopeta de palanca).

Los nombres de carpeta son identificadores internos, no nombres para el juego.

Reparto: 14 subfusiles, 11 fusiles, 7 pistolas, 3 francotiradores, 3 escopetas y 1 revólver.

## Convenciones (iguales en todas)
- **Unidades:** metros, a escala real. Pistolas de ~0,2 m, subfusiles de ~0,55 m, fusiles de ~0,9-1,1 m, francotiradores de ~1,2 m.
- **Ejes:** +X apunta a la boca del cañón, +Y hacia arriba y Z es el grosor.
- **Origen del arma:** centrado en X y en Z, con la base en Y = 0.
- **Normales:** con aristas vivas por encima de 32°. Bisel pequeño, de 0,5 a 1,6 mm según el tamaño del arma.
- **Materiales:** uno liso por pieza (`mat_<pieza>`), en gris neutro, sin texturas ni colores de vértice. Se puede recolorear por era cambiando el `baseColor` de cada material.
- **Triángulos:** todas por debajo de 6.000; la más pesada tiene 5.951 y las de hard-surface rondan entre 1.200 y 1.950. `sniper_0` va sin bisel para no pasar de 6.000, y los 6 modelos sueltos conservan el bisel que ya traían.

## Archivos de cada arma (`<arma>/`)
- `<arma>_ensamblada.glb`: un nodo por pieza, colocado en su ancla, más un nodo vacío por ancla.
- `piezas/<pieza>.glb`: cada pieza suelta, con el **origen en su punto de unión** (ver tabla).
- `manifest.json`: tipo, chasis, escala aplicada, anclas, y por pieza sus triángulos, su posición en el arma, su bbox local y su `seccion_union_m`.
- `catalogo.json` (en la raíz): el resumen de las 31 armas.

## Piezas y su origen local
| Pieza | Origen local = ancla | Notas |
|---|---|---|
| `cuerpo` / `cuerpo_culata` | origen del arma | `cuerpo_culata` solo en bullpups (culata integrada) |
| `culata` | `cara_culata` | solo en armas con culata separable |
| `guardamanos_canon` | `cara_guardamanos` | incluye el cañón y la bocacha; en pistolas es la punta del cañón |
| `empunadura` | `cara_empunadura` | empuñadura más guardamonte |
| `cargador` | `pozo_cargador` | origen en la cara que encaja en el cajón |
| `mira` | `raíl_superior` | origen en la base de la mira |
| `agarre` | `raíl_inferior` | agarre vertical (solo en 5 armas) |
| `tambor` | `eje_tambor` | solo en revólveres (`chasis: revolver`); su origen es el centro del eje |

Anclas (nodos vacíos): `boca`, `pozo_cargador`, `raíl_superior`, `cara_culata`, `cara_guardamanos`, `cara_empunadura` y, si hay agarre, `raíl_inferior`. Si un arma no tiene cargador, no tiene ancla `pozo_cargador` ni malla `cargador` (shotgun_2, sniper_0 y el revólver, que usa `tambor`).

## Cómo cambiar piezas (`swap:*`)
1. Carga el `cuerpo` del arma base en su origen.
2. Coloca cada pieza (propia o de otra arma) en la posición del ancla que corresponde **del arma base**. Como el origen de la pieza ya es su punto de unión, basta con una traslación, sin rotación ni offsets.
3. **Filtro de compatibilidad recomendado:** compara `seccion_union_m` de la pieza nueva con la de la pieza original del arma base.
   - Ratio entre 0,8 y 1,25 en alto y en ancho: usarla tal cual.
   - Entre 0,6 y 0,8 o entre 1,25 y 1,6: escalarla en Y/Z para igualar la sección (no en X, así se conserva su largo).
   - Fuera de eso: descartarla. Así se evita lo que pasa en `prueba_intercambio.png` (abajo a la derecha), donde el guardamanos de `fusil_2` es demasiado alto para `fusil_6`.
4. Para `stock-len`, `barrel-len` y `front-len`, escala la pieza solo en X desde su origen local: se alarga hacia fuera del arma sin despegarse.
5. Los cortes están **tapados**, así que una culata más estrecha no deja ver el cuerpo hueco.

## Chasis
`chasis` puede ser `convencional`, `bullpup`, `pistola`, `revolver`, `palanca` o `sin_culata`. En `palanca` (LEV-12), la `empunadura` es la palanca en bucle con el gatillo, y el depósito tubular va dentro de `guardamanos_canon`, así que no hay `cargador`. Bullpup es un atributo del chasis, no un tipo de arma; `tipo_juego` dice si es `rifle`, `smg`, etc. No conviene mezclar culatas de convencionales en bullpups (no tienen `culata`).

## Pendientes conocidos
- En algunas armas del pack (fusil_1, sniper_1, subfusil_7) el cuerpo trae un "manguito" que rodea el cargador. Un cargador más grueso puede atravesarlo; el filtro de sección lo evita.
- La escala se ajustó por tipo de arma (mediana del tipo → largo real); dentro de cada tipo se respetan las proporciones del pack.

- El revólver REV-H es el único revólver del kit. Su `guardamonte` es un bucle cerrado y fino dentro del `cuerpo`, y el `tambor` va encajado en el armazón; usadlo como referencia para corregir los revólveres procedurales.
- En AK12, MGP7 y AR70 el ancla `pozo_cargador` queda dentro del cajón, porque el cargador entra en él.
