# Sitio RTM en Astro

Refactor del front de pantallasledrtm.com. Las páginas nuevas salen de Astro; el resto del sitio actual se
sirve tal cual por los symlinks de `public/` hasta que se migre.

```
npm install
npm run dev      # http://localhost:4321/productos/pantallas-led.html
npm run build    # dist/ = sitio completo, validable con la suite
```

## Condiciones del refactor (no negociables)

1. **Textos cortos.** Títulos de pocas palabras, una frase corta de apoyo, CTAs de 1 a 3 palabras.
   Especificaciones como datos sueltos, nunca oraciones. Nada de dos oraciones seguidas ni de párrafos.
   Nadie lee la página (79 % mobile, ~50 s por visita): si no se lee, no va. Ante la duda, cortar.
2. **Contrato con Google Ads, tracking y SEO.** No cambian sin aprobación:
   - URLs `/productos/<slug>.html`, `title`, `meta description`, `canonical` y el texto del H1.
   - Anclas `#modelos-title`, `#proceso-title`, `#cotizar` (sitelinks de Ads).
   - `data-conversion`, `data-conversion-placement`, `data-context` de cada botón.
   - WhatsApp siempre como `<a href="https://wa.me/...">` real, con texto prellenado corto y contextual.
   - `conversion-tracking.js` cargado con `?v=` y los tags del `<head>` con guard de hostname (los pone `Base.astro`).
   - Links al catálogo `productos.html?cat=&sub=&model=`.
3. **Sistema visual** (`src/styles/global.css`): colores de `css/main.css`; un solo rojo de acento; verde sólo
   en el botón fijo de WhatsApp; bandas alternadas; todo redondeado (14/20/28 px, botones pill); Inter Tight.
4. **Fotos reales** del repo (`proyectos_imagenes/`, `imagenes_productos/`). Nada generado ni de stock.
5. **Movimiento sólo CSS**, ligado al scroll y bajo `prefers-reduced-motion`. Nunca secuestrar el scroll.
   Build con `cssMinify: 'esbuild'` (lightningcss rompe `animation-timeline`).
6. **Accesible para 50+**: texto ≥ 17 px, contraste AA medido, blancos de toque grandes.

## Cómo se arma una landing de producto

Un archivo por landing en `src/data/landings/<slug>.ts` (ver `pantallas-led.ts` y el tipo en `src/lib/landing.ts`).
La plantilla `src/pages/productos/[slug].astro` pone la estructura, las anclas y el tracking. Los modelos salen de
`data/products.json` por `category`. Al agregar una landing, borrar su symlink de `public/productos/`.

## Validación

```
node <worktree qa>/qa/run.mjs --root site/dist [--skip-lighthouse]
```
La línea base de la suite viene de `feat/whatsapp-ref-code`: comparar contra una corrida sobre `main`, no leer
el total a secas. Cualquier chequeo `contract` que pase en `main` y falle en `dist` es una regresión.
