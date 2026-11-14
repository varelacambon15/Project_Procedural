# Pack 2: armas modeladas sobre armas reales (inspiración Ghosts)

29 armas hechas a mano en hard-surface, 4 por categoría y una escopeta extra. Cada una se basa en un arma real (campo `base_real`). Las que salen en Call of Duty Ghosts están marcadas así, y llevan algún detalle de estilo propio, no copiado del juego.

**Mismas convenciones que el kit principal (`kit_armas_v3`):**
- Metros, +X hacia la boca, +Y hacia arriba, origen centrado en X y Z con la base en Y = 0.
- Normales con aristas vivas y un material liso por pieza (`mat_<pieza>`).
- Menos de 6.000 triángulos por arma.
- Piezas con el origen en su ancla de unión.
- `<arma>_ensamblada.glb` con un nodo por pieza y un nodo vacío por ancla, `manifest.json` por arma y `catalogo.json` en la raíz.

| Categoría | Armas (base real) |
|---|---|
| Revólver | RB-454 (Raging Bull, Ghosts), PY-357 (Colt Python), WB-MK6 (Webley Mk VI), NG-1895 (Nagant M1895) |
| Pistola | SG-226 (P226, Ghosts), GR-443 (MP-443, Ghosts), FS-57 (Five-seveN), MS-C96 (Mauser C96) |
| Subfusil | VK-45 (Vector, Ghosts), BZ-19 (Bizon), TM-28 (Thompson), UZ-9 (Uzi con culata de madera) |
| Fusil | RD-556 (MSBS Radon, Ghosts), BR-805 (CZ 805 BREN, Ghosts), FL-762 (FAL), SG-44 (StG 44) |
| Francotirador | LX-127 (GM6 Lynx, Ghosts), AW-338 (AWM), MN-91 (Mosin PU), DV-762 (SVD) |
| Escopeta | MT-255 (MTs-255, Ghosts), SP-12 (SPAS-12), KS-12 (KSG), DB-12 (dos cañones), SR-1216 (SRM 1216, la M1216 de Black Ops 2) |
| Ametralladora | LS-556 (LSAT, Ghosts), MG-3 (MG3, Ghosts), PK-762 (PKM), BR-303 (Bren) |

**Particularidades de algunas armas:**
- **Revólveres y MT-255:** llevan `tambor` en lugar de `cargador`, con el ancla `eje_tambor`.
- **RB-454:** el inserto rojo de la empuñadura es una pieza aparte (`inserto`), para poder recolorearlo.
- **Depósitos tubulares (SP-12 y KS-12):** son la pieza `cargador`, de tipo tubular. El de KS-12 son dos tubos.
- **TM-28 y KS-12:** llevan un agarre delantero en `raíl_inferior`.
- **BR-303:** el cargador va encima del cajón, apuntando hacia +Y. Su `pozo_cargador` está en la cara superior y el cargador sube desde ahí.
- **MG-3:** la caja de cinta cuelga del lado izquierdo, y `pozo_cargador` tiene Z negativa.
- **DB-12:** no tiene cargador; los cartuchos van en la recámara.
- **Pistolas y revólveres:** no tienen culata, pero llevan el ancla `cara_culata`.
- **Visores de los francotiradores:** vienen de la biblioteca de miras, simplificados a unos 1.700 triángulos. Llevan `tipo_mira`, `aumento` y `centro_lente` (como ancla y como nodo hijo del visor). Se ve a través de todos.
- **Resto de armas:** llevan un alza como pieza `mira`, intercambiable por cualquier óptica en `raíl_superior`.

Cada manifest incluye además `base_real`, `era_sugerida`, `boca_diametro_m`, `seccion_union_m` por pieza y `piezas_ausentes`.

## Ancla raíl_frontal (nueva)
Cada arma tiene el ancla `raíl_frontal` en lo alto del guardamanos, cerca de la boca, tanto en el manifest como en un nodo vacío de la ensamblada. Ahí va el punto de mira de las miras de hierro desmontables (ver el pack miras_hierro).

## Contenido de raw/pack2
Solo están las 7 armas seleccionadas: RB-454, SG-226, VK-45, RD-556, DV-762, SR-1216 y LS-556. Cada manifest lleva el campo `accion`.
