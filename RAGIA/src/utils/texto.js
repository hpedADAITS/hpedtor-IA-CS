export const partirEnTrozos = (texto, largo = 800) => {
  if (!texto) return [];
  const limpio = texto.replace(/\s+/g, " ").trim();
  const trozos = [];
  for (let i = 0; i < limpio.length; i += largo) {
    trozos.push(limpio.slice(i, i + largo));
  }
  return trozos;
};
