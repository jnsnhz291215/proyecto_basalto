'use strict';

const nodemailer = require('nodemailer');

// ── Transporter ──────────────────────────────────────────────────────────────

function createTransporter() {
  const smtpUser = String(process.env.SMTP_USER || process.env.MAIL_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || process.env.MAIL_PASS || '').trim().replace(/[\[\]\s]/g, '');
  const smtpPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
  const smtpSecure = smtpPort === 465;

  if (!smtpUser || !smtpPass) {
    throw new Error('Credenciales SMTP no configuradas. Define SMTP_USER/SMTP_PASS o MAIL_USER/MAIL_PASS.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.ethereal.email',
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass }
  });

  // El from DEBE coincidir con la cuenta autenticada (requerimiento de Google/Gmail).
  // Se puede personalizar el nombre visible, pero el email debe ser el mismo.
  const from = process.env.MAIL_FROM || `Basalto Drilling (No responder) <${smtpUser}>`;

  return { transporter, from, replyTo: smtpUser };
}

// ── Template maestro ─────────────────────────────────────────────────────────

/**
 * Genera el HTML de un correo de Basalto Drilling.
 * @param {string} title      — Subtítulo que aparece en el header (ej: "Informe de Turno")
 * @param {string} bodyHtml   — Contenido central (HTML libre)
 * @param {{ label: string, url: string } | null} ctaButton — Botón CTA opcional
 */
function buildEmailHtml(title, bodyHtml, ctaButton = null) {
  const cta = ctaButton
    ? `<div style="text-align:center;margin:28px 0 8px;">
         <a href="${ctaButton.url}"
            style="background:#5754a8;color:#ffffff;text-decoration:none;
                   padding:13px 32px;border-radius:7px;font-size:15px;
                   font-weight:700;display:inline-block;letter-spacing:0.3px;">
           ${ctaButton.label}
         </a>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f2f3f8;
             font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f2f3f8;padding:36px 16px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:10px;
                    overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.09);">

        <!-- ── Cabecera ── -->
        <tr>
          <td style="background:#5754a8;padding:28px 36px;">
            <span style="font-size:20px;font-weight:800;color:#ffffff;
                         letter-spacing:0.5px;">Basalto Drilling</span>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.82);font-size:14px;">
              ${title}
            </p>
          </td>
        </tr>

        <!-- ── Cuerpo ── -->
        <tr>
          <td style="padding:32px 36px;color:#1f2937;font-size:15px;line-height:1.75;">
            ${bodyHtml}
            ${cta}
          </td>
        </tr>

        <!-- ── Footer no-reply ── -->
        <tr>
          <td style="background:#f2f3f8;padding:20px 36px;
                     border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.65;">
              Este es un mensaje automático. Por favor, no respondas a esta casilla
              ya que no es monitoreada. Si necesitas ayuda, contacta al área de
              <strong>Logística</strong>.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">
              © Basalto Drilling — Sistema de Gestión Interno
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Envío ─────────────────────────────────────────────────────────────────────

/**
 * Envía un correo. Lanza excepción si falla (el caller decide si propagar).
 * @param {{ to: string, subject: string, html: string, attachments?: Array }} opts
 */
async function sendMail({ to, subject, html, attachments = [] }) {
  const { transporter, from, replyTo } = createTransporter();
  await transporter.sendMail({ from, replyTo, to, subject, html, attachments });
  console.log(`[MAIL] OK → ${to} | "${subject}"`);
}

/**
 * Versión fire-and-forget: registra el error en log sin propagar.
 * Ideal para notificaciones secundarias (cambio de clave, etc.).
 */
async function sendMailSafe(opts) {
  try {
    await sendMail(opts);
  } catch (err) {
    console.error(`[MAIL][ERROR] Fallo al enviar a ${opts.to}: ${err.message}`);
  }
}

module.exports = { buildEmailHtml, sendMail, sendMailSafe };
