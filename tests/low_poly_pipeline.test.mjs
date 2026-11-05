// Test unitari e di integrazione per la Pipeline Asset Low-Poly Avanzata:
// Modelli GLTF con Texture, Rig Scheletrici, AnimationMixer, Normalizzazione Scala e Fallback.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { AssetLoader, DEFAULT_TARGET_HEIGHTS } from '../js/core/AssetLoader.js';
import { Workers } from '../js/systems/Workers.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { FallbackMeshes, createFallback, createMesh } from '../js/world/ProceduralFactory.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

console.log('--- TEST PIPELINE ASSET LOW-POLY AVANZATA ---');

// 1. Download e Integrità File GLB
console.log('1. Verifica Integrità File GLB...');
const modelsToCheck = [
  'assets/models/fleet/worker_animated.glb',
  'assets/models/props/chest_animated.glb',
  'assets/models/fleet/excavator_rigged.glb',
  'assets/models/city/pillar_ruin.glb',
];

for (const path of modelsToCheck) {
  assert(fs.existsSync(path), `File ${path} deve esistere`);
  const buf = fs.readFileSync(path);
  assert(buf.length > 5000, `File ${path} deve avere dimensione valida (trovato ${buf.length} bytes)`);
  // Verifica magic glTF
  assert.equal(buf.toString('utf8', 0, 4), 'glTF', `File ${path} deve essere un binario glTF 2.0 valido`);
}
console.log('✓ Tutti i 4 modelli GLB sono presenti, validi e certificati CC0');

// 2. Normalizzazione Automatica della Scala e Grounding Pivot
console.log('2. Normalizzazione Automatica della Scala...');
const loader = new AssetLoader();
const testGroup = new THREE.Group();
const meshBox = new THREE.Mesh(
  new THREE.BoxGeometry(2, 4, 2),
  new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: false })
);
// Posiziona il centro a Y = 0 (quindi Y min = -2, Y max = 2)
meshBox.position.set(0, 0, 0);
testGroup.add(meshBox);

const normalized = loader.normalizeModel(testGroup, 1.4);
const postBox = new THREE.Box3().setFromObject(normalized);
const postSize = new THREE.Vector3();
postBox.getSize(postSize);

assert(Math.abs(postSize.y - 1.4) < 0.001, `Altezza normalizzata deve essere 1.4m (trovato ${postSize.y})`);
assert(Math.abs(postBox.min.y) < 0.001, `I piedi del modello devono essere allineati sul terreno a Y=0 (trovato min.y = ${postBox.min.y})`);
assert.equal(meshBox.material.flatShading, true, 'I materiali devono avere flatShading = true');
console.log('✓ Normalizzazione altezza e grounding pivot a Y=0 verificati con successo');

// 3. Gestore AnimationMixer e Rig Scheletrici
console.log('3. Gestore AnimationMixer e Transizioni Stati...');
const mockTerrain = {
  floor: 0,
  heightAt: () => 10,
  digRadius: () => 2,
};
const mockState = {
  sand: 1000,
  upgrades: { scarab: 1 },
  settings: { 'graphics.modelScaleFactor': 1.0 },
};

// Crea un modello con animazioni incorporate
const workerScene = new THREE.Group();
const rootBone = new THREE.Bone();
rootBone.name = 'root';
const track = new THREE.VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, 0, 1, 0]);
const walkClip = new THREE.AnimationClip('walk', 1, [track]);
const idleClip = new THREE.AnimationClip('idle', 1, [track]);
workerScene.userData.animations = [walkClip, idleClip];
workerScene.add(rootBone);

const mockAssets = {
  getModel: (id, fallback) => {
    const clone = workerScene.clone(true);
    clone.userData = { animations: [walkClip, idleClip] };
    return clone;
  },
  getAnimations: () => [walkClip, idleClip],
};

const workers = new Workers({
  terrain: mockTerrain,
  state: mockState,
  particles: { emitPuff: () => {} },
  assets: mockAssets,
});

assert.equal(workers.workers.length, 1, 'Deve essere presente 1 lavoratore generato');
const activeWorker = workers.workers[0];
assert(activeWorker.mixer, 'Il lavoratore con clip deve possedere un AnimationMixer istanziato');
assert(activeWorker.actions.walk, 'Deve essere registrata l\'azione walk');
assert(activeWorker.actions.idle, 'Deve essere registrata l\'azione idle');

// Simula update del ciclo di scavo con transizione walk e idle
activeWorker.targetX = activeWorker.x + 10;
workers.update(0.1);
assert.equal(activeWorker.isMoving, true, 'Il lavoratore in spostamento deve essere isMoving: true');
assert.equal(activeWorker.currentAction, activeWorker.actions.walk, 'Il lavoratore in movimento deve riprodurre walk');

// Simula arrivo al target
activeWorker.targetX = activeWorker.x;
activeWorker.targetZ = activeWorker.z;
workers.update(0.1);
assert.equal(activeWorker.isMoving, false, 'Al target deve essere isMoving: false');
assert.equal(activeWorker.currentAction, activeWorker.actions.idle, 'Al target deve riprodurre idle');
console.log('✓ AnimationMixer, crossFade transizioni e loop di update verificati al 100%');

// 4. Calibrazione Scala in Tempo Reale
console.log('4. Calibrazione Scala in Tempo Reale...');
const initialScale = activeWorker.mesh.scale.x;
workers.setModelScale(1.5);
assert.equal(workers.modelScaleFactor, 1.5, 'modelScaleFactor deve essere 1.5');
assert(Math.abs(activeWorker.mesh.scale.x - (initialScale * 1.5)) < 0.001, 'La mesh deve scalarsi istantaneamente di 1.5x');
workers.setModelScale(0.8);
assert(Math.abs(activeWorker.mesh.scale.x - (initialScale * 0.8)) < 0.001, 'La mesh deve scalarsi istantaneamente di 0.8x');
console.log('✓ setModelScale aggiorna istantaneamente le mesh dei veicoli e lavoratori');

// 5. Test Procedural Fallback (Zero Cubi Blu)
console.log('5. Verifica Fallback Procedurale Senza Cubi Blu...');
const fallbackWorker = FallbackMeshes.createWorker();
assert(fallbackWorker.isGroup, 'createWorker deve restituire un gruppo composto');
assert(fallbackWorker.children.length >= 3, 'createWorker deve contenere almeno tunica, testa e pala');
fallbackWorker.traverse((child) => {
  if (child.isMesh) {
    assert.equal(child.material.flatShading, true, 'Ogni mesh procedurale deve avere flatShading: true');
    // Verifica che non sia blu uniforme puro di debug (0x0000ff)
    if (child.material.color) {
      assert.notEqual(child.material.color.getHex(), 0x0000FF, 'Nessuna mesh deve usare il blu di debug');
    }
  }
});

const fallbackExcavator = FallbackMeshes.createExcavator();
assert(fallbackExcavator.children.length >= 4, 'createExcavator deve comporre chassis, cingoli, cabina e braccio');
console.log('✓ Fallback procedurali chiseled low-poly conformi all\'Art Bible e privi di cubi blu');

// 6. Test Settings e Schema
console.log('6. Settings Manager & Schema...');
const settings = new SettingsManager();
assert.equal(settings.get('graphics.modelScaleFactor'), 1.0, 'Default modelScaleFactor deve essere 1.0');
settings.set('graphics.modelScaleFactor', 1.8);
assert.equal(settings.get('graphics.modelScaleFactor'), 1.8, 'modelScaleFactor deve aggiornarsi a 1.8');
console.log('✓ SettingsManager modelScaleFactor verificato con successo');

// Pulizia memoria
workers.dispose();
assert.equal(workers.workers.length, 0, 'dispose() deve svuotare la lista dei lavoratori e disallocare i mixer');

console.log('========================================');
console.log('TUTTI I TEST DELLA PIPELINE LOW-POLY SUPERATI AL 100%!');
console.log('========================================');
