import assert from 'node:assert/strict';
import { DirectivesManager, DIRECTIVE_TYPES, QUADRANTS } from '../js/systems/Directives.js';
import { Accessibility } from '../js/core/Accessibility.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { State } from '../js/core/State.js';
import { events } from '../js/core/Events.js';
import { HelpModal } from '../js/ui/HelpModal.js';
import { CreditsModal } from '../js/ui/CreditsModal.js';
import { i18n, DICTIONARY } from '../js/core/I18n.js';

console.log('--- TEST FASE 19: DIRETTIVE DINAMICHE, ACCESSIBILITÀ & MODALI ---');

// -------------------------------------------------------------
// Test 1: DirectivesManager - Generazione procedurale e tracciamento
// -------------------------------------------------------------
console.log('Test 1: DirectivesManager - Generazione e progresso obiettivi');
{
  const state = new State({ sand: 1000 });
  const directives = new DirectivesManager({ state });

  const d = directives.generateDirective();
  assert.ok(d.id, 'La direttiva deve avere un ID');
  assert.ok(DIRECTIVE_TYPES.includes(d.type), `Tipo direttiva sconosciuto: ${d.type}`);
  assert.ok(d.target > 0, 'Il target deve essere positivo');
  assert.ok(d.reward, 'La direttiva deve assegnare una ricompensa');
  assert.ok(['sand', 'discount', 'boost'].includes(d.reward.type), `Tipo ricompensa non valido: ${d.reward.type}`);

  // Test specifico per local_extraction
  directives.activeDirective = {
    id: 'test_local',
    type: 'local_extraction',
    quadrant: 'NE',
    target: 50,
    current: 0,
    reward: { type: 'sand', amount: 500, label: '+500 Sabbia' },
    completed: false,
    failed: false,
  };

  // Colpo nel quadrante sbagliato (NW: x < 0, z < 0)
  events.emit('dig:hit', { x: -10, y: 10, z: -10, amount: 20 });
  assert.equal(directives.activeDirective.current, 0, 'Non deve avanzare se il colpo è fuori dal quadrante');

  // Colpo nel quadrante corretto (NE: x >= 0, z < 0)
  events.emit('dig:hit', { x: 10, y: 10, z: -10, amount: 25 });
  assert.equal(directives.activeDirective.current, 25, 'Deve avanzare quando il colpo è nel quadrante NE');

  // Completamento
  const initialSand = state.sand;
  events.emit('dig:hit', { x: 10, y: 10, z: -10, amount: 25 });
  assert.equal(directives.activeDirective.completed, true, 'La direttiva deve essere marcata come completata');
  assert.equal(state.sand, initialSand + 500, 'La sabbia deve essere accreditata al completamento');

  // Test specifico per workshop_investment
  directives.activeDirective = {
    id: 'test_workshop',
    type: 'workshop_investment',
    target: 3,
    current: 0,
    reward: { type: 'discount', value: 0.15, duration: 45, label: '-15% Bottega' },
    completed: false,
    failed: false,
  };

  events.emit('upgrade:bought', { id: 'shovel', count: 2 });
  assert.equal(directives.activeDirective.current, 2, 'Deve avanzare sul conteggio acquisto upgrade');

  events.emit('upgrade:bought', { id: 'shovel', count: 1 });
  assert.equal(directives.activeDirective.completed, true, 'La direttiva deve risultare completata');
  assert.ok(directives.activeBuff, 'Il buff temporaneo deve essere attivato');
  assert.equal(directives.activeBuff.type, 'discount');
  assert.equal(state.temporaryDiscount, 0.15, 'Lo sconto temporaneo deve essere applicato sullo State');

  // Durata buff ed espirazione
  directives.update(46); // tempo superiore a 45s
  assert.equal(directives.activeBuff, null, 'Il buff deve scadere dopo 45s');
  assert.equal(state.temporaryDiscount, 0, 'Lo sconto temporaneo deve tornare a 0');

  directives.dispose();
  console.log('  ✓ Generazione contratti, tracciamento scavi/bottega e premi verificati con successo');
}

// -------------------------------------------------------------
// Test 2: Accessibilità - Reduced Motion & Smart Pause
// -------------------------------------------------------------
console.log('Test 2: Accessibilità - Reduced Motion & Sincronizzazione');
{
  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] ?? null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
  };

  const settings = new SettingsManager(mockStorage);
  let dustHidden = false;
  let shakeDisabled = false;

  const mockScene = {
    reducedMotion: false,
    running: true,
    pausedRendering: false,
    dust: {
      geometry: {
        setDrawRange(a, b) { dustHidden = (b === 0); }
      }
    },
    cameraController: {
      reducedMotion: false,
    },
    pauseRendering() { this.pausedRendering = true; },
    resumeRendering() { this.pausedRendering = false; },
  };

  const a11y = new Accessibility({ settings, sceneMgr: mockScene });

  // Attivazione Reduced Motion
  settings.set('accessibility.reducedMotion', true);
  assert.equal(a11y.reducedMotion, true, 'Accessibility.reducedMotion deve essere true');
  assert.equal(mockScene.reducedMotion, true, 'SceneManager.reducedMotion deve essere sincronizzato');
  assert.equal(mockScene.cameraController.reducedMotion, true, 'CameraController.reducedMotion deve essere sincronizzato');
  assert.equal(dustHidden, true, 'Il pulviscolo deve essere azzerato in modalità ridotta');

  // Disattivazione
  settings.set('accessibility.reducedMotion', false);
  assert.equal(a11y.reducedMotion, false, 'Accessibility.reducedMotion deve essere false');
  assert.equal(mockScene.reducedMotion, false, 'SceneManager.reducedMotion deve essere false');

  a11y.dispose();
  console.log('  ✓ Sincronizzazione Riduzione Movimento e dampening grafico verificati');
}

// -------------------------------------------------------------
// Test 3: Modali HelpModal & CreditsModal (Lifecycle & Rule 7)
// -------------------------------------------------------------
console.log('Test 3: Modali HelpModal & CreditsModal');
{
  let openOptions = null;
  let closed = false;

  const mockModalMgr = {
    open(opts) {
      openOptions = opts;
      return {
        close() { closed = true; }
      };
    }
  };

  globalThis.document = {
    createElement(tag) {
      return {
        tag,
        className: '',
        innerHTML: '',
        querySelector(sel) {
          if (sel === '.help-section' || sel === '.credits-header-banner') return {};
          return null;
        }
      };
    }
  };

  const help = new HelpModal(mockModalMgr);
  assert.equal(typeof help.close, 'function', 'HelpModal deve esporre close() pubblico');
  help.open();
  assert.ok(openOptions, 'HelpModal deve aprire un modale');
  assert.ok(openOptions.content.querySelector('.help-section'), 'HelpModal deve contenere le sezioni comandi');
  help.close();
  assert.equal(closed, true, 'help.close() deve invocare handle.close()');

  openOptions = null;
  closed = false;

  const credits = new CreditsModal(mockModalMgr);
  assert.equal(typeof credits.close, 'function', 'CreditsModal deve esporre close() pubblico');
  credits.open();
  assert.ok(openOptions, 'CreditsModal deve aprire un modale');
  assert.ok(openOptions.content.querySelector('.credits-header-banner'), 'CreditsModal deve contenere il banner crediti');
  credits.close();
  assert.equal(closed, true, 'credits.close() deve invocare handle.close()');

  delete globalThis.document;

  console.log('  ✓ Ciclo di vita modali HelpModal e CreditsModal conforme a Regola 7');
}

// -------------------------------------------------------------
// Test 4: Rigore I18n - Chiavi di traduzione complete it/en
// -------------------------------------------------------------
console.log('Test 4: Rigore Dizionari I18n');
{
  const requiredKeys = [
    'menu.help',
    'hud.help',
    'hud.helpTitle',
    'settings.reducedMotion',
    'settings.reducedMotionHint',
    'directives.widgetTitle',
    'directives.contractBadge',
    'directives.localExtractionTitle',
    'directives.continuousDiggingTitle',
    'directives.deepExcavationTitle',
    'directives.workshopInvestmentTitle',
    'help.modalTitle',
    'help.desktopTitle',
    'help.touchTitle',
    'help.gameplayTitle',
    'credits.modalTitle',
    'credits.badge',
    'credits.engineTitle',
    'credits.typographyTitle',
    'credits.assetsTitle',
    'credits.legalTitle',
  ];

  for (const lang of ['it', 'en']) {
    i18n.lang = lang;
    for (const k of requiredKeys) {
      const translated = i18n.t(k);
      assert.ok(translated && translated !== k, `Chiave mancante o non tradotta in [${lang}]: ${k}`);
    }
  }

  console.log('  ✓ Tutte le chiavi di localizzazione it ed en verificate con successo');
}

console.log('--- TUTTI I TEST UNITARI FASE 19 SUPERATI CON SUCCESSO! ---');
