// server/index.ts
import "dotenv/config";
import express from "express";
import path from "node:path";
import { createServer } from "node:http";

async function createAppServer() {
  const app = express();
  const server = createServer(app);

  // JSON middleware voor alle API routes
  app.use(express.json());

  // API Routes - VOOR Vite middleware
  
  // Tutoring API (LeerChat - Socratic learning met audio)
  app.post('/api/tutoring', async (req, res) => {
    try {
      const handler = await import('../api/chat.js');
      return handler.default(req, res);
    } catch (error) {
      console.error('Tutoring handler error:', error);
      res.status(500).json({ error: 'Tutoring service unavailable' });
    }
  });

  // Coach API (Persoonlijke begeleiding met geheugen)
  app.post('/api/coach/chat', async (req, res) => {
    try {
      const handler = await import('../api/coach/chat.js');
      return handler.default(req, res);
    } catch (error) {
      console.error('Coach handler error:', error);
      res.status(500).json({ error: 'Coach service unavailable' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      services: ['tutoring', 'coach']
    });
  });

  // Development vs Production setup
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
        
        // Skip API routes
        if (url.startsWith('/api/')) {
          return next();
        }
        
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
    app.get("*", (req, res) => {
      // Skip API routes
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 8787;
  server.listen(port, () => {
    console.log(`[express] serving on port ${port}`);
    console.log(`[api] tutoring available at /api/tutoring`);
    console.log(`[api] coach available at /api/coach/chat`);
  });
}

createAppServer().catch((err) => {
  console.error(err);
  process.exit(1);
});