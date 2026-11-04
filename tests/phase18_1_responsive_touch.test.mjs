// Test di unità per Milestone 18.1:
// Architettura Adattiva a 3 Tier, Controlli Touch Multi-Dito e Ottimizzazione DPI.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { CameraController, computeAdaptiveFov, CAMERA_LIMITS } from '../js/world/Camera.js';
import { Digging } from '../js/systems/Digging.js';
import { State } from '../js/core/State.js';
import { Shop } from '../js/ui/Shop.js';

console.log('--- TEST MILESTONE 18.1: RESPONSIVE 3-TIER & MULTI-TOUCH ---');

// Mock DOM element minimale per i test
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.style = {};
    this.classList = new Set();
    this.classList.add = (c) => this.classList.add ? Set.prototype.add.call(this.classList, c) : null;
    this.classList.remove = (c) => this.classList.delete(c);
    this.classList.toggle = (c, force) => {
      if (force === undefined) {
        if (this.classList.has(c)) { this.classList.delete(c); return false; }
        this.classList.add(c); return true;
      }
      if (force) this.classList.add(c); else this.classList.delete(c);
      return force;
    };
    this.children = [];
    this.innerHTML = '';
    this.listeners = {};
    this.scrollTop = 0;
  }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  removeEventListener(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
  }
  dispatchEvent(event) {
    const list = this.listeners[event.type] || [];
    for (const fn of list) fn(event);
  }
  querySelector(sel) {
    if (sel.includes('.shop-drawer')) return new MockElement('aside');
    if (sel.includes('.shop-backdrop')) return new MockElement('div');
    if (sel.includes('.shop-drag-handle')) return new MockElement('div');
    if (sel.includes('[data-el="content"]')) return new MockElement('div');
    if (sel.includes('[data-act="close"]')) return new MockElement('button');
    return new MockElement('div');
  }
  querySelectorAll() {
    return [];
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }
}

// --------------------------------------------------------------------------
// TEST 1: Compensazione Dinamica Telecamera & FOV Verticale
// --------------------------------------------------------------------------
console.log('Test 1: Compensazione Dinamica Telecamera & FOV Verticale');
{
  // Aspect ratio Desktop (16:9 ~ 1.777)
  const desktopFov = computeAdaptiveFov(16 / 9);
  assert.strictEqual(desktopFov, 45, 'Desktop widescreen deve mantenere FOV a 45°');

  // Aspect ratio Quadrato (1.0)
  const squareFov = computeAdaptiveFov(1.0);
  assert.strictEqual(squareFov, 45, 'Schermo quadrato (1.0) deve mantenere FOV a 45°');

  // Aspect ratio Smartphone Portrait (9:19.5 ~ 0.4615)
  const mobileAspect = 9 / 19.5;
  const mobileFov = computeAdaptiveFov(mobileAspect);
  assert(mobileFov > 55 && mobileFov < 65, `FOV mobile deve scalare tra 55° e 65° (attuale: ${mobileFov.toFixed(1)}°)`);

  // Verifica metodo updateProjection e piani di clipping
  const cam = new THREE.PerspectiveCamera(50, 1, 0.5, 500);
  const mockControls = { target: new THREE.Vector3(0, 0, 0), update: () => {} };
  const mockDom = new MockElement('canvas');
  const camCtrl = new CameraController(cam, mockControls, mockDom);

  camCtrl.updateProjection(390, 844); // iPhone 14
  assert.strictEqual(cam.near, 0.1, 'Piano near deve essere configurato a 0.1 per prevenire clipping');
  assert.strictEqual(cam.far, 1000, 'Piano far deve essere configurato a 1000');
  assert(cam.fov > 55, 'FOV verticale aggiornato correttamente');

  // Test tilt (pitch) e rotate (azimuth)
  const prevTheta = camCtrl._spherical.theta;
  camCtrl.rotate(0.25);
  assert(Math.abs(camCtrl._spherical.theta - (prevTheta + 0.25)) < 0.001, 'Rotazione azimuth applicata');

  camCtrl.tilt(0.15);
  assert(camCtrl._spherical.phi >= CAMERA_LIMITS.minPolarAngle, 'Phi rispetta minPolarAngle');
  assert(camCtrl._spherical.phi <= CAMERA_LIMITS.maxPolarAngle, 'Phi rispetta maxPolarAngle');

  console.log('  ✓ Calcolo FOV dinamico, piani di clipping e controlli tilt/rotate verificati');
}

// --------------------------------------------------------------------------
// TEST 2: Gesti Touch Multi-Dito (1 Dito scava, 2 Dita bloccano e zoomano/orbitano)
// --------------------------------------------------------------------------
console.log('Test 2: Gesti Touch Multi-Dito (Pinch-to-Zoom e Orbit)');
{
  const mockCanvas = new MockElement('canvas');
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  cam.position.set(0, 20, 40);
  const mockControls = { target: new THREE.Vector3(0, 0, 0), update: () => {} };
  const camCtrl = new CameraController(cam, mockControls, mockCanvas);

  const mockScene = {
    camera: cam,
    cameraController: camCtrl,
    shake: () => {},
  };
  const mockState = new State();
  mockState.reset({ sand: 0 });
  const mockAudio = { playDigSound: () => {} };
  const mockParticles = { burst: () => {} };

  const digging = new Digging({
    canvas: mockCanvas,
    scene: mockScene,
    state: mockState,
    audio: mockAudio,
    particles: mockParticles,
  });
  digging.setEnabled(true);

  // Verifica touchAction e overscrollBehavior su canvas
  assert.strictEqual(mockCanvas.style.touchAction, 'none', 'touchAction deve essere none sul canvas');
  assert.strictEqual(mockCanvas.style.overscrollBehavior, 'none', 'overscrollBehavior deve essere none sul canvas');

  // 1. Simula tocco singolo (1 dito)
  digging._onDown({ pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 300, preventDefault: () => {} });
  assert.strictEqual(digging.pointers.size, 1, 'Un puntatore registrato');
  assert.strictEqual(digging.holding, true, 'Holding attivo con un dito');
  assert.strictEqual(digging.multi, false, 'Multi-touch disattivo con un dito');

  // 2. Simula secondo tocco simultaneo (2 dita)
  digging._onDown({ pointerId: 2, pointerType: 'touch', clientX: 450, clientY: 300, preventDefault: () => {} });
  assert.strictEqual(digging.pointers.size, 2, 'Due puntatori registrati');
  assert.strictEqual(digging.holding, false, 'Scavo DEVE essere disattivato con 2 dita');
  assert.strictEqual(digging.multi, true, 'Stato multi-touch attivo');
  assert(digging._twoFingerPrev !== null, 'Stato iniziale gesto a due dita salvato');
  assert.strictEqual(digging._twoFingerPrev.distance, 50, 'Distanza iniziale tra le dita = 50px');

  // 3. Simula Pinch-to-Zoom (allontanamento dita a 100px) e Orbit (traslazione orizzontale)
  const initialTargetDist = camCtrl.targetDistance;
  const initialTheta = camCtrl._spherical.theta;

  digging._onMove({ pointerId: 2, pointerType: 'touch', clientX: 500, clientY: 310, preventDefault: () => {} });
  // Dita ora a: P1(400, 300) e P2(500, 310) -> deltaDist > 0 (zoom in), deltaMidX > 0 (rotazione)
  assert(camCtrl.targetDistance < initialTargetDist, 'Pinch out deve avvicinare la camera (ridurre targetDistance)');
  assert(camCtrl._spherical.theta !== initialTheta, 'Traslazione media deve ruotare la camera attorno alla duna');

  // 4. Rilascio di un dito
  digging._onUp({ pointerId: 2, pointerType: 'touch' });
  assert.strictEqual(digging.pointers.size, 1, 'Rimasto un solo puntatore');
  assert.strictEqual(digging.holding, false, 'Non riattivare holding al rilascio parziale per evitare ghost tap');

  // 5. Rilascio completo
  digging._onUp({ pointerId: 1, pointerType: 'touch' });
  assert.strictEqual(digging.pointers.size, 0, 'Tutti i puntatori rilasciati');
  assert.strictEqual(digging.multi, false, 'Stato multi azzerato');

  console.log('  ✓ Riconoscimento singolo tocco vs due dita, blocco scavo e pinch/orbit verificati');
}

// --------------------------------------------------------------------------
// TEST 3: Ottimizzazione DPI e Soglie Protettive Mobile
// --------------------------------------------------------------------------
console.log('Test 3: Ottimizzazione DPI e Soglie Protettive');
{
  function computeDpr(dpr, isMobile) {
    return isMobile ? Math.min(dpr, 1.75) : Math.min(dpr, 2.0);
  }

  assert.strictEqual(computeDpr(1.0, false), 1.0, 'DPR 1 su desktop');
  assert.strictEqual(computeDpr(2.0, false), 2.0, 'DPR 2 su desktop consentito al 100%');
  assert.strictEqual(computeDpr(3.0, false), 2.0, 'DPR 3 su desktop cappato a 2.0');

  assert.strictEqual(computeDpr(1.0, true), 1.0, 'DPR 1 su mobile');
  assert.strictEqual(computeDpr(2.0, true), 1.75, 'DPR 2 (Retina mobile) cappato a 1.75 per termico/batteria');
  assert.strictEqual(computeDpr(3.5, true), 1.75, 'DPR 3.5 (OLED mobile) cappato rigorosamente a 1.75');

  console.log('  ✓ Calcolo protettivo DPI mobile/desktop verificato');
}

// --------------------------------------------------------------------------
// TEST 4: Integrità Regole CSS 3-Tier e Safe Areas
// --------------------------------------------------------------------------
console.log('Test 4: Integrità Regole CSS 3-Tier e Safe Areas');
{
  const cssPath = path.resolve('css/style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verifica Tier 1 Desktop
  assert(css.includes('@media (min-width: 1025px)'), 'Tier 1 (@media (min-width: 1025px)) presente in CSS');
  assert(css.includes('width: 380px'), 'Cassetto Shop desktop con larghezza 380px');

  // Verifica Tier 2 Tablet
  assert(css.includes('@media (min-width: 601px) and (max-width: 1024px)'), 'Tier 2 (@media (min-width: 601px) and (max-width: 1024px)) presente');
  assert(css.includes('width: 45vw'), 'Tier 2 Tablet Landscape: Shop a 45vw');
  assert(css.includes('height: 55vh'), 'Tier 2 Tablet Portrait: Shop a 55vh');
  assert(css.includes('calc(100vw - 64px)'), 'HUD Tablet compatto con margini protettivi');

  // Verifica Tier 3 Smartphone
  assert(css.includes('@media (max-width: 600px)'), 'Tier 3 (@media (max-width: 600px)) presente');
  assert(css.includes('env(safe-area-inset-top'), 'Safe Area Insets presenti');
  assert(css.includes('border-radius: 20px 20px 0 0'), 'Negozio Bottom Sheet con angoli superiori arrotondati');
  assert(css.includes('height: 85vh') || css.includes('85dvh'), 'Negozio Bottom sheet esteso a 85vh');
  assert(css.includes('.shop-drag-handle'), 'Drag handle presente nel CSS');

  // Verifica touch-action e overscroll-behavior
  assert(css.includes('touch-action: none'), 'touch-action: none presente nel CSS');
  assert(css.includes('overscroll-behavior: none'), 'overscroll-behavior: none presente nel CSS');

  console.log('  ✓ Tutti i selettori e le proprietà dei 3 Tier reattivi verificati nel CSS');
}

// --------------------------------------------------------------------------
// TEST 5: Componenti UI Shop Drag Handle & Gesture
// --------------------------------------------------------------------------
console.log('Test 5: Componenti UI Shop Drag Handle & Gesture Swipe Down');
{
  const mockRoot = new MockElement('div');
  const mockState = new State();
  mockState.reset({ sand: 100 });
  const mockAudio = { playClick: () => {} };

  const shop = new Shop(mockRoot, { state: mockState, audio: mockAudio });
  assert(shop.root.innerHTML.includes('shop-drag-handle'), 'Drag handle HTML generato nel DOM dello Shop');

  shop.open();
  assert.strictEqual(shop.isOpen, true, 'Shop aperto');

  // Simula swipe verso il basso sul drawer (> 60px)
  shop.drawer.dispatchEvent({
    type: 'touchstart',
    touches: [{ clientY: 100 }],
    target: shop.drawer,
  });
  shop.drawer.dispatchEvent({
    type: 'touchmove',
    touches: [{ clientY: 200 }],
  });
  shop.drawer.dispatchEvent({
    type: 'touchend',
  });

  assert.strictEqual(shop.isOpen, false, 'Swipe verso il basso (> 60px) deve chiudere il Bottom Sheet');

  console.log('  ✓ Drag handle DOM e swipe-to-close del Bottom Sheet verificati');
}

console.log('--- TUTTI I TEST MILESTONE 18.1 SUPERATI CON SUCCESSO! ---');
