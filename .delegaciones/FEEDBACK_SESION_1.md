# Feedback de la sesión 1 (22/11/2026, 19:55–20:14, 19 min; 37 notas con F9, 65 capturas, 0 errores)
Carpeta: `C:\Users\varel\Documents\ProvingGrounds\sesiones\2026-11-22_19-55-31\` (resumen.md, eventos.jsonl, cap-*.jpg). Rendimiento: FPS medio 56, mínimo 33,7 (supervivencia, 2.275 llamadas de dibujo, 237k triángulos). Tiempo: 940 s en el hall, 200 s en supervivencia.

## A. Miras (≈14 notas; el tema principal)
Síntomas: la mira «aleja muchísimo» el arma al apuntar y la deja fina (Ironside 774 O, T-5J O, K79-RB O, JTS-59P); «una mira en la mira» (Harrier 137 O); mira telescópica integrada del modelo que sigue puesta mientras se apunta con hierro (Sentry, Longshot, ED-16); mira torcida, descentrada o que flota (Ironside 774, Dead Man's Hand, DTA714); «un trozo raro en la mira» (T-5J).
**Auditoría automática (herramienta `__bench.auditSights`, 320 armas, 40 por clase): el 29 % (94) tiene una pieza de mira visible y apunta con mira de hierro.** Por clase: subfusil 27/40, francotirador 22/40, fusil 20/40, pistola 9/40, escopeta 9/40, ametralladora 4/40, revólver 2/40, bullpup 1/40. Bases más afectadas: `k-platform-556-01` (9), `v-ppsh` (5), `k-platform-12ga-01` (5), `w-l115` (5), `x-subfusil-4`, `m-mp5`, `p-rifle-1`, `p-pistol-1`, `a-pistol`, `x-p6-gseries`, `v-m3gg`, `w-p90`.
Hipótesis: (1) la pieza de mira del modelo base se queda puesta al montar otra óptica o al apuntar con hierro; (2) el desplazamiento de ojo al apuntar usa la altura de la óptica montada y aleja el arma (distancia ojo-mira excesiva); (3) la línea de mira queda descentrada en armas con mira de serie.
Siguiente paso: diagnóstico en `assembler.ts` (ownSight, sightY, sightX) y `gun.ts` (posición al apuntar) con las bases anteriores como casos de prueba, y hojas antes/después.

## B. Agarre y posición en primera persona (≈14 notas)
Mano izquierda que agarra raro o con los dedos atravesando (M7941, H5 Drover, T-5J, GB3 Bushwhack); mano en el gatillo mal puesta; dos empuñaduras (S47 Hound O); arma demasiado baja, alta o enorme (H5 Drover, Dead Man's Hand «muy alta», K79-RB O, SPAS-12 «enorme»); pistola con culata y cañón largo que necesita agarre a dos manos (PK-9C); arma torcida al apuntar (DTA714).
Ya existía el encargo 11 (auditoría de posicionamiento); ahora hay armas concretas y capturas.

## C. Animaciones
- Recarga de escopetas de doble cañón (que se abren): trabajarla (T-5J O).
- Caída hacia atrás de los enemigos y movimiento de los grandes: parece «cartoony» y rompe la inmersión (A1).
- **Gancho:** no deja engancharse a nada. Quiere: al soltar el botón mantenido, quedar enganchado ahí (como 007 Agent Under Fire y Just Cause 2/3).

## D. Diseño de armas
SPAS-12 literal, sin variación (Longshot); armas feas o mal implementadas (GB3 Bushwhack «feísima», 3KB «hay que trabajarla muchísimo»); prometedoras pero a pulir (Basilisk, K79-RB O legendaria «chula» pero muy mal posicionada).

## E. Interfaz y mundo
- **Equipamiento:** como 4.º espacio en Gear, con imágenes (2D para no cargar el motor); para granadas, una foto 2D (ya recogido en `PLAN_SLOT_EQUIPAMIENTO_Y_ANIMACIONES.md`).
- **Cara del bot del hall:** parece una televisión normal y está muy alta; hacerla más grande y centrada, y ponerla en el centro del hall.
- **Haz de la linterna:** mejorar.

## Armas con notas (para volver a ellas)
M7941 Mk II, H5 Drover Mk III, Ironside 774 Mk II / O Mk II, SW-75D Mk II, S47 Hound O, T-5J O Mk III, 3KB Mk II, Sentry Mk II, D-333 Mk II, PK-9C Mk III, Longshot Mk II, ED-16 Mk II, Basilisk Mk II, K79-RB O Mk II (legendaria), Harrier 137 O Mk II, Dead Man's Hand (legendaria), JTS-59P SD Mk III, Kite 50 Mk II, GB3 Bushwhack, DTA714.
