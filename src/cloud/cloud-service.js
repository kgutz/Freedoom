import { createClient } from '@supabase/supabase-js';

const GENERIC_INVITE_MESSAGE = 'Si los datos son válidos, recibirás un enlace de activación.';

export function createFreedomClient(config, options = {}) {
  if (!config?.enabled) return null;
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'freedom-auth',
    },
    ...options,
  });
}

export function createCloudService({ client, config, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  if (!client || !config?.enabled) throw new Error('Supabase no está configurado');
  const recoveryRequests = new Map();
  const recoveryCooldownMs = 2 * 60 * 1000;

  return {
    async restoreSessionFromUrl(url = globalThis.location?.href || '') {
      const hash = String(url).split('#')[1] || '';
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return null;
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return data.session;
    },

    async requestBetaInvite(email, code) {
      const response = await fetchImpl(`${config.url}/functions/v1/request-beta-invite`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: config.publishableKey,
          authorization: `Bearer ${config.publishableKey}`,
        },
        body: JSON.stringify({ email, code }),
      });
      if (!response.ok && response.status !== 429) {
        throw new Error('No se pudo contactar con el servicio de invitaciones');
      }
      return { accepted: response.ok, message: GENERIC_INVITE_MESSAGE };
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session;
    },

    async signInWithGoogle(redirectTo, betaCode = '') {
      if (betaCode) sessionStorage.setItem('freedom-beta-code', betaCode);
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
      return data;
    },

    async hasBetaAccess() {
      const { data, error } = await client.from('beta_access').select('user_id').maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },

    async claimBetaAccess(code) {
      let accessToken = null;
      for (let attempt = 0; attempt < 30 && !accessToken; attempt += 1) {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        accessToken = sessionData.session?.access_token || null;
        if (!accessToken) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!accessToken) throw new Error('Inicia sesión con Google para validar el acceso.');
      const response = await fetchImpl(`${config.url}/rest/v1/rpc/claim_beta_access`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: config.publishableKey,
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ access_code: code }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload?.message || `error ${response.status}`;
        console.warn('Supabase rechazó claim_beta_access', { status: response.status, detail });
        throw new Error(`No se pudo validar el acceso a la beta (${detail}).`);
      }
      if (payload !== true) throw new Error('El código de la beta no es válido.');
      return true;
    },

    async setPassword(password) {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      return data.user;
    },

    async requestPasswordRecovery(email) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const requestedAt = recoveryRequests.get(normalizedEmail) || 0;
      if (now() - requestedAt < recoveryCooldownMs) return { deduplicated: true };
      recoveryRequests.set(normalizedEmail, now());
      const response = await fetchImpl(`${config.url}/functions/v1/request-password-recovery`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: config.publishableKey, authorization: `Bearer ${config.publishableKey}` },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 429) return { deduplicated: true, retryAfterSeconds: payload.retryAfterSeconds || 3600 };
      if (!response.ok) throw new Error('No se pudo solicitar la recuperación');
      return { deduplicated: false };
    },

    async session() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },

    async loadGameSave() {
      const { data, error } = await client
        .from('game_saves')
        .select('state,state_schema_version,revision,checksum,migration_id,updated_at')
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    // Igual que loadGameSave, pero sin descargar el JSONB completo del estado.
    // Úsalo cuando solo necesites saber si ya existe una fila y cuál es su
    // revisión (comprobación previa a un guardado), no el estado en sí.
    async loadGameSaveRevision() {
      const { data, error } = await client
        .from('game_saves')
        .select('revision')
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async saveGameState(plan, expectedRevision) {
      const { data, error } = await client.rpc('save_game_state', {
        p_state: plan.state,
        p_state_schema_version: plan.schemaVersion,
        p_expected_revision: expectedRevision,
        p_checksum: plan.checksum,
        p_migration_id: plan.migrationId || null,
        p_source_device_id: plan.deviceId || null,
      });
      if (error) throw error;
      return data?.[0] || null;
    },

    async createSupportTicket({ category, description, consent }) {
      const { data, error } = await client.rpc('create_support_ticket', {
        p_category: category,
        p_description: description,
        p_consent: consent,
      });
      if (error) throw error;
      return data?.[0] || null;
    },

    async listSupportTickets() {
      const { data, error } = await client
        .from('support_tickets')
        .select('id,category,status,save_revision,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },

    async pendingFeedbackReward() {
      const { data, error } = await client.rpc('pending_feedback_reward');
      if (error) throw error;
      return data?.[0] || null;
    },

    async claimFeedbackReward(eventId) {
      const { data, error } = await client.rpc('claim_feedback_reward', {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data?.[0] || null;
    },

    async markFeedbackRewardDelivered(eventId) {
      const { data, error } = await client.rpc('mark_feedback_reward_delivered', {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data === true;
    },
  };
}
