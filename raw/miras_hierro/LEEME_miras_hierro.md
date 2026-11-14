# Miras de hierro desmontables

Son 13 juegos. Cada juego tiene un **alza** (va en `raíl_superior`) y un **punto de mira** (va en el ancla nueva `raíl_frontal`). Son accesorios del pool de miras: se montan y se desmontan como cualquier otra mira, en el taller o en el generador.

| Id | Nombre | Tipo | Categorías compatibles | Eras | Triángulos (alza + punto) |
|---|---|---|---|---|---|
| `hi_abatible` | Abatible de fusil | mirilla | rifle, smg, lmg, sniper, shotgun | moderna | 1308 + 332 |
| `hi_ak` | Tipo AK | muesca | rifle, smg, lmg, shotgun | rústica, moderna | 376 + 1224 |
| `hi_tambor` | Diópter de tambor | mirilla | rifle, smg | moderna | 332 + 336 |
| `hi_compacta` | Abatible compacta de polímero | mirilla | rifle, smg, shotgun, lmg | moderna | 1020 + 228 |
| `hi_tangente` | Clásica de rampa y hoja | muesca_v | rifle, sniper, lmg | clásica | 220 + 192 |
| `hi_competicion` | Diópter de competición | mirilla | sniper, rifle | clásica, moderna | 484 + 964 |
| `hi_scifi` | Sci-fi con insertos luminosos | mirilla | rifle, smg, lmg, sniper, shotgun | sci-fi realista | 316 + 224 |
| `hi_fantasma` | Anillo fantasma y fibra | mirilla | shotgun, rifle, smg | moderna | 1312 + 172 |
| `hi_bola` | Bola de escopeta | canal | shotgun | clásica, rústica | 124 + 452 |
| `hi_tres_puntos` | Pistola de tres puntos | muesca | pistol, revolver | moderna | 216 + 172 |
| `hi_fibra_pistola` | Pistola con fibra verde | muesca | pistol | moderna, sci-fi realista | 328 + 120 |
| `hi_revolver` | Revólver de rampa | muesca | revolver, pistol | clásica | 180 + 112 |
| `hi_rustica` | Rústica de chapa y tornillo | mirilla | rifle, smg, shotgun, lmg | rústica | 568 + 168 |

## Archivos
- `miras_hierro.json`: índice con `categorias_compatibles`, `eras`, `subtipo` (mirilla, muesca, muesca_v o canal), `color_inserto` y los datos de cada mitad.
- `modelos/<id>_alza.glb` y `modelos/<id>_punto.glb`. Cada GLB tiene estos nodos:
  - `alzador`: bloque de montaje. Su origen está en la base; mide 4 mm de alto en el GLB (`alzador.alto_en_glb_m`) y **se escala en Y** para subir la cabeza.
  - `cabeza`: la mira propiamente dicha. Va colocada encima del alzador (en el GLB, en y = 0,004).
  - `cabeza_inserto` (si existe): puntos blancos, fibra o insertos luminosos, con el material `mat_inserto_mira`, que es emisivo. Se mueve igual que `cabeza`.
  - Nodo vacío hijo de `cabeza`: `centro_lente` en el alza (la mirilla, o el borde superior de la muesca) y `punta` en el punto de mira.
- Materiales: `mat_mira`, `mat_alzador` y `mat_inserto_mira`.
- Convenciones del kit: metros, +X hacia la boca, +Y arriba. El origen del GLB es el centro de la base del alzador.

## Montaje (alinear la línea de mira con el cañón)
```
Hr = alza.altura_linea_cabeza_m      Hf = punto.altura_linea_cabeza_m
rs = arma.anclas['raíl_superior']    rf = arma.anclas['raíl_frontal']
ar = af = alzador.minimo_m           // 0,002
d  = (rs.y + ar + Hr) - (rf.y + af + Hf)
si d > 0: af += d   si no: ar -= d
si ar > alzador.maximo_m o af > alzador.maximo_m (0,03): este juego no es compatible con el arma
alza:  posición rs;  alzador.scale.y = ar / 0,004;  cabeza.position.y = ar
punto: posición rf;  alzador.scale.y = af / 0,004;  cabeza.position.y = af
```
Así la línea que va del `centro_lente` del alza a la `punta` del punto de mira queda paralela al cañón, sea cual sea la combinación de piezas.

## Reglas de uso
- Al montar cualquier mira (de hierro u óptica), oculta la pieza `mira` del arma (las alzas integradas y el asa del G36C).
- Filtra por `categorias_compatibles` y prefiere las de la era del arma (`eras`).
- Apuntado: igual que con las ópticas, por `centro_lente`, con un zoom pequeño (×1,1). Sin mira montada, se usa el apuntado estilo Black de siempre.
- Las dos mitades van juntas como un único accesorio. Si se quiere variedad, se pueden mezclar alzas y puntos de juegos distintos que tengan el mismo `subtipo`: el algoritmo de montaje las alinea igualmente.
- Algunas armas tienen un punto de mira integrado en el guardamanos (M4A4, EVO3, pistolas…). El punto de mira nuevo se coloca detrás o encima del integrado. Si queda mal, basta con desmontarlo.

## Ancla nueva `raíl_frontal`
Se ha añadido a las 95 armas de los packs (kit v3, pack2, pack3 y pack4), tanto en el manifest como en un nodo vacío de la ensamblada. Está en lo alto del guardamanos, cerca de la boca, ignorando los picos estrechos como los puntos de mira integrados.
