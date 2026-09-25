import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX_BODY_BYTES = 4096;
const MAX_ATTEMPTS_PER_HOUR = 5;
const GENERIC_MESSAGE = 'Si los datos son válidos, recibirás un enlace de activación.';

function response(origin: string, status = 202) {
  return new Response(JSON.stringify({ ok: true, message: GENERIC_MESSAGE }), {
    status,
    headers: { ...corsHeaders(origin), 'content-type': 'application/json; charset=utf-8' },
  });
}

function corsHeaders(origin: string) {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'Origin',
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function sameSecret(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

Deno.serve(async request => {
  const currentOrigin = request.headers.get('origin') || '';
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(currentOrigin) });
  if (request.method !== 'POST' || !allowedOrigins.includes(currentOrigin)) {
    return new Response('Not allowed', { status: 403, headers: corsHeaders(currentOrigin) });
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return response(currentOrigin, 413);

  let payload: { email?: unknown; code?: unknown };
  try {
    payload = await request.json();
  } catch {
    return response(currentOrigin);
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const code = typeof payload.code === 'string' ? payload.code.normalize('NFKC').trim() : '';
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
  if (!emailValid || code.length > 128) return response(currentOrigin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const betaCode = Deno.env.get('BETA_ACCESS_CODE');
  const redirectTo = Deno.env.get('INVITE_REDIRECT_URL');
  if (!supabaseUrl || !serviceRoleKey || !betaCode || !redirectTo) {
    console.error('Missing required server configuration');
    return new Response(JSON.stringify({ ok: false, message: 'Servicio no disponible.' }), {
      status: 503,
      headers: { ...corsHeaders(currentOrigin), 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const emailHash = await sha256(email);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('beta_invite_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email_hash', emailHash)
    .gte('attempted_at', since);

  if ((count || 0) >= MAX_ATTEMPTS_PER_HOUR) return response(currentOrigin, 429);

  const accepted = sameSecret(code, betaCode);
  if (accepted) {
    const { count: acceptedCount } = await admin
      .from('beta_invite_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email_hash', emailHash)
      .eq('accepted', true)
      .gte('attempted_at', since);
    if ((acceptedCount || 0) >= 1) return response(currentOrigin);
  }
  await admin.from('beta_invite_attempts').insert({ email_hash: emailHash, accepted });
  if (!accepted) return response(currentOrigin);

  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) console.warn('Invitation was not sent', { status: error.status, code: error.code });
  return response(currentOrigin);
});
