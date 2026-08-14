/**
 * RTM Pantallas LED - tracking de conversiones sin PII
 *
 * Uso manual:
 *   window.RTMConversion.track('whatsapp_click', { placement: 'hero' });
 *
 * Uso declarativo:
 *   <a data-conversion="whatsapp_click" data-conversion-placement="hero">...</a>
 */
(function initRTMConversionModule(globalScope, factory) {
  'use strict';

  const api = factory(globalScope);

  if (globalScope) globalScope.RTMConversion = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null, function createRTMConversion(globalScope) {
  'use strict';

  const MAX_EVENT_LENGTH = 64;
  const MAX_VALUE_LENGTH = 100;
  const UTM_STORAGE_KEY = 'rtm_conversion_utm';
  const LISTENER_FLAG = '__rtmConversionTrackingReady';
  // Acción de conversión "Form submission" creada en Google Ads (categoría Submit lead form).
  const ADS_CONVERSION_SEND_TO = Object.freeze({
    form_success: 'AW-18364923277/iwS0CM_N9d0cEI37ibVE'
  });
  // Acción de conversión "WhatsApp - clic" (categoría Contacto, secundaria).
  // El clic solo confirma que el usuario abrió WhatsApp, no que haya enviado el mensaje.
  // Aplica a cualquier evento data-conversion="whatsapp_*" vía el canal inferido en inferChannel().
  const ADS_CHANNEL_CONVERSION_SEND_TO = Object.freeze({
    whatsapp: 'AW-18364923277/SE7ZCOGiqd4cEI37ibVE'
  });
  /**
   * La propiedad de GA4. El `send_to` es OBLIGATORIO y no es una optimización:
   * la página carga un único `gtag.js` configurado con AW-18364923277 **y** con este id, así que
   * un `gtag('event', ...)` sin `send_to` se difunde a los dos destinos y ensucia Google Ads con
   * cada micro-evento del sitio. Acotarlo acá es lo que mantiene separadas las dos cuentas.
   */
  const GA4_MEASUREMENT_ID = 'G-6BP4Y1KSSK';
  // GA4 descarta el evento entero si se pasa de estos límites, en silencio y sin error.
  const GA4_MAX_EVENT_NAME_LENGTH = 40;
  const GA4_MAX_PARAM_NAME_LENGTH = 40;
  const GA4_MAX_PARAM_VALUE_LENGTH = 100;
  const GA4_MAX_PARAMS = 25;
  /**
   * Nombres que GA4 se reserva. Enviar uno de estos no falla: GA4 lo acepta y lo descarta, que es
   * la peor de las dos opciones porque el sitio parece estar midiendo algo que nunca llega.
   */
  const GA4_RESERVED_EVENT_NAMES = Object.freeze([
    'ad_activeview', 'ad_click', 'ad_exposure', 'ad_impression', 'ad_query',
    'adunit_exposure', 'app_clear_data', 'app_exception', 'app_remove', 'app_store_refund',
    'app_store_subscription_cancel', 'app_store_subscription_convert',
    'app_store_subscription_renew', 'app_update', 'app_upgrade', 'dynamic_link_app_open',
    'dynamic_link_app_update', 'dynamic_link_first_open', 'error', 'first_open', 'first_visit',
    'in_app_purchase', 'notification_dismiss', 'notification_foreground', 'notification_open',
    'notification_receive', 'os_update', 'screen_view', 'session_start', 'user_engagement'
  ]);

  /*
   * ---------------------------------------------------------------------------------------------
   * TAXONOMÍA DE EVENTOS
   *
   * El sitio declara 20 valores distintos de `data-conversion` y son inconsistentes: trece formas
   * de decir "clic en WhatsApp" (`whatsapp_header`, `whatsapp_hero`, `whatsapp_guide_final`...).
   * Contar "clics de WhatsApp" hoy exige conocer las trece.
   *
   * La normalización se hace acá, con un mapa, y NO renombrando el marcado: los atributos están
   * repartidos por todas las páginas y también en tarjetas que `js/products.js` genera en runtime,
   * así que un renombrado masivo es mucha superficie para un cambio que este mapa resuelve en un
   * solo lugar.
   *
   * SE APLICA SÓLO A GA4, Y ESO ES DELIBERADO. Clarity ya acumuló semanas de historia con los
   * nombres crudos, y los hechos de Clarity en el almacén están indexados por esos nombres: cambiar
   * el nombre ahora partiría cada métrica en dos series incomparables, sin poder reprocesar lo
   * viejo. GA4, en cambio, no tiene historia — empieza acá — así que puede arrancar limpio. La
   * conversión de crudo a canónico para Clarity es trabajo del transform del almacén, donde sí se
   * puede reprocesar.
   * ---------------------------------------------------------------------------------------------
   */

  /** Eventos que ya son canónicos y nunca deben ser reescritos por las reglas de prefijo. */
  const CANONICAL_EVENT_NAMES = Object.freeze([
    'whatsapp_click',
    'phone_click',
    'email_click',
    'form_cta_click',
    'product_detail_click',
    // Etapas del embudo del formulario. `form_start` empieza con `form_` pero NO es un clic en un
    // CTA, y la regla de prefijo de abajo se lo tragaría.
    'form_start',
    'form_error',
    'form_success'
  ]);

  const EVENT_TAXONOMY = Object.freeze({
    whatsapp_header: { name: 'whatsapp_click', placement: 'header' },
    whatsapp_menu_mobile: { name: 'whatsapp_click', placement: 'menu_mobile' },
    whatsapp_hero: { name: 'whatsapp_click', placement: 'hero' },
    whatsapp_floating: { name: 'whatsapp_click', placement: 'floating' },
    whatsapp_guide_hero: { name: 'whatsapp_click', placement: 'guide_hero' },
    whatsapp_guide_final: { name: 'whatsapp_click', placement: 'guide_final' },
    whatsapp_guide_persistent: { name: 'whatsapp_click', placement: 'guide_persistent' },
    whatsapp_projects_final: { name: 'whatsapp_click', placement: 'projects_final' },
    whatsapp_services_hero: { name: 'whatsapp_click', placement: 'services_hero' },
    whatsapp_services_persistent: { name: 'whatsapp_click', placement: 'services_persistent' },
    whatsapp_product_page: { name: 'whatsapp_click', placement: 'product_page' },
    whatsapp_product_persistent: { name: 'whatsapp_click', placement: 'product_persistent' },
    form_header: { name: 'form_cta_click', placement: 'header' },
    form_menu_mobile: { name: 'form_cta_click', placement: 'menu_mobile' },
    form_services_hero: { name: 'form_cta_click', placement: 'services_hero' },
    projects_hero: { name: 'content_cta_click', placement: 'projects_hero' },
    catalog_hero: { name: 'content_cta_click', placement: 'catalog_hero' },
    products_guide_hero: { name: 'content_cta_click', placement: 'products_guide_hero' },
    servicios_category_click: { name: 'category_click', placement: 'servicios' }
  });

  /**
   * El nombre canónico de un evento y el emplazamiento que implicaba su nombre crudo.
   *
   * Las reglas de prefijo del final existen para que agregar `data-conversion="whatsapp_footer"` en
   * una página nueva quede agrupado con los demás sin tocar este archivo. Sin ellas, cada
   * emplazamiento nuevo aparecería como un evento suelto en GA4 hasta que alguien se acordara de
   * mapearlo, que es exactamente cómo se llegó a trece nombres para una sola acción.
   */
  function canonicalEvent(rawName) {
    const name = sanitizeEventName(rawName);
    if (!name) return null;

    if (CANONICAL_EVENT_NAMES.includes(name)) return { name, placement: '' };
    if (hasOwn(EVENT_TAXONOMY, name)) return { ...EVENT_TAXONOMY[name] };

    if (name.startsWith('whatsapp_')) {
      return { name: 'whatsapp_click', placement: name.slice('whatsapp_'.length) };
    }
    if (name.startsWith('phone_')) {
      return { name: 'phone_click', placement: name.slice('phone_'.length) };
    }
    if (name.startsWith('email_')) {
      return { name: 'email_click', placement: name.slice('email_'.length) };
    }
    if (name.startsWith('form_')) {
      return { name: 'form_cta_click', placement: name.slice('form_'.length) };
    }

    return { name, placement: '' };
  }
  const UTM_KEYS = Object.freeze([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'utm_id'
  ]);
  const DETAIL_KEY_MAP = Object.freeze({
    page: 'page',
    product: 'product',
    model: 'product',
    category: 'category',
    categoria: 'category',
    subcategory: 'subcategory',
    subcategoria: 'subcategory',
    placement: 'placement',
    section: 'section',
    component: 'component',
    variant: 'variant',
    channel: 'channel',
    form: 'form',
    form_id: 'form',
    stage: 'stage',
    reason: 'reason',
    action: 'action'
  });

  let cachedUtmContext = null;

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function looksSensitive(value) {
    const text = String(value);
    const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/i;
    const explicitContactPattern = /(?:mailto:|tel:|wa\.me\/|api\.whatsapp\.com)/i;
    const digitCount = (text.match(/\d/g) || []).length;

    return emailPattern.test(text) ||
      explicitContactPattern.test(text) ||
      digitCount >= 8;
  }

  function sanitizeValue(value, maxLength = MAX_VALUE_LENGTH) {
    if (!['string', 'number', 'boolean'].includes(typeof value)) return '';

    let sanitized = String(value).trim();
    if (!sanitized || looksSensitive(sanitized)) return '';

    if (typeof sanitized.normalize === 'function') sanitized = sanitized.normalize('NFKC');

    sanitized = sanitized
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/[^\p{L}\p{N} _./:+-]+/gu, '-')
      .replace(/\s+/g, ' ')
      .replace(/-{2,}/g, '-')
      .trim()
      .slice(0, maxLength);

    return sanitized && !looksSensitive(sanitized) ? sanitized : '';
  }

  function sanitizeEventName(name) {
    const value = sanitizeValue(name, MAX_EVENT_LENGTH);
    if (!value) return '';

    const normalized = typeof value.normalize === 'function'
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : value;

    return normalized
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^[_\-.]+|[_\-.]+$/g, '')
      .slice(0, MAX_EVENT_LENGTH);
  }

  function getSearchParams() {
    const location = globalScope?.location;
    const Params = globalScope?.URLSearchParams ||
      (typeof URLSearchParams === 'function' ? URLSearchParams : null);

    if (!location || !Params) return null;

    try {
      return new Params(location.search || '');
    } catch (_error) {
      return null;
    }
  }

  function firstSafeParam(params, keys) {
    if (!params) return '';

    for (const key of keys) {
      const value = sanitizeValue(params.get(key));
      if (value) return value;
    }

    return '';
  }

  function readCurrentUtmContext(params) {
    const context = {};

    UTM_KEYS.forEach(key => {
      const value = sanitizeValue(params?.get(key));
      if (value) context[key] = value;
    });

    return context;
  }

  function readStoredUtmContext() {
    try {
      const storedValue = globalScope?.sessionStorage?.getItem(UTM_STORAGE_KEY);
      if (!storedValue) return {};

      const storedContext = JSON.parse(storedValue);
      if (!storedContext || typeof storedContext !== 'object' || Array.isArray(storedContext)) {
        return {};
      }

      const safeContext = {};
      UTM_KEYS.forEach(key => {
        const value = sanitizeValue(storedContext[key]);
        if (value) safeContext[key] = value;
      });
      return safeContext;
    } catch (_error) {
      return {};
    }
  }

  function storeUtmContext(context) {
    try {
      globalScope?.sessionStorage?.setItem(UTM_STORAGE_KEY, JSON.stringify(context));
    } catch (_error) {
      // El tracking sigue funcionando cuando sessionStorage está bloqueado.
    }
  }

  function getUtmContext() {
    if (cachedUtmContext) return { ...cachedUtmContext };

    const currentContext = readCurrentUtmContext(getSearchParams());
    if (Object.keys(currentContext).length > 0) {
      cachedUtmContext = currentContext;
      storeUtmContext(currentContext);
    } else {
      cachedUtmContext = readStoredUtmContext();
    }

    return { ...cachedUtmContext };
  }

  function getPageName() {
    const bodyPage = sanitizeValue(globalScope?.document?.body?.dataset?.page);
    if (bodyPage) return bodyPage;

    let pathname = globalScope?.location?.pathname || '';
    try {
      pathname = decodeURIComponent(pathname);
    } catch (_error) {
      // Se conserva el pathname original si contiene una secuencia inválida.
    }

    const page = pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\.html?$/i, '');

    return sanitizeValue(page || 'inicio');
  }

  function getBodyContext() {
    const dataset = globalScope?.document?.body?.dataset;
    if (!dataset) return {};

    return sanitizeDetail({
      page: dataset.page,
      product: dataset.product || dataset.model,
      category: dataset.category || dataset.categoria,
      subcategory: dataset.subcategory || dataset.subcategoria
    });
  }

  function getQueryContext() {
    const params = getSearchParams();
    const context = {
      product: firstSafeParam(params, ['model', 'product', 'producto']),
      category: firstSafeParam(params, ['cat', 'category', 'categoria']),
      subcategory: firstSafeParam(params, ['sub', 'subcategory', 'subcategoria'])
    };

    return Object.fromEntries(Object.entries(context).filter(([, value]) => Boolean(value)));
  }

  function sanitizeDetail(detail) {
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return {};

    const safeDetail = {};
    Object.entries(DETAIL_KEY_MAP).forEach(([inputKey, outputKey]) => {
      if (!hasOwn(detail, inputKey)) return;

      const value = sanitizeValue(detail[inputKey]);
      if (value) safeDetail[outputKey] = value;
    });

    return safeDetail;
  }

  function buildContext(detail) {
    const context = {
      page: getPageName(),
      ...getBodyContext(),
      ...getQueryContext(),
      ...sanitizeDetail(detail),
      ...getUtmContext()
    };

    return Object.fromEntries(Object.entries(context).filter(([, value]) => Boolean(value)));
  }

  function nearestDatasetValue(element, keys) {
    let current = element;

    while (current && current.nodeType === 1) {
      for (const key of keys) {
        const value = sanitizeValue(current.dataset?.[key]);
        if (value) return value;
      }
      current = current.parentElement;
    }

    return '';
  }

  function inferChannel(element) {
    const declaredChannel = nearestDatasetValue(element, ['conversionChannel']);
    if (declaredChannel) return declaredChannel;

    try {
      const anchor = element.closest?.('a[href]');
      const href = anchor?.getAttribute('href') || '';
      if (/^(?:https?:\/\/)?(?:api\.)?wa\.me\//i.test(href) ||
          /^(?:https?:\/\/)?api\.whatsapp\.com\//i.test(href)) {
        return 'whatsapp';
      }
      // Sólo se clasifica el canal. El número y la dirección NUNCA salen de acá: lo que viaja es
      // la palabra "phone" o "email", y `sanitizeValue` descarta cualquier valor con pinta de
      // contacto aunque alguien lo declare a mano en un `data-conversion-channel`.
      if (/^tel:/i.test(href)) return 'phone';
      if (/^mailto:/i.test(href)) return 'email';
    } catch (_error) {
      // No se envía el destino; solo se intenta clasificar el canal.
    }

    return '';
  }

  function getElementContext(element) {
    const form = element.closest?.('form');

    return sanitizeDetail({
      product: nearestDatasetValue(element, [
        'conversionProduct',
        'conversionModel',
        'product',
        'model'
      ]),
      category: nearestDatasetValue(element, [
        'conversionCategory',
        'category',
        'categoria'
      ]),
      subcategory: nearestDatasetValue(element, [
        'conversionSubcategory',
        'subcategory',
        'subcategoria'
      ]),
      /*
       * `data-context` NO puede alimentar `placement`, y esto es un defecto medido, no una
       * preferencia de estilo. En el home los cinco CTAs llevan `data-context="home"`, así que el
       * clic del hero, el del header, el del menú y el flotante llegaban los cuatro como
       * `placement: "home"`: imposible saber cuál de todos gana la consulta, que es justo la
       * pregunta que hay que responder. Peor todavía, `js/main.js` le escribe el pathname al botón
       * flotante, así que ese reportaba `placement: "/index.html"`.
       *
       * Con `placement` limitado a `data-conversion-placement`, cuando no hay atributo explícito
       * gana el emplazamiento que implica el nombre del evento (hero, header, floating, …) vía
       * `canonicalEvent`, que es la taxonomía que ya existe y ya está testeada.
       *
       * No se pierde nada: en cada elemento donde `data-context` traía un emplazamiento real
       * (`model-detail`, `special-footer`, `catalog-footer`, `catalog-persistent`) el mismo valor
       * ya venía en `data-conversion-placement` — `js/products.js` escribe los dos. El resto de los
       * valores son nombres de página, y siguen viajando acá abajo como `section`.
       */
      placement: nearestDatasetValue(element, ['conversionPlacement']),
      section: nearestDatasetValue(element, ['conversionSection', 'context']),
      component: nearestDatasetValue(element, ['conversionComponent']),
      variant: nearestDatasetValue(element, ['conversionVariant']),
      channel: inferChannel(element),
      form: sanitizeValue(form?.dataset?.conversionForm || form?.id)
    });
  }

  function emitClarityEvent(eventName, context) {
    const clarity = globalScope?.clarity;
    if (typeof clarity !== 'function') return false;

    try {
      Object.entries(context).forEach(([key, value]) => {
        clarity('set', `rtm_${key}`, value);
      });
      clarity('event', eventName);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * `beacon` no es una micro-optimización: es lo que hace que el evento sobreviva a la salida.
   *
   * Ningún `data-conversion` llama a `preventDefault`, así que el clic sigue su curso y el navegador
   * se va a `wa.me` (o al marcador de teléfono) con el request todavía en vuelo. En escritorio suele
   * llegar igual; en móvil —el 98 % del tráfico pagado— el salto a la app de WhatsApp manda el
   * navegador a segundo plano y un XHR normal se cancela. `navigator.sendBeacon`, que es lo que
   * activa este flag, está especificado para sobrevivir justamente a esa descarga.
   *
   * Evidencia que motivó el cambio: el 2026-08-12 Ads registró 3 `WhatsApp - clic` y GA4 sólo 2
   * `whatsapp_click`, ambos con canal "Unassigned" y sesiones de 0,0002 s. Es consistente con
   * requests que mueren en el camino, pero NO está probado; se confirma mirando si "Unassigned"
   * desaparece después de desplegar esto.
   */
  const GTAG_TRANSPORT = Object.freeze({ transport_type: 'beacon' });

  function emitAdsConversion(eventName, context) {
    const sendTo = ADS_CONVERSION_SEND_TO[eventName] ||
      ADS_CHANNEL_CONVERSION_SEND_TO[context?.channel];
    if (!sendTo || /CONVERSION_LABEL|REPLACE_WITH/.test(sendTo)) return false;

    const gtagFn = globalScope?.gtag;
    if (typeof gtagFn !== 'function') return false;

    try {
      gtagFn('event', 'conversion', { ...GTAG_TRANSPORT, send_to: sendTo });
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Los parámetros del evento, con los límites de GA4 aplicados antes de enviarlos.
   *
   * Se recortan acá y no en `sanitizeValue` porque los límites son de GA4, no del sitio: Clarity
   * acepta claves y valores más largos, y truncar para todos degradaría los datos de Clarity para
   * cumplir una regla que no es suya.
   */
  function ga4Params(context) {
    const params = {};
    let count = 0;

    for (const [key, value] of Object.entries(context)) {
      // `send_to` y `transport_type` ocupan dos de los 25 lugares.
      if (count >= GA4_MAX_PARAMS - 2) break;

      const paramName = key.slice(0, GA4_MAX_PARAM_NAME_LENGTH);
      const paramValue = String(value).slice(0, GA4_MAX_PARAM_VALUE_LENGTH);
      if (!paramName || !paramValue) continue;

      params[paramName] = paramValue;
      count += 1;
    }

    return params;
  }

  /**
   * Emite a GA4, y sólo a GA4.
   *
   * NOTA SOBRE LO QUE ESTO NO ARREGLA: la propiedad de GA4 no tiene ningún evento marcado como
   * "evento clave", así que estos eventos van a llegar y GA4 va a seguir informando cero
   * conversiones hasta que alguien los marque en GA4 Admin. Tampoco hay dimensiones personalizadas
   * registradas, así que los parámetros de abajo no van a ser consultables por API hasta que se
   * registren — y GA4 no rellena hacia atrás, así que conviene registrarlos antes de que empiece a
   * llegar volumen. Las dos cosas son cambios en la propiedad, no en este archivo.
   */
  function emitGa4Event(eventName, context) {
    if (GA4_RESERVED_EVENT_NAMES.includes(eventName)) return false;

    const name = eventName.slice(0, GA4_MAX_EVENT_NAME_LENGTH);
    if (!name) return false;

    const gtagFn = globalScope?.gtag;
    if (typeof gtagFn !== 'function') return false;

    try {
      gtagFn('event', name, {
        ...ga4Params(context),
        // Últimas dos propiedades a propósito: nada en el contexto puede pisarlas.
        ...GTAG_TRANSPORT,
        send_to: GA4_MEASUREMENT_ID
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  function track(name, detail) {
    const eventName = sanitizeEventName(name);
    if (!eventName) return null;

    const context = buildContext(detail);
    const claritySent = emitClarityEvent(eventName, context);
    const adsSent = emitAdsConversion(eventName, context);

    // GA4 recibe el nombre NORMALIZADO; Clarity y Ads siguen recibiendo el crudo. Ver la nota
    // sobre la taxonomía: Clarity tiene historia que se rompería, GA4 todavía no.
    const canonical = canonicalEvent(eventName);
    const ga4Context = canonical?.placement && !context.placement
      ? { ...context, placement: canonical.placement }
      : context;
    const ga4Sent = canonical ? emitGa4Event(canonical.name, ga4Context) : false;

    return Object.freeze({
      name: eventName,
      ga4Name: canonical?.name || '',
      detail: Object.freeze({ ...context }),
      claritySent,
      adsSent,
      ga4Sent
    });
  }

  function findConversionElement(event) {
    if (typeof event?.composedPath === 'function') {
      const pathMatch = event.composedPath().find(node =>
        node?.nodeType === 1 && node.matches?.('[data-conversion]')
      );
      if (pathMatch) return pathMatch;
    }

    const target = event?.target?.nodeType === 1
      ? event.target
      : event?.target?.parentElement;

    return target?.closest?.('[data-conversion]') || null;
  }

  /*
   * ===============================================================================================
   * MARCA DE ORIGEN EN EL TEXTO PRELLENADO DE WHATSAPP
   * ===============================================================================================
   *
   * POR QUÉ EXISTE. El tag de "WhatsApp - clic" dispara cuando alguien toca el enlace `wa.me`, no
   * cuando manda el mensaje. Ningún código del navegador puede saber lo segundo: una vez que el
   * usuario salta a WhatsApp, la página no recibe nada más. El 2026-08-14 Ads registró 2 clics y al
   * teléfono no llegó ningún mensaje, que es exactamente el hueco que esto mide.
   *
   * QUÉ HACE Y QUÉ NO HACE. No detecta el envío. Hace que los mensajes que SÍ llegan digan de dónde
   * salieron, agregando una línea al final del texto prellenado: `(rtm: productos/pisos-led ·
   * landing-hero)`. Con eso se comparan dos números que ya existen —los clics que reporta Ads y los
   * mensajes que llegaron al teléfono— y se obtiene la tasa clic → mensaje, que hoy no se conoce.
   *
   * POR QUÉ ACÁ Y NO EN EL HTML. Hay 71 enlaces `wa.me` en 17 archivos, y 48 de ellos los ESCRIBE
   * `scripts/build-landings.py`: editarlos a mano se pierde en la próxima corrida del generador.
   * Reescribir el href en el clic cubre los 71 de una sola vez, y también cualquier enlace futuro,
   * incluido el del dock flotante que `js/main.js` crea después de que este módulo ya arrancó.
   *
   * POR QUÉ AL FINAL DEL MENSAJE. La vista previa de la lista de chats de WhatsApp muestra los
   * primeros caracteres. Una marca adelante arruinaría esa vista previa para el cliente y haría más
   * probable que borre el texto entero antes de enviarlo.
   */
  const WHATSAPP_HREF_PATTERN = /^(?:https?:\/\/)?(?:(?:api\.)?wa\.me|api\.whatsapp\.com)\//i;
  // Guarda el texto original la primera vez, para que N clics sobre el mismo enlace no apilen N
  // marcas. Siempre se reconstruye desde esta base, nunca desde el href ya decorado.
  const WHATSAPP_BASE_TEXT_KEY = 'rtmWaBaseText';
  const WHATSAPP_REF_PREFIX = 'rtm: ';

  /**
   * El identificador de página. Incluye el directorio a propósito: `productos/pisos-led.html` y
   * `seccion_servicios/pisos_led.html` colapsarían al mismo slug con sólo el nombre de archivo, y
   * son dos páginas distintas que hay que poder distinguir en el teléfono.
   */
  function whatsappPageSlug(pathname) {
    const segments = String(pathname || '').split('/').filter(Boolean);
    const file = segments.pop() || '';
    const directory = segments.pop() || '';
    const base = file.replace(/\.html?$/i, '');
    const normalize = value => value.replace(/_/g, '-').toLowerCase();

    if (!base || base === 'index') return directory ? normalize(directory) : 'home';
    return directory ? `${normalize(directory)}/${normalize(base)}` : normalize(base);
  }

  /**
   * El emplazamiento se resuelve con LA MISMA precedencia que usa GA4 más abajo: gana
   * `data-conversion-placement` y, si no está, el que implica el nombre del evento vía
   * `canonicalEvent`. Si divergieran, el mensaje que llega al teléfono diría un origen y el informe
   * de GA4 otro, que es peor que no tener marca.
   */
  function whatsappRef(element, pathname) {
    const page = whatsappPageSlug(pathname);
    const declared = nearestDatasetValue(element, ['conversionPlacement']);
    const canonical = canonicalEvent(element?.getAttribute?.('data-conversion'));
    const placement = declared || canonical?.placement || '';

    return placement ? `${page} · ${String(placement).replace(/_/g, '-').toLowerCase()}` : page;
  }

  /**
   * Reescribe el `text=` preservando cualquier otro parámetro.
   *
   * No se usa `URLSearchParams.toString()` a propósito: serializa los espacios como `+`, y WhatsApp
   * los muestra literales en el cuadro de mensaje. `encodeURIComponent` los codifica como `%20`,
   * que es lo que ya usan los 71 enlaces escritos a mano.
   */
  function whatsappHrefWithText(url, text) {
    const params = [];
    url.searchParams.forEach((value, key) => {
      if (key !== 'text') params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    params.push(`text=${encodeURIComponent(text)}`);

    return `${url.origin}${url.pathname}?${params.join('&')}`;
  }

  /**
   * Decora el enlace en fase de captura, antes de que el navegador resuelva la navegación: la
   * acción por defecto lee el `href` recién cuando termina el despacho del evento, así que la
   * marca llega a tiempo. Nada acá llama a `preventDefault`, igual que el resto del módulo.
   */
  function decorateWhatsAppLink(element, pathname) {
    const anchor = element?.closest?.('a[href]');
    if (!anchor) return null;

    const href = anchor.getAttribute('href') || '';
    if (!WHATSAPP_HREF_PATTERN.test(href)) return null;

    let url;
    try {
      url = new URL(href, globalScope?.location?.href || 'https://pantallasledrtm.com/');
    } catch (_error) {
      return null;
    }

    const dataset = anchor.dataset;
    const stored = dataset ? dataset[WHATSAPP_BASE_TEXT_KEY] : undefined;
    const baseText = typeof stored === 'string' ? stored : (url.searchParams.get('text') || '');
    if (dataset && typeof stored !== 'string') dataset[WHATSAPP_BASE_TEXT_KEY] = baseText;

    const ref = whatsappRef(element, pathname);
    if (!ref) return null;

    const marked = `(${WHATSAPP_REF_PREFIX}${ref})`;
    anchor.setAttribute('href', whatsappHrefWithText(url, baseText ? `${baseText}\n\n${marked}` : marked));

    return ref;
  }

  function handleDelegatedClick(event) {
    const element = findConversionElement(event);

    // Se decora aunque el enlace no tenga `data-conversion`: la marca de origen no depende de que
    // el clic además se trackee, y así un enlace nuevo queda cubierto sin acordarse del atributo.
    const target = event?.target?.nodeType === 1 ? event.target : event?.target?.parentElement;
    decorateWhatsAppLink(element || target, globalScope?.location?.pathname);

    if (!element) return;

    track(element.getAttribute('data-conversion'), getElementContext(element));
  }

  function init() {
    getUtmContext();

    const document = globalScope?.document;
    if (!document || document[LISTENER_FLAG]) return false;

    document.addEventListener('click', handleDelegatedClick, true);
    document[LISTENER_FLAG] = true;
    return true;
  }

  // `canonicalEvent` y `EVENT_TAXONOMY` se exportan para que el transform del almacén pueda aplicar
  // la MISMA normalización a los eventos crudos que Clarity ya tiene guardados. Una taxonomía
  // definida dos veces es una taxonomía que va a divergir.
  const api = Object.freeze({
    track,
    init,
    canonicalEvent,
    EVENT_TAXONOMY,
    // Se exportan por la misma razón que `canonicalEvent`: el conteo semanal de mensajes contra
    // clics necesita poder reproducir exactamente la marca que se escribió en el enlace.
    whatsappPageSlug,
    whatsappRef,
    decorateWhatsAppLink
  });
  init();
  return api;
});
