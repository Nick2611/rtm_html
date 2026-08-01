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

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
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

    validateName(value.nombre, 'nombre', true, errors);
    validateName(value.apellido, 'apellido', false, errors);
    validateText(value.empresa, 'empresa', errors);
    validateText(value.tipoCliente, 'tipoCliente', errors, {
        requiredMessage: 'El tipo de cliente es obligatorio.',
        invalidMessage: 'Ingresá un tipo de cliente válido.'
    });
    validateText(value.otroTipoCliente, 'otroTipoCliente', errors);
    if (value.tipoCliente === 'Otro' && !value.otroTipoCliente && !errors.otroTipoCliente) {
        errors.otroTipoCliente = 'Especificá el tipo de cliente.';
    }
    validatePhone(value.telefono, errors);
    validateText(value.tipoSolucion, 'tipoSolucion', errors, {
        requiredMessage: 'La solución de interés es obligatoria.',
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

module.exports = {
    hasValidationErrors,
    isValidEmailAddress,
    toTelephoneUri,
    validateSubmission
};
