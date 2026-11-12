// Almacenamiento abstracto de partidas: leer, escribir, listar y borrar por clave. Sin dibujo ni lógica de juego.
// Implementaciones: navegador (localStorage), escritorio (archivos vía Electron) y memoria (tests).
// Escritura segura ante cortes: primero a una copia temporal, luego se reemplaza; al leer, si la principal falta o
// está dañada y hay una temporal válida, se recupera de ella.

export interface SaveStorage {
  read(key: string): Promise<string | null>;
  /** Escritura atómica: o queda el contenido nuevo entero o el anterior, nunca medio archivo. */
  write(key: string, data: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

const TMP = ".tmp";
const valid = (s: string | null) => { if (s == null) return false; try { JSON.parse(s); return true; } catch { return false; } };

/** Base común para almacenes de pares clave/valor síncronos (memoria y localStorage). */
abstract class KVStorage implements SaveStorage {
  protected abstract get(k: string): string | null;
  protected abstract set(k: string, v: string): void;
  protected abstract del(k: string): void;
  protected abstract keys(): string[];
  async read(key: string) {
    const main = this.get(key);
    if (valid(main)) return main;
    // La principal falta o está dañada: si quedó una temporal completa (corte entre escribir y reemplazar), se usa
    const tmp = this.get(key + TMP);
    if (valid(tmp)) { this.set(key, tmp!); this.del(key + TMP); return tmp; }
    return main; // dañada: se devuelve tal cual para que quien lee lo detecte y avise
  }
  async write(key: string, data: string) {
    this.set(key + TMP, data);   // 1. copia temporal completa
    this.set(key, data);         // 2. reemplazo
    this.del(key + TMP);         // 3. limpieza
  }
  async list(prefix = "") { return this.keys().filter((k) => k.startsWith(prefix) && !k.endsWith(TMP)).sort(); }
  async delete(key: string) { this.del(key); this.del(key + TMP); }
}

export class MemoryStorage extends KVStorage {
  readonly map = new Map<string, string>();
  protected get(k: string) { return this.map.get(k) ?? null; }
  protected set(k: string, v: string) { this.map.set(k, v); }
  protected del(k: string) { this.map.delete(k); }
  protected keys() { return [...this.map.keys()]; }
}

export class BrowserStorage extends KVStorage {
  constructor(private ns = "pp.save.") { super(); }
  protected get(k: string) { try { return localStorage.getItem(this.ns + k); } catch { return null; } }
  protected set(k: string, v: string) { localStorage.setItem(this.ns + k, v); }
  protected del(k: string) { try { localStorage.removeItem(this.ns + k); } catch { /* */ } }
  protected keys() {
    const out: string[] = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(this.ns)) out.push(k.slice(this.ns.length)); } } catch { /* */ }
    return out;
  }
}

/** Puente que expone el preload de Electron (desktop/preload.cjs): archivos en la carpeta de datos del usuario. */
interface DesktopBridge { read(k: string): Promise<string | null>; write(k: string, d: string): Promise<void>; list(): Promise<string[]>; remove(k: string): Promise<void> }
export class DesktopStorage implements SaveStorage {
  constructor(private b: DesktopBridge) {}
  read(key: string) { return this.b.read(key); }
  write(key: string, data: string) { return this.b.write(key, data); }   // el proceso principal escribe a .tmp y renombra
  async list(prefix = "") { return (await this.b.list()).filter((k) => k.startsWith(prefix)).sort(); }
  delete(key: string) { return this.b.remove(key); }
}

/** El almacenamiento adecuado a la plataforma (escritorio si hay puente de Electron, si no el navegador). */
export function platformStorage(): SaveStorage {
  const bridge = (globalThis as unknown as { ppStorage?: DesktopBridge }).ppStorage;
  return bridge ? new DesktopStorage(bridge) : new BrowserStorage();
}
