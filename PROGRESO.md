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

## Al empezar la sesión: decirle esto a Rodolfo primero

Rodolfo pidió (17/10/2026) que lo primero que se le diga al abrir Crashpath sea: **"mira, esto
está pendiente, hazlo"**, con el pendiente concreto, no un resumen del archivo. Verificar el
estado real (sección siguiente) y luego proponer, en este orden:

1. **Página de guiadas en roca**, en español e inglés (ver "Para llenar el muro" §3).
   Antes de escribirla, preguntarle lo que es suyo: precios de referencia, lugares, niveles,
   duración, qué incluye.
2. **Medir los toques** a WhatsApp y a "Registrar visita", por página e idioma (§5). Antes,
   preguntarle si ya usa alguna analítica.
3. **Fotos del muro**: preguntar si ya las tomó (§1). Con ellas, optimizar hero, tarjeta
   vacía de "Cómo entrenas hoy" e imagen de compartir.

Lo que depende de Rodolfo y no se puede adelantar: fotos, ficha de Google Business, dirección.

## Ver el estado real

```bash
cd crashpath && npx vitest run                       # tests
git log --oneline origin/main..origin/taller         # qué hay en taller sin pasar a main
git log --oneline origin/taller..taller              # commits locales sin push
vercel ls crashpath | head                           # último deploy y si es Production
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.crashpath.lat/api/mcp   # 401 = MCP vivo
for u in en robots.txt sitemap.xml; do curl -s -o /dev/null -w "$u %{http_code}\n" https://www.crashpath.lat/$u; done   # 200 los tres
CHROME_PATH=/usr/bin/chromium npx --yes lighthouse@12 https://www.crashpath.lat/ --form-factor=mobile --only-categories=performance --chrome-flags="--headless=new --no-sandbox" --quiet --output=json --output-path=/tmp/lh.json   # rendimiento móvil
```

La base contra la que se trabaja: **`.env` apunta a la base de PRODUCCIÓN** (no hay base de
desarrollo). Ver Trampas.

## Abierto

En orden de urgencia.

### Para llenar el muro y las guiadas

Salió de mirar Search Console (3 meses, sitio de una sola página, casi todo tráfico móvil, la
mayoría de clics por búsquedas con el nombre del gimnasio). Es un plan, no resultados: con poco
tráfico un mes de datos puede ser ruido. Lo que dicen los datos no está verificado por comando;
Rodolfo exportó el informe y yo no pude leer Search Console (la extensión de Chrome bloquea el
sitio).

1. **Fotos reales del muro. Las toma Rodolfo; es lo más urgente.** El hero muestra roca
   exterior y el titular dice "Gimnasio de Escalada": no se ve la MoonBoard ni la placa, y es
   el mismo hero en `/` y `/en`. También llenarían la columna vacía de "Cómo entrenas hoy" (el
   `VideoBox` está comentado) y la imagen de compartir. Pedirlas con el gym iluminado,
   horizontales para el hero y una vertical si se puede. Claude las optimiza igual que el hero
   (WebP, versión de celular y de escritorio, con test de peso).
2. **Ficha de Google Business + reseñas. Lo hace Rodolfo, no se puede desde el código.** Las
   búsquedas "cerca de mí" se ganan en el mapa. "climbing gym near me" salía en posición alta
   con cero clics. **Preguntar si la ficha ya existe**: cambia el plan.
3. **Página propia de guiadas en roca (ES + EN).** Hoy es una tarjeta con un botón. Debe decir
   qué incluye, nivel, duración, qué llevar, lugares, fotos de salidas y precio de referencia.
   Los datos son de Rodolfo.
4. **Contacto sin fricción.** En guiadas, WhatsApp como botón principal con el mensaje ya
   escrito en el idioma de la página. Agregar **dirección y mapa** al landing (hoy solo dice
   "Bucaramanga"). La dirección ya está en `crashpath/components/LocalBusinessJsonLd.js`;
   **confirmar con Rodolfo que es la correcta antes de mostrarla**.
5. **Medir.** Contar los toques a WhatsApp y a "Registrar visita", por página e idioma. Sin
   esto no se sabe si algo de lo anterior funciona.
6. **`/reservas` sigue solo en español**: los botones "REGISTER A VISIT" de `/en` llevan ahí.
   Rodolfo decidió (17/10/2026) no hacer nada por ahora. Reabrir si Search Console o la
   medición muestran visitas de fuera. Alternativa barata: mandar a WhatsApp desde `/en`.
7. **Search Console, seguimiento.** Rodolfo dijo que ya envió `sitemap.xml` (no lo verificó
   ningún comando). Pendiente: pedir indexación de `/privacy` (para que vea el `noindex`) y
   revisar en unas semanas posiciones de "gimnasio de escalada", "escalada", "rocodromo", el
   CTR de "climbing gym near me" y la pestaña Core Web Vitals.
8. **Vista previa al compartir.** La imagen nueva está desplegada, pero WhatsApp e Instagram
   guardan la vieja en caché. Rodolfo puede forzarla en el depurador de Facebook
   (developers.facebook.com/tools/debug). Nadie lo ha comprobado en un teléfono.

### Landing

El diseño vive en `crashpath/components/Landing.js` y lo usan `pages/index.js` (es) y
`pages/en.js` (en). **Los textos viven en `crashpath/lib/landingCopy.js`**, español e inglés
lado a lado; un test falla si las claves no coinciden. Cambiar un texto se hace ahí.

1. **Precio de ticketera = precio de mensualidad** y la ticketera (8 visitas en 60 días)
   parece peor negocio. **Rodolfo tiene que decir** si es a propósito (y explicarlo en el
   copy) o si cambia el precio.
2. Copy "Ya no trabajamos por horas" le habla a clientes viejos; confunde al nuevo.
3. "REGISTRAR VISITA" en todos lados sin decir qué es. Mejor un CTA tipo "Quiero ir".
4. Los dos botones de la tarjeta "Cómo entrenas hoy" quedan de ancho distinto en celular
   (en las otras tarjetas son de ancho completo). Es de gusto.
5. Los links del menú de escritorio se ven pálidos sobre la parte oscura de la foto; el patrón
   de petroglifos compite con el texto; textos de 12–13px chicos para celular; no hay FAQ
   (qué llevar, si hay que saber escalar, alquiler de zapatos).
6. Las ideas de SEO que quedan (landings de clases para niños, contenido con "rocódromo",
   "boulder", "muro de escalada") se dejaron a propósito hasta ver si lo hecho mueve algo.
7. Pasar el JavaScript sin usar (~Lighthouse lo marca) no vale la pena ahora: es de Next.

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
  cancelar una visita y usar una cortesía desde el panel.
- El admin no muestra el origen `mcp` en el feed a propósito: Rodolfo no quiere que el resto
  del staff sepa del MCP por ahora. No agregar la etiqueta "vía Claude" sin preguntarle.

### Otros

- Sin commitear a propósito: `crashpath/.gitignore` (Vercel agregó `.env*`) y `.gitignore` en
  la raíz (con `.vercel`, creado por `vercel link`). Inofensivos; decidir si se commitean.
- `crashpath-seo-search-console.md` en la raíz: el informe de Search Console que Rodolfo
  exportó. Rodolfo pidió dejarlo fuera de los commits (17/10/2026). Decidir si va a `docs/`
  o se borra; no mezclarlo con commits del sitio.
- `public/landing/hero-2.jpg` (el original pesado) ya no se sirve, pero sigue en el repo.
  Borrarlo cuando haya fotos nuevas; `hero-1.jpg`, `hero-3.jpg` y `service-reserve.jpg`
  tampoco se usan.
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
  la config estaba bien: rama de producción `main`, sin ignored build step). Los pushes del
  17/10/2026 sí desplegaron solos, en un par de minutos. Verificar siempre buscando el
  contenido nuevo en vivo; si no aparece: `git checkout main && vercel deploy --prod --yes`
  **desde la raíz del repo** (el proyecto de Vercel tiene Root Directory `crashpath`).
- **`vercel link` crea `.env.local`** con variables de desarrollo, y en Next `.env.local`
  pisa a `.env`. Si el local se comporta raro, revisar que no haya quedado uno.
- `NEXTAUTH_URL` de producción es `https://www.crashpath.lat`; las URLs del OAuth del MCP
  salen de ahí.
- La lógica de check-in, renovar mensualidad, ajustar créditos, cancelar visita y usar
  cortesía vive en `crashpath/lib/operaciones.js` y la comparten el panel y el MCP. Cambiarla
  ahí, no en los endpoints.
- **Claude in Chrome no sirve para medir rendimiento ni para probar scroll.** La pestaña
  que controla queda `document.visibilityState === "hidden"`: Chrome no la dibuja, así que
  `requestAnimationFrame` e `IntersectionObserver` no avisan, los temporizadores se estiran
  a 1 s y las capturas salen atrasadas. Parece que la página se congela y no es así. Para
  eso, Chromium sin ventana con Playwright (`playwright-core` en el scratchpad, con
  `executablePath: '/usr/bin/chromium'`). `resize_window` tampoco achica la ventana: para
  anchos, `viewport` de Playwright. Esperar la navegación de verdad (`waitForURL`):
  `waitForLoadState` vuelve al instante tras un clic y da falsos "no navegó".
- **Claude in Chrome no puede leer Search Console**: la extensión bloquea `search.google.com`
  ("Permission denied for reading page content"). Se resuelve dándole permiso al sitio en la
  extensión o pasando el CSV de EXPORTAR / capturas. No buscar rodeos.
- Con el dev server corriendo, `npm run build` pelea por la carpeta `.next`: apagarlo antes.
- **Vitest 4 / Vite 8 no entiende JSX dentro de archivos `.js`** (Next sí). Por eso existe
  `crashpath/vitest.config.mjs`, un plugin que compila como JSX solo `pages/` y `components/`.
  Las opciones `esbuild` y `oxc` no funcionaron. Sin ese plugin, un test que importe una
  página falla con "invalid JS syntax" y parece un fallo del código, no del test.
- **En el shell de Claude, `cp` está aliasado a interactivo y `pkill -f` mata el propio
  shell.** El primero cuelga el comando esperando "overwrite?": usar `command cp -f`. El
  segundo coincide con la línea de comando que lo contiene y devuelve exit 144: apagar el
  servidor con `kill $(cat pidfile)`.
- **`og:locale` lo pone `components/Seo.js`, no `_app.js`.** Si vuelve a `_app.js`, todo el
  sitio queda `es_CO` o la etiqueta sale duplicada. El idioma de `<html lang>` lo decide
  `_document.js` por la ruta (`/en`).
- Para pasar de `taller` a `main` con archivos sin commitear: `git stash push -u`, merge con
  `--no-ff`, push, `git checkout taller`, `git stash pop`. Los merges a `main` llevan el
  mensaje "Merge taller: ...".

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
- **Probar el JSX de las páginas configurando `esbuild` y luego `oxc` en Vitest.** Ninguna de
  las dos opciones se aplicó a archivos `.js`; el test seguía fallando por sintaxis, y por
  eso el primer fallo de `/privacy` en rojo no probaba nada (fallaba por el parser, no por la
  falta de `noindex`). *Lección*: un test en rojo hay que leerlo hasta ver **por qué** falla,
  no solo que falla. Lo resolvió un plugin con `transformWithOxc`.
- **Duplicar `pages/index.js` para hacer la página en inglés.** Se descartó antes de empezar:
  dejaría dos copias de 900+ líneas de diseño que divergen. Se hizo un componente con prop de
  idioma. *Lección*: la comparación del HTML de `/` antes y después de mover el código es la
  prueba de que la refactorización no cambió el español.

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
