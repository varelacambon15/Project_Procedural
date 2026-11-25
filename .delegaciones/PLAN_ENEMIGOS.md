# Plan de plantel de enemigos (usuario, 23/11/2026: «todos con diseños pulidos y mucha más variedad»)

## Hoy (18 tipos en `src/game/dummies.ts`)
Humanoides (14): small, basic, large, sturdy, elite, caster, guardian (escudo), gunner (fusil), sniper, medic, commander, glitch (salta), y jefes boss y warden. Robots (4): drone, spider, roller (kamikaze), turret.

## Método de modelado
- Humanoides: un cuerpo base modular (encargo 40, pack11) + piezas intercambiables y paletas → todas las variantes actuales salen de combinar piezas (sin modelos nuevos por variante). Casos con silueta propia (caster, jefes) tienen piezas especiales.
- Robots y criaturas: un modelo por tipo (≤3.500 triángulos; jefes hasta 6.000), con piezas `mov_*` para animar por código.

## Nuevos enemigos (APROBADOS por el usuario el 23/11/2026) (rol de juego, cómo se modela)
1. **Rodante artillero** (modelo ya hecho, `enemigo_rodante`): rueda y dispara a media distancia. Rodante explosivo = el kamikaze actual (encargo 39).
2. **Dron bombardero**: vuela alto y suelta cargas de área (obliga a moverse). Robot nuevo.
3. **Dron reparador**: apoya, cura a otros enemigos (prioridad de objetivo). Robot nuevo.
4. **Sabueso**: cuadrúpedo rápido que salta y muerde (cuerpo a cuerpo, flanquea). Robot nuevo.
5. **Centinela flotante**: torreta que levita con escudo frontal. Robot nuevo.
6. **Enjambre (arañitas)**: pequeñas, muchas, poca vida (variante reducida de la araña).
7. **Mech pesado** (mini-jefe): bípedo blindado con ametralladora y lanzamisiles, hasta 6.000 tris.
8. **Asesino infiltrado** (humanoide): sigilo, cuchillas, teletransporte corto; piezas propias sobre el cuerpo base.
9. **Granadero** (humanoide): lanzagranadas, área; piezas propias.
10. **Incinerador** (humanoide): lanzallamas con depósito que explota al morir.
11. **Invocador/hacker** (humanoide): invoca drones pequeños y se protege con campo.
12. **Berserker** (humanoide): exo-brazos, carga cuerpo a cuerpo, resistente al empuje.
13. Jefes nuevos: **Colosus** (mech gigante), **Reina araña**, **Núcleo** (esfera flotante con módulos); cada uno con fases.

## Orden de trabajo
1. Encargo 40 (soldado base modular, en curso) y 39 (rodante explosivo, en curso).
2. Encargo 42: robots y criaturas nuevas (dron bombardero, dron reparador, sabueso, centinela flotante, arañita, mech pesado).
3. Encargo 43: piezas especiales de humanoides (asesino, granadero, incinerador, invocador, berserker) sobre el cuerpo base.
4. Encargo `src/` (después de revisar los modelos): integrar en `dummies.ts` los GLB (cargador con respaldo procedural), animar las piezas `mov_*`, y definir los tipos nuevos con comportamiento sencillo reutilizando lo que ya existe (perseguir, disparar, curar, invocar) y su aparición en oleadas, raids, defensa y hack.
5. Jefes nuevos al final.
