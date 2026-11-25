import { defineConfig, type Plugin } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { sessionRelOk } from "./src/game/sessionpath";

// Guardado automático del registro de sesión desde el navegador (solo en desarrollo): POST /__session/write con
// { rel, b64 }. Escribe en Documentos/ProvingGrounds/sesiones/<rel> (la misma carpeta que el exe de escritorio).
const MAX_WRITE = 20e6;

function sessionWritePlugin(): Plugin {
  return {
    name: "pp-session-write",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__session/write", (req, res) => {
        const fail = (code: number, msg: string) => { res.statusCode = code; res.end(msg); };
        if (req.method !== "POST") return fail(405, "method not allowed");
        let size = 0; const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_WRITE) { fail(413, "too large"); req.destroy(); } else chunks.push(c);
        });
        req.on("end", () => {
          if (res.writableEnded) return;
          let body: { rel?: unknown; b64?: unknown };
          try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return fail(400, "bad json"); }
          if (!sessionRelOk(body.rel)) return fail(400, "bad path");
          if (typeof body.b64 !== "string") return fail(400, "bad data");
          const file = join(homedir(), "Documents", "ProvingGrounds", "sesiones", body.rel);
          void mkdir(dirname(file), { recursive: true })
            .then(() => writeFile(file, Buffer.from(body.b64 as string, "base64")))
            .then(() => { res.statusCode = 204; res.end(); }, () => fail(500, "write failed"));
        });
      });
    },
  };
}

// Dos páginas: el campo de pruebas (index.html) y el banco de armero (bench.html).
// Los modelos convertidos (assets/) se sirven tal cual en la raíz: /weapons/manifest.json, /weapons/<pack>/<arma>.glb
export default defineConfig({
  plugins: [sessionWritePlugin()],
  base: "./",
  publicDir: "assets",
  build: { outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 1200, rollupOptions: { input: { main: "index.html", bench: "bench.html" } } },
});
