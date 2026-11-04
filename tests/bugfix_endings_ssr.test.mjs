// Test unitario per Bugfix: Cutscene 3D "Rivivi Epilogo", Galleria Finali e Pipeline Raytracing SSR
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EndingsModal, ENDINGS_CATALOG } from '../js/ui/EndingsModal.js';
import { EndingManager } from '../js/endings/EndingManager.js';
import { PostProcessing, SSRShader } from '../js/world/PostProcessing.js';
import { SettingsManager } from '../js/core/SettingsManager.js';

console.log('--- TEST BUGFIX: RIVIVI EPILOGO, GALLERIA & RAYTRACING SSR ---');

// Mock DOM
const createdElements = [];
globalThis.document = {
  body: {
    appendChild(el) { createdElements.push(el); },
    append(el) { createdElements.push(el); },
  },
  createElement(tag) {
    const listeners = {};
    const classes = new Set();
    const el = {
      tagName: tag.toUpperCase(),
      classList: {
        add(...c) { c.forEach((x) => classes.add(x)); },
        remove(...c) { c.forEach((x) => classes.delete(x)); },
        contains(c) { return classes.has(c); },
        toggle(c, v) { if (v ?? !classes.has(c)) classes.add(c); else classes.delete(c); },
      },
      style: {},
      dataset: {},
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      addEventListener(evt, fn) {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      dispatchEvent(evt) {
        listeners[evt.type]?.forEach((f) => f(evt));
      },
      closest(sel) {
        if (sel.includes('data-replay-ending') && el.dataset.replayEnding) return el;
        if (sel.includes('btn-replay-ending') && classes.has('btn-replay-ending')) return el;
        return null;
      },
      remove() {
        const idx = createdElements.indexOf(el);
        if (idx !== -1) createdElements.splice(idx, 1);
      },
      set innerHTML(val) { this._html = val; },
      get innerHTML() { return this._html || ''; },
      querySelector(sel) {
        if (sel === '.screen-fade') {
          return createdElements.find((e) => e.classList.contains('screen-fade')) || null;
        }
        return null;
      },
      querySelectorAll() { return []; },
    };
    return el;
  },
  querySelector(sel) {
    if (sel === '.screen-fade') {
      return createdElements.find((e) => e.classList.contains('screen-fade')) || null;
    }
    return null;
  },
  querySelectorAll() { return []; },
  getElementById(id) { return null; },
};

// Mock ModalManager
class MockModalManager {
  constructor() {
    this.opened = [];
  }
  open(config) {
    const handle = {
      config,
      close: () => {
        const idx = this.opened.indexOf(handle);
        if (idx !== -1) this.opened.splice(idx, 1);
        config.onClose?.();
      },
    };
    this.opened.push(handle);
    return handle;
  }
}

// Mock Save
class MockSave {
  constructor() {
    this.seen = ['curse', 'treasure'];
  }
  getEndingsSeen() { return this.seen; }
  getEndingUnlockDate(id) { return Date.now(); }
}

// 1. Test Galleria Finali: layout DOM e classi CSS
{
  console.log('Test 1: Galleria Finali - Layout DOM e Classi');
  const modal = new MockModalManager();
  const save = new MockSave();
  const gallery = new EndingsModal(modal, save);

  gallery.open();
  assert.equal(modal.opened.length, 1, 'Modale aperto');
  assert.ok(gallery.wrap.innerHTML.includes('endings-gallery-list'), 'Lista include classe endings-gallery-list');
  assert.ok(gallery.wrap.innerHTML.includes('ending-card'), 'Card include classe ending-card');
  assert.ok(gallery.wrap.innerHTML.includes('ending-title'), 'Card include classe ending-title');
  assert.ok(gallery.wrap.innerHTML.includes('ending-watermark'), 'Card include classe ending-watermark');
  assert.ok(gallery.wrap.innerHTML.includes('is-locked'), 'Card bloccata include classe is-locked');
  assert.ok(gallery.wrap.innerHTML.includes('btn-replay-ending'), 'Pulsante replay include classe btn-replay-ending');

  gallery.close();
  assert.equal(modal.opened.length, 0, 'Modale chiuso correttamente');
  console.log('  ✓ Layout Galleria, classi CSS e pulizia nodi verificate');
}

// 2. Test Replay Cutscene 3D e Skip Epilogo
{
  console.log('Test 2: Replay Cutscene 3D e Salta Epilogo');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0035);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  const mockSceneMgr = {
    scene,
    camera,
    sun,
    mode: 'menu',
    updaters: new Set(),
    setMode(m) { this.mode = m; },
    shake() {},
  };

  const audio = {
    playClick() {},
    fadeBgm() {},
    playCurseRumble() {},
    playTreasureShower() {},
    playWindWhistle() {},
    stopAmbient() {},
    playAscensionChime() {},
    playMusic() {},
  };

  const mockGame = {
    sceneMgr: mockSceneMgr,
    audio,
    state: { currentBiome: 'desert' },
    running: false,
    digging: { setEnabled() {} },
  };

  const endingMgr = new EndingManager({
    scene: mockSceneMgr,
    state: mockGame.state,
    audio,
    game: mockGame,
  });
  mockGame.endingManager = endingMgr;

  // Avvia cutscene replay per "curse"
  let completed = false;
  endingMgr.playCinematic('curse', { isReplay: true, onComplete: () => { completed = true; } });

  assert.equal(endingMgr.isReplay, true, 'isReplay attivo');
  assert.equal(endingMgr.hasTriggered, true, 'hasTriggered attivo');
  assert.equal(mockSceneMgr.mode, 'game', 'Scene passata in game per rendering 3D');
  assert.ok(endingMgr._skipBtn, 'Pulsante "✕ Salta Epilogo" creato nel DOM');
  assert.equal(endingMgr._skipBtn.textContent, '✕ Salta Epilogo');

  // Verifica aggiornamento camera orbitale e target Y specifico
  assert.equal(endingMgr._orbitTargetY, 4, 'Target Y per la Maledizione impostato correttamente a 4');
  const startAngle = endingMgr._orbitAngle;
  endingMgr.update(0.1);
  assert.notEqual(endingMgr._orbitAngle, startAngle, 'Angolo orbita camera aggiornato durante update');

  // Clicca "✕ Salta Epilogo"
  endingMgr._skipBtn.dispatchEvent({ type: 'click' });

  // Simula timeout di transizione dissolve
  setTimeout(() => {
    assert.equal(endingMgr.isReplay, false, 'isReplay resettato');
    assert.equal(endingMgr._skipBtn, null, 'Pulsante rimosso dal DOM');
    assert.equal(mockSceneMgr.mode, 'menu', 'Modalità scena menu ripristinata');
    console.log('  ✓ Ciclo vitale Cutscene 3D, orbita e rimozione DOM Salta Epilogo verificati');
  }, 450);
}

// 3. Test Pipeline Raytracing SSR & Settings
{
  console.log('Test 3: Pipeline Raytracing SSR & Sincronizzazione Settings');

  class MockRenderer {
    constructor() {
      this._size = new THREE.Vector2(800, 600);
      this._target = null;
    }
    getSize(t) { t.copy(this._size); return t; }
    getPixelRatio() { return 1; }
    getRenderTarget() { return this._target; }
    setRenderTarget(t) { this._target = t; }
    clear() {}
    render() {}
  }

  const storage = new Map();
  const mockStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  const settings = new SettingsManager(mockStorage);

  assert.equal(settings.raytracingSSR, false, 'settings.raytracingSSR getter iniziale è false');
  settings.raytracingSSR = true;
  assert.equal(settings.raytracingSSR, true, 'settings.raytracingSSR setter aggiorna correttamente');
  assert.equal(settings.get('graphics.raytracingSSR'), true);

  const renderer = new MockRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 500);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);

  const post = new PostProcessing(renderer, scene, camera, settings);
  assert.ok(post.ssrPass, 'ssrPass alias esposto');
  assert.equal(typeof post.setSSR, 'function', 'setSSR metodo esposto');
  assert.equal(typeof post.update, 'function', 'update metodo esposto');

  post.setSSR(true);
  assert.equal(post.raytracingSSREnabled, true);
  assert.equal(post.ssrPass.enabled, true);
  assert.ok(post.renderTarget.depthTexture.type === THREE.UnsignedShortType || post.renderTarget.depthTexture.type === THREE.UnsignedIntType, 'depthTexture.type valida');
  assert.equal(post.composer.renderTarget1.depthTexture, post.renderTarget.depthTexture, 'composer.renderTarget1.depthTexture assegnata');
  assert.equal(post.composer.renderTarget2.depthTexture, post.renderTarget.depthTexture, 'composer.renderTarget2.depthTexture assegnata');

  post.update(0.016);
  assert.equal(post.postMaterial.uniforms.cameraNear.value, 0.5);
  assert.equal(post.postMaterial.uniforms.cameraFar.value, 500);
  assert.ok(post.postMaterial.uniforms.cameraMatrixWorld.value.equals(camera.matrixWorld), 'cameraMatrixWorld aggiornato');
  assert.ok(post.ssrPass.uniforms.projectionMatrix.value.equals(camera.projectionMatrix), 'projectionMatrix uniforme sincronizzata');
  assert.ok(post.ssrPass.uniforms.inverseProjectionMatrix.value.equals(camera.projectionMatrixInverse), 'inverseProjectionMatrix uniforme sincronizzata');

  post.setSSR(false);
  assert.equal(post.raytracingSSREnabled, false);
  assert.equal(post.ssrPass.enabled, false);

  assert.ok(SSRShader, 'SSRShader esportato correttamente');
  assert.ok(SSRShader.fragmentShader.includes('isExcavatedEdge'), 'SSRShader include rilevamento bordi scavati');
  console.log('  ✓ Pipeline Raytracing SSR, ssrPass, setSSR, cameraMatrixWorld verificati');
}

console.log('--- TUTTI I TEST DEL BUGFIX SUPERATI CON SUCCESSO ---');
