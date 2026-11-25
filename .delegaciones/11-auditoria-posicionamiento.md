# Encargo 11 — Auditoría visual del posicionamiento de armas (hojas, SIN cambiar valores)

Agente: coder. Ejecutor: ejecuta y reporta, no delegues. Raíz: la carpeta actual.

## Contexto
El usuario ha dicho varias veces que algunas armas «se ven lejanas», pequeñas o poco naturales en primera persona (cadera y apuntando). El posicionamiento se decide en
`src/game/anim.ts` + `src/data/anim.json` (`gripZ` por clase, `bulk`, `rearMax`, `adsGrip`, pose de cadera por clase) y `src/game/gun.ts`. Ha habido muchas rondas de ajuste y varias volvieron atrás:
el criterio es subjetivo, así que **esta vez solo se audita y se propone, no se cambia nada**.

## Objetivo
Genera material para que el usuario decida por la mañana:
1. Hojas de contacto en primera persona, **de cadera y apuntando**, con 6 armas distintas por tipo (pistola, revólver, subfusil, fusil, bullpup, ametralladora, escopeta, francotirador),
   usando las mismas semillas siempre (reproducible). Reutiliza `window.__game` / `window.__bench` y los scripts de Playwright que haya (`ESTADO.md`: «Capturas»).
2. Para cada arma: ancho/alto aparente en pantalla (% del ancho) y distancia ojo-culata/ojo-boca. Tabla en `informe.md` y resalta las que salgan fuera de rango
   (p. ej. ocupan menos de ~18 % o más de ~55 % del ancho de pantalla de cadera).
3. Propuesta de ajustes (valores concretos de `anim.json` por clase) **sin aplicarlos**, como un parche sugerido en `propuesta_anim.json.diff` dentro de la carpeta de resultados.

## Restricciones
- **No modifiques ningún archivo del repo.** Solo lees. Los scripts temporales van fuera del repo (`C:\Github\_noche\scripts\`).
- Sin dependencias nuevas, sin commit ni push. Si Playwright/Chromium no está disponible, dilo y para: no inventes datos.

## Entregables (fuera del repo) en `C:\Github\_noche\capturas\11\`
- `cadera_<tipo>.png` y `ads_<tipo>.png` (hojas de contacto), `informe.md` con la tabla y `propuesta_anim.json.diff`.

## Verificación
`git status --short` al terminar debe mostrar exactamente lo mismo que al empezar (no has tocado el repo). Inclúyelo en el informe.
