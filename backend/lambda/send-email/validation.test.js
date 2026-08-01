'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEmail } = require('./email-template');
const {
    CLIENT_TYPE_LABELS,
    SOLUTION_LABELS,
    hasValidationErrors,
    validateSubmission
} = require('./validation');
const frontendValidation = require('../../../js/contact-form');

const validPayload = Object.freeze({
    formVersion: '2',
    nombre: 'Nicolás',
    apellido: 'Méndez',
    empresa: 'RTM',
    tipoCliente: 'industria-corporativo',
    otroTipoCliente: '',
    telefono: '+54 9 11 5153-1530',
    tipoSolucion: 'pantallas-outdoor',
    consulta: 'Necesito cotizar una pantalla para exterior.'
});

test('acepta y normaliza una consulta válida', () => {
    const result = validateSubmission(validPayload);

    assert.equal(hasValidationErrors(result.errors), false);
    assert.deepEqual(result.value, validPayload);
});

test('rechaza letras y cantidades inválidas de dígitos en el teléfono', () => {
    const withLetters = validateSubmission({ ...validPayload, telefono: 'once 5153 1530' });
    const tooShort = validateSubmission({ ...validPayload, telefono: '1234567' });

    assert.match(withLetters.errors.telefono, /teléfono válido/i);
    assert.match(tooShort.errors.telefono, /teléfono válido/i);
});

test('el frontend elimina letras del teléfono y conserva formatos permitidos', () => {
    assert.equal(
        frontendValidation.sanitizePhoneInput('+54 nueve 11 5153-1530'),
        '+54 11 5153-1530'
    );
    assert.equal(frontendValidation.validatePhone('+54 9 11 5153-1530'), '');
    assert.match(frontendValidation.validatePhone('11 teléfono'), /teléfono válido/i);
});

test('rechaza tipos no string sin producir una excepción', () => {
    const result = validateSubmission({
        ...validPayload,
        nombre: { valor: 'Nicolás' },
        consulta: ['contenido inválido']
    });

    assert.equal(result.errors.nombre, 'El valor ingresado no es válido.');
    assert.equal(result.errors.consulta, 'El valor ingresado no es válido.');
});

test('acepta los alias usados por el formulario de productos', () => {
    const result = validateSubmission({
        formVersion: '2',
        nombre: 'María Sol',
        compania: 'Ejemplo SA',
        tipoCliente: 'comercio-retail',
        telefono: '11 5153 1530',
        tipoSolucion: 'unidades-comercios',
        producto: 'Quiero cotizar un tótem para un local comercial.'
    });

    assert.equal(hasValidationErrors(result.errors), false);
    assert.equal(result.value.empresa, 'Ejemplo SA');
    assert.match(result.value.consulta, /cotizar un tótem/);
});

test('mantiene compatibilidad durante el despliegue con formularios anteriores', () => {
    const legacyServicesForm = validateSubmission({
        nombre: 'María Sol',
        telefono: '11 5153 1530',
        consulta: 'Necesito asesoramiento para una pantalla.'
    });

    assert.equal(hasValidationErrors(legacyServicesForm.errors), false);
});

test('frontend y backend comparten las mismas soluciones y tipos de cliente', () => {
    frontendValidation.SOLUTION_OPTIONS.forEach(([value]) => {
        assert.ok(SOLUTION_LABELS[value], `Falta la solución ${value} en backend`);
    });
    frontendValidation.CLIENT_TYPE_OPTIONS.forEach(([value]) => {
        assert.ok(CLIENT_TYPE_LABELS[value], `Falta el tipo de cliente ${value} en backend`);
    });
});

test('requiere solución, tipo de cliente y detalle cuando se elige Otro', () => {
    const missingSelections = validateSubmission({
        ...validPayload,
        tipoCliente: '',
        tipoSolucion: ''
    });
    const missingOtherDetail = validateSubmission({
        ...validPayload,
        tipoCliente: 'otro',
        otroTipoCliente: ''
    });

    assert.match(missingSelections.errors.tipoCliente, /obligatorio/i);
    assert.match(missingSelections.errors.tipoSolucion, /obligatoria/i);
    assert.match(missingOtherDetail.errors.otroTipoCliente, /especificá/i);
});

test('valida la solución y los límites del mensaje', () => {
    const result = validateSubmission({
        ...validPayload,
        tipoSolucion: 'valor-inventado',
        consulta: 'Corta'
    });

    assert.match(result.errors.tipoSolucion, /solución válido/i);
    assert.match(result.errors.consulta, /entre 10 y 2000/i);
});

test('escapa los valores antes de incorporarlos al correo HTML', () => {
    const submission = {
        ...validPayload,
        empresa: '<script>alert("x")</script>',
        consulta: 'Consulta válida\n<img src=x onerror=alert(1)>'
    };
    const email = buildEmail(submission, new Date('2026-08-01T15:00:00Z'));

    assert.doesNotMatch(email.html, /<script>|<img src=x/);
    assert.match(email.html, /&lt;script&gt;/);
    assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(email.html, /Industria o empresa corporativa/);
    assert.match(email.text, /<script>alert/);
    assert.equal(email.subject, '[RTM] Nueva consulta - Nicolás Méndez');
});
