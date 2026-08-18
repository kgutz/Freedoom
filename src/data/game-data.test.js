import { describe, expect, it } from 'vitest';
import { CLASSES, classDataForJourney } from './game-data.js';

describe('packs de habilidades por camino',()=>{
  it('usa el repertorio unificado',()=>{
    const paladin=classDataForJourney('paladin');
    expect(paladin).toBe(CLASSES.paladin);
    expect(paladin.pas[0].name).toBe('Flecha Bendita');
  });

  it('mantiene las mismas seis habilidades en todos los caminos',()=>{
    Object.keys(CLASSES).forEach(classId=>{
      const selected=classDataForJourney(classId,{smokeFree:true});
      expect(selected.pas).toHaveLength(3);
      expect(selected.act).toHaveLength(3);
      expect(selected).toBe(CLASSES[classId]);
    });
    expect(classDataForJourney('paladin',{smokeFree:true}).pas[0].d)
      .toContain('5% de vida');
  });

  it('no incluye efectos de cigarros, límites, margen ni disparos perfectos',()=>{
    const forbidden=/cigarro|límite|margen|disparo perfecto/i;
    Object.values(CLASSES).forEach(pack=>{
      [...pack.pas,...pack.act].forEach(ability=>{
        expect(ability.d).not.toMatch(forbidden);
      });
    });
  });
});
