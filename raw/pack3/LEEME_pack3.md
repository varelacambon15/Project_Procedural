# Pack 3: modelos aportados por Alejandro, adaptados al kit

Las convenciones son las mismas que en `kit_armas_v3`:
- Metros, +X hacia la boca, +Y hacia arriba, origen centrado en X y Z con la base en Y = 0.
- Aristas vivas y un material liso por pieza (`mat_<pieza>`). Las texturas originales se han quitado.
- Menos de 6.000 triángulos por arma.
- Cada pieza tiene el origen en su ancla.
- Por arma: `<arma>_ensamblada.glb` (un nodo por pieza y un nodo vacío por ancla) y `manifest.json`. En la raíz, `catalogo.json`.

| Arma | Origen | Tipo | Piezas | Ausentes |
|---|---|---|---|---|
| GL-18S | Generada con TRELLIS.2 y reducida | pistola | cuerpo, culata, guardamanos_canon, empunadura, cargador, mira | — |
| M4A4 | Modelo low-poly | fusil | cuerpo, culata (con el tubo), guardamanos_canon, empunadura, cargador, mira (alza) | — |
| TOZ-106 | Modelo low-poly | escopeta | cuerpo, culata plegable, guardamanos_canon, empunadura, cargador | mira |
| REV-45LC | Modelo low-poly | revólver | cuerpo, tambor (hace de cargador), guardamanos_canon, empunadura | culata, mira |

**Notas por arma:**
- **GL-18S:** la culata de varilla se ha engrosado a 10 mm y lleva casquillos de refuerzo. Es una excepción consciente a la regla de «nada de varillas finas».
- **M4A4:**
  - El punto de mira va con `guardamanos_canon` y el alza con `mira`.
  - El raíl que va sobre el guardamanos pasa con él, cortado por delante del cajón.
  - El cañón se ha reducido para no pasar de 6.000 triángulos.
- **TOZ-106:**
  - El cargador se ha cortado del cajón por su contorno.
  - No tiene `mira` separable: sus miras van fundidas con el cañón.
  - Lleva `raíl_superior` sobre el cajón y `linea_mira` en el punto de mira.
- **REV-45LC:**
  - El modelo original traía dos revólveres y dos cartuchos; solo se ha usado uno.
  - El cañón venía despiezado en el modelo original (las placas laterales y la tira superior separadas hacia arriba y hacia fuera). Se ha montado como en la segunda copia del mismo archivo.
  - El alza va fundida con el puente superior.

## Campo `accion`
Cada manifest y el catálogo llevan `accion`, para elegir la animación de recarga y de disparo: `semiautomatica`, `automatica`, `cerrojo`, `bombeo`, `revolver_simple`, `revolver_doble`. La TOZ-106 es de cerrojo, no de bombeo.

## Ancla raíl_frontal (nueva)
Cada arma tiene el ancla `raíl_frontal` en lo alto del guardamanos, cerca de la boca, tanto en el manifest como en un nodo vacío de la ensamblada. Ahí va el punto de mira de las miras de hierro desmontables (ver el pack miras_hierro).
