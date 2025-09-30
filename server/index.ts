// server/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

// ✅ onze routes
import registerCoachRoute from "./api/coach";
import registerAsrRoute from "./api/asr";

const app = express();
const router = express.Router();

// ── middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ── health
router.get("/api/health", (_req, res) => res.json({ ok: true }));

// ── routes mounten
registerCoachRoute(router); // POST /api/coach
registerAsrRoute(router);   // POST /api/asr

// (als je nog andere routes had, laat die ook hier mounten)
// vb: registerChatRoute(router); registerExplainRoute(router); etc.

app.use(router);

// ── start server
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  console.log(`[express] serving on port ${port}`);
  console.log(`[api] coach    -> /api/coach (.ts)`);
  console.log(`[api] asr      -> /api/asr   (.ts)`);
});
