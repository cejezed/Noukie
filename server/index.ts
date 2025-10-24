import "dotenv/config";
import express from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";

// OCR deps (inline endpoint)
import multer from "multer";
import sharp from "sharp";
import Tesseract from "tesseract.js";

async function createAppServer() {
  const app = express();
  const server = createServer(app);

  // ------- Basics -------
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

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

  // Helper om handlers dynamisch te laden (compatibel met Vercel-style default export)
  const loadAndRun = async (name: string, req: any, res: any) => {
    try {
      const mod = await import(path.join(apiDir, `${name}${apiExt}`));
      if (typeof mod?.default === "function") {
        return mod.default(req, res);
      }
      return res.status(500).json({ error: `Handler ${name} heeft geen default export()` });
    } catch (err) {
      console.error(`${name} handler error:`, err);
      return res.status(500).json({ error: `${name} service unavailable` });
    }
  };

  // ------- API routes -------
  // Chat (generieke coach-chat)
  app.post("/api/chat", (req, res) => loadAndRun("chat", req, res));

  // Coach
  app.post("/api/coach", (req, res) => loadAndRun("coach", req, res));

  // Explain (opgave/poging + LLM + evt. TTS)
  app.post("/api/explain", (req, res) => loadAndRun("explain", req, res));

  // ASR (spraak → tekst) – dynamisch uit /api/asr
  app.post("/api/asr", (req, res) => loadAndRun("asr", req, res));

  // OCR (foto → tekst) – inline endpoint (direct in deze server)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    fileFilter: (_req, file, cb) => {
      const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
      cb(ok ? null : new Error("Ongeldig bestandsformaat (jpeg/png/webp)"), ok);
    },
  });

  app.post("/api/ocr", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Geen afbeelding ontvangen" });

      // Pre-process: auto-rotate, grayscale, normalize → betere OCR
      const preprocessed = await sharp(req.file.buffer)
        .rotate()
        .grayscale()
        .normalize()
        .toFormat("png")
        .toBuffer();

      // Nederlands + Engels (veel vaktermen zijn EN)
      const { data } = await Tesseract.recognize(preprocessed, "nld+eng");
      const text = (data.text || "").trim();

      return res.json({
        text,
        confidence: data.confidence,
        blocks: data.blocks?.length ?? 0,
        lines: data.lines?.length ?? 0,
      });
    } catch (err: any) {
      console.error("OCR error:", err);
      return res.status(500).json({ error: "OCR mislukt", details: err?.message });
    }
  });

  // Health
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: ["chat", "coach", "explain", "asr", "ocr"],
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
        let html = await fs.readFile(indexPath, "utf-8");
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
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`[express] serving on ${host}:${port}`);
    console.log(`[api] chat     -> /api/chat    (${apiExt})`);
    console.log(`[api] coach    -> /api/coach   (${apiExt})`);
    console.log(`[api] explain  -> /api/explain (${apiExt})`);
    console.log(`[api] asr      -> /api/asr     (${apiExt})`);
    console.log(`[api] ocr      -> /api/ocr     (inline)`);
  });
}

createAppServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
