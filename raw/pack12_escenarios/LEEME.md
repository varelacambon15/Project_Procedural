# Pack 12 — Escenarios, lote 1: 10 props de arena, raid y hall (encargo 41)

Ambientación de simulación táctica/industrial, con el método de los pilotos (`raw/pack8_pilotos/`)
y del lote 2 (`raw/pack10_lote2/`): modelado por código con `_comun.py`, materiales Principled
simples, biseles, juntas, tornillos, rejillas, cables y desgaste. Diseños propios: no derivan de
modelos ajenos. Esta vez el tope es **3.000 triángulos por objeto** (antes 4.000).

## Convención

- Metros reales. **+X = frente del objeto**, **+Y arriba** en el GLB (Z arriba en Blender).
- Origen: **centro de la base apoyada en el suelo** en los diez (cota mínima del GLB en y = 0,000;
  comprobado recorriendo la jerarquía). La lámpara es de pared: el origen queda en el borde
  inferior de la placa de pared, que es su base; el juego la sube a la altura del muro.
- Una malla por pieza, nombre en español (`cuerpo`, `anillo_2`, `lama_vent_3`, `mov_hoja_izq`…).
- Materiales Principled con color base, metallic, roughness y emisión real donde procede
  (pantallas, testigos, lente de la lámpara). **Sin texturas, mapas, luces ni cámaras**
  (`images: 0`, `textures: 0`, `cameras: 0`; solo la extensión `KHR_materials_emissive_strength`).
- Piezas móviles como objeto aparte con prefijo `mov_` y el pivote **en su eje de giro**.

## Entregables

| objeto | triángulos | mallas | piezas móviles | fondo × ancho × alto (m) |
|---|---:|---:|---|---|
| `caja_suministros_grande.glb` | 2.996 | 83 | — | 0,750 × 1,210 × 0,595 |
| `caja_suministros_pequena.glb` | 2.028 | 47 | — | 0,403 × 0,585 × 0,335 |
| `barricada_hormigon.glb` | 1.920 | 56 | — | 0,503 × 1,560 × 0,812 |
| `contenedor_carga.glb` | 2.916 | 98 | — | 0,912 × 1,870 × 1,008 |
| `terminal_consola.glb` | 2.152 | 81 | — | 0,616 × 0,499 × 1,051 |
| `puerta_seguridad.glb` | 2.860 | 63 | 2 (`mov_hoja_izq`, `mov_hoja_der`) | 0,391 × 1,795 × 2,180 |
| `columna_estructural.glb` | 2.558 | 81 | — | 0,550 × 0,680 × 2,238 |
| `lampara_industrial.glb` | 2.550 | 39 | — | 0,523 × 0,356 × 0,440 |
| `generador_energia.glb` | 2.740 | 86 | — | 1,137 × 0,690 × 1,005 |
| `barril_combustible.glb` | 2.808 | 44 | — | 0,606 × 0,592 × 0,955 |

Recuento hecho leyendo los `indices` de cada primitiva del GLB (no la escena de Blender); los diez
están por debajo del tope de 3.000 (la caja grande va al límite: 2.996).

| archivo | GLB | PNG |
|---|---:|---:|
| `caja_suministros_grande` | 175 KB | 213 KB |
| `caja_suministros_pequena` | 108 KB | 197 KB |
| `barricada_hormigon` | 107 KB | 175 KB |
| `contenedor_carga` | 202 KB | 194 KB |
| `terminal_consola` | 153 KB | 155 KB |
| `puerta_seguridad` | 170 KB | 154 KB |
| `columna_estructural` | 166 KB | 130 KB |
| `lampara_industrial` | 114 KB | 176 KB |
| `generador_energia` | 178 KB | 180 KB |
| `barril_combustible` | 122 KB | 155 KB |

Los diez PNG son **640 × 320 RGBA transparente** (PNG color type 6), con el encuadre de
`C.foto(...)`: `az=38` salvo la lámpara (`az=42`), `el=16…24` según lo alto o bajo del objeto
(la puerta y la columna casi de frente, el barril y la caja pequeña un poco más desde arriba),
mismas luces de estudio y mismo fondo transparente que `assets/equipo/*.png`.

## Qué hay en cada objeto

- **Caja grande** (`caja_suministros_grande`): cuerpo con postes esquineros y travesaños, patines
  con topes de apilado, tapa con nervios, junta de goma, bisagras traseras, dos cierres de palanca
  con pasador, asas laterales de tubo, dos precintos amarillos con hebilla y sello naranja,
  remaches, rejillas de ventilación, placa de etiqueta, placa de peligro con franjas y protectores
  de esquina, más roces de arrastre.
- **Caja pequeña** (`caja_suministros_pequena`): cuerpo con esquineros y patas de apilado, tapa con
  rehundido, asa superior de tubo con abrazaderas, dos cierres, bisagras, precinto con sello,
  rejillas, etiqueta, placa de peligro y roces.
- **Barricada** (`barricada_hormigon`): masa de hormigón con perfil en pendiente (base, cuerpo y
  remate), junta central y de módulo, dos flejes de acero con tornillos, argollas de izado
  soldadas, asas laterales, franjas amarillas en las dos caras, reflectantes blancos, placas de
  anclaje con pernos, desagües, desconchón, mancha y roces.
- **Contenedor** (`contenedor_carga`): largueros y esquineras con agujeros de grúa y tornillos,
  suelo de carga, paneles laterales con nervios, golpes de carga y rejillas, trasera con nervios,
  techo con nervios y respiradero, canal de lluvia, puertas dobles con junta, jambas, dintel y
  umbral, cuatro barras de cierre con soportes, mangos, levas y pasadores, bisagras, placas de
  etiqueta, peligro y fabricante, bolsas de horquilla y toma de tierra con cable.
- **Terminal** (`terminal_consola`): base atornillada, zócalo, columna con puerta de servicio,
  rejillas, banda amarilla con franjas, teclado inclinado con doce teclas, almohadilla, lector con
  ranura y LED, cabeza inclinada con pantalla emisiva y "interfaz" de barras y puntos, marco,
  rejilla de altavoz, asa superior, botones de paro (rojo) y marcha (verde), etiquetas y cable.
- **Puerta** (`puerta_seguridad`): marco con jambas reforzadas, placas de anclaje y pernos, dintel,
  cabecera con franjas de peligro, umbral, topes de goma, caja de luz con lente emisiva verde y
  viseras, piloto rojo, lector con ranura y teclado en la jamba, placa de aviso, conducto con
  abrazaderas y cable hasta la caja. Dos hojas con rigidizadores, placa de patada, manilla,
  cerradura, palas de bisagra, roce y placa, más los ejes de bisagra fijos en el marco.
- **Columna** (`columna_estructural`): placa base con pernos, tuercas y cuatro cartelas
  triangulares, fuste en H (alas, alma, cordones de soldadura y refuerzos a media altura), capitel
  con cartelas y pernos, banda de peligro con franjas, etiqueta y placa de peligro, roces de óxido,
  conducto con cuatro abrazaderas, caja de conexión con testigo emisivo, bandeja portacables con
  tres cables y tres peldaños de mantenimiento.
- **Lámpara** (`lampara_industrial`): placa de pared con junta y pernos, caja de conexión con tapa,
  prensaestopas, interruptor con palanca y testigo, brazo con escuadra, abrazadera, cuello, pantalla
  cónica, aro cromado, lente y bombilla emisivas, tres soportes, tres varillas de guardia con aro
  inferior, cable con grapa, placa de aviso y roce. **No es una luz real**: solo material emisivo.
- **Generador** (`generador_energia`): bancada con patines, travesaños y tacos, envolvente con
  esquineros, techo, puerta de servicio con bisagras y cierres, rejillas, etiquetas, banda de
  peligro con franjas, radiador con aletas, marco, aro de ventilador con buje y aspas, tapón,
  depósito con cinchas, boca, tapadera con asas, respiradero y ojos de izado, escape con codo,
  abrazaderas y deflector, manguito de combustible con abrazaderas, panel de control inclinado con
  pantalla emisiva, dos indicadores, LEDs y botón de paro, batería, bornes y cableado.
- **Barril** (`barril_combustible`): cuerpo cilíndrico, fondo y tapa con pestañas, tres anillos de
  refuerzo con soldaduras, cordón de soldadura central, brida con cuello, volante de válvula con
  radios y eje, venteo con caperuza, asas de izado, etiqueta sobre soporte atornillado, diamante de
  peligro y franjas en la tapa, banda amarilla pintada, visor de nivel, óxidos y mellas de arrastre.

## Piezas móviles (pivotes en el GLB)

| objeto | nodo | pivote (x, y, z) glTF | eje de giro |
|---|---|---|---|
| puerta | `mov_hoja_izq` | (0, 0, +0,750) | vertical (+Y), bisagra izquierda |
| puerta | `mov_hoja_der` | (0, 0, −0,750) | vertical (+Y), bisagra derecha |

Las hojas están cerradas en el GLB y **no** van emparentadas (cuelgan de la raíz, como en los
pilotos): cada una lleva su malla completa (hoja, rigidizadores, patada, manilla, cerradura, palas
de bisagra, roce y placa) con el origen en el eje de la bisagra, así que al girar sobre +Y abre sin
dejar herrajes atrás. Los ejes de bisagra del marco son piezas fijas.

## Qué falta para integrarlo en el juego

| objeto | falta |
|---|---|
| cajas | lógica de apertura de tapa (hoy es una malla fija), collider estático, LOD; la pequeña encaja sobre la grande por el rehundido |
| barricada | collider estático (caja o convexo), LOD; es cobertura baja (0,81 m) |
| contenedor | apertura de puertas si se quiere (las hojas son fijas), collider estático, LOD, puntos de cobertura |
| terminal | lógica de uso (lector/teclado), pantalla animada en runtime, sonido, collider estático |
| puerta | animación/IK de las dos hojas sobre su pivote, bloqueo por estado (la luz verde es fija), collider por hoja, sonido |
| columna | collider estático, LOD; el cableado no cuelga de nada |
| lámpara | colocación en pared con traslación (origen en la base de la placa), parpadeo/encendido si se quiere, collider pequeño |
| generador | lógica de energía, sonido y humo, collider estático, LOD |
| barril | física de barril (hoy estático), collider cilíndrico, LOD; la válvula no gira |

Ninguno lleva animación en el GLB (solo los dos pivotes de la puerta), sockets ni colliders: eso se
resuelve en el juego, igual que en los pilotos y el lote 2. El emisivo va por encima de 1 con
`KHR_materials_emissive_strength`; si el runtime no la soporta, se queda en intensidad 1.

## Cómo se generó (para poder retomar)

Un guion por objeto en `.delegaciones/blender/escenarios/` (`caja_suministros_grande.py`,
`caja_suministros_pequena.py`, `barricada_hormigon.py`, `contenedor_carga.py`,
`terminal_consola.py`, `puerta_seguridad.py`, `columna_estructural.py`,
`lampara_industrial.py`, `generador_energia.py`, `barril_combustible.py`). Importan
`../equipo/_comun.py` **sin tocarla** (sigue en `VERSION = "r1"`, con `TRI_MAX = 3000`) y exportan
con `C.exportar_glb(ID, limite=3000, salida=SALIDA)`; la puerta pasa además
`moviles={"mov_hoja_izq": (0.0, -0.75, 0.0), "mov_hoja_der": (0.0, 0.75, 0.0)}`. Cada guion
imprime `PIEZAS n TRIANGULOS m` y corta antes de exportar si excede el tope.

```
cd .delegaciones/blender/escenarios
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python caja_suministros_grande.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python caja_suministros_pequena.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python barricada_hormigon.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python contenedor_carga.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python terminal_consola.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python puerta_seguridad.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python columna_estructural.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python lampara_industrial.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python generador_energia.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python barril_combustible.py
```

Verificación de los GLB (reutiliza `equipo/_verificar_glb.py` sin modificarlo; sin dependencias):

```
python .delegaciones/blender/escenarios/revisar_glb.py
```

Última pasada: **FALLOS 0**. Los diez por debajo de 3.000 triángulos, base en y = 0,000, sin
cámaras, luces, imágenes ni texturas, y los dos nodos `mov_*` con su traslación correcta.

Los `KeyError: 'mesh.knife_tool'` al arrancar y al salir son del addon Half_Knife del perfil de
Blender (`blender.exe` sale con código 1 por eso): ruido, no afecta al resultado.

## Correcciones tras abrir los PNG

- **Barricada**: las franjas de peligro estaban metidas en el remate (solo asomaban triángulos) y
  los reflectantes quedaban ocultos; se bajaron al cuerpo inclinado, se corrigió el color del
  remate para que no pareciese una tapa suelta y los roces pasaron a manchas planas en la base.
- **Columna**: las cartelas eran cajas giradas 45° que sobresalían como aletas; ahora son prismas
  triangulares de 6 vértices en el plano de cada ala, y se subió el valor de la pintura y se bajó
  el metal para que la foto no saliese casi negra.
- **Barril**: las marcas negras sobre la banda amarilla parecían pegotes (se quitaron), la etiqueta
  flotaba sobre la curvatura (ahora va sobre un soporte atornillado) y el visor de nivel estaba
  fuera del cilindro (se llevó a la tangente); el diamante de peligro pasó a la tapa.
- **Terminal**: el teclado quedaba bajo la cabeza y las teclas no se leían; se bajó el teclado,
  se agrandaron las teclas y se añadieron dos soportes, y la cabeza subió 4 cm.
- **Recortes de presupuesto** (sin cambio de diseño): asas de tubo en vez de curvas en la caja
  grande, menos nervios y tornillos en el contenedor, aspas y aletas sin bisel en el generador y
  varios remaches y lamas a 12 triángulos. La caja grande queda en 2.996, al límite.

## Pendiente / decisiones que conviene revisar

- La lámpara es de pared y su origen está en la base de la placa (el resto del lote apoya en el
  suelo); si el importador espera el centro del objeto, hay que trasladarla a la altura del muro.
- Las puertas del contenedor y las tapas de las cajas son fijas: solo la puerta de seguridad pide
  piezas móviles en el encargo.
- Los nombres y materiales van en español, coherentes con `assets/equipo/` y los packs 8-10; si el
  runtime espera otra convención, se renombra en el importador.
- El hormigón y el óxido son materiales planos (sin texturas); el "desgaste" son placas y roces.
