# Pack 10 — lote 2: enemigos robot y props del hall (encargos 36 y 39)

Seis objetos nuevos al estilo del piloto aprobado (`raw/pack8_pilotos/`): mismo modelado por
código con `_comun.py`, materiales Principled simples, biseles, juntas, tornillos, rejillas,
cables y emisión real. Diseños propios: no derivan de modelos ajenos. El rodante original
(encargo 36) pasa a ser el **rodante artillero**; el encargo 39 añade la variante kamikaze
**rodante explosivo** partiendo de su guion.

## Convención

- Metros reales. **+X = frente del objeto**, **+Y arriba** en el GLB (Z arriba en Blender).
- Origen: **centro de la base apoyada en el suelo** en los seis (comprobado: la cota mínima del
  GLB es y = 0,000 en todos).
- Una malla por pieza, nombre en español (`casco`, `canon_1`, `rejilla_lateral_3`…).
- Materiales Principled: color base, metallic, roughness y emisión. **Sin texturas, mapas, luces ni
  cámaras** (`images: 0`, `textures: 0`, `cameras: 0`; solo la extensión
  `KHR_materials_emissive_strength`, que usan también los pilotos).
- Piezas móviles como objeto aparte con prefijo `mov_` y el pivote **en su eje de giro**
  (traslación del nodo en el GLB).

## Entregables

| objeto | triángulos | mallas | piezas móviles | medidas (m) |
|---|---:|---:|---|---|
| `enemigo_arana.glb` | 3.952 | 79 | 6 (`mov_pata_1`…`mov_pata_6`) | 1,18 ancho × 0,92 fondo × 0,59 alto |
| `enemigo_rodante.glb` (artillero) | 3.956 | 41 | 2 (`mov_rueda`, `mov_torreta`) | 0,43 ancho × 0,72 fondo × 0,92 alto |
| `enemigo_rodante_explosivo.glb` | 3.924 | 70 | 2 (`mov_rueda`, `mov_luz`) | 0,53 ancho × 0,60 fondo × 0,79 alto |
| `prop_dispensador_agua.glb` | 3.984 | 90 | — | 0,64 × 0,64 de base × 1,06 alto |
| `prop_recreativa.glb` | 2.804 | 94 | — | 0,69 ancho × 0,87 fondo × 1,73 alto |
| `prop_armero.glb` | 3.652 | 144 | — | 1,19 ancho × 0,29 fondo × 1,58 alto |

Recuento hecho leyendo los `indices` de cada primitiva del GLB (no la escena de Blender); los
cuatro primeros van muy justos contra el tope de 4.000 y los seis cumplen.

| archivo | tamaño |
|---|---|
| `enemigo_arana.glb` / `.png` | 271 KB / 187 KB |
| `enemigo_rodante.glb` / `.png` | 225 KB / 155 KB |
| `enemigo_rodante_explosivo.glb` / `.png` | 234 KB / 166 KB |
| `prop_dispensador_agua.glb` / `.png` | 239 KB / 143 KB |
| `prop_recreativa.glb` / `.png` | 199 KB / 164 KB |
| `prop_armero.glb` / `.png` | 284 KB / 159 KB |

Los seis PNG son **640 × 320 RGBA transparente** (PNG color type 6), mismo encuadre que los
pilotos: `C.foto(...)` con `az=38` en cinco y `az=30` en el armero (mueble ancho), misma altura de
21° salvo el armero (`el=18`, mueble bajo) y la recreativa (`el=31`, para que se lean los mandos y
la pantalla); mismas luces de estudio y mismo fondo transparente que `assets/equipo/*.png`. La
variante explosiva usa el mismo encuadre que el artillero (`az=38`, `alto=0.88`).

## Piezas móviles (pivotes en el GLB)

| objeto | nodo | pivote (x, y, z) glTF | eje de giro |
|---|---|---|---|
| araña | `mov_pata_1` / `_2` | (0,138, 0,305, ∓0,177) | cadera: cabeceo sobre Z (era +Y de Blender) y guiñada sobre +Y |
| araña | `mov_pata_3` / `_4` | (−0,008, 0,305, ∓0,224) | ídem |
| araña | `mov_pata_5` / `_6` | (−0,138, 0,305, ∓0,177) | ídem |
| rodante artillero | `mov_rueda` | (0, 0,301, 0) | rodadura sobre Z (el eje del neumático) |
| rodante artillero | `mov_torreta` | (0, 0,679, 0) | guiñada sobre +Y |
| rodante explosivo | `mov_rueda` | (0, 0,301, 0) | ídem |
| rodante explosivo | `mov_luz` | (0,227, 0,563, 0) | centro de la lente: sin eje de giro, pensada para parpadear (emisivo) |

Ninguno está emparentado (todos cuelgan de la raíz, como en los pilotos): el juego decide cómo
colgarlos. La rueda gira sobre su centro de masa y el neumático entra en el chasis: la parte de
arriba queda oculta dentro del casco, así que el giro no abre huecos visibles.

## Qué hay en cada objeto

- **Araña** (`enemigo_arana`): casco blindado con lomo atornillado, faldón y vientre, placas
  laterales con tres rejillas y franja roja, visor emisivo rojo (banda, dos aros, lentes y
  pupilas), ceja blindada y placa de aviso, dos cañones frontales con hombro, funda, anillo,
  freno de boca y aletas, aguijón central con aro y luz, seis hombreras de blindaje, conductos
  con abrazaderas, antena emisiva y latiguillos, tobera trasera con lamas. Cada pata: manguito de
  cadera, dos horquillas, fémur con nervio, pistón (funda y vástago), eje de rodilla, tibia, eje de
  tobillo, espinilla, garra y tope de goma.
- **Rodante artillero** (`enemigo_rodante`): neumático grueso con 20 tacos en dos hileras, llanta
  atornillada (6 tornillos), ceja cromada, cúpula de buje y tuerca, cuatro radios; guardabarros en
  arco por los dos lados con luz naranja; chasis con techo atornillado, proa biselada con rejilla y
  franja de aviso, faros de estado emisivos, placas laterales con franja naranja y ventilaciones,
  escape con boca, rejilla trasera y cable; torreta con aro, anillo de aviso, carcasa atornillada,
  sensor emisivo naranja, ametralladora (mantelete, funda, cañón, anillos, freno), caja de munición
  con cinta, antena emisiva y asa.
- **Rodante explosivo** (`enemigo_rodante_explosivo`): parte del artillero y conserva la rueda
  gruesa (neumático de 20 tacos, llanta, ceja, cúpula, 4 tornillos y 3 radios), los guardabarros
  altos con luz y la antena con punta emisiva. Quita torreta, cañón y ametralladora y añade chasis
  compacto con techo atornillado, banda de peligro amarilla y negra en los dos costados, mentón de
  proa, rejilla trasera de cuatro lamas, tres lamas en el techo y triángulo de aviso (amarillo con
  cuña negra, sin texto). Lleva cinco cargas rojo-naranja atadas al casco (dos por costado y una
  tendida sobre el techo) con tapas metálicas y correas amarillas/negras alternadas, cableado
  visible entre ellas y hasta el detonador, detonador con fusible, mecha corta y LED rojo, y una luz
  roja central grande y emisiva en un aro oscuro (pieza `mov_luz`).
- **Fuente** (`prop_dispensador_agua`): zócalo atornillado con banda cromada, bandeja de goteo con
  rejilla radial de 6 brazos y 16 tornillos, columna con cuatro nervios, portezuela de servicio
  atornillada con asa, acometida con válvula, volante cian y manómetro emisivo, dos pilas de
  porcelana con borde cromado, agua azul translúcida con ondulaciones, cuello, remate con tres
  caños y chorros, aro emisivo, botonera cian con dos pulsadores y aro, etiqueta, pedal de suelo y
  rejilla trasera.
- **Recreativa** (`prop_recreativa`): cuerpo bajo, cuerpo de pantalla y cabecera de chapa con
  cantonera de goma y tornillos, zócalo con patas y rejilla, panel de mandos inclinado 18° que
  sobresale del frontal (joystick con fuelle y bola roja, tres pulsadores cian/rojo/ámbar con aro,
  dos de servicio), pantalla emisiva con "partida" en marcha (ocho bloques, nave y disparos),
  marco de listones, LED de encendido, cabecera luminosa cian sin logotipo con tres barras, puerta
  de monedas con rejilla de lamas, ranura, cerradura y tirador, botón de crédito, bandas cian,
  rejillas laterales y traseras, asa y cable.
- **Armero** (`prop_armero`): zócalo con patas, chapa de fondo, laterales, cornisa atornillada y
  listón luminoso cian, seis huecos con marco, copa inferior acolchada, pinza superior de
  dos dedos con gomas, LED de estado, placa y cuatro tornillos cada uno, cajón inferior con asa,
  cerradura y lamas, panel de control lateral con pantalla emisiva, teclas y ranura, conducto con
  abrazaderas, cable, rejillas, placa de aviso.

Se modela de pie para respetar el origen en el suelo; en el juego puede colgarse de la pared con
una traslación (o añadir un `socket` de pared en el importador).

## Qué falta para integrarlo en el juego

| objeto | falta |
|---|---|
| araña | IK o ciclo de animación de las 6 patas (las 6 cuelgan de la raíz), IA de recorrido, bocas de cañón como sockets, FX de fogonazo, collider por pieza o cápsula, LOD |
| rodante artillero | animación de rodadura (el nodo `mov_rueda` ya tiene el pivote), guiñada de la torreta, sockets de cañón, chispas de derrape, collider cilíndrico, LOD |
| rodante explosivo | parpadeo de `mov_luz` según la distancia (hoy es emisión fija), animación de rodadura, FX/chispas de explosión, collider cilíndrico, LOD |
| fuente | lógica de uso (botón/pedal), sonido de agua, líquido animado (el agua es una malla fija), collider estático |
| recreativa | lógica de mando y créditos, pantalla animada como material con textura en runtime (hoy son piezas emisivas), sonido, collider estático |
| armero | lógica de inventario por hueco, animación de apertura del cajón (no tiene pieza móvil), collider estático |

Ninguno lleva animación en el GLB (solo pivotes), sockets ni colliders: igual que en el piloto,
eso se resuelve en el juego. El emisivo va por encima de 1 con `KHR_materials_emissive_strength`;
si el runtime no la soporta, se queda en intensidad 1 (se sigue leyendo, con menos brillo).

## Cómo se generó (para poder retomar)

Un guion por objeto en `.delegaciones/blender/lote2/` (`enemigo_arana.py`,
`enemigo_rodante.py`, `enemigo_rodante_explosivo.py`, `prop_dispensador_agua.py`,
`prop_recreativa.py`, `prop_armero.py`). Importan `../equipo/_comun.py` **sin tocarla** (sigue en
`VERSION = "r1"`), construyen las piezas, exportan el GLB y después llaman a `C.foto()` con
`EQUIPO_DIR=raw/pack10_lote2`.

```
cd .delegaciones/blender/lote2
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python enemigo_arana.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python enemigo_rodante.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python enemigo_rodante_explosivo.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python prop_dispensador_agua.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python prop_recreativa.py
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python prop_armero.py
```

A diferencia de los pilotos (que exportaban con `bpy.ops.export_scene.gltf` a pelo), aquí se usa
`C.exportar_glb(ID, moviles=…, limite=4000, salida=SALIDA)`: normaliza el origen al centro de la
base, quita sufijos y numera las piezas repetidas, fija los pivotes `mov_*` y aborta si se pasa de
triángulos. Cada guion imprime `PIEZAS n TRIANGULOS m` y corta antes de exportar si excede el tope.

Verificación de los GLB (reutiliza `equipo/_verificar_glb.py` sin modificarlo; sin dependencias):

```
python .delegaciones/blender/lote2/revisar_glb.py
```

Imprime por objeto mallas, triángulos, materiales, imágenes, cámaras, luces, caja total recorriendo
la jerarquía en metros, cota de la base y traslación de los nodos `mov_*`. Resultado de la última
pasada: **FALLOS 0** (los seis por debajo de 4.000 triángulos, base en y = 0,000, sin cámaras,
luces, imágenes ni texturas; solo `agua` va en `alphaMode: BLEND`).

Los `KeyError: 'mesh.knife_tool'` al arrancar y al salir son del addon Half_Knife del perfil de
Blender (`blender.exe` sale con código 1 por eso): ruido, no afecta al resultado.

## Correcciones tras abrir los PNG

- **Araña**: subir las rodillas por encima del casco (antes las patas se leían como patas de mesa),
  cadera más afuera con hombreras de blindaje, cañones más gruesos y pintura más clara; después,
  subir la garra y agrandar el tope para que las patas apoyen en el suelo (antes las puntas
  sobresalían 4 cm por debajo y el exportador subía todo el modelo).
- **Rodante artillero**: llanta más pequeña con ceja en anillo (tapaba el neumático como un plato), guardabarros
  reducidos al arco alto y sin brazos que cruzaban la rueda, radio del buje más grande.
- **Rodante explosivo**: la lente salía rosada y lavada con emisión 9 en AgX; se bajó a 3 con rojo
  más profundo. Para entrar en 4.000 triángulos se recortaron los pernos del aro, las cargas se
  modelaron con 8 caras (tapas 6, correas 8) y la llanta pasó de 6 tornillos y 4 radios a 4 y 3.
  Los cables se hacen con cilindros por tramo: las curvas de `C.tubo` costaban ~400 triángulos por
  tramo (~4.600 en total) y el presupuesto no lo admitía.
- **Fuente**: agua visible de verdad (los discos estaban enterrados bajo la cara superior de la pila
  y se veían blancos), pulsadores y pedal en la columna baja (antes quedaban bajo la pila).
- **Recreativa**: el cuerpo era un bloque único y se comía pantalla y mandos; se dividió en cuerpo
  bajo / pantalla / cabecera, se subió la pantalla y se sacó el panel de mandos 16 cm por delante
  del frontal (antes los mandos quedaban detrás del cristal), y se abrió el encuadre a 31° para
  que se lean.
- **Armero**: los "huecos" eran cajas cerradas; ahora son nichos abiertos con copa y pinza de dos
  dedos en vez de dos baldas, que es lo que los hace leer como soportes de armas.

## Pendiente / decisiones que conviene revisar

- Todos los nodos cuelgan de la raíz (sin jerarquía), como en el piloto: el juego emparenta la
  torreta y los cañones si quiere moverlos juntos.
- La araña mide 1,18 m de ancho (el encargo pedía ~1,1): las garras y los topes de goma de las
  patas laterales son los que dan esos centímetros de más.
- Los nombres y materiales van en español, coherentes con `assets/equipo/` y `pack8_pilotos`; si el
  runtime espera otra convención, se renombra en el importador.
- El agua es una malla translúcida fija (sin animación ni shader propio).
