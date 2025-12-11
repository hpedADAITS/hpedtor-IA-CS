import dotenv from "dotenv";

dotenv.config();

const corsRaw = process.env.CORS_ORIGINS || "*";
const corsOrigins =
  corsRaw === "*"
    ? ["*"]
    : corsRaw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

export const config = {
  puerto: process.env.PORT || 3000,
  dbUrl: process.env.DATABASE_URL || "postgres://rag:rag@localhost:5432/rag",
  embeddingsUrl: process.env.EMBEDDINGS_URL || "http://localhost:1234/v1/embeddings",
  embeddingsModelo: process.env.EMBEDDINGS_MODEL || "nomic-embed-text-v1.5",
  llmUrl: process.env.LLM_URL || "http://localhost:1235/v1/chat/completions",
  llmModelo: process.env.LLM_MODEL || "qwen3-4b-instruct-2507",
  llmApiKey: process.env.LLM_API_KEY || "",
  llmMaxTokens: Number(process.env.LLM_MAX_TOKENS || 512),
  llmTemperature: Number(process.env.LLM_TEMPERATURE || 0.2),
  llmContextChars: Number(process.env.LLM_CONTEXT_CHARS || 1200),
  llmEnabled: (process.env.LLM_ENABLED || "true").toLowerCase() !== "false",
  rutaDatos: process.env.INGEST_PATH || "data",
  topK: Number(process.env.TOP_K || 4),
  dimension: Number(process.env.EMBEDDINGS_DIM || 768),
  corsOrigins,
};
