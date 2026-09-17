import type { ImageMetadata } from 'astro';
import products from '@repo/data/products.json';

/**
 * Una landing de producto = un archivo en src/data/landings/<slug>.ts con esta forma.
 * Regla de texto (condición del refactor): frases cortas y CTAs. Nada de párrafos.
 * CONTRATO con Google Ads/SEO: seo.title, seo.description y el H1 (hero.h1 + hero.accent) no se cambian
 * sin aprobación; los placements y anclas los pone la plantilla.
 */
export interface Landing {
  slug: string;              // = nombre del .html en /productos y data-context del tracking
  category: string;          // slug de la categoría en data/products.json
  product: string;           // nombre corto para aria-label ("Pantallas LED")
  trackingVersion: string;   // ?v= de conversion-tracking.js
  seo: { title: string; description: string; ogImage: string };
  hero: { h1: string[]; accent?: string; lead: string; image: string; focus?: string }; // focus: object-position ("30% 50%")
  statement: string;         // una frase corta
  models: {
    title: string;
    groups?: Record<string, string>;        // slug de subcategoría → nombre visible
    specs?: [key: string, label: string][]; // hasta 3 campos del modelo
    note?: string;
    gallery?: Media[];                      // sólo si la categoría no tiene modelos (LED Trucks)
  };
  process: { lead?: string; steps: { title: string; text: string }[] };
  projects: { title: string; items: Media[] };  // 3 a 5 fotos reales
  closing: { title: string; lead: string };
  wa: { quote: string; advice: string };
}
export interface Media { image: string; caption: string }

export const defineLanding = (l: Landing) => l;

// Todas las fotos del repo, resueltas por ruta ("proyectos_imagenes/proyecto_2.webp").
const images = import.meta.glob<{ default: ImageMetadata }>(
  ['@repo/proyectos_imagenes/*.webp', '@repo/imagenes_productos/**/*.webp', '@repo/imagenes_productos_restantes/**/*.webp'],
  { eager: true },
);
export function image(path: string): ImageMetadata {
  const hit = Object.entries(images).find(([k]) => k.endsWith(`/${path}`));
  if (!hit) throw new Error(`Imagen inexistente: ${path}`);
  return hit[1].default;
}

// Valores del catálogo en forma corta: "P1.25 / ... / P4" → "P1.25 a P4", "500 - 600 nits" → "500 a 600 nits",
// "960 x 960 x 100 mm" → "960 × 960 mm".
export function shortSpec(value: string): string {
  const v = String(value).trim();
  if (v.includes(' / ')) { const parts = v.split(' / '); return `${parts[0]} a ${parts.at(-1)}`; }
  const dims = v.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)(?:\s*x\s*\d+(?:[.,]\d+)?)?\s*(mm|cm|m)$/i);
  if (dims) return `${dims[1]} × ${dims[2]} ${dims[3]}`;
  // Sólo rangos numéricos ("500 - 600 nits"); "MSD-260 - 2000 horas" no es un rango.
  return /^\d/.test(v) ? v.replace(/(\d)\s+-\s+(\d)/g, '$1 a $2') : v;
}

export interface ModelCard {
  name: string; group: string; href: string; image: ImageMetadata; specs: [string, string][];
}
export function modelGroups(l: Landing): { name: string; models: ModelCard[] }[] {
  const category = products.categories.find(c => c.slug === l.category);
  if (!category) throw new Error(`Categoría inexistente en products.json: ${l.category}`);
  return (category.subcategories ?? [])
    .filter(sub => sub.models?.length)
    .map(sub => {
      const name = l.models.groups?.[sub.slug] ?? sub.name;
      return {
        name,
        models: sub.models.map((m: any) => ({
          name: m.name,
          group: name,
          href: `/productos.html?cat=${category.slug}&sub=${sub.slug}&model=${m.slug}`,
          image: image(m.image),
          specs: (l.models.specs ?? [])
            .map(([key, label]) => [label, key === 'pixelPitch' ? m.pixelPitch : m.specs?.[key]] as [string, string])
            .filter(([, value]) => value)
            .map(([label, value]) => [label, shortSpec(value)] as [string, string]),
        })),
      };
    });
}
