// Extracción estática del contrato de un sitio a partir de sus archivos HTML.
// Lo que se extrae acá es lo que Google Ads, GA4, Clarity, Meta y el buscador leen del HTML.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

export const SITE_ORIGIN = 'https://pantallasledrtm.com';
export const TAG_IDS = {
  googleAds: 'AW-18364923277',
  ga4: 'G-6BP4Y1KSSK',
  clarity: 'xvo6v2qw7h',
  metaPixel: '1666229321733217',
};
const PROD_GUARD = 'pantallasledrtm\\.com';
const WA_HREF = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//i;

export function listPages(root) {
  const pages = readdirSync(root).filter(f => f.endsWith('.html')).sort();
  const productos = join(root, 'productos');
  if (existsSync(productos)) {
    pages.push(...readdirSync(productos).filter(f => f.endsWith('.html')).sort().map(f => `productos/${f}`));
  }
  return pages;
}

const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();

// Igual que nearestDatasetValue en conversion-tracking.js: el atributo puede estar en un ancestro.
function nearestAttr(el, name) {
  for (let node = el; node && node.getAttribute; node = node.parentNode) {
    const value = node.getAttribute(name);
    if (value) return value;
  }
  return '';
}

export function pagePath(page) {
  return page === 'index.html' ? '/' : `/${page}`;
}

export function resolvePagePath(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  const candidates = clean === '/' || clean === '' ? ['index.html'] : [clean.replace(/^\//, '')];
  for (const c of candidates) {
    const full = join(root, c);
    if (existsSync(full) && statSync(full).isFile()) return c;
    if (existsSync(join(full, 'index.html'))) return join(c, 'index.html');
  }
  return null;
}

export function extractPage(root, page) {
  const html = readFileSync(join(root, page), 'utf8');
  const doc = parse(html, { comment: false });
  const meta = name => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;

  const inlineScripts = doc.querySelectorAll('script:not([src])').map(s => s.textContent);
  const tags = {};
  for (const [key, id] of Object.entries(TAG_IDS)) {
    const blocks = inlineScripts.filter(t => t.includes(id));
    tags[key] = blocks.length === 0 ? 'absent' : blocks.every(t => t.includes(PROD_GUARD)) ? 'guarded' : 'unguarded';
  }

  const scripts = doc.querySelectorAll('script[src]').map(s => s.getAttribute('src'));
  const tracking = scripts.find(s => /conversion-tracking\.js/.test(s)) ?? null;

  const conversions = [...new Set(doc.querySelectorAll('[data-conversion]').map(el => [
    el.getAttribute('data-conversion'),
    nearestAttr(el, 'data-conversion-placement'),
    nearestAttr(el, 'data-context'),
  ].join('|')))].sort();

  const waLinks = doc.querySelectorAll('a[href]')
    .map(a => a.getAttribute('href'))
    .filter(h => WA_HREF.test(h))
    .map(h => {
      const url = new URL(h);
      return { phone: url.pathname.replace(/\//g, '') || url.searchParams.get('phone'), text: url.searchParams.get('text') || '' };
    });

  // Botones de WhatsApp que NO son <a href> reales: rompen el decorado del código de referencia.
  const waNonAnchors = doc.querySelectorAll('[data-conversion^="whatsapp"]')
    .filter(el => el.tagName !== 'A' || !WA_HREF.test(el.getAttribute('href') || ''))
    .map(el => `${el.tagName.toLowerCase()}[data-conversion=${el.getAttribute('data-conversion')}]`);

  const waCtaLabels = doc.querySelectorAll('a[data-conversion^="whatsapp"]').map(a => ({
    placement: nearestAttr(a, 'data-conversion-placement') || a.getAttribute('data-conversion'),
    label: norm(a.textContent) || a.getAttribute('aria-label') || '',
  }));

  const jsonLdTypes = doc.querySelectorAll('script[type="application/ld+json"]').flatMap(s => {
    try {
      const data = JSON.parse(s.textContent);
      return (Array.isArray(data) ? data : [data]).map(d => d['@type']).flat();
    } catch {
      return ['INVALID_JSON'];
    }
  }).sort();

  const localRefs = new Set();
  const internalLinks = new Set();
  for (const el of doc.querySelectorAll('[src], [href], [srcset]')) {
    const isAnchor = el.tagName === 'A';
    const values = [el.getAttribute('src'), el.getAttribute('href'),
      ...(el.getAttribute('srcset') || '').split(',').map(p => p.trim().split(/\s+/)[0])];
    for (const raw of values) {
      if (!raw || /^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
      let url;
      try { url = new URL(raw, `${SITE_ORIGIN}/${page}`); } catch { continue; }
      if (url.origin !== SITE_ORIGIN) continue;
      (isAnchor ? internalLinks : localRefs).add(url.pathname);
    }
  }
  // url(...) dentro de style="" (ej. --lp-hero-image) también es un asset publicado.
  for (const m of html.matchAll(/url\(['"]?(\/[^'")]+)['"]?\)/g)) localRefs.add(m[1]);

  const redirectScript = inlineScripts.find(t => /location\.replace\(/.test(t));

  return {
    title: norm(doc.querySelector('title')?.textContent) || null,
    description: meta('description'),
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    robots: meta('robots'),
    h1: doc.querySelectorAll('h1').map(h => norm(h.textContent)),
    jsonLdTypes,
    ids: doc.querySelectorAll('[id]').map(el => el.getAttribute('id')).sort(),
    tags,
    trackingScript: tracking,
    conversions,
    waLinks,
    waNonAnchors,
    waCtaLabels,
    redirect: redirectScript
      ? { preservesQuery: /location\.search/.test(redirectScript), preservesHash: /location\.hash/.test(redirectScript) }
      : null,
    localRefs: [...localRefs].sort(),
    internalLinks: [...internalLinks].sort(),
    visibleText: visibleText(html),
    stylesheets: doc.querySelectorAll('link[rel="stylesheet"]').map(l => l.getAttribute('href')),
  };
}

function visibleText(html) {
  const body = parse(html).querySelector('body');
  if (!body) return '';
  body.querySelectorAll('script, style, noscript, svg, template').forEach(n => n.remove());
  const alts = body.querySelectorAll('[alt]').map(el => el.getAttribute('alt'));
  return norm(`${body.textContent} ${alts.join(' ')}`);
}

export function extractSite(root) {
  const pages = {};
  for (const page of listPages(root)) pages[page] = extractPage(root, page);

  const sitemapFile = join(root, 'sitemap.xml');
  const sitemap = existsSync(sitemapFile)
    ? [...readFileSync(sitemapFile, 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]).sort()
    : [];

  const productsFile = join(root, 'data/products.json');
  const products = existsSync(productsFile) ? JSON.parse(readFileSync(productsFile, 'utf8')) : null;

  return { pages, sitemap, products };
}

// Globs de amplify.yml (artifacts.files). Sólo el subconjunto que usa ese archivo: nombres exactos y `dir/**/*`.
export function amplifyArtifactGlobs(root) {
  const file = join(root, 'amplify.yml');
  if (!existsSync(file)) return null;
  const yml = readFileSync(file, 'utf8');
  const section = yml.split(/^\s*artifacts:\s*$/m)[1]?.split(/^\s*files:\s*$/m)[1] ?? '';
  const globs = [];
  for (const line of section.split('\n')) {
    const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(#.*)?$/);
    if (m) globs.push(m[1].trim());
    else if (line.trim() && !line.trim().startsWith('#') && !/^\s*-/.test(line)) break;
  }
  const baseDirectory = yml.match(/baseDirectory:\s*(\S+)/)?.[1] ?? '.';
  return { baseDirectory, globs };
}

export function coveredByGlobs(path, globs) {
  const p = path.replace(/^\//, '');
  return globs.some(g => {
    if (g.endsWith('/**/*')) return p.startsWith(g.slice(0, -4));
    return p === g;
  });
}

