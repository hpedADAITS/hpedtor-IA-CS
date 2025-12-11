import { crearServidorExpress } from "./express.js";
import { registrarRutas } from "../routes/index.js";

export const cargarApp = (deps = {}) => {
  const app = crearServidorExpress();
  registrarRutas(app, deps);
  return app;
};
