# Pack 8 — pilotos de calidad Blender (encargo 28)

Tres objetos para medir el estilo de ``.delegaciones/blender/equipo/`` (biseles, chapa, juntas,
tornillos, rejillas, cables, emisión) aplicado a enemigos y props, dejados como GLB listos para
el juego. Los tres son diseños propios hechos en código (`_comun.py`), no derivados de modelos
ajenos.

## Convención

- Metros reales. **+X = frente del objeto**, **+Y arriba** en el GLB (Z arriba en Blender).
- Origen: centro de la base en el suelo (`enemigo_torreta`, `prop_maquina_bebidas`) y centro del
  cuerpo en el aire (`enemigo_dron`).
- Una malla por pieza, nombre en español (`canon_1`, `rejilla_2`, `lata_b_3`…).
- Materiales Principled simples: color base, metallic, roughness y emisión. **Sin texturas, sin
  mapas, sin luces ni cámaras** en el GLB (comprobado en el JSON del GLB: `images: 0`,
  `textures: 0`, `cameras: 0`, sin `KHR_lights_punctual`).
- Piezas móviles como objeto aparte con el pivote en su eje (traducción del nodo en el GLB).

## Entregables

| objeto | triángulos | mallas | medidas (m) | piezas móviles | qué falta para meterlo al juego |
|---|---:|---:|---|---|---|
| `enemigo_dron.glb` | 3.928 | 104 | 1,20 ancho × 1,19 fondo × 0,49 alto | 4 (`helice_1`…`helice_4`) | clips de giro de hélices, IA/vuelo, puntos de disparo de los cañones, FX de impacto, collider, LOD |
| `enemigo_torreta.glb` | 3.768 | 37 | 0,99 × 0,91 de base × 0,74 alto | 2 (`torreta_giratoria`, `canones`) | guion de giro/elevación, bocas de cañón como sockets, collider por partes, LOD, FX de fogonazo |
| `prop_maquina_bebidas.glb` | 3.392 | 128 | 0,83 fondo × 0,98 ancho × 1,97 alto | 1 (`compuerta_bandeja`) | lógica de compra/expedición, inventario de latas, sonido, collider estático |

Los tres van por debajo del tope de **4.000 triángulos**. Recuento hecho leyendo los `indices`
de cada primitiva del GLB, no la escena de Blender.

| archivo | tamaño |
|---|---|
| `enemigo_dron.glb` | 259 KB |
| `enemigo_torreta.glb` | 202 KB |
| `prop_maquina_bebidas.glb` | 239 KB |
| `*.png` | 640×320, RGBA transparente |

## Piezas móviles (pivotes en el GLB)

| objeto | nodo | pivote (x, y, z) glTF | eje de giro |
|---|---|---|---|
| dron | `helice_1` / `helice_2` / `helice_3` / `helice_4` | (±0,432, 0,073, ±0,432) | +Y (el de Blender +Z) |
| torreta | `torreta_giratoria` | (0, 0,475, 0) | +Y (guiñada de la torreta) |
| torreta | `canones` | (0,19, 0,455, 0) | Z (elevación; en Blender era +Y, que en glTF es −Z) |
| máquina | `compuerta_bandeja` | (0,352, 0,436, 0,090) | Z (bisagra superior, abre hacia fuera) |

`canones` **no está emparentado** con `torreta_giratoria` (los nodos son hermanos en la raíz):
al integrarlo, hay que colgar los cañones de la torreta o aplicarles el mismo giro de guiñada.

## Qué hay en cada objeto

- **Dron** (`enemigo_dron`): cuerpo con chapa atornillada, lomo y franja roja, morro cónico con
  ojo-cámara emisivo rojo (aro, lente, pupila), sensor frontal con rejillas y luces de
  aterrizaje, 4 brazos con hombro, canal de cable y banda roja, 4 góndolas con conducto abierto,
  labio atornillado y hélice de 3 aspas, 2 cañones laterales con anillo y freno de boca,
  patines plegados con bisagra, antena con punta emisiva y latiguillos.
- **Torreta** (`enemigo_torreta`): base octogonal blindada con faldones, nervios, 8 tornillos,
  rejillas, franja de aviso, topes de goma, caja de conexiones con prensaestopas y cable;
  pedestal con 6 tornillos, corona de giro y aro de aviso naranja; cabeza giratoria con tapa,
  escotilla con asa, mejillas y franjas naranjas, sensor emisivo con LED, placa de aviso, aletas
  de refrigeración laterales, cajón de munición con correas y codo de alimentación, portezuela,
  antena; cañones gemelos con mantelete, eje de elevación, fundas, anillos, frenos de boca y
  aletas.
- **Máquina** (`prop_maquina_bebidas`): carcasa de chapa por paneles con juntas y perfiles
  cromados, ventana con cristal, marco, estantes, raíles de precio, luz interior y 12 latas de
  tres colores, cabecera luminosa cian con logotipo, botonera con display, 6 botones, ranura de
  moneda y lector de tarjeta, tirador, bandeja con labio y compuerta abatible, rejillas
  inferiores y laterales, portezuela de servicio, etiqueta cian, zócalo, patas, tapa superior con
  campana de ventilación y cable de red.

## Cómo se generó (para poder retomar)

Un guion por objeto en `.delegaciones/blender/pilotos/` (`enemigo_dron.py`,
`enemigo_torreta.py`, `prop_maquina_bebidas.py`). Importan `../equipo/_comun.py` (que **no se ha
tocado**: sigue en `VERSION = "r1"`), construyen la pieza, **exportan el GLB antes de montar la
foto** (así no entran suelo de sombra, luces ni cámara) y luego llaman a `C.foto()` con
`EQUIPO_DIR=raw/pack8_pilotos`.

```
cd .delegaciones/blender/pilotos
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python enemigo_dron.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python enemigo_torreta.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python prop_maquina_bebidas.py
```

Los `KeyError: 'mesh.knife_tool'` al arrancar y al salir son del addon Half_Knife del perfil de
Blender: ruido, no afectan al resultado. Cada guion imprime `PIEZAS n TRIANGULOS m` y aborta si
pasa de 4.000.

Export usado (idéntico en los tres):

```python
bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', export_apply=True,
                          use_selection=False, export_cameras=False, export_lights=False)
```

### Notas de ejecución

- **Encuadre**: `C.foto(ID, az=38.0)`. `_comun.py` usa por defecto `az=-38` (cámara a −X/−Y),
  pensado para objetos con el frente en −Y; como aquí el frente es +X, se espeja la cámara a
  +X/−Y. Misma altura (21°), misma lente (58 mm), mismas luces de estudio y mismo fondo
  transparente que `assets/equipo/*.png`; la luz principal sigue entrando por arriba-izquierda
  del encuadre.
- **Presupuesto**: el bisel se aplica solo donde aporta silueta (cuerpo, tapas, brazos) y se
  omite en tornillos, juntas, botones y latas; con `segs=2` un cilindro de 12 caras pasa de 44 a
  332 triángulos y un cubo de 12 a 108, así que el detalle fino va a bisel 0.
- **Materiales**: se descartó el parámetro `variacion` de `_comun.mat()` (mete un nodo Noise en
  la rugosidad) para que el GLB quede limpio, sin mapas.
- **Correcciones tras revisar el PNG**: dron 2 (cañones largos y hélices hundidas; conducto
  interior en material claro), torreta 2 (cañones desproporcionados y sensor tapado; aletas con
  el eje de grosor cambiado, que salían como una aleta negra gigante), máquina 3 (una pasada de
  más, solo materiales: el interior emisivo subido a 6,0 y las latas sin metallic para que se
  lean tras el cristal).

## Verificación hecha

- GLB leídos con un parser propio: triángulos por primitiva, `min/max` de POSITION con las
  transformaciones de nodo, materiales, emisivos, ausencia de cámaras/luces/imágenes/texturas.
- Cotas: dron 1,199 × 1,191 × 0,491 m (objetivo ~1,2 m de ancho); torreta 0,989 × 0,912 de base
  y 0,740 de alto, apoyada en y=0; máquina 0,830 × 0,984 y 1,967 de alto, base en y=0.
- PNG abiertos y juzgados uno a uno (encuadre, lectura de silueta, acentos y emisión).

## Pendiente / decisiones que conviene revisar

- No hay clips de animación en el GLB: solo los pivotes. El giro de hélices, la guiñada de la
  torreta y la compuerta se animan desde el juego.
- Nombres y materiales en español, coherentes con `assets/equipo/`; si el runtime espera una
  convención en inglés o `mat_<pieza>`, hay que renombrar en el importador.
- No hay sockets ni puntos de disparo. Si se quieren, conviene añadirlos como empties (se
  exportan como nodos sin malla) en los guiones, no en el juego.
- El GLB usa `KHR_materials_emissive_strength` (emisión > 1 en el ojo del dron, el sensor de la
  torreta, la cabecera y la luz interior de la máquina). Si el runtime no soporta la extensión,
  el emisivo se queda en intensidad 1: sigue leyéndose, pero pierde brillo.
- Todos los nodos cuelgan de la raíz de la escena (no hay jerarquía): la torreta y los cañones
  son hermanos, así que el juego decide cómo emparentarlos al animarlos.
- La máquina mide 1,97 m de alto (escala de expendedora real); si el hall del juego usa otra
  escala, escalar el nodo raíz.
