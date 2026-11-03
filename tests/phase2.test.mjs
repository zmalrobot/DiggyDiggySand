// Test unitari della Fase 2: node --import ./tests/register.mjs tests/phase2.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { State, MIN_TICK } from '../js/core/State.js';
import { UPGRADE_CATALOG, getUpgradeCost, calculateSPS, canAffordUpgrade, buyUpgrade } from '../js/systems/Upgrades.js';
import { Economy } from '../js/systems/Economy.js';
import { Workers, createScarabModel, createExcavatorModel, createDredgeModel } from '../js/systems/Workers.js';
import { Terrain } from '../js/world/Terrain.js';
import { Particles } from '../js/world/Particles.js';
import { SettingsManager } from '../js/core/SettingsManager.js';


let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

t('Upgrades: formula costi e calcolo SPS', () => {
  const shovel = UPGRADE_CATALOG.shovel;
  assert.equal(getUpgradeCost(shovel, 0), 10);
  assert.equal(getUpgradeCost(shovel, 1), Math.floor(10 * 1.15));
  assert.equal(getUpgradeCost(shovel, 2), Math.floor(10 * 1.15 * 1.15));
  assert.equal(getUpgradeCost(shovel, 50), Infinity); // Max level

  const upgrades = { scarab: 3, excavator: 1, dredge: 0 };
  // scarab: 3 * 1.0 = 3; excavator: 1 * 25.0 = 25; dredge: 0
  assert.equal(calculateSPS(upgrades), 28.0);
});

t('Upgrades: acquisto e deduzione saldo', () => {
  const state = new State();
  state.sand = 50;

  assert.equal(canAffordUpgrade('shovel', state), true);
  assert.equal(canAffordUpgrade('dredge', state), false);

  const bought = buyUpgrade('shovel', state);
  assert.equal(bought, true);
  assert.equal(state.upgrades.shovel, 1);
  assert.equal(state.sand, 40);

  // Prova ad acquistare qualcosa che costa troppo
  assert.equal(buyUpgrade('dredge', state), false);
  assert.equal(state.upgrades.dredge ?? 0, 0);
});

t('State: statistiche derivate dagli upgrade', () => {
  const state = new State();
  assert.equal(state.stats.power, 1);
  assert.equal(state.stats.radius, 1.5);
  assert.equal(state.stats.digRate, 2.0);

  state.upgrades.shovel = 4; // power = 1 + 4 = 5
  state.upgrades.radius = 2; // radius = 1.5 + 2 * 0.45 = 2.4
  state.upgrades.frequency = 3; // hold rate aumentato

  assert.equal(state.stats.power, 5);
  assert.ok(Math.abs(state.stats.radius - 2.4) < 1e-5);
  assert.ok(state.stats.digRate > 2.0);
  assert.ok(state.stats.digRate <= 1 / MIN_TICK);
});

t('Economy: calcolo progresso offline', () => {
  const state = new State();
  state.upgrades.scarab = 10; // 10 SPS
  const eco = new Economy(state);
  assert.equal(eco.sps, 10.0);

  const now = Date.now();
  // 1 ora fa (3600s): 3600s * 10 sps * 0.5 (50% efficienza) = 18000 sabbia
  const offlineGains1h = eco.calculateOfflineProgress(now - 3600 * 1000, 10);
  assert.equal(offlineGains1h, 18000);

  // Oltre 2 ore (3 ore fa): cap a 2 ore (7200s) = 7200 * 10 * 0.5 = 36000 sabbia
  const offlineGains3h = eco.calculateOfflineProgress(now - 10800 * 1000, 10);
  assert.equal(offlineGains3h, 36000);

  // Tempo trascurabile (< 5s)
  assert.equal(eco.calculateOfflineProgress(now - 2000, 10), 0);
});

t('Workers: modelli 3D e istanze low-poly', () => {
  const scarab = createScarabModel();
  assert.ok(scarab.isGroup);
  assert.equal(scarab.name, 'scarab');

  const excavator = createExcavatorModel();
  assert.ok(excavator.isGroup);
  assert.equal(excavator.name, 'excavator');

  const dredge = createDredgeModel();
  assert.ok(dredge.isGroup);
  assert.equal(dredge.name, 'dredge');
});

t('Workers: sincronizzazione con i livelli acquistati ed esecuzione scavo', () => {
  const terrain = new Terrain({ size: 100, res: 100, startHeight: 12, floor: 0 });
  const settings = new SettingsManager({ getItem: () => null, setItem: () => {} });
  const particles = new Particles(settings);
  const state = new State();
  state.sand = 0;

  const workers = new Workers({ terrain, state, particles, scene: null });
  assert.equal(workers.workers.length, 0);

  // Assegna 2 scarabei e 1 escavatore
  state.upgrades.scarab = 2;
  state.upgrades.excavator = 1;
  workers.syncWithUpgrades(state.upgrades);

  assert.equal(workers.workers.length, 3);
  const initialSand = state.sand;

  // Simula update per completare un ciclo
  workers.update(3.5);

  assert.ok(state.sand > initialSand, `La flotta deve aver scavato e accumulato sabbia. Attuale: ${state.sand}`);
  assert.ok(state.completion > 0, `Il terreno deve aver registrato lo scavo`);

  workers.dispose();
});

console.log(`\n${passed} test passati con successo!`);
