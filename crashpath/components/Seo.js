import Head from 'next/head';

const SITE_URL = 'https://www.crashpath.lat';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`; // crea esta imagen: 1200x630px
const DEFAULT_TITLE = 'CrashPath | Gimnasio de Escalada en Bucaramanga';

/**
 * SEO por página. Úsalo dentro de cada página:
 *
 *   <Seo
 *     title="Reservas"                       // opcional; sin esto usa el title por defecto
 *     description="..."                       // 150-160 caracteres ideal
 *     path="/reservas"                        // ruta para canonical + og:url
 *     noindex                                 // ponlo en /admin para que no salga en Google
 *     locale="en_US"                          // idioma de la página (og:locale); por defecto es_CO
 *     alternates={{ es: "/", en: "/en" }}     // versiones por idioma (hreflang); opcional
 *   />
 *
 * Si no pasas `title`, queda el title por defecto (úsalo en la landing).
 * Si pasas `title="Reservas"`, queda "Reservas | CrashPath".
 */
export default function Seo({
  title,
  description,
  path = '/',
  image = DEFAULT_IMAGE,
  keywords,
  noindex = false,
  locale = 'es_CO',
  alternates,
}) {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title ? `${title} | CrashPath` : DEFAULT_TITLE;

  return (
    <Head>
      <title>{fullTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      {keywords ? <meta name="keywords" content={keywords} /> : null}

      <link rel="canonical" href={url} />
      {/* hreflang: le dice a Google qué versión mostrar según el idioma de quien busca.
          Cada versión debe listarse a sí misma y a las demás; x-default es la de respaldo. */}
      {alternates
        ? Object.entries(alternates).map(([lang, ruta]) => (
            <link key={lang} rel="alternate" hrefLang={lang} href={`${SITE_URL}${ruta}`} />
          ))
        : null}
      {alternates ? (
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${alternates.es || '/'}`} />
      ) : null}
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}

      {/* Open Graph (lo específico de la página) */}
      <meta property="og:title" content={fullTitle} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:url" content={url} />
      <meta property="og:locale" content={locale} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={image} />
    </Head>
  );
}