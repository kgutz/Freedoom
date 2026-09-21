import { describe, it, expect, vi } from 'vitest';
import { sceneMediaMarkup, installSceneMedia } from './scene-media.js';
import { templeMarkup, templeShopMarkup, renderBlessingDetail, blessingArt } from './temple-view.js';

function fixture() {
  const handlers = {};
  const button = {setAttribute:vi.fn()};
  const video = {isConnected:true, dataset:{}, paused:true, pause:vi.fn(), play:vi.fn(() => Promise.resolve()), addEventListener:vi.fn(), closest:() => null, getClientRects:() => [1], parentElement:{querySelector:() => button}};
  const root = {classList:{contains:() => true}, querySelectorAll:() => [video], addEventListener:(key,fn) => {handlers[key]=fn;}};
  const reduced = {matches:false,addEventListener:(key,fn) => {handlers.motion=fn;}};
  const document = {hidden:false,getElementById:() => root,addEventListener:(key,fn) => {handlers[key]=fn;}};
  const window = {matchMedia:() => reduced,MutationObserver:class {observe(){}},requestAnimationFrame:vi.fn(),addEventListener:vi.fn()};
  return {document,window,video,root,reduced,handlers};
}

describe('animated inventory scenes', () => {
  it('reuses a warmed scene and retries playback on a user gesture', () => {
    const f=fixture();
    f.video.querySelector=()=>({getAttribute:()=> 'scenes/shops-v2.mp4'});
    const preloader={forPlayback:vi.fn(()=> 'blob:cached-market')};
    installSceneMedia(f.document,f.window,preloader);
    expect(f.video.src).toBe('blob:cached-market');
    expect(preloader.forPlayback).toHaveBeenCalledOnce();
    f.handlers.pointerup();
    expect(f.video.play).toHaveBeenCalledTimes(2);
    expect(preloader.forPlayback).toHaveBeenCalledOnce();
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
  it('keeps a still fallback and silent inline looping media', () => {
    const html = sceneMediaMarkup('temple', 'Templo');
    expect(html).toContain('src="scenes/temple-v2.webp"');
    expect(html).toContain('muted loop playsinline preload="none"');
    expect(html).toContain('scenes/temple-v2.mp4');
    expect(html).not.toContain('data-scene-toggle');
    expect(sceneMediaMarkup('shops', 'Callejón')).not.toContain('<button');
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
  it('plays visible scenes but pauses when the tab is hidden', () => {
    const f = fixture();
    installSceneMedia(f.document,f.window);
    expect(f.video.play).toHaveBeenCalledOnce();
    expect(f.video.muted).toBe(true);
    f.document.hidden=true;
    f.handlers.visibilitychange();
    expect(f.video.pause).toHaveBeenCalled();
  });
  it('does not start motion when reduced motion is requested', () => {
    const f=fixture(); f.reduced.matches=true;
    installSceneMedia(f.document,f.window);
    expect(f.video.play).not.toHaveBeenCalled();
    expect(f.video.dataset.ready).toBe('false');
  });
  it('does not play closed sheets or hidden panels', () => {
    const f=fixture(); f.root.classList.contains=() => false;
    installSceneMedia(f.document,f.window);
    expect(f.video.play).not.toHaveBeenCalled();
    f.root.classList.contains=() => true;
    f.video.closest=() => ({});
    f.handlers.visibilitychange();
    expect(f.video.play).not.toHaveBeenCalled();
  });
});
