import {it,expect,vi} from 'vitest';
import {frameVideoForPoster,installFrameMedia} from './frame-media.js';

it('maps the two temple formats and leaves other backgrounds static',()=>{
  expect(frameVideoForPoster('hero_background/azariel_temple.webp')).toBe('hero_background/azariel_temple.mp4');
  expect(frameVideoForPoster('hero_background/azariel_temple_wide.webp')).toBe('hero_background/azariel_temple_wide.mp4');
  expect(frameVideoForPoster('hero_background/beta_tester_bg_final.webp')).toBe(null);
  expect(frameVideoForPoster(null)).toBe(null);
  expect(frameVideoForPoster()).toBe(null);
});

function fixture(){
  let source='hero_background/azariel_temple.webp';
  const image={className:'sprite-bg',inSheet:true,isConnected:true,matches:selector=>selector==='#characterSheetBody img.sprite-bg'&&image.inSheet&&image.className==='sprite-bg',getAttribute:()=>source,after:vi.fn(),closest:()=>null,getClientRects:()=>[1]};
  const video={dataset:{},paused:true,pause:vi.fn(),play:vi.fn(()=>Promise.resolve()),getAttribute:()=>video.src,setAttribute:vi.fn(),addEventListener:vi.fn(),removeAttribute:vi.fn(),load:vi.fn(),remove:vi.fn()};
  const events={};
  const motion={matches:false,addEventListener:(key,fn)=>events.motion=fn,removeEventListener:vi.fn()};
  const document={body:{},hidden:false,querySelectorAll:vi.fn(selector=>image.isConnected&&image.matches(selector)?[image]:[]),createElement:vi.fn(()=>video),addEventListener:(key,fn)=>events[key]=fn,removeEventListener:vi.fn()};
  const frames=[];
  const window={matchMedia:()=>motion,requestAnimationFrame:fn=>{frames.push(fn);return 1;},cancelAnimationFrame:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),
    IntersectionObserver:class{constructor(fn){events.intersection=fn}observe(){}unobserve(){}disconnect(){}},
    MutationObserver:class{constructor(fn){events.mutation=fn}observe(){}disconnect(){}}};
  const flush=()=>{while(frames.length)frames.shift()()};
  return {document,window,image,video,motion,events,flush,setSource:value=>source=value};
}
it('loads and plays only visible backgrounds, pauses hidden tabs and cleans up replaced frames',()=>{
  const f=fixture(); const dispose=installFrameMedia(f.document,f.window);
  expect(f.video.src).toBeUndefined();
  f.events.intersection([{target:f.image,isIntersecting:true}]);
  expect(f.video.src).toBe('hero_background/azariel_temple.mp4');
  expect(f.video.play).toHaveBeenCalledOnce();
  expect(f.video.muted).toBe(true);
  f.document.hidden=true;f.events.visibilitychange();f.flush();
  expect(f.video.pause).toHaveBeenCalled();
  f.setSource('hero_background/paladin_bg.webp');f.events.mutation();f.flush();
  expect(f.video.remove).toHaveBeenCalled();
  dispose();
});
it('respects reduced motion without downloading a video',()=>{
  const f=fixture();f.motion.matches=true;
  const dispose=installFrameMedia(f.document,f.window);
  f.events.intersection([{target:f.image,isIntersecting:true}]);
  expect(f.video.src).toBeUndefined();expect(f.video.play).not.toHaveBeenCalled();
  expect(f.video.dataset.ready).toBe('false');
  dispose();
});
it.each(['sprite-bg','hoy-hero-bg','habit-hero-bg','frame-preview-bg','outfit-selector-bg','temple-gift-preview'])('does not create or load videos outside the character sheet: %s',className=>{
  const f=fixture();
  f.image.className=className;
  f.image.inSheet=false;
  const dispose=installFrameMedia(f.document,f.window);
  expect(f.document.createElement).not.toHaveBeenCalled();
  expect(f.video.src).toBeUndefined();
  expect(f.video.play).not.toHaveBeenCalled();
  dispose();
});
it('releases the video when its image leaves the character sheet',()=>{
  const f=fixture();
  const dispose=installFrameMedia(f.document,f.window);
  f.events.intersection([{target:f.image,isIntersecting:true}]);
  f.image.inSheet=false;f.events.mutation();f.flush();
  expect(f.video.removeAttribute).toHaveBeenCalledWith('src');
  expect(f.video.load).toHaveBeenCalled();
  expect(f.video.remove).toHaveBeenCalled();
  dispose();
});
