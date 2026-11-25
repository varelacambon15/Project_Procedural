# Lista de pendientes (22/11/2026, noche)
Escala de trabajo: S = una tanda corta (≤0,5 % del mes de Go); M = 1–3 tandas (0,5–2 %); L = 3–8 tandas (2–6 %); XL = muchas fases. Quién: Yo (director, mis tokens), Go (ejecutores), Tú (decisión o prueba). Ritmo objetivo de Go: ~10–12 % del mes por semana; semanal se reinicia el lunes 01:00 (Madrid).

## 0. Hecho sin commit (esperando tu OK para subir)
Ruleta de armas; 6 legendarias nuevas con contador (22 firmas); taller estilo Gunsmith (equipar al instante, apilado, desguazar duplicados por créditos, ranura Módulo); ópticas de revólver y óptica en francotiradores; corrección de la distancia al apuntar con óptica; registro de sesión; opciones de desarrollador (granadas+equipamiento y todos los accesorios); 70 sonidos nuevos; herramientas de lectura de .mdl y bibliotecas de poses; auditoría de miras; planes y encargos.

## 1. Feedback de la sesión 1
1. Miras que siguen mal: telescópica metida en la malla (Sentry, Longshot, ED-16), torcidas o descentradas, «trozo raro» (T-5J). Yo diagnóstico + Go bases. M.
2. Agarre y posición en primera persona (≈14 notas). Depende de las poses reales (punto 8) y del encargo 11. L.
3. Recarga de escopetas de doble cañón. M.
4. Caída hacia atrás y movimiento de los grandes (rompe la inmersión): necesita animación de personaje (ya hay 3 candidatos, ver punto 14). L.
5. Gancho: mantener para engancharse y quedar colgado (Just Cause / Agent Under Fire). M–L.
6. Diseño de armas: SPAS-12 sin variación, GB3 y 3KB feas, Basilisk y K79-RB a pulir. M.
7. Cara del bot del hall más grande y centrada; haz de la linterna. S.

## 2. Combate y modos
8. Efectos de combate (paso 14, retomar): fogonazo, casquillos, trazadoras, marcadores, impactos por material. L.
9. Ritmo de combate: roles de enemigo, ritmo por encuentro, botín y racha, movimiento. L–XL.
10. Campaña Hack: 5 niveles, cadena de objetivos, estrellas, guardado, jefe del nivel 5 con legendaria garantizada. XL (por fases).
11. Enemigos y jefes nuevos para todos los modos. L.
12. Nuevos modos (cacería con clon, asalto a jefes, desafío diario): sin decidir. L cada uno.

## 3. Progresión y economía
13. Fichas de súper cada 5 niveles + Spirit Nova secreta (campaña + supervivencia + defensa) + migración de partidas. M.
14. Forja digital (piezas por clase, subir de nivel, reforjar efecto, fabricar accesorios). L.
15. Tienda y cápsulas: calibrar con la simulación económica y añadir cápsulas nuevas. M (yo la simulación; Go los datos).

## 4. Armas, accesorios y efectos
16. Módulos: catálogo, exclusividad con lanzadores, cargador rápido y ampliado, selector de disparo (T recorre modos), telémetro, láser, estabilizador. L (3 tandas).
17. Lanzadores bajo el cañón (lanzagranadas, masterkey, lanzabolas), legendarios, con recarga propia. L.
18. Accesorios nuevos (~11: bocas de revólver, pistola y escopeta, chokes, bípode) y quitar los duplicados de «Bajo el cañón». M.
19. Variedad real de ópticas (hoy 5 perfiles de estadísticas) y montura de raíl instalable (más adelante). M.
20. Efectos de arma: ~38 efectos A/B/L nuevos + las 4 legendarias que faltan (Tediore ×3 y cargador creciente; esta familia es mecánica nueva). L–XL.
21. Armas donantes y accesorios de los duplicados (M4A1, AK15, AR-15 Hera; LAM y silenciador del MK23; supresor y holográfica del SMGSUPP). M.
22. Auditoría de armas deformes (continuación) y revisión de las bases. M.

## 5. Animaciones y sonido
23. Poses reales de manos: piloto en la recarga de fusil (encargo 23) y luego el resto de clases, sacar, inspección y dedos. L.
24. **Reclasificar** 5 tipos (orbe, cuchillo, mina, cargas en cadena, arpón) de Equipamiento a Granadas (criterio: granada = fin de daño; equipamiento = efecto o utilidad) (+ migración de partidas): M, y hacerlo antes de lo siguiente. Granadas y equipamiento: animaciones de lanzar, lanzar suave y activar + cuarto slot en Gear con imágenes 2D. M–L.
25. Puños con combo de 3 golpes y animaciones de brazos al moverse. M.
26. Conectar los 70 sonidos (pasos, salto, puños, rebotes) — encargo 24 — y calibrar tiempos de recarga por clase. S–M.

## 6. Escenarios y personajes (material de «Diseños»)
27. Personajes con esqueleto y animación (bot mecha warrior, bot blast R-325, soldado azul acorazado), mechas y robots estáticos para jefes y enemigos, y pasillos/estaciones sci-fi para los niveles de Hack: elegir, adaptar y generar. L.

## 7. Cola nocturna original aún sin hacer
Pasos 15 (HUD), 16 (animación y sensación), 06 (campo de tiro), 17 (atmósfera), 07 (ambientación de la incursión), 18 (enemigos: aspecto), 09 (manos y brazos), 05 (miras reducido), 04 (melee), 08 (recarga revólver), 11 (auditoría de posicionamiento), 19 (revisión visual). Muchos se solapan con lo de arriba.

## 8. Cierre
28. Commit de lo pendiente y versión 0.21 (notas, exe local, subida): con tu OK. S.
29. Documentar la noche como «Ronda» en `docs/ESTADO.md`. S.

## Decisiones tuyas pendientes
Umbrales de Spirit Nova (propuesta: oleada 15 en defensa y 20 en supervivencia); el desafío y la ficha 21; qué cápsulas añadir; si hay modo cacería y de qué tipo; cuándo hacer commit y versión.

## 6. Calidad visual con el método Blender (pedido del usuario, 23/11/2026)
23. Extender el modelado de calidad de `.delegaciones/blender/equipo/` (biseles, detalle, emisión) a: enemigos y jefes, props del hall y escenarios, y brazos y piernas del protagonista. Primero un piloto de cada uno (1 enemigo, 3 props, brazos) y el usuario valida antes de hacer lotes. L–XL.

## 7. Ideas aparcadas (decisión del usuario, 23/11/2026: «de momento lo dejamos como está»)
24. Munición de reserva limitada por clase de arma (hoy infinita; solo se cuenta el cargador). Idea: topes por clase, reposición con botín y cajas, infinita en campo de tiro y zona de pruebas, y la caja de munición del equipamiento dejaría una caja en el suelo que repone reserva. Sin decidir: topes por clase o por arma, y si afecta al modo Hack. M–L.

## 8. Decisión del usuario (23/11/2026): poses reales para TODAS las clases si el piloto de fusil sale bien
25. Tras validar el piloto del encargo 23 (fusil), extender el sistema `handPathAt` + `poses.json` con variación por arma a pistola/revólver, escopeta (incl. doble cañón), subfusil, francotirador y ametralladora; luego sacar arma, inspección y dedos. Una clase por tanda, con revisión mía (tests + capturas); si una clase sale mal, queda con el procedural actual. Etiquetar antes las poses «otro» por clase. L.

## 9. Pedido del usuario (23/11/2026, tarde)
26. Retículas unificadas: quitar la retícula dibujada en los modelos de las ópticas (ACOG y otras), guardar su forma en un catálogo y dibujar UNA retícula desde el juego con esa forma y el color de punto rojo/holo; ampliar el catálogo de formas. Paso 1 (encargo 29, inventario) lanzado. M.
27. Equipamiento en el mundo con los modelos nuevos: exportar GLB desde `.delegaciones/blender/equipo/*.py` (≤4.000 triángulos, piezas móviles aparte) y cargarlos en el juego en lugar de las primitivas de `gadgetfx`. Por lotes (torreta, escudo, cúpula, mina, gancho primero). L.
28. Agarres: encuadre de la mano de apoyo (mano casi fuera de pantalla en armas largas), anclajes que faltan (pistola con culata «frame», escopeta de bombeo y vgrip), coordenadas inválidas. Medido; pendiente de arreglar. M.
29. Registro de sesión en navegador: F10 descarga un .json con notas y capturas (hecho, falta probarlo).
30. Taller (workbench) a lo Modern Warfare Gunsmith: auditar `src/game/ui/workshop.ts` frente a Gunsmith (vista 3D rotable, ranuras alrededor, lista de accesorios con efecto en estadísticas, comparación en vivo, ajustes, guardado de configuraciones) y proponer piezas por tamaño. Encargo de auditoría sin tocar código tras el 31. M para la auditoría, L para el resultado.
31. Barrido de armas por categoría y arreglo por tandas (encargo 38).
32. Plantel de enemigos: pulir todos y añadir variedad (ver .delegaciones/PLAN_ENEMIGOS.md; encargos 40, 39, 42, 43 y de integración en src).
