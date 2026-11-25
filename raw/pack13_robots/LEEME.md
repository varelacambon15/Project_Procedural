# Pack 13 — lote 3: robots y criaturas nuevos (encargo 42; sabueso y mech rehechos en el 45)

Seis enemigos nuevos al estilo del piloto aprobado (`raw/pack8_pilotos/`) y del lote 2
(`raw/pack10_lote2/`): modelado por código con `_comun.py`, materiales Principled simples,
biseles, juntas, tornillos, rejillas, cables y emisión real. Diseños propios: no derivan de
modelos ajenos. Cada pieza es una malla con nombre en español y las piezas articuladas son
objetos `mov_*` con el pivote en su eje de giro.

## Convención

- Metros reales. **+X = frente**, **+Y arriba** en el GLB (Z arriba en Blender).
- Origen: **centro de la base apoyada en el suelo** en cuatro; en los dos drones, **centro
  del cuerpo** (el bombardero y el reparador flotan y el encargo pide el centro).
- Materiales Principled: color base, metallic, roughness y emisión. **Sin texturas, mapas,
  luces ni cámaras** (`images: 0`, `textures: 0`, `cameras: 0`; solo la extensión
  `KHR_materials_emissive_strength`). El escudo del centinela y el halo de soldadura usan
  alfa real (`alphaMode: BLEND`); el resto es opaco.
- Tope de triángulos: 3.500 por objeto; la arañita 1.500 y el mech pesado 6.000.

## Entregables

| objeto | triángulos | mallas | piezas móviles | medidas (m) |
|---|---:|---:|---|---|
| `enemigo_dron_bombardero.glb` | 3.464 | 123 | 4 (`mov_rotor_1`…`4`) | 1,10 fondo × 0,75 alto × 1,03 ancho |
| `enemigo_dron_reparador.glb` | 2.628 | 84 | 5 (`mov_brazo`, `mov_rotor_1`…`4`) | 0,89 fondo × 0,75 alto × 0,85 ancho |
| `enemigo_sabueso.glb` | 3.424 | 64 | 5 (`mov_mandibula`, `mov_pata_1`…`4`) | 1,31 fondo × 0,82 alto × 0,42 ancho |
| `enemigo_centinela_flotante.glb` | 3.476 | 63 | 2 (`mov_anillo`, `mov_canon`) | 0,99 fondo × 0,76 alto × 0,69 ancho |
| `enemigo_aranita.glb` | 1.404 | 38 | 6 (`mov_pata_1`…`6`) | 0,40 fondo × 0,32 alto × 0,51 ancho |
| `enemigo_mech_pesado.glb` | 5.824 | 5 | 5 (`mov_pierna_der/izq`, `mov_brazo_der/izq`, `mov_torso`) | 1,69 fondo × **2,62 alto** × 2,15 ancho |

Recuento hecho leyendo los `indices` de cada primitiva del GLB (no la escena de Blender):
`python .delegaciones/blender/robots/revisar_glb.py` termina con `FALLOS 0`.

| archivo | tamaño GLB | tamaño PNG |
|---|---:|---:|
| `enemigo_dron_bombardero` | 257 KB | 202 KB |
| `enemigo_dron_reparador` | 192 KB | 160 KB |
| `enemigo_sabueso` | 197 KB | 194 KB |
| `enemigo_centinela_flotante` | 212 KB | 176 KB |
| `enemigo_aranita` | 109 KB | 170 KB |
| `enemigo_mech_pesado` | 264 KB | 156 KB |

Los seis PNG son **640 × 320 RGBA transparente** (PNG color type 6), con el mismo encuadre y
las mismas luces de estudio que los pilotos: `C.foto` con `az=38` salvo el sabueso (`az=37`,
`el=16`) y el mech (`az=22`, `el=16`, para que la ametralladora se lea de perfil) y alturas de
cámara de 14–24° (el centinela a 14° para ver la levitación; los drones a 20–22°). El mech
ocupa el 87,5 % del alto del PNG (umbral de alfa 120/255) y el sabueso el 88,8 %.

## Piezas móviles (pivotes en el GLB)

| objeto | nodo | pivote (x, y, z) glTF | eje de giro |
|---|---|---|---|
| bombardero | `mov_rotor_1` / `_2` | (+0,424, +0,169, ∓0,396) | eje de la hélice (Y del GLB) |
| bombardero | `mov_rotor_3` / `_4` | (−0,368, +0,169, ±0,396) | ídem |
| reparador | `mov_brazo` | (+0,088, +0,076, +0,170) | hombro: guiñada/cabeceo del brazo |
| reparador | `mov_rotor_1`…`4` | (±0,259/−0,307, +0,156, ±0,283) | eje de la hélice |
| sabueso | `mov_mandibula` | (+0,478, +0,596, 0,000) | bisagra de la mandíbula |
| sabueso | `mov_pata_1` / `_2` | (+0,245, +0,521, +0,130 / −0,130) | cadera delantera |
| sabueso | `mov_pata_3` / `_4` | (−0,286, +0,505, +0,124 / −0,124) | cadera trasera |
| centinela | `mov_anillo` | (0,000, +0,126, 0,000) | centro del anillo repulsor (guiñada) |
| centinela | `mov_canon` | (+0,186, +0,542, 0,000) | muñón del cañón doble (cabeceo) |
| arañita | `mov_pata_1`…`6` | ver `revisar_glb.py` | cadera de cada pata |
| mech | `mov_pierna_der` / `_izq` | (0,000, +1,448, +0,380 / −0,380) | cadera (cabeceo) |
| mech | `mov_brazo_der` / `_izq` | (0,000, +2,098, +0,600 / −0,600) | hombro (guiñada/cabeceo) |
| mech | `mov_torso` | (0,000, +1,498, 0,000) | cintura (guiñada) |

## Qué falta para integrarlos en el juego

- Clips de animación: giro de rotores, apertura de mandíbula, patas (andar/galope), anillo y
  cañón del centinela, ciclo de marcha y apuntado del mech.
- IA/vuelo en los drones y el centinela; locomoción en sabueso, arañita y mech.
- Sockets: bocas de cañón (mech y centinela), punta de antorcha (`enemigo_dron_reparador`),
  tubos del lanzamisiles, ganchos de la bahía del bombardero.
- Colliders por partes, LOD, FX de fogonazo/impacto/soldadura y sonidos.

## Notas de modelado

- Guiones en `.delegaciones/blender/robots/<id>.py`; importan `equipo/_comun.py` **sin
  modificarlo** (comprueban `VERSION == "r1"`). Ejecutar:
  `blender.exe -b --python .delegaciones/blender/robots/<id>.py`.
- El bombardero lleva bahía abierta con 4 bombas colgadas (dos filas de dos) y cola de doble
  botalón con derivas; el reparador, cruz médica estilizada (sin texto) en el lomo y el costado,
  brazo de soldadura con bobina y haz emisivo verde (núcleo brillante + halo translúcido).
- **Sabueso y mech rehechos (encargo 45).** Los dos dejaron las cajas apiladas por volúmenes
  barridos con `bmesh` (superelipses y anillos) y sombreado suave: el sabueso tiene lomo
  arqueado, cuello corto y grueso, cráneo corto y ancho con máscara, visor rojo en chevrón,
  mandíbula articulada con colmillos metálicos, orejas en aleta, garras, pistones, cables y
  faldones con remaches; el mech, torso en barril, hombreras redondeadas con bisel de 3
  segmentos, cabina con visor emisivo, lanzamisiles de 4 tubos en el hombro izquierdo,
  ametralladora de 3 cañones con tambor y cinta en el brazo derecho, piernas gruesas con
  pistones, pies anchos con garras, escapes, radiador y chevrones de peligro (sin texto).
- El sabueso es digitígrado (muslo, caña, metatarso y garra) con las traseras en Z; el
  centinela levita sobre un anillo repulsor con tres columnas de energía y escudo frontal de
  tres paneles translúcidos; el mech lleva puño hidráulico con escudo en el brazo izquierdo.
- Correcciones hechas: presupuesto de triángulos (biseles/aros ajustados en bombardero,
  centinela y mech), legibilidad del haz del reparador, encuadre del mech, y en el encargo 45
  rediseño completo de sabueso (ya no parece un caballo) y mech (más ancho y macizo), con
  biseles de 2–3 segmentos en las piezas redondas y encuadre del mech al 87,5 % del alto.
