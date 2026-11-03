// Finale Segreto: L'Ascensione di Atlantide (Fase 6: Epilogo 4/4).
// Risveglio del cuore d'Oricalco, geyser di luce ciano, levitazione degli edifici ed epilogo trionfale.
import * as THREE from 'three';
import { events } from '../core/Events.js';

export class SecretEnding {
  constructor() {
    this.id = 'secret';
    this.name = 'L\'Ascensione di Atlantide';
    this.triggered = false;
    this.elapsed = 0;
    this.geyserGroup = null;
    this.geysers = [];
    this.initialCityPos = new Map();
    this.onFinish = null;
  }

  prepare({ scene, terrain, state, audio, particles, city, controls }) {
    this.scene = scene;
    this.terrain = terrain;
    this.state = state;
    this.audio = audio;
    this.particlesSys = particles;
    this.city = city;
    this.controls = controls;

    this.origSunColor = scene?.sun?.color?.clone();
    this.origSunIntensity = scene?.sun?.intensity ?? 2.4;
    this.origFogColor = scene?.scene?.fog?.color?.clone();
    this.origFogDensity = scene?.scene?.fog?.density ?? 0.0035;

    // Salva le posizioni iniziali degli edifici della città per animare la levitazione
    if (this.city?.group) {
      this.city.group.traverse((o) => {
        if (o.isMesh) {
          this.initialCityPos.set(o, o.position.clone());
        }
      });
    }
  }

  onProgress(completion) {}

  trigger(onFinish) {
    if (this.triggered) return;
    this.triggered = true;
    this.onFinish = onFinish;
    this.elapsed = 0;

    // 1. Audio e cielo ciano/aurorale
    this.audio?.playAscensionChime?.();
    this.scene?.shake?.(0.22);

    if (this.scene?.sun) {
      this.scene.sun.color.setHex(0x0FE3C1);
      this.scene.sun.intensity = 3.8;
    }
    if (this.scene?.scene?.fog) {
      this.scene.scene.fog.color.setHex(0x032838);
      this.scene.scene.fog.density = 0.005;
    }

    // 2. Geyser di luce e acqua ciano
    this._spawnGeysers();

    events.emit('ending:secret:triggered', { name: this.name });
  }

  _spawnGeysers() {
    this.geyserGroup = new THREE.Group();
    const count = 55;
    const geom = new THREE.OctahedronGeometry(0.3, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x84FFF0,
      emissive: 0x0FE3C1,
      emissiveIntensity: 2.2,
      flatShading: true,
      roughness: 0.2,
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 8.5;
      mesh.position.set(Math.cos(angle) * r, 0.5 + Math.random() * 18, Math.sin(angle) * r);
      this.geyserGroup.add(mesh);
      this.geysers.push({
        mesh,
        vy: 14 + Math.random() * 12,
        baseY: 0.5,
        rotSpeed: 3 + Math.random() * 4,
      });
    }

    this.scene?.scene?.add(this.geyserGroup);
  }

  update(dt) {
    if (!this.triggered) return;
    this.elapsed += dt;

    // 1. Animazione geyser verticali
    for (const g of this.geysers) {
      g.mesh.position.y += g.vy * dt;
      g.mesh.rotation.y += g.rotSpeed * dt;
      g.mesh.rotation.x += g.rotSpeed * 0.5 * dt;
      if (g.mesh.position.y > 28) {
        g.mesh.position.y = g.baseY + Math.random() * 2;
      }
    }

    // 2. Levitazione poetica delle rovine cittadine
    const levitationFactor = Math.min(1.0, this.elapsed / 3.5);
    const floatHeight = levitationFactor * 5.5;

    for (const [mesh, initPos] of this.initialCityPos.entries()) {
      const wave = Math.sin(this.elapsed * 2.0 + initPos.x * 0.5 + initPos.z * 0.5) * 0.45;
      mesh.position.y = initPos.y + floatHeight + wave;
    }

    // 3. Epilogo dopo 4.5s
    if (this.elapsed >= 4.5 && this.onFinish) {
      const cb = this.onFinish;
      this.onFinish = null;
      cb({
        endingId: 'secret',
        title: 'L\'Ascensione di Atlantide',
        badge: '🔱',
        subtitle: 'Il Risveglio della Civiltà Sommersa',
        text: 'Non hai liberato una maledizione, né cercato mero oro o profitto: hai risvegliato il cuore perduto di Atlantide. La città millenaria risorge dalle sabbie eterne verso il cielo, incoronandoti Primo Custode dell\'Oricalco.',
        sandboxAvailable: true,
      });
    }
  }

  dispose() {
    if (this.geyserGroup) {
      this.scene?.scene?.remove(this.geyserGroup);
      for (const g of this.geysers) {
        g.mesh.geometry.dispose();
        g.mesh.material.dispose();
      }
      this.geyserGroup = null;
      this.geysers = [];
    }

    // Ripristina quote iniziali edifici
    for (const [mesh, initPos] of this.initialCityPos.entries()) {
      mesh.position.copy(initPos);
    }
    this.initialCityPos.clear();

    if (this.origSunColor && this.scene?.sun) {
      this.scene.sun.color.copy(this.origSunColor);
      this.scene.sun.intensity = this.origSunIntensity;
    }
    if (this.origFogColor && this.scene?.scene?.fog) {
      this.scene.scene.fog.color.copy(this.origFogColor);
      this.scene.scene.fog.density = this.origFogDensity;
    }
    this.triggered = false;
    this.elapsed = 0;
    this.onFinish = null;
  }
}

