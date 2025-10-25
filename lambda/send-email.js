const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'us-east-1' }); // Cambia la región según tu configuración

exports.handler = async (event) => {
    // Configurar CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Content-Type': 'application/json'
    };

    // Manejar preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'CORS preflight' })
        };
    }

    try {
        // Parsear el body del request
        const body = JSON.parse(event.body);
        const { nombre, apellido, empresa, telefono, consulta } = body;

        // Validar campos requeridos
        if (!nombre || !telefono || !consulta) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Faltan campos requeridos',
                    required: ['nombre', 'telefono', 'consulta']
                })
            };
        }

        // Obtener emails desde variables de entorno
        const recipientEmail = process.env.EMAIL_ADDRESS;
        const senderEmail = process.env.SENDER_EMAIL || 'mendeznicolas2611@gmail.com';
        
        if (!recipientEmail) {
            throw new Error('EMAIL_ADDRESS no está configurado');
        }

        // Configurar el email
        const params = {
            Source: `"RTM Pantallas LED" <${senderEmail}>`, // Email verificado en SES con nombre
            Destination: {
                ToAddresses: [recipientEmail]
            },
            Message: {
                Subject: {
                    Data: `Nueva consulta de ${nombre} ${apellido || ''} - RTM Pantallas LED`,
                    Charset: 'UTF-8'
                },
                Body: {
                    Html: {
                        Data: `
                            <h2>Nueva consulta desde RTM Pantallas LED</h2>
                            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                                <p><strong>Nombre:</strong> ${nombre} ${apellido || ''}</p>
                                <p><strong>Empresa:</strong> ${empresa || 'No especificada'}</p>
                                <p><strong>Teléfono:</strong> ${telefono}</p>
                                <p><strong>Consulta:</strong></p>
                                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                                    ${consulta.replace(/\n/g, '<br>')}
                                </div>
                                <hr>
                                <p style="color: #666; font-size: 12px;">
                                    <strong>Cliente:</strong> ${nombre} ${apellido || ''} (${telefono})<br>
                                    <strong>Empresa:</strong> ${empresa || 'No especificada'}<br>
                                    <strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}<br>
                                    <strong>Origen:</strong> Formulario de contacto RTM Pantallas LED
                                </p>
                            </div>
                        `,
                        Charset: 'UTF-8'
                    },
                    Text: {
                        Data: `
Nueva consulta desde RTM Pantallas LED

Nombre: ${nombre} ${apellido || ''}
Empresa: ${empresa || 'No especificada'}
Teléfono: ${telefono}

Consulta:
${consulta}

---
Enviado desde el formulario de contacto de RTM Pantallas LED
                        `,
                        Charset: 'UTF-8'
                    }
                }
            }
        };

        // Enviar el email
        const result = await ses.sendEmail(params).promise();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                message: 'Email enviado exitosamente',
                messageId: result.MessageId
            })
        };

    } catch (error) {
        console.error('Error enviando email:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Error interno del servidor',
                message: error.message
            })
        };
    }
};
