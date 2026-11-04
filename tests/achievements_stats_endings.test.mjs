// Test Suite: Sistema Trofei, Registro Statistiche e Galleria dei Finali (Milestone 33)
// Esecuzione: node --import ./tests/register.mjs tests/achievements_stats_endings.test.mjs
import assert from 'node:assert/strict';
import { State } from '../js/core/State.js';
import { Save } from '../js/core/Save.js';
import { StatsManager } from '../js/core/StatsManager.js';
import { Achievements, ACHIEVEMENT_DEFS } from '../js/systems/Achievements.js';
import { I18n, DICTIONARY } from '../js/core/I18n.js';
import { AchievementToast } from '../js/ui/AchievementToast.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

t('Achievements: verifica presenza e integrità dei 12 trofei ufficiali', () => {
  assert.equal(ACHIEVEMENT_DEFS.length, 12, '12 trofei ufficiali');
  const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
  const expected = [
    'first_strike',
    'sand_millionaire',
    'explosive_temper',
    'automation_age',
    'relic_resonance',
    'first_epilogue',
    'pantheon_master',
    'deep_diver',
    'frost_breaker',
    'jungle_pioneer',
    'speed_demon',
    'sanctuary_ascendant'
  ];
  for (const exp of expected) {
    assert.ok(ids.includes(exp), `Trofeo ${exp} presente`);
  }
});

t('Achievements: lockout completo in modalità trucchi (Anti-Cheat)', () => {
  const state = new State();
  state.cheatsEnabled = true;
  const storage = new MockStorage();
  const statsManager = new StatsManager(storage);
  const save = new Save(storage);

  const ach = new Achievements({ state, statsManager, save });
  ach.storage = storage;

  // Tentativo di sblocco diretto
  const unlockedDirect = ach.unlock('first_strike');
  assert.equal(unlockedDirect, false, 'Non deve sbloccare con i cheat attivi');
  assert.equal(ach.isUnlocked('first_strike'), false);

  // Tentativo via check con condizioni soddisfatte
  statsManager.increment('totalClicks', 10);
  state.sand = 5000000;
  ach.check();
  assert.equal(ach.getUnlockedCount(), 0, 'Nessun trofeo sbloccato se cheat attivi');
});

t('Achievements: condizioni di sblocco e persistenza', () => {
  const state = new State();
  state.cheatsEnabled = false;
  const storage = new MockStorage();
  const statsManager = new StatsManager(storage);
  const save = new Save(storage);

  let chimeCalled = false;
  const audio = {
    playSfx: (name) => { if (name === 'achievement') chimeCalled = true; }
  };

  const ach = new Achievements({ state, statsManager, save, audio });
  ach.storage = storage;

  // 1. first_strike
  statsManager.increment('totalClicks', 1);
  ach.check();
  assert.ok(ach.isUnlocked('first_strike'));
  assert.ok(chimeCalled);

  // 2. sand_millionaire
  state.sand = 1000000;
  ach.check();
  assert.ok(ach.isUnlocked('sand_millionaire'));

  // 3. explosive_temper
  statsManager.increment('dynamiteUsed', 10);
  ach.check();
  assert.ok(ach.isUnlocked('explosive_temper'));

  // 4. automation_age
  state.upgrades = { scarab: 10, excavator: 15 };
  ach.check();
  assert.ok(ach.isUnlocked('automation_age'));

  // 5. relic_resonance
  state.upgrades.relic_resonance = 1;
  ach.check();
  assert.ok(ach.isUnlocked('relic_resonance'));

  // 6. first_epilogue
  save.recordEnding('curse');
  ach.check();
  assert.ok(ach.isUnlocked('first_epilogue'));

  // 7. pantheon_master
  save.recordEnding('treasure');
  save.recordEnding('business');
  save.recordEnding('secret');
  ach.check();
  assert.ok(ach.isUnlocked('pantheon_master'));

  // 8. deep_diver
  save.recordCompletedBiome('ocean');
  ach.check();
  assert.ok(ach.isUnlocked('deep_diver'));

  // 9. frost_breaker
  save.recordCompletedBiome('glacier');
  ach.check();
  assert.ok(ach.isUnlocked('frost_breaker'));

  // 10. jungle_pioneer
  save.recordCompletedBiome('jungle');
  ach.check();
  assert.ok(ach.isUnlocked('jungle_pioneer'));

  // 11. speed_demon
  statsManager.recordRunCompletion(1450);
  ach.check();
  assert.ok(ach.isUnlocked('speed_demon'));

  // 12. sanctuary_ascendant
  save.addTablets(60);
  save.spendTablets(50);
  ach.check();
  assert.ok(ach.isUnlocked('sanctuary_ascendant'));

  assert.equal(ach.getUnlockedCount(), 12);

  // Ricarica per testare persistenza
  const reloaded = new Achievements({ state, statsManager, save });
  reloaded.storage = storage;
  reloaded.load();
  assert.equal(reloaded.getUnlockedCount(), 12);
});

t('StatsManager: tracciamento tavolette, biomi e dinamite', () => {
  const storage = new MockStorage();
  const stats = new StatsManager(storage);

  stats.increment('dynamiteUsed', 5);
  stats.increment('tabletsEarned', 12);
  stats.increment('tabletsSpent', 8);
  stats.recordRunCompletion(1200, 'desert');
  stats.recordRunCompletion(900, 'ocean');

  assert.equal(stats.get('dynamiteUsed'), 5);
  assert.equal(stats.get('tabletsEarned'), 12);
  assert.equal(stats.get('tabletsSpent'), 8);
  assert.equal(stats.get('runsCompleted'), 2);
  assert.equal(stats.get('bestRunTime'), 900);
  assert.deepEqual(stats.get('completedBiomes'), ['desert', 'ocean']);
});

t('Endings: persistenza date di sblocco e biomi completati', () => {
  const storage = new MockStorage();
  const save = new Save(storage);

  save.recordEnding('curse', 'desert');
  const dateCurse = save.getEndingUnlockDate('curse');
  assert.ok(dateCurse > 0, 'Data di sblocco registrata');
  assert.deepEqual(save.getCompletedBiomes(), ['desert']);

  save.recordEnding('secret', 'ocean');
  assert.deepEqual(save.getCompletedBiomes(), ['desert', 'ocean']);
  assert.ok(save.getEndingUnlockDate('secret') > 0);
  assert.equal(save.getEndingUnlockDate('treasure'), null, 'Finale non ancora visto non ha data');
});

t('I18n: localizzazioni per 12 trofei, metriche statistiche e galleria', () => {
  const requiredTrohpies = [
    'first_strike', 'sand_millionaire', 'explosive_temper', 'automation_age',
    'relic_resonance', 'first_epilogue', 'pantheon_master', 'deep_diver',
    'frost_breaker', 'jungle_pioneer', 'speed_demon', 'sanctuary_ascendant'
  ];

  for (const id of requiredTrohpies) {
    assert.ok(DICTIONARY.it.achievements[id]?.title, `IT title per ${id}`);
    assert.ok(DICTIONARY.it.achievements[id]?.desc, `IT desc per ${id}`);
    assert.ok(DICTIONARY.en.achievements[id]?.title, `EN title per ${id}`);
    assert.ok(DICTIONARY.en.achievements[id]?.desc, `EN desc per ${id}`);
  }

  const statMetrics = [
    'totalClicks', 'totalSandLifetime', 'dynamiteUsed', 'runsCompleted',
    'totalPlaytime', 'tabletsEarned', 'tabletsSpent', 'bestRunTime'
  ];
  for (const m of statMetrics) {
    assert.ok(DICTIONARY.it.stats[m], `IT stat label per ${m}`);
    assert.ok(DICTIONARY.en.stats[m], `EN stat label per ${m}`);
  }
});

console.log(`\nTest Trofei, Statistiche e Galleria completati: ${passed} superati con successo.\n`);

