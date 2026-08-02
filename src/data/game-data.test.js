import { describe, expect, it } from 'vitest';
import { CLASSES, SMOKE_FREE_SKILLS, classDataForJourney } from './game-data.js';

describe('packs de habilidades por camino',()=>{
  it('mantiene intacto el pack de reducción',()=>{
    const paladin=classDataForJourney('paladin');
    expect(paladin).toBe(CLASSES.paladin);
    expect(paladin.pas[0].d).toContain('disparos perfectos');
  });

  it('selecciona seis habilidades propias para el camino sin fumar',()=>{
    Object.keys(CLASSES).forEach(classId=>{
      const selected=classDataForJourney(classId,{smokeFree:true});
      expect(selected.pas).toHaveLength(3);
      expect(selected.act).toHaveLength(3);
      expect(selected.pas).toEqual(SMOKE_FREE_SKILLS[classId].pas);
    });
    expect(classDataForJourney('paladin',{smokeFree:true}).pas[0].d)
      .toContain('55 XP');
  });

  it('no incluye efectos de cigarros, límites, margen ni disparos perfectos',()=>{
    const forbidden=/cigarro|límite|margen|disparo perfecto/i;
    Object.values(SMOKE_FREE_SKILLS).forEach(pack=>{
      [...pack.pas,...pack.act].forEach(ability=>{
        expect(ability.d).not.toMatch(forbidden);
      });
    });
  });
});
