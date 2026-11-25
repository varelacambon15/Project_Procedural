# Encargo 24 — Conectar los sonidos nuevos al juego
Agente: coder, `opencode-go/deepseek-v4.1-flash`. Sin `pro`. Sin commit.
## Contexto
Hay 70 sonidos nuevos en `assets/sonidos/` registrados en `manifest.json` → `efectos` (claves `bala_carne|hormigon|metal|madera|cristal|plastico|baldosa|arena`, `paso_hormigon|metal|rejilla|baldosa|madera`, `sprint_equipo`, `salto`, `punos_golpe`, `punos_golpe_carne`, `punos_gancho_izq|der`, `punos_uppercut`, `patada`, `rodillazo`, `codazo`, `punos_preparar`, `granada_rebote_duro|medio`). Hoy no suenan. API en `src/game/sounds.ts` y `src/game/audio.ts`; ver cómo se reproducen `casquillo`, `apuntar` y el silbido de melee.
## Objetivo
1. **Pasos y salto/aterrizaje:** reproducir `paso_*` según la superficie (hall: baldosa/hormigón; incursión: metal/rejilla; madera si existe) con cadencia ligada a la velocidad y al sprint (`sprint_equipo` suave al correr); `salto` al saltar. Volumen bajo, sin repetir la misma muestra dos veces seguidas.
2. **Puños y patadas:** `punos_golpe`/`punos_gancho_*`/`punos_uppercut` según el golpe del combo (izquierda, derecha, remate), `punos_golpe_carne` al impactar en un enemigo, `patada` en la patada (ya existe `kick`), `punos_preparar` al empezar.
3. **Rebote de granada:** `granada_rebote_duro` al botar en suelo duro.
4. **Impactos de bala por material:** **NO** en este encargo (los hace el paso 14 de efectos de combate); solo dejar una función `impactSound(material)` probada en `tests/sounds.test.ts` que elija `bala_<material>`.
## Criterio
Tests: todas las claves del manifest nuevas existen y sus archivos también; elección sin repetición consecutiva; `npx tsc --noEmit` limpio. No cambiar valores de tests existentes. Informe breve. Sin commit.
