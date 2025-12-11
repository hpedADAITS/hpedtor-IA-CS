import { obtenerEmbedding } from "./embeddings.js";
import { buscarDocumentosSimilares } from "../models/documentos.js";
import { config } from "../config.js";
import { generarRespuestaConFuentes } from "./llm.js";

export const consultarPregunta = async (pregunta) => {
  const embedding = await obtenerEmbedding(pregunta);
  const { rows } = await buscarDocumentosSimilares(embedding, config.topK);
  const resultados = rows || [];

  let respuesta = null;
  let respuestaError = null;
  if (config.llmEnabled && config.llmUrl) {
    try {
      respuesta = await generarRespuestaConFuentes(pregunta, resultados);
    } catch (err) {
      console.error("error generando respuesta con LLM", err);
      respuestaError = err.message;
    }
  }

  return { resultados, respuesta, respuestaError };
};
