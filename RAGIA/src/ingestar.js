import { prepararTablaDocumentos } from "./models/documentos.js";
import { ingestarArchivos } from "./services/ingesta.js";

const main = async () => {
  await prepararTablaDocumentos();
  await ingestarArchivos();
};

main().catch((err) => {
  console.error("fallo al ingerir", err);
  process.exit(1);
});
