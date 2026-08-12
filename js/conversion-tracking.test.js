'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Pruebas de `js/conversion-tracking.js`.
 *
 * Se cargan con un `window` falso porque el módulo se auto-inicializa contra `globalScope` al ser
 * requerido. Cada caso arma su propio entorno para que un test no vea los oyentes ni el
 * sessionStorage de otro.
 *
 * Las tres propiedades que estas pruebas protegen, en orden de gravedad si se rompen:
 *
 *   1. NINGÚN evento de GA4 sale sin `send_to`. La página carga un solo `gtag.js` con la cuenta de
 *      Ads y la propiedad de GA4 a la vez, así que un evento sin acotar ensucia Google Ads con cada
 *      micro-interacción del sitio — y eso contamina los datos con los que se puja.
 *   2. NADA de PII llega a Clarity. Regla dura de AGENTS.md §6.
 *   3. Los trece nombres de "clic en WhatsApp" se agrupan en uno solo en GA4, sin tocar el marcado
 *      ni el nombre que ya recibe Clarity.
 */

function loadModule({ gtag, clarity } = {}) {
  delete require.cache[require.resolve('./conversion-tracking.js')];

  const store = new Map();
  const listeners = [];
  const fakeWindow = {
    location: { search: '', pathname: '/index.html' },
    URLSearchParams,
    sessionStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value)
    },
    document: {
      body: { dataset: {} },
      addEventListener: (type, handler) => listeners.push({ type, handler })
    }
  };
  if (gtag) fakeWindow.gtag = gtag;
  if (clarity) fakeWindow.clarity = clarity;

  const previous = global.window;
  global.window = fakeWindow;
  const api = require('./conversion-tracking.js');
  global.window = previous;

  return { api, fakeWindow };
}

/** Registra cada llamada a gtag para poder afirmar sobre el destino, no sólo sobre el nombre. */
function recordingGtag() {
  const calls = [];
  const gtag = (...args) => calls.push(args);
  return { gtag, calls };
}

test('todo evento de GA4 viaja con send_to a la propiedad de GA4', () => {
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  api.track('whatsapp_hero', { placement: 'hero' });

  const ga4Calls = calls.filter(([kind, name]) => kind === 'event' && name !== 'conversion');
  assert.ok(ga4Calls.length > 0, 'se esperaba al menos un evento de GA4');
  for (const [, , params] of ga4Calls) {
    assert.equal(params.send_to, 'G-6BP4Y1KSSK');
  }
});

test('el send_to de GA4 no puede ser pisado por el contexto', () => {
  // Un `data-conversion-*` malicioso o simplemente desprolijo no debe poder redirigir el evento a
  // la cuenta de Ads.
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  api.track('whatsapp_hero', { placement: 'hero', send_to: 'AW-18364923277' });

  const ga4Call = calls.find(([kind, name]) => kind === 'event' && name === 'whatsapp_click');
  assert.equal(ga4Call[2].send_to, 'G-6BP4Y1KSSK');
});

test('el evento de conversión de Ads sigue yendo a Ads y sólo para form_success', () => {
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  api.track('form_success', {});
  const adsCall = calls.find(([kind, name]) => kind === 'event' && name === 'conversion');
  assert.ok(adsCall, 'form_success debe seguir enviando la conversión de Ads');
  assert.match(adsCall[2].send_to, /^AW-18364923277\//);

  const { gtag: gtag2, calls: calls2 } = recordingGtag();
  const { api: api2 } = loadModule({ gtag: gtag2 });
  api2.track('projects_hero', {});
  assert.equal(
    calls2.filter(([kind, name]) => kind === 'event' && name === 'conversion').length,
    0,
    'un evento cualquiera no debe disparar una conversión de Ads'
  );
});

test('los trece nombres de WhatsApp se agrupan en whatsapp_click para GA4', () => {
  const nombres = [
    'whatsapp_header', 'whatsapp_menu_mobile', 'whatsapp_hero', 'whatsapp_floating',
    'whatsapp_guide_hero', 'whatsapp_guide_final', 'whatsapp_guide_persistent',
    'whatsapp_projects_final', 'whatsapp_services_hero', 'whatsapp_services_persistent',
    'whatsapp_product_page', 'whatsapp_product_persistent', 'whatsapp_click'
  ];

  for (const nombre of nombres) {
    const { gtag, calls } = recordingGtag();
    const { api } = loadModule({ gtag });
    const resultado = api.track(nombre, {});

    assert.equal(resultado.ga4Name, 'whatsapp_click', `${nombre} debería normalizar a whatsapp_click`);
    assert.ok(calls.some(([kind, name]) => kind === 'event' && name === 'whatsapp_click'));
  }
});

test('el emplazamiento sobrevive a la normalización', () => {
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  api.track('whatsapp_guide_final', {});

  const ga4Call = calls.find(([kind, name]) => kind === 'event' && name === 'whatsapp_click');
  assert.equal(ga4Call[2].placement, 'guide_final');
});

test('un placement explícito del marcado gana sobre el que implica el nombre', () => {
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  api.track('whatsapp_hero', { placement: 'tarjeta_producto' });

  const ga4Call = calls.find(([kind, name]) => kind === 'event' && name === 'whatsapp_click');
  assert.equal(ga4Call[2].placement, 'tarjeta_producto');
});

test('las etapas del formulario NO son tragadas por la regla de prefijo form_', () => {
  // `form_start` empieza con `form_` pero es una etapa del embudo, no un clic en un CTA.
  // Colapsarla en `form_cta_click` haría desaparecer el embudo entero.
  for (const etapa of ['form_start', 'form_error', 'form_success']) {
    const { api } = loadModule({ gtag: () => {} });
    assert.equal(api.canonicalEvent(etapa).name, etapa);
  }
  assert.equal(loadModule().api.canonicalEvent('form_header').name, 'form_cta_click');
});

test('un data-conversion nuevo con prefijo conocido se agrupa solo', () => {
  const { api } = loadModule();
  assert.deepEqual(api.canonicalEvent('whatsapp_footer'), {
    name: 'whatsapp_click',
    placement: 'footer'
  });
});

test('un nombre desconocido pasa tal cual, sin inventarle una familia', () => {
  const { api } = loadModule();
  assert.deepEqual(api.canonicalEvent('newsletter_signup'), {
    name: 'newsletter_signup',
    placement: ''
  });
});

test('no se emite un nombre reservado por GA4', () => {
  // GA4 acepta un nombre reservado y lo descarta en silencio, que es peor que rechazarlo: el sitio
  // parece estar midiendo algo que nunca llega.
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  const resultado = api.track('session_start', {});

  assert.equal(resultado.ga4Sent, false);
  assert.equal(calls.filter(([kind, name]) => kind === 'event' && name === 'session_start').length, 0);
});

test('no llega PII a Clarity ni a GA4', () => {
  const clarityCalls = [];
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({
    gtag,
    clarity: (...args) => clarityCalls.push(args)
  });

  api.track('form_success', {
    placement: 'contacto@ejemplo.com',
    section: '+54 9 11 5555 5555',
    variant: 'https://wa.me/5491155555555'
  });

  const serializado = JSON.stringify({ clarityCalls, calls });
  assert.ok(!/ejemplo\.com/.test(serializado), 'un email llegó a la analítica');
  assert.ok(!/5555/.test(serializado), 'un teléfono llegó a la analítica');
  assert.ok(!/wa\.me/.test(serializado), 'un enlace de WhatsApp llegó a la analítica');
});

test('la analítica nunca rompe la página si gtag no existe', () => {
  const { api } = loadModule();
  const resultado = api.track('whatsapp_hero', {});
  assert.equal(resultado.ga4Sent, false);
  assert.equal(resultado.adsSent, false);
});

test('un gtag que lanza no propaga el error', () => {
  const { api } = loadModule({
    gtag: () => {
      throw new Error('bloqueado por un ad blocker');
    }
  });
  assert.doesNotThrow(() => api.track('whatsapp_hero', {}));
  assert.equal(api.track('whatsapp_hero', {}).ga4Sent, false);
});

test('se respetan los límites de GA4', () => {
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  api.track('whatsapp_hero', { placement: 'x'.repeat(300) });

  const ga4Call = calls.find(([kind, name]) => kind === 'event' && name === 'whatsapp_click');
  assert.ok(Object.keys(ga4Call[2]).length <= 25, 'GA4 admite 25 parámetros por evento');
  for (const [nombre, valor] of Object.entries(ga4Call[2])) {
    assert.ok(nombre.length <= 40, `nombre de parámetro demasiado largo: ${nombre}`);
    assert.ok(String(valor).length <= 100, `valor demasiado largo en ${nombre}`);
  }
});

test('Clarity sigue recibiendo el nombre CRUDO, no el normalizado', () => {
  // Clarity ya tiene semanas de historia con los nombres crudos y los hechos del almacén están
  // indexados por ellos. Renombrar ahora partiría cada métrica en dos series incomparables.
  const clarityCalls = [];
  const { api } = loadModule({
    gtag: () => {},
    clarity: (...args) => clarityCalls.push(args)
  });

  api.track('whatsapp_guide_final', {});

  const eventos = clarityCalls.filter(([kind]) => kind === 'event').map(([, name]) => name);
  assert.deepEqual(eventos, ['whatsapp_guide_final']);
});
