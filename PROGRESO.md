# PROGRESO — Crashpath

Estado entre sesiones. La arquitectura estable va en `CLAUDE.md` (todavía no existe).

**Reglas de este archivo**

- Se escribe solo al cerrar la sesión, nunca a mitad de tarea.
- Se reescribe completo, no se le agrega. El historial lo guarda git.
- Lo desplegado sale del archivo: si funciona y está en producción, no es estado abierto.
- Sin cifras. Si el dato se puede consultar, va el comando, no el resultado.
- Esto son afirmaciones, no evidencia: verificarlas contra la base, el build o git antes de
  fiarse. Si algo lo verificó una persona y no un comando, se dice quién.
- "Probado y descartado" es la única sección que solo crece.

## Ver el estado real

```bash
cd crashpath && npx vitest run                       # tests
git log --oneline origin/main..origin/taller         # qué hay en taller sin pasar a main
vercel ls crashpath | head                           # último deploy y si es Production
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.crashpath.lat/api/mcp   # 401 = MCP vivo
```

La base contra la que se trabaja: **`.env` apunta a la base de PRODUCCIÓN** (no hay base de
desarrollo). Ver Trampas.

## Abierto

En orden de urgencia. Sale de la revisión del landing y el admin del 24/09/2026 (vista en
vivo en escritorio con la sesión de Rodolfo, más lectura del código).

### Landing (`crashpath/pages/index.js`)

1. **El menú fijo desaparece al hacer scroll.** Es transparente con texto blanco: sobre el
   fondo beige no se lee y queda montado sobre las tarjetas. Además el link "CrashPath" del
   menú se pisa con el logo del centro. Darle fondo al pasar el hero, o no dejarlo fijo.
2. **Botón "WHATSAPP (MAÑANAS)" ilegible** en la sección "Cómo entrenas hoy": texto blanco
   sobre gris claro (`HeroBtn $kind="ghost"` fuera del hero).
3. **"Cómo entrenas hoy" queda a media página**: la columna derecha del `AboutGrid` está
   vacía porque el `VideoBox` está comentado. Poner video/foto o dejar la tarjeta a todo el
   ancho.
4. **La foto del hero es de roca afuera**, pero el titular dice "Gimnasio de Escalada": no se
   ve ni la MoonBoard ni la placa. Faltan fotos reales del gym. **Lo tiene que dar Rodolfo.**
5. **Precio de ticketera = precio de mensualidad.** La página los muestra iguales, y la
   ticketera (8 visitas en 60 días) parece peor negocio que la mensualidad (ilimitado un mes).
   **Pendiente que Rodolfo confirme** si es a propósito (y entonces explicarlo en el copy) o
   si hay que cambiar el precio.
6. **Falta dirección y mapa.** Solo dice "Bucaramanga". **Rodolfo tiene que dar la dirección.**
7. Copy "Ya no trabajamos por horas" le habla a clientes viejos; confunde al nuevo.
8. "REGISTRAR VISITA" en todos lados sin decir qué es (¿reservar? ¿pagar? ¿cuenta?). Mejor un
   CTA tipo "Quiero ir" con los pasos.
9. Menores: el patrón de petroglifos del fondo compite con el texto (bajar opacidad); textos
   de 12–13px chicos para celular; no hay FAQ (qué llevar, si hay que saber escalar,
   alquiler de zapatos).
10. **La vista de celular no se revisó en vivo** (la ventana de Chrome no se dejó
    redimensionar). Revisarla antes de tocar el layout.

### Admin (`crashpath/pages/admin.js`)

1. **Se congela al cargar los usuarios**: Chrome dejó de responder un rato mientras cargaba
   la tabla. Causa probable: todo el panel es un solo componente gigante con muchísimos
   `useState`, así que cada cambio re-renderiza la tabla entera. Partir en componentes
   (tabla, fila, modales, dashboard) y memoizar filas.
   Tamaño: `wc -l crashpath/pages/admin.js` · `grep -c useState crashpath/pages/admin.js`.
2. **Filas altísimas**: la columna "Acceso" apila créditos, vence, cortesía, fechas y
   "Cambiar"; caben pocos socios por pantalla. Fila compacta + detalle en panel lateral.
3. El contenido no usa el ancho de la pantalla y la "Actividad reciente" le quita espacio a
   la tabla.
4. La barra superior tiene demasiados botones con el mismo peso. Destacar "Asistencia" y
   "+ Nuevo miembro"; mandar Exportar/Importar/Voluntarios a un menú "Más".
5. Datos: duplicados de importación (`import_*@crashpath.local`) junto a la cuenta real, y
   muchos usuarios "sin créditos" ensuciando la vista diaria. Ver
   `crashpath/docs/ideas-pendientes.md` §3.

**Orden propuesto**: landing 1–2 (rápidos) → admin 1 (congelamiento) → landing 4–6 (cuando
Rodolfo pase fotos, dirección y la decisión del precio) → admin 2.

### MCP

- **La primera escritura real por MCP (con `confirmar=true`) no está verificada.** Rodolfo
  confirmó que conecta y funciona desde el celular; no consta que haya probado un check-in,
  una renovación o una carga. Hacerla con un socio de confianza y revisar la entrada en
  AuditLog (`meta.origen: "mcp"`).
- **Herramientas nuevas del 26/09/2026 sin probar contra la base real** (solo tests con
  datos simulados): `checkins_del_dia`, `inactivos`, `vencidos_recientes`, `historial`,
  `resumen_periodo`, `datos_pendientes`, `deshacer_checkin`, `usar_cortesia`. Para
  compartirlas, `visits/cancel` y `cortesia/usar` pasaron a `lib/operaciones.js`: probar
  cancelar una visita y usar una cortesía desde el panel después del deploy.
- El admin no muestra el origen `mcp` en el feed a propósito: Rodolfo no quiere que el resto
  del staff sepa del MCP por ahora. No agregar la etiqueta "vía Claude" sin preguntarle.

### Otros

- Sin commitear: `crashpath/.gitignore` (Vercel agregó `.env*`) y `.gitignore` en la raíz
  (con `.vercel`, creado por `vercel link`). Inofensivos; decidir si se commitean.
- GitHub/Dependabot reporta vulnerabilidades en `main`, algunas críticas:
  `gh api repos/rvpacheco/Crashpath/dependabot/alerts --paginate --jq '.[] | select(.state=="open") | .security_advisory.severity' | sort | uniq -c`
- Pendientes de `crashpath/docs/ideas-pendientes.md`: recordatorios por WhatsApp (§2) y
  limpieza de datos (§3).

## Trampas que cuestan tiempo si no se saben

- **`.env` local apunta a la base de producción.** No hay base de desarrollo: cualquier
  prueba local que escriba toca datos reales. Hasta separar entornos, en local solo lectura.
- **El conector MCP tiene que ser `https://www.crashpath.lat/api/mcp`, con `www`.**
  `crashpath.lat` hace un 308 a `www` y el cliente suelta el header `Authorization` al
  cambiar de host: Claude obtiene el token pero `/api/mcp` responde 401 "header ausente" en
  bucle. El 401 del MCP loguea el motivo en Vercel (`vercel logs --environment production`).
- **Un push a `main` puede no disparar el deploy de producción** (pasó con el merge del MCP;
  la config estaba bien: rama de producción `main`, sin ignored build step). Si pasa:
  `git checkout main && vercel deploy --prod --yes` **desde la raíz del repo** (el proyecto de
  Vercel tiene Root Directory `crashpath`). Comprobar después buscando lo nuevo en vivo.
- **`vercel link` crea `.env.local`** con variables de desarrollo, y en Next `.env.local`
  pisa a `.env`. Si el local se comporta raro, revisar que no haya quedado uno.
- `NEXTAUTH_URL` de producción es `https://www.crashpath.lat`; las URLs del OAuth del MCP
  salen de ahí.
- La lógica de check-in, renovar mensualidad, ajustar créditos, cancelar visita y usar
  cortesía vive en `crashpath/lib/operaciones.js` y la comparten el panel y el MCP. Cambiarla ahí, no en los
  endpoints.
- En Chrome (Claude in Chrome), `resize_window` no achicó la ventana: para ver el celular
  usar DevTools en modo dispositivo o probar en un teléfono.

## Probado y descartado

- **Agregar el conector MCP con `crashpath.lat` (sin www).** No sirve: el redirect a `www`
  borra el token. *Lección*: con OAuth/Bearer, la URL registrada tiene que ser el host
  final, sin redirects de por medio.
- **Esperar a que Vercel despliegue solo después del push a `main`.** Tras 12 minutos no
  había deploy. *Lección*: no dar por hecho el deploy automático; verificar con
  `vercel ls` y desplegar a mano si no aparece.

## Montar una máquina nueva

```bash
git clone https://github.com/rvpacheco/Crashpath.git && cd Crashpath
git checkout taller
cd crashpath && npm install
# Variables: el git pull NO trae .env. Pedirlas o bajarlas de Vercel:
npm i -g vercel && vercel login
cd .. && vercel link --yes --project crashpath   # desde la raíz del repo
vercel env pull crashpath/.env.local --environment development
# OJO: apunta a la base de producción (ver Trampas).
cd crashpath && npx vitest run && npm run dev
```

Variables del MCP en Vercel (producción): `MCP_ALLOWED_EMAILS` (obligatoria) y
`MCP_JWT_SECRET` (opcional; si no está se deriva de `NEXTAUTH_SECRET`).
