import { cargarApp } from "./loaders/index.js";

export const crearApp = (deps = {}) => cargarApp(deps);

export default crearApp;
