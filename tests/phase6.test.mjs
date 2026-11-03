// Test unitari della Fase 6: Meta-Progressione, Eventi Spontanei e Finale Segreto
// Esecuzione: node --import ./tests/register.mjs tests/phase6.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pickEnding, Save } from '../js/core/Save.js';
import { State } from '../js/core/State.js';
import {
  META_UPGRADES,
  calculateTabletsEarned,
  getMetaUpgradeCost,
  canAffordMetaUpgrade,
  buyMetaUpgrade,
} from '../js/systems/Prestige.js';
import { UPGRADE_CATALOG, getUpgradeCost, canAffordUpgrade, buyUpgrade } from '../js/systems/Upgrades.js';
import { SecretEnding } from '../js/endings/SecretEnding.js';
import { WorldEvents } from '../js/systems/WorldEvents.js';
import { events } from '../js/core/Events.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

t('Prestige: formula calcolo Tavolette Antiche τ', () => {
  assert.equal(calculateTabletsEarned(0), 5, 'Base 5 tavolette con 0 sabbia');
  assert.equal(calculateTabletsEarned(100000), 6, '100k sabbia = sqrt(1) + 5 = 6 tavolette');
  assert.equal(calculateTabletsEarned(400000), 7, '400k sabbia = sqrt(4) + 5 = 7 tavolette');
  assert.equal(calculateTabletsEarned(900000), 8, '900k sabbia = sqrt(9) + 5 = 8 tavolette');
  assert.equal(calculateTabletsEarned(1600000), 9, '1.6M sabbia = sqrt(16) + 5 = 9 tavolette');
});

t('Save: persistenza Tavolette Antiche e Meta-Upgrade', () => {
  const storage = new MemoryStorage();
  const save = new Save(storage);

  assert.equal(save.getTablets(), 0);
  assert.deepEqual(save.getMetaUpgrades(), {});

  save.addTablets(12);
  assert.equal(save.getTablets(), 12);

  const spentOk = save.spendTablets(5);
  assert.ok(spentOk);
  assert.equal(save.getTablets(), 7);

  const spentFail = save.spendTablets(10);
  assert.ok(!spentFail);
  assert.equal(save.getTablets(), 7);

  save.setMetaUpgrade('shovelEcho', 1);
  assert.equal(save.getMetaUpgrades().shovelEcho, 1);

  // Verifica persistenza dopo nuovo caricamento
  const save2 = new Save(storage);
  assert.equal(save2.getTablets(), 7);
  assert.equal(save2.getMetaUpgrades().shovelEcho, 1);
});

t('Prestige: acquisto meta-perk, sconti e moltiplicatori', () => {
  const storage = new MemoryStorage();
  const save = new Save(storage);
  save.addTablets(50);

  const state = new State();
  state.reset({ metaUpgrades: save.getMetaUpgrades(), tablets: save.getTablets() });

  // Shovel Echo: Costo base 3, moltiplicatore 1.6 -> Lv 0: 3, Lv 1: floor(4.8) = 4
  const def = META_UPGRADES.shovelEcho;
  assert.equal(getMetaUpgradeCost(def, 0), 3);
  assert.equal(getMetaUpgradeCost(def, 1), 4);
  assert.ok(canAffordMetaUpgrade('shovelEcho', save));

  const bought = buyMetaUpgrade('shovelEcho', save, state);
  assert.ok(bought);
  assert.equal(save.getTablets(), 47);
  assert.equal(state.metaUpgrades.shovelEcho, 1);
  // Potenza scavo base: 1 * (1 + 0.15) = 1.15
  assert.equal(state.stats.power, 1.15);

  // Tablet Magnetism: -5% per livello
  buyMetaUpgrade('tabletMagnetism', save, state);
  assert.equal(state.costDiscount, 0.05);

  // Verifica sconto applicato su acquisto upgrade standard
  const normalCost = getUpgradeCost(UPGRADE_CATALOG.shovel, 0, 0); // 10
  const discountedCost = getUpgradeCost(UPGRADE_CATALOG.shovel, 0, state.costDiscount); // floor(10 * 0.95) = 9
  assert.equal(normalCost, 10);
  assert.equal(discountedCost, 9);
});

t('Save: nuova run con Excavator Blueprint attivo', () => {
  const storage = new MemoryStorage();
  const save = new Save(storage);
  save.setMetaUpgrade('excavatorBlueprint', 2);

  const newRun = save.createNew();
  assert.equal(newRun.upgrades.scarab, 2, 'La nuova spedizione deve iniziare con 2 scarabei');
});

t('EndingManager: sblocco Finale Segreto dopo 3 finali visti', () => {
  const seed = 9999;
  assert.notEqual(pickEnding(seed, []), 'secret');
  assert.notEqual(pickEnding(seed, ['curse']), 'secret');
  assert.notEqual(pickEnding(seed, ['curse', 'treasure']), 'secret');

  // Con tutti e 3 i finali scoperti, scatta il finale segreto
  const ending = pickEnding(seed, ['curse', 'treasure', 'business']);
  assert.equal(ending, 'secret', 'Con 3 finali scoperti deve selezionare secret');

  // Override esplicito tramite parametro ?ending=secret
  assert.equal(pickEnding(seed, [], 'secret'), 'secret');
});

t('SecretEnding: ciclo vitale, geyser ed epilogo', () => {
  const ending = new SecretEnding();
  const fakeScene = { scene: new THREE.Scene() };
  const fakeCity = { group: new THREE.Group() };

  ending.prepare({ scene: fakeScene, city: fakeCity });
  ending.onProgress(0.7);
  ending.onProgress(0.99);

  let finishData = null;
  ending.trigger((data) => { finishData = data; });
  assert.ok(ending.geyserGroup, 'Il gruppo geyser deve essere inizializzato');

  ending.update(4.6);
  assert.ok(finishData, 'Il callback di epilogo deve essere chiamato dopo il climax');
  assert.equal(finishData.endingId, 'secret');
  assert.equal(finishData.badge, '🔱');

  ending.dispose();
  assert.equal(fakeScene.scene.children.length, 0, 'La scena deve essere ripulita dopo dispose');
});

t('WorldEvents: trigger Tempesta di Sabbia con boost x1.5', () => {
  const state = new State();
  state.reset();
  const sceneMgr = {
    scene: {
      fog: new THREE.FogExp2(0xE0C27A, 0.0035),
    },
  };
  const eventsSys = new WorldEvents({ scene: sceneMgr, state });

  let boostReceived = null;
  const unsub = events.on('event:boost', (payload) => {
    boostReceived = payload;
  });

  eventsSys.triggerEvent('sandstorm');
  assert.equal(eventsSys.activeEvent, 'sandstorm');
  assert.equal(state.sandMultiplier, 1.5, 'La tempesta deve impostare sandMultiplier = 1.5');
  assert.ok(boostReceived && boostReceived.active, 'L\'evento deve emettere boost:active');

  // Aggiungendo 100 sabbia, se ne ricevono 150
  state.addSand(100);
  assert.equal(state.sand, 150);

  eventsSys.dispose();
  assert.equal(state.sandMultiplier, 1.0, 'Al termine il moltiplicatore deve tornare a 1.0');
  unsub();
});

console.log(`\nFase 6: tutti i ${passed} test sono passati con successo!`);
