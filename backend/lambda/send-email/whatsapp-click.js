'use strict';

const { sanitizeCommercialContext } = require('./validation');

/**
 * Registro de clics en WhatsApp con su código de referencia.
 *
 * POR QUÉ VIVE EN ESTA LAMBDA. El sitio ya le escribe a este endpoint, CORS ya está resuelto y el
 * rol ya tiene permiso sobre el buzón de S3. Una Lambda y un recurso de API Gateway nuevos serían
 * más superficie para guardar un JSON chico. La separación se hace en el cuerpo: `event:
 * "whatsapp_click"` NUNCA llega a `validateSubmission` y NUNCA manda un mail.
 *
 * QUÉ SE GUARDA. El código que viajó escrito en el mensaje, el emplazamiento, la página sin query
 * string, los UTMs y los identificadores de clic de Google. NO se guarda la IP, el user agent ni
 * nada que identifique a la persona por sí solo: la identidad aparece recién cuando alguien une el
 * código con una conversación de WhatsApp, y esa unión pasa en la planilla, no acá.
 *
 * Contrato con `js/conversion-tracking.js` (`buildWhatsAppClickPayload`):
 *   { event: 'whatsapp_click', ref: 'K7Q3M', placement: 'landing-hero',
 *     context: { page: '/productos/pisos-led.html', utm: {...}, clickIds: { gclid } } }
 */

const WHATSAPP_CLICK_EVENT = 'whatsapp_click';
// Mismo alfabeto que el sitio: sin 0/O ni 1/I/L.
const REF_CODE_PATTERN = /^[2-9A-HJKMNP-Z]{5}$/;
const PLACEMENT_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PAGE_PATTERN = /^\/[A-Za-z0-9._~\/-]{0,299}$/;
// Un clic real pesa unos cientos de bytes. El límite general de la Lambda es para el formulario.
const MAX_CLICK_BYTES = 2_000;

function isWhatsAppClick(body) {
    return Boolean(body) && typeof body === 'object' && !Array.isArray(body) &&
        body.event === WHATSAPP_CLICK_EVENT;
}

/**
 * Valida el registro. Devuelve `{ value, errors }` como `validateSubmission`.
 *
 * El código es OBLIGATORIO y estricto: un registro sin código válido no une con ningún mensaje y
 * sólo ocupa lugar. La página se rechaza si trae query string o fragmento, porque ahí es donde
 * podría colarse un dato personal pegado a la URL.
 */
function validateWhatsAppClick(body) {
    const errors = {};

    if (!isWhatsAppClick(body)) {
        return { value: null, errors: { event: 'Evento no reconocido.' } };
    }

    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_CLICK_BYTES) {
        return { value: null, errors: { body: 'Registro demasiado extenso.' } };
    }

    const ref = typeof body.ref === 'string' ? body.ref.trim() : '';
    if (!REF_CODE_PATTERN.test(ref)) errors.ref = 'Código inválido.';

    const placement = typeof body.placement === 'string' ? body.placement.trim() : '';
    if (placement && !PLACEMENT_PATTERN.test(placement)) errors.placement = 'Emplazamiento inválido.';

    // Se reutiliza la limpieza del formulario para UTMs e identificadores de clic: la regla de qué
    // forma tiene un gclid válido tiene que ser UNA sola en todo el backend.
    const context = sanitizeCommercialContext(body);
    const page = context.page || '';
    if (!PAGE_PATTERN.test(page)) errors.page = 'Página inválida.';

    if (Object.keys(errors).length > 0) return { value: null, errors };

    const value = { ref, page };
    if (placement) value.placement = placement;
    if (context.utm) value.utm = context.utm;
    if (context.clickIds) value.clickIds = context.clickIds;

    return { value, errors };
}

module.exports = {
    WHATSAPP_CLICK_EVENT,
    REF_CODE_PATTERN,
    isWhatsAppClick,
    validateWhatsAppClick
};
