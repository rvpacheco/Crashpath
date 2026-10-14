// Inventario de lo que se vende en el mostrador (cubos de magnesio y cepillos).
//
// El stock NO se guarda como un número que se pisa: sale de sumar los
// movimientos (ventas, llegadas de mercancía y ajustes de conteo). Así cada
// unidad que falta tiene un responsable y una fecha, que es justamente lo que
// se quiere controlar ("¿quién vendió los cubos del sábado?").
//
// Puro: sin DB. El endpoint (pages/api/admin/inventario) y el panel lo
// importan, y los tests lo prueban sin Mongo.

export const PRODUCTOS = [
  {
    clave: "magnesio",
    nombre: "Cubo de magnesio",
    plural: "cubos de magnesio",
    emoji: "🧱",
    precio: 15000, // COP por unidad
    // Lo que paga un socio del muro. Producto sin precioSocio = no hay tarifa
    // de socio para él.
    precioSocio: 5000,
    // Lo que alguien escribiría en la barra de búsqueda para encontrarlo.
    alias: ["magnesio", "cubo", "cubos", "tiza", "chalk"],
  },
  {
    clave: "cepillo",
    nombre: "Cepillo",
    plural: "cepillos",
    emoji: "🪥",
    precio: 37000,
    alias: ["cepillo", "cepillos", "brush"],
  },
];

export const TIPOS = {
  VENTA: "venta",     // sale mercancía: la vendió quien está en el mostrador
  ENTRADA: "entrada", // llegó mercancía
  AJUSTE: "ajuste",   // se contó lo que hay en físico y se corrige el número
};

// Tope por movimiento. No limita el negocio: un pedido de 500 cubos se carga
// en dos veces. Evita que un "100" tipeado como "1000" descuadre todo.
export const MAX_CANTIDAD = 500;

/** $15.000 */
export function formatoPesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-CO")}`;
}

export function productoPorClave(clave) {
  return PRODUCTOS.find((p) => p.clave === clave) || null;
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Productos que coinciden con lo escrito en la barra de búsqueda.
 * Con menos de 3 letras no sugiere nada: "ca" o "cu" son el comienzo de
 * demasiados nombres de socios.
 */
export function buscarProductos(query) {
  const q = normalizar(query);
  if (q.length < 3) return [];
  const palabras = q.split(/\s+/);
  return PRODUCTOS.filter((p) =>
    p.alias.some((a) => palabras.some((w) => w.length >= 3 && (a.startsWith(w) || w.startsWith(a))))
  );
}

/** { magnesio: 12, cepillo: 4 } a partir de los movimientos. Siempre trae todas las claves. */
export function stockDesdeMovimientos(movimientos = []) {
  const stock = Object.fromEntries(PRODUCTOS.map((p) => [p.clave, 0]));
  for (const m of movimientos) {
    if (m && m.producto in stock && Number.isFinite(m.delta)) stock[m.producto] += m.delta;
  }
  return stock;
}

/**
 * Valida un movimiento y calcula cuánto mueve el stock.
 *
 * - venta y entrada piden `cantidad` (entero 1..MAX_CANTIDAD).
 * - ajuste pide `conteo`: lo que hay en físico (entero 0..). El delta es la
 *   diferencia con lo que dice el sistema.
 *
 * @returns {{ok: true, delta: number, cantidad: number} | {ok: false, code: string, message: string}}
 */
export function validarMovimiento({ tipo, producto, cantidad, conteo } = {}, stockActual = 0) {
  const prod = productoPorClave(producto);
  if (!prod) return { ok: false, code: "PRODUCTO_INVALIDO", message: "Producto desconocido." };

  if (tipo === TIPOS.AJUSTE) {
    // Number("") y Number(null) dan 0: sin este chequeo, un campo vacío
    // dejaría el stock en cero.
    const n = conteo === "" || conteo == null ? NaN : Number(conteo);
    if (!Number.isInteger(n) || n < 0 || n > 10000) {
      return { ok: false, code: "CONTEO_INVALIDO", message: "El conteo tiene que ser un número entero de 0 en adelante." };
    }
    const delta = n - stockActual;
    if (delta === 0) {
      return { ok: false, code: "SIN_CAMBIO", message: `El sistema ya dice ${n}. No hay nada que ajustar.` };
    }
    return { ok: true, delta, cantidad: Math.abs(delta) };
  }

  if (tipo !== TIPOS.VENTA && tipo !== TIPOS.ENTRADA) {
    return { ok: false, code: "TIPO_INVALIDO", message: "Tipo de movimiento inválido." };
  }

  const n = Number(cantidad);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CANTIDAD) {
    return { ok: false, code: "CANTIDAD_INVALIDA", message: `La cantidad tiene que ser un entero entre 1 y ${MAX_CANTIDAD}.` };
  }

  if (tipo === TIPOS.VENTA && n > stockActual) {
    // Se bloquea en vez de dejar el stock en negativo: un número negativo no
    // le dice a nadie qué pasó. Si en físico hay más, el conteo está mal y lo
    // corrige un admin con un ajuste, que queda registrado como tal.
    return {
      ok: false,
      code: "SIN_STOCK",
      message:
        stockActual > 0
          ? `El sistema dice que quedan ${stockActual} ${stockActual === 1 ? prod.nombre.toLowerCase() : prod.plural}. Si en físico hay más, un admin tiene que ajustar el conteo.`
          : `El sistema dice que no quedan ${prod.plural}. Si en físico hay, un admin tiene que ajustar el conteo.`,
    };
  }

  return { ok: true, delta: tipo === TIPOS.VENTA ? -n : n, cantidad: n };
}

export const TARIFAS = { NORMAL: "normal", SOCIO: "socio" };

/**
 * Precio de una venta según la tarifa. La de socio exige decir quién se lo
 * llevó: sin el nombre, un cubo a $5.000 no se puede distinguir de uno mal
 * cobrado.
 *
 * @returns {{ok: true, tarifa: string, precio: number} | {ok: false, code: string, message: string}}
 */
export function precioDeVenta({ producto, tarifa, nota } = {}) {
  const prod = productoPorClave(producto);
  if (!prod) return { ok: false, code: "PRODUCTO_INVALIDO", message: "Producto desconocido." };

  if (!tarifa || tarifa === TARIFAS.NORMAL) return { ok: true, tarifa: TARIFAS.NORMAL, precio: prod.precio };

  if (tarifa !== TARIFAS.SOCIO) return { ok: false, code: "TARIFA_INVALIDA", message: "Tarifa inválida." };
  if (prod.precioSocio == null) {
    return { ok: false, code: "SIN_PRECIO_SOCIO", message: `${prod.nombre} no tiene precio de socio.` };
  }
  if (!String(nota || "").trim()) {
    return { ok: false, code: "FALTA_QUIEN", message: "Con precio de socio hay que escribir quién se lo llevó." };
  }
  return { ok: true, tarifa: TARIFAS.SOCIO, precio: prod.precioSocio };
}

/** Texto para la auditoría y la lista de movimientos. */
export function resumenMovimiento({ tipo, producto, cantidad, delta, conteo, total, tarifa, nota }) {
  const prod = productoPorClave(producto);
  const nombre = (n) => (n === 1 ? prod?.nombre.toLowerCase() : prod?.plural) || producto;
  if (tipo === TIPOS.VENTA) {
    const socio = tarifa === TARIFAS.SOCIO ? `, precio socio${nota ? ` para ${nota}` : ""}` : "";
    return `Vendió ${cantidad} ${nombre(cantidad)}${total != null ? ` (${formatoPesos(total)}${socio})` : ""}`;
  }
  if (tipo === TIPOS.ENTRADA) return `Llegaron ${cantidad} ${nombre(cantidad)}`;
  const signo = delta > 0 ? `+${delta}` : String(delta);
  return `Ajuste de conteo de ${prod?.plural || producto}: quedan ${conteo} (${signo})`;
}
