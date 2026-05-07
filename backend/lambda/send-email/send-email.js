const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const ses = new SESClient({ region: 'us-east-1' });

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
        const body = JSON.parse(event.body || '{}');
        const nombre = body.nombre?.trim();
        const apellido = body.apellido?.trim();
        const empresa = body.empresa?.trim();
        const telefono = body.telefono?.trim();
        const tipoSolucion = body.tipoSolucion?.trim() || body['tipo-solucion']?.trim();
        const consulta = body.consulta?.trim() || body.mensaje?.trim();

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
        const recipientEmail = process.env.EMAIL_ADDRESS; // Email donde recibes las consultas
        const senderEmail = process.env.SENDER_EMAIL; // Email que aparece como remitente
        
        if (!recipientEmail) {
            throw new Error('EMAIL_ADDRESS no está configurado');
        }
        
        if (!senderEmail) {
            throw new Error('SENDER_EMAIL no está configurado');
        }

        // Configurar el email
        const params = {
            Source: `"RTM Pantallas LED - Consultas" <${senderEmail}>`, // Email verificado en SES con nombre
            Destination: {
                ToAddresses: [recipientEmail]
            },
            Message: {
                Subject: {
                    Data: `[RTM Pantallas LED] Nueva consulta de ${nombre} ${apellido || ''}`,
                    Charset: 'UTF-8'
                },
                Body: {
                    Html: {
                        Data: `
                            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
                                    <h2 style="color: #007bff; margin-top: 0;">📧 Nueva Consulta - RTM Pantallas LED</h2>
                                </div>
                                
                                <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin: 20px 0;">
                                    <h3 style="color: #333; margin-top: 0;">Información del Cliente</h3>
                                    <p><strong>👤 Nombre:</strong> ${nombre} ${apellido || ''}</p>
                                    <p><strong>🏢 Empresa:</strong> ${empresa || 'No especificada'}</p>
                                    <p><strong>💡 Solución:</strong> ${tipoSolucion || 'No especificada'}</p>
                                    <p><strong>📞 Teléfono:</strong> <a href="tel:${telefono}" style="color: #007bff;">${telefono}</a></p>
                                </div>
                                
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h3 style="color: #333; margin-top: 0;">💬 Consulta</h3>
                                    <div style="background: white; padding: 15px; border-radius: 5px; border-left: 3px solid #28a745;">
                                        ${consulta.replace(/\n/g, '<br>')}
                                    </div>
                                </div>
                                
                                <div style="background: #e9ecef; padding: 15px; border-radius: 8px; font-size: 12px; color: #6c757d;">
                                    <p style="margin: 0;"><strong>📅 Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
                                    <p style="margin: 5px 0 0 0;"><strong>🌐 Origen:</strong> Formulario de contacto RTM Pantallas LED</p>
                                </div>
                            </div>
                        `,
                        Charset: 'UTF-8'
                    },
                    Text: {
                        Data: `
Nueva consulta desde RTM Pantallas LED

Nombre: ${nombre} ${apellido || ''}
Empresa: ${empresa || 'No especificada'}
Tipo de solución: ${tipoSolucion || 'No especificada'}
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
        const command = new SendEmailCommand(params);
        const result = await ses.send(command);

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
