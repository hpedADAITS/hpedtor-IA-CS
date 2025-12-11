"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

const formatScore = (score) => {
  if (typeof score !== "number") return "s/n";
  return score.toFixed(3);
};

const createAnswerText = (resultados = []) => {
  if (!Array.isArray(resultados) || resultados.length === 0) {
    return "No se devolvieron resultados.";
  }
  return resultados
    .map((r, i) => {
      const ruta = r.ruta || `doc-${i + 1}`;
      const score = formatScore(r.score);
      const contenido = (r.contenido || "").trim();
      return `${i + 1}) ${ruta}  (score ${score})\n${contenido}`;
    })
    .join("\n\n");
};

const Message = ({ message }) => {
  const role = message.role === "user" ? "user" : "bot";
  const isError = message.type === "error";
  const hasSources = Array.isArray(message.resultados) && message.resultados.length > 0;

  return (
    <div className={`bubble ${role} ${isError ? "error" : ""}`}>
      <span className="label">{role === "user" ? "Tu" : "RAG"}</span>
      {message.type === "answer" ? (
        <>
          <div className="answer-text">{message.respuesta || message.text}</div>
          {message.respuestaError ? <div className="note error-note">No se pudo generar respuesta automatica: {message.respuestaError}</div> : null}
          {hasSources ? (
            <>
              <div className="sources-title">Fuentes relevantes</div>
              <div className="results">
                {message.resultados.map((res, idx) => (
                  <div key={`${res.ruta || idx}-${idx}`} className="result-card">
                    <div className="result-head">
                      <span>{res.ruta || `fragmento ${idx + 1}`}</span>
                      <span className="result-score">score {formatScore(res.score)}</span>
                    </div>
                    <div className="result-body">{res.contenido || "(sin contenido)"}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : message.type === "results" && hasSources ? (
        <div className="results">
          {message.resultados.map((res, idx) => (
            <div key={`${res.ruta || idx}-${idx}`} className="result-card">
              <div className="result-head">
                <span>{res.ruta || `fragmento ${idx + 1}`}</span>
                <span className="result-score">score {formatScore(res.score)}</span>
              </div>
              <div className="result-body">{res.contenido || "(sin contenido)"}</div>
            </div>
          ))}
        </div>
      ) : (
        <div>{message.text}</div>
      )}
    </div>
  );
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const listEndRef = useRef(null);

  const apiInfo = useMemo(
    () => ({
      base: API_BASE,
      ragEndpoint: `${API_BASE}/rag`,
    }),
    []
  );

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const pregunta = question.trim();
    if (!pregunta || sending) return;

    setBannerError("");
    setQuestion("");
    setSending(true);

    const userMessage = { id: crypto.randomUUID(), role: "user", text: pregunta, type: "text" };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch(apiInfo.ragEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText || "error en /rag"}`);
      }

      const data = await res.json();
      if (data?.error) {
        throw new Error(data.error);
      }

      const resultados = data?.resultados || [];
      const respuesta = data?.respuesta;
      const respuestaError = data?.respuestaError;
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        type: "answer",
        resultados,
        respuesta,
        respuestaError,
        text: createAnswerText(resultados),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        type: "error",
        text: err?.message || "Fallo al consultar /rag",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setBannerError("No se pudo consultar el backend. Verifica que el API RAG local este en marcha y accesible.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="page">
      <div className="hero">
        <div className="hero-copy">
          <div className="status">
            <span className="status-dot" />
            RAG local conectado a LM Studio
          </div>
          <div className="title">Interfaz RAGIA en Next.js</div>
          <div className="subtitle">
            Consulta tus documentos ingeridos en Postgres + pgvector con embeddings locales. El frontend se mantiene local; apunta al API en
            {` `}
            <code>{apiInfo.base}</code>.
          </div>
        </div>
      </div>

      <div className="card chat">
        {bannerError && <div className="banner error">{bannerError}</div>}
        <div className="messages">
          {messages.length === 0 ? <div className="empty">Carga documentos, ejecuta la ingesta y pregunta lo que necesites.</div> : null}
          {messages.map((m) => (
            <Message key={m.id} message={m} />
          ))}
          <div ref={listEndRef} />
        </div>

        <div className="input-row">
          <input
            type="text"
            placeholder="Ej. ¿Que PDF menciona las fechas de examen?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            disabled={sending}
          />
          <button className="btn" onClick={send} disabled={sending || !question.trim()}>
            {sending ? "Enviando..." : "Preguntar"}
          </button>
        </div>
      </div>
    </main>
  );
}
