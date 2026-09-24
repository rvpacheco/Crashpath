# Ideas pendientes

## 1. MCP de Crashpath (uso personal del dueño)

Un servidor MCP que exponga las operaciones del gimnasio como herramientas para
usarlas desde la app de Claude, en lenguaje natural:

> "¿Juan Hernández está vigente?" · "quítale un crédito" · "renuévale la mensualidad"

**Por qué MCP y no un bot:** es solo para el dueño, así que no hace falta montar
un bot ni pagar la IA aparte; la conversación la pone Claude y acá solo se
programan las herramientas.

**Plan:**

1. **Fase 1: solo lectura (sin riesgo)**
   - Buscar usuario por nombre (tolerante a nombres incompletos y tildes).
   - Estado de acceso: tipo, créditos, fecha de vencimiento, vigente sí/no.
   - Listar vigentes y los que vencen pronto.
2. **Fase 2: escritura**
   - Descontar crédito (check-in), renovar mensualidad, cargar tiquetera.
   - Cada acción pide confirmación y queda en `AuditLog` con origen "mcp".
   - Reusar la misma lógica de `pages/api/admin/*` para que el panel y el MCP
     nunca se descuadren.
   - Si hay dos personas con nombres parecidos, preguntar en vez de adivinar.

**Estado: implementado (fases 1 y 2).** Servidor remoto en `/api/mcp`
(`lib/mcpHerramientas.js`), OAuth en `/api/oauth/*` (`lib/mcpAuth.js`) y la
lógica compartida con el panel en `lib/operaciones.js`.

Para activarlo:

1. En Vercel: `MCP_ALLOWED_EMAILS=<email del dueño>` (tiene que ser admin en
   `lib/roles.js`). Opcional: `MCP_JWT_SECRET` propio (si no, se deriva de
   `NEXTAUTH_SECRET`); cambiarlo invalida todos los tokens.
2. Deploy.
3. En claude.ai → Configuración → Conectores → Agregar conector personalizado
   → URL `https://<dominio>/api/mcp`. Pide login con Google y un botón de
   "Autorizar". Queda disponible también en la app del celular.

**Criterio de "vigente"** (el mismo que se usó para el conteo del 23/09/2026):

- Mensualidad: `mensualidad.endDate >= hoy`.
- Tiquetera: `credits > 0` y `tiquetera.endDate >= hoy`.
  Las tiqueteras sin fecha no cuentan como vigentes hasta que se les ponga una.

## 2. Recordatorios de vencimiento por WhatsApp

Tarea diaria que avisa por WhatsApp a quien tenga la mensualidad o la tiquetera
por vencer (p. ej. 3 días antes y el mismo día) o esté por quedarse sin créditos.

- Usar la API oficial (Meta Cloud API) con plantilla de categoría "utilidad".
  Costo estimado: menos de USD 1/mes con el volumen actual. Verificar la tarifa
  vigente en la tabla de precios de Meta.
- Evitar bots no oficiales por QR: WhatsApp bloquea esos números.
- Registrar a quién se le mandó cada aviso para no repetir.
- Los teléfonos se guardan sin `+57`; agregarlo al enviar.
- Alternativa gratis mientras tanto: el mismo recordatorio por correo (ya hay SMTP).

## 3. Limpieza de datos

- Hay cuentas duplicadas de usuarios importados (`import_*@crashpath.local`)
  junto a su cuenta real; revisar y fusionar.
- Hay tiqueteras importadas sin fechas de inicio ni vencimiento; completarlas.
- Algunos usuarios vigentes no tienen teléfono registrado.
