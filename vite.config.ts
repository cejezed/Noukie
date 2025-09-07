// vite.config.ts (in projectroot)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client/src"),
      "@shared": path.resolve(process.cwd(), "shared"),
      "@assets": path.resolve(process.cwd(), "attached_assets"),
    },
  },
  publicDir: "public",           // => client/public → kopie naar client/dist
  build: {
    outDir: "dist",              // ⚠️ NIET ../dist maar gewoon "dist" → client/dist
    assetsDir: "assets",
    emptyOutDir: true,
  },
  base: "/",
});
