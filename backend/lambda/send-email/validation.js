'use strict';

const FIELD_LIMITS = Object.freeze({
    nombre: 80,
    apellido: 80,
    empresa: 120,
    telefono: 25,
    consulta: 2000
});

const SOLUTION_LABELS = Object.freeze({
    'totems-led': 'Tótems LED',
    'pantallas-indoor': 'Pantallas LED Indoor',
    'pantallas-outdoor': 'Pantallas LED Outdoor',
    'led-truck': 'LED Truck',
    'carteleria-colectivos': 'Cartelería para colectivos'
});

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function firstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            return source[key];
        }
    }
    return undefined;
}

function readText(source, keys, field, errors, { collapseWhitespace = false } = {}) {
    const value = firstDefinedValue(source, keys);

    if (value === undefined || value === null) return '';

    if (typeof value !== 'string') {
        errors[field] = 'El valor ingresado no es válido.';
        return '';
    }

    const trimmed = value.trim();
    return collapseWhitespace ? trimmed.replace(/\s+/g, ' ') : trimmed.replace(/\r\n?/g, '\n');
}

function validateName(value, field, required, errors) {
    if (!value) {
        if (required && !errors[field]) errors[field] = 'Este campo es obligatorio.';
        return;
    }

    if (value.length < 2 || value.length > FIELD_LIMITS[field] || !NAME_PATTERN.test(value)) {
        errors[field] = 'Usá entre 2 y 80 caracteres: letras, espacios, apóstrofes o guiones.';
    }
}

function validateOptionalText(value, field, errors) {
    if (!value) return;

    if (value.length < 2 || value.length > FIELD_LIMITS[field] || CONTROL_CHARACTER_PATTERN.test(value)) {
        errors[field] = `Ingresá entre 2 y ${FIELD_LIMITS[field]} caracteres.`;
    }
}

function validatePhone(value, errors) {
    if (!value) {
        if (!errors.telefono) errors.telefono = 'El teléfono es obligatorio.';
        return;
    }

    const digitCount = value.replace(/\D/g, '').length;
    const validFormat = value.length <= FIELD_LIMITS.telefono && PHONE_PATTERN.test(value);

    if (!validFormat || digitCount < 8 || digitCount > 15) {
        errors.telefono = 'Ingresá un teléfono válido de entre 8 y 15 números.';
    }
}

function validateSolution(value, errors) {
    if (value && !Object.prototype.hasOwnProperty.call(SOLUTION_LABELS, value)) {
        errors.tipoSolucion = 'Seleccioná un tipo de solución válido.';
    }
}

function validateMessage(value, errors) {
    if (!value) {
        if (!errors.consulta) errors.consulta = 'La consulta es obligatoria.';
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
        nombre: readText(body, ['nombre'], 'nombre', errors, { collapseWhitespace: true }),
        apellido: readText(body, ['apellido'], 'apellido', errors, { collapseWhitespace: true }),
        empresa: readText(body, ['empresa', 'compania'], 'empresa', errors, { collapseWhitespace: true }),
        telefono: readText(body, ['telefono'], 'telefono', errors, { collapseWhitespace: true }),
        tipoSolucion: readText(body, ['tipoSolucion', 'tipo-solucion'], 'tipoSolucion', errors, { collapseWhitespace: true }),
        consulta: readText(body, ['consulta', 'mensaje', 'producto'], 'consulta', errors)
    };

    validateName(value.nombre, 'nombre', true, errors);
    validateName(value.apellido, 'apellido', false, errors);
    validateOptionalText(value.empresa, 'empresa', errors);
    validatePhone(value.telefono, errors);
    validateSolution(value.tipoSolucion, errors);
    validateMessage(value.consulta, errors);

    return { value, errors };
}

function hasValidationErrors(errors) {
    return Object.keys(errors).length > 0;
}

function getSolutionLabel(value) {
    return SOLUTION_LABELS[value] || 'No especificada';
}

function toTelephoneUri(value) {
    const digits = value.replace(/\D/g, '');
    return value.startsWith('+') ? `+${digits}` : digits;
}

function isValidEmailAddress(value) {
    return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

module.exports = {
    FIELD_LIMITS,
    SOLUTION_LABELS,
    getSolutionLabel,
    hasValidationErrors,
    isValidEmailAddress,
    toTelephoneUri,
    validateSubmission
};
