# Encargo 55 — Modelo de la torreta de la super «sentry» (solo Blender, NO toques `src/`)
Decisión del usuario: la torreta pequeña del equipamiento (`.delegaciones/blender/equipo/turret.py`, GLB `assets/equipo3d/turret.glb`) ya tiene modelo; la de la super es más grande y poderosa y necesita el suyo. Cógela como base, agrándala y adáptala.
## Qué hacer
1. Crea `.delegaciones/blender/equipo/sentry_super.py` (parte de `turret.py`, usa `_comun.py` igual que él; verifica `C.VERSION == "r1"`). Mismo lenguaje visual (pintura oscura, acento) pero acento CIAN `0x6ad8ff` (color de la super) en vez de ámbar.
2. Más grande y potente: ~2× la altura (≈1,9 m de torre total), trípode más ancho y anclado con puntas, cabeza con dos cañones gemelos (o cañón grueso + bloque de refrigeración), carenados, caja de munición lateral, antena y un ojo/sensor cian. Debe leerse «torreta pesada» desde 6–10 m. ≤ 3.000 triángulos.
3. Convención GLB (igual que el resto de equipo): metros, +X frente… pero esta torreta mira hacia −Z en el juego (cañón hacia −Z en el código actual): exporta con el cañón apuntando a +X como el resto de GLB y deja anotado en el informe la orientación. Origen en el suelo, malla por pieza, Principled, sin texturas/luces/cámaras.
4. Nombres de pivotes OBLIGATORIOS (el código los busca): `head` (grupo que gira en yaw/pitch, centro en el eje del poste), `tip` (vacío en la boca del cañón, pivote en la punta), y animables `mov_cañon_l`, `mov_cañon_r` (retroceso en eje del cañón), `mov_antena`, `mov_patas` si se despliegan. Todo lo que gira con la cabeza debe colgar de `head`.
5. Exporta a `raw/pack15_super/sentry_super.glb` y copia a `assets/equipo3d/sentry_super.glb`. Genera una contact sheet (como hacen los demás packs, `hoja5.cjs`/`hoja20.cjs` en `.delegaciones/herramientas/capturas/`) en `raw/pack15_super/hoja_sentry_super.png`: frontal, lateral, ¾ y desde 8 m.
## Aceptación
GLB abre sin errores, ≤3.000 tris, pivotes con esos nombres, hoja revisada por ti (cambios si se ve de juguete/plastilina: queremos calidad Blender del pack9/pack13). Informe de 10 líneas con tris, nombres de piezas, orientación y ruta.
## Prohibido
Tocar `src/`, tests, commit, instalar nada, suite completa. Solo estos ficheros nuevos.
