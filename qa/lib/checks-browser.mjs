// Chequeos en Chrome real (playwright-core con el Chrome instalado, sin descargar navegadores).
//
// SEGURIDAD: nada sale a la red salvo el propio sitio.
// - Con --root, las páginas se sirven desde disco BAJO el origen de producción (interceptando la
//   petición), para que el guard de hostname se comporte como en producción.
// - Google, Clarity y Meta se bloquean; gtag/clarity/fbq quedan como stubs que sólo registran.
// - La Lambda NUNCA recibe nada: sendBeacon se reemplaza por un registrador y la ruta se corta.
// - Los clics se cancelan en la última fase, así no se navega a WhatsApp ni se abre nada.
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { SITE_ORIGIN, resolvePagePath } from './extract.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LAMBDA_HOST = 'execute-api.us-east-1.amazonaws.com';
const WA_CONVERSION = 'AW-18364923277/SE7ZCOGiqd4cEI37ibVE';
const GA4_ID = 'G-6BP4Y1KSSK';
const REF = /\(rtm: ([^)]*?) · #([2-9A-HJKMNP-Z]{5})\)$/;
const TEST_GCLID = 'QA-test_gclid_0000000001';
const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

const INIT = `
  window.__qa = { beacons: [], clarity: [], fbq: [], prevented: [] };
  const record = (url, body) => { window.__qa.beacons.push({ url: String(url), body: String(body ?? '') }); return true; };
  try { Object.defineProperty(navigator, 'sendBeacon', { value: record, configurable: true }); } catch (e) { navigator.sendBeacon = record; }
  const realFetch = window.fetch;
  window.fetch = (input, init) => {
    const url = String(input && input.url || input);
    if (url.includes('${LAMBDA_HOST}')) { record(url, init && init.body); return Promise.resolve(new Response(null, { status: 204 })); }
    return realFetch(input, init);
  };
  window.clarity = function () { window.__qa.clarity.push(JSON.stringify([...arguments])); };
  window.fbq = function () { window.__qa.fbq.push(JSON.stringify([...arguments])); };
  window.fbq.loaded = true; window._fbq = window.fbq;
  window.addEventListener('click', (e) => {
    window.__qa.prevented.push(e.defaultPrevented);
    e.preventDefault();
  }, false);
`;

async function routeSite(context, { root, origin }) {
  const originHost = new URL(origin).host;
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.host.endsWith(LAMBDA_HOST)) return route.fulfill({ status: 204, body: '' });
    if (url.host !== originHost) return route.abort();
    if (!root) return route.continue();
    const file = resolvePagePath(root, url.pathname);
    if (!file) return route.fulfill({ status: 404, body: 'not found' });
    const full = join(root, file);
    return route.fulfill({ status: 200, contentType: TYPES[extname(full)] || 'application/octet-stream', body: readFileSync(full) });
  });
}

const dataLayerEntries = (page) => page.evaluate(() => (window.dataLayer || []).map(e => {
  try { return JSON.parse(JSON.stringify(Array.from(e))); } catch { return null; }
}).filter(Boolean));

export async function browserChecks({ root, origin = SITE_ORIGIN, site, ads, pages, lambdaExpected }) {
  const results = [];
  const push = r => results.push(r);
  const prodHost = /(^|\.)pantallasledrtm\.com$/i.test(new URL(origin).hostname);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  // URL de aterrizaje real por página: la del anuncio con su sufijo, con valores de ejemplo.
  const suffixFor = {};
  for (const ad of ads?.ads || []) {
    for (const u of ad.finalUrls) {
      if (!ad.finalUrlSuffix) continue;
      suffixFor[new URL(u).pathname] = ad.finalUrlSuffix
        .replace('{keyword}', 'qa').replace('{matchtype}', 'e').replace('{device}', 'm')
        .replace('{adgroupid}', '1').replace('{creative}', '1');
    }
  }

  try {
    // ---------- C. Conversiones, código de referencia y click ids, página por página ----------
    for (const page of pages) {
      const path = page === 'index.html' ? '/' : `/${page}`;
      if (site.pages[page]?.redirect) continue;
      const context = await browser.newContext({ ...MOBILE });
      await context.addInitScript(INIT);
      await routeSite(context, { root, origin });
      const tab = await context.newPage();
      context.on('page', p => p !== tab && p.close());

      const query = [suffixFor[path], `gclid=${TEST_GCLID}`].filter(Boolean).join('&');
      await tab.goto(`${origin}${path}?${query}`, { waitUntil: 'load' });
      await tab.waitForTimeout(300);

      const stored = await tab.evaluate(() => ({
        clickIds: localStorage.getItem('rtm_ads_click_ids'),
        utm: sessionStorage.getItem('rtm_conversion_utm'),
      }));
      push({ id: 'C7-click-ids-captured', gate: 'contract', page, status: stored.clickIds?.includes(TEST_GCLID) ? 'pass' : 'fail', detail: `rtm_ads_click_ids=${stored.clickIds ?? 'vacío'}` });
      if (suffixFor[path]) {
        push({ id: 'A5-utm-captured', gate: 'contract', page, status: stored.utm?.includes('utm_content') ? 'pass' : 'fail', detail: `rtm_conversion_utm=${stored.utm ?? 'vacío'}` });
      }

      const count = await tab.locator('[data-conversion]').count();
      const codes = new Set();
      const behaviour = [];
      for (let i = 0; i < count; i += 1) {
        const el = tab.locator('[data-conversion]').nth(i);
        const info = await el.evaluate(n => ({
          conversion: n.getAttribute('data-conversion'),
          placement: n.closest('[data-conversion-placement]')?.getAttribute('data-conversion-placement') || '',
          href: n.closest('a[href]')?.getAttribute('href') || '',
        }));
        const layerBefore = (await dataLayerEntries(tab)).length;
        await tab.evaluate(() => { window.__qa.beacons = []; window.__qa.clarity = []; window.__qa.prevented = []; });
        await el.evaluate(n => n.click());
        await tab.waitForTimeout(60);

        const after = await el.evaluate(n => n.closest('a[href]')?.getAttribute('href') || '');
        const qa = await tab.evaluate(() => window.__qa);
        const layer = (await dataLayerEntries(tab)).slice(layerBefore);
        const label = `${info.conversion}|${info.placement}`;
        const isWa = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(info.href);

        push({ id: 'C0-no-prevent-default', gate: 'contract', page, status: qa.prevented.some(Boolean) ? 'fail' : 'pass', detail: `${label}: la página ${qa.prevented.some(Boolean) ? 'CANCELA' : 'no cancela'} el clic antes del tracking` });

        const adsWa = layer.filter(e => e[0] === 'event' && e[1] === 'conversion' && e[2]?.send_to === WA_CONVERSION);
        const ga4 = layer.filter(e => e[0] === 'event' && e[2]?.send_to === GA4_ID);
        let entry = { conversion: info.conversion, placement: info.placement, whatsapp: isWa };

        if (isWa) {
          const text = new URL(after).searchParams.get('text') || '';
          const m = text.match(REF);
          const code = m?.[2];
          if (code) codes.add(code);
          push({ id: 'C6-ref-code-in-href', gate: 'contract', page, status: m ? 'pass' : 'fail', detail: `${label}: ${m ? `(rtm: ${m[1]} · #${code})` : `sin marca al final: …${text.slice(-60)}`}` });
          entry.ref = m?.[1] ?? null;

          const beacons = qa.beacons.filter(b => b.url.includes(LAMBDA_HOST));
          const expectBeacon = lambdaExpected ?? prodHost;
          if (expectBeacon) {
            let body = null;
            try { body = JSON.parse(beacons[0]?.body); } catch { /* sin cuerpo */ }
            const ok = beacons.length === 1 && body?.ref === code && body?.context?.clickIds?.gclid === TEST_GCLID;
            push({ id: 'C6-lambda-beacon', gate: 'contract', page, status: ok ? 'pass' : 'fail', detail: `${label}: ${beacons.length} beacon(s), ref=${body?.ref ?? '-'}, gclid=${body?.context?.clickIds?.gclid ?? '-'}` });
          } else {
            push({ id: 'C8-no-beacon-off-prod', gate: 'contract', page, status: beacons.length === 0 ? 'pass' : 'fail', detail: `${label}: ${beacons.length} beacon(s) fuera de producción` });
          }

          if (prodHost && /^whatsapp/.test(info.conversion)) {
            push({ id: 'C1-ads-whatsapp-conversion', gate: 'contract', page, status: adsWa.length === 1 ? 'pass' : 'fail', detail: `${label}: ${adsWa.length} conversión(es) WhatsApp - clic` });
            const g = ga4.find(e => e[1] === 'whatsapp_click');
            const ga4Placement = String(g?.[2]?.placement ?? '').replace(/_/g, '-').toLowerCase();
            const hrefPlacement = m?.[1]?.split(' · ')[1] ?? '';
            push({ id: 'C1-ga4-whatsapp-click', gate: 'contract', page, status: g && ga4Placement === hrefPlacement ? 'pass' : 'fail', detail: `${label}: GA4 placement=${g?.[2]?.placement ?? 'sin evento'} · mensaje=${hrefPlacement}` });
            entry.ga4Placement = g?.[2]?.placement ?? null;
          }

          // Datos personales: ni el código ni el gclid pueden viajar a Clarity o GA4.
          const leaked = [...qa.clarity, ...ga4.map(e => JSON.stringify(e))].filter(s => (code && s.includes(code)) || s.includes(TEST_GCLID));
          push({ id: 'C5-no-pii-analytics', gate: 'contract', page, status: leaked.length ? 'fail' : 'pass', detail: `${label}: ${leaked.length ? `FUGA: ${leaked[0].slice(0, 120)}` : 'ni código ni gclid en Clarity/GA4'}` });
        } else if (prodHost) {
          push({ id: 'C1-no-stray-conversion', gate: 'contract', page, status: adsWa.length === 0 ? 'pass' : 'fail', detail: `${label}: ${adsWa.length} conversiones de WhatsApp en un clic que no es WhatsApp` });
        }
        behaviour.push(entry);
      }
      if (codes.size) {
        push({ id: 'C6-one-code-per-pageview', gate: 'contract', page, status: codes.size === 1 ? 'pass' : 'fail', detail: `${codes.size} código(s) distinto(s) en la misma vista` });
      }
      results.push({ id: 'behaviour', gate: 'data', page, status: 'info', detail: behaviour });
      await context.close();
    }

    // ---------- A3. Sitelinks al catálogo muestran lo que prometen ----------
    const catalogLinks = new Set();
    for (const link of ads?.sitelinks || []) {
      for (const url of link.finalUrls) {
        const u = new URL(url);
        if (u.origin === SITE_ORIGIN && u.pathname === '/productos.html' && u.search) catalogLinks.add(`${u.pathname}${u.search}|${link.serving}`);
      }
    }
    if (catalogLinks.size) {
      const context = await browser.newContext({ ...MOBILE });
      await context.addInitScript(INIT);
      await routeSite(context, { root, origin });
      const tab = await context.newPage();
      for (const item of catalogLinks) {
        const [target, serving] = item.split('|');
        const u = new URL(target, origin);
        const cat = site.products?.categories.find(c => c.slug === u.searchParams.get('cat'));
        const sub = cat?.subcategories?.find(s => s.slug === u.searchParams.get('sub'));
        const model = sub?.models?.find(m => m.slug === u.searchParams.get('model'));
        const expected = model?.name || sub?.name || cat?.name;
        await tab.goto(`${origin}${target}`, { waitUntil: 'load' });
        // Dentro del contenedor del catálogo, no en cualquier lugar de la página (el menú también nombra categorías).
        const ok = expected ? await tab.waitForFunction(
          name => {
            const box = document.querySelector('#product-content') || document.querySelector('main');
            const text = box?.innerText || '';
            return text.includes(name) && !/no encontrad/i.test(text);
          },
          expected, { timeout: 5000 },
        ).then(() => true, () => false) : false;
        push({ id: 'A3-sitelink-catalog-renders', gate: 'contract', page: target, status: ok ? 'pass' : serving === 'true' ? 'fail' : 'warn', detail: `"${expected ?? '?'}" ${ok ? 'visible en el catálogo' : 'no aparece en el catálogo'}` });
      }
      await context.close();
    }

    // ---------- A4. Redirecciones conservan gclid y hash ----------
    for (const [page, p] of Object.entries(site.pages)) {
      if (!p.redirect) continue;
      const context = await browser.newContext({ ...MOBILE });
      await context.addInitScript(INIT);
      await routeSite(context, { root, origin });
      const tab = await context.newPage();
      await tab.goto(`${origin}/${page}?gclid=${TEST_GCLID}&utm_content=qa#cotizar`);
      await tab.waitForURL(u => !u.pathname.endsWith(`/${page}`), { timeout: 5000 }).catch(() => {});
      const landed = new URL(tab.url());
      const ok = landed.searchParams.get('gclid') === TEST_GCLID && landed.hash === '#cotizar';
      push({ id: 'A4-redirect-keeps-query', gate: 'contract', page, status: ok ? 'pass' : 'fail', detail: `→ ${landed.pathname}${landed.search}${landed.hash}` });
      await context.close();
    }

    // ---------- E. Mobile, dock y movimiento ----------
    for (const page of pages) {
      if (site.pages[page]?.redirect) continue;
      const path = page === 'index.html' ? '/' : `/${page}`;
      for (const width of [360, 390]) {
        const context = await browser.newContext({ ...MOBILE, viewport: { width, height: 800 } });
        await context.addInitScript(INIT);
        await routeSite(context, { root, origin });
        const tab = await context.newPage();
        await tab.goto(`${origin}${path}`, { waitUntil: 'load' });
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        push({ id: 'E2-no-horizontal-scroll', gate: 'contract', page, status: overflow <= 1 ? 'pass' : 'fail', detail: `${width}px: ${overflow}px de desborde` });

        if (width === 390) {
          const dock = tab.locator('[data-conversion-placement*="persistent"]').first();
          if (await dock.count()) {
            await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await tab.waitForTimeout(400);
            const geo = await tab.evaluate(() => {
              const d = document.querySelector('[data-conversion-placement*="persistent"]').getBoundingClientRect();
              const f = document.querySelector('[data-conversion-placement$="final"]')?.getBoundingClientRect();
              const visible = d.width > 0 && d.height > 0 && d.bottom <= window.innerHeight + 1 && d.top >= 0;
              const overlap = f ? !(f.bottom <= d.top || f.top >= d.bottom || f.right <= d.left || f.left >= d.right) : false;
              return { visible, overlap };
            });
            push({ id: 'E4-dock-visible', gate: 'contract', page, status: geo.visible ? 'pass' : 'fail', detail: `dock de WhatsApp visible al final de la página: ${geo.visible}` });
            push({ id: 'E4-dock-not-covering-final-cta', gate: 'contract', page, status: geo.overlap ? 'fail' : 'pass', detail: `el dock ${geo.overlap ? 'TAPA' : 'no tapa'} el CTA final` });
          }
        }
        await context.close();
      }

      const context = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' });
      await context.addInitScript(INIT);
      await routeSite(context, { root, origin });
      const tab = await context.newPage();
      await tab.goto(`${origin}${path}`, { waitUntil: 'load' });
      await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      await tab.waitForTimeout(500);
      const moving = await tab.evaluate(() => document.getAnimations()
        .filter(a => a.playState === 'running')
        .map(a => ({ name: a.animationName || a.transitionProperty || a.constructor.name, duration: a.effect?.getTiming().duration, iterations: a.effect?.getTiming().iterations }))
        .filter(a => a.iterations === Infinity || Number(a.duration) > 50));
      const autoplay = await tab.evaluate(() => [...document.querySelectorAll('video')].filter(v => !v.paused).length);
      push({ id: 'T-reduced-motion', gate: 'target', page, status: moving.length || autoplay ? 'fail' : 'pass', detail: `con reduced-motion: ${moving.length} animaciones en curso, ${autoplay} videos reproduciéndose${moving.length ? ` (${moving.slice(0, 3).map(m => m.name).join(', ')})` : ''}` });
      await context.close();
    }

    // ---------- D4. Catálogo indexable sin JavaScript ----------
    if (site.pages['productos.html'] && site.products) {
      const context = await browser.newContext({ ...MOBILE, javaScriptEnabled: false });
      await routeSite(context, { root, origin });
      const tab = await context.newPage();
      await tab.goto(`${origin}/productos.html`, { waitUntil: 'load' });
      const text = await tab.evaluate(() => document.body.innerText);
      const models = site.products.categories.flatMap(c => (c.subcategories || []).flatMap(s => (s.models || []).map(m => m.name)));
      const found = models.filter(n => text.includes(n));
      push({ id: 'T-catalog-indexable-without-js', gate: 'target', page: 'productos.html', status: found.length === models.length ? 'pass' : 'fail', detail: `${found.length}/${models.length} modelos en el HTML sin JS` });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

