import type { Landing } from './landing';
import { modelGroups } from './landing';

/**
 * Menú de productos. Antes cada subcategoría llevaba a `productos.html?cat=…&sub=…`, es decir al
 * catálogo viejo: tocabas "Indoor" esperando la landing y caías en otra pantalla. Ahora la
 * subcategoría ancla en el bloque de modelos de la landing.
 *
 * Los `?cat=&sub=&model=` NO desaparecen del sitio: son los sitelinks que Google Ads tiene
 * cargados y los sigue leyendo `js/products.js` en productos.html. Acá sólo cambia a dónde
 * apunta el menú.
 */
export interface MenuItem { label: string; href: string }
export interface MenuCategory extends MenuItem { items: MenuItem[] }

const landings = Object.values(
  import.meta.glob<{ default: Landing }>('../data/landings/*.ts', { eager: true }),
).map(m => m.default);

// El orden del menú de producción: lo más buscado primero.
const ORDER = [
  'pantallas-led', 'tour-series', 'totems', 'pisos-led',
  'soluciones', 'porticos', 'led-trucks', 'iluminacion-profesional',
];

export const menuCategories: MenuCategory[] = ORDER
  .map(slug => landings.find(l => l.slug === slug))
  .filter((l): l is Landing => Boolean(l))
  .map(l => {
    const href = `/productos/${l.slug}.html`;
    const groups = modelGroups(l);
    // Con un solo grupo la plantilla no imprime su título, así que el ancla es la sección entera.
    const items = groups.length > 1
      ? groups.map(g => ({ label: g.name, href: `${href}#modelos-${g.slug}` }))
      : groups.length === 1
        ? [{ label: 'Modelos y medidas', href: `${href}#modelos-title` }]
        : [];
    return { label: l.product, href, items };
  });
