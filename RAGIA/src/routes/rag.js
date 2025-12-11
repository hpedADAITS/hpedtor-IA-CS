import { Router } from "express";
import { crearControladorRag } from "../controllers/rag.js";

export const crearRouterRag = (deps = {}) => {
  const ctrl = crearControladorRag(deps);
  const router = Router();

  router.get("/ping", ctrl.ping);
  router.post("/rag", ctrl.rag);

  return router;
};
