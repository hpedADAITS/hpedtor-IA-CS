import { jest } from "@jest/globals";
import { crearControladorRag } from "../../controllers/rag.js";

const crearRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe("controlador rag", () => {
  test("valida que exista pregunta", async () => {
    const servicioRag = jest.fn();
    const ctrl = crearControladorRag({ servicioRag });
    const res = crearRes();
    await ctrl.rag({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(servicioRag).not.toHaveBeenCalled();
  });

  test("devuelve resultados del servicio", async () => {
    const servicioRag = jest.fn().mockResolvedValue({ resultados: [{ ruta: "x" }], respuesta: "hola" });
    const ctrl = crearControladorRag({ servicioRag });
    const res = crearRes();
    await ctrl.rag({ body: { pregunta: "hola?" } }, res);
    expect(res.json).toHaveBeenCalledWith({ resultados: [{ ruta: "x" }], respuesta: "hola", respuestaError: null });
  });
});
