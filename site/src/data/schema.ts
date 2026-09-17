// Datos estructurados copiados de producción. El check D2 compara los @type de cada página:
// home = Organization + WebSite, catálogo = Organization. No cambiar sin mirar ese check.
export const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'RTM Pantallas LED',
  url: 'https://pantallasledrtm.com',
  logo: 'https://pantallasledrtm.com/rtm_logo/rtmLogo.png',
  description: 'Especialistas en desarrollo, fabricación e instalación de pantallas LED para interior y exterior. Soluciones profesionales y a medida.',
  telephone: '+54 9 11 5153 1530',
  areaServed: { '@type': 'Country', name: 'Argentina' },
  sameAs: [
    'https://www.instagram.com/pantallasledrtm/',
    'https://www.linkedin.com/in/rtmpantallasled/',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+54 9 11 5153 1530',
    contactType: 'sales',
    availableLanguage: 'Spanish',
  },
};

export const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'RTM Pantallas LED',
  url: 'https://pantallasledrtm.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://pantallasledrtm.com/productos.html?search={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};
