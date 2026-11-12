// Geometría por secciones para las armas generadas (en vez de extruir el perfil y tener cantos de caja):
//  - loftPoly: recorre un polígono de perfil a lo largo de un eje y en cada estación pone una sección de rectángulo con
//    esquinas redondeadas (radio arriba y abajo por separado). Da correderas con el canto biselado o redondo,
//    armazones con la quilla redondeada y empuñaduras de sección casi elíptica que siguen su ángulo.
//  - sweep: barre una sección redondeada a lo largo de un camino 2D (guardamonte, gatillo, asas): piezas de varilla
//    con su hueco de verdad.
// Todo en low poly con sombreado plano, y desgaste en las esquinas pintado en el color de vértice.
import * as THREE from "three";

export type P2 = [number, number];

/** Corte vertical de un polígono en x: [abajo, arriba] (o null si no lo corta). */
export function cutPoly(poly: P2[], x: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    if (x < Math.min(x1, x2) || x > Math.max(x1, x2)) continue;
    const vals = x1 === x2 ? [y1, y2] : [y1 + ((x - x1) / (x2 - x1)) * (y2 - y1)];
    for (const v of vals) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  return lo <= hi ? [lo, hi] : null;
}

export interface LoftOpts {
  /** Medio ancho (z) en cada x local. */
  half: (x: number) => number;
  /** Radio de las esquinas de arriba y de abajo como fracción del medio ancho (0 = canto vivo, 1 = media caña). */
  rTop: number; rBot: number;
  /** Puntos por esquina (1 = chaflán; 3-4 = redondeado). */
  segs?: number;
  /** Estaciones a lo largo del eje (además de los vértices del polígono). */
  n?: number;
  /** Marco local: origen y ángulo del eje X local (para empuñaduras y cargadores inclinados). */
  origin?: P2; angle?: number;
  /** Desgaste en esquinas (aclarado del color de vértice). */
  wear?: number;
  /** Ventana pasante (en coordenadas locales): en ese tramo la pieza se parte en una parte de arriba y otra de abajo. */
  hole?: { x0: number; x1: number; y0: number; y1: number };
}

/** Sección (y, z) de un rectángulo de esquinas redondeadas; siempre el mismo número de puntos. */
function section(y0: number, y1: number, half: number, rT: number, rB: number, segs: number): P2[] {
  const h = Math.max(1e-5, y1 - y0);
  const t = Math.min(rT * half, h * 0.5, half), b = Math.min(rB * half, h * 0.5, half);
  const out: P2[] = [];
  const arc = (cy: number, cz: number, r: number, a0: number, a1: number) => { for (let i = 0; i <= segs; i++) { const a = a0 + ((a1 - a0) * i) / segs; out.push([cy + Math.sin(a) * r, cz + Math.cos(a) * r]); } };
  // Esquinas en orden: abajo-derecha (+z), arriba-derecha, arriba-izquierda, abajo-izquierda
  arc(y0 + b, half - b, b, -Math.PI / 2, 0);
  arc(y1 - t, half - t, t, 0, Math.PI / 2);
  arc(y1 - t, -half + t, t, Math.PI / 2, Math.PI);
  arc(y0 + b, -half + b, b, Math.PI, Math.PI * 1.5);
  return out;
}

/** Construye la malla final: triángulos orientados hacia fuera (respecto al eje de cada estación) y desgaste. */
function finish(pos: number[], centers: number[], wear: number) {
  // Orientación: cada triángulo debe mirar en sentido contrario a su centro de referencia
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t], ay = pos[t + 1], az = pos[t + 2], bx = pos[t + 3], by = pos[t + 4], bz = pos[t + 5], cx = pos[t + 6], cy = pos[t + 7], cz = pos[t + 8];
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const k = t / 3, rx = (ax + bx + cx) / 3 - centers[k], ry = (ay + by + cy) / 3 - centers[k + 1], rz = (az + bz + cz) / 3 - centers[k + 2];
    if (nx * rx + ny * ry + nz * rz < 0) for (let i = 0; i < 3; i++) { const s = pos[t + 3 + i]; pos[t + 3 + i] = pos[t + 6 + i]; pos[t + 6 + i] = s; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const nor = g.attributes.normal, col = new Float32Array(nor.count * 3).fill(1);
  for (let i = 0; i < nor.count; i++) { const y = Math.abs(nor.getY(i)), z = Math.abs(nor.getZ(i)); if (y > 0.25 && z > 0.25) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = wear; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Pieza por secciones a partir de su polígono de perfil. Si hay tramos sin pieza (huecos), cada tramo es un sólido.
 */
export function loftPoly(poly: P2[], o: LoftOpts): THREE.BufferGeometry {
  const ang = o.angle ?? 0, [ox, oy] = o.origin ?? [0, 0];
  const ca = Math.cos(ang), sa = Math.sin(ang);
  // Polígono en coordenadas locales (u a lo largo del eje, v a lo ancho)
  const local: P2[] = poly.map(([x, y]) => { const dx = x - ox, dy = y - oy; return [dx * ca + dy * sa, -dx * sa + dy * ca]; });
  const us = local.map((p) => p[0]), u0 = Math.min(...us), u1 = Math.max(...us);
  const n = o.n ?? 24, segs = o.segs ?? 2, E = (u1 - u0) * 1e-3;
  const xs = new Set<number>();
  for (let i = 0; i <= n; i++) xs.add(u0 + E + ((u1 - u0 - 2 * E) * i) / n);
  for (const u of us) for (const d of [-E, E]) if (u + d > u0 && u + d < u1) xs.add(u + d);
  const st = [...xs].sort((a, b) => a - b).map((u) => ({ u, c: cutPoly(local, u) }));
  const pos: number[] = [], ctr: number[] = [];
  const W = (u: number, v: number, z: number): [number, number, number] => [ox + u * ca - v * sa, oy + u * sa + v * ca, z];
  const tri = (a: number[], b: number[], c: number[], cen: number[]) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) ctr.push(...cen); };
  type St = { u: number; s: P2[]; mid: number };
  let run: St[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const m = run[0].s.length;
      for (let i = 0; i + 1 < run.length; i++) {
        const A = run[i], B = run[i + 1];
        const cen = W((A.u + B.u) / 2, (A.mid + B.mid) / 2, 0);
        for (let k = 0; k < m; k++) {
          const k2 = (k + 1) % m;
          const a = W(A.u, A.s[k][0], A.s[k][1]), b = W(B.u, B.s[k][0], B.s[k][1]), c = W(B.u, B.s[k2][0], B.s[k2][1]), d = W(A.u, A.s[k2][0], A.s[k2][1]);
          tri(a, b, c, cen); tri(a, c, d, cen);
        }
      }
      // Tapas: abanico desde el centro de la sección, mirando hacia fuera del sólido
      for (const [S, out] of [[run[0], -1], [run[run.length - 1], 1]] as const) {
        const c = W(S.u, S.mid, 0), back = W(S.u - out * 0.01, S.mid, 0);
        for (let k = 0; k < m; k++) { const k2 = (k + 1) % m; tri(c, W(S.u, S.s[k][0], S.s[k][1]), W(S.u, S.s[k2][0], S.s[k2][1]), back); }
      }
    }
    run = [];
  };
  // Con ventana: tres tiras (fuera de la ventana, por encima y por debajo de ella), cada una con sus tramos
  const H = o.hole;
  if (H) for (const x of [H.x0, H.x1]) { st.push({ u: x - E, c: cutPoly(local, x - E) }, { u: x + E, c: cutPoly(local, x + E) }); }
  st.sort((a, b) => a.u - b.u);
  const runs: { main: St[]; up: St[]; lo: St[] } = { main: [], up: [], lo: [] };
  const close = (k: keyof typeof runs) => { run = runs[k]; flush(); runs[k] = []; };
  for (const { u, c } of st) {
    const inHole = !!H && u > H.x0 && u < H.x1;
    if (!c) { close("main"); close("up"); close("lo"); continue; }
    const [wx] = W(u, (c[0] + c[1]) / 2, 0), hw = o.half(wx);
    if (!inHole) { close("up"); close("lo"); runs.main.push({ u, s: section(c[0], c[1], hw, o.rTop, o.rBot, segs), mid: (c[0] + c[1]) / 2 }); continue; }
    close("main");
    if (c[1] > H!.y1 + 1e-4) runs.up.push({ u, s: section(Math.max(c[0], H!.y1), c[1], hw, o.rTop, 0.15, segs), mid: (Math.max(c[0], H!.y1) + c[1]) / 2 }); else close("up");
    if (c[0] < H!.y0 - 1e-4) runs.lo.push({ u, s: section(c[0], Math.min(c[1], H!.y0), hw, 0.15, o.rBot, segs), mid: (c[0] + Math.min(c[1], H!.y0)) / 2 }); else close("lo");
  }
  close("main"); close("up"); close("lo");
  return finish(pos, ctr, o.wear ?? 1.2);
}

/**
 * Varilla barrida a lo largo de un camino 2D (en XY), con sección redondeada de grueso `t` (en el plano) y ancho
 * `w` (en z). Con `closed`, el camino se cierra.
 */
export function sweep(path: P2[], t: number, w: number, opts: { closed?: boolean; segs?: number; r?: number; wear?: number } = {}): THREE.BufferGeometry {
  const segs = opts.segs ?? 1, r = opts.r ?? 0.5;
  const sec = section(-t / 2, t / 2, w / 2, r, r, segs);
  const N = path.length, pos: number[] = [], ctr: number[] = [];
  const frames = path.map((p, i) => {
    const a = path[opts.closed ? (i - 1 + N) % N : Math.max(0, i - 1)], b = path[opts.closed ? (i + 1) % N : Math.min(N - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return { p, n: [-ty / l, tx / l] as P2 };
  });
  const V = (f: { p: P2; n: P2 }, s: P2): number[] => [f.p[0] + f.n[0] * s[0], f.p[1] + f.n[1] * s[0], s[1]];
  const m = sec.length, last = opts.closed ? N : N - 1;
  for (let i = 0; i < last; i++) {
    const A = frames[i], B = frames[(i + 1) % N];
    const cen = [(A.p[0] + B.p[0]) / 2, (A.p[1] + B.p[1]) / 2, 0];
    for (let k = 0; k < m; k++) {
      const k2 = (k + 1) % m;
      const a = V(A, sec[k]), b = V(B, sec[k]), c = V(B, sec[k2]), d = V(A, sec[k2]);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let q = 0; q < 6; q++) ctr.push(...cen);
    }
  }
  if (!opts.closed) for (const [F, G] of [[frames[0], frames[1]], [frames[N - 1], frames[N - 2]]]) {
    const c = [F.p[0], F.p[1], 0], back = [G.p[0], G.p[1], 0];
    for (let k = 0; k < m; k++) { const k2 = (k + 1) % m; pos.push(...c, ...V(F, sec[k]), ...V(F, sec[k2])); for (let q = 0; q < 3; q++) ctr.push(...back); }
  }
  return finish(pos, ctr, opts.wear ?? 1.15);
}

/** Camino de un arco (centro, radio, ángulos) para guardamontes y gatillos. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number, n = 8): P2[] {
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
}
/** Camino de un rectángulo con esquinas redondeadas, abierto por arriba (guardamonte): de arriba-atrás a arriba-delante. */
export function guardPath(x0: number, x1: number, yTop: number, yBot: number, rBack: number, rFront: number): P2[] {
  const out: P2[] = [[x0, yTop]];
  out.push(...arcPath(x0 + rBack, yBot + rBack, rBack, Math.PI, Math.PI * 1.5, 4));
  out.push(...arcPath(x1 - rFront, yBot + rFront, rFront, Math.PI * 1.5, Math.PI * 2, 4));
  out.push([x1, yTop]);
  return out;
}
