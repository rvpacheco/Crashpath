// Cortesía = pase de invitado. Cada socio con mensualidad o tiquetera tiene UNO
// para llevar a alguien. Se RENUEVA (no se acumula) cada vez que renueva el mes
// o compra una tiquetera nueva: el contador vuelve a 1 sin importar si usó la
// anterior, y vence junto con el acceso que la originó.
//
// Helpers PUROS (sin DB, sin next-auth) para poder testearlos aislados y para
// que el panel y los endpoints apliquen exactamente la misma regla.

/** Cuántas cortesías deja cada renovación/compra. No se acumulan. */
export const CORTESIAS_POR_CICLO = 1;

/** Vencimiento del acceso vigente del socio, según su modalidad. */
export function accesoEndDate(user) {
  if (!user) return null;
  const raw =
    user.accessType === "mensualidad"
      ? user.mensualidad?.endDate
      : user.tiquetera?.endDate;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Estado de la cortesía tal como se muestra en el panel y se valida al usarla.
 *
 * Regla única: se puede usar si queda saldo y la cortesía no venció. NO se
 * mira si al socio le quedan créditos: la cortesía es gratis y ya está pagada
 * con la tiquetera, así que gastar el último crédito no debe quitársela.
 *
 * `vence` en null (tiquetera sin vigencia cargada) NO cuenta como vencida:
 * el panel trackea y avisa, el admin decide — misma política que el resto.
 */
export function estadoCortesia(user, now = new Date()) {
  const c = user?.cortesia || {};
  const disponibles = Math.max(0, Number(c.disponibles ?? 0));
  const vence = c.vence ? new Date(c.vence) : null;
  const vencida = !!vence && !Number.isNaN(vence.getTime()) && vence < now;
  const usos = Array.isArray(c.usos) ? c.usos : [];

  return {
    disponible: disponibles > 0 && !vencida,
    disponibles,
    vencida: vencida && disponibles > 0, // "vencida" solo es relevante si había saldo
    vence: vence && !Number.isNaN(vence.getTime()) ? vence : null,
    otorgadaEn: c.otorgadaEn ? new Date(c.otorgadaEn) : null,
    usos,
    ultimoUso: usos.length ? usos[usos.length - 1] : null,
  };
}

/**
 * ¿Le toca la cortesía de arranque? La usa el reparto de una sola vez
 * (scripts/otorgar-cortesias.mjs), no el panel: de ahí en adelante la cortesía
 * se renueva sola con cada compra o renovación.
 *
 * Solo quien NUNCA ha tenido una y hoy tiene acceso vigente. Lo primero hace
 * el reparto idempotente: repetirlo no le devuelve la cortesía a quien ya la
 * gastó. Lo segundo evita que alguien nazca con una cortesía ya vencida.
 *
 * El script filtra lo mismo en Mongo para no traerse la colección entera; esta
 * función es la que manda y vuelve a pasar sobre el resultado.
 */
export function esElegibleParaCortesia(user, now = new Date()) {
  if (!user) return false;
  if (user.cortesia?.otorgadaEn) return false;
  if ((user.cortesia?.disponibles ?? 0) > 0) return false;

  if (user.accessType === "mensualidad") {
    const end = user.mensualidad?.endDate ? new Date(user.mensualidad.endDate) : null;
    return !!end && !Number.isNaN(end.getTime()) && end > now;
  }

  if (user.accessType === "ticketera") {
    if ((user.credits ?? 0) <= 0) return false;
    const end = user.tiquetera?.endDate ? new Date(user.tiquetera.endDate) : null;
    // Sin fecha cargada no se descarta: tiene créditos, puede entrar.
    return !end || Number.isNaN(end.getTime()) || end > now;
  }

  return false; // invitados y usuarios sin modalidad
}

/**
 * A qué cubo va un check-in para los KPIs del panel.
 *
 * Se decide por la VISITA antes que por la modalidad del usuario, y ese orden
 * es el punto: un `else` que asuma "si no es mensualidad, es tiquetera" mete
 * al invitado de cortesía —que no tiene modalidad— en el cubo que multiplica
 * por $15.000, y el panel reporta ingreso que nadie pagó.
 *
 * "otro" son los que no generan ingreso ni son cortesía: walk-ins viejos e
 * importados a medias, sin modalidad asignada. Cuentan como asistencia.
 *
 * Pase de día y voluntario también se leen de la visita: un socio de
 * mensualidad vencida que paga el día no es un check-in de mensualidad.
 */
export function clasificarCheckin(user, visit) {
  if (visit?.esCortesia) return "cortesia";
  if (visit?.esPaseDia) return "dia";
  if (visit?.esVoluntario) return "voluntario";
  if (user?.accessType === "mensualidad") return "mensualidad";
  if (user?.accessType === "ticketera") return "ticketera";
  return "otro";
}

/** Etiqueta corta para el badge del panel. */
export function labelCortesia(user, now = new Date()) {
  const st = estadoCortesia(user, now);
  if (st.disponible) return "🎟️ Cortesía disponible";
  if (st.vencida) return "🎟️ Cortesía vencida";
  if (st.ultimoUso) return "🎟️ Cortesía usada";
  return "🎟️ Sin cortesía";
}

/**
 * Otorga (o renueva) la cortesía del ciclo. Muta el usuario en sitio y devuelve
 * el subdocumento.
 *
 * Ojo: escribe campo por campo en vez de reasignar `user.cortesia`. El
 * subdocumento guarda `usos` (el historial de invitados) y asignarle un objeto
 * plano lo borraría — el mismo cuidado que en mensualidad-dates con `renewals`.
 */
export function otorgarCortesia(user, { vence = null, ts = new Date() } = {}) {
  if (!user) return null;
  if (!user.cortesia) user.cortesia = {};

  user.cortesia.disponibles = CORTESIAS_POR_CICLO;
  user.cortesia.otorgadaEn = ts;

  const v = vence ? new Date(vence) : null;
  user.cortesia.vence = v && !Number.isNaN(v.getTime()) ? v : null;

  return user.cortesia;
}

/** Deja la cortesía en cero (corrección manual del admin). */
export function quitarCortesia(user) {
  if (!user) return null;
  if (!user.cortesia) user.cortesia = {};
  user.cortesia.disponibles = 0;
  return user.cortesia;
}

/**
 * Sincroniza el vencimiento de la cortesía con el del acceso. Se llama desde
 * los editores manuales de fechas: si al socio le corren el vencimiento de la
 * mensualidad, su cortesía tiene que correrse igual. Solo toca la fecha cuando
 * hay saldo — no revive una cortesía ya usada.
 */
export function sincronizarVencimiento(user, endDate) {
  if (!user?.cortesia) return null;
  if ((user.cortesia.disponibles ?? 0) <= 0) return user.cortesia;
  const d = endDate ? new Date(endDate) : null;
  user.cortesia.vence = d && !Number.isNaN(d.getTime()) ? d : null;
  return user.cortesia;
}
