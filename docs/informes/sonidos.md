# Tarea 7 — Conectar los sonidos nuevos (`opus/sonidos`)

## Qué se ha hecho
- `src/game/surfaces.ts` (lógica pura, `tests/surfaces.test.ts`):
  - material de sonido de una superficie: manda la etiqueta `userData.surface`; si no, se deduce del material
    (transparente → cristal, metálico → metal, marrón mate → madera, liso → plástico, resto → hormigón);
  - clave de impacto (`bala_*`) y de paso (`paso_*`) para cada material;
  - selector sin repetir la misma muestra dos veces seguidas y con variación de tono de ±6 %;
  - largo de zancada (andar, esprintar, agachado).
- Impactos de bala (`gun.ts`): en el escenario, según el material, con un solo sonido por disparo de escopeta y más
  bajo a distancia; en enemigos, `bala_metal` en escudo, casco y blindaje y `bala_carne` en el resto (se suma al
  sonido de acierto de siempre).
- Pasos, salto y sprint (`main.ts`): un paso por zancada según el suelo (rayo hacia abajo), más flojo agachado y
  más fuerte esprintando; aterrizaje con un paso grave; salto; ruido de equipo al esprintar cada ~1,5 s.
- Suelos etiquetados (`world.ts`): baldosa en el hall; rejilla en las pasarelas (la del suelo ahora también recibe
  impactos).
- Cuerpo a cuerpo: puñetazos con gancho izquierdo/derecho o uppercut (el fuerte) más el golpe en carne; al aire,
  barrido y golpe suave; patada con su sonido (con arma, el culatazo de siempre).
- Rebotes de granada según la fuerza del golpe: `rebote_duro`, `rebote_medio` o `rebote_granada`.
- Las muestras nuevas se precargan al iniciar.

## Verificado
- `npx tsc --noEmit` limpio; `tests/surfaces.test.ts` (4 tests) y `tests/sounds.test.ts` en verde.
- En el juego (Playwright): andar y saltar reproduce sonidos y no hay errores en consola.
- Sin verificar de oído: este entorno no tiene audio. Volúmenes elegidos a ojo: ajústalos al probar.

## Eventos sin gancho todavía
- `rodillazo` y `codazo`: el juego no tiene esos golpes.
- `punos_preparar`: no hay fase de preparación del golpe; quedaría bien en el golpe fuerte.
- `escombros`, `humo` y `apuntar`/`zoom_mira`: ya estaban fuera de esta tarea.
- Impactos en los escenarios de incursión, arena y hack: usan la deducción por material (sin etiquetas); conviene
  etiquetar sus suelos (`userData.surface`) al integrar los props de la tarea 9.
