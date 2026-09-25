const COOLDOWN_MS = 60 * 60 * 1000;
const GENERIC_MESSAGE = 'Si existe una cuenta, recibirás un enlace seguro.';

function corsHeaders(origin: string) {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'Origin',
  };
}

function json(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'content-type': 'application/json; charset=utf-8' },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST' || !allowedOrigins.includes(origin)) return json(origin, 403, { ok: false });

  let payload: { email?: unknown };
  try { payload = await request.json(); } catch { return json(origin, 202, { ok: true, message: GENERIC_MESSAGE }); }
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json(origin, 202, { ok: true, message: GENERIC_MESSAGE });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json(origin, 503, { ok: false });

  const emailHash = await sha256(email);
  const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const query = new URL(`${supabaseUrl}/rest/v1/password_recovery_attempts`);
  query.searchParams.set('email_hash', `eq.${emailHash}`);
  query.searchParams.set('attempted_at', `gte.${since}`);
  query.searchParams.set('select', 'attempted_at');
  query.searchParams.set('order', 'attempted_at.desc');
  query.searchParams.set('limit', '1');
  const previousResponse = await fetch(query, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
  });
  const previous = previousResponse.ok ? await previousResponse.json() : [];
  if (previous.length) {
    const remaining = Math.max(60, Math.ceil((new Date(previous[0].attempted_at).getTime() + COOLDOWN_MS - Date.now()) / 1000));
    return json(origin, 429, { ok: false, rateLimited: true, retryAfterSeconds: remaining });
  }

  await fetch(`${supabaseUrl}/rest/v1/password_recovery_attempts`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ email_hash: emailHash }),
  });
  const redirectTo = `${origin}/?authCallback=recovery`;
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!authResponse.ok) console.warn('Recovery email was not sent', { status: authResponse.status });
  return json(origin, 202, { ok: true, message: GENERIC_MESSAGE });
});
