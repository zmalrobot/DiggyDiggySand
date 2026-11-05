import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { AssetLoader, MODEL_REGISTRY } from '../js/core/AssetLoader.js';
import { ProceduralFactory, createFallback, createMesh, FallbackMeshes } from '../js/world/ProceduralFactory.js';
import { LoadingScreen } from '../js/ui/LoadingScreen.js';

console.log('🧪 Avvio Suite Test: Reset Totale Modelli 3D & Pipeline Verificata...');

// 1. Verifica Integrità e Dimensioni File GLB Fisici (> 2 KB, nessun file da 1.1 KB)
console.log('  1. Verifica integrità file GLB e assenza cubi da 1.1 KB...');
const expectedModels = [
  'fleet/worker.glb',
  'fleet/worker_animated.glb',
  'fleet/excavator.glb',
  'fleet/excavator_rigged.glb',
  'machinery/worker_scarab.glb',
  'machinery/excavator_steam.glb',
  'machinery/dredge.glb',
  'props/chest_animated.glb',
  'city/chest.glb',
  'city/obelisk.glb',
  'city/pillar_ruin.glb',
  'ruins/chest.glb',
  'ruins/column.glb',
  'ruins/temple_center.glb',
  'tools/shovel.glb',
  'tools/shovel_basic.glb',
  'tools/shovel_atlantean.glb',
];

for (const relPath of expectedModels) {
  const fullPath = path.join(process.cwd(), 'assets', 'models', relPath);
  assert.ok(fs.existsSync(fullPath), `File GLB mancante: ${fullPath}`);
  const stat = fs.statSync(fullPath);
  assert.ok(stat.size > 2048, `File GLB "${relPath}" troppo piccolo (${stat.size} bytes <= 2048 bytes). Deve essere un modello reale.`);
}
console.log(`    ✓ Tutti i ${expectedModels.length} file GLB verificati sono presenti sul disco e superano i 2 KB.`);

// 2. Verifica Anti-Cubo Validator in AssetLoader
console.log('  2. Verifica Anti-Cubo Validator (validateModelGeometry)...');
const loader = new AssetLoader();

// Simula un cubo primitivo da 24/36 vertici
const fakeCubeScene = new THREE.Group();
const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
fakeCubeScene.add(cubeMesh);
const fakeCubeGltf = { scene: fakeCubeScene };

assert.throws(() => {
  loader.validateModelGeometry(fakeCubeGltf, 'test_fake_cube');
}, /Modello placeholder rilevato/);
console.log('    ✓ Modello primitivo con <= 36 vertici scartato correttamente con eccezione.');

// Simula un modello articolato (> 36 vertici)
const complexScene = new THREE.Group();
const complexMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshBasicMaterial());
complexScene.add(complexMesh);
const complexGltf = { scene: complexScene };

const count = loader.validateModelGeometry(complexGltf, 'test_complex_model');
assert.ok(count > 36, `Conteggio vertici inatteso: ${count}`);
console.log(`    ✓ Modello valido accettato con successo (${count} vertici).`);

// 3. Verifica Clonazione con SkeletonUtils e Preservazione Animazioni
console.log('  3. Verifica clonazione con SkeletonUtils.clone...');
const characterRoot = new THREE.Group();
const skinnedMesh = new THREE.SkinnedMesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 8), new THREE.MeshStandardMaterial());
const bone1 = new THREE.Bone();
const bone2 = new THREE.Bone();
bone1.add(bone2);
const skeleton = new THREE.Skeleton([bone1, bone2]);
skinnedMesh.bind(skeleton);
characterRoot.add(bone1);
characterRoot.add(skinnedMesh);

const dummyClip = new THREE.AnimationClip('Walk', 1.0, []);
characterRoot.userData = { animations: [dummyClip] };

loader.models.set('fleet/worker.glb', characterRoot);
loader.animations.set('fleet/worker.glb', [dummyClip]);

const cloned = loader.getModel('fleet/worker.glb');
assert.ok(cloned !== characterRoot, 'Il modello restituito deve essere un clone, non la sorgente originale');
assert.ok(cloned.userData?.animations?.length > 0, 'Le animazioni devono essere propagate al clone');
console.log('    ✓ SkeletonUtils.clone clona correttamente rig e conserva le animazioni.');

// 4. Verifica Fallback Procedurale Articolato (Nessun Cubo Singolo)
console.log('  4. Verifica Fallback Procedurali Articolati (Zero Cubi Singoli)...');
const workerFallback = createMesh('fleet/worker.glb');
assert.ok(workerFallback.children && workerFallback.children.length >= 2, 'Il worker procedurale deve essere composto da più elementi articolati');

const excavatorFallback = createMesh('fleet/excavator.glb');
assert.ok(excavatorFallback.children && excavatorFallback.children.length >= 4, 'L\'escavatore procedurale deve avere cingoli, cabina e braccio');

const unknownFallback = createFallback('ID_TOTALMENTE_SCONOSCIUTO');
assert.ok(unknownFallback.isGroup, 'Il fallback per ID sconosciuto deve essere un gruppo monumentale composito');
assert.ok(unknownFallback.children.length >= 2, 'Il fallback deve contenere almeno 2 mesh (zero cubi isolati)');
console.log('    ✓ Tutti i fallback procedurali sono strutture multi-pezzo chiseled low-poly conformi all\'Art Bible.');

// 5. Verifica Popup Modale di Avviso Fallback
console.log('  5. Verifica Popup Fallback in caso di modelli mancanti/incompleti...');
const fakeDom = {
  elements: [],
  appendChild(el) { this.elements.push(el); }
};

loader.failedModels = [
  { key: 'damaged_mesh.glb', path: './assets/models/damaged_mesh.glb', reason: 'Timeout caricamento' },
  { key: 'tiny_cube.glb', path: './assets/models/tiny_cube.glb', reason: 'Modello placeholder rilevato (24 vertici <= 36)' }
];

// Mock document per l'esecuzione in Node
globalThis.document = {
  createElement: (tag) => {
    return {
      tagName: tag,
      classList: { add: () => {}, remove: () => {} },
      innerHTML: '',
      addEventListener: () => {},
      removeEventListener: () => {},
      remove: () => {},
      querySelector: () => ({ addEventListener: () => {} })
    };
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

const popup = loader.showAssetFallbackPopup(fakeDom);
assert.ok(popup, 'showAssetFallbackPopup deve restituire l\'elemento overlay');
assert.ok(fakeDom.elements.includes(popup), 'L\'overlay deve essere agganciato al container');
console.log('    ✓ Popup modale di avviso fallback generato e agganciato correttamente.');

// 6. Verifica Barra di Caricamento e Progresso Reale (LoadingScreen)
console.log('  6. Verifica sincronizzazione reale barra di caricamento (LoadingScreen)...');
const fakeRoot = {
  classList: { add: () => {}, remove: () => {} },
  innerHTML: '',
  querySelector: (sel) => {
    return {
      style: {
        setProperty: (prop, val) => {},
        width: '0%'
      },
      textContent: '',
      classList: { add: () => {}, remove: () => {} },
      focus: () => {}
    };
  }
};

const loadingScreen = new LoadingScreen(fakeRoot);
assert.ok(loadingScreen.bar, 'Riferimento barra presente');
assert.ok(loadingScreen.fill, 'Riferimento riempimento interno presente');
assert.ok(loadingScreen.pct, 'Riferimento percentuale presente');

// Simula avanzamento
loadingScreen.display = 0.65;
loadingScreen._render();
assert.equal(loadingScreen.fill.style.width, '65%', 'La larghezza della barra deve essere al 65%');
assert.equal(loadingScreen.pct.textContent, '65%', 'La percentuale testuale deve indicare 65%');

loadingScreen.display = 1.0;
loadingScreen._render();
assert.equal(loadingScreen.fill.style.width, '100%', 'La larghezza finale deve essere al 100%');
assert.equal(loadingScreen.pct.textContent, '100%');
console.log('    ✓ La barra di caricamento riflette in tempo reale la percentuale da 0% a 100%.');

console.log('🎉 TUTTI I TEST DELLA PIPELINE MODELLI E LOADER SUPERATI CON SUCCESSO!');
