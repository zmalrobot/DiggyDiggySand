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
  assert.equal(i18n.t('achievements.FIRST_DIG.title'), 'Primo Colpo d\'Oro');

  // Test interpolazione
  DICTIONARY.it.test = { greet: 'Ciao {name}, hai {amount} sabbia!' };
  assert.equal(i18n.t('test.greet', { name: 'Esploratore', amount: 50 }), 'Ciao Esploratore, hai 50 sabbia!');

  // Cambio a inglese
  i18n.setLanguage('en');
  assert.equal(i18n.getLanguage(), 'en');
  assert.equal(i18n.t('menu.newGame'), 'New Expedition');
  assert.equal(i18n.t('achievements.FIRST_DIG.title'), 'First Golden Strike');

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
  const audio = { playAchievementChime: () => { chimePlayed = true; } };

  const ach = new Achievements({ state, statsManager, save, audio });
  ach.storage = storage;

  assert.equal(ach.getUnlockedCount(), 0);
  assert.equal(ach.getTotalCount(), 12);

  // 1. FIRST_DIG
  statsManager.increment('totalClicks', 1);
  ach.check();
  assert.ok(ach.isUnlocked('FIRST_DIG'), 'FIRST_DIG deve essere sbloccato dopo 1 colpo');
  assert.ok(chimePlayed, 'playAchievementChime deve essere invocato');

  // 2. DUNE_BREAKER
  state.addSand(100000);
  ach.check();
  assert.ok(ach.isUnlocked('DUNE_BREAKER'), 'DUNE_BREAKER deve sbloccarsi a 100.000 sand');

  // 3. MACHINE_LORD
  state.upgrades = { scarab: 3, excavator: 2 };
  ach.check();
  assert.ok(ach.isUnlocked('MACHINE_LORD'), 'MACHINE_LORD sblocca con 5 macchinari');

  // 4. ECHOES_PAST
  state.completion = 0.55;
  ach.check();
  assert.ok(ach.isUnlocked('ECHOES_PAST'), 'ECHOES_PAST sblocca a >= 50% completion');

  // 5. TRINITY
  save.recordEnding('curse');
  save.recordEnding('treasure');
  save.recordEnding('business');
  ach.check();
  assert.ok(ach.isUnlocked('TRINITY'), 'TRINITY sblocca con tutti i 3 finali base');

  // 6. AWAKENING
  save.recordEnding('secret');
  ach.check();
  assert.ok(ach.isUnlocked('AWAKENING'), 'AWAKENING sblocca con finale segreto');

  // 7. SPEEDRUNNER
  statsManager.recordRunCompletion(1150); // < 1200s (20 minuti)
  ach.check();
  assert.ok(ach.isUnlocked('SPEEDRUNNER'), 'SPEEDRUNNER sblocca sotto i 20 minuti');

  // 8. SAND_HOARDER
  statsManager.increment('totalSandLifetime', 1000000);
  ach.check();
  assert.ok(ach.isUnlocked('SAND_HOARDER'), 'SAND_HOARDER sblocca a 1.000.000 lifetime sand');

  // 9. ANCIENT_WISDOM
  save.addTablets(10);
  ach.check();
  assert.ok(ach.isUnlocked('ANCIENT_WISDOM'), 'ANCIENT_WISDOM sblocca con tavolette');

  // 10. STORM_SURVIVOR
  ach._flags.eventDiggingInStorm = true;
  ach.check();
  assert.ok(ach.isUnlocked('STORM_SURVIVOR'), 'STORM_SURVIVOR sblocca durante la tempesta');

  // 11. NOMAD_PARTNER
  ach._flags.eventNomadTraded = true;
  ach.check();
  assert.ok(ach.isUnlocked('NOMAD_PARTNER'), 'NOMAD_PARTNER sblocca dopo scambio mercante');

  // 12. COMPLETIONIST
  state.completion = 1.0;
  ach.check();
  assert.ok(ach.isUnlocked('COMPLETIONIST'), 'COMPLETIONIST sblocca al 100% di scavo');

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

