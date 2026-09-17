import { defineLanding } from '../../lib/landing';

export default defineLanding({
  slug: 'porticos',
  category: 'porticos',
  product: 'Pórticos LED',
  trackingVersion: '20260813-beacon1',
  seo: {
    title: 'Pórticos LED de señalización vial para rutas y avenidas | RTM',
    description: 'Pórticos LED de mensajería variable para rutas, autopistas y avenidas. Fabricación a medida del pescante, instalación y servicio técnico en Argentina.',
    ogImage: '/imagenes_productos/soluciones/LPR1264.webp',
  },
  hero: {
    h1: ['Pórticos LED', 'de señalización vial'],
    accent: 'para rutas, autopistas y avenidas',
    lead: 'Mensajería variable, a medida del pescante.',
    image: 'imagenes_productos/soluciones/LPR1264.webp',
  },
  statement: 'Legible a la velocidad de paso.',
  models: {
    title: 'Modelos',
    groups: { modelos: 'Señalización vial' },
    specs: [['pixelPitch', 'Pitch'], ['brilloPorM2', 'Brillo'], ['tamañoDelPanel', 'Panel']],
    note: 'La medida final sale del pescante.',
  },
  process: {
    steps: [
      { title: 'Relevamiento', text: 'Ancho, velocidad de lectura y alimentación.' },
      { title: 'Fabricación e instalación', text: 'Montaje y puesta en marcha.' },
      { title: 'Repuestos y service', text: 'Módulos, fuentes y placas después de instalar.' },
    ],
  },
  projects: {
    title: 'Así se ven',
    items: [
      { image: 'imagenes_productos/soluciones/LPR9648.webp', caption: 'Control vehicular' },
      { image: 'imagenes_productos/soluciones/LPR1248-2.webp', caption: 'Con pescante' },
      { image: 'imagenes_productos/soluciones/LPR1264-2.webp', caption: 'Panel LED' },
    ],
  },
  closing: {
    title: 'Consultá por tu pórtico',
    lead: 'Decinos dónde va y el ancho disponible.',
  },
  wa: {
    quote: 'Hola, quiero consultar por un pórtico LED.\n\nDónde va: \nAncho disponible: \nVelocidad de paso: ',
    advice: 'Hola, estoy viendo los pórticos LED y quiero asesoramiento para mi proyecto vial.',
  },
});
