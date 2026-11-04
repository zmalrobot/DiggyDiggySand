// Test unitari della Fase 10: Achievements, Statistiche Cumulative e Localizzazione Multilingua
// Esecuzione: node --import ./tests/register.mjs tests/phase10.test.mjs
import assert from 'node:assert/strict';
import { I18n, DICTIONARY } from '../js/core/I18n.js';
import { StatsManager } from '../js/core/StatsManager.js';
import { Achievements, ACHIEVEMENT_DEFS } from '../js/systems/Achievements.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { State } from '../js/core/State.js';
import { Save } from '../js/core/Save.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };
const asyncT = async (name, fn) => { await fn(); passed++; console.log('ok -', name); };

// Storage mock in memoria
class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

t('I18n: completezza del dizionario (IT ed EN)', () => {
  assert.ok(DICTIONARY.it, 'Dizionario italiano presente');
  assert.ok(DICTIONARY.en, 'Dizionario inglese presente');

  const requiredSections = ['common', 'menu', 'hud', 'shop', 'upgrades', 'settings', 'pause', 'stats', 'achievements', 'endings'];
  for (const sec of requiredSections) {
    assert.ok(DICTIONARY.it[sec], `Sezione ${sec} presente in italiano`);
    assert.ok(DICTIONARY.en[sec], `Sezione ${sec} presente in inglese`);
  }

  // Verifica corrispondenza chiavi achievement
  const itAchKeys = Object.keys(DICTIONARY.it.achievements);
  const enAchKeys = Object.keys(DICTIONARY.en.achievements);
  assert.equal(itAchKeys.length, 12, '12 achievement tradotti in italiano');
  assert.equal(enAchKeys.length, 12, '12 achievement tradotti in inglese');
});

t('I18n: traduzione t(), interpolazione e cambio lingua', () => {
  const i18n = new I18n();
  i18n.setLanguage('it');

  assert.equal(i18n.t('menu.newGame'), 'Nuova Spedizione');
  assert.equal(i18n.t('achievements.first_strike.title'), 'Primo Granello');

  // Test interpolazione
  DICTIONARY.it.test = { greet: 'Ciao {name}, hai {amount} sabbia!' };
  assert.equal(i18n.t('test.greet', { name: 'Esploratore', amount: 50 }), 'Ciao Esploratore, hai 50 sabbia!');

  // Cambio a inglese
  i18n.setLanguage('en');
  assert.equal(i18n.getLanguage(), 'en');
  assert.equal(i18n.t('menu.newGame'), 'New Expedition');
  assert.equal(i18n.t('achievements.first_strike.title'), 'First Grain');

  // Fallback per chiave mancante
  assert.equal(i18n.t('chiave.inesistente'), 'chiave.inesistente');
});

t('StatsManager: incremento metriche e calcolo del tempo record', () => {
  const storage = new MockStorage();
  const stats = new StatsManager(storage);

  assert.equal(stats.get('totalClicks'), 0);
  assert.equal(stats.get('totalSandLifetime'), 0);
  assert.equal(stats.get('runsCompleted'), 0);
  assert.equal(stats.get('bestRunTime'), null);

  stats.increment('totalClicks', 15);
  stats.increment('totalSandLifetime', 25000);
  stats.increment('totalPlaytime', 120);
  stats.increment('ruinsUncovered', 3);

  assert.equal(stats.get('totalClicks'), 15);
  assert.equal(stats.get('totalSandLifetime'), 25000);
  assert.equal(stats.get('totalPlaytime'), 120);
  assert.equal(stats.get('ruinsUncovered'), 3);

  // Record tempo spedizione
  stats.recordRunCompletion(850);
  assert.equal(stats.get('runsCompleted'), 1);
  assert.equal(stats.get('bestRunTime'), 850);

  // Secondo completamento più lento: il record deve rimanere 850
  stats.recordRunCompletion(1100);
  assert.equal(stats.get('runsCompleted'), 2);
  assert.equal(stats.get('bestRunTime'), 850);

  // Terzo completamento più veloce: il record deve aggiornarsi
  stats.recordRunCompletion(620);
  assert.equal(stats.get('runsCompleted'), 3);
  assert.equal(stats.get('bestRunTime'), 620);

  // Test persistenza
  const reloaded = new StatsManager(storage);
  assert.equal(reloaded.get('totalClicks'), 15);
  assert.equal(reloaded.get('bestRunTime'), 620);
  assert.equal(reloaded.get('runsCompleted'), 3);
});

t('Achievements: verifica definizioni e condizioni di sblocco', () => {
  assert.equal(ACHIEVEMENT_DEFS.length, 12, 'Devono essere definiti esattamente 12 achievement');

  const state = new State();
  const storage = new MockStorage();
  const statsManager = new StatsManager(storage);
  const save = new Save(storage);

  let chimePlayed = false;
  const audio = {
    playAchievementChime: () => { chimePlayed = true; },
    playSfx: (sfx) => { if (sfx === 'achievement') chimePlayed = true; }
  };

  const ach = new Achievements({ state, statsManager, save, audio });
  ach.storage = storage;

  assert.equal(ach.getUnlockedCount(), 0);
  assert.equal(ach.getTotalCount(), 12);

  // 1. first_strike
  statsManager.increment('totalClicks', 1);
  ach.check();
  assert.ok(ach.isUnlocked('first_strike'), 'first_strike deve essere sbloccato dopo 1 colpo');
  assert.ok(chimePlayed, 'playSfx/chime deve essere invocato');

  // 2. sand_millionaire
  state.sand = 1000000;
  ach.check();
  assert.ok(ach.isUnlocked('sand_millionaire'), 'sand_millionaire deve sbloccarsi a 1.000.000 sand');

  // 3. explosive_temper
  statsManager.increment('dynamiteUsed', 10);
  ach.check();
  assert.ok(ach.isUnlocked('explosive_temper'), 'explosive_temper deve sbloccarsi con 10 dinamiti');

  // 4. automation_age
  state.upgrades = { scarab: 15, excavator: 10 };
  ach.check();
  assert.ok(ach.isUnlocked('automation_age'), 'automation_age sblocca con 25 macchinari');

  // 5. relic_resonance
  state.upgrades = { relic_resonance: 1 };
  ach.check();
  assert.ok(ach.isUnlocked('relic_resonance'), 'relic_resonance sblocca con 1 reliquia');

  // 6. first_epilogue
  save.recordEnding('curse');
  ach.check();
  assert.ok(ach.isUnlocked('first_epilogue'), 'first_epilogue sblocca con 1 finale visto');

  // 7. pantheon_master
  save.recordEnding('treasure');
  save.recordEnding('business');
  save.recordEnding('secret');
  ach.check();
  assert.ok(ach.isUnlocked('pantheon_master'), 'pantheon_master sblocca con tutti i 4 finali');

  // 8. deep_diver
  save.recordCompletedBiome('ocean');
  ach.check();
  assert.ok(ach.isUnlocked('deep_diver'), 'deep_diver sblocca completando il bioma Oceano');

  // 9. frost_breaker
  save.recordCompletedBiome('glacier');
  ach.check();
  assert.ok(ach.isUnlocked('frost_breaker'), 'frost_breaker sblocca completando il Ghiacciaio');

  // 10. jungle_pioneer
  save.recordCompletedBiome('jungle');
  ach.check();
  assert.ok(ach.isUnlocked('jungle_pioneer'), 'jungle_pioneer sblocca completando la Giungla');

  // 11. speed_demon
  statsManager.recordRunCompletion(1150); // < 1500s (25 minuti)
  ach.check();
  assert.ok(ach.isUnlocked('speed_demon'), 'speed_demon sblocca sotto i 25 minuti');

  // 12. sanctuary_ascendant
  save.addTablets(50);
  save.spendTablets(50);
  ach.check();
  assert.ok(ach.isUnlocked('sanctuary_ascendant'), 'sanctuary_ascendant sblocca con 50 tavolette spese');

  assert.equal(ach.getUnlockedCount(), 12, 'Tutti i 12 achievement devono risultare sbloccati');

  // Test persistenza
  const reloadedAch = new Achievements({ state, statsManager, save, audio });
  reloadedAch.storage = storage;
  reloadedAch.load();
  assert.equal(reloadedAch.getUnlockedCount(), 12, 'Tutti i 12 achievement devono persistere');
});

t('SettingsManager: integrazione game.language', () => {
  const storage = new MockStorage();
  const settings = new SettingsManager(storage);

  assert.equal(settings.get('game.language'), 'it', 'Default language deve essere it');
  settings.set('game.language', 'en');
  assert.equal(settings.get('game.language'), 'en', 'Language deve aggiornarsi a en');

  const reloaded = new SettingsManager(storage);
  assert.equal(reloaded.get('game.language'), 'en', 'Language deve persistere nello storage');
});

console.log(`\nFase 10 test completati: ${passed} superati con successo.\n`);

