// Sends the quote / agreement email with a proper Accept button.
// Secrets needed: RESEND_API_KEY, FROM_ADDRESS (e.g. "HireHector <christine@hirehector.co.uk>"), SITE_URL (optional)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function longDate(iso: string) { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return DAYS[dt.getUTCDay()] + ' ' + d + ' ' + MONTHS[m - 1] + ' ' + y; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { id, kind } = await req.json();
    // Use the signed-in user's own token, so the database rules (staff only) apply.
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: b, error } = await sb.from('bookings').select('*').eq('id', id).single();
    if (error || !b) return new Response(JSON.stringify({ error: 'Booking not found or not allowed' }), { status: 403, headers: CORS });
    if (!b.email) return new Response(JSON.stringify({ error: 'This booking has no client email' }), { status: 400, headers: CORS });
    if (!b.hire_date) return new Response(JSON.stringify({ error: 'Add the date of hire first' }), { status: 400, headers: CORS });
    const { data: rows } = await sb.from('settings').select('key,value');
    const st: Record<string, string> = {}; (rows ?? []).forEach((r: any) => { st[r.key] = r.value; });

    const site = (Deno.env.get('SITE_URL') ?? 'https://marktalbot580.github.io/hirehector-app/').replace(/\/?$/, '/');
    const url = site + 'client.html?t=' + b.quote_token;
    const first = esc(String(b.client).split(' ')[0]);
    const biz = esc(st.business_name || 'HireHector'), owner = esc(st.owner || '');
    const isQuote = kind !== 'contract';
    const subject = isQuote ? 'Quote for your wedding on ' + longDate(b.hire_date) : 'Your HireHector hire agreement';
    const intro = isQuote ? 'Here is your quote for your wedding on <b>' + esc(longDate(b.hire_date)) + '</b>. You can read it and accept it using the button below.' : 'Your hire agreement is ready to read and sign using the button below.';
    const label = isQuote ? 'View and accept your quote' : 'Read and sign your agreement';
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f1e8;font-family:Arial,Helvetica,sans-serif;color:#2b2620">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px"><tr><td>
<p style="font-size:16px;margin:0 0 16px">Hello ${first},</p>
<p style="font-size:16px;line-height:1.5;margin:0 0 24px">${intro}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px"><tr><td style="background:#7A1F2E;border-radius:28px"><a href="${url}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:bold;font-size:16px;text-decoration:none">${esc(label)}</a></td></tr></table>
<p style="font-size:16px;margin:0">${owner}<br>${biz}</p>
</td></tr></table></body></html>`;
    const text = `Hello ${String(b.client).split(' ')[0]},\n\n${intro.replace(/<[^>]+>/g, '')}\n${url}\n\n${st.owner || ''}\n${st.business_name || 'HireHector'}`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + Deno.env.get('RESEND_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('FROM_ADDRESS'), to: [b.email], reply_to: st.email || undefined, subject, html, text }),
    });
    const out = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: out.message || 'Email service refused the message' }), { status: 502, headers: CORS });
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
