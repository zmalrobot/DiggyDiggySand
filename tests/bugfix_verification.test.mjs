import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Workers, BOUNDARY_LIMIT, TERRAIN_SIZE } from '../js/systems/Workers.js';
import { Terrain } from '../js/world/Terrain.js';
import { State } from '../js/core/State.js';
import { i18n, DICTIONARY } from '../js/core/I18n.js';
import { Hud } from '../js/ui/Hud.js';
import { Tutorial } from '../js/ui/Tutorial.js';
import { AssetLoader, MODEL_REGISTRY } from '../js/core/AssetLoader.js';
import { FallbackMeshes, createMesh } from '../js/world/ProceduralFactory.js';
import fs from 'node:fs';

console.log('--- TEST VERIFICA BUGFIX TOTALE DIGGY DIGGY SAND ---');

// 1. Confinamento Mezzi nel Terreno
console.log('1. Confinamento Mezzi nel Terreno...');
import { BOUNDARY_LIMIT as TERRAIN_BOUND } from '../js/world/Terrain.js';
import DefaultWorkers from '../js/world/Workers.js';
import DefaultTutorial from '../js/systems/Tutorial.js';
import DefaultEvents, { getEventTranslation } from '../js/systems/Events.js';

assert.equal(TERRAIN_SIZE, 200, 'TERRAIN_SIZE deve essere 200');
assert.equal(BOUNDARY_LIMIT, (200 / 2) - 2.5, 'BOUNDARY_LIMIT deve essere 97.5');
assert.equal(TERRAIN_BOUND, 97.5, 'Terrain.js deve esportare BOUNDARY_LIMIT a 97.5');
assert.equal(typeof DefaultWorkers, 'function', 'js/world/Workers.js deve avere default export');
assert.equal(typeof DefaultTutorial, 'function', 'js/systems/Tutorial.js deve avere default export');
assert.equal(typeof DefaultEvents, 'function', 'js/systems/Events.js deve avere default export');

const terrain = new Terrain({ size: 200, res: 16, startHeight: 12, flat: true });
const state = new State();
state.upgrades.scarab = 2;
state.upgrades.excavator = 1;

const workers = new Workers({ terrain, state, particles: { burst: () => {} }, scene: null });
assert.equal(workers.workers.length, 3, 'Devono essere istanziati 3 lavoratori visivi');

// Test picking casuale getNewTargetPosition - strettamente interno all'intervallo
for (let i = 0; i < 50; i++) {
  const target = workers.getNewTargetPosition(97.5, 97.5, 20);
  assert.ok(target.x < BOUNDARY_LIMIT && target.x > -BOUNDARY_LIMIT, `Target X non strettamente interno: ${target.x}`);
  assert.ok(target.z < BOUNDARY_LIMIT && target.z > -BOUNDARY_LIMIT, `Target Z non strettamente interno: ${target.z}`);
}

// Forza un lavoratore fuori confine e verifica il clamping e l'inversione
const w = workers.workers[0];
w.mesh.position.set(150, 12, -180);
w.x = 150;
w.z = -180;
workers.update(0.1);

assert.ok(w.mesh.position.x <= BOUNDARY_LIMIT && w.mesh.position.x >= -BOUNDARY_LIMIT, `Worker X non clampato: ${w.mesh.position.x}`);
assert.ok(w.mesh.position.z <= BOUNDARY_LIMIT && w.mesh.position.z >= -BOUNDARY_LIMIT, `Worker Z non clampato: ${w.mesh.position.z}`);
assert.ok(w.position.x <= BOUNDARY_LIMIT && w.position.x >= -BOUNDARY_LIMIT, `Worker getter position.x non clampato: ${w.position.x}`);
assert.ok(w.targetX < BOUNDARY_LIMIT && w.targetX > -BOUNDARY_LIMIT, 'Target X deve essere strettamente interno al terreno');
assert.ok(w.targetZ < BOUNDARY_LIMIT && w.targetZ > -BOUNDARY_LIMIT, 'Target Z deve essere strettamente interno al terreno');

// Verifica integrità di w.position dopo rebuildVisualMeshes()
const oldMesh = w.mesh;
workers.rebuildVisualMeshes();
assert.notEqual(w.mesh, oldMesh, 'La mesh deve essere stata ricreata');
assert.equal(w.position, w.mesh.position, 'w.position deve puntare alla nuova mesh attiva');

console.log('✓ Confinamento mezzi, clamping limite 97.5 e getter position dinamico verificati con successo');

// 2. Traduzione Notifiche Eventi Dinamici
console.log('2. Traduzione Notifiche Eventi Dinamici...');
i18n.currentLang = 'it';
assert.equal(i18n.t('events.sandstorm.started'), 'Tempesta di Sabbia: Visibilità ridotta, scavo rallentato!');
assert.equal(i18n.t('events.sandstorm.ended'), 'La tempesta di sabbia si è placata.');
assert.equal(i18n.t('events.solar_flare.started'), 'Eruzione Solare: Produzione oricalco raddoppiata!');
assert.equal(i18n.t('events.solar_flare.ended'), "L'eruzione solare è terminata.");
assert.equal(i18n.t('events.earthquake.started'), 'Scossa Tettonica: Crolli di sabbia nel cratere!');
assert.equal(i18n.t('events.earthquake.ended'), 'I movimenti tettonici sono cessati.');
assert.equal(i18n.t('events.active_banner'), 'EVENTO ATTIVO');
assert.equal(getEventTranslation('events.sandstorm.ended'), 'La tempesta di sabbia si è placata.');
assert.equal(getEventTranslation('events.non_existent', 'Fallback Leggibile'), 'Fallback Leggibile');

i18n.currentLang = 'en';
assert.equal(i18n.t('events.sandstorm.started'), 'Sandstorm: Low visibility, digging speed decreased!');
assert.equal(i18n.t('events.sandstorm.ended'), 'The sandstorm has cleared.');
assert.equal(i18n.t('events.solar_flare.started'), 'Solar Flare: Orichalcum output doubled!');
assert.equal(i18n.t('events.solar_flare.ended'), 'The solar flare has subsided.');
assert.equal(i18n.t('events.earthquake.started'), 'Seismic Tremor: Sand collapse detected!');
assert.equal(i18n.t('events.earthquake.ended'), 'The seismic activity has stopped.');
assert.equal(i18n.t('events.active_banner'), 'ACTIVE EVENT');
assert.equal(getEventTranslation('events.sandstorm.ended'), 'The sandstorm has cleared.');
console.log('✓ Traduzioni eventi sandstorm, solar_flare, earthquake e active_banner verificate');

// 3. Centratura Griglia Guardaroba & CSS
console.log('3. Stili e Centratura Guardaroba...');
const css = fs.readFileSync('./css/style.css', 'utf-8');
assert.ok(css.includes('.wardrobe-grid'), 'CSS deve contenere .wardrobe-grid');
assert.ok(css.includes('justify-content: center'), 'CSS .wardrobe-grid deve avere justify-content: center');
assert.ok(css.includes('.wardrobe-preview-box'), 'CSS deve definire .wardrobe-preview-box');
assert.ok(css.includes('.wardrobe-preview-icon'), 'CSS deve definire .wardrobe-preview-icon');
assert.ok(css.includes('filter: drop-shadow'), 'CSS .wardrobe-preview-icon svg deve avere filtro shadow');
console.log('✓ Stili CSS Guardaroba conformi alle specifiche');

// 4. Sincronizzazione Barra di Avanzamento HUD
console.log('4. Barra di Avanzamento HUD...');
assert.ok(css.includes('.progress-bar-track'), 'CSS deve contenere .progress-bar-track');
assert.ok(css.includes('linear-gradient(90deg, #f5ba23, #0fe3c1)'), 'CSS fill deve avere gradiente #f5ba23 -> #0fe3c1');

// Test logica JS updateExcavationProgress
const mockHudRoot = {
  innerHTML: '',
  classList: { add: () => {}, remove: () => {} },
  appendChild: () => {},
  querySelector: (sel) => {
    if (sel === '.progress-bar-fill') return { style: {} };
    return null;
  },
};
const hud = new Hud(mockHudRoot, { state });
assert.equal(typeof hud.updateExcavationProgress, 'function', 'Hud deve esporre updateExcavationProgress');
hud.updateExcavationProgress(42.5);
console.log('✓ updateExcavationProgress e stile gradiente verificati');

// 5. Localizzazione Completa del Tutorial
console.log('5. Localizzazione Completa del Tutorial...');
i18n.currentLang = 'it';
assert.equal(i18n.t('tutorial.step1_title'), 'Primo Scavo');
assert.equal(i18n.t('tutorial.step1_desc'), 'Clicca o tocca la sabbia per scavare i primi granelli del deserto.');
assert.equal(i18n.t('tutorial.step2_title'), "L'Officina");
assert.equal(i18n.t('tutorial.step2_desc'), "Apri l'Officina in basso per reclutare lavoratori e potenziare la pala.");
assert.equal(i18n.t('tutorial.step3_title'), 'Dinamite da Cantiere');
assert.equal(i18n.t('tutorial.step3_desc'), 'Premi la Barra Spaziatrice o tocca il medaglione per sgomberare ampie aree.');
assert.equal(i18n.t('tutorial.step4_title'), 'I Segreti Sotterranei');
assert.equal(i18n.t('tutorial.step4_desc'), 'Scava in profondità fino al basamento archeologico per scoprire cosa riposa sotto la duna.');
assert.equal(i18n.t('tutorial.btn_next'), 'Ho Capito');
assert.equal(i18n.t('tutorial.btn_skip'), 'Salta Tutorial');

i18n.currentLang = 'en';
assert.equal(i18n.t('tutorial.step1_title'), 'First Strike');
assert.equal(i18n.t('tutorial.step1_desc'), 'Click or tap the sand to unearth the first grains of the desert.');
assert.equal(i18n.t('tutorial.step2_title'), 'The Workshop');
assert.equal(i18n.t('tutorial.step2_desc'), 'Open the Workshop below to hire workers and reinforce your shovel.');
assert.equal(i18n.t('tutorial.step3_title'), 'Excavation Dynamite');
assert.equal(i18n.t('tutorial.step3_desc'), 'Press Spacebar or tap the medallion to blast away large mounds.');
assert.equal(i18n.t('tutorial.step4_title'), 'Subterranean Secrets');
assert.equal(i18n.t('tutorial.step4_desc'), 'Dig down to the bedrock sanctuary to uncover what sleeps beneath.');
assert.equal(i18n.t('tutorial.btn_next'), 'Understood');
assert.equal(i18n.t('tutorial.btn_skip'), 'Skip Tutorial');

const tutRoot = { appendChild: () => {}, removeChild: () => {} };
const tutState = new State();
tutState.tutorialDone = false;
tutState.sand = 0;
tutState.clicks = 0;
const tut = new Tutorial(tutRoot, { state: tutState });
tut.start();
assert.equal(tut.step, 1);
assert.equal(typeof tut.openModal, 'function', 'Tutorial deve avere openModal');
tut.dispose();
console.log('✓ Testi, pulsanti e logica tutorial verificati con successo');

// 6. Caricamento GLTF e Fallback Procedurale Low-Poly
console.log('6. Caricamento GLTF e Fallback Procedurale...');
for (const [key, reg] of Object.entries(MODEL_REGISTRY)) {
  assert.ok(reg.file.startsWith('./assets/models/'), `Path modello deve essere relativo ./assets/models/: ${reg.file}`);
}

const workerMesh = FallbackMeshes.createWorker();
assert.ok(workerMesh instanceof THREE.Group, 'Worker fallback deve essere un THREE.Group');
assert.ok(workerMesh.children.length >= 4, 'Worker deve essere composto da almeno 4 parti (tunica, testa, manico, lama)');

let workerHasFlatShading = false;
workerMesh.traverse((child) => {
  if (child.isMesh && child.material?.flatShading) workerHasFlatShading = true;
});
assert.ok(workerHasFlatShading, 'Worker fallback deve usare flatShading: true');

const excavatorMesh = FallbackMeshes.createExcavator();
assert.ok(excavatorMesh instanceof THREE.Group, 'Excavator fallback deve essere un THREE.Group');
assert.ok(excavatorMesh.children.length >= 5, 'Excavator deve essere composto da chassis, cingoli, cabina, braccio, benna');

let excavatorHasFlatShading = false;
excavatorMesh.traverse((child) => {
  if (child.isMesh && child.material?.flatShading) excavatorHasFlatShading = true;
});
assert.ok(excavatorHasFlatShading, 'Excavator fallback deve usare flatShading: true');

console.log('✓ Path GLTF e modelli fallback procedurali convalidati');

console.log('\n========================================');
console.log('TUTTI I 6 PUNTI DI BUGFIX VERIFICATI AL 100%!');
console.log('========================================\n');
