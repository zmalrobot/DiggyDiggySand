// Test unitari della Fase 5: Polish Generale, Touch/Mobile, Tutorial & Performance
// Esecuzione: node --import ./tests/register.mjs tests/phase5.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Particles } from '../js/world/Particles.js';
import { AudioEngine } from '../js/core/AudioEngine.js';
import { State } from '../js/core/State.js';
import { Tutorial } from '../js/ui/Tutorial.js';
import { PauseMenu } from '../js/ui/PauseMenu.js';
import { Digging } from '../js/systems/Digging.js';
import { events } from '../js/core/Events.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

t('Particles: Object Pool limitato a max 300 particelle e throttling worker', () => {
  const mockSettings = {
    get: (k) => 'high',
    subscribe: () => () => {},
  };
  const p = new Particles(mockSettings);

  assert.ok(p.capacity <= 300, `La capacità massima del pool (${p.capacity}) deve essere <= 300`);
  assert.equal(p.alive, 0);

  // Emette burst iniziale
  p.burst(0, 5, 0, { radius: 1.5 });
  const countBefore = p.alive;
  assert.ok(countBefore > 0);

  // Imposta 8 lavoratori attivi e verifica il throttling
  p.setWorkerCount(8);
  assert.equal(p.activeWorkers, 8);

  p.burst(0, 5, 0, { radius: 1.5 });
  // Il pool non deve mai superare la capacità
  assert.ok(p.alive <= p.capacity);

  // Aggiornamento senza errori
  p.update(0.016);
  p.dispose();
});

t('AudioEngine: modulazione della profondità di scavo (setDepth)', () => {
  const mockSettings = {
    get: () => 80,
    subscribe: () => () => {},
  };
  const audio = new AudioEngine(mockSettings);

  // Mock contesto audio
  const mockParam = (init = 0) => ({
    value: init,
    setTargetAtTime: function(v) { this.value = v; },
  });
  audio.ctx = {
    currentTime: 1.0,
    state: 'running',
  };
  audio.ambientFilters = {
    lp: { frequency: mockParam(320) },
    droneGain: { gain: mockParam(0.05) },
    bp: { frequency: mockParam(380) },
  };

  // In superficie (Y=12)
  audio.setDepth(12);
  assert.equal(audio.ambientFilters.lp.frequency.value, 340);
  assert.equal(audio.ambientFilters.droneGain.gain.value, 0.04);

  // A fondo roccioso (Y=0)
  audio.setDepth(0);
  assert.equal(audio.ambientFilters.lp.frequency.value, 150);
  assert.ok(audio.ambientFilters.droneGain.gain.value > 0.1, 'Il drone cavernoso deve essere più forte');
});

t('State: salvataggio e flag tutorialDone', () => {
  const state = new State();
  assert.equal(state.tutorialDone, false);

  state.tutorialDone = true;
  const s = state.toSave();
  assert.equal(s.tutorialDone, true);

  const state2 = new State();
  state2.reset(s);
  assert.equal(state2.tutorialDone, true);
});

t('Tutorial: ciclo di vita dell\'onboarding guidato', () => {
  const state = new State();
  state.sand = 0;
  state.totalSand = 0;
  state.tutorialDone = false;

  const root = { appendChild: () => {}, removeChild: () => {} };
  const tut = new Tutorial(root, { state });

  // 1. Avvio: deve andare a Step 1 (tocca per scavare)
  tut.start();
  assert.equal(tut.step, 1);

  // 2. Colpo di pala andato a segno: avanza a Step 2 (valuta sabbia)
  events.emit('dig:hit', { amount: 1 });
  assert.equal(tut.step, 2);

  // 3. Raggiunge 10 sand: avanza a Step 3 (officina pronta)
  state.sand = 10;
  events.emit('sand:changed', { sand: 10, delta: 10 });
  assert.equal(tut.step, 3);

  // 4. Apertura officina: completa il tutorial
  events.emit('hud:shop');
  assert.equal(tut.step, 4);
  assert.equal(state.tutorialDone, true);

  // 5. Riavvio: con tutorialDone = true non deve ripartire
  tut.start();
  assert.equal(tut.step, 4);

  tut.dispose();
});

t('PauseMenu: gestione pausa in-game e impostazioni rapide', () => {
  let paused = false;
  let menuExited = false;
  const mockGame = {
    _setPaused: (p) => { paused = p; },
    returnToMenu: () => { menuExited = true; },
    state: { sand: 100, elapsedSeconds: 45 },
  };
  const mockSettings = {
    get: (k) => (k === 'audio.mute' ? false : k === 'audio.master' ? 70 : 'high'),
    set: (k, v) => {},
  };

  const root = { appendChild: () => {}, removeChild: () => {} };
  const pause = new PauseMenu(root, { game: mockGame, settings: mockSettings });

  // Apertura pausa
  pause.open();
  assert.equal(pause.isOpen, true);
  assert.equal(paused, true);

  // Chiusura pausa
  pause.close();
  assert.equal(pause.isOpen, false);
  assert.equal(paused, false);

  pause.dispose();
});

t('Digging: gestione touch singolo vs multi-dito (gestures)', () => {
  const mockCanvas = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    style: {},
  };
  const state = new State();
  const dig = new Digging({
    canvas: mockCanvas,
    scene: { camera: new THREE.PerspectiveCamera(), shake: () => {} },
    state,
    audio: { playDigSound: () => {} },
    particles: { burst: () => {} },
  });

  assert.equal(mockCanvas.style.touchAction, 'none');

  // Simula tocco singolo
  dig.enabled = true;
  dig._onDown({ pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 300 });
  assert.equal(dig.holding, true);
  assert.equal(dig.primaryId, 1);
  assert.equal(dig.multi, false);

  // Simula arrivo del secondo dito (pinch/drag per la camera)
  dig._onDown({ pointerId: 2, pointerType: 'touch', clientX: 450, clientY: 320 });
  assert.equal(dig.multi, true, 'Con due dita lo scavo deve disattivarsi per lasciare la camera a OrbitControls');
  assert.equal(dig.holding, false);

  dig.dispose();
});

console.log(`\nTutti i ${passed} test della Fase 5 passati con successo!`);

