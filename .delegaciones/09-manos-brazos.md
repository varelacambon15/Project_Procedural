# Encargo 09 — Manos y brazos en primera persona: más forma (visual)

Agente: coder. Ejecutor: ejecuta y reporta, no delegues. Raíz: la carpeta actual.

## Contexto
`src/game/arms.ts` (~262 líneas) construye los brazos: guantes con dedos de cápsulas (`phalanx`), palma con talón, manga con puño y reloj; `ARM_DATA` y `HandPose` (incl. `wristStraight`, `straight`).
Reglas del usuario: manga gris pizarra `#4b5462`, guante coyote oscuro `#43392f`, parche naranja, **nada de verde** (el reloj tampoco). Inercia mínima de los brazos al girar
(`camQ.clone()` en `gun.ts`: no lo rompas).
Último feedback del usuario: en pistolas la mano de apoyo se ve tosca por debajo del arma; a los brazos les falta forma: **un antebrazo que se estreche de verdad hacia la muñeca
y una mano con algo más de volumen en la palma**.

## Objetivo
1. Antebrazo cónico (ancho en el codo, estrecho en la muñeca), con pliegue de la manga y puño ceñido.
2. Palma con más volumen (almohadilla del pulgar, nudillos redondeados, dorso con ligera curvatura), sin perder la forma de cierre de los dedos alrededor de la empuñadura.
3. Mano de apoyo en pistolas: menos tosca (dedos y muñeca proporcionados, sin atravesar el arma).
4. Mantén el rendimiento: sin subir de forma notable los triángulos de los brazos; geometría compartida y materiales ya existentes.

## Restricciones
- No cambies los colores del equipo ni añadas verde. No toques la lógica de agarres (`GRIPS`, `fitCurls`) salvo lo imprescindible para que los dedos sigan rodeando el arma.
- No cambies valores esperados de tests. Sin dependencias, sin commit ni push, sin luces nuevas.
- Archivos: `src/game/arms.ts` (y `src/data/` si `ARM_DATA` vive ahí).

## Criterio de aceptación
- Build y tests en verde.
- Hoja ANTES/DESPUÉS con Playwright **fuera del repo** en `C:\Github\_noche\capturas\09\`: pistola a una mano, pistola a dos manos (agarre en C), subfusil, fusil con agarre vertical y ametralladora.
  Si no puedes capturar, dilo (no inventes).
- Informe: qué cambió en la forma, coste en triángulos y lo no comprobado.

## Verificación
```
npm run build
npx vitest run --minWorkers=1 --maxWorkers=2
```
