# Encargo 12 — Postprocesado y tono (look de render triple A)
Agente: coder.
## Objetivo
1. **Audita** cómo se renderiza hoy (`src/game/main.ts`: renderer, tone mapping, sombras, el ajuste «Resplandor del neón», la cámara propia del arma, el visor/desenfoque de miras). No rompas nada de eso.
2. Implementa una cadena con `EffectComposer` de three/examples: **tone mapping filmic (ACES)** bien calibrado, **bloom** de medio tamaño que respete lo emisivo (neones, tiras de luz, legendarias), **viñeta suave**, **grano de película muy sutil** y **aberración cromática solo al recibir daño**, y antialiasing barato.
3. Debe convivir con el arma dibujada con su propia cámara (segunda pasada) y con el desenfoque de visor de francotirador (que sigue funcionando igual).
4. Ajuste nuevo **«Calidad gráfica» Bajo/Medio/Alto** en Ajustes (`src/game/settings.ts`, textos en i18n): Bajo = sin postprocesado (como ahora); Medio = tono + bloom a media resolución + viñeta; Alto = además grano, aberración y bloom a mayor resolución. Defecto: Medio en PC, Bajo en táctil (`body.touch`). La escala de render existente se respeta.
5. Si la cadena falla o el dispositivo no la soporta, cae sola a Bajo sin errores en consola.
## Archivos
`src/game/main.ts`, `src/game/settings.ts`, módulo nuevo `src/game/post.ts`, textos i18n, `src/game/ui/` (solo el ajuste).
## Criterio
Capturas Bajo/Medio/Alto del hall y del campo de tiro. Informe con nº de pasadas y coste estimado.
