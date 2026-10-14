// Inventario del mostrador: el modal con el stock y los movimientos, y la
// tarjeta de venta rápida que aparece al buscar "magnesio" o "cepillo" en la
// barra del panel.
//
// Vive fuera de pages/admin.js a propósito: el panel es un solo componente
// enorme y cada setState lo re-renderiza entero (ver PROGRESO.md). El estado
// del inventario queda acá adentro y no lo toca.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import styled from "styled-components";
import { PRODUCTOS, TIPOS, TARIFAS, productoPorClave, formatoPesos } from "@/lib/inventario";

const c = {
  text: "#1A1A1A",
  textLight: "#757575",
  border: "#E0E0E0",
  accent: "#0066CC",
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#F59E0B",
  bg: "#F5F5F5",
};

// Con esto o menos el número se pinta en naranja: hay que pedir.
const STOCK_BAJO = 3;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
`;

const Modal = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 12px;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  z-index: 1000;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  color: ${c.text};
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
`;

const StockGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
`;

const StockCard = styled.div`
  border: 1px solid ${c.border};
  border-radius: 10px;
  padding: 14px;
  background: white;
`;

const StockNum = styled.div`
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  color: ${(p) => (p.$bajo ? c.warning : c.text)};
`;

const Small = styled.div`
  font-size: 13px;
  color: ${c.textLight};
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const NumInput = styled.input`
  width: 72px;
  padding: 8px;
  border: 1px solid ${c.border};
  border-radius: 6px;
  font-size: 15px;
`;

const TextInput = styled.input`
  flex: 1;
  min-width: 140px;
  padding: 8px;
  border: 1px solid ${c.border};
  border-radius: 6px;
  font-size: 14px;
`;

const Sel = styled.select`
  padding: 8px;
  border: 1px solid ${c.border};
  border-radius: 6px;
  font-size: 14px;
  background: white;
`;

const Btn = styled.button`
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: ${(p) => (p.$secondary ? `1px solid ${c.border}` : "none")};
  background: ${(p) => (p.$secondary ? "transparent" : p.$success ? c.success : c.accent)};
  color: ${(p) => (p.$secondary ? c.text : "white")};
  white-space: nowrap;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Msg = styled.div`
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 14px;
  background: ${(p) => (p.$ok ? "#F0FDF4" : "#FEF2F2")};
  color: ${(p) => (p.$ok ? "#166534" : "#991B1B")};
  border: 1px solid ${(p) => (p.$ok ? "#BBF7D0" : "#FECACA")};
`;

const Section = styled.div`
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid ${c.border};
`;

const SectionTitle = styled.div`
  font-weight: 600;
  margin-bottom: 8px;
`;

const MovRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid ${c.border};
  font-size: 14px;
`;

const QuickCard = styled.div`
  margin: 0 32px 12px;
  padding: 12px 16px;
  border: 1px solid #BFDBFE;
  background: #EFF6FF;
  border-radius: 10px;
  color: ${c.text};
  @media (max-width: 768px) {
    margin: 0 16px 12px;
  }
`;

function nombreCantidad(clave, n) {
  const p = productoPorClave(clave);
  if (!p) return `${n} ${clave}`;
  return `${n} ${n === 1 ? p.nombre.toLowerCase() : p.plural}`;
}

function fechaCorta(d) {
  try {
    return new Date(d).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function textoMovimiento(m) {
  if (m.tipo === TIPOS.VENTA) {
    return `Venta de ${nombreCantidad(m.producto, m.cantidad)}${m.total != null ? ` · ${formatoPesos(m.total)}` : ""}${
      m.tarifa === TARIFAS.SOCIO ? " (socio)" : ""
    }`;
  }
  if (m.tipo === TIPOS.ENTRADA) return `Llegaron ${nombreCantidad(m.producto, m.cantidad)}`;
  const p = productoPorClave(m.producto);
  return `Ajuste de ${p?.plural || m.producto}: quedan ${m.conteo} (${m.delta > 0 ? "+" : ""}${m.delta})`;
}

function useInventario(activo) {
  const [stock, setStock] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const res = await axios.get("/api/admin/inventario");
      setStock(res.data?.stock || null);
      setMovimientos(Array.isArray(res.data?.movimientos) ? res.data.movimientos : []);
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo cargar el inventario.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (activo) cargar();
  }, [activo, cargar]);

  // Después de registrar: el POST ya devuelve el stock nuevo, se aplica sin
  // esperar otro GET.
  const aplicar = useCallback((data) => {
    if (data?.stock) setStock(data.stock);
    if (data?.movimiento) setMovimientos((prev) => [data.movimiento, ...prev].slice(0, 50));
  }, []);

  return { stock, movimientos, cargando, error, cargar, aplicar };
}

function useRegistrar(aplicar, onAuditEvent) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, texto }

  const registrar = async (body) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await axios.post("/api/admin/inventario", body);
      aplicar(res.data);
      onAuditEvent?.(res.data?.auditEvent);
      setMsg({ ok: true, texto: res.data?.message || "Registrado." });
      return true;
    } catch (e) {
      setMsg({ ok: false, texto: e?.response?.data?.message || "No se pudo registrar." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, msg, setMsg, registrar };
}

/** Cantidad + botón "Vender". Quién vende lo pone el servidor desde la sesión. */
function Vender({ clave, disponible, busy, onVender }) {
  const prod = productoPorClave(clave);
  const [cant, setCant] = useState(1);
  const [socio, setSocio] = useState(false);
  const [nota, setNota] = useState("");
  const faltaQuien = socio && !nota.trim();
  const precio = socio ? prod?.precioSocio : prod?.precio;

  return (
    <div style={{ marginTop: 10 }}>
      {prod?.precioSocio != null && (
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, marginBottom: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={socio} onChange={(e) => setSocio(e.target.checked)} />
          Precio socio
        </label>
      )}
      <Row>
        <NumInput
          type="number"
          min={1}
          value={cant}
          onChange={(e) => setCant(e.target.value)}
          aria-label="Cantidad"
        />
        <TextInput
          placeholder={socio ? "¿Quién se lo lleva? (obligatorio)" : "Nota (opcional)"}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          style={faltaQuien ? { borderColor: c.warning } : undefined}
        />
      </Row>
      <Row style={{ marginTop: 6 }}>
        <Btn
          $success
          disabled={busy || disponible <= 0 || faltaQuien}
          onClick={async () => {
            const ok = await onVender({
              tipo: TIPOS.VENTA,
              producto: clave,
              cantidad: Number(cant),
              tarifa: socio ? TARIFAS.SOCIO : TARIFAS.NORMAL,
              nota: nota.trim(),
            });
            if (ok) {
              setCant(1);
              setSocio(false);
              setNota("");
            }
          }}
        >
          {busy ? "Guardando..." : "Registrar venta"}
        </Btn>
        {Number(cant) > 0 && precio != null && (
          <Small as="span">Total: {formatoPesos(precio * Number(cant))}</Small>
        )}
      </Row>
    </div>
  );
}

/** Llegada de mercancía y ajuste de conteo. Solo admin. */
function Gestionar({ busy, onRegistrar, stock }) {
  const [producto, setProducto] = useState(PRODUCTOS[0].clave);
  const [tipo, setTipo] = useState(TIPOS.ENTRADA);
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");

  const enviar = async () => {
    const body =
      tipo === TIPOS.AJUSTE
        ? { tipo, producto, conteo: Number(valor), nota }
        : { tipo, producto, cantidad: Number(valor), nota };
    if (tipo === TIPOS.AJUSTE) {
      const antes = stock?.[producto] ?? 0;
      if (!window.confirm(`El sistema dice ${antes}. ¿Dejarlo en ${valor}?`)) return;
    }
    const ok = await onRegistrar(body);
    if (ok) {
      setValor("");
      setNota("");
    }
  };

  return (
    <Section>
      <SectionTitle>Cargar mercancía o corregir el conteo</SectionTitle>
      <Row>
        <Sel value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value={TIPOS.ENTRADA}>Llegó mercancía</option>
          <option value={TIPOS.AJUSTE}>Conté y hay…</option>
        </Sel>
        <Sel value={producto} onChange={(e) => setProducto(e.target.value)}>
          {PRODUCTOS.map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.nombre}
            </option>
          ))}
        </Sel>
        <NumInput
          type="number"
          min={0}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={tipo === TIPOS.AJUSTE ? "hay" : "cant."}
        />
      </Row>
      <Row style={{ marginTop: 8 }}>
        <TextInput
          placeholder="Nota (opcional): proveedor, por qué el ajuste…"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <Btn disabled={busy || valor === ""} onClick={enviar}>
          {busy ? "Guardando..." : "Guardar"}
        </Btn>
      </Row>
      <Small style={{ marginTop: 6 }}>
        “Conté y hay” es para cuando lo que hay en físico no coincide con el sistema. Queda
        registrado como ajuste con tu nombre.
      </Small>
    </Section>
  );
}

export function InventarioModal({ open, onClose, puedeGestionar, onAuditEvent }) {
  const { stock, movimientos, cargando, error, aplicar } = useInventario(open);
  const { busy, msg, setMsg, registrar } = useRegistrar(aplicar, onAuditEvent);

  useEffect(() => {
    if (open) setMsg(null);
  }, [open, setMsg]);

  if (!open) return null;

  return (
    <>
      <Overlay onClick={() => !busy && onClose()} />
      <Modal role="dialog" aria-label="Inventario">
        <Title>📦 Inventario</Title>

        {error && <Msg>{error}</Msg>}
        {cargando && !stock ? (
          <Small>Cargando...</Small>
        ) : (
          <StockGrid>
            {PRODUCTOS.map((p) => {
              const n = stock?.[p.clave] ?? 0;
              return (
                <StockCard key={p.clave}>
                  <Small>
                    {p.emoji} {p.nombre} · {formatoPesos(p.precio)}
                  </Small>
                  <StockNum $bajo={n <= STOCK_BAJO}>{n}</StockNum>
                  <Small>{n <= STOCK_BAJO ? "quedan pocos, hay que pedir" : "en stock"}</Small>
                  <Vender clave={p.clave} disponible={n} busy={busy} onVender={registrar} />
                </StockCard>
              );
            })}
          </StockGrid>
        )}

        {msg && <Msg $ok={msg.ok}>{msg.texto}</Msg>}

        {puedeGestionar && <Gestionar busy={busy} onRegistrar={registrar} stock={stock} />}

        <Section>
          <SectionTitle>Últimos movimientos</SectionTitle>
          {movimientos.length === 0 ? (
            <Small>
              Todavía no hay movimientos.
              {puedeGestionar ? " Empezá cargando lo que hay hoy con “Conté y hay…”." : ""}
            </Small>
          ) : (
            movimientos.map((m) => (
              <MovRow key={m._id}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{textoMovimiento(m)}</div>
                  <Small style={{ overflowWrap: "anywhere" }}>
                    {m.tipo === TIPOS.VENTA ? "vendió" : "registró"} {m.por || "—"}
                    {m.nota ? ` · ${m.nota}` : ""}
                  </Small>
                </div>
                <Small style={{ whiteSpace: "nowrap" }}>{fechaCorta(m.ts)}</Small>
              </MovRow>
            ))
          )}
        </Section>

        <Row style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <Btn $secondary onClick={onClose} disabled={busy}>
            Cerrar
          </Btn>
        </Row>
      </Modal>
    </>
  );
}

/**
 * Tarjeta que aparece arriba de la lista de socios cuando lo buscado es un
 * producto ("magnesio", "cepillo"…). Registra la venta sin abrir el modal.
 */
export function VentaRapida({ productos, onAuditEvent, onVerInventario }) {
  const { stock, error, aplicar } = useInventario(true);
  const { busy, msg, registrar } = useRegistrar(aplicar, onAuditEvent);

  return (
    <QuickCard>
      {productos.map((p) => {
        const n = stock?.[p.clave];
        return (
          <div key={p.clave} style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <div>
                <strong>
                  {p.emoji} {p.nombre}
                </strong>{" "}
                <Small as="span">
                  · {formatoPesos(p.precio)} · {n == null ? "…" : `quedan ${n}`}
                </Small>
              </div>
            </Row>
            <Vender clave={p.clave} disponible={n ?? 0} busy={busy || n == null} onVender={registrar} />
          </div>
        );
      })}
      {error && <Msg>{error}</Msg>}
      {msg && <Msg $ok={msg.ok}>{msg.texto}</Msg>}
      <Btn $secondary style={{ marginTop: 8 }} onClick={onVerInventario}>
        Ver inventario completo
      </Btn>
    </QuickCard>
  );
}
