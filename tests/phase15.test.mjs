// Test della Fase 15: Fix Blackout Grafica Alta, Antialiasing e Terreno Procedurale con Dune
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain, getInitialBiomeHeightOffset } from '../js/world/Terrain.js';
import { DayNightCycle } from '../js/world/DayNightCycle.js';
import { PostProcessing } from '../js/world/PostProcessing.js';

console.log('--- TEST FASE 15: Blackout Fix, Antialiasing & Dune Naturali ---');

// 1. Test Generazione Terreno Procedurale con Dune & Conservazione Volume
{
  const tDesert = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'desert' });
  const tOcean = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'ocean' });
  const tGlacier = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'glacier' });
  const tJungle = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'jungle' });

  // A. Verifica che il terreno iniziale non sia piatto
  let minH = Infinity, maxH = -Infinity;
  for (let i = 0; i < tDesert.heights.length; i++) {
    const h = tDesert.heights[i];
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  assert.ok(maxH - minH > 1.5, `Le dune del deserto devono avere rilievi ondulati (delta: ${maxH - minH})`);
  assert.ok(minH > 0, `Nessun vertice deve scendere sotto il bedrock (min: ${minH})`);

  // B. Verifica volume iniziale e completion pari esattamente a 0.00%
  const cellArea = tDesert.cell * tDesert.cell;
  let manualSum = 0;
  for (let i = 0; i < tDesert.heights.length; i++) {
    manualSum += (tDesert.heights[i] - tDesert.floor) * cellArea;
  }
  assert.ok(Math.abs(tDesert.initialVolume - manualSum) < 1e-4, 'initialVolume corrisponde alla somma reale dei vertici');
  assert.equal(tDesert.completion, 0, 'La percentuale di scavo iniziale parte esattamente da 0.00%');

  // C. Verifica normali calcolate fin dal primo frame (illuminazione plastica immediata)
  const norm = tDesert.geometry.attributes.normal;
  assert.ok(norm && norm.count === tDesert.heights.length, 'Normali geometriche presenti');
  let hasTiltedNormal = false;
  for (let i = 0; i < norm.count; i++) {
    const nx = norm.getX(i);
    const nz = norm.getZ(i);
    if (Math.abs(nx) > 0.01 || Math.abs(nz) > 0.01) {
      hasTiltedNormal = true;
      break;
    }
  }
  assert.ok(hasTiltedNormal, 'Normali non banali (orientate sulle pendenze delle dune)');

  // D. Verifica diversità morfologica tra biomi
  const offOceanCenter = getInitialBiomeHeightOffset(0, 0, 'ocean');
  const offDesertCenter = getInitialBiomeHeightOffset(0, 0, 'desert');
  const offGlacier = getInitialBiomeHeightOffset(15, 15, 'glacier');
  const offJungle = getInitialBiomeHeightOffset(15, 15, 'jungle');
  assert.ok(offOceanCenter < 0, `Oceano ha avvallamento/bacino centrale negativo (offset: ${offOceanCenter})`);
  assert.notEqual(offGlacier, offJungle, 'Ghiacciaio e Giungla hanno pattern altimetrici distinti');

  console.log('✓ 1. Generazione procedurale dune, volume rigoroso e normali 3D verificate');
}

// 2. Test Illuminazione di Sicurezza Ambient Floor, Calibrazione Notturna & Tone Mapping
{
  const fakeScene = new THREE.Scene();
  const fakeSun = new THREE.DirectionalLight(0xFFF4D4, 2.4);
  const fakeHemi = new THREE.HemisphereLight(0xA4D4F4, 0x6E563B, 0.9);
  const fakeAmbient = new THREE.AmbientLight(0x0D131A, 0.15);
  fakeScene.add(fakeSun, fakeHemi, fakeAmbient);

  const mockManager = {
    scene: fakeScene,
    sun: fakeSun,
    hemi: fakeHemi,
    ambientLight: fakeAmbient,
  };

  const dnc = new DayNightCycle(mockManager);

  // A. Pieno Giorno
  dnc.setMode('day');
  assert.ok(fakeSun.intensity >= 2.0, 'Intensità sole di giorno solare e radiosa');
  assert.ok(fakeHemi.intensity >= 0.8, 'Intensità emisferica diurna coerente');

  // B. Notte Fonda (nightFactor = 1.0)
  dnc.setMode('night');
  assert.equal(dnc.nightFactor, 1.0, 'NightFactor è 1.0 in modalità notte');
  // Verifica intensità minima garantita mai inferiore a 0.25 per il cielo notturno
  assert.ok(fakeHemi.intensity >= 0.25, `Luce cielo notturno non scende mai sotto 0.25 (attuale: ${fakeHemi.intensity})`);
  // Verifica colore blu abissale #1b2a40
  const hexHemiSky = fakeHemi.color.getHexString().toLowerCase();
  assert.equal(hexHemiSky, '1b2a40', 'Colore cielo notturno è blu abissale #1b2a40');
  // Verifica colore riflesso suolo #0d131a
  const hexHemiGnd = fakeHemi.groundColor.getHexString().toLowerCase();
  assert.equal(hexHemiGnd, '0d131a', 'Colore riflesso suolo notturno è #0d131a');
  // Verifica illuminazione floor
  assert.equal(fakeAmbient.intensity, 0.15, 'Ambient floor mantiene 0.15 per prevenire blackout');
  // Verifica luce lunare / sole notturno non azzerata
  assert.ok(fakeSun.intensity >= 0.35, `Luce lunare garantita >= 0.35 (attuale: ${fakeSun.intensity})`);

  dnc.dispose();
  console.log('✓ 2. Ambient floor, calibrazione notturna e min intensity garantita verificate');
}

// 3. Test Post-Processing: Samples 4x MSAA, Calibrazione Bloom, FXAA & Uscita Opaca
{
  const mockRenderer = {
    getSize: (v) => v.set(1920, 1080),
    getPixelRatio: () => 1,
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    clear: () => {},
    render: () => {},
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
  };
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera();

  const pp = new PostProcessing(mockRenderer, mockScene, mockCam);

  // A. Samples 4x MSAA nel render target
  assert.equal(pp.renderTarget.samples, 4, 'WebGLRenderTarget ha samples: 4 per antialiasing hardware');

  // B. Uniforms calibrate per evitare schermate nere e bloom aggressivo
  const uniforms = pp.postMaterial.uniforms;
  assert.equal(uniforms.uBloomThreshold.value, 0.85, 'Bloom threshold calibrato a 0.85');
  assert.equal(uniforms.uBloomIntensity.value, 0.4, 'Bloom intensity calibrata a 0.4');
  assert.equal(uniforms.uBloomRadius.value, 0.5, 'Bloom radius calibrato a 0.5');
  assert.ok(uniforms.uVignetteDarkness.value <= 0.35, 'Vignette darkness attenuata per evitare oscuramento');

  // C. Verifica shader per FXAA e canale alfa opaco 1.0
  const frag = pp.postMaterial.fragmentShader;
  assert.ok(frag.includes('applyFXAA'), 'Fragment shader include routine antialiasing FXAA');
  assert.ok(frag.includes('vec4(finalColor, 1.0)'), 'Fragment shader forza canale alfa a 1.0 (anti-blackout)');

  pp.dispose();
  console.log('✓ 3. PostProcessing MSAA 4x, calibrazione bloom, FXAA e alfa opaco verificati');
}

console.log('--- TUTTI I TEST DELLA FASE 15 SUPERATI CON SUCCESSO! ---');
