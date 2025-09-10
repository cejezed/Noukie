import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  build: {
    outDir: "../dist",
    assetsDir: "assets",
    emptyOutDir: true,
  },
  base: "/",
  server: {
    fs: { strict: true, deny: ["**/.*"] },
    hmr: { 
      overlay: false,
      clientPort: 443,
    },
    host: "0.0.0.0",
    port: 5173,
  },
});