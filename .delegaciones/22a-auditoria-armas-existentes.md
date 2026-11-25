# Encargo 22a — Auditoría visual de las armas YA EXISTENTES (SOLO LECTURA)
Agente: artist-3d (MiMo 2.6). Eres el EJECUTOR: no delegues. **No uses Blender** (lo usa otra tarea). **No modifiques ningún archivo del repo**: solo lees y escribes resultados en `C:\Github\_noche\armas_existentes\`.

## Contexto (decisión del usuario)
Mañana quiere ver, además de armas nuevas bien hechas, **armas ya existentes que no den vergüenza**: sin deformidades ni amalgamas de piezas mal pegadas. Reglas suyas (de `docs/ESTADO.md`):
- Reconocibles pero no idénticas; el cañón largo o corto es variedad, no defecto.
- No hace falta aprovechar todas las piezas: mejor adaptar que descartar, pero **si algo desentona o está repetido, se omite**.
- Un arma es nueva por la combinación de piezas distintas; si una combinación sale mal montada, **se arregla el montaje; nunca se cambian sus piezas por las de la base**.
- Estilos y texturas coherentes entre las piezas de un arma. Bullpup = variante de fusil (su culata es solo carcasa). Tambores de frente. Sin asas flotantes que tapen la mira. Culatas macizas, no de varilla fina.

## Qué hacer
1. Monta el build (`npx vite preview --port 4173`; ciérralo al acabar) y usa Playwright con `window.__bench` (`lotSheet`, `varietySheet`, `modelSheet`, `closeups`; ver `docs/ESTADO.md`, secciones «Banco de pruebas» y rondas 14–18 y 36) para generar **hojas de contacto** de:
   - 48 armas generadas por tipo (semillas 1..48 fijas): pistol, revolver, smg, rifle (incluye bullpup), shotgun, sniper, lmg;
   - **cada modelo entero de base** (`modelSheet`) tal cual.
   Guárdalas en `C:\Github\_noche\armas_existentes\hojas\` (nombres `tipo_semillas.png`, `bases_*.png`). Si Playwright no está disponible, para y repórtalo: no inventes.
2. **Mira cada hoja** y clasifica cada arma como OK / RETOCAR / DESCARTAR con el defecto en una categoría: pieza flotante o atravesada, secciones que no casan (guardamanos mucho más grueso o fino que el cajón), cargador gigante o diminuto, tambor girado, culata mal alineada o de varilla, asa o mira que tapa la vista o flota, cañón deforme, proporciones absurdas, bloque informe, repetida/casi idéntica a otra.
3. Escribe `C:\Github\_noche\armas_existentes\auditoria.md` con: resumen por tipo (OK/RETOCAR/DESCARTAR en %), **tabla de defectos** (tipo, semilla o id de base, defecto, causa probable con los ids de las piezas implicadas, propuesta: retirar base / limitar rango de combinación / ajustar ancla o escala), y los **20 peores** orígenes de defecto (bases o donantes que más se repiten).
4. Sé concreto y honesto: si no puedes distinguir algo en la imagen, dilo.

## Criterio de aceptación
`auditoria.md` y las hojas existen; cada afirmación remite a una hoja y a una semilla o id reproducible. `git status --short` al terminar igual que al empezar (no tocaste el repo).
