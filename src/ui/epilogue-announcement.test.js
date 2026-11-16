import { describe, it, expect, vi } from 'vitest';
import { createVisibleCountdown, epilogueNoticePending, EPILOGUE_NOTICE_ID, installEpilogueAnnouncement } from './epilogue-announcement.js';
const state=()=>({onboarded:true,game:{cls:'warrior',updateNotices:{old:{acknowledgedAt:1}}}});
describe('Epilogue announcement',()=>{
 it('is once per save/update and requires a created hero',()=>{
  expect(epilogueNoticePending(state())).toBe(true);
  const previouslyDismissed=state();previouslyDismissed.game.updateNotices['epilogue-bosses-22-25-v1']={acknowledgedAt:1};expect(epilogueNoticePending(previouslyDismissed)).toBe(true);
  expect(epilogueNoticePending({onboarded:false})).toBe(false);
  const saved=state();saved.game.updateNotices[EPILOGUE_NOTICE_ID]={acknowledgedAt:123};
  expect(epilogueNoticePending(JSON.parse(JSON.stringify(saved)))).toBe(false);
  expect(epilogueNoticePending(state())).toBe(true);
 });
 it('requires five visible seconds and excludes hidden time',()=>{
  const timer=createVisibleCountdown(1000);expect(timer.update(3000,false)).toBe(3000);
  expect(timer.update(60000,true)).toBe(3000);expect(timer.update(62999)).toBe(1);expect(timer.update(63000)).toBe(0);
 });
 it('does not count initial hidden time or backwards clock movement',()=>{
  const timer=createVisibleCountdown(1000,false);expect(timer.update(10000,true)).toBe(5000);expect(timer.update(9000)).toBe(5000);
 });
 it('queues behind existing modals, gates Esc/click, and acknowledges only on dismissal',()=>{
  vi.useFakeTimers();let time=0,blocked=true; const events={},button={disabled:true,addEventListener:vi.fn((name,cb)=>{button[name]=cb;})};
  const dialog={setAttribute:vi.fn(),querySelector:()=>button,addEventListener:vi.fn((name,cb)=>{dialog[name+'Handler']=cb;}),showModal:vi.fn(),close:vi.fn(),remove:vi.fn()};
  const doc={hidden:false,activeElement:{isConnected:true,focus:vi.fn()},querySelector:()=>null,createElement:()=>dialog,body:{append:vi.fn()},addEventListener:(name,cb)=>events[name]=cb,removeEventListener:vi.fn()};
  const acknowledge=vi.fn();const controller=installEpilogueAnnouncement({document:doc,getState:state,acknowledge,isBlocked:()=>blocked,now:()=>time});
  controller.queue(0);vi.advanceTimersByTime(0);expect(dialog.showModal).not.toHaveBeenCalled();blocked=false;vi.advanceTimersByTime(500);expect(dialog.showModal).toHaveBeenCalledOnce();
  expect(dialog.innerHTML).toContain('seis jefes inmediatamente anteriores');expect(dialog.innerHTML).toContain('jefes 16 al 21');expect(dialog.innerHTML).toContain('Las fusiones antiguas no cambian.');expect(dialog.innerHTML).toContain('siempre que no compartan familia de efectos');
  button.click();dialog.cancelHandler({preventDefault:vi.fn()});expect(acknowledge).not.toHaveBeenCalled();
  time=2000;doc.hidden=true;events.visibilitychange();time=20000;doc.hidden=false;events.visibilitychange();expect(button.disabled).toBe(true);
  time=23000;vi.advanceTimersByTime(100);expect(button.disabled).toBe(false);button.click();expect(acknowledge).toHaveBeenCalledWith(EPILOGUE_NOTICE_ID);expect(dialog.close).toHaveBeenCalledOnce();expect(doc.activeElement.focus).toHaveBeenCalledOnce();vi.useRealTimers();
 });
});
