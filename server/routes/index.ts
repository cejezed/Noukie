// server/routes/index.ts
import type { Express, Request, Response, NextFunction } from "express";
import { Router } from "express";
import http from "http";

// Subrouters
import tasksRouter from "./tasks";
import planRouter from "./plan"; // zorg dat server/routes/plan.ts bestaat

/**
 * Mount alle API-routes onder /api en geef de Node HTTP server terug.
 * Je hoofdserver roept deze functie aan: const server = await registerRoutes(app)
 */
export async function registerRoutes(app: Express) {
  const api = Router();

  // ---- API subroutes
  api.use("/tasks", tasksRouter);
  api.use("/plan", planRouter);

  // 404 voor onbekende /api routes
  api.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found", path: req.path });
  });

  // Router-level error handler (laatste in de router)
  api.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    res.status(status).json({ error: err?.message ?? "Internal Server Error" });
  });

  // Koppel /api aan de app
  app.use("/api", api);

  // Maak en retourneer de HTTP server (verwacht door server/index.ts)
  const server = http.createServer(app);
  return server;
}

export default registerRoutes;
