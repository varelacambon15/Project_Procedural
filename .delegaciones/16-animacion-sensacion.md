# Encargo 16 — Animación y sensación de las armas y la cámara
Agente: coder.
## Contexto importante
El usuario es MUY sensible a las posiciones y agarres de las armas (hubo muchos vaivenes). **No cambies** `gripZ`, `hip`, `adsGrip`, `rearMax`, poses de manos ni el encuadre. Solo añades movimiento SOBRE esas poses, guiado por datos en `src/data/anim.json`.
## Objetivo (audita primero `src/game/anim.ts`, `gun.ts`, `player.ts`)
1. Retroceso con **patrón por tipo** (subida más deriva) y recuperación suave; patada de cámara corta.
2. Transición de apuntado con curva de ease y ligero cambio de FOV.
3. **Sacar y guardar arma** (entra desde abajo, sale hacia abajo) e **inspeccionar** (F) con un giro lento del arma.
4. **Sprint y deslizamiento**: inclinación (roll) de cámara y arma bajada; **caída**: golpe de cámara al aterrizar, proporcional a la altura.
5. Respiración y balanceo en reposo muy sutiles, atenuados al apuntar.
6. Ajuste «Balanceo de cámara» (Activado/Reducido/Desactivado) en Ajustes por accesibilidad.
7. **Prioridad normal:** **FOV ajustable** en Ajustes (rango 70–110°, defecto 90 en PC) si no existe ya; respeta la cámara propia del arma (su FOV no cambia con este ajuste).
8. **Solo informar, sin cambiar**: ¿cambiar de arma durante una recarga la completa al instante (exploit tipo «recargar y cambiar»)? Anótalo en el informe con el archivo y la línea.
## Criterio
Tests puros nuevos de las curvas (acotadas, sin NaN, vuelven a cero). `tests/anim.test.ts` y `tests/gunplay.test.ts` intactos. Fotogramas clave (3–4 por animación) en capturas.
