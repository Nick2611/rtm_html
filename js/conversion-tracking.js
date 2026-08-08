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
      placement: nearestDatasetValue(element, ['conversionPlacement', 'context']),
      section: nearestDatasetValue(element, ['conversionSection']),
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

  function emitAdsConversion(eventName, context) {
    const sendTo = ADS_CONVERSION_SEND_TO[eventName] ||
      ADS_CHANNEL_CONVERSION_SEND_TO[context?.channel];
    if (!sendTo || /CONVERSION_LABEL|REPLACE_WITH/.test(sendTo)) return false;

    const gtagFn = globalScope?.gtag;
    if (typeof gtagFn !== 'function') return false;

    try {
      gtagFn('event', 'conversion', { send_to: sendTo });
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

    return Object.freeze({
      name: eventName,
      detail: Object.freeze({ ...context }),
      claritySent,
      adsSent
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

  function handleDelegatedClick(event) {
    const element = findConversionElement(event);
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

  const api = Object.freeze({ track, init });
  init();
  return api;
});
