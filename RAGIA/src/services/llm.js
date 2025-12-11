import { config } from "../config.js";

const recortar = (texto = "", max = config.llmContextChars) => {
  const limpio = (texto || "").trim();
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, max)}...`;
};

const construirContexto = (documentos = []) =>
  documentos
    .map((doc, idx) => {
      const ruta = doc.ruta || `Fuente ${idx + 1}`;
      const contenido = recortar(doc.contenido || "");
      const score = typeof doc.score === "number" ? ` (score ${doc.score.toFixed(3)})` : "";
      return `Fuente ${idx + 1}: ${ruta}${score}\n${contenido}`;
    })
    .join("\n\n");

const construirMensajes = (pregunta, documentos) => {
  const contexto = construirContexto(documentos);
  const instrucciones = [
    "Eres un asistente que responde solo con la informacion del contexto.",
    "Si no hay datos suficientes en las fuentes, responde que no encontraste la informacion.",
    "Responde en español y cita las fuentes asi: (Fuente 1), (Fuente 2)...",
  ].join(" ");

  return [
    { role: "system", content: instrucciones },
    {
      role: "user",
      content: `Pregunta: ${pregunta}\n\nFuentes:\n${contexto}`,
    },
  ];
};

export const generarRespuestaConFuentes = async (pregunta, documentos = []) => {
  if (!config.llmEnabled) return null;
  if (!config.llmUrl || !config.llmModelo) {
    throw new Error("LLM_URL o LLM_MODEL no configurado");
  }

  const body = {
    model: config.llmModelo,
    messages: construirMensajes(pregunta, documentos),
    max_tokens: config.llmMaxTokens,
    temperature: config.llmTemperature,
  };

  const headers = { "Content-Type": "application/json" };
  if (config.llmApiKey) {
    headers.Authorization = `Bearer ${config.llmApiKey}`;
  }

  const res = await fetch(config.llmUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`LLM respondio ${res.status}: ${detalle}`);
  }

  const datos = await res.json();
  const contenido = datos?.choices?.[0]?.message?.content;
  if (!contenido) {
    throw new Error("LLM respondio sin mensaje");
  }
  return contenido.trim();
};
