# Encargo 04 — Enemigos cuerpo a cuerpo no llegan al jugador sobre pasarelas

Agente: coder, modelo `opencode-go/mimo-v2.6-pro` (razonamiento espacial). Raíz: la carpeta actual.

## Síntoma
En incursión y hack hay pasarelas elevadas (2,4 m) con escalera (`src/game/raidgen.ts`, `Player.STEP` 0,42, `groundAt` en `src/game/player.ts`).
Los enemigos que atacan cuerpo a cuerpo no llegan al jugador cuando está sobre una pasarela: se quedan abajo o no suben la escalera.

## Pasos
1. Reproduce y localiza: lee `src/game/dummies.ts` (movimiento y ataque), `src/game/raid.ts` (suelos y colisiones),
   `src/game/raidgen.ts` (dónde se generan las pasarelas y escaleras) y `src/game/waves.ts`/`hackgen.ts` si intervienen.
2. Decide el arreglo más pequeño: que los enemigos melee usen la altura del suelo (`groundAt` o equivalente) y suban la
   escalera (pathing simple hacia la rampa más cercana si el jugador está elevado), o que el ataque cuente por distancia 3D
   con tolerancia vertical coherente.
3. Impleméntalo sin cambiar el comportamiento de los enemigos a distancia ni de los voladores (dron centinela).

## Restricciones
- No cambiar balance (vida, daño, velocidad) ni valores esperados de tests. No luces nuevas. No dependencias. Sin commit ni push.
- Archivos probables: `src/game/dummies.ts`, `src/game/raid.ts`. Si necesitas tocar otro, dilo en el resumen.
- Mantén `tests/raid.test.ts` y `tests/waves.test.ts` en verde sin cambiar sus números.

## Criterio de aceptación
- Un test nuevo (puro, sin DOM) que compruebe que, con el jugador en una pasarela generada por `raidgen`, un enemigo melee
  puede alcanzar una posición a menos de su alcance de ataque (o, si el pathing no es testeable sin render, explícalo y prueba la función de altura).
- Build y tests en verde.

## Verificación
```
npm run build
npx vitest run --minWorkers=1 --maxWorkers=2
```
Informa: qué causaba el fallo, qué cambiaste y qué no pudiste probar en el juego.
