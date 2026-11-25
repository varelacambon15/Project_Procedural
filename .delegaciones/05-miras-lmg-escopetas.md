# Encargo 05 — Mira rústica de subfusil y revisión de miras por código (acotado)

Agente: coder. Ejecutor: ejecuta y reporta, no delegues. Raíz: la carpeta actual.

## Contexto (decisión del usuario, importante)
En una ronda anterior se intentaron **miras de hierro en las ametralladoras y escopetas generadas por código** (`src/weapons/longgen.ts` + `longmesh.ts`) y
**quedaban mal**, así que se revirtieron: esas armas apuntan con zoom, sin alza/punto. **No vuelvas a añadírselas.**
El resto de armas ya apuntan alineadas al centro (auditoría de la ronda 38: 0–2 px) gracias a `src/weapons/assembler.ts` (línea de mira, `irons`) y `src/game/anim.ts`.

## Objetivo (único)
Pendiente de `docs/ESTADO.md` (Ronda 38): la mira trasera «rústica» de algún subfusil se ve como un bloque grande delante.
1. Localízala (busca `rústic`/`rustic` en `src/weapons/` y `assets/weapons/iron/`, y `manifest.iron`) y repara escala/posición/forma para que sea una alza proporcionada, sin tapar la línea de mira.
2. Comprueba que, tras el arreglo, ese subfusil sigue apuntando a 0–2 px del centro (reutiliza la lógica de auditoría de la ronda 38).
3. Informa (sin cambiar nada) de qué armas por código siguen sin alza y confirma que apuntan con zoom sin errores.

## Restricciones
- No cambies estadísticas, rarezas ni economía. No cambies valores esperados de tests. No luces nuevas.
- No renombres piezas ni toques `.glb` de `assets/` salvo la propia alza rústica si el arreglo exige regenerarla; si es así, dilo.
- No `CREDITS.md`, sin dependencias, sin commit ni push. Archivos probables: `src/weapons/assembler.ts`, `src/weapons/accessories.ts`, datos de `assets/weapons/iron/`.

## Criterio de aceptación
- Test nuevo (o ampliación de uno existente sin cambiar sus números) que compruebe, para varias semillas de subfusiles con esa alza, que el punto de mira proyectado queda a < 2 px del centro.
- Build y suite en verde. Si puedes, captura antes/después con Playwright fuera del repo en `C:\Github\_noche\capturas\05\`.

## Verificación
```
npm run build
npx vitest run --minWorkers=1 --maxWorkers=2
```
