// Test unitari della Fase 4: I Tre Finali Dinamici e Gestione Epiloghi
// Esecuzione: node --import ./tests/register.mjs tests/phase4.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32, pickEnding, Save } from '../js/core/Save.js';
import { EndingManager, ENDING_THRESHOLD } from '../js/endings/EndingManager.js';
import { CurseEnding } from '../js/endings/CurseEnding.js';
import { TreasureEnding } from '../js/endings/TreasureEnding.js';
import { BusinessEnding } from '../js/endings/BusinessEnding.js';
import { State } from '../js/core/State.js';
import { GALLERY_DATA } from '../js/ui/GalleryModal.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

// Mock storage in-memory per i test di Save
class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

t('mulberry32: determinismo e distribuzione PRNG', () => {
  const seed = 12345;
  const rng1 = mulberry32(seed);
  const rng2 = mulberry32(seed);

  const val1 = [rng1(), rng1(), rng1()];
  const val2 = [rng2(), rng2(), rng2()];

  assert.deepEqual(val1, val2, 'Lo stesso seed deve produrre la medesima sequenza');

  // Verifica range 0..1
  for (const v of val1) {
    assert.ok(v >= 0 && v < 1, 'Il valore PRNG deve essere compreso tra 0 e 1');
  }

  // Verifica pickEnding con seed deterministico
  const e1 = pickEnding(12345);
  const e2 = pickEnding(12345);
  assert.equal(e1, e2, 'pickEnding deve restituire lo stesso finale per il medesimo seed');
  assert.ok(['curse', 'treasure', 'business'].includes(e1));
});

t('Save: persistenza e sblocco endingsSeen', () => {
  const storage = new MemoryStorage();
  const save = new Save(storage);

  assert.deepEqual(save.getEndingsSeen(), [], 'All\'inizio nessun finale deve risultare scoperto');

  save.recordEnding('curse');
  assert.deepEqual(save.getEndingsSeen(), ['curse']);

  save.recordEnding('treasure');
  const seen = save.getEndingsSeen();
  assert.equal(seen.length, 2);
  assert.ok(seen.includes('curse') && seen.includes('treasure'));

  // Idempotenza: non duplicare
  save.recordEnding('curse');
  assert.equal(save.getEndingsSeen().length, 2);
});

t('State: tracciamento colpi (clicks) e tempo trascorso', () => {
  const state = new State();
  assert.equal(state.clicks, 0);

  state.registerClick();
  state.registerClick();
  assert.equal(state.clicks, 2);

  const s = state.toSave();
  assert.equal(s.clicks, 2);
  assert.ok(Number.isFinite(s.startTime));
});

t('CurseEnding: ciclo vitale, effetti e callback epilogo', () => {
  const ending = new CurseEnding();
  const mockScene = { scene: new THREE.Scene(), sun: { color: new THREE.Color() } };
  const mockAudio = { playCurseRumble: () => {} };

  ending.prepare({ scene: mockScene, audio: mockAudio });

  let resultData = null;
  ending.trigger((res) => { resultData = res; });

  assert.equal(ending.triggered, true);
  // Simula avanzamento temporale
  ending.update(4.0);

  assert.ok(resultData !== null, 'onFinish deve essere invocato');
  assert.equal(resultData.endingId, 'curse');
  assert.ok(resultData.title.includes('Maledizione'));
  assert.equal(resultData.badge, '☠️');

  ending.dispose();
  assert.equal(ending.triggered, false);
});

t('TreasureEnding: ciclo vitale e callback epilogo', () => {
  const ending = new TreasureEnding();
  const mockScene = { scene: new THREE.Scene(), sun: { color: new THREE.Color() } };
  const mockAudio = { playTreasureShower: () => {}, playCoinGlitter: () => {} };

  ending.prepare({ scene: mockScene, audio: mockAudio });

  let resultData = null;
  ending.trigger((res) => { resultData = res; });

  assert.equal(ending.triggered, true);
  ending.update(5.0);

  assert.ok(resultData !== null);
  assert.equal(resultData.endingId, 'treasure');
  assert.ok(resultData.title.includes('Tesoro'));
  assert.equal(resultData.badge, '👑');

  ending.dispose();
  assert.equal(ending.triggered, false);
});

t('BusinessEnding: ciclo vitale, valutazione d\'impresa e sandbox option', () => {
  const ending = new BusinessEnding();
  const mockScene = { scene: new THREE.Scene(), sun: { color: new THREE.Color() } };
  const mockAudio = { playWindWhistle: () => {}, stopAmbient: () => {} };
  const mockState = { upgrades: { scarab: 3, excavator: 2, dredge: 1 }, totalSand: 50000 };

  ending.prepare({ scene: mockScene, audio: mockAudio, state: mockState });

  let resultData = null;
  ending.trigger((res) => { resultData = res; });

  assert.equal(ending.triggered, true);
  ending.update(3.5);

  assert.ok(resultData !== null);
  assert.equal(resultData.endingId, 'business');
  assert.ok(resultData.title.includes('Impresa di Scavo'));
  assert.equal(resultData.badge, '🏗️');
  assert.ok(resultData.sandboxAvailable === true);
  assert.ok(resultData.extra.fleetCount === 6);

  ending.dispose();
  assert.equal(ending.triggered, false);
});

t('EndingManager: istanziazione corretta e trigger automatico a soglia >= 98%', () => {
  const state = new State();
  state.endingId = 'treasure';

  let overlayShown = false;
  let recordedEnding = null;

  const mockOverlay = {
    show: (data) => { overlayShown = true; },
    hide: () => {},
  };
  const mockSave = {
    recordEnding: (id) => { recordedEnding = id; },
  };

  const mgr = new EndingManager({
    scene: { scene: new THREE.Scene() },
    state,
    overlay: mockOverlay,
    save: mockSave,
  });

  assert.equal(mgr.activeEnding.id, 'treasure');

  // Avanzamento sotto la soglia (es. 75%)
  mgr.onProgress(0.75);
  assert.equal(mgr.hasTriggered, false);

  // Raggiungimento soglia 98%
  mgr.onProgress(ENDING_THRESHOLD);
  assert.equal(mgr.hasTriggered, true);

  // Simula completamento climax
  mgr.update(5.0);
  assert.equal(overlayShown, true, 'L\'overlay finale deve essere visualizzato');
  assert.equal(recordedEnding, 'treasure', 'Il finale deve essere salvato nei trofei');

  mgr.dispose();
});

t('GalleryModal: verifica metadati per tutti i 3 finali', () => {
  assert.ok(GALLERY_DATA.curse);
  assert.ok(GALLERY_DATA.treasure);
  assert.ok(GALLERY_DATA.business);

  assert.equal(Object.keys(GALLERY_DATA).length, 3);
  for (const [id, data] of Object.entries(GALLERY_DATA)) {
    assert.equal(data.id, id);
    assert.ok(data.name.length > 0);
    assert.ok(data.badge.length > 0);
    assert.ok(data.description.length > 0);
  }
});

console.log(`\nTutti i ${passed} test della Fase 4 passati con successo!`);

