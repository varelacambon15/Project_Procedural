# Encargo 27 — Fotos 2D del equipamiento y las granadas nuevas, hechas en Blender (agente artist-3d, modelo flash)

**Por qué.** Las fotos actuales (`src/game/gadgetthumb.ts`) son esferas, cilindros y cajas con material plano: el usuario las ve «de plastilina». Se rehacen como **imágenes renderizadas en Blender** (una vez, offline) y el juego solo las carga como PNG: coste cero extra en el motor.

**Tipos (20, ids de `src/game/gadgets.ts`):** turret, shield, dome, orb, hook, mine, gravity, slowfield, jump, beacon, knife, chain, harpoon, decoy, glitch, ammo, inject, thrust, teleport, chrono. (orb, knife, mine, chain y harpoon ahora son granadas; mismas fotos.) `glitch` pasa a llamarse «Emisor de fallo».

**Salida:** `assets/equipo/<id>.png` (se sirve en `/equipo/<id>.png`), 640×320 px, **fondo transparente**, el objeto centrado ocupando ~70 % del alto, ligera vista tres cuartos desde arriba a la izquierda, sombra de contacto muy suave. Una sola foto por tipo (la rareza ya se ve en el borde de la ficha). Guion de Blender por tipo en `.delegaciones/blender/equipo/<id>.py` + un `renderizar_todo.py` que los ejecuta con `blender -b` (Blender 5.3 en `C:\Program Files\Blender Foundation\Blender 5.3\blender.exe`).

**Calidad exigida (lo que falta hoy):**
- Biseles en TODAS las aristas (modificador Bevel, anchura 1-3 mm a escala de objeto, 2 segmentos).
- Detalle de superficie real: paneles y juntas (cortes finos), tornillos y remaches (cilindros pequeños), ventilaciones o rejillas, nervios, asas, anillas, cables cortos. Mínimo ~6 elementos de detalle distintos por objeto.
- Materiales con carácter (Principled BSDF): metal pintado con rugosidad variable, metal desnudo en bordes (desgaste simulado con un segundo material en aristas por bevel o color por pieza), goma negra, cristal/plástico translúcido donde proceda, y **emisión real** (Emission) en luces y núcleos de energía.
- Iluminación de estudio: luz principal suave arriba-izquierda, luz de relleno fría, luz de contorno (rim) cálida y entorno tenue; EEVEE Next con 64 muestras o Cycles con 128 y denoise. Sin suelo visible, solo transparencia con sombra suave.
- Cada objeto reconocible a 160×80 px (se verá pequeño en la ficha): silueta clara, colores del tipo (`color` de `GADGET_KINDS`) como acento, no como pintura de todo el objeto.
- Nada de texto ni logotipos. Nada de copiar modelos ajenos: diseños propios.

**Procedimiento (por lotes de 5, uno por vez, sin pasar al siguiente hasta que el director valide):**
1. Lote 1: turret, shield, dome, hook, mine. 2. Lote 2: gravity, slowfield, jump, beacon, orb. 3. Lote 3: knife, chain, harpoon, decoy, glitch. 4. Lote 4: ammo, inject, thrust, teleport, chrono.
2. Tras cada lote: una hoja de contacto `assets/equipo/_hoja_loteN.png` (5 fotos en fila con su id) para revisión visual. No sigas hasta que el director la valide (el director te contestará con correcciones concretas).
3. Si una foto no supera los criterios, rehazla tú antes de entregarla.

**Integración (solo cuando los 20 estén validados):** en `src/game/gadgetthumb.ts`, que `gadgetThumb(kind)` intente cargar `./equipo/<kind>.png` (`new Image()`, `decode()`) y use la figura procedural actual solo como respaldo si falla. No cambies nada más. `npx tsc --noEmit` debe pasar.

**Restricciones.** No toques `gadgetfx.ts`, ni tests existentes, ni luces del juego. Sin commit. Si Blender falla o un lote sale peor que la figura actual, para y dilo.
