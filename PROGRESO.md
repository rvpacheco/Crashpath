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
git log --oneline origin/taller..taller              # commits locales sin push
```

La base contra la que se trabaja: **`.env` apunta a la base de PRODUCCIÓN** (no hay base de
desarrollo). Ver Trampas.

## Abierto

En orden de urgencia.

### Sin desplegar

- **Landing: menú legible al bajar y botón de WhatsApp legible** (commit
  `fix(landing): menú legible...` en `taller`, sin push). Al pasar el hero el menú toma
  fondo claro y texto oscuro; "CrashPath" del menú pasa a "Nosotros"; el logo queda
  centrado en celular; el botón de WhatsApp de "Cómo entrenas hoy" usa el estilo de fondo
  claro. Verificado con Chromium sin ventana a 1440, 900 y 390px (capturas antes y después).
  **Falta**: verlo en un teléfono real, subir a GitHub y pasar a `main` cuando Rodolfo lo
  diga. Comprobar después en vivo buscando "Nosotros" en el menú.

### Landing (`crashpath/pages/index.js`)

Sale de la revisión del 24/09/2026. Los puntos 1–2 de esa lista ya están en `taller`.

1. **"Cómo entrenas hoy" queda a media página**: la columna derecha del `AboutGrid` está
   vacía porque el `VideoBox` está comentado. Poner video/foto o dejar la tarjeta a todo el
   ancho.
2. **La foto del hero es de roca afuera**, pero el titular dice "Gimnasio de Escalada": no se
   ve ni la MoonBoard ni la placa. **Rodolfo tiene que pasar fotos reales del gym.**
3. **Precio de ticketera = precio de mensualidad** en la página, y la ticketera (8 visitas
   en 60 días) parece peor negocio que la mensualidad. **Rodolfo tiene que decir** si es a
   propósito (y explicarlo en el copy) o si cambia el precio.
4. **Falta dirección y mapa.** Solo dice "Bucaramanga". **Rodolfo tiene que dar la dirección.**
5. Copy "Ya no trabajamos por horas" le habla a clientes viejos; confunde al nuevo.
6. "REGISTRAR VISITA" en todos lados sin decir qué es. Mejor un CTA tipo "Quiero ir".
7. Menores: los links del menú se ven pálidos sobre la parte clara de la foto (ya pasaba
   antes); el patrón de petroglifos compite con el texto; textos de 12–13px chicos para
   celular; no hay FAQ (qué llevar, si hay que saber escalar, alquiler de zapatos).

### Admin (`crashpath/pages/admin.js`)

Rodolfo decidió no tocar el admin por ahora (24/09/2026).

1. **Filas altísimas**: la columna "Acceso" apila créditos, vence, cortesía, fechas y
   "Cambiar"; caben dos socios por pantalla. Fila compacta + detalle aparte. Es la mejora
   del admin que más se nota en el día a día.
2. **La primera carga tarda varios segundos** por arranque en frío: sesión → rol → usuarios
   van en cadena y cada una en frío tarda 1–2 s; en caliente, cientos de ms. Pedir rol y
   usuarios a la vez ahorraría una vuelta, no el arranque. Beneficio chico.
3. La barra superior tiene demasiados botones con el mismo peso; "Actividad reciente" le
   quita ancho a la tabla.
4. Datos: duplicados de importación (`import_*@crashpath.local`) junto a la cuenta real, y
   muchos usuarios "sin créditos" ensuciando la vista diaria. Ver
   `crashpath/docs/ideas-pendientes.md` §3.

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
- **Claude in Chrome no sirve para medir rendimiento ni para probar scroll.** La pestaña
  que controla queda `document.visibilityState === "hidden"`: Chrome no la dibuja, así que
  `requestAnimationFrame` e `IntersectionObserver` no avisan, los temporizadores se estiran
  a 1 s y las capturas salen atrasadas. Parece que la página se congela y no es así. Para
  eso, Chromium sin ventana con Playwright (`playwright-core` en el scratchpad, con
  `executablePath: '/usr/bin/chromium'`), contra `npm run dev`. `resize_window` tampoco
  achica la ventana: para anchos, `viewport` de Playwright.
- Con el dev server corriendo, `npm run build` pelea por la carpeta `.next`: apagarlo antes.

## Probado y descartado

- **Agregar el conector MCP con `crashpath.lat` (sin www).** No sirve: el redirect a `www`
  borra el token. *Lección*: con OAuth/Bearer, la URL registrada tiene que ser el host
  final, sin redirects de por medio.
- **Esperar a que Vercel despliegue solo después del push a `main`.** Tras 12 minutos no
  había deploy. *Lección*: no dar por hecho el deploy automático; verificar con
  `vercel ls` y desplegar a mano si no aparece.
- **Partir `admin.js` en componentes para arreglar un "congelamiento".** Medido el
  24/09/2026 en producción con la sesión de Rodolfo: ninguna tarea bloquea el navegador más
  de ~85 ms, ni con 100 filas por página ni escribiendo en el buscador. El congelamiento de
  la revisión anterior salió de Chrome controlado por Claude (ver Trampas), no del panel.
  *Lección*: medir antes de refactorizar; un síntoma visto a través de la herramienta de
  automatización no es un síntoma del usuario.

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
