import {it,expect,vi} from 'vitest';
import {frameVideoForPoster,installFrameMedia} from './frame-media.js';

it('resolves no video for any known background poster (no frame currently defines one)',()=>{
  expect(frameVideoForPoster('hero_background/azariel_temple.webp')).toBe(null);
  expect(frameVideoForPoster('hero_background/azariel_temple_wide.webp')).toBe(null);
  expect(frameVideoForPoster('hero_background/beta_tester_bg_final.webp')).toBe(null);
  expect(frameVideoForPoster(null)).toBe(null);
  expect(frameVideoForPoster()).toBe(null);
});

function fixture(){
  const image={className:'sprite-bg',isConnected:true,matches:selector=>selector==='#characterSheetBody img.sprite-bg'&&image.className==='sprite-bg',getAttribute:()=>'hero_background/azariel_temple.webp',after:vi.fn(),closest:()=>null,getClientRects:()=>[1]};
  const document={body:{},hidden:false,querySelectorAll:vi.fn(selector=>image.isConnected&&image.matches(selector)?[image]:[]),createElement:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()};
  const motion={matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()};
  const window={matchMedia:()=>motion,requestAnimationFrame:vi.fn(()=>1),cancelAnimationFrame:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),
    IntersectionObserver:class{observe(){}unobserve(){}disconnect(){}},
    MutationObserver:class{observe(){}disconnect(){}}};
  return {document,window,image};
}

it('never creates a video for the character sheet background, since no frame defines one',()=>{
  const f=fixture();
  const dispose=installFrameMedia(f.document,f.window);
  expect(f.document.createElement).not.toHaveBeenCalled();
  dispose();
});
