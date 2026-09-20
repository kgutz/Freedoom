import { it, expect, vi, afterEach } from 'vitest';
import { templeGreeting, startTempleDialogue } from './temple-dialogue.js';

afterEach(()=>vi.useRealTimers());
it('greets each protection state without assuming a death',()=>{
  expect(templeGreeting()).toContain('Bienvenido');
  expect(templeGreeting({blessings:{experience:{active:true}}})).toContain('de experiencia');
  expect(templeGreeting({blessings:{energy:{active:true}}})).toContain('de energía');
  expect(templeGreeting({blessings:{experience:{active:true},energy:{active:true}}})).toContain('Las dos');
  expect(templeGreeting({blessings:{experience:{active:false}}})).toContain('Bienvenido');
});
function fixture(reduce=false){
  const text={}, reserve={}, hint={};
  const button={isConnected:true,closest:()=>null,setAttribute:vi.fn(),querySelector:s=>s==='[data-dialogue-text]'?text:s==='[data-dialogue-reserve]'?reserve:hint,onclick:null};
  const window={setTimeout,clearTimeout,matchMedia:()=>({matches:reduce,addEventListener:vi.fn(),removeEventListener:vi.fn()})};
  return {root:{querySelector:()=>button},button,text,reserve,hint,window};
}
it('types progressively and completes immediately on touch',()=>{
  vi.useFakeTimers(); const f=fixture();
  startTempleDialogue(f.root,{},f.window);
  expect(f.text.textContent).toBe('B');
  vi.advanceTimersByTime(84);
  expect(f.text.textContent).toBe('Bien');
  f.button.onclick();
  expect(f.text.textContent).toBe(templeGreeting());
  expect(vi.getTimerCount()).toBe(0);
});
it('shows full text with reduced motion and refreshes after purchasing',()=>{
  vi.useFakeTimers(); const f=fixture(true);
  startTempleDialogue(f.root,{},f.window);
  expect(f.text.textContent).toBe(templeGreeting());
  startTempleDialogue(f.root,{blessings:{energy:{active:true}}},f.window);
  expect(f.text.textContent).toContain('de energía');
  expect(vi.getTimerCount()).toBe(0);
});
it('finishes safely when the scene is removed',()=>{
  vi.useFakeTimers(); const f=fixture();
  startTempleDialogue(f.root,{},f.window);
  f.button.isConnected=false;
  vi.runAllTimers();
  expect(vi.getTimerCount()).toBe(0);
});
