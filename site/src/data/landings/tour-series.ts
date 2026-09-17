import { defineLanding } from '../../lib/landing';

export default defineLanding({
  slug: 'tour-series',
  category: 'tour-series',
  product: 'Tour Series',
  trackingVersion: '20260813-beacon1',
  seo: {
    title: 'Tour Series — Pantallas LED para eventos y giras | RTM',
    description: 'Pantallas LED de gabinete liviano para eventos, escenarios y giras: 500×500 y 1000×500 mm, versiones curvas, indoor y outdoor con IP65 frontal.',
    ogImage: '/proyectos_imagenes/proyecto_14.webp',
  },
  hero: {
    h1: ['Pantallas LED', 'para eventos'],
    accent: 'montaje rápido y traslado permanente',
    lead: 'Gabinetes livianos, planos o curvos.',
    image: 'proyectos_imagenes/proyecto_14.webp',
  },
  statement: 'Se arma, se desarma, viaja.',
  models: {
    title: 'Modelos',
    groups: { indoor: 'Interior', outdoor: 'Exterior' },
    specs: [['pixelPitch', 'Pitch'], ['tamañoDelPanel', 'Panel'], ['brilloPorM2', 'Brillo']],
    note: 'Versiones curvas y de mantenimiento frontal.',
  },
  process: {
    steps: [
      { title: 'Definición', text: 'Medida de escenario, interior o exterior.' },
      { title: 'Prueba de armado', text: 'Montaje completo antes de entregar.' },
      { title: 'Repuestos y service', text: 'Módulos, fuentes y placas después de entregar.' },
    ],
  },
  projects: {
    title: 'En eventos',
    items: [
      { image: 'proyectos_imagenes/proyecto_15.webp', caption: 'Salón de fiestas' },
      { image: 'proyectos_imagenes/proyecto_3.webp', caption: 'Show en vivo' },
      { image: 'proyectos_imagenes/conjunto_2_1.webp', caption: 'Pista y pantallas' },
    ],
  },
  closing: {
    title: 'Contanos tu escenario',
    lead: 'Medida, interior o exterior y fechas por año.',
  },
  wa: {
    quote: 'Hola, quiero cotizar una pantalla LED Tour Series.\n\nMedida de escenario: \nInterior o exterior: \nFechas por año: ',
    advice: 'Hola, estoy viendo las Tour Series y quiero asesoramiento para elegir el gabinete y el pitch.',
  },
});
