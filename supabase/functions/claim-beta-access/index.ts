import { createClient } from 'npm:@supabase/supabase-js@2';

function cors(origin: string) {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin',
  };
}

function sameSecret(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const headers = cors(origin);
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim());
  if (request.method !== 'POST' || !allowed.includes(origin)) return new Response('Not allowed', { status: 403, headers });

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const betaCode = Deno.env.get('BETA_ACCESS_CODE') || '';
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user) return new Response('Unauthorized', { status: 401, headers });

  const payload = await request.json().catch(() => ({}));
  const supplied = typeof payload.code === 'string' ? payload.code.normalize('NFKC').trim() : '';
  if (!sameSecret(supplied, betaCode)) return new Response('Forbidden', { status: 403, headers });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.from('beta_access').upsert({ user_id: user.id, grant_method: 'code' });
  if (error) return new Response('Unavailable', { status: 503, headers });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, 'content-type': 'application/json' } });
});
