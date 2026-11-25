# Encargo 28 — Pilotos de calidad Blender: enemigo dron, enemigo torreta y un prop del hall

Objetivo: probar el estilo de calidad de `.delegaciones/blender/equipo/` (biseles, detalle, materiales, emisión) en enemigos y props, y dejarlos como GLB utilizables en el juego. El estilo actual del juego es «de juguete y plastilina»: la meta es que parezcan objetos industriales reales (paneles, juntas, tornillos, rejillas, cables, desgaste).

Entregables en `raw/pack8_pilotos/` (crear):
1. `enemigo_dron.glb` + `enemigo_dron.png`: dron de combate flotante (cuerpo compacto con carcasa de paneles, 4 hélices/turbinas con carenado, cámara-ojo emisivo rojo, 2 cañones laterales, patines plegados, antena, ventilaciones). ~1,2 m de ancho. Acento rojo.
2. `enemigo_torreta.glb` + `enemigo_torreta.png`: torreta de sentinela enemiga (base blindada con tornillos, torreta giratoria con cañón doble y refrigeración, sensor emisivo, cajón de munición, cables). Acento naranja.
3. `prop_maquina_bebidas.glb` + `prop_maquina_bebidas.png` (máquina expendedora del hall: carcasa pintada, ventana con latas, botonera con luces, bandeja, rejilla, patas). Acento cian.
Cada .png 640x320 transparente con el mismo encuadre y luces que `assets/equipo/*.png` (usa `.delegaciones/blender/equipo/_comun.py`, NO lo modifiques; mira dome.py como estructura).

Reglas del GLB: metros, +X = frente del objeto, +Y arriba al exportar (glTF), origen en el centro de la base (en el suelo; el dron, en su centro), una malla por pieza con nombre claro, **máximo 4.000 triángulos por objeto**, materiales Principled simples (color base, metal, rugosidad, emisión donde proceda), sin texturas ni mapas, sin luces ni cámaras en el GLB. Pieza móvil (hélices, cañones, torreta giratoria) como objeto aparte con el pivote en su eje, para poder animarla desde el juego. Diseños propios, no copias de modelos ajenos.

Pasos: 1) un guion por objeto en `.delegaciones/blender/pilotos/<id>.py` que importe `../equipo/_comun.py` (sys.path) y exporte GLB con `bpy.ops.export_scene.gltf(export_format='GLB', export_apply=True, use_selection=False, export_cameras=False, export_lights=False)` y PNG. 2) ejecuta con "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python <guion> (los errores de addons al salir son ruido). 3) abre cada PNG, juzga y corrige (máx. 2 correcciones por objeto). 4) cuenta triángulos de cada GLB y escribe `raw/pack8_pilotos/LEEME.md` (tabla: objeto, triángulos, piezas móviles, qué falta para meterlo al juego). No toques `src/`, tests ni nada fuera de estas rutas. Sin commit.
