
## Reglas comunes (innegociables)
- Eres el EJECUTOR: ejecuta y reporta; no redactes encargos ni delegues. Raíz del proyecto: la carpeta actual. Stack: TypeScript + Three.js r160 + Vite + Vitest.
- **Meta del usuario: que el juego parezca un triple A, no un juego cutre.** Cuida el acabado, la coherencia y el detalle, pero con presupuesto de rendimiento.
- **Número de luces reales de la escena FIJO (8).** No añadas, quites ni cambies el tipo de luces (recompila shaders y congela el juego). El brillo se hace con materiales emisivos o aditivos, halos y entorno (envMap).
- **Rendimiento**: el usuario ya se quejó de rendimiento. Cada efecto debe tener nivel de calidad (Bajo/Medio/Alto) o poder apagarse; por defecto Medio en PC y Bajo en táctil/Android. Reutiliza geometría y materiales, instancia, funde mallas estáticas (`mergeStatic`). Informa del coste (llamadas de dibujo con `renderer.info`, triángulos, pasadas).
- Sin verde en los brazos; el hall se mantiene claro; **sin franjas naranjas cruzando paredes o puertas**. Texto nuevo siempre en inglés y español (`src/i18n.ts`, `src/i18n-menus.ts`).
- No cambies valores esperados de tests existentes; añade tests nuevos donde haya lógica pura. No toques `CREDITS.md`. Sin dependencias nuevas. **Sin `git commit` ni `git push`.**
- Si algo no se puede verificar (por ejemplo, no hay Playwright o GPU), dilo: no inventes capturas ni resultados.
- Capturas ANTES/DESPUÉS con Playwright (`npx vite preview --port 4173`; cierra el servidor al acabar), guardadas FUERA del repo en `C:\Github\_noche\capturas\<id>\`.
- Verificación obligatoria al acabar: `npm run build` y `npx vitest run --minWorkers=1 --maxWorkers=2` en verde. Termina con un informe corto: qué cambiaste, coste y qué no pudiste comprobar.
