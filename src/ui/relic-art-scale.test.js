import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_RELIC_DEFINITIONS } from '../data/loot-data.js';
import { relicArt } from './inventory-view.js';

const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
describe('Catálogo: ajustes ópticos localizados',()=>{
  it('desplaza solo el Yelmo del Cielo Carbonizado 2px a la izquierda sin cambiar su escala',()=>{
    expect(css).toContain('.relic-art--fusion_28>img{transform:translateX(-2px)}');
    expect(css).toContain('.relic-art--fusion_26>img,.relic-art--fusion_28>img{width:92%;height:92%;');
  });
  it.each(ALL_RELIC_DEFINITIONS)('$id conserva proporciones, arte real y clase propia compartida',definition=>{
    const html=relicArt(definition);
    expect(html).toContain(`relic-art--${definition.id}`);
    expect(html).toContain(`src="${definition.image}"`);
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(existsSync(new URL(`../../public/${definition.image}`,import.meta.url))).toBe(true);
  });
  it.each([['fusion_18',78],['fusion_19',86],['fusion_28',92],['fusion_30',86],['fusion_31',80],['fusion_10',105],['fusion_12',96],['fusion_26',92],['fusion_27',96],['fusion_29',90],['fusion_14',96],['fusion_23',82],['fusion_24',84],['fusion_25',80],['fusion_20',88],['fusion_22',88]])('%s: escala %i solo sobre dibujo', (id,scale)=>{
    const rule=css.match(new RegExp(`[^{}]*\\.relic-art--${id}>img[^{}]*\\{([^}]+)\\}`));
    expect(rule).not.toBeNull();
    expect(rule[1]).toContain(`width:${scale}%;height:${scale}%`);
    expect(rule[1]).toContain('object-fit:contain');
    expect(rule[1]).not.toMatch(/background|border|box-shadow/);
  });
  it('conserva las otras escalas aprobadas y excepciones base',()=>{
    expect(css).toContain('.relic-art--relic_03>img{width:100%;height:100%}');
    expect(css).toContain('width:calc(104% + 3px);height:calc(104% + 3px)');
    expect(css).toContain('.relic-art--fusion_17>img{width:94%;height:94%;');
    expect(css).toContain('.relic-art--fusion_21>img');
    expect(css).toContain('width:82%;height:82%;object-fit:contain');
    expect(css).toContain('.relic-art--relic_04 img{width:104%;height:104%;');
    expect(css).toContain('.relic-art--fusion_02 img{width:104%;height:104%;');
    expect(css).toContain('.relic-art--relic_06 img{width:100%;height:100%;');
  });
});
