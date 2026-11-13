// Tipografía pixelada hecha por código (sin descargas): glifos de 5×7 píxeles definidos aquí, que se convierten en
// una fuente TrueType en memoria y se registran con FontFace. Monoespaciada (6 píxeles de avance), con tildes, ñ, ¿¡
// y los símbolos que usa la interfaz. Los caracteres que no tiene (iconos de mando) caen a la fuente del sistema.

// Filas: 0 = tilde de mayúscula, 1..7 = cuerpo (la línea base está bajo la 7), 8..9 = descendentes.
// Cada glifo: filas del cuerpo separadas por "/" ("#" = píxel), opcionalmente "|" y las dos filas del descendente.
const G: Record<string, string> = {
  " ": "...../...../...../...../...../...../.....",
  A: ".###./#...#/#...#/#####/#...#/#...#/#...#", B: "####./#...#/#...#/####./#...#/#...#/####.", C: ".###./#...#/#..../#..../#..../#...#/.###.",
  D: "####./#...#/#...#/#...#/#...#/#...#/####.", E: "#####/#..../#..../####./#..../#..../#####", F: "#####/#..../#..../####./#..../#..../#....",
  G: ".###./#...#/#..../#.###/#...#/#...#/.####", H: "#...#/#...#/#...#/#####/#...#/#...#/#...#", I: ".###./..#../..#../..#../..#../..#../.###.",
  J: "..###/...#./...#./...#./...#./#..#./.##..", K: "#...#/#..#./#.#../##.../#.#../#..#./#...#", L: "#..../#..../#..../#..../#..../#..../#####",
  M: "#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#", N: "#...#/#...#/##..#/#.#.#/#..##/#...#/#...#", O: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
  P: "####./#...#/#...#/####./#..../#..../#....", Q: ".###./#...#/#...#/#...#/#.#.#/#..#./.##.#", R: "####./#...#/#...#/####./#.#../#..#./#...#",
  S: ".####/#..../#..../.###./....#/....#/####.", T: "#####/..#../..#../..#../..#../..#../..#..", U: "#...#/#...#/#...#/#...#/#...#/#...#/.###.",
  V: "#...#/#...#/#...#/#...#/#...#/.#.#./..#..", W: "#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.", X: "#...#/#...#/.#.#./..#../.#.#./#...#/#...#",
  Y: "#...#/#...#/.#.#./..#../..#../..#../..#..", Z: "#####/....#/...#./..#../.#.../#..../#####",
  a: "...../...../.###./....#/.####/#...#/.####", b: "#..../#..../#.##./##..#/#...#/#...#/####.", c: "...../...../.###./#..../#..../#...#/.###.",
  d: "....#/....#/.##.#/#..##/#...#/#...#/.####", e: "...../...../.###./#...#/#####/#..../.###.", f: "..##./.#..#/.#.../###../.#.../.#.../.#...",
  g: "...../...../.####/#...#/#...#/#...#/.####|....#/.###.", h: "#..../#..../#.##./##..#/#...#/#...#/#...#", i: "..#../...../.##../..#../..#../..#../.###.",
  j: "...#./...../..##./...#./...#./...#./...#.|#..#./.##..", k: "#..../#..../#..#./#.#../##.../#.#../#..#.", l: ".##../..#../..#../..#../..#../..#../.###.",
  m: "...../...../##.#./#.#.#/#.#.#/#...#/#...#", n: "...../...../#.##./##..#/#...#/#...#/#...#", o: "...../...../.###./#...#/#...#/#...#/.###.",
  p: "...../...../####./#...#/#...#/#...#/####.|#..../#....", q: "...../...../.####/#...#/#...#/#...#/.####|....#/....#",
  r: "...../...../#.##./##..#/#..../#..../#....", s: "...../...../.####/#..../.###./....#/####.", t: ".#.../.#.../###../.#.../.#.../.#..#/..##.",
  u: "...../...../#...#/#...#/#...#/#..##/.##.#", v: "...../...../#...#/#...#/#...#/.#.#./..#..", w: "...../...../#...#/#...#/#.#.#/#.#.#/.#.#.",
  x: "...../...../#...#/.#.#./..#../.#.#./#...#", y: "...../...../#...#/#...#/#...#/#...#/.####|....#/.###.", z: "...../...../#####/...#./..#../.#.../#####",
  0: ".###./#...#/#..##/#.#.#/##..#/#...#/.###.", 1: "..#../.##../..#../..#../..#../..#../.###.", 2: ".###./#...#/....#/...#./..#../.#.../#####",
  3: "#####/...#./..#../...#./....#/#...#/.###.", 4: "...#./..##./.#.#./#..#./#####/...#./...#.", 5: "#####/#..../####./....#/....#/#...#/.###.",
  6: "..##./.#.../#..../####./#...#/#...#/.###.", 7: "#####/....#/...#./..#../.#.../.#.../.#...", 8: ".###./#...#/#...#/.###./#...#/#...#/.###.",
  9: ".###./#...#/#...#/.####/....#/...#./.##..",
  "!": "..#../..#../..#../..#../..#../...../..#..", '"': ".#.#./.#.#./...../...../...../...../.....", "#": ".#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.",
  $: "..#../.####/#.#../.###./..#.#/####./..#..", "%": "##..#/##..#/...#./..#../.#.../#..##/#..##", "&": ".##../#..#./#.#../.#.../#.#.#/#..#./.##.#",
  "'": "..#../..#../...../...../...../...../.....", "(": "...#./..#../.#.../.#.../.#.../..#../...#.", ")": ".#.../..#../...#./...#./...#./..#../.#...",
  "*": "...../..#../#.#.#/.###./#.#.#/..#../.....", "+": "...../..#../..#../#####/..#../..#../.....", ",": "...../...../...../...../...../.##../..#..|.#.../.....",
  "-": "...../...../...../.###./...../...../.....", ".": "...../...../...../...../...../.##../.##..", "/": "...../....#/...#./..#../.#.../#..../.....",
  ":": "...../.##../.##../...../.##../.##../.....", ";": "...../.##../.##../...../.##../..#../.#...", "<": "...#./..#../.#.../#..../.#.../..#../...#.",
  "=": "...../...../#####/...../#####/...../.....", ">": ".#.../..#../...#./....#/...#./..#../.#...", "?": ".###./#...#/....#/...#./..#../...../..#..",
  "@": ".###./#...#/#.###/#.#.#/#.###/#..../.###.", "[": ".###./.#.../.#.../.#.../.#.../.#.../.###.", "\\": "...../#..../.#.../..#../...#./....#/.....",
  "]": ".###./...#./...#./...#./...#./...#./.###.", "^": "..#../.#.#./#...#/...../...../...../.....", _: "...../...../...../...../...../...../.....|#####/.....",
  "`": ".#.../..#../...../...../...../...../.....", "{": "...#./..#../..#../.#.../..#../..#../...#.", "|": "..#../..#../..#../..#../..#../..#../..#..",
  "}": ".#.../..#../..#../...#./..#../..#../.#...", "~": "...../...../.#.../#.#.#/...#./...../.....",
  "¿": "..#../...../..#../.#.../#..../#...#/.###.", "¡": "..#../...../..#../..#../..#../..#../..#..", "·": "...../...../...../..#../...../...../.....",
  "×": "...../#...#/.#.#./..#../.#.#./#...#/.....", "→": "...../..#../...#./#####/...#./..#../.....", "←": "...../..#../.#.../#####/.#.../..#../.....",
  "↑": "..#../.###./#.#.#/..#../..#../..#../.....", "↓": "..#../..#../..#../#.#.#/.###./..#../.....", "…": "...../...../...../...../...../...../#.#.#",
  "—": "...../...../...../#####/...../...../.....", "–": "...../...../...../#####/...../...../.....", "«": "...../..#.#/.#.#./#.#../.#.#./..#.#/.....",
  "»": "...../#.#../.#.#./..#.#/.#.#./#.#../.....", "º": ".###./#...#/.###./...../#####/...../.....", "ª": ".###./....#/.####/#...#/.####/...../#####",
  "°": ".##../#..#./.##../...../...../...../.....", "€": "..###/.#.../####./.#.../####./.#.../..###", "✓": "...../....#/...#./#.#../.#.../...../.....",
  "■": "...../#####/#####/#####/#####/#####/.....", "▸": "...../.#.../.##../.###./.##../.#.../.....", "▪": "...../...../.###./.###./.###./...../.....",
  "●": "...../.###./#####/#####/#####/.###./.....", "○": "...../.###./#...#/#...#/#...#/.###./.....", "█": "#####/#####/#####/#####/#####/#####/#####",
  "±": "..#../..#../#####/..#../..#../...../#####", "∞": "...../...../.#.#./#.#.#/.#.#./...../.....", "✕": "...../#...#/.#.#./..#../.#.#./#...#/.....",
  "ı": "...../...../.##../..#../..#../..#../.###.",
};
// Tildes: dos filas sobre las minúsculas (filas 0-1, con la 2 libre) y una sobre las mayúsculas (fila 0)
const ACC_LOW: Record<string, [string, string]> = { acute: ["...#.", "..#.."], grave: [".#...", "..#.."], diaer: [".#.#.", "....."], tilde: [".##.#", "#.##."] };
const ACC_CAP: Record<string, string> = { acute: "...#.", grave: ".#...", diaer: ".#.#.", tilde: ".##.#" };
const COMBOS: [string, string, string][] = [
  ["á", "a", "acute"], ["é", "e", "acute"], ["í", "ı", "acute"], ["ó", "o", "acute"], ["ú", "u", "acute"], ["ñ", "n", "tilde"], ["ü", "u", "diaer"],
  ["à", "a", "grave"], ["è", "e", "grave"], ["ò", "o", "grave"], ["ï", "ı", "diaer"], ["ç", "c", "acute"],
  ["Á", "A", "acute"], ["É", "E", "acute"], ["Í", "I", "acute"], ["Ó", "O", "acute"], ["Ú", "U", "acute"], ["Ñ", "N", "tilde"], ["Ü", "U", "diaer"],
];

/** Píxeles de un glifo como filas de 10 (0 = tilde de mayúscula … 9 = descendente). */
function bitmap(ch: string): string[] | null {
  const combo = COMBOS.find((c) => c[0] === ch);
  if (combo) {
    const base = bitmap(combo[1]); if (!base) return null;
    // Mayúsculas: la tilde va arriba con una fila de aire y la letra pierde una fila central (6 de alto)
    if (combo[1] === combo[1].toUpperCase() && combo[1] !== "ı") return [ACC_CAP[combo[2]], ".....", base[1], base[3], base[4], base[5], base[6], base[7], base[8], base[9]];
    else { base[0] = ACC_LOW[combo[2]][0]; base[1] = ACC_LOW[combo[2]][1]; base[2] = "....."; } // con una fila de aire
    return base;
  }
  const src = G[ch]; if (src === undefined) return null;
  const [body, desc] = src.split("|");
  const rows = [".....", ...body.split("/"), ...(desc ? desc.split("/") : [".....", "....."])];
  return rows;
}

// ---------- TrueType mínima ----------
const PX = 100, ADV = 6 * PX, ASC = 800, DESC = 200;
class Buf {
  b: number[] = [];
  u8(v: number) { this.b.push(v & 255); return this; }
  u16(v: number) { return this.u8(v >> 8).u8(v); }
  i16(v: number) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v: number) { return this.u16(Math.floor(v / 65536) & 0xffff).u16(v & 0xffff); }
  tag(s: string) { for (const c of s) this.u8(c.charCodeAt(0)); return this; }
  pad() { while (this.b.length % 4) this.u8(0); return this; }
}
const checksum = (b: number[]) => { let s = 0; for (let i = 0; i < b.length; i += 4) s = (s + ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0) >>> 0; return s; };

interface Glyph { code: number; rects: [number, number, number, number][]; adv: number }
function glyphs(): Glyph[] {
  const chars = [...new Set([...Object.keys(G), ...COMBOS.map((c) => c[0])])].filter((c) => c !== "ı");
  return chars.map((ch) => {
    const rows = bitmap(ch)!, rects: Glyph["rects"] = [];
    rows.forEach((row, r) => {
      // Tramos horizontales de píxeles de cada fila → un rectángulo cada uno
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== "#") continue;
        let e = x; while (e + 1 < row.length && row[e + 1] === "#") e++;
        rects.push([x * PX, (7 - r) * PX, (e + 1) * PX, (8 - r) * PX]);
        x = e;
      }
    });
    // Proporcional: cada letra avanza lo que mide (+1 píxel de separación); así la "I" o la "l" no dejan huecos
    // ("PROVI NG"). Las cifras siguen monoespaciadas para que los contadores (munición, créditos) no bailen.
    if (/[0-9]/.test(ch)) return { code: ch.codePointAt(0)!, rects, adv: ADV };
    if (!rects.length) return { code: ch.codePointAt(0)!, rects, adv: ch === " " ? 4 * PX : ADV };
    const x0 = Math.min(...rects.map((r) => r[0])), x1 = Math.max(...rects.map((r) => r[2]));
    return { code: ch.codePointAt(0)!, rects: rects.map(([a, b, c, d]) => [a - x0, b, c - x0, d] as [number, number, number, number]), adv: x1 - x0 + PX };
  }).sort((a, b) => a.code - b.code);
}

/** Construye el archivo TTF (ArrayBuffer). */
export function buildPixelFont(family = "SimPixel"): ArrayBuffer {
  const gl = glyphs(), n = gl.length + 1; // +1: .notdef
  // glyf + loca
  const glyf = new Buf(), loca: number[] = [];
  let maxPts = 4, maxCont = 1;
  const glyphData = (rects: Glyph["rects"]) => {
    if (!rects.length) return;
    const b = new Buf();
    const xs = rects.flatMap((r) => [r[0], r[2]]), ys = rects.flatMap((r) => [r[1], r[3]]);
    b.i16(rects.length).i16(Math.min(...xs)).i16(Math.min(...ys)).i16(Math.max(...xs)).i16(Math.max(...ys));
    rects.forEach((_, i) => b.u16(i * 4 + 3));
    b.u16(0); // sin instrucciones
    for (let i = 0; i < rects.length * 4; i++) b.u8(1); // todos los puntos sobre la curva
    const pts = rects.flatMap(([x0, y0, x1, y1]) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]); // sentido horario
    let px = 0; for (const [x] of pts) { b.i16(x - px); px = x; }
    let py = 0; for (const [, y] of pts) { b.i16(y - py); py = y; }
    maxPts = Math.max(maxPts, pts.length); maxCont = Math.max(maxCont, rects.length);
    glyf.b.push(...b.b); while (glyf.b.length % 4) glyf.u8(0);
  };
  loca.push(0); glyphData([[50, 0, 450, 700]]); loca.push(glyf.b.length); // .notdef: caja (simple)
  for (const g of gl) { glyphData(g.rects); loca.push(glyf.b.length); }
  const locaB = new Buf(); for (const o of loca) locaB.u32(o);

  const head = new Buf().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(1000)
    .u32(0).u32(0).u32(0).u32(0).i16(0).i16(-DESC).i16(500).i16(ASC).u16(0).u16(8).i16(2).i16(1).i16(0);
  const hhea = new Buf().u32(0x00010000).i16(ASC).i16(-DESC).i16(0).u16(ADV).i16(0).i16(0).i16(500).i16(1).i16(0).i16(0)
    .i16(0).i16(0).i16(0).i16(0).i16(0).u16(n);
  const maxp = new Buf().u32(0x00010000).u16(n).u16(maxPts).u16(maxCont).u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);
  const hmtx = new Buf(); hmtx.u16(ADV).i16(0); for (const g of gl) hmtx.u16(g.adv).i16(0);
  const os2 = new Buf().u16(4).i16(ADV).u16(400).u16(5).u16(0)
    .i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350).i16(50).i16(300)
    .i16(0); for (let i = 0; i < 10; i++) os2.u8(0);
  os2.u32(1).u32(0).u32(0).u32(0).tag("PPRJ").u16(0x40).u16(32).u16(Math.min(0xffff, gl[gl.length - 1].code))
    .i16(ASC).i16(-DESC).i16(200).u16(ASC).u16(DESC).u32(1).u32(0).i16(500).i16(700).u16(0).u16(32).u16(1);
  // cmap formato 4: un segmento por carácter + el final
  const segs = gl.map((g, i) => ({ start: g.code, end: g.code, delta: (i + 1 - g.code + 65536) % 65536 })).filter((s) => s.start <= 0xffff);
  segs.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const segX2 = segs.length * 2, sr = 2 * 2 ** Math.floor(Math.log2(segs.length)), es = Math.floor(Math.log2(segs.length));
  const sub = new Buf().u16(4).u16(0).u16(0).u16(segX2).u16(sr).u16(es).u16(segX2 - sr);
  for (const s of segs) sub.u16(s.end); sub.u16(0);
  for (const s of segs) sub.u16(s.start); for (const s of segs) sub.u16(s.delta); for (const _ of segs) sub.u16(0);
  sub.b[2] = (sub.b.length >> 8) & 255; sub.b[3] = sub.b.length & 255;
  const cmap = new Buf().u16(0).u16(1).u16(3).u16(1).u32(12); cmap.b.push(...sub.b);
  // name
  const names: [number, string][] = [[1, family], [2, "Regular"], [3, `${family}-Regular`], [4, family], [6, `${family}-Regular`]];
  const strs = names.map(([, s]) => { const b = new Buf(); for (const c of s) b.u16(c.charCodeAt(0)); return b.b; });
  const name = new Buf().u16(0).u16(names.length).u16(6 + names.length * 12);
  let off = 0; names.forEach(([id], i) => { name.u16(3).u16(1).u16(0x409).u16(id).u16(strs[i].length).u16(off); off += strs[i].length; });
  for (const s of strs) name.b.push(...s);
  const post = new Buf().u32(0x00030000).u32(0).i16(-100).i16(50).u32(0).u32(0).u32(0).u32(0).u32(0);

  const tables: [string, number[]][] = [["OS/2", os2.b], ["cmap", cmap.b], ["glyf", glyf.b], ["head", head.b], ["hhea", hhea.b], ["hmtx", hmtx.b], ["loca", locaB.b], ["maxp", maxp.b], ["name", name.b], ["post", post.b]];
  const out = new Buf(), nt = tables.length, srT = 16 * 2 ** Math.floor(Math.log2(nt));
  out.u32(0x00010000).u16(nt).u16(srT).u16(Math.floor(Math.log2(nt))).u16(nt * 16 - srT);
  let offset = 12 + nt * 16; const body: number[] = []; let headOffset = 0;
  for (const [tag, data] of tables) {
    const padded = [...data]; while (padded.length % 4) padded.push(0);
    if (tag === "head") headOffset = offset;
    out.tag(tag).u32(checksum(padded)).u32(offset).u32(data.length);
    body.push(...padded); offset += padded.length;
  }
  const all = [...out.b, ...body];
  const adj = (0xb1b0afba - checksum(all) + 0x100000000) >>> 0;
  all[headOffset + 8] = adj >>> 24; all[headOffset + 9] = (adj >>> 16) & 255; all[headOffset + 10] = (adj >>> 8) & 255; all[headOffset + 11] = adj & 255;
  return new Uint8Array(all).buffer;
}

/** Registra la fuente en el documento. Devuelve true si el navegador la aceptó. */
export async function installPixelFont(family = "SimPixel"): Promise<boolean> {
  try {
    const face = new FontFace(family, buildPixelFont(family), { style: "normal", weight: "400", display: "block" });
    await face.load(); (document.fonts as unknown as { add(f: FontFace): void }).add(face);
    return true;
  } catch (e) { console.warn("pixel font", e); return false; }
}
