# Plan: 4.º slot de equipamiento + animaciones de granadas y equipamiento (22/11/2026)
Origen: el usuario nota que a las granadas y al equipamiento les faltan animaciones al lanzarlos o desplegarlos, y que el equipamiento debería ser un **4.º slot del inventario**, no una pestaña aparte.

## Estado hoy (leído en el código)
- Inventario (`src/game/ui/inventory.ts`): pestañas `gear | armor | equipment | skills | tree`. «Equipo» = armas + granadas; **Equipamiento es una pestaña propia** (`renderGadgets`, `selGadget`, `data-gdeq`).
- Controles: LB/X = equipamiento, RB/G = granada, LB+RB/V = súper. HUD `#gadgethud` ya existe.
- Animación de brazos (`arms.ts`, `anim.ts`, `src/data/anim.json`): **sin animación específica de lanzar granada ni de desplegar equipamiento**. Las súperes sí tienen líneas de tiempo de mano en `supers.json` (pos/rot de la mano en espacio de cámara por fotograma clave): ese formato se puede reutilizar.

## A. 4.º slot de equipamiento (UI)
- La vista «Equipo» pasa a mostrar los 4 huecos: arma 1, arma 2, granada y **equipamiento**. La lista de piezas de equipamiento se elige desde esa misma vista (como ya se hace con las granadas), sin pestaña propia.
- Quitar la pestaña `equipment` (y su clave `sp.tab.equipment`) y mantener LB/X y el HUD. Los datos guardados no cambian (`inv.gadgets`, `inv.gadget`), así que no hay migración.
- Ficha (`gadgetCard`) y venta/mochila se conservan. Máx. 8 piezas.
- Verificación: capturas de la vista Equipo con los 4 huecos (vacíos y llenos), navegación con mando y teclado, y los textos en español e inglés. Test del recuento de pestañas si existe.

## B. Animaciones (datos de fotogramas clave; sin quitar la anilla; revisado 22/11 con el usuario)
Referencias de movimiento: Call of Duty Ghosts e Infinite Warfare y Destiny (lanzamientos rápidos y fluidos, con un gesto corto y limpio, sin ceremonias). Sin quitar la anilla.
Cada animación sigue el patrón: anticipación (el brazo se echa un poco atrás) → lanzamiento → seguimiento (el brazo sigue el movimiento) → regreso suave a la pose del arma. Tiempos: ≤ 0,45 s en total; curvas con suavizado (entrada y salida), un pequeño balanceo de la cámara y el sonido sincronizado con el fotograma de salida.
1. **Lanzar** (granadas): lanzamiento por encima, corto y vivo (estilo Destiny/Ghosts); variante a ras (rodado) para granadas de suelo.
2. **Lanzar suave** (torreta, mina, baliza, señuelo, escudo, cúpula, orbe): se **lanza**, no se coloca: un lanzamiento por debajo, suave y corto, con un pequeño arco, y el objeto aterriza y se despliega.
3. **Activar** (gancho, arpón, salto, propulsor, inyector, teletransporte, cuchillo): el brazo extiende o aprieta el dispositivo; el inyector se clava en el muslo; el cuchillo es un tajo corto.
- Cómo se hace: la mano se mueve por fotogramas clave en el espacio de cámara (mismo formato que `supers.json`), con las curvas de suavizado del propio motor; los brazos del juego son procedurales, así que NO hacen falta Blender ni esqueleto.
- La lógica no cambia: el efecto sale en un fotograma clave. **Recibir daño NO cancela ninguna animación** (decisión del usuario 22/11): ni la recarga, ni el lanzamiento de granadas, ni el uso de equipamiento.
- Verificación: tiras de fotogramas por animación (capturas en el navegador) para revisar las poses, y el usuario la juega para valorar el ritmo y la sensación.

## Reparto (cuando vuelva la cuota de Go; yo dirijo y reviso con imágenes)
1. Tanda 1: A (slot) — solo UI, la más segura.
2. Tanda 2: B1 lanzar granada. Tanda 3: B2 lanzar suave y B3 activar por tipos (empezar por 4–5 tipos y ampliar).
Reglas: flash por defecto, tandas cortas, una imagen de revisión por tanda.

## C. Reclasificar: los arrojadizos pasan a Granadas (decisión del usuario, 22/11/2026)
El usuario quiere que bolas de energía, cuchillo arrojadizo y similares estén en la categoría de **granadas**, y que el equipamiento sea más disfrutable con animaciones y diseños más pulidos.
### Propuesta de reparto de los 20 tipos actuales (a confirmar)
- **Pasan a Granadas (10, arrojadizos o proyectiles):** orbe de energía, cuchillo arrojadizo, mina de proximidad, pozo de gravedad, campo de estasis, cargas en cadena, arpón eléctrico, señuelo holográfico, granada de fallo (ya se llama granada) y baliza de pulso. Con los 6 actuales (fragmentación, incendiaria, eléctrica, de racimo, singularidad y adhesiva) serían **16 tipos**.
- **Se quedan como Equipamiento (10, desplegables, personales y utilidades):** mini torreta, escudo desplegable, cúpula de energía, gancho de anclaje, plataforma de salto, caja de munición, inyector, propulsor, teleportador e inyección temporal.
### Trabajo
1. Unificar el modelo de datos: los 10 tipos pasan a `GrenadeSpec` (con sus cargas y recarga) y se lanzan con RB / G; la lógica de efectos se reutiliza (`gadgetfx.ts`).
2. **Migrar partidas guardadas:** los equipamientos guardados de esos 10 tipos pasan a la lista de granadas conservando rareza y cargas.
3. Botín, tienda y cápsulas: las nuevas granadas salen de las cápsulas y del botín de granadas; el equipamiento, de las suyas.
4. Interfaz: la vista Equipo muestra 4 huecos (arma 1, arma 2, granada, equipamiento); iconos y fichas 2D para granadas y equipamiento.
5. Orden: hacerlo ANTES de las animaciones y del 4.º slot, porque cambia cuántos tipos hay en cada categoría.
### Pulido del equipamiento
Animaciones de lanzar, lanzar suave y activar (secciones A y B) y pasada de diseño de los modelos de los 10 que se quedan (torreta, escudo, cúpula, gancho, plataforma, caja de munición, inyector, propulsor, teleportador e inyección temporal).
Esfuerzo: reclasificación M; diseño de modelos M; animaciones M–L.

### C.2 Reparto REVISADO con los criterios del usuario (22/11/2026; sustituye al reparto anterior)
**Criterio:** **Granada** = su fin principal es hacer daño (explosión o proyectil). **Equipamiento** = utilidad o efecto; si algo arrojadizo hace un poco de daño pero su fin es provocar otro efecto, es equipamiento. La **baliza de pulso** y la **plataforma de salto** son equipamiento.
- **Granadas (11):** fragmentación, incendiaria, eléctrica, de racimo, singularidad y adhesiva (las 6 actuales) + **orbe de energía, cuchillo arrojadizo, mina de proximidad, cargas en cadena y arpón eléctrico** (los 5 que pasan).
- **Equipamiento (15):** mini torreta, escudo desplegable, cúpula de energía, gancho de anclaje, plataforma de salto, baliza de pulso, caja de munición, inyector, propulsor, teleportador, inyección temporal + los arrojadizos de efecto **pozo de gravedad, campo de estasis, señuelo holográfico y granada de fallo** (esta última cambia de nombre al ser equipamiento; propuesta: «Emisor de fallo»).
- **A confirmar:** la granada de **singularidad** (tira de los enemigos y hace daño al colapsar) se deja como granada; si se prefiere por su efecto, pasaría a equipamiento y sería casi un duplicado del pozo de gravedad.
- Solo cambian de categoría 5 tipos (orbe, cuchillo, mina, cargas en cadena y arpón). Migración de partidas guardadas: esos 5, de equipamiento a granadas, conservando rareza y cargas.
**CONFIRMADO por el usuario (22/11/2026):** la granada de singularidad se queda como GRANADA; la «granada de fallo» pasa a equipamiento con el nombre **«Emisor de fallo»**. Reparto final: 11 granadas y 15 equipamientos.
