import { defineConfig } from "vite";

// Dos páginas: el campo de pruebas (index.html) y el banco de armero (bench.html).
// Los modelos convertidos (assets/) se sirven tal cual en la raíz: /weapons/manifest.json, /weapons/<pack>/<arma>.glb
export default defineConfig({
  base: "./",
  publicDir: "assets",
  build: { outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 1200, rollupOptions: { input: { main: "index.html", bench: "bench.html" } } },
});
