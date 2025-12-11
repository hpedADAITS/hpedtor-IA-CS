import pool from "../db/index.js";
import { config } from "../config.js";

export const prepararTablaDocumentos = async () => {
  const cliente = await pool.connect();
  try {
    await cliente.query("create extension if not exists vector");
    await cliente.query(`
      create table if not exists documentos (
        id serial primary key,
        ruta text,
        contenido text,
        embedding vector(${config.dimension}),
        creado_en timestamp default now()
      )
    `);
    await cliente.query(`
      create index if not exists idx_documentos_vector
      on documentos using ivfflat (embedding vector_cosine_ops)
      with (lists = 100)
    `);
  } finally {
    cliente.release();
  }
};

export const guardarDocumento = async ({ ruta, contenido, embedding }) => {
  return pool.query(
    "insert into documentos (ruta, contenido, embedding) values ($1, $2, $3) returning id",
    [ruta, contenido, embedding]
  );
};

export const buscarDocumentosSimilares = async (embedding, limite) => {
  return pool.query(
    `select ruta, contenido, 1 - (embedding <=> $1) as score
     from documentos
     order by embedding <-> $1
     limit $2`,
    [embedding, limite]
  );
};
