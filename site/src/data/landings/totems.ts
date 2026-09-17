import { defineLanding } from '../../lib/landing';

export default defineLanding({
  slug: 'totems',
  category: 'totems',
  product: 'Tótems LED',
  trackingVersion: '20260813-beacon1',
  seo: {
    title: 'Tótems LED publicitarios para interior y exterior | RTM',
    description: 'Tótems LED de formato vertical para comercios, lobbies, shoppings y vía pública. Indoor de alta definición y outdoor IP65 con vidrio laminado 3+3.',
    ogImage: '/proyectos_imagenes/conjunto_3_2.webp',
  },
  hero: {
    h1: ['Tótems LED', 'verticales'],
    accent: 'para comercios, lobbies y vía pública',
    lead: 'Interior y exterior, instalados en todo el país.',
    image: 'proyectos_imagenes/conjunto_3_2.webp',
  },
  statement: 'Vertical, a la altura de la vista.',
  models: {
    title: 'Modelos',
    groups: { indoor: 'Interior', outdoor: 'Exterior' },
    specs: [['pixelPitch', 'Pitch'], ['dimensionesDelDisplay', 'Pantalla'], ['proteccion', 'Protección']],
    note: 'Exterior en simple o doble cara.',
  },
  process: {
    steps: [
      { title: 'Relevamiento', text: 'Ubicación, distancia de lectura y luz.' },
      { title: 'Fabricación e instalación', text: 'Base, anclaje y puesta en marcha.' },
      { title: 'Repuestos y service', text: 'Módulos, fuentes y placas después de instalar.' },
    ],
  },
  projects: {
    title: 'Tótems instalados',
    items: [
      { image: 'proyectos_imagenes/conjunto_4_1.webp', caption: 'Vía pública' },
      { image: 'proyectos_imagenes/conjunto_4_2.webp', caption: 'Costanera' },
      { image: 'proyectos_imagenes/conjunto_3_1.webp', caption: 'Local comercial' },
      { image: 'proyectos_imagenes/proyecto_6.webp', caption: 'Inmobiliaria' },
    ],
  },
  closing: {
    title: 'Cotizá tu tótem',
    lead: 'Decinos dónde va y si es interior o exterior.',
  },
  wa: {
    quote: 'Hola, quiero cotizar un tótem LED.\n\nDónde va: \nInterior o exterior: \nMedida aproximada: ',
    advice: 'Hola, estoy viendo tótems LED y quiero asesoramiento para elegir el modelo.',
  },
});
