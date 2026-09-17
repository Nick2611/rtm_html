// Suite de validación del refactor.
//
//   node run.mjs --root <árbol del sitio> [--write-baseline] [--skip-browser] [--skip-lighthouse]
//                [--refresh-ads] [--origin https://pantallasledrtm.com]
//
// --write-baseline  guarda la línea base desde --root (se hace UNA vez, sobre el sitio que funciona).
// sin esa bandera   compara --root contra la línea base y sale con código 1 si falla algo del contrato.
// --refresh-ads     vuelve a leer la API de Ads antes de validar (la cuenta cambia seguido).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { extractSite, SITE_ORIGIN } from './lib/extract.mjs';
import { staticChecks, baselineFromSite } from './lib/checks-static.mjs';
import { testChecks } from './lib/checks-tests.mjs';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

const here = new URL('.', import.meta.url).pathname;
const root = resolve(option('--root', resolve(here, '..')));
const origin = option('--origin', SITE_ORIGIN);
const baselineFile = `${here}baseline/site.json`;
const adsFile = `${here}baseline/ads.json`;
const allowedFile = `${here}allowed-changes.json`;

if (flag('--refresh-ads') || !existsSync(adsFile)) {
  execFileSync('node', [`${here}ads-snapshot.mjs`, adsFile], { stdio: 'inherit' });
}
const ads = JSON.parse(readFileSync(adsFile, 'utf8'));
const allowed = existsSync(allowedFile) ? JSON.parse(readFileSync(allowedFile, 'utf8')) : [];
const site = extractSite(root);

// Páginas que se ejercitan en navegador: las que reciben anuncios, más catálogo, home y proyectos.
const adPages = [...new Set(ads.ads.flatMap(a => a.finalUrls).map(u => new URL(u).pathname.replace(/^\//, '') || 'index.html'))];
const browserPages = [...new Set([...adPages, 'productos.html', 'index.html', 'proyectos.html'])].filter(p => site.pages[p]);
const lighthousePages = [...new Set([...adPages.filter(p => !site.pages[p]?.redirect), 'productos.html'])].filter(p => site.pages[p]);

const writing = flag('--write-baseline');
let baseline = writing ? null : JSON.parse(readFileSync(baselineFile, 'utf8'));
if (writing) baseline = { ...baselineFromSite(site, root), takenFrom: root, takenAt: new Date().toISOString() };

const results = [];
results.push(...staticChecks({ root, site, baseline, ads, allowed }));
results.push(...testChecks({ root, baseline: writing ? null : baseline }));

if (!flag('--skip-browser')) {
  const { browserChecks } = await import('./lib/checks-browser.mjs');
  results.push(...await browserChecks({ root: flag('--no-root') ? null : root, origin, site, ads, pages: browserPages }));
  // C8: fuera de producción no puede salir ningún beacon. Una landing alcanza.
  const offProd = await browserChecks({ root, origin: 'http://127.0.0.1:9', site, ads, pages: [adPages.find(p => site.pages[p] && !site.pages[p].redirect)] });
  results.push(...offProd.filter(r => r.id === 'C8-no-beacon-off-prod' || r.id === 'C6-ref-code-in-href').map(r => ({ ...r, id: r.id === 'C6-ref-code-in-href' ? 'C8-ref-code-off-prod' : r.id })));
}

if (!flag('--skip-lighthouse')) {
  const { lighthouseChecks } = await import('./lib/checks-lighthouse.mjs');
  results.push(...await lighthouseChecks({ root, pages: lighthousePages, baseline: writing ? null : baseline }));
}

if (writing) {
  baseline.tests = Object.fromEntries(results.filter(r => r.id.startsWith('B3-') && r.status === 'pass').map(r => [r.id, r.count]));
  baseline.lighthouse = Object.fromEntries(results.filter(r => r.id === 'E1-metrics').map(r => [r.page, r.detail]));
  baseline.behaviour = Object.fromEntries(results.filter(r => r.id === 'behaviour').map(r => [r.page, r.detail]));
  mkdirSync(`${here}baseline`, { recursive: true });
  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n');
} else if (baseline.behaviour) {
  // El comportamiento observado (qué conversión dispara cada botón y con qué marca) tampoco puede cambiar.
  for (const r of results.filter(x => x.id === 'behaviour')) {
    const before = JSON.stringify(baseline.behaviour[r.page] ?? []);
    const norm = list => JSON.stringify([...list].map(e => JSON.stringify(e)).sort());
    const ok = norm(JSON.parse(before)) === norm(r.detail);
    const approval = !ok && allowed.find(a => a.check === 'C3-behaviour' && a.page === r.page);
    results.push({ id: 'C3-behaviour', gate: 'contract', page: r.page, status: ok ? 'pass' : approval ? 'allowed' : 'fail', detail: ok ? `${r.detail.length} botones con el mismo comportamiento` : `cambió el comportamiento de los botones${approval ? ` · aprobado: ${approval.reason}` : ''}` });
  }
}

// ---------- Reporte ----------
const shown = results.filter(r => r.gate !== 'data');
const group = (gate, status) => shown.filter(r => r.gate === gate && r.status === status);
const line = r => `  ${r.id.padEnd(34)} ${(r.page ?? '').padEnd(42)} ${typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)}`;

mkdirSync(`${here}reports`, { recursive: true });
const reportFile = `${here}reports/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(reportFile, JSON.stringify({ root, origin, writing, results }, null, 2));

for (const status of ['fail', 'warn', 'allowed']) {
  for (const gate of ['contract', 'target']) {
    const rows = group(gate, status);
    if (rows.length) console.log(`\n${gate.toUpperCase()} · ${status.toUpperCase()} (${rows.length})\n${rows.map(line).join('\n')}`);
  }
}
const count = (gate, status) => group(gate, status).length;
console.log(`
Contrato:  ${count('contract', 'pass')} ok · ${count('contract', 'fail')} fallan · ${count('contract', 'warn')} avisos · ${count('contract', 'allowed')} aprobados · ${count('contract', 'skip')} omitidos
Objetivos: ${count('target', 'pass')} ok · ${count('target', 'fail')} pendientes · ${count('target', 'skip')} omitidos
Árbol: ${root}${writing ? `\nLínea base escrita en ${baselineFile}` : ''}
Reporte: ${reportFile}`);

process.exitCode = count('contract', 'fail') ? 1 : 0;
