'use strict';

const { randomUUID } = require('node:crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Persistencia de leads en S3.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. Hasta ahora la Lambda mandaba el mail por SES y descartaba la
 * consulta. No quedaba ninguna copia en ningún lado, así que ninguna consulta recibida era
 * recuperable ni analizable: el embudo terminaba en "se envió un mail" y todo lo que pasaba después
 * era invisible. Sin esto, la última etapa del embudo del almacén no puede existir.
 *
 * POR QUÉ S3 Y NO LA BASE DE DATOS DIRECTO. La Lambda corre en AWS us-east-1 y el almacén corre en
 * una laptop sin dirección pública. No hay ninguna ruta de red desde una a la otra. S3 es el buzón:
 * la Lambda escribe, y el worker `leads` del ETL lee cuando la laptop está encendida.
 *
 * ============================================================================================
 * LA REGLA QUE MANDA SOBRE TODO LO DEMÁS EN ESTE ARCHIVO
 * ============================================================================================
 * NADA DE LO QUE PASE ACÁ PUEDE IMPEDIR QUE SE ENVÍE UNA CONSULTA.
 *
 * El mail es el negocio; el almacén es instrumentación. Un bucket mal configurado, un permiso que
 * falta, S3 caído o una credencial vencida tienen que terminar en una línea de log y en que el
 * formulario siga funcionando igual. Por eso `persistLead` no lanza nunca, devuelve un resultado en
 * vez de un booleano, y quien lo llama lo hace DESPUÉS de resolver el envío.
 */

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = (process.env.LEADS_BUCKET || '').trim();

// Cliente perezoso: si el bucket no está configurado, no hay que construir nada. Así la Lambda
// sigue arrancando igual en un entorno donde la persistencia todavía no se desplegó.
let cachedClient = null;

function client() {
    if (!cachedClient) cachedClient = new S3Client({ region: REGION });
    return cachedClient;
}

/**
 * `leads/YYYY/MM/DD/<uuid>.json`.
 *
 * Particionado por fecha UTC porque el worker del ETL lee por prefijo: sin la partición, listar
 * "lo de ayer" obligaría a recorrer el bucket entero, y eso empeora con cada lead que entra.
 *
 * UUID y no algo derivado del contenido: dos consultas idénticas de la misma persona en el mismo
 * minuto son dos leads reales, y una clave por contenido las colapsaría en uno.
 */
function leadKey(now = new Date(), id = randomUUID()) {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `leads/${year}/${month}/${day}/${id}.json`;
}

/**
 * El cuerpo que se guarda.
 *
 * Se guarda la consulta VALIDADA, no el cuerpo crudo de la petición: lo crudo ya pasó por
 * `validateSubmission`, y guardar lo de antes significaría guardar lo que un atacante mandó tal
 * cual. Lo validado es lo que la empresa realmente recibió.
 *
 * `schemaVersion` va adelante porque este objeto lo lee un proceso distinto, en otra máquina, meses
 * después. Cuando el formulario cambie de campos, el worker tiene que poder distinguir un lead
 * viejo de uno nuevo sin adivinar por las claves que encuentre.
 */
function buildLeadRecord(submission, meta) {
    return {
        schemaVersion: 1,
        leadId: meta.leadId,
        receivedAt: meta.receivedAt,
        // El resultado del envío por SES, guardado junto al lead. Una consulta que llegó pero cuyo
        // mail falló es exactamente la que hay que poder encontrar después.
        delivery: {
            status: meta.sendStatus,
            sesMessageId: meta.sesMessageId || null,
            errorName: meta.errorName || null
        },
        requestId: meta.requestId || null,
        submission
    };
}

/**
 * Guarda un lead. Nunca lanza.
 *
 * Devuelve `{ stored, reason }` en vez de un booleano para que el log diga POR QUÉ no se guardó:
 * "sin bucket configurado" y "S3 rechazó la escritura" piden acciones distintas, y a las tres de la
 * mañana la diferencia entre las dos es toda la información que hay.
 */
async function persistLead(submission, meta = {}) {
    if (!BUCKET) {
        return { stored: false, reason: 'bucket_not_configured', key: null };
    }

    const receivedAt = meta.receivedAt || new Date().toISOString();
    const leadId = meta.leadId || randomUUID();
    const key = leadKey(new Date(receivedAt), leadId);

    try {
        await client().send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: JSON.stringify(buildLeadRecord(submission, { ...meta, leadId, receivedAt })),
            ContentType: 'application/json; charset=utf-8',
            // Un lead contiene datos personales: nombre, teléfono, empresa. Se cifra en reposo con
            // claves gestionadas por S3. El bucket además bloquea todo acceso público por política,
            // pero eso se declara en la plantilla de infraestructura, no acá.
            ServerSideEncryption: 'AES256'
        }));

        return { stored: true, reason: null, key };
    } catch (error) {
        // Se registra el NOMBRE del error, no el error entero: los mensajes de S3 pueden incluir la
        // clave del objeto y los logs de la Lambda son más accesibles que el bucket.
        return { stored: false, reason: error?.name || 'unknown_error', key };
    }
}

module.exports = { persistLead, leadKey, buildLeadRecord };
