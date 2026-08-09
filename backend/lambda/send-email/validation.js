'use strict';

const FIELD_LIMITS = Object.freeze({
    nombre: 80,
    apellido: 80,
    empresa: 120,
    tipoCliente: 120,
    otroTipoCliente: 80,
    telefono: 25,
    tipoSolucion: 120,
    consulta: 2000
});
const CONTEXT_LIMITS = Object.freeze({
    page: 500,
    product: 160,
    category: 160,
    referrer: 1000,
    utm: 160
});

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const CONTEXT_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/g;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readText(source, field, errors, { collapseWhitespace = false } = {}) {
    const value = source[field];

    if (value === undefined || value === null) return '';

    if (typeof value !== 'string') {
        errors[field] = 'El valor ingresado no es válido.';
        return '';
    }

    const trimmed = value.trim();
    return collapseWhitespace ? trimmed.replace(/\s+/g, ' ') : trimmed.replace(/\r\n?/g, '\n');
}

function validateName(value, field, required, errors) {
    if (errors[field]) return;

    if (!value) {
        if (required) errors[field] = 'Este campo es obligatorio.';
        return;
    }

    if (value.length < 2 || value.length > FIELD_LIMITS[field] || !NAME_PATTERN.test(value)) {
        errors[field] = 'Usá entre 2 y 80 caracteres: letras, espacios, apóstrofes o guiones.';
    }
}

function validateText(value, field, errors, { requiredMessage = '', invalidMessage = '' } = {}) {
    if (errors[field]) return;

    if (!value) {
        if (requiredMessage) errors[field] = requiredMessage;
        return;
    }

    if (value.length < 2 || value.length > FIELD_LIMITS[field] || CONTROL_CHARACTER_PATTERN.test(value)) {
        errors[field] = invalidMessage || `Ingresá entre 2 y ${FIELD_LIMITS[field]} caracteres.`;
    }
}

function validatePhone(value, errors) {
    if (errors.telefono) return;

    if (!value) {
        errors.telefono = 'El teléfono es obligatorio.';
        return;
    }

    const digitCount = value.replace(/\D/g, '').length;
    const validFormat = value.length <= FIELD_LIMITS.telefono && PHONE_PATTERN.test(value);

    if (!validFormat || digitCount < 8 || digitCount > 15) {
        errors.telefono = 'Ingresá un teléfono válido de entre 8 y 15 números.';
    }
}

function validateMessage(value, errors) {
    if (errors.consulta) return;

    if (!value) {
        errors.consulta = 'La consulta es obligatoria.';
        return;
    }

    if (
        value.length < 10 ||
        value.length > FIELD_LIMITS.consulta ||
        CONTROL_CHARACTER_PATTERN.test(value)
    ) {
        errors.consulta = 'La consulta debe tener entre 10 y 2000 caracteres.';
    }
}

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstString(...values) {
    return values.find(value => typeof value === 'string' && value.trim()) || '';
}

function sanitizeContextText(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value
        .replace(CONTEXT_CONTROL_CHARACTER_PATTERN, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function sanitizeCommercialContext(body) {
    if (!isRecord(body)) return {};

    const suppliedContext = isRecord(body.context) ? body.context : {};
    const suppliedUtm = isRecord(suppliedContext.utm) ? suppliedContext.utm : {};
    const context = {};
    const page = sanitizeContextText(
        firstString(suppliedContext.page, body.page),
        CONTEXT_LIMITS.page
    );
    const product = sanitizeContextText(
        firstString(
            suppliedContext.product,
            suppliedContext.producto,
            body.product,
            body.producto
        ),
        CONTEXT_LIMITS.product
    );
    const category = sanitizeContextText(
        firstString(
            suppliedContext.category,
            suppliedContext.categoria,
            body.category,
            body.categoria
        ),
        CONTEXT_LIMITS.category
    );
    const referrer = sanitizeContextText(
        firstString(suppliedContext.referrer, body.referrer),
        CONTEXT_LIMITS.referrer
    );
    const utm = {
        source: sanitizeContextText(
            firstString(
                suppliedUtm.source,
                suppliedUtm.utm_source,
                suppliedContext.utmSource,
                suppliedContext.utm_source,
                body.utm_source
            ),
            CONTEXT_LIMITS.utm
        ),
        medium: sanitizeContextText(
            firstString(
                suppliedUtm.medium,
                suppliedUtm.utm_medium,
                suppliedContext.utmMedium,
                suppliedContext.utm_medium,
                body.utm_medium
            ),
            CONTEXT_LIMITS.utm
        ),
        campaign: sanitizeContextText(
            firstString(
                suppliedUtm.campaign,
                suppliedUtm.utm_campaign,
                suppliedContext.utmCampaign,
                suppliedContext.utm_campaign,
                body.utm_campaign
            ),
            CONTEXT_LIMITS.utm
        ),
        term: sanitizeContextText(
            firstString(
                suppliedUtm.term,
                suppliedUtm.utm_term,
                suppliedContext.utmTerm,
                suppliedContext.utm_term,
                body.utm_term
            ),
            CONTEXT_LIMITS.utm
        ),
        content: sanitizeContextText(
            firstString(
                suppliedUtm.content,
                suppliedUtm.utm_content,
                suppliedContext.utmContent,
                suppliedContext.utm_content,
                body.utm_content
            ),
            CONTEXT_LIMITS.utm
        )
    };

    if (page) context.page = page;
    if (product) context.product = product;
    if (category) context.category = category;
    if (referrer) context.referrer = referrer;
    if (Object.values(utm).some(Boolean)) context.utm = utm;

    return context;
}

function validateSubmission(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return {
            value: null,
            errors: { form: 'El contenido de la solicitud no es válido.' }
        };
    }

    const errors = {};
    const value = {
        nombre: readText(body, 'nombre', errors, { collapseWhitespace: true }),
        apellido: readText(body, 'apellido', errors, { collapseWhitespace: true }),
        empresa: readText(body, 'empresa', errors, { collapseWhitespace: true }),
        tipoCliente: readText(body, 'tipoCliente', errors, { collapseWhitespace: true }),
        otroTipoCliente: readText(body, 'otroTipoCliente', errors, { collapseWhitespace: true }),
        telefono: readText(body, 'telefono', errors, { collapseWhitespace: true }),
        tipoSolucion: readText(body, 'tipoSolucion', errors, { collapseWhitespace: true }),
        consulta: readText(body, 'consulta', errors)
    };
    const context = sanitizeCommercialContext(body);
    if (Object.keys(context).length > 0) value.context = context;

    validateName(value.nombre, 'nombre', true, errors);
    validateName(value.apellido, 'apellido', false, errors);
    validateText(value.empresa, 'empresa', errors);
    validateText(value.tipoCliente, 'tipoCliente', errors, {
        invalidMessage: 'Ingresá un tipo de cliente válido.'
    });
    validateText(value.otroTipoCliente, 'otroTipoCliente', errors);
    validatePhone(value.telefono, errors);
    validateText(value.tipoSolucion, 'tipoSolucion', errors, {
        invalidMessage: 'Ingresá una solución válida.'
    });
    validateMessage(value.consulta, errors);

    return { value, errors };
}

function hasValidationErrors(errors) {
    return Object.keys(errors).length > 0;
}

function toTelephoneUri(value) {
    const digits = value.replace(/\D/g, '');
    return value.startsWith('+') ? `+${digits}` : digits;
}

function isValidEmailAddress(value) {
    return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

function parseEmailList(value) {
    if (typeof value !== 'string') return [];

    return [...new Set(
        value
            .split(',')
            .map(address => address.trim())
            .filter(Boolean)
    )];
}

module.exports = {
    hasValidationErrors,
    isValidEmailAddress,
    parseEmailList,
    sanitizeCommercialContext,
    toTelephoneUri,
    validateSubmission
};
