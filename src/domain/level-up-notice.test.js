import { describe, expect, it } from 'vitest';
import { levelUpNotice } from './level-up-notice.js';

describe('aviso de subida de nivel', () => {
  it('no hay aviso si el nivel no sube', () => {
    expect(levelUpNotice({ classId: 'sorcerer', previousLevel: 5, level: 5 })).toBeNull();
    expect(levelUpNotice({ classId: 'sorcerer', previousLevel: 6, level: 4 })).toBeNull();
  });

  it('concede 3 puntos por nivel y lista la habilidad desbloqueada', () => {
    const notice = levelUpNotice({ classId: 'sorcerer', previousLevel: 7, level: 8 });
    expect(notice).toMatchObject({ level: 8, levelsGained: 1, pointsGained: 3 });
    expect(notice.skills).toEqual(['Maldición de Ceniza']);
  });

  it('suma los puntos de varios niveles y avisa de las cacerías desbloqueadas', () => {
    const notice = levelUpNotice({ classId: 'druid', previousLevel: 4, level: 11 });
    expect(notice.pointsGained).toBe(21);
    expect(notice.skills).toEqual(['Regeneración']);
    expect(notice.hunts.join(' ')).toContain('Medio');
    expect(notice.hunts.join(' ')).toContain('Difícil');
  });

  it('sin desbloqueos devuelve listas vacías', () => {
    const notice = levelUpNotice({ classId: 'knight', previousLevel: 20, level: 21 });
    expect(notice.skills).toEqual([]);
    expect(notice.hunts).toEqual([]);
  });
});
