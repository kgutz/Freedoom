import { describe, expect, it, vi } from 'vitest';
import { createCloudService } from './cloud-service.js';

function queryResult(value) {
  return {
    select: () => ({ maybeSingle: async () => ({ data: value, error: null }) }),
  };
}

describe('cloud service', () => {
  it('envía invitaciones con la clave pública, nunca con una clave administrativa', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 202 }));
    const client = { auth: {}, from: vi.fn() };
    const service = createCloudService({
      client,
      config: { enabled: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' },
      fetchImpl,
    });
    await service.requestBetaInvite('test@example.com', 'codigo');
    const [, request] = fetchImpl.mock.calls[0];
    expect(request.headers.apikey).toBe('sb_publishable_example');
    expect(JSON.stringify(request)).not.toContain('service_role');
  });

  it('carga únicamente la fila permitida por RLS', async () => {
    const row = { revision: 3, checksum: '12345678' };
    const client = { auth: {}, from: vi.fn(() => queryResult(row)) };
    const service = createCloudService({
      client,
      config: { enabled: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' },
    });
    await expect(service.loadGameSave()).resolves.toEqual(row);
    expect(client.from).toHaveBeenCalledWith('game_saves');
  });

  it('solo pide la revisión al comprobar una fila antes de guardar, sin descargar el estado', async () => {
    const row = { revision: 7 };
    let selectedColumns = null;
    const client = {
      auth: {},
      from: vi.fn(() => ({
        select: (columns) => {
          selectedColumns = columns;
          return { maybeSingle: async () => ({ data: row, error: null }) };
        },
      })),
    };
    const service = createCloudService({
      client,
      config: { enabled: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' },
    });
    await expect(service.loadGameSaveRevision()).resolves.toEqual(row);
    expect(client.from).toHaveBeenCalledWith('game_saves');
    expect(selectedColumns).toBe('revision');
  });

  it('devuelve la fila completa de save_game_state para poder verificar sin releer game_saves', async () => {
    // save_game_state (migración 202609260001) devuelve state/state_schema_version/
    // migration_id además de revision/checksum/updated_at/replayed, precisamente para
    // que el cliente pueda verificar el guardado sin una segunda lectura completa.
    const rpcRow = {
      revision: 5,
      checksum: 'abcdef01',
      updated_at: '2026-09-26T00:00:00.000Z',
      replayed: false,
      state: { game: { name: 'Ayla' } },
      state_schema_version: 1,
      migration_id: '11111111-1111-4111-8111-111111111111',
    };
    const rpc = vi.fn(async () => ({ data: [rpcRow], error: null }));
    const service = createCloudService({
      client: { auth: {}, rpc },
      config: { enabled: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' },
    });
    await expect(service.saveGameState({ state: {}, schemaVersion: 1, checksum: 'abcdef01' }, 4))
      .resolves.toEqual(rpcRow);
  });

  it('crea un ticket vinculado mediante la función protegida', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ ticket_code: 'FREEDOM-000001', status: 'open', save_revision: 4 }],
      error: null,
    }));
    const service = createCloudService({
      client: { auth: {}, rpc },
      config: { enabled: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' },
    });
    await expect(service.createSupportTicket({
      category: 'lost_progress',
      description: 'Perdí el progreso de hoy.',
      consent: true,
    })).resolves.toMatchObject({ ticket_code: 'FREEDOM-000001' });
    expect(rpc).toHaveBeenCalledWith('create_support_ticket', {
      p_category: 'lost_progress',
      p_description: 'Perdí el progreso de hoy.',
      p_consent: true,
    });
  });

  it('reserva y confirma una recompensa de reporte mediante RPC autenticada', async () => {
    const rpc = vi.fn(async (name) => ({
      data: name === 'mark_feedback_reward_delivered'
        ? true
        : [{ event_id: 'feedback-report-0001', reward: { coins: 100 } }],
      error: null,
    }));
    const service = createCloudService({
      client: { auth: {}, rpc },
      config: { enabled: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' },
    });
    await expect(service.pendingFeedbackReward()).resolves.toMatchObject({ event_id: 'feedback-report-0001' });
    await expect(service.claimFeedbackReward('feedback-report-0001')).resolves.toMatchObject({ reward: { coins: 100 } });
    await expect(service.markFeedbackRewardDelivered('feedback-report-0001')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('claim_feedback_reward', { p_event_id: 'feedback-report-0001' });
    expect(rpc).toHaveBeenCalledWith('mark_feedback_reward_delivered', { p_event_id: 'feedback-report-0001' });
  });

  it('no repite una recuperación para el mismo correo durante el bloqueo local', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 202,
      json: async () => ({ ok: true }),
    }));
    const service = createCloudService({
      client: { auth: {} },
      config: { enabled: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' },
      now: () => 1_000_000,
      fetchImpl,
    });
    await expect(service.requestPasswordRecovery('TEST@example.com', 'https://example.com/recovery'))
      .resolves.toEqual({ deduplicated: false });
    await expect(service.requestPasswordRecovery('test@example.com', 'https://example.com/recovery'))
      .resolves.toEqual({ deduplicated: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
