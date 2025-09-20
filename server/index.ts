// server/index.ts
import "dotenv/config";
import express from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";

async function createAppServer() {
  const app = express();
  const server = createServer(app);

  // ------- Basics -------
  app.use(express.json({ limit: "2mb" }));

  // CORS (simpel & overal)
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
  });

  // Kies juiste extensie voor dynamische imports
  const apiExt = process.env.NODE_ENV !== "production" ? ".ts" : ".js";
  const apiDir = path.resolve(process.cwd(), "api");

  // ------- API routes (compatibel met Vercel handlers) -------
  // Chat (generieke coach-chat)
  app.post("/api/chat", async (req, res) => {
    try {
      const mod = await import(path.join(apiDir, `chat${apiExt}`));
      return mod.default(req as any, res as any);
    } catch (err) {
      console.error("Chat handler error:", err);
      return res.status(500).json({ error: "Chat service unavailable" });
    }
  });

  // Coach (indien je deze nog gebruikt — anders deprecaten)
  app.post("/api/coach", async (req, res) => {
    try {
      const mod = await import(path.join(apiDir, `coach${apiExt}`));
      return mod.default(req as any, res as any);
    } catch (err) {
      console.error("Coach handler error:", err);
      return res.status(500).json({ error: "Coach service unavailable" });
    }
  });

  // Explain (opgave/poging + Gemini + TTS)
  app.post("/api/explain", async (req, res) => {
    try {
      const mod = await import(path.join(apiDir, `explain${apiExt}`));
      return mod.default(req as any, res as any);
    } catch (err) {
      console.error("Explain handler error:", err);
      return res.status(500).json({ error: "Explain service unavailable" });
    }
  });

  // Health
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: ["chat", "coach", "explain"],
      env: process.env.NODE_ENV,
    });
  });

  // ------- Frontend -------
  if (process.env.NODE_ENV !== "production") {
    // DEV: Vite middleware + serve echte client/index.html
    const { createServer: createViteServer } = await import("vite");
    const clientRoot = path.resolve(process.cwd(), "client");
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
      root: clientRoot,
      server: {
        middlewareMode: true,
        hmr: { server, overlay: false },
      },
    });

    app.use(vite.middlewares);

    // SPA fallback: lees de ECHTE index.html zodat manifest/icons kloppen
    app.get("*", async (req, res, next) => {
      try {
        if (req.originalUrl.startsWith("/api/")) return next();
        const indexPath = path.join(clientRoot, "index.html");
        let html = await fs.readFile(indexPath, "utf-8");     // <- echte index
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).setHeader("Content-Type", "text/html").end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace?.(e);
        next(e);
      }
    });
  } else {
    // PROD: statisch uit dist (zorg dat build daarheen schrijft)
    const dist = path.resolve(process.cwd(), "dist");
    app.use(express.static(dist));

    // SPA fallback (icons/manifest moeten in dist staan)
    app.get("*", (req, res) => {
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 8787;
  server.listen(port, () => {
    console.log(`[express] serving on port ${port}`);
    console.log(`[api] chat     -> /api/chat  (${apiExt})`);
    console.log(`[api] coach    -> /api/coach (${apiExt})`);
    console.log(`[api] explain  -> /api/explain (${apiExt})`);
  });
}

createAppServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
