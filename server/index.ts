// server/index.ts
import "dotenv/config";
import express from "express";
import path from "node:path";
import { createServer } from "node:http";

async function createAppServer() {
  const app = express();
  const server = createServer(app);

  // API routes VOOR de catch-all
  app.use('/api', express.json());
  // Voeg hier je API endpoints toe
  // app.use('/api/auth', authRoutes);
  // app.use('/api/users', userRoutes);

  if (process.env.NODE_ENV !== "production") {
    // DEV: Vite middleware
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
      root: path.resolve(process.cwd(), "client"),
      server: { 
        middlewareMode: true,
        hmr: { 
          server,
          overlay: false,
        },
        host: undefined,
        port: undefined,
      },
    });

    app.use(vite.middlewares);
    
    // SPA fallback voor development - ALTIJD als laatste
    app.get('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const template = await vite.transformIndexHtml(url, `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Noukie</title>
            </head>
            <body>
              <div id="root"></div>
              <script type="module" src="/src/main.tsx"></script>
            </body>
          </html>
        `);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // PROD: serve static files
    const dist = path.resolve(process.cwd(), "dist");
    
    // Serve static assets
    app.use(express.static(dist));
    
    // SPA fallback voor production - ALTIJD als laatste
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