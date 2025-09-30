import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
<<<<<<< HEAD
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
    },
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json']
  },
  build: {
    outDir: "../dist",
    assetsDir: "assets",
    emptyOutDir: true,
  },
});
=======
import path from "node:path";

export default defineConfig({
  root: "client", // laat weg als jouw index.html in de root staat
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "client/src") }, // of "src" als je root gebruikt
  },
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
    },
  },
  optimizeDeps: {
    force: true, // één of twee runs aan laten; hierna mag dit weer weg
  },
});
>>>>>>> voice-chat
