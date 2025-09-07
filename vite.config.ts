import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID
      ? [ (await import("@replit/vite-plugin-cartographer")).cartographer() ]
      : []),
  ],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client/src"),
      "@shared": path.resolve(process.cwd(), "shared"),
      "@assets": path.resolve(process.cwd(), "attached_assets"),
    },
  },
  build: {
    outDir: "../dist",    // Veranderd van "dist" naar "../dist"
    assetsDir: "assets",
    emptyOutDir: false,   // Veranderd van true naar false
  },
  base: "/",
  server: {
    fs: { strict: true, deny: ["**/.*"] },
    hmr: {
      overlay: false
    },
    historyApiFallback: true,
    host: '0.0.0.0',
    port: 5173
  },
});