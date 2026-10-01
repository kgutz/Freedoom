import { describe, expect, it } from 'vitest';
import { recordHalloweenAnalytics, halloweenHuntMetrics, EVENT_ANALYTICS_MAX_BYTES } from './event-analytics.js';
import { mergeState, serializeState, parseState } from '../storage/state-storage.js';
import { createMigrationPlan, verifyStoredCloudSave, verifyUpdatedCloudSave } from '../cloud/cloud-migration.js';
import { createCloudService } from '../cloud/cloud-service.js';

const options = { active: true, nowTimestamp: new Date(2026,9,5,12).getTime() };
const entry = { operationId: 'hunt:a', source:'hunt', level:22, region:'fields-of-mist', difficulty:'hard', metrics:{huntsCompleted:1,goldEarnedHunts:26} };
describe('event balance summaries', () => {
  it('roundtrips through the production cloud adapter, migration checksum and restore without extra RPCs', async () => {
    let analytics;
    for(let i=0;i<60;i++) analytics=recordHalloweenAnalytics(analytics,{...entry,operationId:`cloud:${i}`},options);
    const snapshot={config:{mode:'gradual'},days:{},game:{name:'Test',hunt:{history:Array.from({length:20},(_,i)=>({id:i}))}},habits:{items:[],entries:{}},eventAnalytics:analytics};
    const plan=createMigrationPlan(snapshot,{cryptoImpl:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'}});
    let stored;
    let writes=0;
    const service=createCloudService({config:{enabled:true},client:{
      rpc:async(name,args)=>{
        expect(name).toBe('save_game_state'); writes++;
        stored=JSON.parse(JSON.stringify({state:args.p_state,state_schema_version:args.p_state_schema_version,checksum:args.p_checksum,migration_id:args.p_migration_id,revision:1}));
        return {data:[stored],error:null};
      },
      from:name=>{expect(name).toBe('game_saves');return {select:()=>({maybeSingle:async()=>({data:stored,error:null})})};},
    }});
    expect(verifyUpdatedCloudSave(await service.saveGameState(plan,0),plan)).toBe(true);
    const downloaded=await service.loadGameSave();
    expect(verifyStoredCloudSave(downloaded)).toBe(true);
    const restored=mergeState({},downloaded.state);
    expect(restored.eventAnalytics.events['halloween-2026'].totals.huntsCompleted).toBe(60);
    expect(recordHalloweenAnalytics(restored.eventAnalytics,{...entry,operationId:'cloud:0'},options)).toBe(restored.eventAnalytics);
    expect(writes).toBe(1);
  });
  it('stops growth at the deduplication limit and marks incomplete summaries', () => {
    const seen=Object.fromEntries(Array.from({length:10000},(_,i)=>[`op:${i}`,true]));
    const data={schemaVersion:1,events:{'halloween-2026':{seen,totals:{huntsCompleted:10000}}}};
    const capped=recordHalloweenAnalytics(data,entry,options);
    expect(capped.capped).toBe(true);
    expect(capped.events).toBe(data.events);
    expect(recordHalloweenAnalytics(capped,entry,options)).toBe(capped);
  });
  it('enforces an overall byte budget without erasing retained metrics', () => {
    const data={schemaVersion:1,events:{'halloween-2026':{seen:{},totals:{huntsCompleted:12},padding:'x'.repeat(EVENT_ANALYTICS_MAX_BYTES-200)}}};
    const capped=recordHalloweenAnalytics(data,entry,options);
    expect(capped.capped).toBe(true);
    expect(capped.events).toBe(data.events);
    expect(new TextEncoder().encode(JSON.stringify(capped)).byteLength).toBeLessThan(EVENT_ANALYTICS_MAX_BYTES);
  });
  it('does not record outside the event or without an operation id', () => {
    expect(recordHalloweenAnalytics(undefined,entry)).toBeUndefined();
    expect(recordHalloweenAnalytics(undefined,{...entry,operationId:''},options)).toBeUndefined();
  });
  it('deduplicates operations even after reloading and keeps no personal details', () => {
    const first=recordHalloweenAnalytics(undefined,{...entry,email:'private',metrics:{...entry.metrics,email:9}},options);
    const restored=mergeState({},parseState(serializeState({eventAnalytics:first}))).eventAnalytics;
    expect(restored).toEqual(first);
    expect(recordHalloweenAnalytics(restored,entry,options)).toBe(restored);
    expect(JSON.stringify(first)).not.toContain('private');
    expect(JSON.stringify(first)).not.toContain('email');
  });
  it('keeps month totals beyond the truncated hunt history and separates zones and levels', () => {
    let data;
    for(let i=0;i<50;i++) data=recordHalloweenAnalytics(data,{...entry,operationId:`hunt:${i}`,level:i<25?22:23},options);
    expect(data.events['halloween-2026'].totals).toEqual({huntsCompleted:50,goldEarnedHunts:1300});
    expect(Object.keys(data.events['halloween-2026'].segments)).toHaveLength(2);
  });
  it('preserves completed event data when tracking is off or a new year starts', () => {
    const first=recordHalloweenAnalytics(undefined,entry,options);
    expect(recordHalloweenAnalytics(first,{...entry,operationId:'next'},{active:false})).toBe(first);
    const next=recordHalloweenAnalytics(first,entry,{active:true,nowTimestamp:new Date(2027,9,1).getTime()});
    expect(next.events['halloween-2026']).toEqual(first.events['halloween-2026']);
    expect(next.events['halloween-2027'].totals.huntsCompleted).toBe(1);
  });
  it('splits normal, candy and mask blood and records refunds instead of consumption', () => {
    expect(halloweenHuntMetrics({won:true,encounters:[{won:true},{won:true},{won:true}],halloweenCandy:{blood:true,experience:true},rewards:{gold:26,bossBlood:3,candyBloodBonus:1,maskBloodBonus:1,xp:33,candyXpBonus:11,candyDrops:{energy:2}}})).toMatchObject({bloodBase:1,bloodCandy:1,bloodMask:1,xpBase:22,xpCandy:11,bloodConsumed:1,experienceConsumed:1,energyDropped:2});
    expect(halloweenHuntMetrics({halloweenCandy:{blood:true,experience:true},rewards:{}})).toMatchObject({bloodRefunded:1,experienceRefunded:1});
  });
  it('ignores invalid and unapproved metrics without mutating the input', () => {
    const first=recordHalloweenAnalytics(undefined,entry,options);
    const before=JSON.stringify(first);
    const next=recordHalloweenAnalytics(first,{...entry,operationId:'safe',metrics:{goldEarnedHunts:Infinity,goldSpentCandy:-5,bloodBought:2,secret:5}},options);
    expect(next.events['halloween-2026'].totals.bloodBought).toBe(2);
    expect(JSON.stringify(first)).toBe(before);
    expect(JSON.stringify(next)).not.toContain('secret');
  });
});
