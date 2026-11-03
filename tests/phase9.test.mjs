// Test unitari della Fase 9: Asset Loader Pipeline, Sostituzione Modelli 3D GLTF e Audio Campionato
// Esecuzione: node --import ./tests/register.mjs tests/phase9.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { AssetLoader, MODEL_REGISTRY } from '../js/core/AssetLoader.js';
import { AudioEngine } from '../js/core/AudioEngine.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { Workers, createScarabModel, createExcavatorModel, createDredgeModel } from '../js/systems/Workers.js';
import { City } from '../js/world/City.js';
import { State } from '../js/core/State.js';
import { Terrain } from '../js/world/Terrain.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };
const asyncT = async (name, fn) => { await fn(); passed++; console.log('ok -', name); };

const root = path.resolve(import.meta.dirname, '..');

async function runAll() {
  t('Verifica file 3D GLB: esistenza e intestazione binaria glTF 2.0', () => {
  const models = [
    'assets/models/tools/shovel_basic.glb',
    'assets/models/tools/shovel_atlantean.glb',
    'assets/models/machinery/worker_scarab.glb',
    'assets/models/machinery/excavator_steam.glb',
    'assets/models/machinery/dredge.glb',
    'assets/models/ruins/column.glb',
    'assets/models/ruins/temple_center.glb',
    'assets/models/ruins/chest.glb',
  ];

  for (const rel of models) {
    const full = path.join(root, rel);
    assert.ok(fs.existsSync(full), `Il file ${rel} deve esistere`);
    const buf = fs.readFileSync(full);
    assert.ok(buf.length > 20, `Il file ${rel} deve avere una dimensione valida`);
    const magic = buf.toString('ascii', 0, 4);
    assert.equal(magic, 'glTF', `Il file ${rel} deve iniziare con il magic number 'glTF'`);
    const version = buf.readUInt32LE(4);
    assert.equal(version, 2, `Il file ${rel} deve essere glTF versione 2`);
  }
});

t('Verifica file audio campionati: esistenza file OGG', () => {
  const audios = [
    'assets/audio/sfx_dig_sand.ogg',
    'assets/audio/sfx_coin_pickup.ogg',
    'assets/audio/sfx_earthquake.ogg',
    'assets/audio/ambient_desert_wind.ogg',
  ];

  for (const rel of audios) {
    const full = path.join(root, rel);
    assert.ok(fs.existsSync(full), `Il file audio ${rel} deve esistere`);
    const buf = fs.readFileSync(full);
    assert.ok(buf.length > 100, `Il file audio ${rel} deve avere dati validi`);
    const oggMagic = buf.toString('ascii', 0, 4);
    assert.equal(oggMagic, 'OggS', `Il file ${rel} deve avere intestazione OggS`);
  }
});

t('MODEL_REGISTRY: mappatura corretta dei modelli e fallback', () => {
  const requiredKeys = [
    'tools/shovel_basic.glb',
    'tools/shovel_atlantean.glb',
    'machinery/worker_scarab.glb',
    'machinery/excavator_steam.glb',
    'machinery/dredge.glb',
    'ruins/column.glb',
    'ruins/temple_center.glb',
    'ruins/chest.glb',
  ];

  for (const key of requiredKeys) {
    assert.ok(MODEL_REGISTRY[key], `MODEL_REGISTRY deve contenere la chiave ${key}`);
    assert.ok(MODEL_REGISTRY[key].id, `Entry per ${key} deve avere un id`);
    assert.ok(MODEL_REGISTRY[key].file, `Entry per ${key} deve avere un path file`);
    assert.ok(MODEL_REGISTRY[key].fallback, `Entry per ${key} deve avere un fallback`);
  }
});

await asyncT('Parsing GLTF dei modelli binari con Three.js GLTFLoader', async () => {
  const loader = new GLTFLoader();
  const testFiles = [
    'assets/models/tools/shovel_basic.glb',
    'assets/models/machinery/worker_scarab.glb',
    'assets/models/ruins/column.glb',
  ];

  for (const rel of testFiles) {
    const full = path.join(root, rel);
    const buf = fs.readFileSync(full);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    const gltf = await new Promise((resolve, reject) => {
      loader.parse(arrayBuffer, '', resolve, reject);
    });

    assert.ok(gltf.scene, `Il file ${rel} deve essere caricato come THREE.Group/Scene`);
    let meshCount = 0;
    gltf.scene.traverse((o) => {
      if (o.isMesh) meshCount++;
    });
    assert.ok(meshCount > 0, `Il file ${rel} deve contenere almeno una mesh`);
  }
});

t('AssetLoader: fallback procedurale robusto e getModel()', () => {
  const assets = new AssetLoader();
  let fallbackCalled = false;
  const customFallback = () => {
    fallbackCalled = true;
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  };

  const model = assets.getModel('non_existent_model.glb', customFallback);
  assert.ok(fallbackCalled, 'Il fallbackGenerator deve essere invocato per modelli non presenti');
  assert.ok(model.isMesh, 'Il modello restituito deve essere un Three.js Object3D');

  // Test _prepareMesh con flatShading e shadow
  const testRoot = new THREE.Group();
  const testMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ flatShading: false, roughness: 0.1 })
  );
  testRoot.add(testMesh);
  assets._prepareMesh(testRoot);

  assert.equal(testMesh.castShadow, true, 'castShadow deve essere abilitato');
  assert.equal(testMesh.receiveShadow, true, 'receiveShadow deve essere abilitato');
  assert.equal(testMesh.material.flatShading, true, 'flatShading deve essere forzato a true per Art Bible');
});

await asyncT('AudioEngine: buffer pool e caricamento campioni con fallback sicuro', async () => {
  const settings = new SettingsManager();
  const audio = new AudioEngine(settings);

  assert.ok(audio.buffers instanceof Map, 'AudioEngine deve avere un pool di buffers (Map)');

  // In ambiente Node (dove fetch/AudioContext sono parzialmente mockati o assenti),
  // loadSample non deve lanciare eccezioni ma restituire null con fallback.
  const sample = await audio.loadSample('test_sample', 'http://invalid-url.dds/sound.ogg');
  assert.equal(sample, null, 'loadSample fallisce in modo sicuro senza rompere il loop');

  // Verifica che i metodi di riproduzione non crashino anche senza AudioContext attivo
  audio.playDigSound(1.0);
  audio.playPurchaseSound();
  audio.playCurseRumble();
  audio.startAmbient();
  audio.stopAmbient();
  audio.dispose();
  assert.equal(audio.buffers.size, 0, 'dispose deve svuotare i buffer audio');
});

t('Workers: integrazione con AssetLoader e spawn dei modelli 3D', () => {
  const state = new State();
  const terrain = new Terrain({ size: 64, res: 32, startHeight: 12 });
  const scene = { assets: new AssetLoader(), shake: () => {} };

  // Spawna con fallback integrato
  const workers = new Workers({
    terrain,
    state,
    particles: { burst: () => {} },
    scene,
    assets: scene.assets,
  });

  assert.ok(workers.assets, 'Workers deve avere il riferimento ad assets');

  // Verifica modelli procedurali come generatori di fallback
  const scarab = createScarabModel();
  assert.ok(scarab.isObject3D, 'createScarabModel genera un Three.js Group');
  assert.ok(scarab.name === 'scarab');

  const excavator = createExcavatorModel();
  assert.ok(excavator.isObject3D, 'createExcavatorModel genera un Three.js Group');
  assert.ok(excavator.name === 'excavator');

  const dredge = createDredgeModel();
  assert.ok(dredge.isObject3D, 'createDredgeModel genera un Three.js Group');
  assert.ok(dredge.name === 'dredge');

  // Test acquisto scarab per verificare spawn
  workers.syncWithUpgrades({ scarab: 1 });
  assert.equal(workers.workers.length, 1, 'Deve essere generato 1 lavoratore scarab');
  assert.equal(workers.workers[0].type, 'scarab');
  assert.ok(workers.workers[0].mesh);

  workers.dispose();
  terrain.dispose();
});

t('City: integrazione con AssetLoader per obelisco, colonne e forziere', () => {
  const assets = new AssetLoader();
  const city = new City({ endingId: 'treasure', floor: 0, assets });

  assert.equal(city.assets, assets, 'City deve memorizzare assets');
  assert.ok(city.group.children.length > 0, 'City group deve contenere gli elementi urbani');
  assert.ok(city.treasureChest, 'Il forziere del tesoro deve essere generato');

  city.dispose();
});

console.log(`\nFase 9 test completati: ${passed} superati con successo.\n`);
}

await runAll();
