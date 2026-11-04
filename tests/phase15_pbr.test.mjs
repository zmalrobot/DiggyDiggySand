// Test Unitari per la Fase 15: Texture PBR Procedurali FBM 2048px, Normal Maps Analitiche e Calibrazione Materiali Fisici.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  perlin2D,
  fbm2D,
  configurePbrTexture,
  generateSandPbrSet,
  generateChiseledStoneNormalMap,
  disposePbrTextures
} from '../js/world/TextureGenerator.js';
import { Terrain } from '../js/world/Terrain.js';
import { City } from '../js/world/City.js';
import { FallbackMeshes, createFallback } from '../js/world/ProceduralFactory.js';

console.log('--- TEST FASE 15: PBR PROCEDURALE, NORMAL MAPS E MATERIALI FISICI ---');

// Setup mock canvas per ambiente Node.js headless
function createTestMockCanvas(w, h) {
  const pixels = new Uint8ClampedArray(w * h * 4);
  return {
    width: w,
    height: h,
    getContext: (type) => {
      if (type !== '2d') return null;
      return {
        createImageData: (width, height) => ({
          data: pixels,
          width,
          height,
        }),
        putImageData: (img, x, y) => {
          pixels.set(img.data);
        },
        getImageData: (x, y, width, height) => ({
          data: pixels,
          width,
          height,
        }),
      };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

globalThis.__createMockCanvas = createTestMockCanvas;

// 1. Test Rumore Procedurale 2D (Perlin & FBM)
{
  console.log('Test 1: Rumore Procedurale 2D (Perlin & FBM)');
  
  // Test Perlin 2D: deterministico, continuo e compreso nell'intervallo [-1, 1]
  for (let x = 0; x <= 10; x += 1.5) {
    for (let y = 0; y <= 10; y += 1.5) {
      const val = perlin2D(x, y);
      assert.ok(!isNaN(val), `perlin2D(${x}, ${y}) non deve essere NaN`);
      assert.ok(val >= -1.05 && val <= 1.05, `perlin2D(${x}, ${y}) = ${val} deve essere compreso in [-1, 1]`);
    }
  }

  // Test FBM multi-ottava
  const fbmVal1 = fbm2D(1.2, 3.4, 5, 2.0, 0.5);
  const fbmVal2 = fbm2D(1.201, 3.401, 5, 2.0, 0.5);
  assert.ok(!isNaN(fbmVal1), 'fbm2D non deve essere NaN');
  assert.ok(Math.abs(fbmVal1 - fbmVal2) < 0.05, 'fbm2D deve mostrare continuità spaziale per coordinate adiacenti');

  console.log('  ✓ Perlin 2D e FBM multi-ottava continui e normalizzati');
}

// 2. Test Normal Map Analitica Sobel e Roughness Map del Terreno
{
  console.log('Test 2: Normal Map Analitica Sobel e Roughness Map del Terreno');

  disposePbrTextures();
  const testSize = 64; // dimensione ridotta per test rapido
  const pbr = generateSandPbrSet({ size: testSize, repeat: 32, maxAnisotropy: 16 });

  assert.ok(pbr.normalMap, 'normalMap deve essere generata');
  assert.ok(pbr.roughnessMap, 'roughnessMap deve essere generata');

  // Verifica parametri di campionamento
  assert.equal(pbr.normalMap.wrapS, THREE.RepeatWrapping, 'normalMap wrapS deve essere RepeatWrapping');
  assert.equal(pbr.normalMap.wrapT, THREE.RepeatWrapping, 'normalMap wrapT deve essere RepeatWrapping');
  assert.equal(pbr.normalMap.repeat.x, 32, 'repeat deve essere 32');
  assert.equal(pbr.normalMap.repeat.y, 32, 'repeat deve essere 32');
  assert.equal(pbr.normalMap.minFilter, THREE.LinearMipmapLinearFilter, 'minFilter deve essere LinearMipmapLinearFilter');
  assert.equal(pbr.normalMap.magFilter, THREE.LinearFilter, 'magFilter deve essere LinearFilter');
  assert.equal(pbr.normalMap.anisotropy, 16, 'anisotropy deve essere configurata');

  // Verifica codifica tangent-space dei pixel della normal map:
  // Nel tangent space, la componente Z (asse blu) punta verso l'esterno (+Z), quindi B >= 128
  const normalCanvas = pbr.normalMap.image;
  const ctx = normalCanvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, testSize, testSize).data;

  let validZCount = 0;
  let normalizedCount = 0;
  const sampleCount = testSize * testSize;

  for (let i = 0; i < sampleCount; i++) {
    const r = imgData[i * 4];
    const g = imgData[i * 4 + 1];
    const b = imgData[i * 4 + 2];
    const a = imgData[i * 4 + 3];

    assert.equal(a, 255, 'Alpha channel deve essere opaco 255');
    if (b >= 120) validZCount++;

    // Ricostruzione vettore unitario [-1, 1]
    const nx = (r / 255) * 2 - 1;
    const ny = (g / 255) * 2 - 1;
    const nz = (b / 255) * 2 - 1;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (Math.abs(len - 1.0) < 0.1) normalizedCount++;
  }

  assert.ok(validZCount / sampleCount > 0.99, 'Tutti i vettori normali puntano verso l\'esterno (Z positivo)');
  assert.ok(normalizedCount / sampleCount > 0.99, 'Tutti i vettori normali sono normalizzati a lunghezza unitaria ~1.0');

  // Verifica contrasto della Roughness Map
  const roughCanvas = pbr.roughnessMap.image;
  const roughCtx = roughCanvas.getContext('2d');
  const roughData = roughCtx.getImageData(0, 0, testSize, testSize).data;

  let minRough = 255, maxRough = 0;
  for (let i = 0; i < sampleCount; i++) {
    const val = roughData[i * 4];
    if (val < minRough) minRough = val;
    if (val > maxRough) maxRough = val;
  }

  assert.ok(minRough <= 160, `La roughness map deve avere zone lucide/glint minerali (min: ${minRough})`);
  assert.ok(maxRough >= 200, `La roughness map deve avere zone opache di sabbia asciutta (max: ${maxRough})`);

  // Verifica caching singleton
  const pbrCached = generateSandPbrSet({ size: testSize, repeat: 32, maxAnisotropy: 16 });
  assert.equal(pbrCached.normalMap, pbr.normalMap, 'Il set PBR generato deve provenire dalla cache per evitare memory leak VRAM');

  console.log('  ✓ Normal map analitica Sobel e Roughness map conformi alle specifiche PBR');
}

// 3. Test Normal Map Pietra Scalpellata (Chiseled Stone)
{
  console.log('Test 3: Normal Map Pietra Scalpellata (Chiseled Stone)');

  const stoneNorm = generateChiseledStoneNormalMap({ size: 64, repeat: 12, maxAnisotropy: 16 });
  assert.ok(stoneNorm, 'La texture chiseled_stone deve essere generata');
  assert.equal(stoneNorm.repeat.x, 12, 'repeat pietra scalpellata deve essere 12');
  assert.equal(stoneNorm.wrapS, THREE.RepeatWrapping, 'wrapS pietra deve essere RepeatWrapping');

  const stoneCanvas = stoneNorm.image;
  const stoneData = stoneCanvas.getContext('2d').getImageData(0, 0, 64, 64).data;
  let hasGrooves = false;

  for (let i = 0; i < 64 * 64; i++) {
    const nx = (stoneData[i * 4] / 255) * 2 - 1;
    if (Math.abs(nx) > 0.25) {
      hasGrooves = true;
      break;
    }
  }
  assert.ok(hasGrooves, 'La normal map della pietra deve presentare scanalature e scalpellature marcate');

  console.log('  ✓ Normal Map pietra scalpellata generata con scanalature visibili');
}

// 4. Test Integrazione Materiali Terreno
{
  console.log('Test 4: Integrazione Materiali Terreno');

  const terrain = new Terrain({ size: 100, res: 32, startHeight: 12, biome: 'desert', maxAnisotropy: 16 });
  const mat = terrain.material;

  assert.equal(mat.vertexColors, true, 'Il terreno deve mantenere vertexColors: true per la stratificazione');
  assert.equal(mat.flatShading, true, 'Il terreno deve mantenere flatShading: true per lo stile chiseled low-poly');
  assert.equal(mat.roughness, 0.85, 'Roughness del terreno calibrata a 0.85 per secchezza fotometrica');
  assert.equal(mat.metalness, 0.05, 'Metalness del terreno calibrata a 0.05');
  assert.ok(mat.normalMap, 'normalMap deve essere agganciata al materiale del terreno');
  assert.ok(mat.roughnessMap, 'roughnessMap deve essere agganciata al materiale del terreno');
  assert.equal(mat.normalScale.x, 0.6, 'normalScale.x deve essere 0.6 per rilievi controllati');
  assert.equal(mat.normalScale.y, 0.6, 'normalScale.y deve essere 0.6 per rilievi controllati');

  terrain.dispose();
  console.log('  ✓ Terrain.material rispetta tutti i parametri PBR e di shading');
}

// 5. Test Calibrazione Materiali su Rovine e Città Sepolta (City.js)
{
  console.log('Test 5: Calibrazione Materiali su Rovine e Città Sepolta (City.js)');

  const city = new City({ endingId: 'curse', floor: 0, biome: 'desert' });
  const mats = city.mats;

  // Arenaria e Pietra delle Rovine
  assert.equal(mats.stone.roughness, 0.88, 'Pietra: roughness 0.88');
  assert.equal(mats.stone.metalness, 0.02, 'Pietra: metalness 0.02');
  assert.ok(mats.stone.normalMap, 'Pietra: normalMap scalpellata presente');
  assert.equal(mats.stone.flatShading, true, 'Pietra: flatShading true');

  // Oro e Oricalco Atlantideo
  assert.equal(mats.gold.roughness, 0.22, 'Oro: roughness 0.22 (riflessi nitidi)');
  assert.equal(mats.gold.metalness, 0.85, 'Oro: metalness 0.85');
  assert.equal(mats.orichalcum.roughness, 0.22, 'Oricalco: roughness 0.22');
  assert.equal(mats.orichalcum.metalness, 0.85, 'Oricalco: metalness 0.85');

  // Cristalli e Canali di Energia
  assert.equal(mats.tealGlow.roughness, 0.1, 'Teal Glow: roughness 0.1 per bloom');
  assert.equal(mats.tealGlow.emissiveIntensity, 0.9, 'Teal Glow: emissiveIntensity 0.9');
  assert.equal(mats.cyanGlow.roughness, 0.1, 'Cyan Glow: roughness 0.1 per bloom');
  assert.equal(mats.cyanGlow.emissiveIntensity, 0.9, 'Cyan Glow: emissiveIntensity 0.9');

  // Biomi alternativi
  assert.equal(mats.coralStone.roughness, 0.88, 'Coral stone: roughness 0.88');
  assert.equal(mats.permafrostStone.roughness, 0.88, 'Permafrost stone: roughness 0.88');
  assert.equal(mats.jungleStone.roughness, 0.88, 'Jungle stone: roughness 0.88');

  // Verifica ombre cast/receive su tutte le mesh della città
  let totalMeshes = 0;
  let shadowValid = 0;
  city.group.traverse((obj) => {
    if (obj.isMesh) {
      totalMeshes++;
      if (obj.castShadow && obj.receiveShadow) shadowValid++;
    }
  });

  assert.ok(totalMeshes > 20, `La città deve generare strutture 3D (trovate: ${totalMeshes})`);
  assert.equal(shadowValid, totalMeshes, 'Tutti i mesh della città devono avere castShadow=true e receiveShadow=true');

  city.dispose();
  console.log('  ✓ City.js: materiali calibrati e ombre cast/receive verificate su tutti i mesh');
}

// 6. Test Calibrazione Materiali e Ombre su Mesh di Fallback (ProceduralFactory.js)
{
  console.log('Test 6: Calibrazione Materiali e Ombre su Mesh di Fallback (ProceduralFactory.js)');

  const pillar = FallbackMeshes.createPillar();
  pillar.traverse((o) => {
    if (o.isMesh) {
      assert.equal(o.castShadow, true, 'Pillar mesh deve avere castShadow=true');
      assert.equal(o.receiveShadow, true, 'Pillar mesh deve avere receiveShadow=true');
      assert.equal(o.material.roughness, 0.88, 'Pillar material deve avere roughness=0.88');
      assert.equal(o.material.metalness, 0.02, 'Pillar material deve avere metalness=0.02');
      assert.ok(o.material.normalMap, 'Pillar material deve avere la normalMap scalpellata');
    }
  });

  const excavator = FallbackMeshes.createExcavator();
  let foundOrichalcum = false;
  excavator.traverse((o) => {
    if (o.isMesh && o.material.metalness === 0.85) {
      assert.equal(o.material.roughness, 0.22, 'Oricalco escavatore deve avere roughness=0.22');
      foundOrichalcum = true;
    }
  });
  assert.ok(foundOrichalcum, 'Escavatore contiene componenti in oricalco PBR');

  const monolith = FallbackMeshes.createMonolith();
  let foundCrystal = false;
  monolith.traverse((o) => {
    if (o.isMesh && o.material.emissiveIntensity === 0.9) {
      assert.equal(o.material.roughness, 0.1, 'Monolite emissivo deve avere roughness=0.1');
      foundCrystal = true;
    }
  });
  assert.ok(foundCrystal, 'Monolite contiene materiali emissivi calibrati per il bloom');

  console.log('  ✓ ProceduralFactory: mesh di fallback conformi alle specifiche PBR e ombre');
}

// Pulizia finale
disposePbrTextures();
delete globalThis.__createMockCanvas;

console.log('--- TUTTI I TEST UNITARI DELLA FASE 15 PBR SUPERATI CON SUCCESSO! ---');
