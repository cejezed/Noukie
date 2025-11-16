// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig({
    // client is je web-root
    root: path.resolve(__dirname, "client"),
    plugins: [
        react(),
        tsconfigPaths({
            projects: [path.resolve(__dirname, "client/tsconfig.json")],
            ignoreConfigErrors: true,
        }),
    ],
    resolve: {
        // ⬇️ CRUCIAAL: één React-instantie erzorgen
        dedupe: ["react", "react-dom"],
        alias: {
            "@": path.resolve(__dirname, "client/src"),
            // forceer dezelfde react/react-dom instance vanuit root node_modules
            react: path.resolve(__dirname, "node_modules/react"),
            "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        },
    },
    optimizeDeps: {
        include: ["react", "react-dom"],
    },
    build: {
        outDir: path.resolve(__dirname, "dist"),
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        // SPA fallback (dev)
        historyApiFallback: true,
    },
    preview: {
        // SPA fallback (preview)
        historyApiFallback: true,
    },
});
