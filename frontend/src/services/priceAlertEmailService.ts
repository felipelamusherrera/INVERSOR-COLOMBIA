import { supabase } from '../lib/supabase';

export interface PriceAlertEmailPayload {
  toEmail: string;
  ticker: string;
  company: string;
  currentPrice: number;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  note?: string;
  appUrl?: string;
}

export interface PriceAlertEmailResult {
  delivered: boolean;
  provider: string;
  recipient: string;
  subject: string;
  htmlBody: string;
  message?: string;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Construye el correo HTML institucional con el logotipo oficial de INVERSOR COLOMBIA
 * y el resumen estructurado de la alerta de precio activada.
 */
export function buildPriceAlertEmailHtml(payload: PriceAlertEmailPayload): string {
  const safeTicker = escapeHtml(payload.ticker.toUpperCase());
  const safeCompany = escapeHtml(payload.company || payload.ticker);
  const safeNote = payload.note ? escapeHtml(payload.note) : '';
  const safeRecipient = escapeHtml(payload.toEmail);
  const isAbove = payload.condition === 'ABOVE';
  const conditionText = isAbove
    ? 'Cruza hacia arriba (Ruptura de Resistencia)'
    : 'Cruza hacia abajo (Zona de Soporte)';
  const badgeColor = isAbove ? '#10b981' : '#f59e0b';
  const diffUsd = payload.currentPrice - payload.targetPrice;
  const diffPct = payload.targetPrice > 0 ? (diffUsd / payload.targetPrice) * 100 : 0;
  const portalUrl = escapeHtml(payload.appUrl || 'https://inversor-colombia-app.vercel.app');
  const timestampStr = new Date().toLocaleString('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alerta de Precio ${safeTicker} — Inversor Colombia</title>
</head>
<body style="margin:0;padding:0;background-color:#030712;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#030712;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#0b1120;border:1px solid #1e293b;border-radius:16px;overflow:hidden;box-shadow:0 20px 45px rgba(0,0,0,0.6);">
          
          <!-- Header Institucional con Logotipo INVERSOR COLOMBIA -->
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,#070b14 0%,#0f172a 100%);border-bottom:1px solid #1e293b;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);text-align:center;vertical-align:middle;">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;">
                            <path d="M3 3v18h18" />
                            <path d="M18 17V9" />
                            <path d="M13 17V5" />
                            <path d="M8 17v-3" />
                          </svg>
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <div style="font-size:18px;font-weight:900;letter-spacing:-0.02em;color:#ffffff;line-height:1.1;">
                            INVERSOR <span style="color:#10b981;">COLOMBIA</span>
                          </div>
                          <div style="margin-top:3px;">
                            <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:0.06em;color:#10b981;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.35);border-radius:4px;padding:1px 6px;">PRO QUANT</span>
                            <span style="font-size:11px;color:#94a3b8;margin-left:6px;">Inteligencia Cuantitativa de Mercados</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.4);color:#fbbf24;font-size:11px;font-weight:800;">
                      ALERTA ACTIVADA
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal del Mensaje de Alerta -->
          <tr>
            <td style="padding:28px;">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#38bdf8;margin-bottom:6px;">
                Notificación Automática de Cruce de Precio
              </div>
              <h1 style="margin:0 0 10px 0;font-size:24px;font-weight:900;color:#ffffff;">
                ${safeTicker} — ${safeCompany}
              </h1>
              <p style="margin:0 0 22px 0;font-size:14px;line-height:1.6;color:#cbd5e1;">
                Hola, tu alerta configurada en <strong style="color:#ffffff;">Inversor Colombia</strong> se ha cumplido exitosamente. La cotización en vivo de <strong style="color:#ffffff;">${safeTicker}</strong> alcanzó el umbral definido de <strong style="color:#fbbf24;">$${payload.targetPrice.toFixed(2)} USD</strong>.
              </p>

              <!-- Tarjetas Comparativas de Precios -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td width="48%" style="background-color:#070b14;border:1px solid #1e293b;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;">Precio Actual de Disparo</div>
                    <div style="font-size:24px;font-weight:900;color:#10b981;font-family:monospace;margin-top:4px;">
                      $${payload.currentPrice.toFixed(2)} USD
                    </div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background-color:#070b14;border:1px solid rgba(245,158,11,0.35);border-radius:10px;padding:14px 16px;">
                    <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;">Precio Objetivo Alerta</div>
                    <div style="font-size:24px;font-weight:900;color:#fbbf24;font-family:monospace;margin-top:4px;">
                      $${payload.targetPrice.toFixed(2)} USD
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Detalles Operativos -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#070b14;border:1px solid #1e293b;border-radius:10px;margin-bottom:20px;">
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#94a3b8;">Condición Activada</td>
                  <td align="right" style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;font-weight:700;color:${badgeColor};">${conditionText}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#94a3b8;">Diferencia vs Umbral</td>
                  <td align="right" style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;font-weight:700;color:#ffffff;font-family:monospace;">${diffUsd >= 0 ? '+' : ''}$${diffUsd.toFixed(2)} USD (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%)</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-size:13px;color:#94a3b8;">Fecha de Disparo</td>
                  <td align="right" style="padding:12px 16px;font-size:12px;color:#cbd5e1;">${escapeHtml(timestampStr)}</td>
                </tr>
              </table>

              ${
                safeNote
                  ? `<div style="background:rgba(6,182,212,0.08);border-left:4px solid #06b6d4;border-radius:6px;padding:12px 14px;margin-bottom:22px;">
                      <div style="font-size:11px;font-weight:800;color:#38bdf8;text-transform:uppercase;margin-bottom:4px;">Tu Nota / Estrategia Registrada</div>
                      <div style="font-size:13px;color:#e2e8f0;line-height:1.5;">${safeNote}</div>
                    </div>`
                  : ''
              }

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 26px;background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;border-radius:10px;">
                      Analizar ${safeTicker} en Inversor Colombia →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pie Institucional -->
          <tr>
            <td style="padding:16px 28px;background-color:#070b14;border-top:1px solid #1e293b;font-size:11px;color:#64748b;text-align:center;line-height:1.6;">
              Alerta enviada automáticamente al correo registrado: <strong style="color:#94a3b8;">${safeRecipient}</strong><br />
              © ${new Date().getFullYear()} Inversor Colombia · Plataforma Cuantitativa & Comité de Análisis Institucional
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envía el correo de alerta de precio al usuario autenticado usando backend local o Supabase Edge Function.
 */
export async function sendPriceAlertEmail(
  payload: PriceAlertEmailPayload
): Promise<PriceAlertEmailResult> {
  const subject = `🚨 Alerta de Precio ${payload.ticker}: $${payload.currentPrice.toFixed(2)} USD — Inversor Colombia`;
  const htmlBody = buildPriceAlertEmailHtml({
    ...payload,
    appUrl: typeof window !== 'undefined' ? window.location.origin : payload.appUrl,
  });

  let token: string | undefined;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData?.session?.access_token;
  } catch {
    // noop
  }

  // 1. Intentar middleware local (/api/alerts/send-email) en entorno de desarrollo
  try {
    const res = await fetch('/api/alerts/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...payload,
        subject,
        htmlBody,
      }),
    }).catch(() => null);

    if (res && res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const json = await res.json();
      if (json.delivered) {
        return {
          delivered: true,
          provider: json.provider || 'local-server',
          recipient: json.recipient || payload.toEmail,
          subject,
          htmlBody,
        };
      }
    }
  } catch {
    // Fallback a Supabase Edge Function
  }

  // 2. Invocar Supabase Edge Function oficial (send-price-alert)
  try {
    const { data, error } = await supabase.functions.invoke('send-price-alert', {
      body: {
        ...payload,
        subject,
        htmlBody,
      },
    });

    if (!error && data) {
      return {
        delivered: Boolean(data.delivered),
        provider: data.provider || 'supabase-edge',
        recipient: data.recipient || payload.toEmail,
        subject,
        htmlBody,
        message: data.message,
      };
    }
  } catch (err) {
    console.warn('No se pudo invocar send-price-alert:', err);
  }

  return {
    delivered: false,
    provider: 'local_preview',
    recipient: payload.toEmail,
    subject,
    htmlBody,
    message: 'Vista previa institucional generada. Configura RESEND_API_KEY en Supabase/env para envío SMTP real.',
  };
}
