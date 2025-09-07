// server/index.ts
import "dotenv/config";
import express from "express";
import path from "node:path";
import { createServer } from "node:http";

async function createAppServer() {
  const app = express();
  const server = createServer(app);

  if (process.env.NODE_ENV !== "production") {
    // DEV: Vite middleware (laad expliciet de Vite config uit de projectroot)
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
      root: path.resolve(process.cwd(), "client"),
      server: { 
        middlewareMode: true,
        hmr: { 
          server, // Gebruik de bestaande HTTP server voor WebSocket
          overlay: false,
        },
        // Override de config settings voor middleware mode
        host: undefined,
        port: undefined,
      },
    });

    app.use(vite.middlewares);
  } else {
    // PROD: serve build uit dist
    const dist = path.resolve(process.cwd(), "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 8787;
  server.listen(port, () => {
    console.log(`[express] serving on port ${port}`);
  });
}

createAppServer().catch((err) => {
  console.error(err);
  process.exit(1);
});