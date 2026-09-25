export function readCloudConfig(browserWindow = globalThis.window) {
  const value = browserWindow?.FREEDOM_CLOUD_CONFIG;
  if (!value || value.enabled !== true) return { enabled: false };
  const url = String(value.url || '').trim().replace(/\/$/, '');
  const publishableKey = String(value.publishableKey || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    throw new Error('La dirección de Supabase no es válida');
  }
  if (!publishableKey.startsWith('sb_publishable_') && !publishableKey.startsWith('eyJ')) {
    throw new Error('La clave pública de Supabase no es válida');
  }
  return Object.freeze({ enabled: true, url, publishableKey });
}

