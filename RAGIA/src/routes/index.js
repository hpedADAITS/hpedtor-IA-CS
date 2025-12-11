import { Router } from "express";
import { crearRouterRag } from "./rag.js";

export const registrarRutas = (app, deps = {}) => {
  const router = Router();
  router.use("/", crearRouterRag(deps));
  app.use(router);
};
