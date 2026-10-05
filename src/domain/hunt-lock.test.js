import { describe, expect, it } from 'vitest';
import { huntLockState } from './pve-combat-rules.js';

describe('bloqueo de habilidades y pociones durante la Cacería', () => {
  const now = 1_000_000;
  it('no bloquea sin expedición activa', () => {
    expect(huntLockState(null, now)).toEqual({ locked: false, remainingMs: 0, message: '' });
    expect(huntLockState({ active: null }, now).locked).toBe(false);
    expect(huntLockState({}, now).locked).toBe(false);
  });
  it('bloquea mientras la expedición está en curso y avisa del tiempo restante', () => {
    const lock = huntLockState({ active: { endsAt: now + 4 * 60_000 + 10 } }, now);
    expect(lock.locked).toBe(true);
    expect(lock.remainingMs).toBe(4 * 60_000 + 10);
    expect(lock.message).toBe('Tu héroe está en Cacería · vuelve en 5 min');
    expect(huntLockState({ active: { endsAt: now + 1000 } }, now).message).toContain('vuelve en 1 min');
  });
  it('sigue bloqueado hasta recoger el informe cuando ya terminó', () => {
    const lock = huntLockState({ active: { endsAt: now - 5000 } }, now);
    expect(lock.locked).toBe(true);
    expect(lock.remainingMs).toBe(0);
    expect(lock.message).toContain('recoge el informe');
  });
});
