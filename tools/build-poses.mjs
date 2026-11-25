// Genera src/data/poses.json: recorridos REALES de las manos en recarga, sacar, inspección y reposo, normalizados
// para poder trasladarlos por anclas a cualquier arma. Solo lectura de los aportes y escritura del JSON.
//
// Fuentes: los recorridos extraídos de los .mdl aportados (`.delegaciones/herramientas/poses/`). Formato:
//   { <modelo>: { clase, secuencias: { reload_empty|reload|draw|inspect|idle: [ { nombre, dur, fps, muestras: [
//       { f, t, izq:[x,y,z], qi, der, qd, ci:[5], cd:[5] } ] } ] } } }
// Ejes del juego (m): x hacia la boca, y arriba, z derecha; `izq` es la muñeca izquierda respecto a la raíz del
// arma y `ci` la curvatura de los 5 dedos en grados (índice, corazón, anular, meñique, pulgar).
//
// Cada recorrido se guarda en un marco CANÓNICO: el punto de referencia cae en [0,-1,0] (distancia = 1) y el resto de
// la trayectoria se gira y escala con la misma semejanza (conserva forma y ritmo). El punto de referencia es:
//   - rifles: cargador (máxima aproximación a la raíz), que es la inserción del cargador;
//   - revólveres: también el cargador/tambor (distancia estable);
//   - pistolas: el punto más lejano al reposo (la cartuchera), porque en un arma tan corta la distancia al cargador
//     es de 2 cm y normalizar por ella deformaba el recorrido;
//   - draw: el inicio (la mano viene de abajo); inspect: el final (la mano sube hacia la corredera).
// `handPathAt`/`sequencePathAt` eligen el ancla según `to` y aplican la variación determinista por arma.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, ".delegaciones", "herramientas", "poses");
const salida = path.join(root, "src", "data", "poses.json");

// Tabla modelo → clase del juego (38 modelos de los aportes). Los dudosos van comentados con el criterio.
// `m32` es el lanzagranadas Milkor M32 (clase launcher), no un revólver; `rothsteyr` es la pistola Roth-Steyr.
// `tkb408` es el fusil bullpup soviético TKB-408 (la única referencia con el cargador detrás de la empuñadura): se
// etiqueta `bullpup`, no `sniper`, para que la tanda C tenga datos reales de esa clase.
const CLASES = {
  lowpolyak: "rifle", lowpolyarx160: "rifle", lowpolybren: "lmg", lowpolyczbren: "rifle",
  lowpolyfal: "rifle", lowpolyfiveseven: "pistol", lowpolyhk416: "rifle", lowpolyk31: "sniper",
  lowpolym1911: "pistol", lowpolym249: "lmg", lowpolym32: "launcher", lowpolym82: "sniper",
  lowpolym870: "shotgun", lowpolym98b: "sniper", lowpolymg42: "lmg", lowpolyminiuzi: "smg",
  lowpolymp9: "smg", lowpolyrhino: "revolver", lowpolyrothsteyr: "pistol", lowpolysaf: "smg",
  lowpolysaiga12: "shotgun", lowpolyscarh: "rifle", lowpolysmg2: "smg", lowpolytkb408: "bullpup",
  // Infinite Warfare (nombres del pack de aportes): Banshee escopeta de energía, DCM8 rifle de tirador,
  // EMC/FHR-40/VPR/Raijin-EMX subfusiles o fusiles de energía, Erad subfusil, KBAR-32 fusil, M1 fusil,
  // Mauler ametralladora, Oni pistola de energía, RPR Evo fusil/subfusil y Stallion .44 revólver.
  banshee_iw: "shotgun", dcm8_iw: "sniper", emc_iw: "rifle", erad_iw: "smg", fhr40_iw: "rifle",
  kbar32_iw: "rifle", m1_iw: "rifle", mauler_iw: "lmg", oni_iw: "pistol", raijin_iw: "smg",
  rprevo_iw: "rifle", stallion44_iw: "revolver", vpr_iw: "smg",
};

// Tanda A: pistolas y revólveres. Tanda B: escopetas (bombeo y cartuchos) y subfusiles. Tanda C: cerrojos,
// ametralladoras y bullpup. El fusil conserva el piloto anterior hasta su tanda (D).
const MODELOS = {
  rifle: ["lowpolyak", "lowpolyscarh", "lowpolyhk416", "lowpolyfal"],
  pistol: ["lowpolym1911", "lowpolyfiveseven"],
  revolver: ["lowpolyrhino", "stallion44_iw"],
  shotgun: ["lowpolym870", "lowpolysaiga12", "banshee_iw"],
  smg: ["lowpolyminiuzi", "lowpolymp9", "lowpolysaf", "lowpolysmg2", "erad_iw", "raijin_iw", "vpr_iw"],
  sniper: ["lowpolyk31", "lowpolym82", "lowpolym98b", "dcm8_iw"],
  lmg: ["lowpolybren", "lowpolym249", "lowpolymg42", "mauler_iw"],
  bullpup: ["lowpolytkb408"],
};
const SECUENCIAS = {
  rifle: ["reload", "reload_empty"],
  pistol: ["reload", "reload_empty", "draw", "inspect", "idle"],
  revolver: ["reload", "reload_empty", "draw", "inspect", "idle"],
  shotgun: ["reload", "reload_empty", "draw", "inspect", "idle"],
  smg: ["reload", "reload_empty", "draw", "inspect", "idle"],
  sniper: ["reload", "reload_empty", "draw", "inspect", "idle"],
  lmg: ["reload", "reload_empty", "draw", "inspect", "idle"],
  bullpup: ["reload", "reload_empty", "draw", "inspect", "idle"],
};
/** Cómo se normaliza cada recorrido de recarga: por el cargador (`mag`) o por el punto más lejano (`far`). */
const ANCLA_RECARGA = { rifle: "mag", revolver: "mag", pistol: "far", shotgun: "mag", smg: "mag", sniper: "mag", lmg: "mag", bullpup: "mag" };
/** Clases cortas: solo ellas derivan el agarre a dos manos del reposo (las largas usan el apoyo del guardamanos). */
const CLASES_AGARRE = new Set(["pistol", "revolver"]);

const r3 = (v) => v.map((x) => +x.toFixed(3));
const r4 = (v) => v.map((x) => +x.toFixed(4));
const r2 = (v) => v.map((x) => +x.toFixed(2));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// Cuaterniones (x, y, z, w): producto, conjugado y normalización para la orientación de muñeca.
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };

/** Cuaternión que lleva el vector unitario `a` al vector unitario `b` (arco mínimo). */
function qDe(a, b) {
  const d = clamp(dot(a, b), -1, 1);
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) return [1, 0, 0, 0]; // 180° alrededor de X
  const c = cross(a, b);
  const l = Math.hypot(c[0], c[1], c[2], 1 + d);
  return [c[0] / l, c[1] / l, c[2] / l, (1 + d) / l];
}
function rotar(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

const fuentes = new Map();
const cargar = (archivo) => {
  if (!fuentes.has(archivo)) fuentes.set(archivo, JSON.parse(fs.readFileSync(path.join(dir, archivo), "utf8")));
  return fuentes.get(archivo);
};

/**
 * Normaliza una secuencia al marco canónico. Devuelve `{ t, p, c, q, L, to, o }`:
 * `q` y `L` describen el marco (para derivar el offset del agarre), `to` el ancla que usa el juego y `o` la
 * orientación de la muñeca como DIFERENCIA respecto al reposo de la secuencia (marco canónico, id = ninguna).
 * La diferencia elimina la orientación de reposo de cada esqueleto (que no es comparable entre modelos) y deja el
 * giro real de la muñeca durante la secuencia, que sí es un giro rígido de la mano en el espacio del arma.
 */
function canonizar(sec, modo, seq) {
  const n = sec.muestras.length;
  const t0 = sec.muestras[0].t, t1 = sec.muestras[n - 1].t || sec.dur;
  const tn = sec.muestras.map((m) => (m.t - t0) / Math.max(1e-6, t1 - t0));
  // Origen y punto de referencia del marco canónico.
  const origen = seq === "draw" ? n - 1 : 0;
  const reposo = sec.muestras[origen].izq.slice();
  let ref = -1, to = "mag";
  if (seq === "idle") {
    const q = [0, 0, 0, 1], p = sec.muestras.map(() => [0, 0, 0]);
    const c = sec.muestras.map((m) => r2(m.ci.map((d) => clamp(d / 90, 0, 1.7))));
    return { t: r4(tn), p, c, q, L: 1, to: "rest", ext: 1 };
  }
  if (modo === "mag") {
    // Cargador: máxima aproximación a la raíz del arma (la inserción), sin los extremos del recorrido.
    let dMin = Infinity;
    for (let i = 1; i < n - 1; i++) {
      if (tn[i] < 0.08 || tn[i] > 0.9) continue;
      const d = len(sec.muestras[i].izq);
      if (d < dMin) { dMin = d; ref = i; }
    }
    to = "mag";
  } else if (modo === "far") {
    if (seq === "draw") { ref = 0; to = "far"; }
    else if (seq === "inspect") { ref = n - 1; to = "high"; }
    else {
      // Recarga de pistola: el punto más lejano al reposo (la cartuchera).
      let dMax = -1;
      for (let i = 1; i < n - 1; i++) {
        const d = len(sub(sec.muestras[i].izq, reposo));
        if (d > dMax) { dMax = d; ref = i; }
      }
      to = "far";
    }
  }
  if (ref < 0) return null;
  const dir = sub(sec.muestras[ref].izq, reposo);
  const L = len(dir);
  if (L < 0.02) return null;
  const q = qDe(norm(dir), [0, -1, 0]);
  const p = sec.muestras.map((m) => r3(rotar(q, sub(m.izq, reposo)).map((v) => v / L)));
  const c = sec.muestras.map((m) => r2(m.ci.map((d) => clamp(d / 90, 0, 1.7))));
  // Recarga: el punto de referencia (cargador o cartuchera) cae a mitad del tiempo, como la fase central del juego.
  let t = tn.slice();
  if (seq === "reload" || seq === "reload_empty") {
    const k = tn[ref];
    t = tn.map((x) => (x <= k ? (0.5 * x) / Math.max(1e-6, k) : 0.5 + (0.5 * (x - k)) / Math.max(1e-6, 1 - k)));
    t[0] = 0; t[n - 1] = 1; t[ref] = 0.5;
  }
  // El punto de referencia cae exacto en [0,-1,0]; el reposo, exacto en [0,0,0].
  p[ref] = [0, -1, 0];
  let cola = false;
  if (seq === "draw" || seq === "inspect") {
    p[origen] = [0, 0, 0];
  } else {
    p[0] = [0, 0, 0];
    if (len(sub(sec.muestras[n - 1].izq, reposo)) < 0.02) p[n - 1] = [0, 0, 0];
    // Hay recargas de referencia que acaban en la ventana de carga (M870: el clip termina al meter el cartucho y
    // el bombeo va aparte). Se devuelve la mano al agarre en el segundo tramo (después del ancla, que está en 0,5)
    // para que la recarga acabe donde empezó: el bombeo la recoge sin salto y la mano no se queda colgada en el
    // puerto. El ancla y el reposo se mantienen exactos.
    if (len(p[n - 1]) > 0.06) {
      cola = true;
      for (let i = 0; i < n; i++) {
        const k = clamp((t[i] - 0.5) / 0.5, 0, 1), s = k * k * (3 - 2 * k);
        p[i] = p[i].map((v) => +(v * (1 - s)).toFixed(3));
      }
      p[ref] = [0, -1, 0]; p[0] = [0, 0, 0]; p[n - 1] = [0, 0, 0];
    }
  }
  // Orientación de muñeca: diferencia (mundo) respecto al reposo de la secuencia, girada al marco canónico como las
  // posiciones (`q` es la semejanza que lleva el recorrido a [0,-1,0]). Sin dato para el reposo: no aporta giro.
  let o = null;
  if (seq !== "idle") {
    const q0 = sec.muestras[origen].qi;
    o = sec.muestras.map((m) => qnorm(qmul(q, qmul(qmul(m.qi, qconj(q0)), qconj(q)))));
    // Hemisferio continuo: el cuaternión y su negativo son la misma rotación, pero interpolados dan saltos.
    for (let i = 1; i < o.length; i++) if (dot(o[i], o[i - 1]) < 0) o[i] = o[i].map((x) => -x);
    // La mano que vuelve al agarre vuelve también con la muñeca neutra (si no, el último fotograma daría un giro
    // seco al pasar a la pose de apoyo). Solo en las recargas con cola inventada.
    if (cola) {
      for (let i = 0; i < n; i++) {
        const k = clamp((t[i] - 0.5) / 0.5, 0, 1), s = k * k * (3 - 2 * k);
        if (s <= 0) continue;
        let r = o[i]; if (r[3] < 0) r = r.map((x) => -x);
        o[i] = qnorm([r[0] * (1 - s), r[1] * (1 - s), r[2] * (1 - s), r[3] * (1 - s) + s]);
      }
    }
    o = o.map(r3);
  }
  return { t: r4(t), p, c, q, L, to, o, ext: Math.max(...p.map((v) => len(v))) };
}

/** Fases con sus tiempos relativos, derivadas de la propia trayectoria (para audio/eventos del encargo 24). */
function fases(seq, t, p, to) {
  const n = t.length;
  const dist = p.map((v) => len(v));
  const maxD = Math.max(...dist);
  if (seq === "idle") return [["idle", 0, 1]];
  if (seq === "draw") {
    let k = 0.7;
    for (let i = 0; i < n; i++) if (dist[i] < maxD * 0.18) { k = t[i]; break; }
    return [["raise", 0, +k.toFixed(3)], ["grip", +k.toFixed(3), 1]];
  }
  if (seq === "inspect") {
    let iMax = 1;
    for (let i = 1; i < n; i++) if (dist[i] > dist[iMax]) iMax = i;
    const a = t[iMax], b = Math.min(1, a + 0.18);
    return [["lift", 0, +a.toFixed(3)], ["turn", +a.toFixed(3), +b.toFixed(3)], ["lower", +b.toFixed(3), 1]];
  }
  // Recarga: agarre, salida, cartuchera, entrada, montaje y asiento. La referencia del cargador/cartuchera está en 0,5.
  let iFar = 1;
  for (let i = 1; i < n - 1; i++) {
    if (to === "far" || t[i] > 0.52) { if (dist[i] > dist[iFar]) iFar = i; }
  }
  const tFar = clamp(t[iFar], 0.52, 0.92);
  let tIn = 0.86;
  for (let i = iFar + 1; i < n; i++) if (dist[i] < maxD * 0.22) { tIn = clamp(t[i], tFar + 0.04, 0.92); break; }
  const tRack = clamp(tIn + 0.06, tIn + 0.01, 0.97);
  return [
    ["grab", 0, 0.14],
    ["out", 0.14, 0.5],
    ["pouch", 0.5, +tFar.toFixed(3)],
    ["in", +tFar.toFixed(3), +tIn.toFixed(3)],
    ["rack", +tIn.toFixed(3), +tRack.toFixed(3)],
    ["settle", +tRack.toFixed(3), 1],
  ];
}

/** Dirección unitaria del apoyo respecto a la mano derecha, en el marco canónico de la recarga (para el agarre). */
function offsetGrip(reload, idle) {
  if (!reload || !idle) return null;
  const m = idle.muestras[0];
  const v = rotar(reload.q, sub(m.izq, m.der));
  return v;
}

const datos = { version: 2, classes: {} };
for (const [clase, modelos] of Object.entries(MODELOS)) {
  const sequences = {};
  let reloadFrame = null;
  const gripDirs = [], gripFingers = [];
  for (const modelo of modelos) {
    const lib = cargar("poses_lowpoly_iw.json")[modelo];
    if (!lib) { console.warn("sin modelo:", modelo); continue; }
    const claseFuente = CLASES[modelo];
    if (claseFuente !== clase) { console.warn("clase discordante:", modelo, claseFuente, "≠", clase); continue; }
    const modeloSeqs = {};
    for (const seq of SECUENCIAS[clase]) {
      const lista = lib.secuencias?.[seq];
      if (!lista || !lista.length) continue;
      // (el nombre puede acabar en .0001: se toma la primera variante, que es la principal)
      const sec = lista[0];
      const modo = seq === "draw" || seq === "inspect" ? "far" : seq === "idle" ? "rest" : ANCLA_RECARGA[clase];
      const can = canonizar(sec, modo, seq);
      if (!can) { console.warn("sin marco:", modelo, seq); continue; }
      // Hay clips cuyo punto más cercano a la raíz queda pegadísimo al reposo: al normalizar por esa distancia, el
      // resto del recorrido se dispara (la mano se iría a un metro). No son fiables para el juego: se descartan y la
      // clase usa los modelos que sí traen un recorrido proporcionado.
      if ((seq === "reload" || seq === "reload_empty") && can.ext > 2.5) {
        console.warn("recorrido desproporcionado (se descarta):", modelo, seq, can.ext.toFixed(1));
        continue;
      }
      const pd = { id: `${modelo}/${seq}`, to: can.to, t: can.t, p: can.p, c: can.c };
      if (can.o) pd.o = can.o; // delta de orientación de muñeca (recarga, sacar, inspeccionar)
      (modeloSeqs[seq] ||= []).push(pd);
      if (seq === "reload") reloadFrame = can;
      if (seq === "idle") {
        const dir = offsetGrip(reloadFrame, sec);
        if (dir && len(dir) > 0.005) gripDirs.push(norm(dir));
        gripFingers.push(sec.muestras[0].ci.map((d) => clamp(d / 90, 0, 1.7)));
      }
    }
    for (const [seq, ps] of Object.entries(modeloSeqs)) (sequences[seq] ||= []).push(...ps);
  }
  // Si un modelo no traía `reload_empty` (rhino), la recarga vacía usa la recarga normal como segundo recorrido.
  if (sequences.reload?.length && !sequences.reload_empty?.length) {
    sequences.reload_empty = sequences.reload.map((pd) => ({ ...pd, id: pd.id.replace("/reload", "/reload_empty") }));
  }
  if (!sequences.reload?.length) { console.warn("clase sin recarga:", clase); continue; }
  const phases = {};
  for (const seq of SECUENCIAS[clase]) {
    const ps = sequences[seq];
    if (!ps?.length) continue;
    phases[seq] = fases(seq, ps[0].t, ps[0].p, ps[0].to);
  }
  const o = { paths: sequences.reload, sequences, phases };
  if (gripDirs.length && CLASES_AGARRE.has(clase)) {
    const dir = norm(gripDirs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]));
    const fingers = gripFingers[0].map((_, i) => +((gripFingers.reduce((a, f) => a + f[i], 0)) / gripFingers.length).toFixed(3));
    o.grip = { offset: r3(dir), fingers: fingers.map((v) => +v.toFixed(2)), thumb: +fingers[4].toFixed(2), frame: reloadFrame?.to ?? "mag" };
  }
  datos.classes[clase] = o;
  const cuenta = Object.entries(sequences).map(([s, ps]) => `${s}:${ps.length}`).join(" ");
  console.log(`  ${clase}: ${cuenta} | fases ${Object.keys(phases).join(",")}${o.grip ? " | agarre" : ""}`);
}

// Verificación: cada clase con datos debe tener al menos recarga y sacar. Las pendientes de otras tandas se avisan.
for (const [clase, d] of Object.entries(datos.classes)) {
  if (!d.sequences.reload?.length) console.warn("FALTA reload:", clase);
  if (!d.sequences.draw?.length) console.warn("PENDIENTE draw (tanda posterior):", clase);
}
// Las secuencias con recorrido (menos el reposo) deben traer la orientación de muñeca de las referencias.
const sinOrientacion = Object.entries(datos.classes).flatMap(([clase, d]) => Object.entries(d.sequences)
  .filter(([s, ps]) => s !== "idle" && ps?.some((pd) => !pd.o)).map(([s]) => `${clase}/${s}`));
if (sinOrientacion.length) console.warn("sin orientación de muñeca:", sinOrientacion.join(", "));

const texto = JSON.stringify(datos);
fs.writeFileSync(salida, texto);
console.log(`clases: ${Object.keys(datos.classes).length} | tamaño: ${(Buffer.byteLength(texto) / 1024).toFixed(1)} KB → ${path.relative(root, salida)}`);
