import { defineLanding } from '../../lib/landing';

export default defineLanding({
  slug: 'led-trucks',
  category: 'led-trucks',
  product: 'LED Trucks',
  trackingVersion: '20260813-beacon1',
  seo: {
    title: 'LED Trucks: camiones con pantalla LED para publicidad móvil | RTM',
    description: 'Camiones equipados con pantallas LED para campañas, eventos y activaciones. RTM realiza el diseño, la fabricación, la instalación y la puesta en marcha.',
    ogImage: '/proyectos_imagenes/proyecto_1.webp',
  },
  hero: {
    h1: ['LED Trucks'],
    accent: 'publicidad móvil sobre camión',
    lead: 'Entregamos el camión funcionando.',
    image: 'proyectos_imagenes/proyecto_11.webp',
  },
  statement: 'Tu pantalla, en movimiento.',
  facts: [{ icon: 'factory', text: 'Fabricación e instalación propias' }, { icon: 'speaker-high', text: 'Sonido integrado' }, { icon: 'sun', text: 'Alta resolución exterior' }],
  models: {
    title: 'Camiones con pantalla',
    gallery: [
      { image: 'proyectos_imagenes/proyecto_1.webp', caption: 'Recorrido urbano' },
      { image: 'proyectos_imagenes/proyecto_10.webp', caption: 'Pantalla en caja' },
    ],
  },
  process: {
    steps: [
      { title: 'Relevamiento', text: 'Medidas, estructura y consumo de la unidad.' },
      { title: 'Fabricación e instalación', text: 'Pantalla, alimentación y sonido, probados en calle.' },
      { title: 'Repuestos y service', text: 'Módulos, fuentes y placas durante la operación.' },
    ],
  },
  projects: {
    title: 'En la calle',
    items: [
      { image: 'proyectos_imagenes/proyecto_3.webp', caption: 'Show sobre camión' },
      { image: 'proyectos_imagenes/proyecto_9.webp', caption: 'Escenario móvil' },
      { image: 'proyectos_imagenes/conjunto_7_2.webp', caption: 'Pantalla en colectivo' },
    ],
  },
  closing: {
    title: 'Contanos tu campaña',
    lead: 'Unidad propia, tipo de campaña y zona de recorrido.',
  },
  wa: {
    quote: 'Hola, quiero consultar por un LED Truck.\n\nTengo unidad propia: \nTipo de campaña: \nZona de recorrido: ',
    advice: 'Hola, estoy viendo los LED Trucks y quiero asesoramiento para mi campaña.',
  },
});
