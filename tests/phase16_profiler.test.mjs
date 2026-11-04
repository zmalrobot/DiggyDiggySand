// Test Unitari per la Fase 16: Suite Diagnostica Hardware, Monitor FPS/Frame Time e Profiler WebGL.
import assert from 'node:assert/strict';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { Profiler } from '../js/systems/Profiler.js';
import { ProfilerOverlay } from '../js/ui/ProfilerOverlay.js';
import { i18n } from '../js/core/I18n.js';

console.log('--- TEST FASE 16: Profiler WebGL & Diagnostica Hardware ---');

// Mock localStorage per i test
const storage = new Map();
const mockLocalStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

// 1. Test Impostazioni e Alias showProfiler / graphics.showProfiler
{
  console.log('Test 1: Impostazioni e Alias showProfiler');

  const settings = new SettingsManager(mockLocalStorage);
  assert.equal(settings.get('graphics.showProfiler'), false, 'graphics.showProfiler default è false');
  assert.equal(settings.get('showProfiler'), false, 'showProfiler alias restituisce false');

  // Aggiornamento tramite graphics.showProfiler
  let notifiedGraphics = null;
  let notifiedAlias = null;
  settings.subscribe('graphics.showProfiler', (v) => { notifiedGraphics = v; });
  settings.subscribe('showProfiler', (v) => { notifiedAlias = v; });

  settings.set('graphics.showProfiler', true);
  assert.equal(settings.get('graphics.showProfiler'), true);
  assert.equal(settings.get('showProfiler'), true);
  assert.equal(notifiedGraphics, true, 'Subscriber graphics.showProfiler notificato');
  assert.equal(notifiedAlias, true, 'Subscriber showProfiler alias notificato');

  // Aggiornamento tramite alias showProfiler
  settings.set('showProfiler', false);
  assert.equal(settings.get('graphics.showProfiler'), false);
  assert.equal(settings.get('showProfiler'), false);
  assert.equal(notifiedGraphics, false);
  assert.equal(notifiedAlias, false);

  console.log('  ✓ Schema settings e alias showProfiler bidirezionale verificati');
}

// 2. Test Profiler: Zero-Overhead quando disattivato
{
  console.log('Test 2: Profiler Zero-Overhead quando disattivato');

  const settings = new SettingsManager(mockLocalStorage);
  settings.set('graphics.showProfiler', false);

  const profiler = new Profiler({ settings, maxHistory: 60 });
  assert.equal(profiler.enabled, false, 'Profiler nasce disattivato');

  // Chiamate a vuoto
  profiler.beginFrame(100);
  profiler.endFrame(120);

  assert.equal(profiler.frameTime, 0, 'Nessun frameTime registrato se disattivato');
  assert.equal(profiler.historyCount, 0, 'Buffer circolare intonso se disattivato');

  profiler.dispose();
  console.log('  ✓ Zero overhead confermato quando profiler.enabled === false');
}

// 3. Test Profiler: Misurazioni Frame Time, Istogramma Circolare ed FPS Medi
{
  console.log('Test 3: Misurazioni Frame Time, Istogramma Circolare ed FPS');

  const mockRenderer = {
    info: {
      render: { calls: 18, triangles: 12450 },
      memory: { geometries: 32, textures: 8 },
    },
  };

  const settings = new SettingsManager(mockLocalStorage);
  settings.set('graphics.showProfiler', true);

  const profiler = new Profiler({ renderer: mockRenderer, settings, sampleWindowMs: 500, maxHistory: 60 });
  assert.equal(profiler.enabled, true, 'Profiler attivo');

  // Simula 70 frame per testare il wrap-around del buffer circolare da 60 elementi
  let simTime = 1000.0;
  for (let i = 0; i < 70; i++) {
    profiler.beginFrame(simTime);
    simTime += 16.666; // ~60 FPS
    profiler.endFrame(simTime);
  }

  const metrics = profiler.getMetrics();
  assert.equal(metrics.historyCount, 60, 'Buffer circolare limitato a max 60 elementi');
  assert.equal(metrics.history.length, 60, 'Array storico estratto ha esattamente 60 elementi');
  assert.ok(metrics.frameTime >= 16.0 && metrics.frameTime <= 17.5, `Frame time misurato coerente: ${metrics.frameTime}`);
  assert.ok(metrics.fps >= 55.0 && metrics.fps <= 65.0, `FPS calcolato coerente: ${metrics.fps}`);
  assert.ok(metrics.avgFps >= 55.0 && metrics.avgFps <= 65.0, `Avg FPS su 500ms coerente: ${metrics.avgFps}`);

  // Verifica metriche Three.js
  assert.equal(metrics.drawCalls, 18, 'Draw calls lette da renderer.info.render.calls');
  assert.equal(metrics.triangles, 12450, 'Triangles letti da renderer.info.render.triangles');
  assert.equal(metrics.geometries, 32, 'Geometries lette da renderer.info.memory.geometries');
  assert.equal(metrics.textures, 8, 'Textures lette da renderer.info.memory.textures');

  // Verifica gestione JS Heap
  assert.ok(typeof metrics.jsHeapMB === 'string', 'jsHeapMB è una stringa formattata o N/A');

  profiler.dispose();
  console.log('  ✓ Frame Time, buffer circolare 60 elementi e metriche Three.js verificate');
}

// 4. Test ProfilerOverlay: Creazione DOM, Visibilità e Sparkline
{
  console.log('Test 4: ProfilerOverlay DOM, Visibilità e Sparkline Canvas');

  // Setup mock DOM minimale per test Node
  const createdElements = [];
  const mockCanvasCtx = {
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };

  const mockCanvasEl = {
    tagName: 'CANVAS',
    width: 120,
    height: 30,
    getContext: () => mockCanvasCtx,
    classList: { add: () => {}, remove: () => {}, contains: () => false },
  };

  const mockDomParent = {
    append: (el) => createdElements.push(el),
  };

  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return mockCanvasEl;
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        dataset: {},
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, f) { if (f ?? !this.classes.has(c)) this.classes.add(c); else this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
        },
        setAttribute: () => {},
        querySelector: (sel) => {
          if (sel.includes('sparkline')) return mockCanvasEl;
          return { textContent: '', classList: { toggle: () => {} } };
        },
        remove: () => {},
      };
      return el;
    },
    body: mockDomParent,
  };

  const settings = new SettingsManager(mockLocalStorage);
  settings.set('graphics.showProfiler', false);

  const profiler = new Profiler({ settings });
  const overlay = new ProfilerOverlay({ profiler, parent: mockDomParent });

  assert.ok(overlay.el, 'Overlay DOM element creato');
  assert.equal(overlay.visible, false, 'Overlay parte non visibile se settings è false');
  assert.ok(overlay.el.classList.contains('hidden'), 'Elemento ha classe .hidden');

  // Attivazione
  overlay.setVisible(true);
  assert.equal(overlay.visible, true, 'Overlay reso visibile');
  assert.equal(overlay.el.classList.contains('hidden'), false, 'Classe .hidden rimossa');

  // Rendering sparkline con barre miste (verdi, ambra, rosse)
  let lastFillColor = null;
  mockCanvasCtx.fillRect = (x, y, w, h) => {
    lastFillColor = mockCanvasCtx.fillStyle;
  };

  overlay.update({
    fps: 58.2,
    avgFps: 59.0,
    frameTime: 16.2,
    drawCalls: 12,
    triangles: 8000,
    textures: 6,
    geometries: 20,
    jsHeapMB: '35.4',
    history: [15.0, 22.0, 42.0], // frame verde, frame ambra, frame rosso
  });

  assert.equal(lastFillColor, '#E74C3C', 'Ultimo frame > 33.3ms disegnato con colore rosso di allerta');

  overlay.destroy();
  profiler.dispose();
  globalThis.document = prevDoc;

  console.log('  ✓ ProfilerOverlay DOM, toggle visibilità e canvas sparkline verificati');
}

// 5. Test i18n Completo per il Profiler
{
  console.log('Test 5: Dizionario i18n per Profiler');

  i18n.lang = 'it';
  const labelIt = i18n.t('settings.showProfiler');
  const hintIt = i18n.t('settings.showProfilerHint');
  assert.ok(labelIt && labelIt.includes('Diagnostica'), `Label IT valida: ${labelIt}`);
  assert.ok(hintIt && hintIt.includes('F3'), `Hint IT valido: ${hintIt}`);

  i18n.lang = 'en';
  const labelEn = i18n.t('settings.showProfiler');
  const hintEn = i18n.t('settings.showProfilerHint');
  assert.ok(labelEn && labelEn.includes('Profiler'), `Label EN valida: ${labelEn}`);
  assert.ok(hintEn && hintEn.includes('F3'), `Hint EN valido: ${hintEn}`);

  i18n.lang = 'it';
  console.log('  ✓ Localizzazione bilingue IT ed EN verificata');
}

console.log('--- TUTTI I TEST DELLA FASE 16 PROFILER SUPERATI CON SUCCESSO! ---');

