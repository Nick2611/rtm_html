import { defineLanding } from '../../lib/landing';

export default defineLanding({
  slug: 'pantallas-led',
  category: 'pantallas-led',
  product: 'Pantallas LED',
  trackingVersion: '20260813-beacon1',
  seo: {
    title: 'Pantallas LED para interior y exterior — Fabricación e instalación | RTM',
    description: 'Fabricamos, vendemos e instalamos pantallas LED de interior, exterior, escenario y vehiculares. Definimos serie, pitch y medida según el lugar y el uso.',
    ogImage: '/proyectos_imagenes/proyecto_2.webp',
  },
  hero: {
    h1: ['Pantallas LED', 'profesionales'],
    accent: 'fabricación, venta e instalación',
    lead: 'A medida, instaladas en todo el país.',
    image: 'proyectos_imagenes/proyecto_18.webp',
  },
  statement: 'Cada pantalla, hecha a medida.',
  facts: [{ icon: 'factory', text: 'Fabricación propia' }, { icon: 'map-pin', text: 'Instalación en todo el país' }, { icon: 'wrench', text: 'Repuestos y service' }],
  models: {
    title: 'Modelos',
    groups: { indoor: 'Interior', outdoor: 'Exterior y eventos' },
    specs: [['pixelPitch', 'Pitch'], ['brilloPorM2', 'Brillo'], ['tamañoDelPanel', 'Panel']],
    note: 'También series especiales y para vehículos.',
  },
  process: {
    steps: [
      { title: 'Relevamiento', text: 'Medidas, distancia de visión y consumo.' },
      { title: 'Fabricación e instalación', text: 'Estructura y puesta en marcha a cargo nuestro.' },
      { title: 'Repuestos y service', text: 'Módulos, fuentes y placas después de instalar.' },
    ],
  },
  projects: {
    title: 'Instaladas y funcionando',
    items: [
      { image: 'proyectos_imagenes/proyecto_2.webp', caption: 'Estación de servicio' },
      { image: 'proyectos_imagenes/proyecto_16.webp', caption: 'Showroom de vehículos' },
      { image: 'proyectos_imagenes/proyecto_3.webp', caption: 'Escenario de evento' },
      { image: 'proyectos_imagenes/proyecto_15.webp', caption: 'Salón de eventos' },
      { image: 'proyectos_imagenes/proyecto_17.webp', caption: 'Hall corporativo' },
    ],
  },
  closing: {
    title: 'Contanos dónde va',
    lead: 'Ubicación, medida y uso. Te respondemos con una propuesta.',
  },
  wa: {
    quote: 'Hola, quiero cotizar una pantalla LED.\n\nDónde va: \nMedida aproximada: \nUso previsto: ',
    advice: 'Hola, estoy viendo pantallas LED y quiero asesoramiento para elegir la serie y el pitch.',
  },
});
