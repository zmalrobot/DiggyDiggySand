// Test unitari della Fase 7: Debug Console Suite, Memory Audit e WebGL Cleanup
// Esecuzione: node --import ./tests/register.mjs tests/phase7.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { State } from '../js/core/State.js';
import { Save } from '../js/core/Save.js';
import { DebugTools } from '../js/core/DebugTools.js';
import { Terrain } from '../js/world/Terrain.js';
import { City } from '../js/world/City.js';
import { Workers } from '../js/systems/Workers.js';
import { Digging } from '../js/systems/Digging.js';
import { Particles } from '../js/world/Particles.js';
import { UPGRADE_CATALOG } from '../js/systems/Upgrades.js';

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

t('DebugTools: registrazione API globale e comandi cheat', () => {
  const state = new State();
  state.reset();
  const save = new Save(new MemoryStorage());
  const terrain = new Terrain({ size: 60, res: 16 });
  const game = {
    state,
    save,
    terrain,
    workers: { syncWithUpgrades: () => {} },
    shop: { refresh: () => {} },
    economy: { recalculateSPS: () => {} },
    endingManager: { forceEnding: (id) => { state.endingId = id; } },
    worldEvents: { triggerEvent: (type) => { state.lastEvent = type; } },
  };

  const debug = new DebugTools({ game, state, save, root: null });
  assert.ok(globalThis.window.DDS_DEBUG, 'window.DDS_DEBUG deve essere esposto');

  const api = globalThis.window.DDS_DEBUG;

  // 1. addSand
  api.addSand(5000);
  assert.equal(state.sand, 5000);

  // 2. setCompletion
  api.setCompletion(0.85);
  assert.equal(state.completion, 0.85);
  assert.ok(terrain.remainingVolume < terrain.initialVolume);

  // 3. forceEnding
  api.forceEnding('treasure');
  assert.equal(state.endingId, 'treasure');

  // 4. triggerEvent
  api.triggerEvent('sandstorm');
  assert.equal(state.lastEvent, 'sandstorm');

  // 5. unlockAllUpgrades
  api.unlockAllUpgrades();
  for (const [id, def] of Object.entries(UPGRADE_CATALOG)) {
    assert.equal(state.upgrades[id], def.maxLevel);
  }

  // 6. addTablets
  api.addTablets(15);
  assert.equal(save.getTablets(), 15);
  assert.equal(state.tablets, 15);

  // 7. unlockAllEndings
  api.unlockAllEndings();
  assert.equal(save.getEndingsSeen().length, 4);

  debug.dispose();
});

t('Memory Audit: Terrain.dispose rilascia geometria e materiali', () => {
  const terrain = new Terrain({ size: 40, res: 16 });
  let geoDisposed = false;
  let matDisposed = false;

  terrain.geometry.addEventListener('dispose', () => { geoDisposed = true; });
  terrain.material.addEventListener('dispose', () => { matDisposed = true; });

  terrain.dispose();
  assert.ok(geoDisposed, 'La geometria del terreno deve essere rilasciata');
  assert.ok(matDisposed, 'Il materiale del terreno deve essere rilasciato');
});

t('Memory Audit: City.dispose rilascia tutti gli edifici e geroglifici', () => {
  const city = new City({ endingId: 'curse' });
  let meshCount = 0;
  let disposedCount = 0;

  city.group.traverse((o) => {
    if (o.isMesh) {
      meshCount++;
      o.geometry.addEventListener('dispose', () => { disposedCount++; });
    }
  });

  assert.ok(meshCount > 0, 'La città deve contenere edifici procedurali');
  city.dispose();
  assert.equal(disposedCount, meshCount, 'Tutte le geometrie degli edifici devono essere rilasciate');
});

t('Memory Audit: Workers.dispose e syncWithUpgrades rilasciano le mesh', () => {
  const state = new State();
  state.reset({ upgrades: { scarab: 3 } });
  const terrain = new Terrain({ size: 40, res: 16 });
  const workers = new Workers({ terrain, state, particles: { burst: () => {} } });

  assert.equal(workers.workers.length, 3);
  let disposedCount = 0;
  for (const w of workers.workers) {
    w.mesh.traverse((o) => {
      if (o.isMesh) o.geometry.addEventListener('dispose', () => { disposedCount++; });
    });
  }

  // Riduci upgrade a 1 scarabeo: i 2 in eccesso devono essere rimossi e rilasciati
  workers.syncWithUpgrades({ scarab: 1 });
  assert.equal(workers.workers.length, 1);
  assert.ok(disposedCount > 0, 'I lavoratori rimossi devono essere rilasciati dalla GPU');

  // Dispose finale
  workers.dispose();
  assert.equal(workers.workers.length, 0);
});

t('Memory Audit: Particles.dispose rilascia mesh istanziata', () => {
  const settings = { get: () => 'high', subscribe: () => () => {} };
  const particles = new Particles(settings);
  let geoDisposed = false;
  let matDisposed = false;

  particles.mesh.geometry.addEventListener('dispose', () => { geoDisposed = true; });
  particles.mesh.material.addEventListener('dispose', () => { matDisposed = true; });

  particles.dispose();
  assert.ok(geoDisposed, 'Geometria particellare rilasciata');
  assert.ok(matDisposed, 'Materiale particellare rilasciato');
});

t('Memory Audit: Digging.dispose rilascia reticolo e rimuove listener', () => {
  const canvas = {
    addEventListener: () => {},
    removeEventListener: () => {},
    style: {},
  };
  const digging = new Digging({
    canvas,
    scene: { camera: new THREE.PerspectiveCamera(), shake: () => {} },
    state: new State(),
    audio: { playDigSound: () => {} },
    particles: { burst: () => {} },
  });

  let geoDisposed = false;
  digging.reticle.geometry.addEventListener('dispose', () => { geoDisposed = true; });

  digging.dispose();
  assert.ok(geoDisposed, 'Geometria del reticolo di scavo rilasciata');
});

t('DebugTools: getMemoryReport calcola report accurato', () => {
  const fakeRenderer = {
    info: {
      render: { calls: 14, triangles: 4200 },
      memory: { geometries: 18, textures: 4 },
    },
  };
  const debug = new DebugTools({
    scene: { renderer: fakeRenderer },
    game: { particles: { alive: 45 } },
    root: null,
  });

  const rep = debug.getMemoryReport();
  assert.equal(rep.drawCalls, 14);
  assert.equal(rep.triangles, 4200);
  assert.equal(rep.geometries, 18);
  assert.equal(rep.textures, 4);
  assert.equal(rep.activeParticles, 45);

  debug.dispose();
});

console.log(`\nFase 7: tutti i ${passed} test sono passati con successo!`);
