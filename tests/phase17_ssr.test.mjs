// Test Unitari per la Fase 17: Simulazione Raytracing (SSR & SSAO) per Diggy Diggy Sand.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { PostProcessing } from '../js/world/PostProcessing.js';
import { i18n } from '../js/core/I18n.js';

console.log('--- TEST FASE 17: Raytracing SSR & SSAO ---');

// Mock localStorage per i test
const storage = new Map();
const mockLocalStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

// Mock minimale WebGLRenderer per ambiente Node.js headless
class MockRenderer {
  constructor() {
    this._size = new THREE.Vector2(800, 600);
    this._pixelRatio = 1;
    this.renderCalls = 0;
    this._target = null;
  }
  getSize(target) {
    target.copy(this._size);
    return target;
  }
  getPixelRatio() {
    return this._pixelRatio;
  }
  getRenderTarget() {
    return this._target;
  }
  setRenderTarget(t) {
    this._target = t;
  }
  clear() {}
  render() {
    this.renderCalls++;
  }
}

// 1. Test Impostazioni e Alias raytracingSSR / graphics.raytracingSSR
{
  console.log('Test 1: Impostazioni e Alias raytracingSSR');

  const settings = new SettingsManager(mockLocalStorage);
  assert.equal(settings.get('graphics.raytracingSSR'), false, 'graphics.raytracingSSR default è false');
  assert.equal(settings.get('raytracingSSR'), false, 'raytracingSSR alias restituisce false');

  // Aggiornamento tramite graphics.raytracingSSR
  let notifiedGraphics = null;
  let notifiedAlias = null;
  settings.subscribe('graphics.raytracingSSR', (v) => { notifiedGraphics = v; });
  settings.subscribe('raytracingSSR', (v) => { notifiedAlias = v; });

  settings.set('graphics.raytracingSSR', true);
  assert.equal(settings.get('graphics.raytracingSSR'), true);
  assert.equal(settings.get('raytracingSSR'), true);
  assert.equal(notifiedGraphics, true, 'Subscriber graphics.raytracingSSR notificato');
  assert.equal(notifiedAlias, true, 'Subscriber raytracingSSR alias notificato');

  // Aggiornamento tramite alias raytracingSSR
  settings.set('raytracingSSR', false);
  assert.equal(settings.get('graphics.raytracingSSR'), false);
  assert.equal(settings.get('raytracingSSR'), false);
  assert.equal(notifiedGraphics, false);
  assert.equal(notifiedAlias, false);

  console.log('  ✓ Schema settings e alias raytracingSSR bidirezionale verificati');
}

// 2. Test Traduzioni i18n per Raytracing SSR
{
  console.log('Test 2: Traduzioni i18n per Raytracing SSR');

  i18n.setLanguage('it');
  assert.ok(i18n.t('settings.raytracingSSR').includes('Raytracing'), 'IT title settings presente');
  assert.ok(i18n.t('settings.raytracingSSRHint').includes('GPU'), 'IT hint settings presente');
  assert.equal(i18n.t('graphics.ssr_title'), 'Raytracing & Riflessi SSR');
  assert.ok(i18n.t('graphics.ssr_desc').includes('SSAO'));

  i18n.setLanguage('en');
  assert.ok(i18n.t('settings.raytracingSSR').includes('Raytracing'), 'EN title settings presente');
  assert.ok(i18n.t('settings.raytracingSSRHint').includes('GPU'), 'EN hint settings presente');
  assert.equal(i18n.t('graphics.ssr_title'), 'Raytracing & SSR Reflections');
  assert.ok(i18n.t('graphics.ssr_desc').includes('ambient occlusion'));

  i18n.setLanguage('it'); // ripristina
  console.log('  ✓ Traduzioni IT ed EN per Raytracing SSR e SSAO verificate');
}

// 3. Test PostProcessing: Ciclo di Vita Depth Texture e Bypass a Costo Zero
{
  console.log('Test 3: PostProcessing Depth Texture & Zero-Cost Bypass');

  const renderer = new MockRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.5, 400);
  const settings = new SettingsManager(mockLocalStorage);
  settings.set('graphics.raytracingSSR', false);

  const post = new PostProcessing(renderer, scene, camera, settings);

  // Inizialmente disattivato (default)
  assert.equal(post.raytracingSSREnabled, false, 'SSR inizialmente disattivato');
  assert.equal(post.renderTarget.depthTexture, null, 'Nessuna depth texture allocata di default');
  assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 0.0, 'uRaytracingSSR è 0.0');
  assert.equal(post.postMaterial.uniforms.tDepth.value, post.dummyDepthTexture, 'tDepth punta a dummy 1x1');

  // Attivazione esplicita SSR
  post.setRaytracingSSREnabled(true);
  assert.equal(post.raytracingSSREnabled, true);
  assert.ok(post.renderTarget.depthTexture instanceof THREE.DepthTexture, 'DepthTexture creata correttamente');
  assert.equal(post.renderTarget.depthTexture.type, THREE.UnsignedShortType, 'DepthTexture type UnsignedShortType');
  assert.equal(post.postMaterial.uniforms.tDepth.value, post.renderTarget.depthTexture, 'tDepth punta alla depthTexture del renderTarget');
  assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 1.0, 'uRaytracingSSR è 1.0');

  // Disattivazione esplicita SSR
  post.setRaytracingSSREnabled(false);
  assert.equal(post.raytracingSSREnabled, false);
  assert.equal(post.renderTarget.depthTexture, null, 'depthTexture deallocata/resettata a null');
  assert.equal(post.postMaterial.uniforms.tDepth.value, post.dummyDepthTexture, 'tDepth ripristinata a dummy 1x1');
  assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 0.0, 'uRaytracingSSR è 0.0');

  // Attivazione reattiva tramite SettingsManager
  settings.set('graphics.raytracingSSR', true);
  assert.equal(post.raytracingSSREnabled, true, 'PostProcessing reagisce a settings.set(graphics.raytracingSSR, true)');
  assert.ok(post.renderTarget.depthTexture instanceof THREE.DepthTexture);
  assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 1.0);

  // Disattivazione reattiva tramite alias SettingsManager
  settings.set('raytracingSSR', false);
  assert.equal(post.raytracingSSREnabled, false, 'PostProcessing reagisce a settings.set(raytracingSSR, false)');
  assert.equal(post.renderTarget.depthTexture, null);
  assert.equal(post.postMaterial.uniforms.uRaytracingSSR.value, 0.0);

  console.log('  ✓ Ciclo di vita depth texture e zero-cost bypass verificati con successo');
}

// 4. Test Aggiornamento Matrici e Parametri di Rendering
{
  console.log('Test 4: Aggiornamento Matrici e Parametri SSR');

  const renderer = new MockRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 1.0, 500.0);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  const settings = new SettingsManager(mockLocalStorage);
  const post = new PostProcessing(renderer, scene, camera, settings);
  post.setRaytracingSSREnabled(true);

  // Eseguiamo un render
  post.render();

  // Verifichiamo che le matrici e parametri camera siano stati passati agli uniform
  assert.equal(post.postMaterial.uniforms.cameraNear.value, 1.0, 'cameraNear aggiornato correttamente');
  assert.equal(post.postMaterial.uniforms.cameraFar.value, 500.0, 'cameraFar aggiornato correttamente');

  const projMat = post.postMaterial.uniforms.cameraProjectionMatrix.value;
  assert.ok(projMat.equals(camera.projectionMatrix), 'cameraProjectionMatrix sincronizzata');

  const expectedInvProj = new THREE.Matrix4().copy(camera.projectionMatrix).invert();
  const actualInvProj = post.postMaterial.uniforms.cameraInverseProjectionMatrix.value;
  assert.ok(actualInvProj.equals(expectedInvProj), 'cameraInverseProjectionMatrix sincronizzata');

  // Test disattivazione globale PostProcessing
  post.setEnabled(false);
  const callsBefore = renderer.renderCalls;
  post.render();
  assert.equal(renderer.renderCalls, callsBefore + 1, 'Bypass diretto al renderer quando postProcessing disattivato');

  console.log('  ✓ Sincronizzazione matrici view/projection e bypass globale verificati');
}

console.log('--- TUTTI I TEST FASE 17 SUPERATI CON SUCCESSO ---');
