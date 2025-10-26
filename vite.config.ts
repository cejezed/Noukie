// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { fileURLToPath } from "node:url";

// __dirname shim voor ESM (veilig, ook als je géén "type": "module" hebt)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // 👇 vertel Vite expliciet dat de client map je root is
  root: path.resolve(__dirname, "client"),

  plugins: [
    react(),
    // 👇 absoluut pad, en zet ignoreConfigErrors aan zodat CI niet stuk loopt
    tsconfigPaths({
      projects: [path.resolve(__dirname, "client/tsconfig.json")],
      ignoreConfigErrors: true,
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
    },
  },

  // output naar repo-root/dist (server serve’t al /dist)
  build: {
    outDir: path.resolve(__dirname, "client/dist"),
    emptyOutDir: true,
  },

  server: {
    port: 5173,
  },
});
