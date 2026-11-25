# Plan: Forja digital, economía, tienda y cápsulas, accesorios (propuesta del director, 22/11/2026)

## Estado hoy (leído en el código/datos)
- Desguace (`scrap()` en `src/weapons/workshop.ts`): devuelve piezas sueltas y créditos por rareza (5/10/20/40/80). Venta: 12/25/50/100/200.
- Cápsulas (`src/data/shop.json`): común 120 CR (68,5 % poco, 30 % rara, 1,5 % épica) y avanzada 850 CR (68 % rara, 28 % épica, 4 % legendaria, garantía a las 15). Escaparate rotativo cada 15 min.
- Accesorios: banco `inv.bank` SIN tope y SIN venta ni desguace: solo se montan/desmontan. Las armas vendidas/desguazadas sueltan sus accesorios al banco: el stock crece sin salida.
- Ranuras: óptica, boca, accesorio, luz. Compatibilidad por ranura, tipo de arma, calibre, agarre y banda de poder (±5 %).

## A. Forja digital (decidido por el usuario)
- Desguazar armas da **piezas por clase** (pistola, revólver, escopeta, subfusil, fusil, francotirador, ametralladora, bullpup), cantidad creciente con la rareza.
- Usos (los que gustan al usuario): (1) **subir de nivel** un arma (coste creciente con rareza y nivel; tope = nivel del jugador), (2) **reforjar un efecto** A o B al azar, (3) **fabricar accesorios** de una ranura concreta con piezas de la clase.
- Por estudiar más adelante: elegir firma legendaria (coste alto), cosméticos, mejorar granadas/equipamiento/armadura, convertir piezas entre clases con pérdida.
- Los créditos del desguace actual se mantienen pequeños; el grueso pasa a piezas. Vender sigue siendo la vía de créditos.

## B. Qué hacer con el stock de accesorios (propuesta)
Problema: sin tope ni salida, el banco se llena. Solución en capas, de menor a mayor cambio:
1. **Apilar** (HECHO 22/11) los iguales en la lista del banco (misma pieza y rareza: «Mira x3»). Solo cambia la vista; los datos no cambian.
2. **Desguazar accesorios en la forja** → «componentes» por ranura (óptica, boca, accesorio, luz), cantidad por rareza (propuesta: 1/2/5/12/30). Es lo que se gasta al **fabricar** (A.3), así el sobrante alimenta lo que quieres.
3. **Botón «Desguazar duplicados»** — HECHO (22/11, sin commit): conserva 1 de cada pieza y rareza y paga el resto en **créditos, pocos pero algo** (decisión del usuario): 2/4/10/25/60 por rareza (`ACC_SCRAP` en `accbank.ts`; siempre menos de la mitad del valor de venta de un arma). Vacía el deshacer del taller para evitar cobrar dos veces. Pendiente: candado/favoritos.
4. **Al vender o desguazar un arma**, sus accesorios se convierten solos en componentes (con aviso), salvo que se hayan desmontado antes a propósito. Es de donde sale el grueso del exceso.
5. Más adelante: **fusionar 3 iguales → 1 de la rareza siguiente**, y un tope blando del banco (p. ej. 80) ampliable con créditos.
Equilibrio: el desguace de accesorios debe dar ~25 % de lo que cuesta fabricar uno de su rareza, para que no haya arbitraje. Calibrar con la simulación económica (`economy.ts`).

## C. Tienda y cápsulas (pendiente de calibrar con la simulación)
- La cápsula avanzada (850 CR, 4 % legendaria) sale a unas 25 cápsulas por legendaria (>20.000 CR de media), muy dura frente a los ingresos (3–40 CR por baja).
- Cápsulas nuevas a considerar: por clase de arma, de accesorios, de equipamiento y granadas, de armadura, y una semanal con rareza garantizada.
- Ejecutar la simulación para obtener créditos por hora y proponer una tabla de precios.

## D. Accesorios nuevos (auditoría 22/11, ~11 piezas, modelos por código)
- Revólver (boca): compensador ventilado, freno corto, apagallamas compacto, cañón con contrapeso.
- Pistola (boca): compensador de corredera, freno mini.
- Escopeta (boca): 3 chokes (cerrado, mejorado, cilindro) y cañón de brecha.
- Bípode (ametralladora, francotirador, fusil). Pulir reglas: ranura de luz y óptica para bullpups y ametralladoras cuando haya raíl.
- Ya hecho: ACOG compacta 2,5× y visor de caza 2× para revólver.

## E. Raíl instalable en armas sin raíl (idea del usuario, 22/11/2026)
- Hoy la ranura de óptica solo existe si el modelo tiene raíl superior (`sockets.rail` / ancla `raíl_superior`). Cobertura de óptica medida: pistola 55 %, revólver 35 %, escopeta 54 %, francotirador 50 %, bullpup 29 %, ametralladora 33 %.
- Propuesta: **«Montura de raíl»** como modificación del arma (`tweaks.rail`): una pieza procedural (raíl Picatinny o base Weaver) sobre el cajón, colocada en el ancla `raíl_superior` o calculada desde la caja del cuerpo. Al instalarla se abre la ranura de óptica; una variante **raíl lateral/inferior** abre la de luz.
- Solo en armas con superficie superior apta (no en las de mira integrada o asa de transporte). Coste de compromiso: −2 de manejo y algo de silueta, siempre dentro de la banda de poder ±5 %.
- Economía: se instala en la **forja** con piezas de la clase (escala con la rareza del arma, p. ej. 10/20/40/80/160), con reembolso parcial al quitarla. Además puede salir como **objeto de tienda** (créditos) y como **premio raro de cápsula de accesorios**.
- Gameplay: las armas sin raíl conservan identidad (mira de hierro, más manejo); añadirlo es una decisión de build. En eras clásica y rústica la montura puede ser más cara o improvisada. Mostrar «Raíl: Sí/No» en la ficha.

## F. Ópticas: variedad real (auditoría 22/11)
- Hay 52 ópticas distintas pero solo **5 perfiles de estadísticas** (punto rojo 15 variantes, holográfica 6, ACOG 9, mira de 6 aumentos 9, hierro 13) + 2 de revólver. La variedad es sobre todo estética.
- Propuesta: perfiles propios por modelo (zoom variable, velocidad al apuntar, campo de visión, tamaño del punto, destello) y más perfiles: micropunto, reflex, holográfica con lupa, prismática 3×, variable 1–4×, DMR 8×, térmica en sci-fi.

## G. Ranura de luz (4.ª): ideas con efecto de juego
- Hoy hay 12 opciones (linternas, láseres, combo, estroboscópica, contador de bajas) y **ninguna tiene perfil de estadísticas** en el catálogo (`accessory()` no las reconoce).
- Ideas: láser rojo (−dispersión de cadera), láser verde (más efecto, más visible), linterna táctica (cono falso en zonas oscuras; sin luces reales), combo (efectos a la mitad), estroboscópica (resta puntería enemiga un momento; los estados de control siguen pendientes de decisión), contador de bajas (marca estadísticas y desbloquea placas cosméticas), telémetro (muestra distancia), marcador de objetivo (resalta enemigos en el haz).

## H. Las 4 ranuras: nombres y contenido (aclarado 22/11)
- Nombres en el juego hoy: **Mira** (óptica), **Boca**, **Bajo el cañón** (`device`) y **Accesorio** (`light`: solo linternas y láseres). El usuario duda si llamar «misc» a la cuarta.
- Propuesta: renombrar la cuarta a **Módulo** (o Táctico) y ampliarla más allá de luces/láseres; mantener el id interno `light` para no romper partidas guardadas, o migrarlo.
- Quitar de «Bajo el cañón» las linternas y láseres duplicados (hoy salen en las dos ranuras) y dejarlo para empuñaduras, bípodes y lanzagranadas.

## I. Módulos (4.ª ranura) con efecto activo — ideas (22/11/2026)
Control: **T / cruceta arriba** (el botón de linterna y láser). Propuesta: pulsar = encender/apagar la luz o el láser (pasivo); **mantener pulsado** = activar el efecto del módulo (con carga y recarga). Barra de **carga del módulo** compartida; las rarezas altas dan más duración, más efecto y menos recarga. Sin curar, revivir ni invocar. Estados de control (aturdir, ralentizar) siguen pendientes: aquí solo se bajan estadísticas enemigas.
1. Telémetro balístico (toggle): muestra distancia y punto de impacto; +6 % precisión a larga distancia, −3 manejo.
2. Láser de puntería (toggle): −25 % dispersión de cadera; los enemigos a <20 m te detectan antes.
3. Linterna táctica (toggle): cono falso (sin luces reales) que revela siluetas en zonas oscuras.
4. Designador de objetivo (activo, mantener sobre un enemigo 0,6 s): lo marca 6 s, +10 % de daño tuyo a ese objetivo y contorno visible; recarga 12 s.
5. Pulso de escaneo (activo): onda que muestra enemigos a través de paredes 3 s, radio 25 m; recarga 20 s.
6. Destello cegador (activo, estroboscópico): enemigos en el cono pierden 40 % de puntería 3 s; recarga 15 s.
7. Sobrecarga (activo): +25 % de cadencia 5 s y después 3 s de arma caliente (no dispara); recarga 25 s.
8. Estabilizador giroscópico (toggle): −35 % retroceso y balanceo, −10 % de velocidad de movimiento.
9. Bengala (activo, 2 cargas): proyecta un destello de luz falsa en un punto que ilumina y marca la zona 8 s.
10. Rastreador de trayectoria (toggle): muestra el arco de granadas y equipamiento al lanzarlos.
11. Sensor de salud (toggle): barras de vida de los enemigos del cono.
12. Contador de bajas (pasivo): cuenta bajas; placas cosméticas y un pequeño bonus de maestría por hitos.
13. Recarga de emergencia (activo): recarga el cargador entero al instante; recarga 30 s.
14. Láser térmico (activo): marca enemigos «calientes» 5 s: +20 % a los efectos de fuego y explosivos sobre ellos.
Dificultad: 1, 2, 3, 8, 10, 12 son sobre todo datos y HUD; 4, 5, 6, 11, 14 exigen ganchos con la IA enemiga; 7, 9, 13 son del arma y el efecto visual.

## J. Módulos elegidos y lanzadores bajo el cañón (decidido 22/11/2026; para repartir a Go)
Ranura **Módulo** (una pieza a la vez; el botón es T / cruceta arriba). El **contador de bajas ya existe**.
### Módulos elegidos por el usuario
1. **Telémetro balístico** (toggle con T): muestra distancia y punto de impacto; +6 % de precisión a larga distancia, −3 de manejo.
2. **Láser de puntería** (toggle con T): −25 % de dispersión de cadera; los enemigos a <20 m te detectan antes (gancho con la IA; primera versión solo estadística y rayo visible).
3. **Estabilizador giroscópico** (toggle con T): −35 % de retroceso y balanceo, −10 % de velocidad de movimiento.
4. **Cargador rápido** (pasivo): recarga −25 % de tiempo, −10 % de capacidad.
5. **Cargador ampliado** (pasivo): +40 % de capacidad, +10 % de tiempo de recarga, −3 de manejo.
6. **Selector de disparo** (T recorre los modos): semiautomático / ráfaga / automático **solo donde proceda** (subfusiles, fusiles, bullpups, ametralladoras y pistolas modernas; no en corredera, bombeo ni revólver). Usa el `modeShift` que ya existe en el arma; cada modo con su compromiso (p. ej. automático: más cadencia, menos precisión).
Como solo cabe un módulo, elegir uno es una decisión de build. Rareza: más efecto y menos compromiso.
### Lanzadores bajo el cañón (ranura «Bajo el cañón»)
- **Lanzagranadas**, **Masterkey** (minimopedera bajo el cañón) y **Lanzabolas de energía**.
- **Ocupan y desactivan la ranura de Módulo a la vez**: con un lanzador montado no se puede equipar módulo (aviso claro con el motivo), y montar un lanzador devuelve el módulo al banco automáticamente, sin confirmar (con deshacer). **T dispara el lanzador.**
- Propuesta de números base: Lanzagranadas 1 granada, 120 de daño de área, radio 4 m, recarga con R (+1,2 s), −6 de manejo. Masterkey 4 cartuchos de 8 perdigones, corto alcance, 0,6 s entre disparos. Lanzabolas de energía 3 cargas que se recuperan 1 cada 8 s sin munición: esfera lenta con arcos eléctricos, 60 de daño.
- Disponibilidad: la ranura «Bajo el cañón» solo la tienen armas largas con soporte; hoy fusiles 32 %, subfusiles 34 %, francotiradores 36 %, ametralladoras 8 %, bullpups 7 %, escopetas 1 %: subir esa cobertura donde tenga sentido.
### Reparto
Tanda 1 (datos + interfaz): catálogo de módulos, exclusividad módulo/lanzador, cargadores y selector. Tanda 2: efectos en juego de telémetro, láser y estabilizador. Tanda 3: los tres lanzadores (proyectil, munición, interfaz, modelos por código). Una hoja de revisión por tanda.

### Aclaraciones del usuario (22/11, sustituyen a lo anterior donde choque)
- Los lanzadores viven en la ranura **«Bajo el cañón»**, como las empuñaduras; **al elegirlos ocupan también la de Módulo** (para llevarlos hay que renunciar a ese espacio).
- **Botón de módulo:** el de linterna y láser. En el mando, **cruceta arriba**; en teclado es **T** (`input.ts`: «Encender/apagar linterna y láser del arma (T / cruceta arriba)»). Lo usan todos los módulos, el **selector de disparo** (recorre los modos) y los **lanzadores** (disparan).
- **Munición de los lanzadores:** se recarga con **su propia animación, lenta, para equilibrarlos**; no comparten recarga con el arma. Propuesta de control: **pulsar el botón de disparo del lanzador (el de módulo) con el lanzador vacío inicia su recarga** (sin tecla nueva; CONFIRMADO). Tiempos base: lanzagranadas 3,2 s; masterkey 0,9 s por cartucho (se puede interrumpir); lanzabolas de energía 3,5 s (cambio de celda; **ya no recupera cargas sola**, sustituye a la propuesta anterior).
- Cada lanzador necesita su animación de recarga y de disparo (ver `PLAN_SLOT_EQUIPAMIENTO_Y_ANIMACIONES.md`) y **no se cancelan al recibir daño** (ni ellos, ni la recarga, ni granadas, ni equipamiento: decisión del usuario).
- **Los lanzadores bajo el cañón (lanzagranadas, masterkey y lanzabolas de energía) son siempre LEGENDARIOS** (decisión del usuario, 22/11). El **modo desarrollador reparte todos los accesorios** (opción «Todos los accesorios (legendarios)», ya hecha para los existentes); los lanzadores se incluirán en esa lista cuando existan.

## K. Cápsulas (DEFINITIVO en estructura por el usuario, 22/11/2026; números provisionales a calibrar con la simulación)
Cinco cápsulas distintas, no por clase de arma:
1. **Básica** (la más barata): **1 pieza** de entre armas, granadas, equipamiento y armaduras.
2. **Avanzada**: **2 piezas** de ese mismo conjunto.
3. **Superior** (la mejor, nombre provisional «Élite»): **3 piezas** del mismo conjunto.
4. **Específica de armas**: solo armas.
5. **Específica de granadas y equipamiento**: solo granadas y equipamiento.
Las armaduras solo salen en las tres primeras.
### Propuesta de números (provisional)
Ingresos estimados con los datos de shop.json: ≈ 40 CR/min ≈ 2.400 CR/h jugando (5 bajas/min + oleadas y jefes); venta de botín aparte.
| Cápsula | Precio | Piezas | Probabilidades por pieza (poco/rara/épica/legendaria) | Notas |
|---|---|---|---|---|
| Básica | 150 CR (≈4 min) | 1 | 65 / 28 / 6,5 / 0,5 | actual «común» (120 CR) |
| Avanzada | 500 CR (≈12 min) | 2 | 0 / 66 / 29 / 5 | 1 rara o mejor asegurada; garantía de legendaria a las 15 |
| Élite | 1.500 CR (≈37 min) | 3 | 0 / 40 / 48 / 12 | la 1.ª pieza épica o mejor |
| De armas | 450 CR | 1 arma | 20 / 50 / 25 / 5 | garantía de épica cada 10 |
| De granadas y equipamiento | 400 CR | 2 piezas | 5 / 45 / 40 / 10 | una granada y un equipamiento |
Mezcla de tipo de pieza en Básica, Avanzada y Élite (provisional): armas 45 %, armaduras 20 %, granadas 17,5 %, equipamiento 17,5 %.
Esto sustituye a la propuesta anterior (cápsulas por clase, semanal y táctica). La avanzada actual (850 CR, 4 % legendaria, ≈25 cápsulas por legendaria) desaparece. Pendiente: correr la simulación (economy.ts) para afinar precios y probabilidades; decidir si los lanzadores bajo el cañón (legendarios) salen de alguna cápsula.
### Accesorios en las cápsulas (decisión del usuario, 22/11/2026)
- Los accesorios **en general NO salen de cápsulas**: se consiguen **desmontándolos de las armas** (y desguazando duplicados por créditos).
- **Excepción: los accesorios LEGENDARIOS sí pueden salir.** De momento solo los **lanzadores bajo el cañón** (lanzagranadas, masterkey y lanzabolas de energía; siempre legendarios).
- Regla propuesta: cuando una pieza de una cápsula sale **legendaria**, hay una probabilidad (propuesta 20 %) de que sea un accesorio legendario (un lanzador al azar) en lugar de un arma, granada, equipamiento o armadura. Aplica a Básica, Avanzada, Superior y De armas; no a la de granadas y equipamiento. Cada nuevo accesorio legendario futuro entra en ese mismo sorteo.
- El modo desarrollador sigue repartiendo todos los accesorios (incluidos los lanzadores cuando existan).
