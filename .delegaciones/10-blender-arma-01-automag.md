# Encargo 10 — Blender: adaptar UNA arma al kit del juego (piloto: AutoMag .44)

## MODO MÍNIMO (prioridad sobre el resto; decisión del director por cuota)
Son modelos low-poly sencillos: el trabajo debe ser corto (**10-25 min, tope 45**). No pulas ni rehaces.
0. **Antes de nada (2 min):** compara con `raw/pack4/catalogo.json`, `raw/pack5`, `raw/pack2`, `raw/pack3` y `raw/kit39/catalogo.json`. Si es el MISMO modelo/arma que uno existente, escribe `Armas separadas/<NOMBRE>/NO_INTEGRAR.txt` con el nombre del existente y **termina sin procesar**.
1. Separa por las mallas que ya trae el GLB (casi siempre vienen nombradas). Sin biselar ni modelar de nuevo; solo cierra los cortes y coloca cada pieza en su ancla.
2. Entrega: `<NOMBRE>_ensamblada.glb`, `piezas/`, `manifest.json`, y **una sola** `hoja.png` (perfil + despiece). **Sin pruebas de mezcla con armas ajenas.** `informe.md` opcional (3 líneas bastan).
3. Accesorios: solo los que ya vengan separados en el modelo; no modeles accesorios nuevos.
4. Una exportación, un chequeo y fin. No reintentes por detalles estéticos; anótalos en una línea.

Agente: artist-3d. Eres el EJECUTOR (worker): ejecuta este encargo y reporta. No actúes como director, no redactes encargos ni delegues.
Raíz del proyecto: la carpeta actual (`C:\Github\Project_Procedural-ccr-9154dbc6-lqpjb5`). Blender está abierto con el addon MCP activo.

## Contexto
Hay 11 modelos low-poly en `Armas a convertir/`. Hay que adaptarlos al sistema de armas por piezas del juego y guardarlos en
`Armas separadas/<NOMBRE>/`, separados en **base, piezas y accesorios**. Un chat anterior pasó 3 horas inspeccionando y no exportó
nada. Esta vez: UNA arma, hasta el final, con verificación. Después te detienes (no hagas las otras 10).

Piloto: `Armas a convertir/free_to_use_low-poly_.44_auto_mag_pistol.glb` → carpeta de salida `Armas separadas/AUTOMAG44/`
(`tipo_juego: "pistol"`, `accion: "semiautomatica"`, calibre "any" si no hay mejor opción).

## Antes de tocar Blender: lee (solo lectura)
1. `raw/kit39/LEEME_integracion.md` y `raw/pack4/LEEME_pack4.md`: convenciones y tabla de piezas con su origen/ancla.
2. Referencia de salida ya aceptada por el juego: `raw/pack4/CZ75/` (manifest.json, `CZ75_ensamblada.glb`, `piezas/*.glb`) y, para accesorios,
   `raw/pack4/accesorios/accesorios.json`.
3. **`.delegaciones/TRASPASO_ARMAS.md` (FUENTE DE VERDAD)**: método, convenciones y trampas de quien preparó los packs anteriores. **`src/weapons/kit.ts` es OTRO sistema (kit modular `k-*`): NO uses sus roles ni sockets (`Platform`, `Handguard`, `receiver`…) ni nombres en inglés.** Entrega la convención de packs: piezas `cuerpo`, `culata`, `guardamanos_canon`, `empunadura`, `cargador`, `mira`…, anclas en español (`boca`, `raíl_superior`, `raíl_frontal`…), y valores de `accion` de `raw/pack5/acciones.json`.
   Referencia de salida más reciente: `raw/pack5/` y `raw/pack5/LEEME_pack5.md`.

## Convención de packs (obligatoria; detalle en TRASPASO_ARMAS.md)
- Color: SIN texturas ni colores de vértice; un color medio por pieza (de la textura original) guardado en `color` de cada pieza del manifest. Bisel ~2 mm y normales con aristas vivas > 32°.
- Anclas mínimas en el GLB ensamblado y el manifest: `boca`, `raíl_frontal` (toda arma la necesita), `raíl_superior`, `cara_empunadura` si hay empuñadura, `pozo_cargador` si hay cargador, `linea_mira`, y `cara_culata`/`cara_guardamanos`/`eje_tambor` según el arma.
- Manifest: `nombre`, `tipo_juego`, `chasis`, `accion`, `era_sugerida`, `largo_m`, `alto_m`, `piezas` (triangulos, origen_local, posicion_en_arma, bbox, material, color), `piezas_ausentes`, `mira_integrada` (`"alza"` o `null`), `accesorios_de_serie`, `boca_diametro_m`; en ópticas: `centro_lente_local`, `tipo_mira`, `aumento`, `apertura_m`, `ve_a_traves`.
- Miras de hierro: hoy el juego **apunta a través de ellas** cuando las hay (alza en `raíl_superior`, punto de mira en `raíl_frontal`): alza y punto deben quedar a la MISMA línea de mira. Si la arma trae una óptica, va como pieza `mira` aparte.
- Referencia de manifest actual: `raw/pack5/MAGNUM/manifest.json` (incluye `anclas`, `triangulos_total`, `funcionamiento`, `accion_detalle`).
- La suma de triángulos de las piezas debe coincidir con la del arma ensamblada (±10 %).
- Revisa SIEMPRE a ojo la orientación (+X boca, +Y arriba) con una vista renderizada antes de cortar.

## Estructura de la entrega y criterio de encaje (decisión del usuario)
Cada arma se **divide en piezas** y se saca en tres grupos dentro de `Armas separadas/<NOMBRE>/`:
- **Base**: el cuerpo/chasis (`cuerpo`, o `cuerpo_culata` en bullpup) y el glb ensamblado.
- **Piezas**: culata, guardamanos_canon, empuñadura, cargador/tambor, etc. en `piezas/`.
- **Accesorios**: silenciador, bocacha, óptica, agarre, bípode, linterna… en `accesorios/`, con origen en su ancla de montaje.
**Criterio de encaje:** si una pieza o accesorio **no encaja con el resto de piezas del juego ni con una culata o un guardamanos de otras armas**, o se ve deformada al mezclarla, se **retoca hasta que encaje** (cara de unión plana y tapada, sección y proporciones correctas) o, si no hay manera razonable, se **descarta** y se anota en `piezas_ausentes` y en `informe.md` explicando por qué. Mejor menos piezas y buenas que muchas dudosas. No inventes piezas que el modelo no tiene.

## Miras y mezcla de piezas (prioridad del usuario)
El usuario quiere armas que **se vean bien, se mezclen bien con otras SIN deformarse y con miras que funcionen**, tanto las de hierro como las ópticas y los accesorios.
1. **Miras de hierro pulidas**, bien hechas y proporcionadas (referencia: las que ya hay en `assets/weapons/iron/` y `raw/miras_hierro/`): si el arma no lleva óptica, **alza y punto de mira** modelados con cuidado (muescas, protección, grosor creíble). Dos opciones válidas:
   - desmontables: piezas/accesorios aparte con origen en `raíl_superior` (alza) y `raíl_frontal` (punto de mira); o
   - fundidas en el cuerpo/cañón: `mira_integrada: "alza"` y ancla `linea_mira` en el punto alto del alza.
   **Alza y punto deben quedar en la MISMA línea de mira**; compruébalo en Blender con un rayo o una vista desde el ojo, y anota el resultado en `informe.md`.
2. **Ópticas y accesorios** (si el modelo los trae): pieza aparte con origen en su ancla de montaje (`raíl_superior`, `raíl_inferior`, `boca`), con `centro_lente_local`, `tipo_mira`, `aumento`, `apertura_m` y `ve_a_traves` en ópticas. Que se vea a través (túnel abierto) y que no tapen la línea de mira de hierro cuando se retiran o montan.
3. **Mezcla sin deformaciones**: cada pieza intercambiable (culata, guardamanos_canon, empuñadura, cargador) con **cara de unión plana y tapada** (caps), `seccion_union_m` medido de verdad y proporciones normales, para que al montarla en otras armas no se vea estirada ni con huecos. Prueba al menos 2 combinaciones cruzadas con piezas de otras armas del repo (por ejemplo de `raw/pack5`) y deja una imagen en la hoja de contacto.
4. Nada de piezas fundidas con restos de otras (manguitos, soportes, munición).

## Reglas de cada pieza (innegociables)
- Metros a escala real; **+X hacia la boca, +Y arriba, Z grosor**. Origen del arma: centrado en X y Z, base en Y = 0.
- Un material liso por pieza llamado `mat_<pieza>`, sin texturas ni colores de vértice. Normales: aristas vivas por encima de 32°.
- Menos de 6.000 triángulos en total por arma.
- **Cada pieza con su origen en su ancla de unión** (tabla del LEEME), para montarla solo con traslaciones, sin rotaciones.
  Registra `seccion_union_m` de cada pieza (para que encaje en otras armas).
- Calidad: cortes limpios, sin huecos ni caras internas visibles, piezas que **funcionen acopladas a otras armas** (que un cargador,
  una culata o un guardamanos de este modelo sirvan en otros sin verse deformes). No inventes piezas que el modelo no tiene:
  lo que falte va en `piezas_ausentes`.
- Accesorios presentes en el modelo (silenciador, óptica, agarre, bípode, linterna…) van **separados** en `accesorios/<id>.glb`,
  con su origen en el ancla de montaje, y listados en `accesorios_de_serie` del manifest.
- Mira integrada: `mira_integrada: "alza"` + ancla `linea_mira` si no hay óptica; si hay óptica, pieza `mira` con `centro_lente_local`.

## Cómo trabajar en Blender
- Primero inspecciona la escena por MCP. Puede haber objetos de intentos anteriores (los 11 modelos importados): **no borres nada que no
  hayas creado tú**; trabaja en una colección nueva `AUTOMAG44` y deja la escena ordenada al terminar.
- Importa solo este modelo. Una arma a la vez.
- Plan → corta → exporta → verifica. Guarda el script de Blender que uses en `Armas separadas/AUTOMAG44/exportar.py` (o `.txt` si no hay Python fuera de Blender).

## Entregables en `Armas separadas/AUTOMAG44/`
- `AUTOMAG44_ensamblada.glb` (un nodo por pieza y un nodo vacío por ancla, como en pack4).
- `piezas/<pieza>.glb` (una por pieza) y `accesorios/<id>.glb` si procede.
- `manifest.json` con el mismo esquema que `raw/pack4/CZ75/manifest.json` y los campos del LEEME (tipo_juego, chasis, accion,
  era_sugerida, largo_m, alto_m, piezas con triángulos/origen_local/posicion_en_arma/bbox/material/color, anclas, mira_integrada,
  piezas_ausentes, accesorios_de_serie).
- `hoja.png`: hoja de contacto con el arma ensamblada (perfil y 3/4) y las piezas separadas en despiece, renderizada desde Blender.
- `informe.md`: qué piezas hay, qué anclas, qué dudas o desviaciones, triángulos totales y por pieza.

## Calidad por encima de la velocidad (decisión del usuario)
No hay prisa: usa el tiempo que necesites (horas si hace falta). Lo que importa es que cada pieza quede **limpia, natural y bien acoplable a otras armas**, sin deformaciones ni cortes bruscos, con el estilo de un shooter moderno de calidad. Antes de exportar, renderiza vistas del arma ensamblada y de las piezas, revísalas y corrige lo que se vea mal. Si dudas entre rápido y bien hecho, elige bien hecho.

## Puntos de control (obligatorio)
- **A los 40 minutos** debes haber exportado una primera versión COMPLETA (glb ensamblado, piezas, manifest, hoja, informe), aunque sea mejorable. Un intento anterior estuvo 105 minutos analizando sin exportar nada y se perdió.
- **Plantilla lista**: ya hay una entrega aceptada en `Armas separadas/AUTOMAG44/` (mira su `informe.md`, `manifest.json` y sobre todo `exportar.py`, un script de Blender que corta, nombra y exporta). **Reutilízalo y adáptalo** en vez de investigar desde cero; no repitas el análisis de referencias (pack4/pack5) más allá de abrir un manifest para copiar el esquema.
- Si el modelo es muy denso o tiene decenas de mallas, decima/agrupa primero con un script y empieza a cortar; no hagas mapas de ocupación ni comparativas con otras armas.

## Tiempo: entrega primero, pule con tope (decisión del director)
Calidad sí, pero **sin dar vueltas**: entrega completa (glb ensamblado, piezas, accesorios, manifest, hoja de contacto e informe) lo antes posible; después dedica como máximo ~30 minutos a mejoras reales (cortes, miras, pruebas de mezcla) y **termina**. No sigas investigando referencias más allá de lo necesario: en armas completas de packs, `seccion_union_m` NO hace falta en el manifest (el conversor del juego mide las secciones junto al ancla). Tope total orientativo: 90 minutos por arma.

## Prohibido
- No toques nada fuera de `Armas separadas/AUTOMAG44/` (ni `src/`, ni `assets/`, ni `raw/`, ni `Armas a convertir/`).
- No `git commit`, no `git push`, no instales nada, no uses `CREDITS.md`.
- No pases a la segunda arma: detente y reporta.

## Criterio de aceptación (compruébalo tú y dilo en el informe)
1. Todos los glb cargan y las piezas, montadas por traslación en sus anclas, reconstruyen el arma sin huecos ni solapes.
2. Triángulos totales < 6.000; un material `mat_<pieza>` por pieza.
3. El manifest es JSON válido y sus bbox/posiciones coinciden con los glb.
4. `hoja.png` existe y se ve limpia (sin piezas deformes ni flotando).
