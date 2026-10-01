import { describe, it, expect } from 'vitest';
import { sceneMediaMarkup } from './scene-media.js';
import { templeMarkup, templeShopMarkup, renderBlessingDetail, blessingArt } from './temple-view.js';

describe('inventory scenes', () => {
  it('replaces only the poster in Halloween, preserving the same clickable zones',()=>{
    for(const name of ['shops','temple']) expect(sceneMediaMarkup(name,'Escena',true)).toContain(`scenes/${name}-halloween.webp`);
    const normal=templeMarkup({}, {},1,false);
    const seasonal=templeMarkup({}, {},1,true);
    expect(seasonal.replace('temple-halloween.webp','temple-v2.webp')).toBe(normal);
  });
  it('disables only active blessing cards and unlocks them after consumption',()=>{
    for(const id of ['experience','energy']){
      const active=templeShopMarkup({blessings:{[id]:{active:true}}},{coins:1000},19);
      expect(active).toContain(`data-open-blessing="${id}" disabled`);
      expect(active.match(/ disabled/g)).toHaveLength(1);
      const consumed=templeShopMarkup({blessings:{[id]:{active:false}}},{coins:1000},19);
      expect(consumed).not.toContain(' disabled');
    }
  });
  it('decorates both static blessing icons with non-interactive accessible-hidden sparkles',()=>{
    for(const id of ['experience','energy']){
      const html=blessingArt(id);
      expect(html).toContain(`src="blessings/${id}.png"`);
      expect(html.match(/aria-hidden="true"/g)).toHaveLength(5);
      expect(html).not.toContain('<video');
    }
  });
  it('shows only the unified pixel-art still, with no video on top', () => {
    for (const name of ['temple', 'shops']) {
      const html = sceneMediaMarkup(name, 'Escena');
      expect(html).toContain(`src="scenes/${name}-v2.webp"`);
      expect(html).not.toContain('<video');
      expect(html).not.toContain('.mp4');
      expect(html).not.toContain('<button');
    }
  });
  it('shows Azariel and both blessing cards with details before purchase', () => {
    const html = templeMarkup();
    expect(html).toContain('Ángel guardián');
    expect(html.match(/data-close-temple/g)).toHaveLength(1);
    expect(html).toContain('class="outfit-weave-resources"');
    expect(html).toContain('class="shop-destination-nav"');
    expect(html).toContain('data-open-blessing="experience"');
    expect(html).toContain('data-open-blessing="energy"');
    expect(html).toContain('id="templeBlessings" hidden');
    expect(html).not.toContain('data-buy');
  });
  it('renders prices and blocks duplicate or unaffordable purchases in the item modal',()=>{
    const elements={relicDetailTitle:{},relicDetailBody:{}};
    const document={getElementById:id=>elements[id]};
    renderBlessingDetail(document,{}, {coins:1000},19,'energy');
    expect(elements.relicDetailBody.innerHTML).toContain('COMPRAR · 195 ORO');
    renderBlessingDetail(document,{blessings:{energy:{active:true}}}, {coins:1000},19,'energy');
    expect(elements.relicDetailBody.innerHTML).toContain('YA ESTÁ ACTIVA');
    expect(elements.relicDetailBody.innerHTML).toContain('disabled');
    renderBlessingDetail(document,{}, {coins:0},19,'energy');
    expect(elements.relicDetailBody.innerHTML).toContain('FALTA ORO');
  });
});
