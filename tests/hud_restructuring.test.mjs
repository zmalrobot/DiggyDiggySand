import assert from 'node:assert/strict';
import { Hud, formatNumber, formatPercent } from '../js/ui/Hud.js';
import { State } from '../js/core/State.js';
import { events } from '../js/core/Events.js';

console.log('--- TEST RISTRUTTURAZIONE LAYOUT HUD: METRICHE, DOCK & SIGILLO TRUCCHI ---');

// Mock DOM
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.classList = new Set();
    this.attributes = new Map();
    this.style = {
      setProperty: (k, v) => { this.style[k] = v; },
    };
    this.innerHTML = '';
    this.textContent = '';
  }

  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  addEventListener() {}
  removeEventListener() {}
}

// In ambiente node con JSDOM o simulazione DOM per Hud
const { JSDOM } = await import('jsdom').catch(() => ({ JSDOM: null }));

if (JSDOM) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="hud"></div></body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const state = new State();
  state.sand = 12500;
  state.completion = 0.425;
  state.cheatsEnabled = false;

  const hudRoot = document.getElementById('hud');
  const hud = new Hud(hudRoot, { state, economy: { sps: 350 } });

  // 1. Verifica Struttura Top-Center (Metriche)
  const metricsCenter = hudRoot.querySelector('#hud-metrics-center');
  assert(metricsCenter, 'Container #hud-metrics-center presente');
  assert(metricsCenter.classList.contains('hud-top-center'), 'Classe .hud-top-center presente');

  const sandCounter = hudRoot.querySelector('#sand-counter');
  assert(sandCounter, '#sand-counter presente');
  assert.equal(sandCounter.textContent, formatNumber(12500));

  const sandRate = hudRoot.querySelector('#sand-rate');
  assert(sandRate, '#sand-rate presente');
  assert.equal(sandRate.textContent, '+350/s');

  const completionPct = hudRoot.querySelector('#completion-pct');
  assert(completionPct, '#completion-pct presente');
  assert.equal(completionPct.textContent, formatPercent(0.425));

  const completionBar = hudRoot.querySelector('#completion-bar');
  assert(completionBar, '#completion-bar presente');

  // 2. Verifica Struttura Bottom-Center (Dock)
  const bottomDock = hudRoot.querySelector('#hud-bottom-dock');
  assert(bottomDock, 'Container #hud-bottom-dock presente');
  assert(bottomDock.classList.contains('hud-bottom-center'), 'Classe .hud-bottom-center presente');

  const btnHelp = hudRoot.querySelector('#btn-help');
  const btnShop = hudRoot.querySelector('#btn-shop');
  const btnPause = hudRoot.querySelector('#btn-pause');
  assert(btnHelp, '#btn-help presente');
  assert(btnShop, '#btn-shop presente');
  assert(btnPause, '#btn-pause presente');
  assert(btnShop.classList.contains('hud-dock-btn-primary'), '#btn-shop ha classe .hud-dock-btn-primary');

  // 3. Verifica Struttura Bottom-Right (Sigillo Trucchi)
  const cheatsZone = hudRoot.querySelector('#hud-cheats-zone');
  assert(cheatsZone, 'Container #hud-cheats-zone presente');
  assert(cheatsZone.classList.contains('hud-bottom-right'), 'Classe .hud-bottom-right presente');

  const btnCheats = hudRoot.querySelector('#btn-cheats-toggle');
  assert(btnCheats, '#btn-cheats-toggle presente');
  assert(btnCheats.classList.contains('cheats-sigil-btn'), 'Pulsante con classe .cheats-sigil-btn');
  assert(btnCheats.querySelector('.cheats-sigil-icon'), 'Icona .cheats-sigil-icon presente');
  assert(btnCheats.querySelector('.cheats-pulse-ring'), 'Anello .cheats-pulse-ring presente');

  // Verifica stato trucchi disattivo
  assert(!btnCheats.classList.contains('cheats-active'), 'Non ha classe .cheats-active di default');

  // Attivazione trucchi e refresh
  state.cheatsEnabled = true;
  hud.refresh();
  assert(btnCheats.classList.contains('cheats-active'), 'Pulsante ha classe .cheats-active dopo abilitazione');

  // 4. Test Eventi al Click
  let clickedShop = false;
  let clickedHelp = false;
  let clickedPause = false;
  let clickedCheats = false;

  events.on('hud:shop', () => { clickedShop = true; });
  events.on('hud:help', () => { clickedHelp = true; });
  events.on('hud:menu', () => { clickedPause = true; });
  events.on('hud:cheats', () => { clickedCheats = true; });

  btnShop.click();
  btnHelp.click();
  btnPause.click();
  btnCheats.click();

  assert(clickedShop, 'Evento hud:shop scatenato al click');
  assert(clickedHelp, 'Evento hud:help scatenato al click');
  assert(clickedPause, 'Evento hud:menu scatenato al click');
  assert(clickedCheats, 'Evento hud:cheats scatenato al click');

  hud.dispose();
  console.log('✓ Tutte le verifiche unitarie DOM, dock, metriche e sigillo trucchi superate con successo!');
} else {
  console.log('JSDOM non installato, test saltato in node puro.');
}
