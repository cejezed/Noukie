import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    // Commented out the runtime error overlay plugin that was causing the persistent error overlay
    // runtimeErrorOverlay(),
    // Replit-only plugin in dev; wordt niet gebruikt op Vercel (NODE_ENV=production)
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID
      ? [ (await import("@replit/vite-plugin-cartographer")).cartographer() ]
      : []),
  ],
  // Vite root is de 'client' map
  root: "client",
  resolve: {
    alias: {
      // Omdat root 'client' is, is 'src' al onder root.
      "@": path.resolve(process.cwd(), "client/src"),
      "@shared": path.resolve(process.cwd(), "shared"),
      "@assets": path.resolve(process.cwd(), "attached_assets"),
    },
  },
  build: {
    // BELANGRIJK: relative outDir t.o.v. Vite root -> 'client/dist'
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
  },
  base: "/", // correcte asset-paden in productie
  server: {
    fs: { strict: true, deny: ["**/.*"] },
    hmr: {
      overlay: false
    }
  },
});