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

test('las dos emisiones viajan con transport_type beacon', () => {
  // Sin esto el request muere cuando el navegador salta a WhatsApp, que es el 98 % del tráfico
  // pagado. Es la diferencia entre medir el clic y no medirlo, no una preferencia de transporte.
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  // `channel` es lo que `inferChannel()` deduce del href en el navegador; acá se pasa explícito
  // porque sin él no hay conversión de Ads que revisar.
  api.track('whatsapp_hero', { placement: 'hero', channel: 'whatsapp' });

  const adsCall = calls.find(([kind, name]) => kind === 'event' && name === 'conversion');
  const ga4Call = calls.find(([kind, name]) => kind === 'event' && name === 'whatsapp_click');

  assert.equal(adsCall[2].transport_type, 'beacon', 'la conversión de Ads viaja sin beacon');
  assert.equal(ga4Call[2].transport_type, 'beacon', 'el evento de GA4 viaja sin beacon');
});

test('el contexto no puede pisar transport_type', () => {
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  api.track('whatsapp_hero', { placement: 'hero', transport_type: 'xhr' });

  const ga4Call = calls.find(([kind, name]) => kind === 'event' && name === 'whatsapp_click');
  assert.equal(ga4Call[2].transport_type, 'beacon');
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

test('data-context no puede pisar el placement del hero, el header ni el flotante', () => {
  // El defecto que esto protege: los cinco CTAs del home llevan `data-context="home"` y llegaban
  // los cinco como `placement: "home"`. Sin esta separación no se puede saber qué botón convierte.
  const { api } = loadModule();
  const anchor = { nodeType: 1, dataset: { context: 'home' }, parentElement: null, closest: () => null };
  const build = evento => {
    const { gtag, calls } = recordingGtag();
    const mod = loadModule({ gtag });
    // Se emula lo que hace el listener: el contexto del elemento más el nombre del atributo.
    mod.api.track(evento, { section: anchor.dataset.context });
    return calls.find(([kind, name]) => kind === 'event' && name === 'whatsapp_click')[2];
  };

  assert.equal(build('whatsapp_hero').placement, 'hero');
  assert.equal(build('whatsapp_header').placement, 'header');
  assert.equal(build('whatsapp_floating').placement, 'floating');
  // `data-context` sobrevive, sólo que como `section`.
  assert.equal(build('whatsapp_hero').section, 'home');
  assert.ok(api);
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

test('los tel: y mailto: se agrupan en phone_click y email_click', () => {
  const { api } = loadModule();
  assert.deepEqual(api.canonicalEvent('phone_footer'), { name: 'phone_click', placement: 'footer' });
  assert.deepEqual(api.canonicalEvent('email_footer'), { name: 'email_click', placement: 'footer' });
  assert.deepEqual(api.canonicalEvent('phone_privacidad'), { name: 'phone_click', placement: 'privacidad' });
  // Los canónicos no vuelven a pasar por la regla de prefijo.
  assert.deepEqual(api.canonicalEvent('phone_click'), { name: 'phone_click', placement: '' });
  assert.deepEqual(api.canonicalEvent('email_click'), { name: 'email_click', placement: '' });
});

test('el canal de un tel:/mailto: viaja sin el número ni la dirección', () => {
  // El canal es la palabra "phone"/"email". El destino es PII y no puede salir (AGENTS.md §6).
  const clarityCalls = [];
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag, clarity: (...args) => clarityCalls.push(args) });

  api.track('phone_footer', { channel: 'phone' });
  api.track('email_footer', { channel: 'email' });

  const serializado = JSON.stringify({ clarityCalls, calls });
  assert.ok(/"channel":"phone"/.test(serializado), 'el canal phone no llegó');
  assert.ok(/"channel":"email"/.test(serializado), 'el canal email no llegó');
  assert.ok(!/1530|pantallasledrtm\.com|tel:|mailto:/.test(serializado), 'salió un dato de contacto');
});

test('un tel: o un mailto: NO disparan una conversión de Ads', () => {
  // No hay acción de conversión creada para esos canales; que no aparezca una silenciosamente.
  const { gtag, calls } = recordingGtag();
  const { api } = loadModule({ gtag });

  api.track('phone_footer', { channel: 'phone' });
  api.track('email_footer', { channel: 'email' });

  assert.equal(calls.filter(([kind, name]) => kind === 'event' && name === 'conversion').length, 0);
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
