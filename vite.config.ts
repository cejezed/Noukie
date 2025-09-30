import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
