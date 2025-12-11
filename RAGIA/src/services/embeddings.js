import { config } from "../config.js";

const buildBody = (input) => ({
  model: config.embeddingsModelo,
  input,
});

const parseVector = async (res) => {
  const datos = await res.json();
  const vector = datos?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error("respuesta de embeddings sin vector");
  }
  if (vector.length !== config.dimension) {
    throw new Error(`dimension de embedding inesperada: ${vector.length} != ${config.dimension}`);
  }
  return vector;
};

export const obtenerEmbedding = async (texto) => {
  const res = await fetch(config.embeddingsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildBody(texto)),
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`fallo al pedir embedding ${res.status}: ${detalle}`);
  }

  return parseVector(res);
};

export const probarEmbeddingsServicio = async (texto = "ping") => {
  const res = await fetch(config.embeddingsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildBody(texto)),
  });
  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`embeddings no responde: HTTP ${res.status} ${detalle}`);
  }
  return parseVector(res);
};
