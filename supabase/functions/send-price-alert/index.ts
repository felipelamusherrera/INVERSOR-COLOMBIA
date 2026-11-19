// ============================================================================
// Supabase Edge Function: send-price-alert
// Envío automático de correos institucionales de Alertas de Precio al usuario
// Aplicativo: Inversor Colombia — Pro Quant
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AlertEmailRequest {
  ticker: string;
  company: string;
  currentPrice: number;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  note?: string;
  subject: string;
  htmlBody: string;
  toEmail?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Se requiere sesión activa para enviar alertas.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://jptusquuyenbwrgasigt.supabase.co';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: authData, error: authErr } = await supabaseAuthClient.auth.getUser(token);
    if (authErr || !authData?.user?.email) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Usuario no autenticado o sin correo registrado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Seguridad: Solo permitir envío al correo verificado del usuario autenticado
    const recipientEmail = authData.user.email;
    const body: AlertEmailRequest = await req.json();

    const subject = (body.subject || `🚨 Alerta de Precio ${body.ticker} — Inversor Colombia`).slice(0, 200);
    const htmlBody = (body.htmlBody || '').slice(0, 40000);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') || 'Inversor Colombia <onboarding@resend.dev>';
    const webhookUrl = Deno.env.get('ALERT_EMAIL_WEBHOOK_URL');

    if (resendApiKey) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [recipientEmail],
          subject,
          html: htmlBody,
        }),
      });

      if (resendRes.ok) {
        const resendData = await resendRes.json();
        return new Response(
          JSON.stringify({
            delivered: true,
            provider: 'resend',
            id: resendData.id,
            recipient: recipientEmail,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (webhookUrl) {
      const whRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject,
          html: htmlBody,
          ticker: body.ticker,
          company: body.company,
          currentPrice: body.currentPrice,
          targetPrice: body.targetPrice,
          condition: body.condition,
          note: body.note,
        }),
      });

      if (whRes.ok) {
        return new Response(
          JSON.stringify({
            delivered: true,
            provider: 'webhook',
            recipient: recipientEmail,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        delivered: false,
        provider: 'email_provider_not_configured',
        recipient: recipientEmail,
        message: 'Configura RESEND_API_KEY o ALERT_EMAIL_WEBHOOK_URL en los secretos de Supabase para despacho SMTP externo.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno procesando alerta';
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
