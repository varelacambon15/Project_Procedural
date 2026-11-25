# Encargo 22b — Pulido de las armas existentes según la auditoría
Agente: coder, modelo `opencode-go/mimo-v2.6-pro`. Ejecutor: ejecuta y reporta, no delegues. Raíz: la carpeta actual.

## Entrada
`C:\Github\_noche\armas_existentes\auditoria.md` y sus hojas (encargo 22a). Léelas enteras. Si no existen, avisa y para.

## Objetivo
Que las armas ya existentes **no den vergüenza**: reducir de forma clara los defectos de la auditoría **sin colapsar la variedad** (el usuario valora la variedad; el cañón largo o corto es variedad).
Reglas del usuario (innegociables): reconocibles pero no idénticas; si algo desentona o está repetido, se omite; **si una combinación sale mal montada, se arregla el montaje (ancla, escala, rango); NUNCA se sustituyen sus piezas por las de la base** (eso la convertiría en copia de la base); adaptar mejor que descartar, pero lo irrecuperable se retira.

## Qué puedes tocar
`src/weapons/generator.ts` (`RETIRED`, `WHOLE_OUT`, rangos de variación `rollTweaks`, `vary`, compatibilidad de donantes, `BASE_SIZE`, `INTEGRAL_STOCK`), `src/weapons/kit.ts` (`KIT_RETIRED`), `src/weapons/assembler.ts` (anclas, escalas, `dressHandguard`), `src/weapons/procparts.ts`, `src/weapons/pistolgen.ts`, `src/weapons/longgen.ts`/`longmesh.ts`, `src/weapons/accessories.ts`.
Ideas de herramientas (elige según la auditoría): puertas de compatibilidad por **razón de secciones de unión** (`seccion_union_m`) entre piezas mezcladas; límites de estirado por pieza; anclajes corregidos de bases concretas; retirada de las bases o donantes irrecuperables; reglas contra «mismo defecto en cada semilla» detectadas.

## Restricciones
- No cambies estadísticas, balance, economía ni rarezas. No cambies valores esperados de tests existentes (si un test de recuento o de distribución se rompe por retirar bases, **avísalo en el informe, no lo edites**). Añade tests nuevos para las puertas de compatibilidad (puros).
- Mantén la regla ya existente: la base más repetida por tipo en 300 armas ≤ 25 % (`ESTADO.md`, ronda 11).
- No luces nuevas, no dependencias, sin `git commit` ni `git push`. Textos nuevos en inglés y español si los hay.
- No toques `assets/` (los `.glb` originales).

## Criterio de aceptación
1. Vuelve a generar **las mismas hojas con las mismas semillas** (ANTES = las de 22a, DESPUÉS = nuevas) en `C:\Github\_noche\armas_existentes\hojas_despues\`.
2. Informe `C:\Github\_noche\armas_existentes\pulido.md`: por tipo, % de RETOCAR/DESCARTAR antes y después, qué reglas añadiste y por qué, **qué bases o donantes retiraste** (y cuántas armas distintas quedan por tipo), y qué defectos siguen sin resolver.
3. Objetivo: bajar al menos un 70 % los defectos clasificados RETOCAR/DESCARTAR en las semillas auditadas sin que ningún tipo pierda más de un 25 % de sus bases.
4. `npm run build` y `npx vitest run --minWorkers=1 --maxWorkers=2` en verde.
