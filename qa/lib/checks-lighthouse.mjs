// E1. Lighthouse mobile (perfil por defecto: Moto G con throttling simulado), servido desde disco en localhost.
// Los números locales no son los de producción (sin CDN, sin tags de terceros por el guard de hostname),
// pero la línea base y el refactor se miden igual, así que la comparación es justa.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { resolvePagePath } from './extract.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4' };

function serve(root) {
  const server = createServer((req, res) => {
    const file = resolvePagePath(root, new URL(req.url, 'http://x').pathname);
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(join(root, file)));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

export async function lighthouseChecks({ root, pages, baseline }) {
  const server = await serve(root);
  const { port } = server.address();
  const chrome = await launch({ chromePath: CHROME, chromeFlags: ['--headless=new', '--disable-gpu'] });
  const results = [];
  try {
    for (const page of pages) {
      const path = page === 'index.html' ? '/' : `/${page}`;
      const { lhr } = await lighthouse(`http://127.0.0.1:${port}${path}`, {
        port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'seo'],
      });
      const metrics = {
        performance: Math.round(lhr.categories.performance.score * 100),
        accessibility: Math.round(lhr.categories.accessibility.score * 100),
        seo: Math.round(lhr.categories.seo.score * 100),
        lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
        cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
        tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue),
      };
      const before = baseline?.lighthouse?.[page];
      results.push({ id: 'E1-metrics', gate: 'data', page, status: 'info', detail: metrics });
      if (before) {
        // No empeorar más de 5 puntos respecto de la línea base: eso sí es contrato.
        for (const key of ['performance', 'accessibility', 'seo']) {
          const worse = metrics[key] < before[key] - 5;
          results.push({ id: `E1-${key}-not-worse`, gate: 'contract', page, status: worse ? 'fail' : 'pass', detail: `${before[key]} → ${metrics[key]}` });
        }
      }
      results.push({ id: 'T-lcp', gate: 'target', page, status: metrics.lcpMs < 2500 ? 'pass' : 'fail', detail: `LCP ${metrics.lcpMs} ms (objetivo < 2500)` });
      results.push({ id: 'T-cls', gate: 'target', page, status: metrics.cls < 0.1 ? 'pass' : 'fail', detail: `CLS ${metrics.cls} (objetivo < 0.1)` });
      results.push({ id: 'T-accessibility', gate: 'target', page, status: metrics.accessibility >= 95 ? 'pass' : 'fail', detail: `accesibilidad ${metrics.accessibility} (objetivo ≥ 95, público 50+)` });
    }
  } finally {
    await chrome.kill();
    server.close();
  }
  return results;
}
