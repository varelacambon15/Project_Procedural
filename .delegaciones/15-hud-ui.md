# Encargo 15 — HUD e interfaz con diseño triple A
Agente: artist-3d.
## Objetivo
Rediseño **visual** (no de lógica) del HUD y los menús con estilo coherente de shooter moderno (referencias del usuario: Destiny y el HUD cian segmentado de los shooters de simulación):
1. HUD en juego: vida, munición, súper, equipamiento, granada, XP, barra de jefe, mira, aviso de interacción y contador de bajas. Tipografía consistente, iconografía limpia, espaciados y animaciones suaves (CSS). Sin tapar la vista.
2. Menús: inventario, tienda, banco de trabajo, almacén, ajustes, pausa y resultados: tarjetas con rarezas bien diferenciadas, jerarquía clara y transiciones.
3. Táctil/Android horizontal (`@media (max-height:520px) and (orientation:landscape)`): que siga cabiendo todo.
## Restricciones propias
No cambies IDs ni clases que usa el código (`#gadgethud`, `#nadehud`, `#superhud`, `#xphud`, `.hptrack`…) ni la navegación con mando. No cambies textos salvo para añadir. Archivos: `src/game/ui/*`, `src/game/menus.css` (o donde viva) e `index.html`.
## Criterio
Capturas antes/después de: HUD en combate, inventario, tienda, ajustes y pausa; en 16:9 y en móvil apaisado. `tests/i18n.test.ts` en verde.
