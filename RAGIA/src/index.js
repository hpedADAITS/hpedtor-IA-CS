import { crearApp } from "./app.js";
import { config } from "./config.js";
import { prepararTablaDocumentos } from "./models/documentos.js";

const iniciar = async () => {
  await prepararTablaDocumentos();
  const app = crearApp();
  app.listen(config.puerto, () => {
    console.log(`api rag escuchando en puerto ${config.puerto}`);
  });
};

iniciar().catch((err) => {
  console.error("no se pudo iniciar", err);
  process.exit(1);
});
