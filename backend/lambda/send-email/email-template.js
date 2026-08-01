'use strict';

const { getSolutionLabel, toTelephoneUri } = require('./validation');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(date) {
    return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).format(date);
}

function detailRow(label, value, { href } = {}) {
    const renderedValue = href
        ? `<a href="${escapeHtml(href)}" style="color:#1f2937;text-decoration:underline;">${escapeHtml(value)}</a>`
        : escapeHtml(value);

    return `
        <tr>
            <td style="padding:10px 0;color:#6b7280;font-size:13px;vertical-align:top;width:145px;">${escapeHtml(label)}</td>
            <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;vertical-align:top;">${renderedValue}</td>
        </tr>`;
}

function buildEmail(submission, now = new Date()) {
    const fullName = [submission.nombre, submission.apellido].filter(Boolean).join(' ');
    const company = submission.empresa || 'No especificada';
    const solution = getSolutionLabel(submission.tipoSolucion);
    const submittedAt = formatDate(now);
    const telephoneUri = `tel:${toTelephoneUri(submission.telefono)}`;
    const formattedMessage = escapeHtml(submission.consulta).replace(/\n/g, '<br>');

    const html = `<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nueva consulta</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                    <tr>
                        <td style="padding:28px 32px;border-top:4px solid #c83f3a;border-bottom:1px solid #e5e7eb;">
                            <p style="margin:0 0 8px;color:#c83f3a;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">RTM Pantallas LED</p>
                            <h1 style="margin:0;color:#111827;font-size:24px;line-height:1.3;font-weight:700;">Nueva consulta desde el sitio web</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px 12px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                                ${detailRow('Nombre', fullName)}
                                ${detailRow('Empresa', company)}
                                ${detailRow('Solución', solution)}
                                ${detailRow('Teléfono', submission.telefono, { href: telephoneUri })}
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:12px 32px 28px;">
                            <p style="margin:0 0 10px;color:#6b7280;font-size:13px;">Consulta</p>
                            <div style="padding:18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;color:#1f2937;font-size:14px;line-height:1.65;">${formattedMessage}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
                            Recibido el ${escapeHtml(submittedAt)} mediante el formulario de pantallasledrtm.com.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    const text = `RTM Pantallas LED
Nueva consulta desde el sitio web

Nombre: ${fullName}
Empresa: ${company}
Solución: ${solution}
Teléfono: ${submission.telefono}

Consulta:
${submission.consulta}

Recibido el ${submittedAt} mediante el formulario de pantallasledrtm.com.`;

    return {
        subject: `[RTM] Nueva consulta - ${fullName}`,
        html,
        text
    };
}

module.exports = { buildEmail, escapeHtml, formatDate };
