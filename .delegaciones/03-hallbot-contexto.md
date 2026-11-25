# Encargo 03 — Asistente del hall: frases según el contexto

Agente: coder (flash). Proyecto: TypeScript + Three.js + Vite + Vitest. Raíz: la carpeta actual.

## Objetivo
El asistente del hall (`src/game/hallbot.ts`) ya reacciona a: saludo, frases sueltas (`bot.idle.*`), cercanía, aburrimiento,
disparos, vuelta de incursión (`raidWon`/`raidLost`) y subida de nivel (`levelUp`). Añade reacciones **según el contexto**:

1. `lowCredits`: el jugador entra al hall con menos de 50 CR (comenta con humor que toca practicar en el campo de tiro).
2. `newSuper`: el jugador acaba de desbloquear un módulo de súper (comentario celebratorio).
3. `newGadget`: el jugador acaba de recibir equipamiento como botín (comentario breve).
4. `furnitureFull`: el jugador ha comprado todo el mobiliario.

Cada evento con 3 frases por idioma (`bot.<evento>.0..2`), con `{n}` para el nombre del jugador donde quede natural.

## Rutas
- Lógica y tipo `BotEvent`: `src/game/hallbot.ts` (método `event(e)`, línea ~93, y la tabla de frases `pick`).
- Disparo de eventos: `src/game/main.ts` (ya hay `hallBot.event("levelUp")` y `hallBot.event(won ? "raidWon" : "raidLost")`;
  busca el punto donde se desbloquea un módulo de súper, donde cae equipamiento (`dropGadget`/`pickGadget`) y la compra de mobiliario `openFurniture`).
- Textos: `src/i18n-menus.ts`. **Siempre inglés y español**, mismas claves en los dos bloques.

## Restricciones
- No tocar balance, economía, rarezas ni valores de tests existentes.
- No añadir luces a la escena.
- No renombrar claves existentes. No tocar `CREDITS.md`, ni `package.json`, ni `docs/`.
- No instalar dependencias. No hacer `git commit` ni `git push`.
- Los eventos no deben disparar el habla más de una vez cada ~20 s (reutiliza el enfriamiento que ya tenga el asistente).
- Solo estos archivos: `src/game/hallbot.ts`, `src/game/main.ts`, `src/i18n-menus.ts` y, si añades tests, un archivo nuevo en `tests/`.

## Criterio de aceptación
- Los 4 eventos nuevos existen en `BotEvent` y tienen 3 frases en inglés y 3 en español.
- `tests/i18n.test.ts` sigue verde (comprueba que las claves coinciden entre idiomas).
- Un test nuevo (p. ej. `tests/hallbot.test.ts`, si se puede sin DOM; si no, omítelo y dilo) o, como mínimo, build y tests en verde.

## Verificación
```
npm run build
npx vitest run --minWorkers=1 --maxWorkers=2
```
Termina con un resumen de los archivos tocados y de lo que NO pudiste verificar.
