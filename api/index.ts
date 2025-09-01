// /api/index.ts
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { registerRoutes } from "../server/routes"; // <— pad checken: waar jouw routes.ts staat

const app = express();

// Je zit straks same-origin (frontend + api op hetzelfde domein).
// CORS is dan eigenlijk niet nodig, maar kan geen kwaad:
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET","POST","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Registreer AL je bestaande endpoints
await registerRoutes(app);

// Export de Express app als Vercel serverless handler
export default app;
