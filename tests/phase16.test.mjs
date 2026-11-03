// Test Unitari Fase 16: Risoluzione Texture (2048x2048 & Anisotropia), Transizioni Continue Giorno/Notte/Tempesta e Controlli Camera Q/E + Wheel
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain, createSandMicroTexture } from '../js/world/Terrain.js';
import { configureTextureAnisotropy } from '../js/world/SceneManager.js';
import { DayNightCycle } from '../js/world/DayNightCycle.js';
import { Torches } from '../js/world/Torches.js';
import { Sky } from '../js/world/Sky.js';
import { WorldEvents } from '../js/systems/WorldEvents.js';
import { CameraController, CAMERA_LIMITS } from '../js/world/Camera.js';
import { State } from '../js/core/State.js';

console.log('--- TEST FASE 16: Texture Nitidezza, Transizioni Continue & Camera Avanzata ---');

// 1. Verifica Texture Procedurale 2048x2048 e Anisotropia Massima
{
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
    }),
  };
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return { ...mockCanvas };
      return { classList: { add: () => {} }, append: () => {}, remove: () => {} };
    },
    getElementById: () => null,
    body: { append: () => {} },
  };

  const tex = createSandMicroTexture({ size: 2048, maxAnisotropy: 16 });
  assert.ok(tex, 'createSandMicroTexture deve generare un oggetto Texture valido');
  assert.equal(tex.wrapS, THREE.RepeatWrapping, 'wrapS deve essere RepeatWrapping');
  assert.equal(tex.wrapT, THREE.RepeatWrapping, 'wrapT deve essere RepeatWrapping');
  assert.equal(tex.repeat.x, 64, 'repeat X deve essere 64');
  assert.equal(tex.repeat.y, 64, 'repeat Y deve essere 64');
  assert.equal(tex.anisotropy, 16, 'anisotropy deve essere impostata a 16');
  assert.equal(tex.minFilter, THREE.LinearMipmapLinearFilter, 'minFilter deve essere LinearMipmapLinearFilter');
  assert.equal(tex.magFilter, THREE.LinearFilter, 'magFilter deve essere LinearFilter');

  const customTex = new THREE.Texture();
  configureTextureAnisotropy(customTex, 8);
  assert.equal(customTex.anisotropy, 8);
  assert.equal(customTex.minFilter, THREE.LinearMipmapLinearFilter);

  const terrain = new Terrain({ size: 100, res: 32, flat: true, maxAnisotropy: 16 });
  assert.ok(terrain.material.roughnessMap, 'Terrain material deve avere roughnessMap configurata');
  assert.ok(terrain.material.bumpMap, 'Terrain material deve avere bumpMap configurata');
  assert.equal(terrain.material.flatShading, true, 'flatShading: true obbligatorio da Art Bible');
  assert.equal(terrain.material.vertexColors, true, 'vertexColors: true');

  terrain.dispose();
  assert.equal(terrain.sandGrainTexture, null, 'dispose deve rilasciare sandGrainTexture');
  console.log('✓ 1. Micro-texture 2048x2048, Anisotropia massima e Terrain material verificati');
}

// 2. Ciclo Giorno/Notte Continuo (Zero salti a soglia)
{
  const scene = new THREE.Scene();
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.9);
  scene.fog = new THREE.FogExp2(0xd9b97a, 0.011);
  scene.add(dirLight, hemiLight);

  const cycle = new DayNightCycle({ scene, dirLight, hemiLight });

  // Test campionamento continuo su 50 step temporali: verifichiamo assenza di salti improvvisi
  let prevSunIntensity = dirLight.intensity;
  let prevHemiIntensity = hemiLight.intensity;

  for (let i = 0; i <= 100; i++) {
    const t = i / 100; // da 0 a 1
    cycle.setTimeOfDay(t);

    assert.ok(hemiLight.intensity >= 0.25, `Hemi intensity non deve mai scendere sotto 0.25 (valore: ${hemiLight.intensity})`);
    assert.ok(dirLight.intensity >= 0.35, `Sun intensity notturna minima >= 0.35 (valore: ${dirLight.intensity})`);

    // La variazione tra due step adiacenti (dt = 0.01 ciclo = 2.4s) deve essere morbida
    if (i > 0) {
      const deltaSun = Math.abs(dirLight.intensity - prevSunIntensity);
      const deltaHemi = Math.abs(hemiLight.intensity - prevHemiIntensity);
      assert.ok(deltaSun < 0.45, `Variazione brusca sun intensity: ${deltaSun}`);
      assert.ok(deltaHemi < 0.20, `Variazione brusca hemi intensity: ${deltaHemi}`);
    }

    prevSunIntensity = dirLight.intensity;
    prevHemiIntensity = hemiLight.intensity;
  }

  // Torce: rampa morbida al calar della sera
  const torches = new Torches(scene);
  torches.update(0.1, 0.0); // giorno pieno
  assert.equal(torches.lights[0].light.intensity, 0, 'Di giorno le torce devono essere spente');
  assert.equal(torches.lights[0].flame.visible, false);

  torches.update(0.1, 0.15); // crepuscolo iniziale
  assert.ok(torches.lights[0].flame.visible, 'Al crepuscolo la fiamma deve diventare visibile');
  assert.ok(torches.lights[0].flame.material.opacity > 0 && torches.lights[0].flame.material.opacity < 1.0, 'Opacità deve essere parziale (morbida)');
  assert.ok(torches.lights[0].light.intensity > 0, 'Intensità luce deve iniziare a salire');

  torches.update(0.1, 1.0); // notte fonda
  assert.ok(torches.lights[0].flame.material.opacity >= 0.99, 'A notte fonda la fiamma è al 100%');
  assert.ok(torches.lights[0].light.intensity > 10, 'A notte fonda intensità fiaccola al massimo');

  cycle.dispose();
  torches.dispose();
  console.log('✓ 2. DayNightCycle e Torches: lerp continuo, ambient floor >= 0.25 e rampa morbida verificati');
}

// 3. Tempesta di Sabbia con Transizione Graduale di 2.5s (Fog & Audio)
{
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xd9b97a, 0.011);
  const state = new State();
  let stormWindLogged = [];
  const mockAudio = {
    playStormSound: () => {},
    setStormWind: (intensity) => stormWindLogged.push(intensity),
  };

  const eventsSys = new WorldEvents({
    scene: { scene },
    terrain: null,
    state,
    audio: mockAudio,
    particles: null,
    banner: null,
    modal: null,
  });

  eventsSys.triggerEvent('sandstorm');
  assert.equal(eventsSys.activeEvent, 'sandstorm');
  assert.equal(eventsSys.stormFactor, 0, 'All\'avvio istantaneo il fattore transizione parte da 0');
  assert.equal(state.sandMultiplier, 1.5, 'Bonus economia attivo');

  // Avanzamento di 1.25s (metà fade-in)
  eventsSys.update(1.25);
  assert.ok(eventsSys.stormFactor > 0.45 && eventsSys.stormFactor < 0.55, `stormFactor deve essere ~0.5 a metà fade-in (ha: ${eventsSys.stormFactor})`);
  assert.ok(scene.fog.density > 0.011 && scene.fog.density < 0.0125, 'Nebbia densità intermedia');
  assert.ok(stormWindLogged.length > 0, 'AudioEngine.setStormWind invocato');

  // Avanzamento di altri 1.5s (fine fade-in)
  eventsSys.update(1.5);
  assert.equal(eventsSys.stormFactor, 1.0, 'stormFactor raggiunge 1.0 a piena tempesta');
  assert.equal(scene.fog.density, 0.0125, 'Nebbia densità massima tempesta');

  // Portiamo l'evento al termine della durata per testare il fade-out
  eventsSys.eventDuration = 0.5;
  eventsSys.update(0.6); // scatta fine durata -> entra in fade-out (stormTransition = -1)
  assert.equal(eventsSys.stormTransition, -1, 'Entra in fase di dissolvenza d\'uscita (-1)');

  // Avanzamento metà fade-out (1.25s)
  eventsSys.update(1.25);
  assert.ok(eventsSys.stormFactor > 0.4 && eventsSys.stormFactor < 0.6, `stormFactor in calo (ha: ${eventsSys.stormFactor})`);

  // Conclusione fade-out (altri 1.5s)
  eventsSys.update(1.5);
  assert.equal(eventsSys.stormFactor, 0, 'stormFactor azzerato a fine evento');
  assert.equal(eventsSys.activeEvent, null, 'Evento concluso con successo');
  assert.equal(state.sandMultiplier, 1.0, 'Moltiplicatore sabbia ripristinato');

  eventsSys.dispose();
  console.log('✓ 3. Transizione graduale tempesta (2.5s fade-in/fade-out, fog e wind audio) verificata');
}

// 4. CameraController: Rotazione Inerziale Q/E e Zoom Cinematico con Wheel
{
  const camera = new THREE.PerspectiveCamera(50, 1.5, 0.5, 300);
  camera.position.set(0, 30, 40);
  const target = new THREE.Vector3(0, 6, 0);

  const mockControls = {
    target,
    update: () => {},
    minDistance: 0,
    maxDistance: 0,
    enableZoom: true,
  };

  let wheelListener = null;
  const mockDom = {
    addEventListener: (evt, fn) => {
      if (evt === 'wheel') wheelListener = fn;
    },
    removeEventListener: () => {},
  };

  const camCtrl = new CameraController(camera, mockControls, mockDom);

  assert.equal(mockControls.enableZoom, false, 'OrbitControls zoom deve essere disabilitato a favore del CameraController');
  assert.equal(mockControls.minDistance, CAMERA_LIMITS.minDistance);
  assert.equal(mockControls.maxDistance, CAMERA_LIMITS.maxDistance);

  // Test rotazione Q (orario)
  const keysQ = new Set(['KeyQ']);
  const initialTheta = camCtrl._spherical.theta;

  // Premiamo Q per 0.5s
  for (let step = 0; step < 10; step++) {
    camCtrl.update(0.05, keysQ);
  }
  assert.ok(camCtrl.azimuthVelocity > 0, 'Tasto Q deve generare velocità azimutale positiva');
  assert.ok(camCtrl._spherical.theta > initialTheta, 'Angolo theta deve essere ruotato in senso orario');

  // Rilasciamo Q: l'inerzia deve smorzare gradualmente la velocità
  const velBeforeDamping = camCtrl.azimuthVelocity;
  camCtrl.update(0.2, new Set());
  assert.ok(camCtrl.azimuthVelocity < velBeforeDamping, 'Senza tasti attivi l\'inerzia deve smorzarsi');

  // Test rotazione E (antiorario)
  const keysE = new Set(['KeyE']);
  for (let step = 0; step < 20; step++) {
    camCtrl.update(0.05, keysE);
  }
  assert.ok(camCtrl.azimuthVelocity < 0, 'Tasto E deve generare velocità azimutale negativa');

  // Test Mouse Wheel Zoom con preventDefault e limiti rigidi
  let prevented = false;
  const fakeEvent = {
    deltaY: 100, // Zoom out
    preventDefault: () => { prevented = true; },
  };
  wheelListener(fakeEvent);
  assert.equal(prevented, true, 'wheel event deve invocare e.preventDefault()');
  assert.ok(camCtrl.targetDistance > camCtrl.currentDistance, 'deltaY positivo deve allontanare (aumentare targetDistance)');

  // Verifichiamo clamp minimo (12m)
  for (let i = 0; i < 50; i++) {
    wheelListener({ deltaY: -200, preventDefault: () => {} });
  }
  assert.equal(camCtrl.targetDistance, CAMERA_LIMITS.minDistance, `targetDistance non deve mai scendere sotto ${CAMERA_LIMITS.minDistance}`);

  // Verifichiamo clamp massimo (135m)
  for (let i = 0; i < 50; i++) {
    wheelListener({ deltaY: 200, preventDefault: () => {} });
  }
  assert.equal(camCtrl.targetDistance, CAMERA_LIMITS.maxDistance, `targetDistance non deve mai superare ${CAMERA_LIMITS.maxDistance}`);

  camCtrl.dispose();
  console.log('✓ 4. CameraController: rotazione orbitale Q/E, smorzamento inerziale e wheel zoom con clamping rigoroso verificati');
}

console.log('--- TUTTI I TEST DELLA FASE 16 SUPERATI CON SUCCESSO! ---');
process.exit(0);
