'use strict';

const { randomUUID } = require('node:crypto');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { buildEmail } = require('./email-template');
const { persistLead } = require('./lead-store');
const {
    hasValidationErrors,
    isValidEmailAddress,
    parseEmailList,
    validateSubmission
} = require('./validation');

const ses = new SESClient({ region: 'us-east-1' });
const MAX_REQUEST_BYTES = 12_000;

const headers = Object.freeze({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
});

function response(statusCode, body) {
    return {
        statusCode,
        headers,
        body: JSON.stringify(body)
    };
}

function parseRequestBody(event) {
    const rawBody = event?.body;

    if (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)) {
        return rawBody;
    }

    if (typeof rawBody !== 'string') {
        throw new SyntaxError('Request body must be JSON.');
    }

    const decodedBody = event.isBase64Encoded
        ? Buffer.from(rawBody, 'base64').toString('utf8')
        : rawBody;

    if (Buffer.byteLength(decodedBody, 'utf8') > MAX_REQUEST_BYTES) {
        const error = new RangeError('Request body is too large.');
        error.code = 'PAYLOAD_TOO_LARGE';
        throw error;
    }

    return JSON.parse(decodedBody);
}

exports.handler = async (event) => {
    const method = event?.httpMethod || event?.requestContext?.http?.method;

    if (method === 'OPTIONS') {
        return response(200, { success: true });
    }

    if (method && method !== 'POST') {
        return response(405, {
            success: false,
            error: 'Método no permitido.'
        });
    }

    let body;

    try {
        body = parseRequestBody(event);
    } catch (error) {
        if (error.code === 'PAYLOAD_TOO_LARGE') {
            return response(413, {
                success: false,
                error: 'La solicitud es demasiado extensa.'
            });
        }

        return response(400, {
            success: false,
            error: 'La solicitud no contiene un JSON válido.'
        });
    }

    const { value: submission, errors } = validateSubmission(body);

    if (hasValidationErrors(errors)) {
        return response(400, {
            success: false,
            error: 'Revisá los campos indicados.',
            fields: errors
        });
    }

    const recipientEmails = parseEmailList(process.env.EMAIL_ADDRESS);
    const senderEmail = process.env.SENDER_EMAIL?.trim();

    if (
        recipientEmails.length === 0 ||
        !recipientEmails.every(isValidEmailAddress) ||
        !isValidEmailAddress(senderEmail)
    ) {
        console.error(JSON.stringify({
            event: 'contact_email_configuration_error',
            requestId: event?.requestContext?.requestId
        }));

        return response(500, {
            success: false,
            error: 'No pudimos procesar la consulta en este momento.'
        });
    }

    const email = buildEmail(submission);
    const command = new SendEmailCommand({
        Source: `"RTM Pantallas LED" <${senderEmail}>`,
        Destination: {
            ToAddresses: recipientEmails
        },
        Message: {
            Subject: {
                Data: email.subject,
                Charset: 'UTF-8'
            },
            Body: {
                Html: {
                    Data: email.html,
                    Charset: 'UTF-8'
                },
                Text: {
                    Data: email.text,
                    Charset: 'UTF-8'
                }
            }
        }
    });

    const requestId = event?.requestContext?.requestId;
    const leadId = randomUUID();
    const receivedAt = new Date().toISOString();

    /**
     * Guarda el lead y registra el resultado. NUNCA lanza y NUNCA cambia lo que se le responde al
     * navegador: el mail es el negocio y esto es instrumentación. `persistLead` ya atrapa todo,
     * y este `try` es el segundo cinturón por si algo cambia ahí adentro.
     *
     * Se llama DESPUÉS de resolver el envío, en las dos ramas, porque el resultado del envío es
     * parte del lead: una consulta que llegó pero cuyo mail falló es justamente la que hay que
     * poder encontrar después, y sólo se sabe una vez que SES contestó.
     */
    const storeLead = async (sendStatus, extra = {}) => {
        try {
            const outcome = await persistLead(submission, {
                leadId,
                receivedAt,
                requestId,
                sendStatus,
                ...extra
            });

            if (!outcome.stored) {
                console.warn(JSON.stringify({
                    event: 'contact_lead_not_persisted',
                    reason: outcome.reason,
                    leadId,
                    requestId
                }));
            }
        } catch (error) {
            console.warn(JSON.stringify({
                event: 'contact_lead_persist_threw',
                errorName: error?.name,
                leadId,
                requestId
            }));
        }
    };

    try {
        const result = await ses.send(command);

        console.info(JSON.stringify({
            event: 'contact_email_sent',
            messageId: result.MessageId,
            leadId,
            requestId
        }));

        await storeLead('sent', { sesMessageId: result.MessageId });

        return response(200, { success: true });
    } catch (error) {
        console.error(JSON.stringify({
            event: 'contact_email_send_failed',
            errorName: error.name,
            leadId,
            requestId
        }));

        // Se guarda igual. El mail falló, pero la consulta existió: perderla además sería convertir
        // un problema de entrega en un lead que nadie va a volver a ver.
        await storeLead('failed', { errorName: error.name });

        return response(500, {
            success: false,
            error: 'No pudimos enviar la consulta. Intentá nuevamente en unos minutos.'
        });
    }
};

exports.parseRequestBody = parseRequestBody;
