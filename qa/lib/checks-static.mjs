// Chequeos que no necesitan navegador. Cada resultado:
//   { id, gate: 'contract' | 'target', status: 'pass' | 'fail' | 'warn' | 'skip', page?, detail }
// contract = tiene que pasar en el sitio actual Y en el refactor (lo que Ads/tracking/SEO leen).
// target   = objetivo del rediseño: se espera que falle hoy y tiene que pasar en el refactor.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SITE_ORIGIN, pagePath, resolvePagePath, amplifyArtifactGlobs, coveredByGlobs,
} from './extract.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diffSets = (before, after) => ({
  removed: before.filter(x => !after.includes(x)),
  added: after.filter(x => !before.includes(x)),
});

// Lo que se guarda como línea base: lo comparable, sin el texto ni los ids completos.
export function baselineFromSite(site, root) {
  const pages = {};
  for (const [page, p] of Object.entries(site.pages)) {
    pages[page] = {
      title: p.title, description: p.description, canonical: p.canonical, robots: p.robots, h1: p.h1,
      jsonLdTypes: p.jsonLdTypes, tags: p.tags, hasTrackingScript: Boolean(p.trackingScript),
      conversions: p.conversions, waLinks: p.waLinks.length, redirect: p.redirect,
    };
  }
  return { pages, sitemap: site.sitemap, brokenRefs: brokenRefs(site, root) };
}

function brokenRefs(site, root) {
  const broken = new Set();
  for (const [page, p] of Object.entries(site.pages)) {
    for (const ref of [...p.localRefs, ...p.internalLinks]) {
      if (!resolvePagePath(root, ref)) broken.add(`${page} -> ${ref}`);
    }
  }
  return [...broken].sort();
}

export function staticChecks({ root, site, baseline, ads, allowed = [] }) {
  const results = [];
  const push = (r) => {
    const approval = r.status === 'fail' && allowed.find(a => a.check === r.id && (!a.page || a.page === r.page));
    results.push(approval ? { ...r, status: 'allowed', detail: `${r.detail} · aprobado: ${approval.reason}` } : r);
  };

  // ---------- A. Contrato Google Ads ----------
  if (ads) {
    for (const ad of ads.ads) {
      for (const url of ad.finalUrls) {
        const u = new URL(url);
        const page = resolvePagePath(root, u.pathname);
        push({
          id: 'A1-final-url', gate: 'contract', page: u.pathname,
          status: page ? 'pass' : ad.serving ? 'fail' : 'warn',
          detail: `${ad.adGroup} (${ad.serving ? 'sirviendo' : 'no sirve'}) → ${u.pathname}${page ? '' : ' NO EXISTE'}`,
        });
        push({
          id: 'A1-tracking-on-landing', gate: 'contract', page: u.pathname,
          status: !page ? 'skip' : site.pages[page]?.trackingScript ? 'pass' : ad.serving ? 'fail' : 'warn',
          detail: 'conversion-tracking.js tiene que cargar donde aterriza el anuncio (captura de gclid)',
        });
      }
    }

    for (const link of ads.sitelinks) {
      for (const url of link.finalUrls) {
        const u = new URL(url);
        if (u.origin !== SITE_ORIGIN) continue;
        const page = resolvePagePath(root, u.pathname);
        const where = `sitelink "${link.text}" (${link.owner}, ${link.serving ? 'sirviendo' : 'no sirve'})`;
        const bad = link.serving ? 'fail' : 'warn';
        if (!page) {
          push({ id: 'A2-sitelink-url', gate: 'contract', page: u.pathname, status: bad, detail: `${where}: ${u.pathname} no existe` });
          continue;
        }
        if (u.hash) {
          const id = decodeURIComponent(u.hash.slice(1));
          const ok = site.pages[page]?.ids.includes(id);
          push({ id: 'A2-sitelink-anchor', gate: 'contract', page, status: ok ? 'pass' : bad, detail: `${where}: #${id}${ok ? '' : ' no existe'}` });
        } else {
          push({ id: 'A2-sitelink-url', gate: 'contract', page, status: 'pass', detail: `${where}: ${u.pathname}${u.search}` });
        }
        if (u.search && page === 'productos.html') {
          const cat = u.searchParams.get('cat');
          const sub = u.searchParams.get('sub');
          const model = u.searchParams.get('model');
          const category = site.products?.categories.find(c => c.slug === cat);
          const subcategory = sub ? category?.subcategories?.find(s => s.slug === sub) : null;
          const found = category && (!sub || subcategory) && (!model || subcategory?.models?.some(m => m.slug === model));
          push({
            id: 'A3-sitelink-catalog-data', gate: 'contract', page, status: found ? 'pass' : bad,
            detail: `${where}: cat=${cat} sub=${sub ?? '-'} model=${model ?? '-'}${found ? '' : ' no está en data/products.json'}`,
          });
        }
      }
    }
  }

  // ---------- Comparación página por página contra la línea base ----------
  for (const [page, before] of Object.entries(baseline.pages)) {
    const now = site.pages[page];
    if (!now) {
      push({ id: 'D0-page-exists', gate: 'contract', page, status: 'fail', detail: `${pagePath(page)} desapareció` });
      continue;
    }

    for (const field of ['title', 'description', 'canonical', 'robots', 'h1']) {
      push({
        id: `D1-${field}`, gate: 'contract', page,
        status: same(before[field], now[field]) ? 'pass' : 'fail',
        detail: same(before[field], now[field]) ? String(now[field]) : `${JSON.stringify(before[field])} → ${JSON.stringify(now[field])}`,
      });
    }

    const ldOk = same(before.jsonLdTypes, now.jsonLdTypes) && !now.jsonLdTypes.includes('INVALID_JSON');
    push({ id: 'D2-jsonld', gate: 'contract', page, status: ldOk ? 'pass' : 'fail', detail: `${before.jsonLdTypes} → ${now.jsonLdTypes}` });

    // Contrato: ningún tag desaparece y ninguno pierde el guard que tenía. Que TODOS tengan guard es objetivo.
    for (const [tag, state] of Object.entries(before.tags)) {
      if (state === 'absent') continue;
      const worse = now.tags[tag] === 'absent' || (state === 'guarded' && now.tags[tag] !== 'guarded');
      push({ id: `B1-tag-${tag}`, gate: 'contract', page, status: worse ? 'fail' : 'pass', detail: `${tag}: ${state} → ${now.tags[tag]}` });
      if (now.tags[tag] !== 'absent') {
        push({ id: 'T-tags-guarded', gate: 'target', page, status: now.tags[tag] === 'guarded' ? 'pass' : 'fail', detail: `${tag} ${now.tags[tag] === 'guarded' ? 'sólo en producción' : 'carga también en localhost/previews'}` });
      }
    }

    if (before.hasTrackingScript) {
      const versioned = /\?v=/.test(now.trackingScript || '');
      push({
        id: 'B2-tracking-script', gate: 'contract', page,
        status: now.trackingScript && versioned ? 'pass' : 'fail',
        detail: now.trackingScript ? `${now.trackingScript}${versioned ? '' : ' sin ?v= (caché vieja)'}` : 'conversion-tracking.js ya no carga',
      });
    }

    const conv = diffSets(before.conversions, now.conversions);
    push({
      id: 'C2-conversion-attributes', gate: 'contract', page,
      status: conv.removed.length || conv.added.length ? 'fail' : 'pass',
      detail: conv.removed.length || conv.added.length
        ? `quitados: [${conv.removed.join(', ')}] agregados: [${conv.added.join(', ')}]`
        : `${now.conversions.length} combinaciones data-conversion|placement|context`,
    });

    if (before.redirect) {
      const ok = now.redirect?.preservesQuery && now.redirect?.preservesHash;
      push({ id: 'A4-redirect-static', gate: 'contract', page, status: ok ? 'pass' : 'fail', detail: `redirección conserva query+hash: ${Boolean(ok)}` });
    }
  }

  // ---------- Invariantes del código de referencia de WhatsApp ----------
  for (const [page, p] of Object.entries(site.pages)) {
    const badPhone = p.waLinks.filter(l => l.phone !== '5491151531530');
    const noText = p.waLinks.filter(l => !l.text.trim());
    const problems = [
      ...p.waNonAnchors.map(x => `${x} no es <a href="https://wa.me/...">`),
      ...badPhone.map(l => `teléfono ${l.phone}`),
      ...(noText.length ? [`${noText.length} enlaces sin texto prellenado`] : []),
    ];
    if (p.waLinks.length || p.waNonAnchors.length) {
      push({ id: 'C9-whatsapp-anchors', gate: 'contract', page, status: problems.length ? 'fail' : 'pass', detail: problems.join('; ') || `${p.waLinks.length} enlaces wa.me reales con texto` });
    }
  }

  // ---------- D3. Sitemap y enlaces ----------
  const sm = diffSets(baseline.sitemap, site.sitemap);
  push({
    id: 'D3-sitemap', gate: 'contract', status: sm.removed.length || sm.added.length ? 'fail' : 'pass',
    detail: sm.removed.length || sm.added.length ? `quitadas: [${sm.removed}] agregadas: [${sm.added}]` : `${site.sitemap.length} URLs sin cambios`,
  });
  for (const loc of site.sitemap) {
    const u = new URL(loc);
    if (!resolvePagePath(root, u.pathname)) push({ id: 'D3-sitemap-resolves', gate: 'contract', page: u.pathname, status: 'fail', detail: `${loc} está en el sitemap y no existe` });
  }
  const broken = brokenRefs(site, root);
  const newBroken = broken.filter(b => !baseline.brokenRefs.includes(b));
  push({
    id: 'D3-broken-refs', gate: 'contract', status: newBroken.length ? 'fail' : 'pass',
    detail: newBroken.length ? `rotos nuevos: ${newBroken.slice(0, 15).join(' | ')}` : `sin roturas nuevas (${broken.length} preexistentes)`,
  });

  // ---------- I1. Amplify publica todo lo que las páginas usan ----------
  const amplify = amplifyArtifactGlobs(root);
  if (!amplify) {
    push({ id: 'I1-amplify-artifacts', gate: 'contract', status: 'fail', detail: 'no hay amplify.yml' });
  } else {
    const needed = new Set(Object.keys(site.pages));
    for (const p of Object.values(site.pages)) {
      for (const ref of [...p.localRefs, ...p.internalLinks]) {
        const file = resolvePagePath(root, ref);
        if (file) needed.add(file);
      }
    }
    for (const extra of ['robots.txt', 'sitemap.xml', 'favicon.ico']) if (existsSync(join(root, extra))) needed.add(extra);
    const uncovered = [...needed].filter(f => !coveredByGlobs(f, amplify.globs)).sort();
    push({
      id: 'I1-amplify-artifacts', gate: 'contract', status: uncovered.length ? 'fail' : 'pass',
      detail: uncovered.length ? `amplify.yml no publica: ${uncovered.slice(0, 20).join(', ')}` : `${needed.size} archivos usados, todos cubiertos por artifacts.files`,
    });
  }

  // ---------- Objetivos del rediseño ----------
  for (const [page, p] of Object.entries(site.pages)) {
    if (p.redirect) continue;
    const dashes = (`${p.title} ${p.visibleText}`.match(/[—–]/g) || []).length;
    push({ id: 'T-no-em-dash', gate: 'target', page, status: dashes ? 'fail' : 'pass', detail: `${dashes} em/en-dash visibles` });

    const primary = p.waCtaLabels.filter(c => !/footer/.test(c.placement)).map(c => c.label).filter(Boolean);
    const distinct = [...new Set(primary)];
    if (primary.length) {
      push({ id: 'T-one-cta-label', gate: 'target', page, status: distinct.length <= 1 ? 'pass' : 'fail', detail: `textos de cotizar: ${distinct.map(d => `"${d}"`).join(', ')}` });
    }
  }

  const paletteFile = new URL('../palette.json', import.meta.url);
  if (!existsSync(paletteFile)) {
    push({ id: 'T-palette', gate: 'target', status: 'skip', detail: 'qa/palette.json todavía no existe (se define en F2)' });
  } else {
    const palette = JSON.parse(readFileSync(paletteFile, 'utf8')).colors.map(c => c.toLowerCase());
    const cssFiles = new Set(Object.values(site.pages).flatMap(p => p.stylesheets).filter(h => h.startsWith('/')).map(h => h.split('?')[0]));
    const offPalette = new Set();
    for (const css of cssFiles) {
      const file = join(root, css);
      if (!existsSync(file)) continue;
      for (const m of readFileSync(file, 'utf8').matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
        if (!palette.includes(m[0].toLowerCase())) offPalette.add(m[0].toLowerCase());
      }
    }
    push({ id: 'T-palette', gate: 'target', status: offPalette.size ? 'fail' : 'pass', detail: offPalette.size ? `fuera de paleta: ${[...offPalette].join(' ')}` : 'todos los colores en paleta' });
  }

  return results;
}
