'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { S3Client } = require('@aws-sdk/client-s3');
const { SESClient } = require('@aws-sdk/client-ses');

const { validateWhatsAppClick, isWhatsAppClick } = require('./whatsapp-click');
const { whatsappClickKey, buildWhatsAppClickRecord } = require('./lead-store');

/**
 * Pruebas del registro de clics en WhatsApp.
 *
 * Lo que protegen, en orden de gravedad si se rompen:
 *
 *   1. Un clic NUNCA manda un mail. Cada toque al botón sería un correo vacío en la bandeja.
 *   2. Un clic NUNCA pasa por la validación del formulario, y un formulario nunca pasa por acá.
 *   3. El código y el gclid se aceptan sólo con la forma exacta que emiten el sitio y Google.
 */

const GCLID = 'Cj0KCQjw_abc-123XYZ';

function validClick(overrides = {}) {
    return {
        event: 'whatsapp_click',
        ref: 'K7Q3M',
        placement: 'landing-hero',
        context: {
            page: '/productos/pisos-led.html',
            utm: { utm_source: 'google', utm_medium: 'cpc' },
            clickIds: { gclid: GCLID }
        },
        ...overrides
    };
}

/** Carga el handler con S3 y SES interceptados, sin tocar AWS. */
function loadHandler({ bucket = 'rtm-leads-raw', s3Fails = false } = {}) {
    for (const file of ['./send-email', './lead-store', './whatsapp-click']) {
        delete require.cache[require.resolve(file)];
    }

    const s3Puts = [];
    const sesSends = [];
    const originalS3 = S3Client.prototype.send;
    const originalSes = SESClient.prototype.send;
    const previousBucket = process.env.LEADS_BUCKET;

    S3Client.prototype.send = async command => {
        if (s3Fails) {
            const error = new Error('denied');
            error.name = 'AccessDenied';
            throw error;
        }
        s3Puts.push(command.input);
        return {};
    };
    SESClient.prototype.send = async command => {
        sesSends.push(command.input);
        return { MessageId: 'test' };
    };

    if (bucket) process.env.LEADS_BUCKET = bucket;
    else delete process.env.LEADS_BUCKET;

    const { handler } = require('./send-email');

    const restore = () => {
        S3Client.prototype.send = originalS3;
        SESClient.prototype.send = originalSes;
        if (previousBucket === undefined) delete process.env.LEADS_BUCKET;
        else process.env.LEADS_BUCKET = previousBucket;
    };

    return { handler, s3Puts, sesSends, restore };
}

function post(body) {
    // Tal como llega un beacon: text/plain, el cuerpo como string.
    return {
        httpMethod: 'POST',
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(body),
        requestContext: { requestId: 'req-1' }
    };
}

test('un clic válido se acepta con todos sus datos', () => {
    const { value, errors } = validateWhatsAppClick(validClick());

    assert.deepEqual(errors, {});
    assert.equal(value.ref, 'K7Q3M');
    assert.equal(value.placement, 'landing-hero');
    assert.equal(value.page, '/productos/pisos-led.html');
    assert.deepEqual(value.clickIds, { gclid: GCLID });
    assert.equal(value.utm.source, 'google');
});

test('un clic sin identificador de Google igual se guarda', () => {
    // El tráfico orgánico también escribe. Sirve para medir clic → mensaje, aunque no se suba a Ads.
    const click = validClick();
    delete click.context.clickIds;

    const { value } = validateWhatsAppClick(click);

    assert.equal(value.ref, 'K7Q3M');
    assert.equal(value.clickIds, undefined);
});

test('un código con caracteres ambiguos o forma rara se rechaza', () => {
    for (const ref of ['K7Q3', 'K7Q3MM', 'k7q3m', 'K0Q3M', 'KIQ3M', 'KLQ3M', 'KOQ3M', '<b>X', '', 12345]) {
        const { value, errors } = validateWhatsAppClick(validClick({ ref }));
        assert.equal(value, null, `debería rechazar ${ref}`);
        assert.ok(errors.ref);
    }
});

test('una página con query string o fragmento se rechaza', () => {
    for (const page of ['/productos/pisos-led.html?tel=1155555555', '/index.html#x', 'productos.html', 'https://x.com/']) {
        const click = validClick();
        click.context.page = page;
        assert.equal(validateWhatsAppClick(click).value, null, `debería rechazar ${page}`);
    }
});

test('un gclid manipulado se descarta sin tumbar el registro', () => {
    const click = validClick();
    click.context.clickIds = { gclid: 'abc"><script>' };

    const { value } = validateWhatsAppClick(click);

    assert.equal(value.ref, 'K7Q3M');
    assert.equal(value.clickIds, undefined);
});

test('un cuerpo inflado se rechaza', () => {
    const click = validClick({ relleno: 'x'.repeat(3000) });
    assert.equal(validateWhatsAppClick(click).value, null);
});

test('sólo event=whatsapp_click entra por esta ruta', () => {
    assert.equal(isWhatsAppClick(validClick()), true);
    assert.equal(isWhatsAppClick({ nombre: 'Ana', telefono: '1155555555', consulta: 'Hola, quiero cotizar' }), false);
    assert.equal(isWhatsAppClick(null), false);
    assert.equal(isWhatsAppClick([validClick()]), false);
});

test('la clave lleva fecha UTC y el código delante del UUID', () => {
    const key = whatsappClickKey('K7Q3M', new Date('2026-09-18T02:30:00Z'), 'abc');
    assert.equal(key, 'whatsapp-clicks/2026/09/18/K7Q3M-abc.json');
});

test('el registro guarda la hora del servidor, no la del teléfono', () => {
    const record = buildWhatsAppClickRecord({ ref: 'K7Q3M' }, {
        clickId: 'abc',
        receivedAt: '2026-09-18T02:30:00.000Z',
        requestId: 'req-1'
    });

    assert.equal(record.schemaVersion, 1);
    assert.equal(record.receivedAt, '2026-09-18T02:30:00.000Z');
    assert.equal(record.click.ref, 'K7Q3M');
});

test('el handler guarda el clic en S3 y NO manda ningún mail', async () => {
    const { handler, s3Puts, sesSends, restore } = loadHandler();
    try {
        const result = await handler(post(validClick()));

        assert.equal(result.statusCode, 202);
        assert.equal(sesSends.length, 0, 'un clic nunca puede mandar un mail');
        assert.equal(s3Puts.length, 1);
        assert.match(s3Puts[0].Key, /^whatsapp-clicks\/\d{4}\/\d{2}\/\d{2}\/K7Q3M-[0-9a-f-]{36}\.json$/);
        assert.equal(s3Puts[0].ServerSideEncryption, 'AES256');
        assert.deepEqual(JSON.parse(s3Puts[0].Body).click.clickIds, { gclid: GCLID });
    } finally {
        restore();
    }
});

test('el handler acepta el cuerpo en base64', async () => {
    const { handler, s3Puts, restore } = loadHandler();
    try {
        const event = post(validClick());
        event.body = Buffer.from(event.body).toString('base64');
        event.isBase64Encoded = true;

        const result = await handler(event);

        assert.equal(result.statusCode, 202);
        assert.equal(s3Puts.length, 1);
    } finally {
        restore();
    }
});

test('un clic inválido devuelve 400 y no escribe nada', async () => {
    const { handler, s3Puts, sesSends, restore } = loadHandler();
    try {
        const result = await handler(post(validClick({ ref: 'mal' })));

        assert.equal(result.statusCode, 400);
        assert.equal(s3Puts.length, 0);
        assert.equal(sesSends.length, 0);
    } finally {
        restore();
    }
});

test('sin bucket o con S3 caído devuelve 503, sin mail', async () => {
    for (const options of [{ bucket: '' }, { s3Fails: true }]) {
        const { handler, sesSends, restore } = loadHandler(options);
        try {
            const result = await handler(post(validClick()));
            assert.equal(result.statusCode, 503);
            assert.equal(sesSends.length, 0);
        } finally {
            restore();
        }
    }
});

test('el formulario sigue yendo por validateSubmission y no se guarda como clic', async () => {
    const { handler, s3Puts, restore } = loadHandler();
    try {
        // Un formulario vacío: si entrara por la ruta de clics devolvería 400 por el código, no por
        // los campos del formulario.
        const result = await handler(post({ nombre: '' }));
        const body = JSON.parse(result.body);

        assert.equal(result.statusCode, 400);
        assert.ok(body.fields && body.fields.nombre, 'se esperaba el error de campo del formulario');
        assert.equal(s3Puts.length, 0);
    } finally {
        restore();
    }
});
