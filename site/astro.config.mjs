import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  site: 'https://pantallasledrtm.com',
  // Google Ads y el índice apuntan a /productos/*.html: `file` genera exactamente esas rutas.
  build: { format: 'file' },
  vite: {
    // Las fotos viven en la raíz del repo; @repo las importa para que Astro genere tamaños responsive.
    resolve: { alias: { '@repo': repo } },
    server: { fs: { allow: [repo] } },
    // lightningcss fusiona animation + animation-timeline en un shorthand que Chrome descarta entero:
    // mataba todas las animaciones ligadas al scroll. esbuild no hace esa fusión.
    build: { cssMinify: 'esbuild' },
  },
});
