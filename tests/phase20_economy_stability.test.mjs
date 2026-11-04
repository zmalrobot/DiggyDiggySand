// Test automatizzati per Fase 20: Bilanciamento Economico Matematico, Audit di Stabilità/Memoria e Reliquie.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { simulateProgression } from '../js/systems/Economy.js';
import { deepDispose, disposeRenderTarget } from '../js/world/DisposeUtils.js';
import { UPGRADE_CATALOG, calculateSPS, getUpgradeCost, canAffordUpgrade } from '../js/systems/Upgrades.js';
import { State } from '../js/core/State.js';

console.log('🧪 Inizio suite di test Fase 20: Economia, Stabilità e Reliquie...');

// 1. Validazione del simulatore di progressione economica analitica
console.log('  Testing simulateProgression()...');
const startTime = performance.now();
const sim = simulateProgression();
const durationMs = performance.now() - startTime;

console.log(`    Tempo di esecuzione simulatore: ${durationMs.toFixed(2)} ms (limite: 2000 ms)`);
assert.ok(durationMs < 2000, 'simulateProgression deve completarsi in meno di 2 secondi');

console.log(`    Tempo progressione stimato: ${sim.elapsedMinutes} min (finestra target: 30-35 min)`);
assert.ok(sim.inTargetWindow, `Il tempo (${sim.elapsedMinutes} min) deve rientrare nella finestra target 30-35 min`);
assert.ok(sim.elapsedMinutes >= 30.0 && sim.elapsedMinutes <= 35.0, 'Valore elapsedMinutes conforme al bilanciamento');
assert.equal(sim.completion, '100.7%', 'Completamento finale deve raggiungere il 100%');
assert.ok(sim.milestones.length >= 6, 'Tutte le 6 milestone archeologiche devono essere registrate');

// 2. Verifica Reliquie di Risonanza nel catalogo upgrade
console.log('  Testing Reliquie nel catalogo upgrade...');
const relics = ['relic_cartel', 'relic_leyline', 'relic_gears', 'relic_anomaly', 'relic_abyss'];
for (const rId of relics) {
  const def = UPGRADE_CATALOG[rId];
  assert.ok(def, `Reliquia ${rId} deve esistere nel catalogo`);
  assert.equal(def.branch, 'relics', `La reliquia ${rId} deve appartenere al ramo relics`);
  assert.ok(def.minCompletion > 0 && def.minCompletion <= 0.8, 'Soglia di completamento compresa tra 15% e 80%');
}

// 3. Test blocco acquisto per soglia di scavo (minCompletion)
console.log('  Testing minCompletion lockout...');
const state = new State();
state.reset({ sand: 10000000, completion: 0.10 }); // 10% scavo: cartel richiede 15%

assert.equal(canAffordUpgrade('relic_cartel', state), false, 'Non deve poter acquistare relic_cartel sotto il 15%');

state.setCompletion(0.16); // 16% scavo
assert.equal(canAffordUpgrade('relic_cartel', state), true, 'Deve poter acquistare relic_cartel al 16%');

// 4. Test calcolo SPS con bonus reliquie
console.log('  Testing calculateSPS con sinergie reliquie...');
const baseFleet = { worker: 0, scarab: 10, excavator: 2, dredge: 1 };
// scarab: 10 * 1 = 10
// excavator: 2 * 25 = 50
// dredge: 1 * 200 = 200
// Totale base = 260
const spsBase = calculateSPS(baseFleet);
assert.equal(spsBase, 260, 'SPS base deve essere 260');

// relic_gears: raddoppia excavator e dredge
const withGears = { ...baseFleet, relic_gears: 1 };
// scarab: 10
// excavator: 2 * 25 * 2 = 100
// dredge: 1 * 200 * 2 = 400
// Totale = 510
assert.equal(calculateSPS(withGears), 510, 'relic_gears deve raddoppiare excavator e dredge');

// relic_cartel: +25% globale
const withCartel = { ...withGears, relic_cartel: 1 };
assert.equal(calculateSPS(withCartel), 510 * 1.25, 'relic_cartel deve aggiungere +25% alla flotta');

// relic_abyss: x3 globale
const withAbyss = { ...withCartel, relic_abyss: 1 };
assert.equal(calculateSPS(withAbyss), 510 * 1.25 * 3.0, 'relic_abyss deve triplicare la produzione della flotta');

// 5. Test prevenzione overflow Number.MAX_SAFE_INTEGER
console.log('  Testing overflow prevention su getUpgradeCost...');
const mockHighLevelDef = { baseCost: 1000, multiplier: 1.5, maxLevel: 100000 };
const highLevelCost = getUpgradeCost(mockHighLevelDef, 5000);
assert.ok(Number.isFinite(highLevelCost), 'Il costo deve rimanere un numero finito');
assert.equal(highLevelCost, Number.MAX_SAFE_INTEGER, 'Il costo deve essere limitato a Number.MAX_SAFE_INTEGER');

// 6. Test deepDispose e riciclo risorse WebGL / Three.js
console.log('  Testing deepDispose()...');
let geomDisposed = false;
let matDisposed = false;
let texDisposed = false;

const geom = new THREE.BoxGeometry(1, 1, 1);
geom.addEventListener('dispose', () => { geomDisposed = true; });

const tex = new THREE.Texture();
tex.addEventListener('dispose', () => { texDisposed = true; });

const mat = new THREE.MeshStandardMaterial({
  map: tex,
  roughnessMap: tex,
});
mat.addEventListener('dispose', () => { matDisposed = true; });

const mesh = new THREE.Mesh(geom, mat);
const parentGroup = new THREE.Group();
parentGroup.add(mesh);

deepDispose(parentGroup);

assert.ok(geomDisposed, 'La geometria del mesh deve essere stata disposta');
assert.ok(matDisposed, 'Il materiale del mesh deve essere stato disposto');
assert.ok(texDisposed, 'Le texture del materiale devono essere state disposte');

// Test disposeRenderTarget
const rt = new THREE.WebGLRenderTarget(256, 256);
rt.depthTexture = new THREE.DepthTexture();
let rtDisposed = false;
rt.addEventListener('dispose', () => { rtDisposed = true; });
disposeRenderTarget(rt);
assert.ok(rtDisposed, 'Il render target deve essere stato disposto correttamente');

console.log('✅ Tutti i test unitari per la Fase 20 sono passati con successo!');
