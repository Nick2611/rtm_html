'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEmail } = require('./email-template');
const {
    hasValidationErrors,
    parseEmailList,
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

test('parsea una lista de correos separados por coma, sin espacios ni duplicados', () => {
    assert.deepEqual(
        parseEmailList(' ventas@rtm.com, contacto@rtm.com ,ventas@rtm.com,,'),
        ['ventas@rtm.com', 'contacto@rtm.com']
    );
    assert.deepEqual(parseEmailList('unico@rtm.com'), ['unico@rtm.com']);
    assert.deepEqual(parseEmailList(''), []);
    assert.deepEqual(parseEmailList(undefined), []);
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

/**
 * Identificadores de clic publicitario.
 *
 * Este es el dato que hace posible unir una consulta recibida con el clic que la originó. Hasta
 * ahora no se guardaba en ningún lado, y por eso ningún lead podía atribuirse a un anuncio.
 */
test('acepta gclid, wbraid y gbraid desde context.clickIds', () => {
    const { value, errors } = validateSubmission({
        ...validPayload,
        context: {
            page: '/contacto',
            clickIds: { gclid: 'Cj0KCQjw_abc-123', wbraid: 'Aa1bB2cC3', gbraid: '0AAAAA_bc' }
        }
    });

    assert.equal(hasValidationErrors(errors), false);
    assert.deepEqual(value.context.clickIds, {
        gclid: 'Cj0KCQjw_abc-123',
        wbraid: 'Aa1bB2cC3',
        gbraid: '0AAAAA_bc'
    });
});

test('acepta un gclid enviado en el nivel superior del cuerpo', () => {
    // La Lambda no controla qué versión del sitio tiene cacheada el navegador que le escribe.
    const { value } = validateSubmission({ ...validPayload, gclid: 'Cj0KCQjw_abc-123' });
    assert.equal(value.context.clickIds.gclid, 'Cj0KCQjw_abc-123');
});

test('descarta un identificador de clic con forma inválida en vez de guardarlo', () => {
    // Un valor con la forma equivocada no une con nada en Google Ads. Es mejor no tenerlo que
    // tenerlo y descubrirlo meses después como una fila que no cruza.
    for (const invalido of ['<script>', 'abc def', "x'; drop table", 'a'.repeat(300), '']) {
        const { value, errors } = validateSubmission({
            ...validPayload,
            context: { page: '/contacto', clickIds: { gclid: invalido } }
        });
        assert.equal(hasValidationErrors(errors), false, 'un click id inválido no debe rechazar la consulta');
        assert.equal(value.context.clickIds, undefined);
    }
});

test('una consulta sin identificador de clic sigue siendo válida', () => {
    // La mayoría del tráfico no es pago. La ausencia de gclid nunca puede bloquear un lead.
    const { value, errors } = validateSubmission(validPayload);
    assert.equal(hasValidationErrors(errors), false);
    assert.equal(value.context?.clickIds, undefined);
});

test('sanitizeCommercialContext tolera un contexto que no es objeto', () => {
    assert.deepEqual(sanitizeCommercialContext({ ...validPayload, context: 'gclid=abc' }), {});
});

/**
 * Persistencia de leads.
 *
 * La propiedad que se protege acá es una sola y manda sobre todo lo demás: **guardar un lead nunca
 * puede impedir que se envíe la consulta.** El mail es el negocio; el almacén es instrumentación.
 */
const { leadKey, buildLeadRecord } = require('./lead-store');

test('la clave del lead particiona por fecha UTC', () => {
    // El worker del ETL lee por prefijo: sin partición, listar "lo de ayer" recorre el bucket
    // entero y empeora con cada lead que entra.
    const key = leadKey(new Date('2026-08-11T15:30:00Z'), 'abc-123');
    assert.equal(key, 'leads/2026/08/11/abc-123.json');
});

test('la clave usa UTC y no la hora local', () => {
    // 02:00 UTC del 12 es todavía el 11 en Buenos Aires. La partición es UTC a propósito y de forma
    // declarada, para que el worker no tenga que adivinar en qué huso está el prefijo.
    assert.match(leadKey(new Date('2026-08-12T02:00:00Z'), 'x'), /^leads\/2026\/08\/12\//);
});

test('dos leads del mismo instante no colisionan', () => {
    // Dos consultas idénticas de la misma persona en el mismo minuto son dos leads reales.
    const instante = new Date('2026-08-11T15:30:00Z');
    assert.notEqual(leadKey(instante), leadKey(instante));
});

test('el registro guarda la consulta validada y el resultado del envío', () => {
    const { value } = validateSubmission(validPayload);
    const record = buildLeadRecord(value, {
        leadId: 'lead-1',
        receivedAt: '2026-08-11T15:30:00.000Z',
        sendStatus: 'sent',
        sesMessageId: 'ses-1',
        requestId: 'req-1'
    });

    assert.equal(record.schemaVersion, 1);
    assert.equal(record.delivery.status, 'sent');
    assert.equal(record.delivery.sesMessageId, 'ses-1');
    assert.equal(record.submission.nombre, 'Nicolás');
});

test('un envío fallido igual se guarda, con el estado en failed', () => {
    // Una consulta que llegó pero cuyo mail falló es justamente la que hay que poder encontrar
    // después. Perderla convertiría un problema de entrega en un lead que nadie vuelve a ver.
    const record = buildLeadRecord({}, {
        leadId: 'lead-2',
        receivedAt: '2026-08-11T15:30:00.000Z',
        sendStatus: 'failed',
        errorName: 'MessageRejected'
    });

    assert.equal(record.delivery.status, 'failed');
    assert.equal(record.delivery.errorName, 'MessageRejected');
    assert.equal(record.delivery.sesMessageId, null);
});

test('el gclid capturado llega al registro que se guarda', () => {
    // El recorrido completo: URL de aterrizaje -> formulario -> validación -> objeto en S3.
    // Es lo que hace posible unir un lead con el clic que lo pagó.
    const { value } = validateSubmission({
        ...validPayload,
        context: { page: '/contacto', clickIds: { gclid: 'Cj0KCQjw_abc-123' } }
    });
    const record = buildLeadRecord(value, {
        leadId: 'lead-3',
        receivedAt: '2026-08-11T15:30:00.000Z',
        sendStatus: 'sent'
    });

    assert.equal(record.submission.context.clickIds.gclid, 'Cj0KCQjw_abc-123');
});
