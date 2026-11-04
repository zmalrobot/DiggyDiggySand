// Test unitario per Medaglioni Abilità Attive (Branch 4), Regia Cinematica Finali e Assegnazione Tavolette τ
import assert from 'node:assert';
import { UPGRADE_CATALOG, BRANCHES, getUpgradeCost } from '../js/systems/Upgrades.js';
import { Abilities, ABILITY_DEFS } from '../js/systems/Abilities.js';
import { State } from '../js/core/State.js';
import { calculateTabletsEarned } from '../js/systems/Prestige.js';

console.log('--- TEST UNITARIO ABILITÀ ATTIVE (BRANCH 4) & REGIA FINALI ---');

// 1. Verifica Catalogo Branch 4 e formule costi
assert.ok(BRANCHES.artifacts, 'Branch artifacts deve essere definito');
assert.strictEqual(BRANCHES.artifacts.id, 'artifacts');

const dynamiteDef = UPGRADE_CATALOG.dynamite;
assert.ok(dynamiteDef, 'Carica di Dinamite deve essere definita nel catalogo');
assert.strictEqual(dynamiteDef.branch, 'artifacts');
assert.strictEqual(dynamiteDef.baseCost, 1500);
assert.strictEqual(dynamiteDef.maxLevel, 1);
assert.strictEqual(dynamiteDef.cooldown, 45);

const vortexDef = UPGRADE_CATALOG.vortex;
assert.ok(vortexDef, 'Vortice Khamsin deve essere definito nel catalogo');
assert.strictEqual(vortexDef.branch, 'artifacts');
assert.strictEqual(vortexDef.baseCost, 25000);
assert.strictEqual(vortexDef.minCompletion, 0.35);
assert.strictEqual(vortexDef.cooldown, 90);
assert.strictEqual(vortexDef.duration, 10);

const prismDef = UPGRADE_CATALOG.prism;
assert.ok(prismDef, 'Prisma di Atlantide deve essere definito nel catalogo');
assert.strictEqual(prismDef.branch, 'artifacts');
assert.strictEqual(prismDef.baseCost, 180000);
assert.strictEqual(prismDef.minCompletion, 0.60);
assert.strictEqual(prismDef.cooldown, 150);
assert.strictEqual(prismDef.duration, 6);

console.log('✓ Catalogo Branch 4 (Active Artifacts) e requisiti conformi alle specifiche');

// 2. Verifica Sistema Abilità, Sblocco e Cooldown
const state = new State();
state.reset({
  sand: 500000,
  totalSand: 500000,
  upgrades: {},
});

const mockGame = {
  controls: { target: { x: 0, y: 0, z: 0 } },
  floatingText: { spawn: () => {} },
};

const abilities = new Abilities({
  game: mockGame,
  state,
  scene: { shake: () => {} },
  audio: { playDynamite: () => {}, playVortex: () => {}, playPrismBeam: () => {} },
  digging: {
    pointer: { inside: false },
    pick: () => null,
  },
  terrain: {
    dig: () => 600,
    updateBounds: () => {},
    completion: 0.5,
    heightAt: () => 6.0,
  },
  particles: { burst: () => {} },
  haptics: { dynamite: () => {}, burst: () => {} },
});

// Inizialmente non sbloccate
assert.strictEqual(abilities.isUnlocked('dynamite'), false);
assert.strictEqual(abilities.canActivate('dynamite'), false);

// Sblocca dinamite
state.upgrades.dynamite = 1;
assert.strictEqual(abilities.isUnlocked('dynamite'), true);
assert.strictEqual(abilities.canActivate('dynamite'), true);

// Attivazione Dinamite
const prevSand = state.sand;
const ok = abilities.activate('dynamite');
assert.strictEqual(ok, true, 'Attivazione dinamite riuscita');
assert.ok(state.sand > prevSand, 'Sabbia incrementata dopo esplosione dinamite');
assert.strictEqual(abilities.getCooldown('dynamite'), 45, 'Cooldown impostato a 45s');
assert.strictEqual(abilities.canActivate('dynamite'), false, 'Non riattivabile durante il cooldown');

// Tick update decrementa cooldown
abilities.update(10);
assert.strictEqual(abilities.getCooldown('dynamite'), 35);
const status = abilities.getStatus();
assert.strictEqual(status.dynamite.cooldown, 35);
assert.strictEqual(status.dynamite.isReady, false);

// Sblocca e attiva Vortice
state.upgrades.vortex = 1;
assert.strictEqual(abilities.canActivate('vortex'), true);
abilities.activate('vortex');
assert.strictEqual(state.vortexActive, true, 'Vortice attivo nello stato');
assert.strictEqual(abilities.active.vortex, 10);

// Tick fino a fine durata vortice
abilities.update(10.5);
assert.strictEqual(state.vortexActive, false, 'Vortice disattivato alla scadenza');

// Sblocca e attiva Prisma
state.upgrades.prism = 1;
const sandBeforePrism = state.totalSand;
abilities.activate('prism');
const expectedBounty = 15000 + Math.floor(sandBeforePrism * 0.10);
assert.ok(state.sand >= prevSand + expectedBounty, 'Bounty prisma accreditato con formula corretta');

console.log('✓ Meccanica abilità attive, calcolo cooldown, durate e premi convalidati');

// 3. Formula Tavolette Antiche (τ)
const t0 = calculateTabletsEarned(0);
assert.strictEqual(t0, 5, 'Con 0 sabbia deve assegnare 5 τ base');

const t1 = calculateTabletsEarned(100000);
// floor(sqrt(100000 / 100000)) + 5 = 1 + 5 = 6
assert.strictEqual(t1, 6, 'Con 100k sabbia deve assegnare 6 τ');

const t4 = calculateTabletsEarned(400000);
// floor(sqrt(400000 / 100000)) + 5 = 2 + 5 = 7
assert.strictEqual(t4, 7, 'Con 400k sabbia deve assegnare 7 τ');

const t9 = calculateTabletsEarned(900000);
// floor(sqrt(900000 / 100000)) + 5 = 3 + 5 = 8
assert.strictEqual(t9, 8, 'Con 900k sabbia deve assegnare 8 τ');

console.log('✓ Formula Tavolette Antiche τ = floor(sqrt(totalSand / 100000)) + 5 convalidata');

console.log('\n--- TUTTI I TEST UNITARI ABILITÀ E FINALI SUPERATI CON SUCCESSO ---');

