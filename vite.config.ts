import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import express from 'express';
import cors from 'cors';
// CORRECTIE: Pad aangepast om de 'client' map mee te nemen
import { handleCreateCourse } from './client/src/pages/api/courses'; 
import { handleChatRequest } from './client/src/pages/api/chat';

// Een Vite plugin die een Express server als middleware toevoegt
function expressApiPlugin() {
  const app = express();
  
  // Middleware om JSON-data en CORS te verwerken
  app.use(cors());
  app.use(express.json());

  // Definieer hier je API routes
  app.post('/api/courses', handleCreateCourse);
  app.post('/api/chat', handleChatRequest);

  return {
    name: 'express-server',
    configureServer(server: any) {
      server.middlewares.use(app);
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    expressApiPlugin(), // Voeg onze custom API server plugin toe
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID
      ? [ (await import("@replit/vite-plugin-cartographer")).cartographer() ]
      : []),
  ],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client/src"),
      "@shared": path.resolve(process.cwd(), "shared"),
      "@assets": path.resolve(process.cwd(), "attached_assets"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
  },
  base: "/",
  server: {
    fs: { strict: true, deny: ["**/.*"] },
    hmr: {
      overlay: false
    }
  },
});

