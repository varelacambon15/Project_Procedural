import { defineConfig } from "vite";

// Los modelos convertidos (assets/) se sirven tal cual en la raíz: /weapons/manifest.json, /weapons/<pack>/<arma>.glb
export default defineConfig({
  base: "./",
  publicDir: "assets",
  build: { outDir: "dist", assetsInlineLimit: 0 },
});
