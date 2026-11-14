# Pack 4 — armas adaptadas y pool de accesorios

Mismas convenciones que el kit: metros, +X hacia la boca, +Y arriba, origen centrado en X y Z con la base en Y = 0, un material liso por pieza (`mat_<pieza>`), aristas vivas a 32°, menos de 6.000 triángulos por arma y cada pieza con el origen en su ancla. Cada arma trae `<arma>_ensamblada.glb`, `piezas/*.glb` y `manifest.json`; `catalogo.json` está en la raíz.

## Armas (23)

| Arma | Base | `tipo_juego` | `accion` | Triángulos | Largo (m) | Piezas ausentes | Accesorios de serie |
|---|---|---|---|---|---|---|---|
| MK23 | HK Mk 23 | `pistol` | `semiautomatica` | 2854 | 0.245 | culata | — |
| HK45 | HK45 | `pistol` | `semiautomatica` | 2114 | 0.204 | culata | — |
| CZ75 | CZ 75 | `pistol` | `semiautomatica` | 3078 | 0.206 | culata | — |
| M9 | Beretta M9 | `pistol` | `semiautomatica` | 4907 | 0.217 | culata | — |
| CP33 | Kel-Tec CP33 | `pistol` | `semiautomatica` | 4439 | 0.28 | culata | — |
| APB | Stechkin APB con culata de alambre | `pistol` | `automatica` | 2708 | 0.5568 | — | sup_apb |
| WELROD | Welrod Mk I (supresor integrado) | `pistol` | `cerrojo` | 4023 | 0.36 | culata | — |
| NAGANT | Nagant M1895 | `revolver` | `revolver_doble` | 5680 | 0.235 | culata, mira | — |
| QB327 | Mossferg QB327 (escopeta semiautomática de cargador) | `shotgun` | `semiautomatica` | 5544 | 0.8749 | culata, mira | pr_mini_qb, bo_freno_escopeta |
| SMG-S | Subfusil compacto con supresor (modelo genérico) | `smg` | `automatica` | 1569 | 0.5814 | mira | sup_smg_s, pr_caja_smg, ag_vertical_smg |
| M249 | FN M249 SAW | `lmg` | `automatica` | 5683 | 1.04 | mira | bp_m249 |
| LVOA-C | War Sport LVOA-C | `rifle` | `automatica` | 5679 | 0.86 | mira | — |
| MOSIN | Mosin-Nagant 91/30 | `sniper` | `cerrojo` | 5684 | 1.232 | empunadura | — |
| SSG69 | Steyr SSG 69 | `sniper` | `cerrojo` | 5633 | 1.14 | cargador, mira | — |
| SR25 | KAC SR-25 (fusil de tirador) | `sniper` | `semiautomatica` | 5690 | 1.12 | mira | — |
| M200 | CheyTac M200 Intervention | `sniper` | `cerrojo` | 4660 | 1.42 | mira | bp_m200 |
| M24 | Remington M24 SWS | `sniper` | `cerrojo` | 5681 | 1.092 | mira | sup_m24 |
| VECTOR | KRISS Vector | `smg` | `automatica` | 5685 | 0.6198 | — | — |
| JNG90 | Unique Alpine JNG-90 | `sniper` | `cerrojo` | 5680 | 1.18 | mira | — |
| G36C | HK G36C | `rifle` | `automatica` | 5684 | 0.72 | — | — |
| EVO3 | CZ Scorpion EVO 3 | `smg` | `automatica` | 5679 | 0.67 | — | — |
| M2 | Benelli M2 | `shotgun` | `semiautomatica` | 4198 | 1.0 | mira | — |
| M82 | Barrett M82A1 | `sniper` | `semiautomatica` | 5694 | 1.45 | — | te_m82 |

## Accesorios: pool aparte (`accesorios/`)
Los accesorios que venían montados en las armas (miras, supresores, frenos de boca, agarres y bípodes) se han quitado del arma y van en `accesorios/`, no en las piezas. Su índice es `accesorios/accesorios.json`, con el mismo formato que `piezas_sueltas/piezas.json` del kit.

| Id | Categoría | Ancla del arma | Tipo | Triángulos | Venía en |
|---|---|---|---|---|---|
| `sup_apb` | bocachas | `boca` | supresor | 108 | APB |
| `pr_mini_qb` | miras | `raíl_superior` | punto_rojo x1 | 82 | QB327 |
| `bo_freno_escopeta` | bocachas | `boca` | freno | 683 | QB327 |
| `sup_smg_s` | bocachas | `boca` | supresor | 974 | SMG-S |
| `pr_caja_smg` | miras | `raíl_superior` | punto_rojo x1 | 288 | SMG-S |
| `ag_vertical_smg` | agarres | `raíl_inferior` | vertical | 137 | SMG-S |
| `bp_m249` | bipodes | `raíl_inferior` | desplegado | 556 | M249 |
| `bp_m200` | bipodes | `raíl_inferior` | desplegado | 232 | M200 |
| `sup_m24` | bocachas | `boca` | supresor | 1184 | M24 |
| `te_m82` | miras | `raíl_superior` | telescopica x10 | 3244 | M82 |
| `ag_rvg` | agarres | `raíl_inferior` | vertical | 534 | suelto |
| `ag_afg_a` | agarres | `raíl_inferior` | angulado | 762 | suelto |
| `ag_afg_b` | agarres | `raíl_inferior` | angulado | 648 | suelto |
| `mg_g33` | miras | `raíl_superior` | magnificador x3 | 2258 | suelto |

Orígenes locales:
- **Miras:** centro de la base, apoyada en `raíl_superior`. Llevan `centro_lente_local`, `tipo_mira`, `aumento` y `ve_a_traves`, y todas se pueden atravesar con la vista. A la telescópica del M82 y al magnificador G33 se les ha abierto un túnel óptico. A los puntos rojos se les ha quitado el cristal.
- **Bocachas:** cara trasera centrada en el eje del cañón; se extienden hacia +X. El ancla `boca` local marca la nueva boca, y `diametro_encaje_m` el diámetro del encaje.
- **Agarres y bípodes:** centro de la cara superior, colgando hacia −Y, en `raíl_inferior`. Los bípodes vienen desplegados.

En cada manifest, `accesorios_de_serie` dice qué accesorios llevaba el arma y en qué ancla. Las anclas del arma están en el punto exacto donde iban montados, así que si se equipan por defecto el arma queda como el original. Por ejemplo, el `boca` del M24 está donde empezaba el supresor.

## Campo nuevo: `accion`
`semiautomatica`, `automatica`, `cerrojo`, `bombeo`, `revolver_simple` o `revolver_doble`. Úsalo para elegir las animaciones en lugar de `tipo_juego`: hay escopetas y pistolas de cerrojo (Welrod).

## Notas por arma
- **M249:** venía con la tapa de alimentación abierta; se ha cerrado girándola sobre su bisagra. La caja de munición es la pieza `cargador`.
- **G36C:** el asa de transporte con sus miras es la pieza `mira` (alza integrada).
- **APB:** la culata de alambre es la pieza `culata`; el supresor va al pool.
- **Mosin 91/30:** no tiene empuñadura de pistola, así que no lleva `empunadura`. La caja del cargador fija es `cargador`.
- **SSG 69, M24 y M2:** la empuñadura es la garganta de la culata, recortada como pieza aparte.
- **Welrod:** el supresor es parte del cañón (integrado), no un accesorio.
- **SR-25:** va como `sniper` por ser fusil de tirador. Cámbialo a `rifle` si lo prefieres.
- **No incluidas:** el lanzagranadas Milkor MGL, porque no hay categoría de juego para él, y los cartuchos sueltos del modelo QB327.

## Ancla raíl_frontal (nueva)
Cada arma tiene el ancla `raíl_frontal` en lo alto del guardamanos, cerca de la boca, tanto en el manifest como en un nodo vacío de la ensamblada. Ahí va el punto de mira de las miras de hierro desmontables (ver el pack miras_hierro).
