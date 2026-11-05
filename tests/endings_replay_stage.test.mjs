import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EndingManager } from '../js/endings/EndingManager.js';
import { TreasureEnding } from '../js/endings/TreasureEnding.js';
import { CurseEnding } from '../js/endings/CurseEnding.js';
import { SecretEnding } from '../js/endings/SecretEnding.js';
import { BusinessEnding } from '../js/endings/BusinessEnding.js';

console.log('--- TEST REPLAY FINALI: AMBIENTE 3D & OVERLAY DI USCITA ---');

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.id = '';
    this.className = '';
    this.children = [];
    this.classList = {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, v) { if (v !== undefined) { if (v) this._classes.add(c); else this._classes.delete(c); } else { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); } },
      contains(c) { return this._classes.has(c); }
    };
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = '';
    this.parentNode = null;
  }
  setAttribute(k, v) { this.attributes.set(k, v); }
  getAttribute(k) { return this.attributes.get(k); }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  append(...items) { items.forEach(it => this.appendChild(typeof it === 'string' ? new MockElement('span') : it)); }
  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx >= 0) this.parentNode.children.splice(idx, 1);
    }
  }
  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }
  removeEventListener(event, fn) {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    }
  }
  click() {
    const fns = this.listeners.get('click') || [];
    fns.forEach(f => f({ preventDefault() {}, stopPropagation() {} }));
  }
}

const docBody = new MockElement('body');
global.document = {
  body: docBody,
  createElement(tag) { return new MockElement(tag); },
  getElementById(id) {
    const find = (el) => {
      if (el.id === id) return el;
      for (const c of el.children) {
        const found = find(c);
        if (found) return found;
      }
      return null;
    };
    return find(docBody);
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      const find = (el) => {
        if (el.classList.contains(cls) || el.className.includes(cls)) return el;
        for (const c of el.children) {
          const found = find(c);
          if (found) return found;
        }
        return null;
      };
      return find(docBody);
    }
    return null;
  }
};

const winListeners = new Map();
global.window = {
  addEventListener(e, fn) {
    if (!winListeners.has(e)) winListeners.set(e, []);
    winListeners.get(e).push(fn);
  },
  removeEventListener(e, fn) {
    const list = winListeners.get(e);
    if (list) {
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    }
  },
  triggerKey(key) {
    const fns = winListeners.get('keydown') || [];
    fns.forEach(f => f({ key, code: key, preventDefault() {}, stopPropagation() {} }));
  }
};

function createMockScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(10, 20, 10);
  scene.add(sun);
  scene.fog = new THREE.FogExp2(0x000000, 0.0035);

  return {
    scene,
    camera,
    sun,
    mode: 'menu',
    updaters: new Set(),
    setMode(m) { this.mode = m; },
    shake() {},
  };
}

const mockAudio = {
  fadeBgm() {},
  playMusic() {},
  playClick() {},
  playTreasureShower() {},
  playCurseRumble() {},
  playAscensionChime() {},
  playWindWhistle() {},
  stopAmbient() {},
};

// 1. Test Inizializzazione ReplayStage e Luci Dedicate
console.log('1. Verifica Costruzione ReplayStage Completo...');
const mockScene = createMockScene();
const endingMgr = new EndingManager({
  scene: mockScene,
  terrain: null,
  state: { totalSand: 50000, currentBiome: 'desert' },
  audio: mockAudio,
  particles: null,
  city: null,
  controls: null,
});

let replayCompleted = false;
endingMgr.playCinematic('treasure', {
  isReplay: true,
  onComplete: () => { replayCompleted = true; },
});

assert.equal(endingMgr.isReplay, true, 'isReplay deve essere true');
assert.notEqual(endingMgr._replayStageGroup, null, '_replayStageGroup deve essere creato');
assert.equal(mockScene.scene.children.includes(endingMgr._replayStageGroup), true, '_replayStageGroup deve essere aggiunto a scene');

// Verifica presenza luci sceniche
const stage = endingMgr._replayStageGroup;
const hasAmbient = stage.children.some(c => c.isAmbientLight);
const hasDir = stage.children.some(c => c.isDirectionalLight);
const hasPoint = stage.children.some(c => c.isPointLight);
assert.equal(hasAmbient, true, 'Deve esistere AmbientLight oro/ambra');
assert.equal(hasDir, true, 'Deve esistere DirectionalLight scenica');
assert.equal(hasPoint, true, 'Deve esistere PointLight d\'accento per il finale');
console.log('✓ Illuminazione scenica dedicata verificata con successo');

// 2. Verifica Pavimento Archeologico a Y=0 e Cratere Scavato al 100%
console.log('2. Verifica Pavimento Y=0, Cratere 100% e Rovine...');
const meshes = [];
stage.traverse(c => { if (c.isMesh) meshes.push(c); });
assert.ok(meshes.length >= 15, `Dovrebbero esserci almeno 15 mesh per basamento, gradoni e colonne, trovate: ${meshes.length}`);

// Verifica inquadratura telecamera a prospettiva rialzata
assert.equal(mockScene.camera.position.y, 8, 'Camera Y deve essere a 8');
assert.equal(mockScene.camera.position.z, 14, 'Camera Z deve essere a 14');
console.log(`✓ Scenografia 3D archeologica e inquadratura (0, 8, 14) verificate (${meshes.length} mesh)`);

// 3. Verifica Overlay di Uscita Replay DOM
console.log('3. Verifica Overlay di Uscita Replay (#replay-hud-overlay)...');
const overlayEl = document.getElementById('replay-hud-overlay');
assert.notEqual(overlayEl, null, '#replay-hud-overlay deve essere presente nel DOM');
const btnExit = document.getElementById('btn-exit-replay');
assert.notEqual(btnExit, null, '#btn-exit-replay deve essere presente nel DOM');
console.log('✓ Overlay di uscita e pulsante #btn-exit-replay verificati nel DOM');

// 4. Verifica Uscita Replay con Click o ESC
console.log('4. Verifica Chiusura e Pulizia Memoria ReplayStage...');
btnExit.click();

setTimeout(() => {
  assert.equal(document.getElementById('replay-hud-overlay'), null, 'Overlay deve essere rimosso');
  assert.equal(endingMgr._replayStageGroup, null, '_replayStageGroup deve essere deallocato');
  assert.equal(endingMgr.isReplay, false, 'isReplay deve tornare false');
  console.log('✓ Uscita replay e deallocazione profonda verificate al 100%');

  // 5. Verifica Fisica Rimbalzo Monete TreasureEnding
  console.log('5. Verifica Fisica Rimbalzo Monete (Y >= 0.12)...');
  const treasure = new TreasureEnding();
  treasure.prepare({ scene: mockScene, terrain: null, audio: mockAudio });
  treasure.trigger(() => {});

  assert.equal(treasure.lootItems.length, 65, 'Devono essere presenti 65 loot items');
  for (const it of treasure.lootItems) {
    assert.ok(it.floorY >= 0.12, `floorY deve essere >= 0.12, trovato ${it.floorY}`);
  }

  // Simula 4 secondi di caduta e rimbalzo
  for (let s = 0; s < 40; s++) {
    treasure.update(0.1);
  }

  for (const it of treasure.lootItems) {
    assert.ok(it.mesh.position.y >= 0.12, `La moneta/gemma non deve cadere sotto il pavimento (${it.mesh.position.y})`);
  }
  console.log('✓ Fisica caduta e collisione monete a Y >= 0.12 convalidata');

  // 6. Test Replay per tutti i 4 Finali
  console.log('6. Test Replay Completo per i 4 Finali (Curse, Treasure, Secret, Business)...');
  const endings = ['curse', 'treasure', 'secret', 'business'];
  for (const id of endings) {
    endingMgr.playCinematic(id, { isReplay: true });
    assert.notEqual(endingMgr._replayStageGroup, null, `Replay stage per ${id} deve esistere`);
    endingMgr.update(0.016);
    endingMgr.disposeReplay();
    assert.equal(endingMgr._replayStageGroup, null, `Replay stage per ${id} deve essere smantellato`);
  }
  console.log('✓ Tutti e 4 i finali riprodotti e smantellati senza errori');

  console.log('========================================');
  console.log('TUTTI I TEST DEL REPLAY STAGE SUPERATI AL 100%!');
  console.log('========================================');
}, 450);
