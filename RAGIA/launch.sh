#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env"
SKIP_LMS_CHECK=false
DEFAULT_PORT=3000
DEFAULT_DB_URL="postgres://rag:rag@localhost:5432/rag"
DEFAULT_EMBEDDINGS_URL="http://localhost:1234/v1/embeddings"
DEFAULT_EMBEDDINGS_MODEL="nomic-embed-text-v1.5"
DEFAULT_START_LMS=true
DEFAULT_LMS_PORT=1234
DEFAULT_LMS_MODEL="$DEFAULT_EMBEDDINGS_MODEL"
DEFAULT_LMS_DISABLE_KV_OFFLOAD=false
DEFAULT_LMS_KV_OFFLOAD_FLAG="--gpu off"
DEFAULT_LMS_EXTRA_ARGS=""
DEFAULT_START_LMS_QA=true
DEFAULT_LMS_QA_PORT=1235
DEFAULT_LMS_QA_MODEL="qwen3-4b-instruct-2507"
DEFAULT_LMS_QA_DISABLE_KV_OFFLOAD=false
DEFAULT_LMS_QA_KV_OFFLOAD_FLAG="--gpu off"
DEFAULT_LMS_QA_EXTRA_ARGS=""
DEFAULT_LLM_URL="http://localhost:${DEFAULT_LMS_QA_PORT}/v1/chat/completions"
DEFAULT_LLM_MODEL="$DEFAULT_LMS_QA_MODEL"
DEFAULT_LLM_MAX_TOKENS=512
DEFAULT_LLM_TEMPERATURE=0.2
DEFAULT_LLM_CONTEXT_CHARS=1200
DEFAULT_INGEST_PATH="./data"
DEFAULT_TOP_K=4
DEFAULT_EMBEDDINGS_DIM=768
NPM_STAMP_FILE="$ROOT_DIR/node_modules/.install-stamp"
WAIT_EMBED_ATTEMPTS=120
WAIT_LLM_ATTEMPTS=180

log() {
  echo "[launch] $*"
}

log_tail() {
  local file="$1"
  if [ -f "$file" ]; then
    echo "[launch] ultimas lineas de $file:"
    tail -n 40 "$file"
  else
    echo "[launch] no se encontro log en $file"
  fi
}

cleanup() {
  for pid in ${LMS_PID:-} ${LMS_QA_PID:-}; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  local job_pids
  job_pids="$(jobs -p)"
  if [ -n "$job_pids" ]; then
    kill $job_pids 2>/dev/null || true
  fi
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    -skip|--skip-lms)
      SKIP_LMS_CHECK=true
      ;;
    *)
      echo "uso: $0 [-skip|--skip-lms]"
      exit 1
      ;;
  esac
  shift
done

command -v docker >/dev/null 2>&1 || { echo "docker no encontrado en PATH"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm no encontrado en PATH"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl no encontrado en PATH"; exit 1; }

COMPOSE_CMD="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi

if [ ! -f "$ENV_FILE" ]; then
  cat >"$ENV_FILE" <<EOF
PORT=$DEFAULT_PORT
DATABASE_URL=$DEFAULT_DB_URL
EMBEDDINGS_URL=$DEFAULT_EMBEDDINGS_URL
EMBEDDINGS_MODEL=$DEFAULT_EMBEDDINGS_MODEL
START_LMS=$DEFAULT_START_LMS
LMS_PORT=$DEFAULT_LMS_PORT
LMS_MODEL=$DEFAULT_LMS_MODEL
LMS_DISABLE_KV_OFFLOAD=$DEFAULT_LMS_DISABLE_KV_OFFLOAD
LMS_KV_OFFLOAD_FLAG=$DEFAULT_LMS_KV_OFFLOAD_FLAG
LMS_EXTRA_ARGS=$DEFAULT_LMS_EXTRA_ARGS
START_LMS_QA=$DEFAULT_START_LMS_QA
LMS_QA_PORT=$DEFAULT_LMS_QA_PORT
LMS_QA_MODEL=$DEFAULT_LMS_QA_MODEL
LMS_QA_DISABLE_KV_OFFLOAD=$DEFAULT_LMS_QA_DISABLE_KV_OFFLOAD
LMS_QA_KV_OFFLOAD_FLAG=$DEFAULT_LMS_QA_KV_OFFLOAD_FLAG
LMS_QA_EXTRA_ARGS=$DEFAULT_LMS_QA_EXTRA_ARGS
LLM_URL=$DEFAULT_LLM_URL
LLM_MODEL=$DEFAULT_LLM_MODEL
LLM_API_KEY=
LLM_MAX_TOKENS=$DEFAULT_LLM_MAX_TOKENS
LLM_TEMPERATURE=$DEFAULT_LLM_TEMPERATURE
LLM_CONTEXT_CHARS=$DEFAULT_LLM_CONTEXT_CHARS
LLM_ENABLED=true
INGEST_PATH=$DEFAULT_INGEST_PATH
TOP_K=$DEFAULT_TOP_K
EMBEDDINGS_DIM=$DEFAULT_EMBEDDINGS_DIM
EOF
  log "creado .env con valores por defecto; ajusta EMBEDDINGS_URL/EMBEDDINGS_MODEL si usas otro servicio."
fi

set -a
source "$ENV_FILE"
set +a

PORT=${PORT:-$DEFAULT_PORT}
DATABASE_URL=${DATABASE_URL:-$DEFAULT_DB_URL}
EMBEDDINGS_URL=${EMBEDDINGS_URL:-$DEFAULT_EMBEDDINGS_URL}
EMBEDDINGS_MODEL=${EMBEDDINGS_MODEL:-$DEFAULT_EMBEDDINGS_MODEL}
START_LMS=${START_LMS:-$DEFAULT_START_LMS}
LMS_PORT=${LMS_PORT:-$DEFAULT_LMS_PORT}
LMS_MODEL=${LMS_MODEL:-$DEFAULT_LMS_MODEL}
LMS_DISABLE_KV_OFFLOAD=${LMS_DISABLE_KV_OFFLOAD:-$DEFAULT_LMS_DISABLE_KV_OFFLOAD}
LMS_KV_OFFLOAD_FLAG=${LMS_KV_OFFLOAD_FLAG:-$DEFAULT_LMS_KV_OFFLOAD_FLAG}
LMS_EXTRA_ARGS=${LMS_EXTRA_ARGS:-$DEFAULT_LMS_EXTRA_ARGS}
EMBEDDINGS_MODEL=${EMBEDDINGS_MODEL:-$LMS_MODEL}
START_LMS_QA=${START_LMS_QA:-$DEFAULT_START_LMS_QA}
LMS_QA_PORT=${LMS_QA_PORT:-$DEFAULT_LMS_QA_PORT}
LMS_QA_MODEL=${LMS_QA_MODEL:-$DEFAULT_LMS_QA_MODEL}
LMS_QA_DISABLE_KV_OFFLOAD=${LMS_QA_DISABLE_KV_OFFLOAD:-$DEFAULT_LMS_QA_DISABLE_KV_OFFLOAD}
LMS_QA_KV_OFFLOAD_FLAG=${LMS_QA_KV_OFFLOAD_FLAG:-$DEFAULT_LMS_QA_KV_OFFLOAD_FLAG}
LMS_QA_EXTRA_ARGS=${LMS_QA_EXTRA_ARGS:-$DEFAULT_LMS_QA_EXTRA_ARGS}
LLM_URL=${LLM_URL:-$DEFAULT_LLM_URL}
LLM_MODEL=${LLM_MODEL:-$DEFAULT_LLM_MODEL}
LLM_API_KEY=${LLM_API_KEY:-}
LLM_MAX_TOKENS=${LLM_MAX_TOKENS:-$DEFAULT_LLM_MAX_TOKENS}
LLM_TEMPERATURE=${LLM_TEMPERATURE:-$DEFAULT_LLM_TEMPERATURE}
LLM_CONTEXT_CHARS=${LLM_CONTEXT_CHARS:-$DEFAULT_LLM_CONTEXT_CHARS}
LLM_ENABLED=${LLM_ENABLED:-true}
INGEST_PATH=${INGEST_PATH:-$DEFAULT_INGEST_PATH}
TOP_K=${TOP_K:-$DEFAULT_TOP_K}
EMBEDDINGS_DIM=${EMBEDDINGS_DIM:-$DEFAULT_EMBEDDINGS_DIM}
EMBEDDINGS_URL=${EMBEDDINGS_URL:-"http://localhost:${LMS_PORT}/v1/embeddings"}
LLM_URL=${LLM_URL:-"http://localhost:${LMS_QA_PORT}/v1/chat/completions"}
LLM_MODEL=${LLM_MODEL:-$LMS_QA_MODEL}
export PORT DATABASE_URL EMBEDDINGS_URL EMBEDDINGS_MODEL START_LMS LMS_PORT LMS_MODEL START_LMS_QA LMS_QA_PORT LMS_QA_MODEL LLM_URL LLM_MODEL LLM_API_KEY LLM_MAX_TOKENS LLM_TEMPERATURE LLM_CONTEXT_CHARS LLM_ENABLED INGEST_PATH TOP_K EMBEDDINGS_DIM

mkdir -p "$INGEST_PATH"

check_embeddings() {
  curl -sf -X POST "$EMBEDDINGS_URL" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$EMBEDDINGS_MODEL\",\"input\":\"ping\"}" >/dev/null 2>&1
}

check_llm() {
  local auth_header=()
  if [ -n "${LLM_API_KEY:-}" ]; then
    auth_header=(-H "Authorization: Bearer $LLM_API_KEY")
  fi
  curl -sf -X POST "$LLM_URL" \
    -H "Content-Type: application/json" \
    "${auth_header[@]}" \
    -d "{\"model\":\"$LLM_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":16}" >/dev/null 2>&1
}

if [ "$SKIP_LMS_CHECK" = true ]; then
  log "flag -skip/--skip-lms -> se omite chequeo/arranque automatico de LM Studio CLI."
  START_LMS=false
  START_LMS_QA=false
fi

if [ "$START_LMS" = true ] || [ "$START_LMS" = "1" ]; then
  if ! command -v lms >/dev/null 2>&1; then
    log "lms no encontrado en PATH; continuando sin embeddings automaticos. Asegúrate de que EMBEDDINGS_URL apunte a un servidor activo."
    START_LMS=false
  fi
fi

if [ "$START_LMS" = true ] || [ "$START_LMS" = "1" ]; then
  EMBEDDINGS_URL="http://localhost:${LMS_PORT}/v1/embeddings"
  EMBEDDINGS_MODEL=${LMS_MODEL:-$EMBEDDINGS_MODEL}
  export EMBEDDINGS_URL EMBEDDINGS_MODEL

  if check_embeddings; then
    log "servidor de embeddings ya responde en $EMBEDDINGS_URL; no se inicia otro proceso lms."
  else
    log "iniciando LM Studio CLI en puerto $LMS_PORT con modelo $LMS_MODEL..."
    LMS_CMD=${LMS_START_CMD:-}
    LOG_FILE="${LMS_LOG_FILE:-/tmp/lms-embeddings.log}"
    if [ -n "$LMS_CMD" ]; then
      if [ "$LMS_DISABLE_KV_OFFLOAD" = true ] || [ "$LMS_DISABLE_KV_OFFLOAD" = "1" ]; then
        log "LMS_DISABLE_KV_OFFLOAD=true (no se agrega flag porque usas LMS_START_CMD)."
      fi
      log "usando LMS_START_CMD personalizado: $LMS_CMD"
      bash -c "exec $LMS_CMD" >"$LOG_FILE" 2>&1 &
    else
      extra_args=()
      if [ "$LMS_DISABLE_KV_OFFLOAD" = true ] || [ "$LMS_DISABLE_KV_OFFLOAD" = "1" ]; then
        kv_flag="${LMS_KV_OFFLOAD_FLAG:-$DEFAULT_LMS_KV_OFFLOAD_FLAG}"
        if [ -n "$kv_flag" ]; then
          log "LMS_DISABLE_KV_OFFLOAD=true -> arrancando embeddings sin offload de KV cache (flag: ${kv_flag})."
          extra_args+=("$kv_flag")
        else
          log "LMS_DISABLE_KV_OFFLOAD=true pero LMS_KV_OFFLOAD_FLAG esta vacio; agrega el flag correcto segun tu version de 'lms' (ej. --no-offload-kv-cache)."
        fi
      fi
      if [ -n "$LMS_EXTRA_ARGS" ]; then
        log "agregando LMS_EXTRA_ARGS al comando embeddings: $LMS_EXTRA_ARGS"
        read -r -a extra_from_env <<<"$LMS_EXTRA_ARGS"
        extra_args+=("${extra_from_env[@]}")
      fi
      log "lanzando embeddings con comando por defecto: lms server start --model \"$LMS_MODEL\" --port \"$LMS_PORT\" --host 127.0.0.1 ${extra_args[*]}"
      lms server start --model "$LMS_MODEL" --port "$LMS_PORT" --host 127.0.0.1 "${extra_args[@]}" >"$LOG_FILE" 2>&1 &
    fi
    LMS_PID=$!
    for attempt in $(seq 1 "$WAIT_EMBED_ATTEMPTS"); do
      if check_embeddings; then
        log "LM Studio embeddings listo en $EMBEDDINGS_URL (logs: $LOG_FILE)."
        break
      fi
      if [ $((attempt % 10)) -eq 0 ]; then
        log "esperando embeddings... intento $attempt/$WAIT_EMBED_ATTEMPTS"
      fi
      sleep 1
    done
    if ! check_embeddings; then
      echo "LM Studio no respondio en $EMBEDDINGS_URL; revisa logs en $LOG_FILE"
      log_tail "$LOG_FILE"
      exit 1
    fi
  fi
else
  log "START_LMS=false -> se asume que ya tienes un servidor de embeddings en $EMBEDDINGS_URL"
fi

if [ "$START_LMS_QA" = true ] || [ "$START_LMS_QA" = "1" ]; then
  if ! command -v lms >/dev/null 2>&1; then
    log "lms no encontrado en PATH; continuando sin LLM automatico. Asegúrate de que LLM_URL apunte a un servidor activo."
    START_LMS_QA=false
  fi
fi

if [ "$START_LMS_QA" = true ] || [ "$START_LMS_QA" = "1" ]; then
  LLM_URL="http://localhost:${LMS_QA_PORT}/v1/chat/completions"
  LLM_MODEL=${LMS_QA_MODEL:-$LLM_MODEL}
  export LLM_URL LLM_MODEL

  if check_llm; then
    log "servidor LLM ya responde en $LLM_URL; no se inicia otro proceso lms (qa)."
  else
    log "iniciando LM Studio CLI para respuestas en puerto $LMS_QA_PORT con modelo $LMS_QA_MODEL..."
    LMS_QA_CMD=${LMS_QA_START_CMD:-}
    LMS_QA_LOG_FILE="${LMS_QA_LOG_FILE:-/tmp/lms-qa.log}"
      extra_qa_args=()
      if [ "$LMS_QA_DISABLE_KV_OFFLOAD" = true ] || [ "$LMS_QA_DISABLE_KV_OFFLOAD" = "1" ]; then
        kv_flag="${LMS_QA_KV_OFFLOAD_FLAG:-$DEFAULT_LMS_QA_KV_OFFLOAD_FLAG}"
        if [ -n "$kv_flag" ]; then
          log "LMS_QA_DISABLE_KV_OFFLOAD=true -> arrancando modelo de texto sin offload de KV cache (flag: ${kv_flag})."
          extra_qa_args+=("$kv_flag")
        else
          log "LMS_QA_DISABLE_KV_OFFLOAD=true pero LMS_QA_KV_OFFLOAD_FLAG esta vacio; agrega el flag correcto segun tu version de 'lms' (ej. --gpu off)."
        fi
      fi
      if [ -n "$LMS_QA_EXTRA_ARGS" ]; then
        log "agregando LMS_QA_EXTRA_ARGS al comando QA: $LMS_QA_EXTRA_ARGS"
        read -r -a extra_qa_from_env <<<"$LMS_QA_EXTRA_ARGS"
        extra_qa_args+=("${extra_qa_from_env[@]}")
      fi

      if [ -n "$LMS_QA_CMD" ]; then
        log "usando LMS_QA_START_CMD personalizado: $LMS_QA_CMD"
        bash -c "exec $LMS_QA_CMD" >"$LMS_QA_LOG_FILE" 2>&1 &
      else
        LMS_QA_CMD_FALLBACK="lms server start --model \"$LMS_QA_MODEL\" --port \"$LMS_QA_PORT\" --host 127.0.0.1"
        log "lanzando modelo QA con comando por defecto: $LMS_QA_CMD_FALLBACK ${extra_qa_args[*]}"
        bash -c "exec $LMS_QA_CMD_FALLBACK ${extra_qa_args[*]}" >"$LMS_QA_LOG_FILE" 2>&1 &
      fi
    LMS_QA_PID=$!
    for attempt in $(seq 1 "$WAIT_LLM_ATTEMPTS"); do
      if check_llm; then
        log "LM Studio listo para generar respuestas en $LLM_URL (logs: $LMS_QA_LOG_FILE)."
        break
      fi
      if [ $((attempt % 10)) -eq 0 ]; then
        log "esperando LLM (QA)... intento $attempt/$WAIT_LLM_ATTEMPTS"
      fi
      sleep 1
    done
    if ! check_llm; then
      echo "LM Studio (qa) no respondio en $LLM_URL; revisa logs en $LMS_QA_LOG_FILE"
      log_tail "$LMS_QA_LOG_FILE"
      exit 1
    fi
  fi
else
  log "START_LMS_QA=false -> se asume que ya tienes un modelo de texto en $LLM_URL"
fi

log "levantando Postgres con pgvector..."
$COMPOSE_CMD up -d db

log "esperando a que Postgres acepte conexiones..."
for attempt in {1..30}; do
  if $COMPOSE_CMD exec -T db pg_isready -U rag -d rag >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! $COMPOSE_CMD exec -T db pg_isready -U rag -d rag >/dev/null 2>&1; then
  echo "Postgres no esta listo despues de esperar, revisa logs con '$COMPOSE_CMD logs db'"
  exit 1
fi

should_install_deps=false
if [ "${FORCE_NPM_INSTALL:-false}" = "true" ]; then
  log "FORCE_NPM_INSTALL=true -> reinstalando dependencias npm."
  should_install_deps=true
elif [ ! -d "node_modules" ]; then
  log "node_modules no existe; instalando dependencias npm..."
  should_install_deps=true
else
  lock_hash="$(sha256sum package-lock.json 2>/dev/null | awk '{print $1}')"
  stamp_hash="$(cat "$NPM_STAMP_FILE" 2>/dev/null || true)"
  if [ -z "$lock_hash" ] || [ "$lock_hash" != "$stamp_hash" ]; then
    log "package-lock.json cambio o falta stamp; instalando dependencias npm..."
    should_install_deps=true
  else
    log "dependencias npm ya presentes (hash lock coincide); omitiendo npm install (usa FORCE_NPM_INSTALL=true para forzar)."
  fi
fi

if [ "$should_install_deps" = true ]; then
  npm install
  sha256sum package-lock.json | awk '{print $1}' >"$NPM_STAMP_FILE"
fi

log "probando conexion a Postgres desde el host (DATABASE_URL=$DATABASE_URL)..."
if ! npm exec node -- --input-type=module - <<'NODE'; then
import { Pool } from "pg";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 4000,
});
await pool.query("select 1");
await pool.end();
NODE
  echo "[launch] no se pudo conectar a Postgres con DATABASE_URL=$DATABASE_URL"
  echo "[launch] revisa: 1) puerto 5432 expuesto (docker compose ps), 2) permisos para usar docker, 3) firewall, 4) si usas WSL, que Docker Desktop comparta 127.0.0.1."
  echo "[launch] tambien puedes probar: PGPASSWORD=rag psql -h 127.0.0.1 -p 5432 -U rag -d rag -c \"select 1\""
  exit 1
fi

should_ingest=true
existing_rows="$($COMPOSE_CMD exec -T db sh -c "psql -U rag -d rag -tAc \"select count(*) from documentos\"" 2>/dev/null || true)"
if [ -n "$existing_rows" ] && [[ "$existing_rows" =~ ^[0-9]+$ ]] && [ "$existing_rows" -gt 0 ] && [ "${FORCE_INGEST:-false}" != "true" ]; then
  log "la tabla documentos ya tiene $existing_rows filas; omitiendo ingesta (usa FORCE_INGEST=true para reingestar)."
  should_ingest=false
fi

if [ "${FORCE_INGEST:-false}" == "true" ]; then
  log "FORCE_INGEST=true -> ingesta forzada."
  should_ingest=true
fi

if [ "$should_ingest" = true ]; then
  if find "$INGEST_PATH" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" \) -print -quit | grep -q .; then
    log "encontrados archivos para ingestar en '$INGEST_PATH'."
  else
    log "no se encontraron .md/.txt/.pdf en '$INGEST_PATH'; la ingesta no hara nada."
  fi
fi

if [ "$should_ingest" = true ]; then
  log "ingestando archivos desde '$INGEST_PATH' (esto requiere que el servicio de embeddings este disponible en $EMBEDDINGS_URL)..."
  npm run ingestar
else
  log "ingesta saltada."
fi

log "iniciando API en puerto $PORT (Ctrl+C para detener)..."

# Open browser in background
(sleep 2; if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$PORT" 2>/dev/null || true
elif command -v open >/dev/null 2>&1; then
  open "http://localhost:$PORT" 2>/dev/null || true
elif command -v powershell >/dev/null 2>&1; then
  powershell -Command "Start-Process http://localhost:$PORT" 2>/dev/null || true
fi) &

# Start backend and web frontend in parallel

log "iniciando backend API y NextJS frontend..."
npm start &
BACKEND_PID=$!

cd "$ROOT_DIR/web"
npm run dev &
FRONTEND_PID=$!

wait
