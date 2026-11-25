# Encargo 25 — Reclasificar 5 tipos de Equipamiento a Granadas (agente coder, modelo flash)

**Contexto.** Equipamiento (`src/game/gadgets.ts`, `gadgetfx.ts`, `inv.gadgets`, `inv.gadget`) y Granadas (`src/game/grenades.ts`, `grenadefx.ts`, `inv.grenades`, `inv.grenade`, tecla G) son dos sistemas. Gear ya tiene el cuarto slot E con foto (`gadgetthumb.ts`, `gadgetTile` en `ui/common.ts`).
Decisión del usuario: pasan de Equipamiento a **Granadas**: `orb`, `knife`, `mine`, `chain`, `harpoon`. Se quedan como están: singularidad (granada), y `glitch` sigue siendo equipamiento pero se renombra a **«Emisor de fallo» / "Glitch emitter"** (solo texto `gd.glitch`, `gd.d.glitch`).
Resultado: 11 granadas (6 actuales + 5) y 15 equipamientos.

**Enfoque (sin reescribir la lógica de efectos).**
1. `grenades.ts`: ampliar `GrenadeKind` con `orb|knife|mine|chain|harpoon` y `GRENADE_KINDS` con color, `charges`, `recharge`, `damage` tomados de `GADGET_KINDS` (mismos números). `GRENADE_KIND_LIST` crece solo.
2. Al lanzar (main.ts ~1397, `f.grenade`): si el tipo es uno de los 5, no usar `nades.throw`; construir un `GadgetSpec` equivalente (`kind`, `power`=damage, `radius`, `duration`, `charges`, `recharge`, `rarity`, `seed`, `uid`) y llamar a la misma función que usa `gadgetfx` para el equipamiento activo (ver cómo main.ts invoca `gfx.use`). Cargas y recarga se siguen llevando con `pouch`.
3. Quitar los 5 de `GADGET_KINDS` y `GADGET_KIND_LIST` (el equipamiento queda en 15). `makeGadget` debe seguir funcionando con los 15.
4. **Migración (`save.ts`, al cargar):** de `d.gadgets` mover los 5 tipos a `grenades` (conservando `rarity`, `seed`, `charges`; reasignar `uid` nuevo con `setGrenadeUid`), ajustar `gadgetActive` y `grenadeActive`. Un test con una partida antigua con un `mine` rare y una `torreta`: tras cargar, `mine` está en granadas, rara, y la torreta sigue en gadgets.
5. Textos: `gr.orb|knife|mine|chain|harpoon` y `gr.d.*` (copiar de `gd.*`/`gd.d.*` en español e inglés, `src/i18n*.ts`); borrar las claves `gd.` de esos 5.
6. Fotos: `grenadeThumb` usa el modelo de piña; para los 5 usar la figura de `gadgetthumb.ts` (mover el `case` de cada tipo a un export `figureOf(kind)` o hacer que `grenadeTile` muestre `data-gadgetthumb` cuando el tipo sea de los 5).
7. Botín y tienda: `makeGrenade` sin tipo ya elige de `GRENADE_KIND_LIST` (incluye los 5); revisar la tienda/cápsulas (`src/game/economy.ts`, `ui/shop.ts`) por si filtran tipos; modo desarrollador `gear` (main.ts ~497) ya recorre la lista.

**Restricciones.** No tocar los efectos en `gadgetfx.ts` ni los tests existentes (añadir el de migración). Español e inglés. Nada de commit ni instalar dependencias.

**Verificación.** `npx tsc --noEmit`; `npx vitest run tests/save*.test.ts tests/grenade*.test.ts tests/gadget*.test.ts` (los que existan) y el nuevo; informe con `git status --short` y un diff por archivo.
