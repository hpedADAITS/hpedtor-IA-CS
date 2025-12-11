# RAGIA

Servidor RAG minimo con Postgres + pgvector y un servicio de embeddings tipo OpenAI.

## Que hace
- Ingiere `.md`, `.txt` y `.pdf` desde `INGEST_PATH`, los divide en trozos de ~800 caracteres y guarda texto + embedding en Postgres.
- Expone `POST /rag` que calcula el embedding de la pregunta y devuelve los `TOP_K` fragmentos mas parecidos.
- Opcional: usa un modelo de texto (ej. `qwen3-4b-instruct-2507` en LM Studio) para generar una respuesta apoyada en esos fragmentos (sigue respondiendo con solo las fuentes si el modelo no esta disponible).
- No hay deduplicacion ni actualizacion incremental: cada ingesta vuelve a insertar todo tal cual.

## Requisitos
- Node 18+ (usa `fetch` nativo).
- Docker / Docker Compose para la base de datos con pgvector.
- Servicio de embeddings compatible con la API de OpenAI (`/v1/embeddings`). Se asume uso local con LM Studio (CLI `lms`); tambien sirve cualquier servidor que reciba `{ model, input }` y devuelva `{ data: [{ embedding: [...] }] }`.

## Puesta en marcha rapida
- Opcion automatizada (recomendada): `./launch.sh` (levanta Postgres, arranca LM Studio embeddings con `lms`, levanta un modelo de chat por defecto `qwen3-4b-instruct-2507` para generar respuestas, instala dependencias, ingesta y lanza la API). Requiere tener `lms`, `docker` y `npm` en el PATH.
- Si ya tienes un servidor de embeddings y no quieres que `launch.sh` compruebe/arranque LM Studio, ejecuta `./launch.sh -skip`.
- Manual:
  1) `cp .env.example .env` y ajusta las variables (ver detalle abajo).
  2) Levanta embeddings locales (ver seccion LM Studio) y deja `EMBEDDINGS_URL` apuntando a `http://localhost:<puerto>/v1/embeddings`.
  3) `docker compose up -d` para levantar Postgres con pgvector.
  4) `npm install`.
  5) Coloca tus documentos en `./data` (o en la ruta que definas en `INGEST_PATH`).
  6) `npm run ingestar` para indexar los archivos.
  7) `npm start` y consulta `POST /rag` con `{ "pregunta": "..." }`.

## Modo 100% local con LM Studio (CLI)
- Instala LM Studio y su CLI `lms` (ver docs oficiales de LM Studio). Asegurate de que `lms` este en tu PATH.
- Descarga o selecciona un modelo de embeddings soportado, ej. `nomic-embed-text-v1.5` (dimension 768).
- Arranca el servidor local de embeddings (OpenAI-compatible) con la CLI. Ejemplo:
  ```bash
  lms server start --model "nomic-embed-text-v1.5" --port 1234 --host 127.0.0.1
  ```
  El endpoint quedara en `http://localhost:1234/v1/embeddings`.
- `launch.sh` intenta arrancar ese servidor automaticamente si `START_LMS=true` y encuentra `lms` en el PATH. Variables utiles:
  - `START_LMS` (true/false): si true, usa `lms` y fuerza `EMBEDDINGS_URL` a `http://localhost:$LMS_PORT/v1/embeddings`.
  - `LMS_MODEL`: modelo de embeddings que cargara `lms` (default `nomic-embed-text-v1.5`).
  - `LMS_PORT`: puerto del servidor de LM Studio (default 1234).
  - `LMS_DISABLE_KV_OFFLOAD`: si `true`, arranca `lms` sin offload del KV cache a GPU (flag configurable con `LMS_KV_OFFLOAD_FLAG`, default `--gpu off`; ajusta si tu CLI usa otra sintaxis).
  - `LMS_START_CMD`: si tu version de `lms` usa otra sintaxis, define aqui el comando completo para arrancar el servidor (se ejecuta con `bash -c "exec <cmd>"`, no incluyas `&`).
  - `LMS_LOG_FILE`: ruta de logs del proceso `lms` (default `/tmp/lms-embeddings.log`).
- Para generar respuestas con contexto, `launch.sh` tambien puede arrancar un modelo de chat en LM Studio (default `qwen3-4b-instruct-2507` en el puerto 1235):
  - `START_LMS_QA` (true/false): si true, levanta LM Studio para texto y ajusta `LLM_URL` a `http://localhost:$LMS_QA_PORT/v1/chat/completions`.
  - `LMS_QA_MODEL`: modelo de texto a cargar (default `qwen3-4b-instruct-2507`).
  - `LMS_QA_PORT`: puerto para el servidor de chat (default 1235).
  - `LMS_QA_DISABLE_KV_OFFLOAD`: si `true`, arranca el modelo de chat sin offload del KV cache a GPU (flag configurable con `LMS_QA_KV_OFFLOAD_FLAG`, default `--gpu off`; ajusta si tu CLI usa otra sintaxis).
  - `LMS_QA_START_CMD` / `LMS_QA_LOG_FILE`: equivalentes a los de embeddings pero para el modelo de texto.
- Nota: cargar modelos grandes puede tardar mas de 30s; el script espera hasta ~2–3 minutos y muestra el tail del log si falla. Revisa `/tmp/lms-embeddings.log` y `/tmp/lms-qa.log` ante cualquier problema.
- Si prefieres iniciar LM Studio por tu cuenta (GUI o CLI), deja `START_LMS=false` y asegura que `EMBEDDINGS_URL` apunte al servidor local.

### Variables de entorno importantes
- `DATABASE_URL`: conexion a Postgres (se crea tabla e indice al volar).
- `EMBEDDINGS_URL`: endpoint del servidor de embeddings (por defecto `http://localhost:1234/v1/embeddings`).
- `EMBEDDINGS_MODEL`: nombre de modelo que entiende el servidor de embeddings (coincide con el cargado en LM Studio).
- `START_LMS`, `LMS_MODEL`, `LMS_PORT`, `LMS_START_CMD`, `LMS_LOG_FILE`: control de arranque automatico de LM Studio via CLI (ver arriba).
- `LMS_DISABLE_KV_OFFLOAD`: desactiva offload del KV cache a GPU en el modelo de embeddings (flag con `LMS_KV_OFFLOAD_FLAG`, default `--gpu off`).
- `LLM_URL`, `LLM_MODEL`, `LLM_API_KEY`: endpoint y modelo para generar la respuesta final (OpenAI compatible, default `http://localhost:1235/v1/chat/completions` con `qwen3-4b-instruct-2507` en LM Studio).
- `START_LMS_QA`, `LMS_QA_MODEL`, `LMS_QA_PORT`, `LMS_QA_START_CMD`, `LMS_QA_LOG_FILE`: control del servidor de texto en LM Studio.
- `LMS_QA_DISABLE_KV_OFFLOAD`: desactiva offload del KV cache a GPU en el modelo de texto (flag con `LMS_QA_KV_OFFLOAD_FLAG`, default `--gpu off`).
- `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`, `LLM_CONTEXT_CHARS`: limites y sampling para la llamada de chat.
- `EMBEDDINGS_DIM`: dimension del vector que devuelve el modelo (ej. 768).
- `INGEST_PATH`: ruta donde se buscan documentos (se recorre recursivamente).
- `TOP_K`: numero de fragmentos devueltos por `/rag`.
- `PORT`: puerto HTTP de la API.
- `CORS_ORIGINS`: origenes permitidos para el backend Express (por defecto `*`; en local puedes usar `http://localhost:3000,http://localhost:3001`).

### Indexar documentos (detalles)
- Formatos soportados: `.md`, `.txt`, `.pdf` (PDF via `pdf-parse`).
- Los trozos se generan con `src/utils/texto.js` (largo por defecto: 800). Si necesitas otro largo o solapamiento, ajustalo ahi.
- Cada trozo se guarda como `ruta#parte` para poder diferenciarlo; no hay deduplicacion ni actualizacion parcial.
- Reingestar despues de agregar/cambiar archivos: vuelve a correr `npm run ingestar`. Si quieres limpiar la tabla antes, puedes ejecutar `psql "$DATABASE_URL" -c 'truncate documentos;'` (destruye datos actuales).
- La ingesta ahora valida el servicio de embeddings antes de empezar, revisa la dimension esperada (`EMBEDDINGS_DIM`) y muestra un resumen al final (archivos, trozos, insertados). Si falla la llamada a embeddings, revisa que LM Studio este corriendo en el puerto y modelo configurados.

### Consultar la API
- Healthcheck: `GET /ping` devuelve `{ ok: true }`.
- Preguntas: `POST /rag` con body `{ "pregunta": "que es ...?" }`.
- Ejemplo rapida:
  ```bash
  curl -X POST http://localhost:3000/rag \
    -H 'Content-Type: application/json' \
    -d '{ "pregunta": "Que documentos hablan de X?" }'
  ```
  Respuesta: `{ "resultados": [ { "ruta": "data/doc.md#0", "contenido": "...", "score": 0.87 }, ... ] }`.

### Desarrollo y pruebas
- Servidor en caliente: `npm run dev` (nodemon).
- Tests unitarios (Jest + Supertest): `npm test`.

### Frontend Next.js (UI local)
- Ubicacion: `web/` (Next.js 14, app router). Usa `NEXT_PUBLIC_API_URL` para apuntar al backend (`web/.env.local.example` trae default `http://localhost:3000`).
- Setup: `cd web && npm install`.
- Desarrollo: `npm run dev` (escucha en http://localhost:3001 para no chocar con el backend).
- Produccion: `npm run build && npm run start` (puedes cambiar puerto con `-p` en los scripts).
- Tambien puedes usar scripts desde la raiz: `npm run web:dev`, `npm run web:build`, `npm run web:start`.

### Solucion de problemas rapida
- Verifica Postgres: `docker compose ps` y `docker compose logs db`.
- Verifica embeddings: `curl $EMBEDDINGS_URL -H 'Content-Type: application/json' -d '{\"model\":\"$EMBEDDINGS_MODEL\",\"input\":\"hola\"}'`.
- Logs de ingesta muestran cada `guardado <ruta> parte <n>`; si no ves nada, revisa `INGEST_PATH` y permisos de archivos.
- Si `launch.sh` arranco `lms`, revisa los logs en `/tmp/lms-embeddings.log` (o en `LMS_LOG_FILE`) si el endpoint de embeddings no responde.
