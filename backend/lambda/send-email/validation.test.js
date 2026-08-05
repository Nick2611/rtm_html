'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEmail } = require('./email-template');
const {
    hasValidationErrors,
    sanitizeCommercialContext,
    validateSubmission
} = require('./validation');
const frontendValidation = require('../../../js/contact-form');

const validPayload = Object.freeze({
    nombre: 'Nicolás',
    apellido: 'Méndez',
    empresa: 'RTM',
    tipoCliente: 'Industria o empresa corporativa',
    otroTipoCliente: '',
    telefono: '+54 9 11 5153-1530',
    tipoSolucion: 'Pantallas LED Outdoor',
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

test('acepta una nueva solución segura sin depender de otra lista de opciones', () => {
    const result = validateSubmission({
        ...validPayload,
        tipoSolucion: 'Proyecto LED especial para una vidriera'
    });

    assert.equal(hasValidationErrors(result.errors), false);
    assert.equal(result.value.tipoSolucion, 'Proyecto LED especial para una vidriera');
});

test('acepta apellido, empresa, tipo de cliente y solución vacíos', () => {
    const minimalSubmission = validateSubmission({
        nombre: validPayload.nombre,
        telefono: validPayload.telefono,
        consulta: validPayload.consulta
    });

    assert.equal(hasValidationErrors(minimalSubmission.errors), false);
    assert.equal(minimalSubmission.value.apellido, '');
    assert.equal(minimalSubmission.value.empresa, '');
    assert.equal(minimalSubmission.value.tipoCliente, '');
    assert.equal(minimalSubmission.value.tipoSolucion, '');

    const email = buildEmail(minimalSubmission.value, new Date('2026-08-01T15:00:00Z'));
    assert.doesNotMatch(email.html, /undefined|null/);
    assert.match(email.html, /No especificad[ao]/);
    assert.equal(email.subject, '[RTM] Nueva consulta - Nicolás');
});

test('mantiene opcional el detalle cuando se elige Otro como tipo de cliente', () => {
    const submission = validateSubmission({
        ...validPayload,
        tipoCliente: 'Otro',
        otroTipoCliente: ''
    });

    assert.equal(hasValidationErrors(submission.errors), false);
    const email = buildEmail(submission.value, new Date('2026-08-01T15:00:00Z'));
    assert.match(email.html, />Otro</);
});

test('valida la solución y los límites del mensaje', () => {
    const result = validateSubmission({
        ...validPayload,
        tipoSolucion: 'x'.repeat(121),
        consulta: 'Corta'
    });

    assert.match(result.errors.tipoSolucion, /solución válida/i);
    assert.match(result.errors.consulta, /entre 10 y 2000/i);
});

test('escapa los valores antes de incorporarlos al correo HTML', () => {
    const submission = {
        ...validPayload,
        empresa: '<script>alert("x")</script>',
        consulta: 'Consulta válida\n<img src=x onerror=alert(1)>',
        context: {
            page: '/productos.html',
            product: '<img src=x onerror=alert(2)>',
            category: 'pantallas-led',
            referrer: 'https://buscador.example/?q=<script>alert(3)</script>',
            utm: {
                source: 'google',
                campaign: '<b>pantallas</b>'
            }
        }
    };
    const email = buildEmail(submission, new Date('2026-08-01T15:00:00Z'));

    assert.doesNotMatch(email.html, /<script>|<img src=x/);
    assert.match(email.html, /&lt;script&gt;/);
    assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(email.html, /&lt;img src=x onerror=alert\(2\)&gt;/);
    assert.match(email.html, /Contexto comercial/);
    assert.match(email.html, /UTM campaign/);
    assert.match(email.html, /Industria o empresa corporativa/);
    assert.match(email.text, /<script>alert/);
    assert.match(email.text, /Producto: <img src=x onerror=alert\(2\)>/);
    assert.equal(email.subject, '[RTM] Nueva consulta - Nicolás Méndez');
});

test('sanitiza y limita el contexto comercial sin bloquear la consulta', () => {
    const result = validateSubmission({
        ...validPayload,
        context: {
            page: '  /productos.html\n ',
            product: 'RI640\u0000<script>alert(1)</script>',
            category: '  pantallas-led  ',
            referrer: 'https://google.example/busqueda?q=pantallas\tled',
            utm: {
                source: ' google\nads ',
                medium: ' cpc ',
                campaign: 'x'.repeat(220)
            }
        }
    });

    assert.equal(hasValidationErrors(result.errors), false);
    assert.equal(result.value.context.page, '/productos.html');
    assert.equal(result.value.context.product, 'RI640 <script>alert(1)</script>');
    assert.equal(result.value.context.category, 'pantallas-led');
    assert.equal(result.value.context.referrer, 'https://google.example/busqueda?q=pantallas led');
    assert.equal(result.value.context.utm.source, 'google ads');
    assert.equal(result.value.context.utm.medium, 'cpc');
    assert.equal(result.value.context.utm.campaign.length, 160);
});

test('ignora valores de contexto no textuales y acepta aliases UTM planos', () => {
    const context = sanitizeCommercialContext({
        context: {
            product: ['RI640'],
            category: { slug: 'pantallas-led' }
        },
        page: '/index.html',
        producto: 'RE960',
        utm_source: 'newsletter'
    });

    assert.deepEqual(context, {
        page: '/index.html',
        product: 'RE960',
        utm: {
            source: 'newsletter',
            medium: '',
            campaign: '',
            term: '',
            content: ''
        }
    });
});

test('el frontend deriva producto, categoría, referrer y UTM de la URL', () => {
    const locationLike = {
        href: 'https://pantallasledrtm.com/index.html?producto=RI640&categoria=Pantallas+LED&subcategoria=Indoor#contacto'
    };
    const documentLike = {
        referrer: 'https://pantallasledrtm.com/productos.html?cat=pantallas-led&utm_source=google&utm_medium=cpc&utm_campaign=agosto'
    };

    assert.deepEqual(
        frontendValidation.deriveCommercialContext(locationLike, documentLike),
        {
            page: '/index.html',
            product: 'RI640',
            category: 'Pantallas LED',
            referrer: 'https://pantallasledrtm.com/productos.html?cat=pantallas-led&utm_source=google&utm_medium=cpc&utm_campaign=agosto',
            utm: {
                source: 'google',
                medium: 'cpc',
                campaign: 'agosto',
                term: '',
                content: ''
            }
        }
    );
    assert.equal(frontendValidation.requestedSolution(locationLike), 'Pantallas LED Indoor');
});
