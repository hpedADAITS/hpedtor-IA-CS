import { consultarPregunta } from "../services/rag.js";

export const crearControladorRag = ({ servicioRag = consultarPregunta } = {}) => {
  const ping = (_req, res) => {
    res.json({ ok: true });
  };

  const rag = async (req, res) => {
    const { pregunta } = req.body || {};
    if (!pregunta) return res.status(400).json({ error: "falta campo pregunta" });

    try {
      const resp = await servicioRag(pregunta);
      const resultados = Array.isArray(resp) ? resp : resp?.resultados || [];
      const respuesta = resp?.respuesta || null;
      const respuestaError = resp?.respuestaError || null;
      return res.json({ resultados, respuesta, respuestaError });
    } catch (err) {
      console.error("error en /rag", err);
      return res.status(500).json({ error: "fallo en rag" });
    }
  };

  return { ping, rag };
};
