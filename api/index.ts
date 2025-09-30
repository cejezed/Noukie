// api/index.ts
import express from "express";
import cors from "cors";
import { registerRoutes } from "../server/routes";

const app = express();

// CORS: alleen aanzetten als je het echt nodig hebt (bijv. lokale dev)
if (process.env.CORS_ENABLED === "1") {
  // Optioneel: stel toegestane origins in via env, komma-gescheiden
  const origins = process.env.CORS_ORIGIN?.split(",").map(s => s.trim());
  app.use(
    cors({
      origin: origins?.length ? origins : true, // true = reflect requesting origin
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
}

// Body parsing
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Jouw API-routes
registerRoutes(app);

export default app;
