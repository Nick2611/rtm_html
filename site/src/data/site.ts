export const PHONE = '5491151531530';
export const PHONE_LABEL = '+54 9 11 5153 1530';
export const EMAIL = 'info@pantallasledrtm.com';

// Texto prellenado corto y contextual. conversion-tracking.js agrega la marca de origen al final al tocar.
export const wa = (text: string) => `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;

export const nav = [
  { label: 'Productos', href: '/productos.html' },
  { label: 'Proyectos', href: '/proyectos.html' },
  { label: 'Nosotros', href: '/index.html#about' },
];

// Letreros LED está dado de baja (redirige a Pantallas LED).
export const products = [
  { label: 'Pantallas LED', href: '/productos/pantallas-led.html' },
  { label: 'Tour Series', href: '/productos/tour-series.html' },
  { label: 'Tótems', href: '/productos/totems.html' },
  { label: 'Pisos LED', href: '/productos/pisos-led.html' },
  { label: 'Pórticos', href: '/productos/porticos.html' },
  { label: 'Soluciones', href: '/productos/soluciones.html' },
  { label: 'LED Trucks', href: '/productos/led-trucks.html' },
  { label: 'Iluminación Profesional', href: '/productos/iluminacion-profesional.html' },
];
