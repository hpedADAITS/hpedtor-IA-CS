import request from "supertest";
import { jest } from "@jest/globals";
import { crearApp } from "../../app.js";

const crearAppConStub = (respuesta, falla = false) => {
  const servicioRag = falla
    ? jest.fn().mockRejectedValue(new Error("boom"))
    : jest.fn().mockResolvedValue(respuesta);

  const app = crearApp({ servicioRag });
  return { app, servicioRag };
};

describe("rutas rag", () => {
  test("GET /ping responde ok", async () => {
    const { app } = crearAppConStub({ resultados: [] });
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test("POST /rag valida body", async () => {
    const { app, servicioRag } = crearAppConStub({ resultados: [] });
    const res = await request(app).post("/rag").send({});
    expect(res.status).toBe(400);
    expect(servicioRag).not.toHaveBeenCalled();
  });

  test("POST /rag devuelve resultados", async () => {
    const mockResp = { resultados: [{ ruta: "a", contenido: "b", score: 0.9 }], respuesta: "hola" };
    const { app, servicioRag } = crearAppConStub(mockResp);
    const res = await request(app).post("/rag").send({ pregunta: "hola?" });
    expect(res.status).toBe(200);
    expect(res.body.resultados).toEqual(mockResp.resultados);
    expect(res.body.respuesta).toBe("hola");
    expect(servicioRag).toHaveBeenCalledTimes(1);
  });

  test("POST /rag maneja errores del servicio", async () => {
    const { app } = crearAppConStub([], true);
    const res = await request(app).post("/rag").send({ pregunta: "hola?" });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("fallo en rag");
  });
});
