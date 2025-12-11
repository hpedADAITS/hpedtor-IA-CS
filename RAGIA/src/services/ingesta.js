import fs from "fs/promises";
import path from "path";
import fg from "fast-glob";
import pdfParse from "pdf-parse";
import { config } from "../config.js";
import { obtenerEmbedding, probarEmbeddingsServicio } from "./embeddings.js";
import { guardarDocumento } from "../models/documentos.js";
import { partirEnTrozos } from "../utils/texto.js";

const patronesBusqueda = [
  () => path.join(config.rutaDatos, "**/*.md"),
  () => path.join(config.rutaDatos, "**/*.txt"),
  () => path.join(config.rutaDatos, "**/*.pdf"),
];

const leerContenido = async (ruta) => {
  const ext = path.extname(ruta).toLowerCase();
  if (ext === ".pdf") {
    const buffer = await fs.readFile(ruta);
    const pdf = await pdfParse(buffer);
    return pdf.text || "";
  }
  return fs.readFile(ruta, "utf8");
};

export const cargarArchivos = async () => {
  const patrones = patronesBusqueda.map((fn) => fn());
  return fg(patrones, { dot: false });
};

export const ingestarArchivos = async () => {
  console.log("verificando servicio de embeddings en", config.embeddingsUrl);
  await probarEmbeddingsServicio().catch((err) => {
    console.error("no se pudo contactar al servicio de embeddings:", err.message);
    throw err;
  });

  const archivos = await cargarArchivos();

  if (!archivos.length) {
    console.log("no hay archivos para indexar en", config.rutaDatos);
    return;
  }

  console.log("archivos detectados para ingesta:", archivos.length);
  let totalTrozos = 0;
  let totalInsertados = 0;

  for (const ruta of archivos) {
    console.log("procesando archivo:", ruta);
    const contenido = await leerContenido(ruta);
    const trozos = partirEnTrozos(contenido);
    console.log(`archivo ${ruta} dividido en ${trozos.length} trozos`);
    totalTrozos += trozos.length;

    for (let i = 0; i < trozos.length; i += 1) {
      const trozo = trozos[i];
      console.log(`obteniendo embedding para ${ruta} parte ${i} (longitud ${trozo.length} chars)...`);
      const embedding = await obtenerEmbedding(trozo);
      await guardarDocumento({
        ruta: `${ruta}#${i}`,
        contenido: trozo,
        embedding,
      });
      totalInsertados += 1;
      console.log("guardado", ruta, "parte", i);
    }
  }

  console.log(
    `ingesta finalizada -> archivos: ${archivos.length}, trozos: ${totalTrozos}, insertados: ${totalInsertados}`
  );
};
