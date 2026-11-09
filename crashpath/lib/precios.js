// Tarifas del muro, en pesos. Las usa el mostrador para dejar anotado cuánto
// entró con cada cobro (pase de día, tiquetera, mensualidad) y el dashboard
// de ingresos para sumar. Puro: sin DB.
//
// Los textos del landing (lib/landingCopy.js) repiten estos números a mano;
// un test avisa si se descuadran.

export const PRECIOS = {
  DIA: 20000,                 // pase de día sin zapatos
  DIA_ZAPATOS: 30000,         // pase de día con alquiler de pies de gato
  TIQUETERA: 120000,          // 8 entradas
  TIQUETERA_USOS: 8,
  MENSUALIDAD: 120000,        // por mes
  MENSUALIDAD_ZAPATOS: 150000, // por mes, con pies de gato incluidos
};

/** Lo que vale una entrada de tiquetera ($15.000). */
export const PRECIO_CREDITO = PRECIOS.TIQUETERA / PRECIOS.TIQUETERA_USOS;

export function precioDia(zapatos = false) {
  return zapatos ? PRECIOS.DIA_ZAPATOS : PRECIOS.DIA;
}

/** Venta de tiquetera: 8 créditos = $120.000; otra cantidad, proporcional. */
export function precioTiquetera(creditos = PRECIOS.TIQUETERA_USOS) {
  const n = Number(creditos);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * PRECIO_CREDITO);
}

export function precioMensualidad(meses = 1, zapatos = false) {
  const n = Number(meses);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n * (zapatos ? PRECIOS.MENSUALIDAD_ZAPATOS : PRECIOS.MENSUALIDAD);
}

/** "$30.000" */
export function pesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-CO")}`;
}
