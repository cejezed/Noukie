import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client/src"),
      "@shared": path.resolve(process.cwd(), "shared"),
      "@assets": path.resolve(process.cwd(), "attached_assets"),
    },
  },
  build: {
    outDir: "./dist",
    assetsDir: "assets",
    emptyOutDir: false,
  },
  base: "/",
  server: {
    fs: { strict: true, deny: ["**/.*"] },
    hmr: { overlay: false },
    host: "0.0.0.0",
    port: 5173,
  },
});