import { defineLanding } from '../../lib/landing';

export default defineLanding({
  slug: 'iluminacion-profesional',
  category: 'iluminacion-profesional',
  product: 'Iluminación profesional',
  trackingVersion: '20260813-beacon1',
  seo: {
    title: 'Iluminación profesional para escenarios y eventos | RTM',
    description: 'Cabezales móviles beam y 3 en 1, barras móviles y flashes LED para shows, salones y producciones. Servicio técnico y repuestos posventa en Argentina.',
    ogImage: '/proyectos_imagenes/conjunto_2_1.webp',
  },
  hero: {
    h1: ['Iluminación', 'profesional'],
    accent: 'para escenarios, salones y producciones',
    lead: 'Cabezales, barras y flashes para show.',
    image: 'proyectos_imagenes/conjunto_2_1.webp',
  },
  statement: 'El rig, según tu espacio.',
  models: {
    title: 'Modelos',
    groups: { beam: 'Beam', '3en1': '3 en 1', 'barras-moviles': 'Barras móviles', flashes: 'Flashes' },
    specs: [['potencia', 'Potencia'], ['leds', 'LEDs']],
    note: 'Con repuestos y service posventa.',
  },
  process: {
    steps: [
      { title: 'Definición del rig', text: 'Espacio, altura y tipo de show.' },
      { title: 'Selección y entrega', text: 'Equipos verificados antes de entregar.' },
      { title: 'Repuestos y service', text: 'Lámparas y placas de lo que entregamos.' },
    ],
  },
  projects: {
    title: 'Salones y shows',
    items: [
      { image: 'proyectos_imagenes/conjunto_2_2.webp', caption: 'Salón de eventos' },
      { image: 'imagenes_productos/iluminacion_profesional/3_en_1/cmr_250_led/cmr250-3.webp', caption: 'Cabezal 3 en 1' },
      { image: 'imagenes_productos/iluminacion_profesional/barra_movil/barramovil-1.webp', caption: 'Barra móvil' },
    ],
  },
  closing: {
    title: 'Armemos tu rig',
    lead: 'Espacio, altura de montaje y equipos que ya tenés.',
  },
  wa: {
    quote: 'Hola, quiero cotizar equipos de iluminación.\n\nTipo de espacio: \nAltura de montaje: \nEquipos que ya tengo: ',
    advice: 'Hola, estoy viendo los equipos de iluminación y quiero asesoramiento para armar el rig.',
  },
});
