import { describe, expect, it, vi } from 'vitest';
import {
  ACTION_LOG_LIMIT,
  RECOVERY_SLOT_COUNT,
  STORAGE_KEY,
  checksumOf,
  createBrowserStore,
  exportBackup,
  applyImportCommands,
  importBackup,
  isCatastrophicStateRegression,
  mergeState,
  parseState,
  stateInformationProfile,
} from './state-storage.js';

function memoryLocalStorage({ fail } = {}) {
  const values = new Map();
  return {
    values,
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      if (fail?.(key, value)) throw new Error('fallo simulado');
      values.set(key, value);
    }),
  };
}

const defaultState = () => ({
  config: {
    journeyMode: 'reduction',
    startDate: '2026-07-17',
    startLimit: 20,
    wakeTime: '09:00',
    sleepTime: '23:00',
    pillsGoal: 3,
    takesPills: true,
    tracksBeer: true,
  },
  days: {},
  habits: { items: [], entries: {} },
  seeded: false,
  seededV: 0,
  game: { cls: null },
  onboarded: false,
});

const v34State = {
  config: {
    startDate: '2026-07-20',
    startLimit: 18,
    wakeTime: '07:00',
    sleepTime: '23:30',
    pillsGoal: 2,
    takesPills: true,
    tracksBeer: false,
  },
  days: {
    '2026-07-20': { c: 12, p: 2, t: '21:14', b: 1, s: 3, sx: 8 },
  },
  seeded: true,
  seededV: 3,
  game: {
    cls: 'paladin',
    name: 'Kike',
    hp: 96,
    mp: 42,
    bonusXp: 25,
    pardons: [],
    judgmentDays: [],
  },
  onboarded: true,
};

describe('compatibilidad del estado', () => {
  it('suma recursos mediante comandos de importación sin alterar el resto de la partida', () => {
    const current = {
      ...defaultState(),
      economy: { coins: 25, bossBlood: 2, arcaneFibers: 3, transactions: [{ id: 'old' }] },
      inventory: { relics: { relic_01: { id: 'relic_01' } } },
    };
    const result = importBackup(current, '!+sangre 1\n!+oro 10\n!+fibra 2');
    expect(result.economy).toEqual({
      coins: 35,
      bossBlood: 3,
      arcaneFibers: 5,
      transactions: [{ id: 'old' }],
    });
    expect(result.inventory).toBe(current.inventory);
  });

  it('rechaza comandos desconocidos o cantidades inválidas de forma atómica', () => {
    const current = { ...defaultState(), economy: { bossBlood: 2, coins: 4 } };
    expect(() => applyImportCommands(current, '!+sangre 1\n!+pocion 2')).toThrow('Recurso no válido');
    expect(() => applyImportCommands(current, '!+sangre 0')).toThrow('Cantidad no válida');
    expect(current.economy).toEqual({ bossBlood: 2, coins: 4 });
  });

  it('añade energía de Cacería respetando su límite', () => {
    const current = {
      ...defaultState(),
      game: { cls: 'paladin', hunt: { energyDay: '2000-01-01', energy: 0 } },
    };
    const result = applyImportCommands(current, '!+energia 2');
    expect(result.game.hunt.energy).toBe(7);
    expect(result.game.hunt.rewardEnergyRemaining).toBe(2);
    const capped = applyImportCommands(result, '!+energía 10');
    expect(capped.game.hunt.energy).toBe(10);
  });

  it('desbloquea outfits y marcos mediante sus nombres públicos', () => {
    const current = { ...defaultState(), game: { cls: 'paladin' } };
    const result = applyImportCommands(
      current,
      '!+outfit operador-del-nexo\n!+outfit beta-tester\n!+marco corazon-de-freedom',
    );
    expect(result.game.outfits.owned['arcane-weave-01'].source).toBe('import-command');
    expect(result.game.outfits.owned['beta-tester'].source).toBe('import-command');
    expect(result.game.pioneerReward.outfitId).toBe('beta-tester');
    expect(result.game.frames.owned['beta-tester'].source).toBe('import-command');
  });

  it('preserva economía, reliquias, Forja y Tienda en exportación e importación', () => {
    const lootState = {
      ...v34State,
      economy: { coins: 110, bossBlood: 2, transactions: [{ id: 'reward' }] },
      loot: {
        claimedBossRewards: ['boss_reward_01'],
        bossRelicOutcomes: {
          boss_reward_01: { status: 'purchased', relicId: 'relic_01', operationId: 'buy-1' },
        },
        notices: [], migrationComplete: true,
      },
      inventory: {
        relics: { fusion_01: { unlocked: true, kind: 'fusion', recipeId: 'fusion_recipe_01' } },
        collection: { relic_01: { discoveredAt: 1 }, fusion_01: { discoveredAt: 2 } },
        equipped: ['fusion_01'],
      },
      forge: {
        seed: 'forge-save-seed',
        attempts: { 'relic_01:rank-3': 1 },
        history: [{ operationId: 'forge-1' }],
        fusion: {
          discoveredRecipes: ['fusion_recipe_01'],
          history: [{ operationId: 'fusion-1', recipeId: 'fusion_recipe_01' }],
          dailyActivations: { 'fusion_01:first-habit-mana:2026-08-14': true },
          weeklyActivations: {},
        },
      },
      shop: {
        schemaVersion: 1,
        rotation: { period: 4, startedAt: 100, endsAt: 200, relicIds: ['relic_02'] },
        purchases: [{ operationId: 'buy-1', relicId: 'relic_01' }],
      },
    };
    const restored = importBackup({
      ...defaultState(), economy: {}, loot: {}, inventory: {}, forge: {}, shop: {},
    }, exportBackup(lootState));
    expect(restored.economy.coins).toBe(110);
    expect(restored.economy.bossBlood).toBe(2);
    expect(restored.inventory.relics.fusion_01.recipeId).toBe('fusion_recipe_01');
    expect(restored.inventory.collection.relic_01.discoveredAt).toBe(1);
    expect(restored.loot.bossRelicOutcomes.boss_reward_01.status).toBe('purchased');
    expect(restored.forge.attempts['relic_01:rank-3']).toBe(1);
    expect(restored.forge.seed).toBe('forge-save-seed');
    expect(restored.forge.fusion.discoveredRecipes).toEqual(['fusion_recipe_01']);
    expect(restored.forge.fusion.history[0].operationId).toBe('fusion-1');
    expect(restored.shop.rotation.relicIds).toEqual(['relic_02']);
    expect(restored.shop.purchases[0].operationId).toBe('buy-1');
  });

  it('bloquea una regresión que borraría una colección aunque conserve el héroe', () => {
    const protectedState = {
      ...v34State,
      economy: { coins: 75, bossBlood: 1 },
      loot: { claimedBossRewards: ['boss_reward_01'] },
      inventory: { relics: { relic_01: { id: 'relic_01' } } },
    };
    expect(isCatastrophicStateRegression(v34State, protectedState)).toBe(true);
  });

  it('carga una partida v34 conservando datos y nuevos valores por defecto', () => {
    const loaded = mergeState(defaultState(), v34State);

    expect(loaded).toEqual({
      ...v34State,
      config: { journeyMode: 'reduction', ...v34State.config },
      habits: { items: [], entries: {} },
    });
    expect(loaded.config.wakeTime).toBe('07:00');
    expect(loaded.days['2026-07-20'].sx).toBe(8);
    expect(loaded.game.cls).toBe('paladin');
  });

  it('conserva valores por defecto cuando faltan campos antiguos', () => {
    const loaded = mergeState(defaultState(), {
      config: { startLimit: 15 },
      days: {},
    });

    expect(loaded.config.startLimit).toBe(15);
    expect(loaded.config.wakeTime).toBe('09:00');
    expect(loaded.config.journeyMode).toBe('reduction');
    expect(loaded.game).toEqual({ cls: null });
    expect(loaded.habits).toEqual({ items: [], entries: {} });
  });

  it('carga los hábitos y sus recompensas guardadas', () => {
    const loaded = mergeState(defaultState(), {
      habits: {
        items: [{ id: 'walk', title: 'Caminar' }],
        entries: {
          'walk|d:2026-08-01': { count: 1, xpAwarded: 3, coinsAwarded: 1 },
        },
        dailyCoinBonuses: {
          'd:2026-08-01': { periodKey: 'd:2026-08-01', coinsAwarded: 3 },
        },
      },
      economy: {
        coins: 4,
        bossBlood: 0,
        transactions: [{ id: 'habit-coin:walk|d:2026-08-01', coins: 1 }],
      },
    });

    expect(loaded.habits.items[0].title).toBe('Caminar');
    expect(loaded.habits.entries['walk|d:2026-08-01'].xpAwarded).toBe(3);
    expect(loaded.habits.entries['walk|d:2026-08-01'].coinsAwarded).toBe(1);
    expect(loaded.habits.dailyCoinBonuses['d:2026-08-01'].coinsAwarded).toBe(3);
    expect(loaded.economy.transactions[0].id).toBe('habit-coin:walk|d:2026-08-01');
  });
});

describe('copias de seguridad', () => {
  it('recupera colección, recetas, historial y activaciones de Fusión desde una copia automática', async () => {
    const localStorage = memoryLocalStorage();
    const store = createBrowserStore({ localStorage, indexedDB: null });
    const fusionState = {
      ...v34State,
      economy: { coins: 90, bossBlood: 1, transactions: [{ id: 'fusion:op-1' }] },
      inventory: {
        relics: { fusion_01: { unlocked: true, kind: 'fusion', recipeId: 'fusion_recipe_01' } },
        collection: {
          relic_01: { discoveredAt: 1 }, relic_02: { discoveredAt: 1 }, fusion_01: { discoveredAt: 2 },
        },
        equipped: ['fusion_01'],
      },
      forge: {
        seed: 'seed', attempts: {}, history: [],
        fusion: {
          discoveredRecipes: ['fusion_recipe_01'],
          history: [{ operationId: 'op-1', recipeId: 'fusion_recipe_01' }],
          dailyActivations: { 'fusion_01:first-habit-mana:2026-08-14': true },
          weeklyActivations: {},
        },
      },
      shop: { schemaVersion: 1, rotation: null, purchases: [] },
    };
    await store.set(STORAGE_KEY, JSON.stringify(fusionState));
    const recovered = await store.get(STORAGE_KEY);
    const parsed = parseState(recovered.value);
    expect(parsed.inventory.collection).toHaveProperty('fusion_01');
    expect(parsed.forge.fusion.discoveredRecipes).toEqual(['fusion_recipe_01']);
    expect(parsed.forge.fusion.history[0].operationId).toBe('op-1');
    expect(parsed.forge.fusion.dailyActivations).toHaveProperty(
      'fusion_01:first-habit-mana:2026-08-14',
    );
  });

  it('hace un recorrido exportar/importar sin perder información', () => {
    const backup = exportBackup(v34State);
    const restored = importBackup(defaultState(), backup);

    expect(restored).toEqual({
      ...v34State,
      config: { journeyMode: 'reduction', ...v34State.config },
      habits: { items: [], entries: {} },
    });
  });

  it('conserva los efectos de borrachera de la v36', () => {
    const v36State = {
      ...v34State,
      game: {
        ...v34State.game,
        intoxication: [
          {
            id: 'beer-1',
            contribution: 10,
            startedAt: 1785247200000,
            expiresAt: 1785249000000,
          },
          {
            id: 'beer-2',
            contribution: 15,
            startedAt: 1785247800000,
            expiresAt: 1785250500000,
          },
        ],
      },
    };

    expect(importBackup(defaultState(), exportBackup(v36State))).toEqual({
      ...v36State,
      config: { journeyMode: 'reduction', ...v36State.config },
      habits: { items: [], entries: {} },
    });
  });

  it('conserva la vida y el historial del jefe de la v39', () => {
    const v39State = {
      ...v34State,
      game: {
        ...v34State.game,
        bossCombat: {
          version: 1,
          startedWeek: 2,
          legacyBossesDown: 1,
          defeated: 0,
          bossIndex: 1,
          week: 3,
          hpAtWeekStart: 62,
          victoryRecorded: false,
          spellHits: [],
          history: [
            {
              week: 2,
              bossIndex: 1,
              won: false,
              damage: 38,
              remainingHp: 62,
            },
          ],
        },
      },
    };

    expect(importBackup(defaultState(), exportBackup(v39State))).toEqual({
      ...v39State,
      config: { journeyMode: 'reduction', ...v39State.config },
      habits: { items: [], entries: {} },
    });
  });

  it('rechaza texto y objetos que no son copias de Freedom', () => {
    expect(() => importBackup(defaultState(), 'no es json')).toThrow();
    expect(() => importBackup(defaultState(), '{"foo":"bar"}')).toThrow(
      'Formato de copia no válido',
    );
  });

  it('analiza correctamente el código exportado', () => {
    expect(parseState(exportBackup(v34State))).toEqual(v34State);
  });
});

describe('adaptador del navegador', () => {
  it('reconoce una caída catastrófica frente a una partida con progreso', () => {
    const richState = {
      ...v34State,
      days: {
        '2026-07-20': { c: 12 },
        '2026-07-21': { c: 11 },
        '2026-07-22': { c: 10 },
        '2026-07-23': { c: 9 },
      },
    };

    expect(stateInformationProfile(richState).meaningful).toBe(true);
    expect(isCatastrophicStateRegression(defaultState(), richState)).toBe(true);
    expect(isCatastrophicStateRegression(richState, defaultState())).toBe(false);
  });

  it('protege un resultado persistido de Victoria Anticipada frente a su desaparición', () => {
    const resolved = defaultState();
    resolved.loot = {
      ...resolved.loot,
      earlyVictoryOutcomes: {
        'boss_reward_01:early-victory:week-0': {
          coins: 25, bossBlood: 0, bloodGranted: false,
        },
      },
    };
    const missing = { ...resolved, loot: { ...resolved.loot, earlyVictoryOutcomes: {} } };

    expect(stateInformationProfile(resolved).earlyVictoryOutcomeCount).toBe(1);
    expect(isCatastrophicStateRegression(missing, resolved)).toBe(true);
  });

  it('mantiene una copia diaria y otra semanal fuera de la rotación', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 7, 10, 10));
      const localStorage = memoryLocalStorage();
      const store = createBrowserStore({ localStorage });
      store.set(STORAGE_KEY, exportBackup(v34State));

      let recoveries = await store.listRecoveries();
      expect(recoveries.find((item) => item.source === 'daily')).toMatchObject({
        revision: 1,
        periodKey: '2026-08-10',
      });
      expect(recoveries.find((item) => item.source === 'weekly')).toMatchObject({
        revision: 1,
        periodKey: '2026-08-10',
      });
      expect(recoveries.find((item) => item.source === 'last-info')).toMatchObject({
        revision: 1,
        state: v34State,
      });

      vi.setSystemTime(new Date(2026, 7, 11, 10));
      store.set(STORAGE_KEY, exportBackup(v34State));
      recoveries = await store.listRecoveries();
      expect(recoveries.find((item) => item.source === 'daily')).toMatchObject({
        revision: 2,
        periodKey: '2026-08-11',
      });
      expect(recoveries.find((item) => item.source === 'weekly')).toMatchObject({
        revision: 1,
        periodKey: '2026-08-10',
      });
      expect(recoveries.find((item) => item.source === 'last-info')).toMatchObject({
        revision: 2,
        state: v34State,
      });

      vi.setSystemTime(new Date(2026, 7, 17, 10));
      store.set(STORAGE_KEY, exportBackup(v34State));
      recoveries = await store.listRecoveries();
      expect(recoveries.find((item) => item.source === 'weekly')).toMatchObject({
        revision: 3,
        periodKey: '2026-08-17',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('bloquea que un estado inicial sustituya una partida completa', async () => {
    const localStorage = memoryLocalStorage();
    const store = createBrowserStore({ localStorage });
    store.set(STORAGE_KEY, exportBackup(v34State));

    expect(store.set(STORAGE_KEY, exportBackup(defaultState()))).toMatchObject({
      blocked: true,
      revision: 1,
    });
    const recoveries = await store.listRecoveries();
    expect(recoveries.find((item) => item.source === 'last-info')).toMatchObject({
      revision: 1,
      state: v34State,
    });
    await expect(store.get(STORAGE_KEY)).resolves.toMatchObject({
      value: exportBackup(v34State),
      revision: 1,
    });
  });

  it('recupera una copia rica aunque una revisión accidental más nueva esté vacía', async () => {
    const localStorage = memoryLocalStorage();
    const store = createBrowserStore({ localStorage });
    store.set(STORAGE_KEY, exportBackup(v34State));
    const emptyText = exportBackup(defaultState());
    localStorage.values.set(STORAGE_KEY, emptyText);
    localStorage.values.set(
      `${STORAGE_KEY}:meta`,
      JSON.stringify({
        revision: 2,
        savedAt: Date.now() + 1,
        generation: 0,
        checksum: checksumOf(emptyText),
      }),
    );

    const reloaded = createBrowserStore({ localStorage });
    await expect(reloaded.get(STORAGE_KEY)).resolves.toMatchObject({
      value: exportBackup(v34State),
      recovered: true,
    });
  });

  it('respeta un reinicio voluntario y conserva las copias anteriores manuales', async () => {
    const localStorage = memoryLocalStorage();
    const store = createBrowserStore({ localStorage });
    store.set(STORAGE_KEY, exportBackup(v34State));
    store.authorizeDestructiveSave('reset');
    expect(store.set(STORAGE_KEY, exportBackup(defaultState()))).toMatchObject({
      blocked: false,
      generation: 1,
    });

    const reloaded = createBrowserStore({ localStorage });
    await expect(reloaded.get(STORAGE_KEY)).resolves.toMatchObject({
      value: exportBackup(defaultState()),
      generation: 1,
      recovered: false,
      source: 'main',
    });
    const recoveries = await reloaded.listRecoveries();
    expect(recoveries.some((item) => item.source === 'daily')).toBe(true);
    expect(recoveries.some((item) => item.source === 'weekly')).toBe(true);
  });

  it('usa localStorage inmediatamente en la aplicación web', async () => {
    const localStorage = memoryLocalStorage();
    const store = createBrowserStore({ localStorage });

    const saved=store.set(STORAGE_KEY, '{"ok":true}');

    expect(store.usesExternalStorage).toBe(false);
    expect(saved).toMatchObject({revision:1,verified:true,recoverySaved:true,degraded:false});
    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      '{"ok":true}',
    );
    await expect(store.get(STORAGE_KEY)).resolves.toMatchObject({
      key: STORAGE_KEY,
      value: '{"ok":true}',
      revision:1,
      recovered:false,
      source:'main',
    });
  });

  it('recupera la versión más reciente si la copia principal se corrompe', async () => {
    const localStorage=memoryLocalStorage();
    const store=createBrowserStore({localStorage});
    store.set(STORAGE_KEY,'{"step":1}');
    store.set(STORAGE_KEY,'{"step":2}');
    localStorage.values.set(STORAGE_KEY,'{"step":');

    const reloaded=createBrowserStore({localStorage});
    await expect(reloaded.get(STORAGE_KEY)).resolves.toMatchObject({
      value:'{"step":2}',revision:2,recovered:true,source:'recovery-2'
    });
  });

  it('una copia de recuperación conserva el saldo de Sangre de Jefe', async () => {
    const localStorage=memoryLocalStorage();
    const store=createBrowserStore({localStorage});
    const savedState={...v34State,economy:{coins:60,bossBlood:1,transactions:[]}};
    store.set(STORAGE_KEY,exportBackup(savedState));
    localStorage.values.set(STORAGE_KEY,'{"config":');

    const reloaded=createBrowserStore({localStorage});
    const recovered=await reloaded.get(STORAGE_KEY);
    expect(recovered.recovered).toBe(true);
    expect(importBackup(defaultState(),recovered.value).economy.bossBlood).toBe(1);
  });

  it('ignora una recuperación dañada y vuelve a la anterior', async () => {
    const localStorage=memoryLocalStorage();
    const store=createBrowserStore({localStorage});
    store.set(STORAGE_KEY,'{"step":1}');
    store.set(STORAGE_KEY,'{"step":2}');
    localStorage.values.set(STORAGE_KEY,'dañado');
    localStorage.values.set(`${STORAGE_KEY}:recovery:2`,'dañado');

    const reloaded=createBrowserStore({localStorage});
    await expect(reloaded.get(STORAGE_KEY)).resolves.toMatchObject({
      value:'{"step":1}',revision:1,recovered:true,source:'recovery-1'
    });
  });

  it('mantiene una copia recuperable cuando falla solo el guardado principal', async () => {
    const localStorage=memoryLocalStorage({fail:(key)=>key===STORAGE_KEY});
    const store=createBrowserStore({localStorage});

    expect(store.set(STORAGE_KEY,'{"safe":true}')).toMatchObject({
      verified:false,recoverySaved:true,degraded:true
    });
    await expect(store.get(STORAGE_KEY)).resolves.toMatchObject({
      value:'{"safe":true}',revision:1,recovered:true
    });
  });

  it('avisa mediante una excepción si no puede escribir ninguna copia', () => {
    const localStorage=memoryLocalStorage({fail:()=>true});
    const store=createBrowserStore({localStorage});
    expect(()=>store.set(STORAGE_KEY,'{"safe":false}')).toThrow('fallo simulado');
  });

  it('carga partidas antiguas sin metadatos como revisión cero', async () => {
    const localStorage=memoryLocalStorage();
    localStorage.values.set(STORAGE_KEY,'{"legacy":true}');
    const store=createBrowserStore({localStorage});
    await expect(store.get(STORAGE_KEY)).resolves.toMatchObject({
      value:'{"legacy":true}',revision:0,recovered:false,source:'main'
    });
  });

  it('conserva solo las últimas copias y limita el registro de acciones', async () => {
    const localStorage=memoryLocalStorage();
    const store=createBrowserStore({localStorage});
    for(let revision=1;revision<=RECOVERY_SLOT_COUNT+2;revision+=1){
      store.set(STORAGE_KEY,JSON.stringify({revision}));
    }
    for(let index=0;index<ACTION_LOG_LIMIT+8;index+=1){
      store.recordAction({type:'test',index});
    }

    const recoveries=await store.listRecoveries();
    expect(recoveries).toHaveLength(RECOVERY_SLOT_COUNT);
    expect(recoveries.map(item=>item.revision)).toEqual([5,4,3]);
    expect(store.actionLog()).toHaveLength(ACTION_LOG_LIMIT);
    expect(store.actionLog()[0].index).toBe(8);
  });

  it('genera checksums estables y sensibles al contenido',()=>{
    expect(checksumOf('{"a":1}')).toBe(checksumOf('{"a":1}'));
    expect(checksumOf('{"a":1}')).not.toBe(checksumOf('{"a":2}'));
  });

  it('mantiene compatibilidad con window.storage', async () => {
    const storage = {
      get: vi.fn(async (key) => ({ key, value: '{}' })),
      set: vi.fn(async (key, value) => ({ key, value })),
    };
    const store = createBrowserStore({ storage, localStorage: null });

    await store.set(STORAGE_KEY, '{}');

    expect(store.usesExternalStorage).toBe(true);
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEY, '{}');
  });
});
