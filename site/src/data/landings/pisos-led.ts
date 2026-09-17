import { defineLanding } from '../../lib/landing';

export default defineLanding({
  slug: 'pisos-led',
  category: 'pisos-led',
  product: 'Pisos LED',
  trackingVersion: '20260813-beacon1',
  seo: {
    title: 'Pisos LED para eventos, salones y pistas de baile | RTM',
    description: 'Pisos LED transitables para salones, discotecas y eventos: reproducción de video, efectos RGB y superficie resistente al impacto y al agua.',
    ogImage: '/proyectos_imagenes/proyecto_8.webp',
  },
  hero: {
    h1: ['Pisos LED', 'transitables'],
    accent: 'para salones, pistas y escenarios',
    lead: 'Video, efectos de luz o interactivos.',
    image: 'proyectos_imagenes/proyecto_8.webp',
  },
  statement: 'La pista también es pantalla.',
  models: {
    title: 'Modelos',
    groups: { modelos: 'Transitables' },
    specs: [['pixelPitch', 'Pitch'], ['tamañoDelPanel', 'Panel'], ['tipo', 'Tipo']],
    note: 'Fijos o para armar por evento.',
  },
  process: {
    steps: [
      { title: 'La pista', text: 'Medida, uso y si queda fija.' },
      { title: 'Fabricación e instalación', text: 'Nivelación, bordes y puesta en marcha.' },
      { title: 'Repuestos y service', text: 'Paneles, fuentes y placas después de instalar.' },
    ],
  },
  projects: {
    title: 'Pistas instaladas',
    items: [
      { image: 'proyectos_imagenes/conjunto_1_1.webp', caption: 'Escenario' },
      { image: 'proyectos_imagenes/conjunto_1_2.webp', caption: 'Fiesta al aire libre' },
      { image: 'proyectos_imagenes/conjunto_5_4.webp', caption: 'Piso con video' },
      { image: 'proyectos_imagenes/proyecto_4.webp', caption: 'Pista de baile' },
      { image: 'proyectos_imagenes/proyecto_7.webp', caption: 'Salón de eventos' },
    ],
  },
  closing: {
    title: 'Cotizá tu piso LED',
    lead: 'Decinos la medida y si queda fijo.',
  },
  wa: {
    quote: 'Hola, quiero cotizar un piso LED.\n\nMedida de la pista: \nFijo o por evento: \nQué quiero mostrar: ',
    advice: 'Hola, estoy viendo pisos LED y quiero asesoramiento para elegir el modelo.',
  },
});
