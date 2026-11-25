# Encargo 32 — Exportar el equipamiento como GLB listo para el juego (Blender, sin tocar `src/`)

Base: los 20 guiones `.delegaciones/blender/equipo/<id>.py` (+ `_comun.py`, ya validados) que generan `assets/equipo/<id>.png`. Ids: turret shield dome orb hook mine gravity slowfield jump beacon knife chain harpoon decoy glitch ammo inject thrust teleport chrono. Referencia de formato: `raw/pack8_pilotos/LEEME.md` y `.delegaciones/blender/pilotos/*.py` (cómo se exporta un GLB; función de exportación ya usada allí).

Tarea:
1. Añade a `_comun.py` una función `exportar_glb(id)` (si no existe ya una equivalente en los pilotos, reutiliza esa) y llámala al final de cada guion, sin cambiar el PNG existente. Salida en `raw/pack9_equipo/<id>.glb`.
2. Reglas del GLB: metros reales, +X = frente, +Y arriba (glTF), origen en el centro de la base en el suelo (el orbe, el cuchillo, la cadena y el arpón: en su centro), una malla por pieza con nombre en español, **máximo 3.000 triángulos por objeto** (si un objeto pasa, fusiona piezas ocultas o aplica Decimate suave solo a las mallas pequeñas y repasa), materiales Principled simples (color, metal, rugosidad, emisión; el cristal con alfa), sin texturas, luces ni cámaras. Piezas móviles como objeto aparte con el pivote en su eje y nombre que empiece por `mov_` (torreta: `mov_torreta`, `mov_canones`; escudo: ninguna; cúpula: `mov_anillo` si existe; etc.).
3. Ejecuta los 20 guiones (`"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python <guion>`; los errores de addons al salir son ruido) y verifica cada GLB leyendo su JSON (mallas, triángulos, materiales, ausencia de imágenes/cámaras/luces).
4. `raw/pack9_equipo/LEEME.md`: tabla (id, triángulos, mallas, piezas móviles `mov_*`, tamaño en m, dimensiones) y las desviaciones.
5. Máximo 2 correcciones por objeto. No toques `src/`, `assets/weapons`, ni los PNG ya aprobados (si cambian por la exportación, para y dilo). Sin commit ni instalaciones. Informe de 10 líneas.
