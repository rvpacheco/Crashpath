/**
 * Datos estructurados para Google (Maps, knowledge panel, búsquedas locales).
 * Renderízalo UNA sola vez, dentro de la landing (no en _app):
 *
 *   import LocalBusinessJsonLd from '@/components/LocalBusinessJsonLd';
 *   ...
 *   <LocalBusinessJsonLd />
 *
 * PENDIENTES antes de producción:
 *  - latitude/longitude: ábrelo en Google Maps, click derecho sobre el local →
 *    copia las coordenadas y pégalas abajo. Sin esto Google no te ubica bien.
 *  - Si abres sábados/domingos, agrega ese bloque en openingHoursSpecification.
 *  - og-image.jpg debe existir en /public (1200x630).
 */
export default function LocalBusinessJsonLd({ description }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    '@id': 'https://www.crashpath.lat/#business',
    name: 'CrashPath',
    description:
      description ||
      'Gimnasio de escalada en Bucaramanga enfocado en entrenamiento real: rocódromo, boulder y MoonBoard.',
    url: 'https://www.crashpath.lat',
    telephone: '+573208608016',
    image: 'https://www.crashpath.lat/og-image.jpg',
    priceRange: '$$',
    currenciesAccepted: 'COP',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Carrera 25 #33A-24',
      addressLocality: 'Bucaramanga',
      addressRegion: 'Santander',
      addressCountry: 'CO',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '7.122489',
      longitude: '-73.119104',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday','Saturday'],
        opens: '16:00',
        closes: '21:00',
      },
      // Si abres fin de semana, descomenta y ajusta:
      // {
      //   '@type': 'OpeningHoursSpecification',
      //   dayOfWeek: ['Saturday'],
      //   opens: '10:00',
      //   closes: '14:00',
      // },
    ],
    sameAs: ['https://www.instagram.com/crash_path/'],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}