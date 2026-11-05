import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { PostProcessing, PostShader } from '../js/world/PostProcessing.js';
import { I18n } from '../js/core/I18n.js';

console.log('🧪 Avvio suite test: Architettura Illuminazione Avanzata...');

// 1. Verifica Dizionario I18n
console.log('  1. Verifica sincronizzazione chiavi i18n...');
const requiredKeys = [
  'settings.graphics.lighting_label',
  'settings.graphics.lighting_hint',
  'settings.graphics.tech_off',
  'settings.graphics.tech_gtao',
  'settings.graphics.tech_ssr',
  'settings.graphics.tech_ssgi',
  'settings.graphics.tech_webgpu',
  'settings.graphics.badge_off',
  'settings.graphics.badge_gtao',
  'settings.graphics.badge_ssr',
  'settings.graphics.badge_ssgi',
  'settings.graphics.badge_webgpu',
];

const i18n = new I18n();
for (const key of requiredKeys) {
  i18n.setLanguage('it');
  const valIt = i18n.t(key);
  assert.ok(valIt && valIt !== key, `Chiave IT mancante o non tradotta: ${key}`);

  i18n.setLanguage('en');
  const valEn = i18n.t(key);
  assert.ok(valEn && valEn !== key, `Chiave EN mancante o non tradotta: ${key}`);
}
console.log('    ✓ Tutte le chiavi di localizzazione IT/EN sono presenti e valide.');

// 2. Verifica SettingsManager e Backward Compatibility
console.log('  2. Verifica SettingsManager e sincronizzazione legacy SSR...');
const mockStorage = {};
const fakeLocalStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};
globalThis.localStorage = fakeLocalStorage;

const settings = new SettingsManager(fakeLocalStorage);
const currentTech = settings.get('graphics.lightingTechnique');
assert.ok(['off', 'gtao'].includes(currentTech), `Tecnica di default inattesa: ${currentTech}`);

// Test cambio tecnica
settings.set('graphics.lightingTechnique', 'ssr');
assert.equal(settings.get('graphics.lightingTechnique'), 'ssr');
assert.equal(settings.get('graphics.raytracingSSR'), true, 'graphics.raytracingSSR deve essere true quando lightingTechnique è ssr');

settings.set('graphics.lightingTechnique', 'gtao');
assert.equal(settings.get('graphics.lightingTechnique'), 'gtao');
assert.equal(settings.get('graphics.raytracingSSR'), false, 'graphics.raytracingSSR deve essere false quando lightingTechnique non è ssr');

// Test cambio legacy raytracingSSR
settings.set('graphics.raytracingSSR', true);
assert.equal(settings.get('graphics.lightingTechnique'), 'ssr', 'Attivando raytracingSSR deve impostare technique ssr');

settings.set('graphics.raytracingSSR', false);
assert.equal(settings.get('graphics.lightingTechnique'), 'off', 'Disattivando raytracingSSR deve impostare technique off');

console.log('    ✓ SettingsManager gestisce correttamente lightingTechnique e compatibilità legacy SSR.');

// 3. Mock Renderer per PostProcessing in ambiente Node
console.log('  3. Verifica PostProcessing, allocazione buffer e gestione uniform...');
const mockRenderer = {
  getSize: (target) => { target.set(800, 600); return target; },
  getPixelRatio: () => 1,
  render: () => {},
  getRenderTarget: () => null,
  setRenderTarget: () => {},
  clear: () => {},
  info: { autoReset: true, reset: () => {}, render: { calls: 0 } }
};
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);

const post = new PostProcessing(mockRenderer, scene, camera, settings);

// Test switch a OFF
post.setLightingTechnique('off');
assert.equal(post.getLightingTechnique(), 'off');
assert.equal(post.postMaterial.uniforms.uLightingMode.value, 0.0);
assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 0.0);
assert.equal(post.renderTarget.depthTexture, null, 'In modalità off depthTexture deve essere deallocata/null');

// Test switch a GTAO
post.setLightingTechnique('gtao');
assert.equal(post.getLightingTechnique(), 'gtao');
assert.equal(post.postMaterial.uniforms.uLightingMode.value, 1.0);
assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 0.0);
assert.ok(post.renderTarget.depthTexture !== null, 'In modalità gtao depthTexture deve essere allocata');

// Test switch a SSR
post.setLightingTechnique('ssr');
assert.equal(post.getLightingTechnique(), 'ssr');
assert.equal(post.postMaterial.uniforms.uLightingMode.value, 2.0);
assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 1.0);

// Test switch a SSGI
post.setLightingTechnique('ssgi');
assert.equal(post.getLightingTechnique(), 'ssgi');
assert.equal(post.postMaterial.uniforms.uLightingMode.value, 3.0);
assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 0.0);

// Test switch a WebGPU senza navigator.gpu (graceful fallback a SSGI)
post.setLightingTechnique('webgpu');
assert.equal(post.getLightingTechnique(), 'ssgi', 'In assenza di navigator.gpu deve scattare il fallback a ssgi');
assert.equal(post.postMaterial.uniforms.uLightingMode.value, 3.0);

// Test avanzamento uTime in update()
const initialTime = post.postMaterial.uniforms.uTime.value;
post.update(0.5);
assert.equal(post.postMaterial.uniforms.uTime.value, initialTime + 0.5, 'uTime deve avanzare con dt');

post.dispose();
console.log('    ✓ PostProcessing configura le uniform, gestisce fallback e libera le risorse.');

console.log('🎉 Tutti i test dell\'Architettura di Illuminazione sono passati con successo!');
