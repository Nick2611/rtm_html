import { defineLanding } from '../../lib/landing';

export default defineLanding({
  slug: 'soluciones',
  category: 'soluciones',
  product: 'Soluciones LED',
  trackingVersion: '20260813-beacon1',
  seo: {
    title: 'Carteleras LED para colectivos y pantallas de diseño especial | RTM',
    description: 'Carteleras y lunetas LED para transporte público, con control por red 4G y GPS, y pantallas de diseño especial fabricadas a medida.',
    ogImage: '/proyectos_imagenes/conjunto_7_2.webp',
  },
  hero: {
    h1: ['Soluciones LED', 'a medida'],
    accent: 'transporte y proyectos especiales',
    lead: 'Colectivos y proyectos sin medida estándar.',
    image: 'proyectos_imagenes/conjunto_7_1.webp',
  },
  statement: 'Si no existe, lo fabricamos.',
  models: {
    title: 'Modelos',
    groups: { 'unidades-colectivos': 'Colectivos', 'disenos-especiales': 'Diseños especiales' },
    specs: [['pixelPitch', 'Pitch'], ['tamañoDelPanel', 'Panel'], ['tipo', 'Tipo']],
    note: 'Lunetas con actualización remota por 4G.',
  },
  process: {
    steps: [
      { title: 'Relevamiento', text: 'Punto de montaje, medidas y alimentación.' },
      { title: 'Fabricación e instalación', text: 'Armado a medida, montaje y prueba.' },
      { title: 'Repuestos y service', text: 'Módulos, fuentes y placas después de instalar.' },
    ],
  },
  projects: {
    title: 'Colectivos y proyectos',
    items: [
      { image: 'proyectos_imagenes/conjunto_7_2.webp', caption: 'Luneta trasera' },
      { image: 'proyectos_imagenes/conjunto_7_4.webp', caption: 'Marcas en la luneta' },
      { image: 'proyectos_imagenes/conjunto_6_1.webp', caption: 'Diseño especial' },
      { image: 'proyectos_imagenes/conjunto_7_3.webp', caption: 'Flota equipada' },
      { image: 'proyectos_imagenes/conjunto_6_2.webp', caption: 'Pantalla en esquina' },
    ],
  },
  closing: {
    title: 'Contanos tu proyecto',
    lead: 'Dónde se monta, qué muestra y a qué distancia.',
  },
  wa: {
    quote: 'Hola, quiero consultar por una solución LED a medida.\n\nDónde se monta: \nQué tiene que mostrar: \nMedida aproximada: ',
    advice: 'Hola, estoy viendo las soluciones LED a medida y quiero asesoramiento para mi proyecto.',
  },
});
