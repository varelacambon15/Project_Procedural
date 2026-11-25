# Encargo 08 — Recarga del revólver de acción simple (animación)

Agente: coder, modelo `opencode-go/mimo-v2.6-pro`. Ejecutor: ejecuta y reporta, no delegues. Raíz: la carpeta actual.

## Contexto
Pendiente del usuario (docs/ESTADO.md, «Lista de pendientes», punto 1): **revólveres de acción simple**: amartillar el martillo a mano en cada disparo y cargar por la portilla, cartucho a cartucho.
En `src/game/anim.ts` el tipo de recarga ya admite estilos `"mag" | "shells" | "cylinder" | "break" | "gate"` (interfaz `reload`, línea ~22; rama `cylinder` ~232) y `accion` del revólver viene de
`actionHint` (`revolver_simple` / `revolver_doble`; Magnum del pack 5 `x-p5-MAGNUM`, `NAGANT` del pack 4). Datos: `src/data/anim.json`; manos: `src/game/gun.ts` (`GRIPS`, `updateHands`) y `src/game/arms.ts`.

## Paso 1: auditar antes de escribir
Comprueba qué hace hoy el estilo `"gate"` y si se usa con los revólveres de acción simple. Documenta en tu informe el estado real (qué existe, qué falta). No reescribas lo que ya funcione.
NOTA: según el chat de desarrollo, las recargas de doble cañón basculante y de revólver de acción simple ya se implementaron (ronda 0.16–0.17, `bd3c7c0`). Probablemente
este encargo se reduzca a **verificar con tests y fotogramas que funciona y pulir lo que se vea mal**; si todo funciona, no cambies nada y dilo.

## Objetivo
Para revólver de acción simple:
1. Ciclo de disparo: tras cada disparo, la mano de apoyo amartilla el martillo (animación corta, ~0,35 s) antes de poder volver a disparar; con sonido de martillo (`cycleKind` ya existe para «martillo en revólver de acción simple»).
2. Recarga por portilla, cartucho a cartucho: abrir la portilla, girar el tambor, sacar casquillos (expulsión), meter cartuchos de uno en uno (tiempo y sonido por cartucho, como en las escopetas de tubo con `anim.reloadOverride`), cerrar.
3. Si quedan balas, recarga táctica sin expulsar las vivas.

## Restricciones
- No cambies estadísticas, cadencia base ni balance; la cadencia efectiva puede quedar limitada por el amartillado: añade el tiempo en `anim.json`, no en `shop.json`.
- No cambies valores esperados de tests existentes (`tests/anim.test.ts`, `tests/gunplay.test.ts`). Añade tests nuevos para la máquina de estados (puro).
- No luces nuevas, sin dependencias, sin commit ni push. Archivos: `src/game/anim.ts`, `src/data/anim.json`, `src/game/gun.ts`, `src/game/arms.ts` (solo si hace falta).

## Criterio de aceptación
- Build y tests en verde, con tests nuevos que cubran: amartillado entre disparos, número de cartuchos metidos = los que faltaban, y que una recarga táctica no tira balas vivas.
- Si puedes, 6 fotogramas clave (amartillar, abrir portilla, expulsar, cargar, cerrar) con Playwright, **fuera del repo**, en `C:\Github\_noche\capturas\08\`. Si no es posible, dilo.

## Verificación
```
npm run build
npx vitest run --minWorkers=1 --maxWorkers=2
```
