# Encargo 06 — Campo de tiro: más detalle de escenario (visual)

Agente: coder. Eres el ejecutor: ejecuta y reporta, no delegues. Raíz: la carpeta actual.

## Contexto
`src/game/world.ts` (`buildRange`, ~718 líneas) construye el hall, el campo de tiro (línea de tiro z=0 local, blancos hacia -z; `rangePt` pasa de
coordenadas del campo a las del mundo), la sala de mando y la zona de pruebas. El usuario pide que el escenario se parezca más a un juego real.
En `docs/ESTADO.md` (Ronda 38, «Pendiente del repaso de escenario») queda por hacer en el campo de tiro: **mamparas entre cabinas, raíles de blancos
en el techo, focos sobre los blancos y paredes acústicas**; y en el hall: **un mostrador de recepción**.

## Objetivo
Añade, con el estilo ya existente (hormigón claro, paneles gris claro, tiras de luz emisivas, acabado arquitectónico del hall: zócalo, friso, pilastras):
1. Mamparas (paneles translúcidos/oscuros) entre las posiciones de tiro de la línea de tiro.
2. Raíles de blancos en el techo del campo (barras + carros decorativos sobre cada carril de `lanes`).
3. Focos sobre los blancos (conos/cajas emisivas, **sin luces reales nuevas**).
4. Paredes acústicas en los laterales (paneles con ranuras/textura procedural reutilizando `src/game/simtex.ts` si encaja).
5. Mostrador de recepción en el hall (mueble con terminal emisiva y rótulo), sin tapar las puertas ni las zonas de uso (`interactables`).

## Restricciones
- **No añadir luces reales** (el número de luces de la escena es fijo: 8; cambiarlo recompila todos los shaders y congela el juego). Solo materiales emisivos/aditivos.
- Rendimiento: funde mallas estáticas por material con `mergeStatic` (`src/game/merge.ts`); no sumes miles de llamadas de dibujo.
- No cambies colisiones existentes salvo para añadir las de los objetos nuevos; no muevas puertas, blancos, interactuables ni la zona de pruebas.
- **Sin franjas naranjas que crucen paredes o puertas** (decisión del usuario: no le gustaron). El hall debe seguir claro.
- Sin verde en el escenario nuevo salvo el de rótulos ya existentes. Textos nuevos en inglés y español (`src/i18n.ts` / `src/i18n-menus.ts`).
- No tocar valores de tests existentes. No instalar dependencias. Sin commit ni push.
- Archivos: `src/game/world.ts` (y, si hace falta, un módulo nuevo `src/game/rangeprops.ts`), `src/i18n-menus.ts`.

## Criterio de aceptación
- Build y tests en verde.
- Capturas ANTES y DESPUÉS con Playwright (si no puedes ejecutarlo, dilo; no inventes capturas): guárdalas **fuera del repo** en
  `C:\Github\_noche\capturas\06\` (`antes_*.png`, `despues_*.png`): vista desde la línea de tiro, vista lateral y mostrador del hall. Monta el build con
  `npx vite preview --port 4173` y cierra el servidor al acabar.
- Informe corto: qué añadiste, coste aproximado en llamadas de dibujo (`renderer.info`) antes/después y qué no pudiste comprobar.

## Verificación
```
npm run build
npx vitest run --minWorkers=1 --maxWorkers=2
```
