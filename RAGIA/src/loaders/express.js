import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const crearServidorExpress = () => {
  const app = express();
  const corsOrigin =
    Array.isArray(config.corsOrigins) && config.corsOrigins.length ? config.corsOrigins : "*";
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());
  
  // Serve static files from root directory
  const rootDir = join(__dirname, "..", "..");
  app.use(express.static(rootDir));
  
  return app;
};
