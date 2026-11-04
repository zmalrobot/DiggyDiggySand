import assert from 'node:assert';
import * as THREE from 'three';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { AssetLoader } from '../js/core/AssetLoader.js';
import { createMesh } from '../js/world/ProceduralFactory.js';
import { events } from '../js/core/Events.js';

console.log('--- TEST PIPELINE MODELLI 3D & HOT-SWAP ---');

// 1. SettingsManager: modelStyle setting
const mockStorage = {
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  clear() { this.data = {}; },
};

const settings = new SettingsManager(mockStorage);
assert.strictEqual(settings.get('graphics.modelStyle'), 'gltf', 'Default modelStyle deve essere gltf');
assert.strictEqual(settings.get('modelStyle'), 'gltf', 'Alias modelStyle deve funzionare');

let eventFired = false;
let receivedStyle = null;
events.on('settings:modelStyleChanged', (style) => {
  eventFired = true;
  receivedStyle = style;
});

settings.set('graphics.modelStyle', 'procedural');
assert.strictEqual(settings.get('graphics.modelStyle'), 'procedural');
assert.strictEqual(eventFired, true, 'Evento settings:modelStyleChanged deve essere emesso');
assert.strictEqual(receivedStyle, 'procedural');
console.log('✓ SettingsManager modelStyle e dispatch evento convalidati');

// 2. ProceduralFactory.createMesh
const testKeys = ['tools/shovel.glb', 'fleet/worker.glb', 'fleet/excavator.glb', 'city/obelisk.glb', 'city/chest.glb'];
for (const key of testKeys) {
  const mesh = createMesh(key);
  assert.ok(mesh instanceof THREE.Object3D, `createMesh("${key}") deve restituire un Object3D`);
}
console.log('✓ ProceduralFactory.createMesh convalidata per tutti gli asset chiave');

// 3. AssetLoader.getModel
const loader = new AssetLoader(settings);
// Modalità procedurale
const procWorker = loader.getModel('fleet/worker.glb');
assert.ok(procWorker instanceof THREE.Object3D);

// Registriamo un modello finto in cache per verificare la modalità gltf
const fakeGltfScene = new THREE.Group();
const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
fakeGltfScene.add(cube);
loader.models.set('fleet/worker.glb', fakeGltfScene);

settings.set('graphics.modelStyle', 'gltf');
const gltfWorker = loader.getModel('fleet/worker.glb');
assert.ok(gltfWorker instanceof THREE.Object3D);
assert.notStrictEqual(gltfWorker, fakeGltfScene, 'getModel deve clonare la scena');

// Verifica flatShading su materiali clonati
let hasFlatShading = false;
gltfWorker.traverse((child) => {
  if (child.isMesh && child.material) {
    if (child.material.flatShading) hasFlatShading = true;
    assert.strictEqual(child.castShadow, true, 'castShadow deve essere true');
    assert.strictEqual(child.receiveShadow, true, 'receiveShadow deve essere true');
  }
});
assert.strictEqual(hasFlatShading, true, 'flatShading deve essere forzato a true per la conformità chiseled');
console.log('✓ AssetLoader.getModel: switch GLTF / Procedurale e applicazione flatShading convalidati');

console.log('--- TUTTI I TEST PIPELINE MODELLI SUPERATI ---');
