# Progreso (se actualiza en cada tanda; 23/11/2026)

## Hecho hoy (sin commit)
- Fotos 2D del equipamiento (20) y sus modelos 3D exportados (20 GLB, `raw/pack9_equipo/`).
- Pilotos de calidad Blender: dron, torreta enemiga, máquina de bebidas (`raw/pack8_pilotos/`).
- Piezas donantes pack7 (66). Recarga de fusil con recorridos reales (piloto).
- Registro de sesión automático en navegador (encargo 37): las notas (F9) y capturas se guardan solas en DocumentosProvingGroundssesiones al probar en localhost:5199.
- Culatas en pistolas/revólveres al ~15 %. Registro de sesión en navegador (F10).
- Agarres: anclajes que faltaban, pistolas con culata a dos manos, encuadre de la mano de apoyo (mejora parcial).
- Retículas unificadas (encargo 31): 10 ópticas limpiadas, catálogo de 10 formas (`src/game/reticles.ts`) y un solo dibujo; revisado con capturas. Pendiente menor: `acc:reddot`/`acc:holo` procedurales aún modelan su punto, y `acc:acog` usa el respaldo.
## En curso
- Encargo 35 tamaño de armas en cadera (src).
## Cola
- 35 tamaño de armas en cadera → 38 barrido de armas por categoría (fichas y métricas) → 33 equipamiento 3D + despliegue → 34 gestos de manos → taller tipo Gunsmith (auditoría y plan) → poses de recarga para el resto de clases → integrar enemigos y props al juego → brazos/piernas del protagonista.

- Lote 2 de modelado (encargo 36, revisado): araña (6 patas móviles), rodante, dispensador de agua, recreativa y armero en `raw/pack10_lote2/` (<=4.000 tris). Pendiente: integrarlos al juego.

- Decisión del usuario: el rodante con cañón (`enemigo_rodante`) será un enemigo NUEVO «rodante artillero»; el `roller` kamikaze usará la variante explosiva (encargo 39, en curso). Integración de ambos en `dummies.ts`/oleadas pendiente.

- Subido el paralelismo (usuario: «con tan pocos vamos a tardar muchísimo»): 40 soldado ciber base modular (pack11) y 41 escenarios lote 1 (pack12, 10 props) lanzados junto al 39 (rodante explosivo) y el 35 (src).

- Enemigos nuevos aprobados por el usuario (13: dron bombardero, dron reparador, sabueso, centinela flotante, arañitas, mech pesado, asesino, granadero, incinerador, invocador, berserker y jefes Colosus, Reina araña y Núcleo). Encargo 42 listo para lanzar cuando haya hueco de agente.

## Actualización 23/11 17:35
- Hecho y revisado: 35 tamaño de armas en cadera (tope 0,5 del alto de pantalla; tests en verde, suite completa no terminada por tiempo), 39 rodante explosivo (aprobado), 41 escenarios lote 1 (10 props, calidad alta, `raw/pack12_escenarios/`).
- Soldado ciber (encargo 40, `raw/pack11_soldado/`): estructura modular completa (base, 4 cascos, 3 petos, hombreras, 2 mochilas, escudo, 3 variantes, paletas) pero el diseño sale tosco y «de bloques»; el casco de comando es una masa redondeada con placas flotantes. Pendiente: segunda pasada de diseño (siluetas más humanas, más detalle, cuerpo más ancho en cuadro).
- En marcha: 40 (acabando), 42 robots lote 3, 38 barrido de armas por categoría.
- Cola `src/`: 33 equipamiento 3D + despliegue → 34 gestos de manos → integración de enemigos/props/escenarios/soldado → taller (auditoría).
- Claude: semanal 59 %, ventana 5 h 27 %, contexto de la sesión 50 %: abrir sesión nueva con `.delegaciones/TRASPASO_SESION.md` cuando acaben 42 y 38.

## Actualización 23/11 20:10
- Robots lote 3 (encargo 42, `raw/pack13_robots/`): dron bombardero, dron reparador, centinela flotante y arañita bien; **sabueso** parece un caballo (cuello y cabeza de cajas) y **mech pesado** sale delgado y tosco (las figuras bípedas/humanoides siguen flojas). Rehacer ambos con las lecciones de la segunda pasada del soldado (encargo 44).
- Barrido de armas (encargo 38, `.delegaciones/barrido/`): sospechosas por clase (de 36): pistol 11, revolver 4, smg 11, rifle 11, **bullpup 21**, shotgun 11, sniper 6, **lmg 21**. Hallazgos: bullpups con cañón del 10–15 % del largo y piezas `receiver`/`front` solapadas ~80 %; lmg con 19 solapes de piezas; pistol 8 solapes; smg 3 con la mano de apoyo a <7 cm. **launcher y flamethrower no tienen pool de armas en el manifest (0 armas)**.
- En marcha: 33 equipamiento GLB en el juego (src) y 44 soldado pasada 2 (Blender).

- 23/11 22:05 Encargo 45 hecho y revisado: sabueso (ahora robot-lobo con orejas, hocico y ojos rojos) y mech pesado (más ancho y robusto, ametralladora y mochila) mejores; aceptables. En marcha: 34 gestos de manos (src); 46 tamaño de arma por silueta proyectada queda para después. Pendiente de OK del usuario: instalar Rapier (físicas) para un prototipo.

- Requisito del usuario (23/11): conservar y combinar el desmembramiento en píxeles (`Dummy.dismember`) con el ragdoll de Rapier y con los modelos GLB del soldado (piezas `mov_*`). Añadido al encargo 47 y a la integración futura de enemigos.

- 23/11 22:35 Encargo 34 gestos de manos hecho (activar/lanzar/lanzar suave; suite 47 ficheros/318 tests en verde; suave sin disparador en juego). Lanzados: 46 tamaño por silueta proyectada (src) y 43 humanoides especiales (Blender). Siguiente en src: 47 físicas Rapier.

- Encargo 48 (arreglos de armas por categoría: francotiradores, bullpups, lmg, pistolas/smg) escrito; va tras el 47. El barrido (38) solo midió: nada arreglado aún.

- Requisito del usuario (23/11): UNA sola mira por arma (hierro, corto alcance o zoom), nunca una óptica nuestra encima de la del modelo; prioridad 0 del encargo 48 (todas las clases, empezando por francotiradores).

- Decisión del usuario (23/11): lanzagranadas y lanzallamas NO son necesarios; no se crean armas de esas clases.

- Regla definitiva del usuario (23/11): la mira propia del modelo se elimina SIEMPRE; el arma usa solo miras nuestras (hierro, corto alcance o zoom). Prioridad 0 del encargo 48 reescrita (incluye `tools/strip-own-sights.mjs` y excluir del pool lo no recortable).

- Aclaración del usuario (23/11): al aportar un arma se disecciona en piezas y accesorios aprovechables; la mira es uno de ellos. Por eso la mira del modelo se EXTRAE como accesorio nuestro (con variación, `raw/pack15_miras/`) y se quita del arma, en vez de descartarla. Encargo 48 actualizado.

- Decisión del usuario (23/11): los modelos reales reconocibles pasan a donantes (sin generarlos casi tal cual) y tope de similitud ≤0,75 en armas con base de modelo entero; prioridad 1 del encargo 48 (en dos tandas: A miras+similitud, B resto de arreglos).

- Cautela del usuario (23/11): no quitar armas/bases por regla general; algunas poco modulares quedan bien o tienen diferencias. Prioridad 1 del encargo 48 reescrita: medir, proponer candidatas a donante (similitud media ≥0,85 y <3 cambios) con hojas de 6 ejemplos por base, y esperar revisión del director antes de tocar el generador.

- Criterio del usuario (23/11): descartar piezas/accesorios (miras extraídas y pack7) que no se puedan usar o no encajen; añadido al encargo 48 con comprobaciones de montaje, integridad y utilidad y listas DESCARTADAS.md.

- Matiz del usuario (23/11): el tope de triángulos de piezas y accesorios es orientativo; las que lo superen hasta 1,6× y sean muy aprovechables se revisan (REVISAR.md), no se descartan.

- Decisión del usuario (23/11): animar mejor TODAS las clases con las referencias y corregir agarres/dedos («animaciones en general»). Encargo 49 escrito (tandas A pistol/revólver, B shotgun/smg, C sniper/lmg/bullpup, D fusil+sprint+idle). Orden en `src/`: 46 (en curso) → 49 → 47 → 48.

- 24/11 00:10 El ajuste de tamaño (encargos 35+46) se pasó: armas lejísimas y pequeñas, antebrazos como palos (el usuario lo confirmó). Encargo 46 detenido; encargo 50 (recalibrar: volver a la posición previa al 35, escala solo para atípicas como la Partisan, con comparación medida contra `tamano_antes_*`) en curso. Después: 49 (animaciones, tandas A–D) → 47 (físicas) → 48 (armas).

- 24/11: el usuario dice que el arma en mano desentona «una barbaridad» y que no se parece a los FPS reales. Mañana aporta fotos de gameplay de armas que queden bien: con ellas se CALIBRA por clase posición, rotación y escala del arma en mano con una herramienta de comparación lado a lado (referencia vs nuestro juego). Hasta entonces, no gastar más en ajustar el encuadre (el encargo 50 solo corrige el exceso). El encargo 49 (animaciones por anclas) puede seguir. La Partisan puede ser problema de diseño del arma (bloque trasero grande, vista de frente).

- 24/11 00:50 Referencias FPS del usuario recibidas (22 capturas; copia de hojas en `.delegaciones/referencias_fps/`). Conclusión: el problema es ORIENTACIÓN y posición (arma paralela a la vista) y no tamaño: en las referencias el arma entra por la esquina inferior derecha en diagonal, cañón convergente 8–12° al centro, culata fuera de pantalla, antebrazo izquierdo saliendo del borde inferior. Encargo 51 escrito (parámetros por clase + herramienta de comparación lado a lado con medidas); orden: 50 (en curso) → 51 → 49 → 47 → 48.

- 24/11 Referencias de miras de hierro de CoD (capturas del usuario; la página del wiki devolvió 402). Encargo 52 escrito: generador paramétrico de miras de hierro (peep, ghost ring, U, V, cuadrada, plegable × poste, orejas, bola, capuchón, aro × carcasa, puntitos luminosos), regla de «imagen limpia» y asignación por clase con variedad; tras la tanda A del 48. Orden en `src/`: 50 → 51 → 49 → 47 → 48A → 52 → 48B.

- 24/11 PDF de iron sights (texto extraído con `pdftotext`; fotos no extraíbles con las herramientas actuales): añadido al 52 (puntitos que se ponen rojos sobre un enemigo, mira mejorada para pistolas, desalineación opcional como rareza, tiempos de ADS por clase 0,15–0,50 s) y nuevo encargo 53 (retículas personalizables y coleccionables: forma y color elegibles en el taller, desbloqueo por hitos, catálogo hasta 20 formas). Orden en `src/`: 50 → 51 → 49 → 47 → 48A → 52 → 53 → 48B.

- 24/11 Galería de alzas del PDF (imagen del usuario): 9 familias de alza añadidas al encargo 52 (u_ancha, muesca_alta, ranura, peep_grande, peep_alas, aro_moleteado, pistola_puntos, plegable, futurista) con asignación por clase y rasgos de contraste.

- 24/11 Aclaración del usuario: los puntitos de tritio son de diseños más futuristas; encargo 52 los limita a eras scifi (siempre) y modern (<=35 %), nunca classic/rustic.

- 24/11 Decisión del usuario: sin desalineación de miras como rareza (quitado del encargo 52).

- 24/11 El usuario ve el subfusil pequeño; criterio mínimo añadido al encargo 51 (ancho >=0,40, alto >=0,28 en cadera; pistolas >=0,22).

- 24/11 02:00 Encargo 51 hecho: arma en diagonal desde la esquina inferior derecha con cañón hacia el centro (como las referencias); tabla de medidas en rango salvo smg ancho 0,383 (<0,40) y Partisan alto 0,573 (>0,55, escala 0,60). Hojas en `.delegaciones/comparacion_fps/`. Pendiente veredicto del usuario. Lanzado 49 tanda A (pistol/revólver).

- 24/11 El usuario aprueba el encuadre del 51 («mucho mejor»). Encargo 54 (ajuste fino: smg ancho >=0,42 y Partisan escala >=0,78) en cola tras la tanda A del 49.

- 24/11 Tanda A del 49 hecha (pistol/revólver con recorridos reales: recarga, sacar, inspeccionar; 25,8 KB de poses; tests 13/13 y 43/43). Defecto visto: un disco negro (manguito del antebrazo visto de frente) junto a la mano; orientación de muñeca sin aplicar. Corrección añadida al 49 antes de la tanda B. En marcha: 54 ajuste fino.
