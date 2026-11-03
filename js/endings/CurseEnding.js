// Finale A: La Maledizione di Atlantide (Art Bible §6, GDD §5.2)
// Rottura del sigillo centrale, mutazione atmosferica cremisi/viola, sciami oscuri, rombo sismico.
import * as THREE from 'three';
import { events } from '../core/Events.js';

export class CurseEnding {
  constructor() {
    this.id = 'curse';
    this.name = 'La Maledizione di Atlantide';
    this.triggered = false;
    this.elapsed = 0;
    this.pillarGroup = null;
    this.particles = [];
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

    // Cache luci originali
    this.origSunColor = scene?.sun?.color?.clone();
    this.origSunIntensity = scene?.sun?.intensity ?? 2.4;
    this.origFogColor = scene?.scene?.fog?.color?.clone();
    this.origFogDensity = scene?.scene?.fog?.density ?? 0.0035;
  }

  onProgress(completion) {
    // Lievi presagi se richiamato dal manager
  }

  trigger(onFinish) {
    if (this.triggered) return;
    this.triggered = true;
    this.onFinish = onFinish;
    this.elapsed = 0;

    // 1. Audio e camera shake
    this.audio?.playCurseRumble?.();
    this.scene?.shake?.(0.35);

    // 2. Cielo e nebbia virano a rosso sangue e porpora abisso
    if (this.scene?.sun) {
      this.scene.sun.color.setHex(0x8B0000);
      this.scene.sun.intensity = 3.2;
    }
    if (this.scene?.scene?.fog) {
      this.scene.scene.fog.color.setHex(0x2E0854);
      this.scene.scene.fog.density = 0.012;
    }

    // 3. Colonna di anime / locuste oscure vorticose
    this._spawnDarkVortex();

    // 4. Se il santuario centrale ha il sigillo, fallo pulsare violentemente
    if (this.city?.curseSeal) {
      this.city.curseSeal.material.emissive?.setHex?.(0xFF0033);
      this.city.curseSeal.material.emissiveIntensity = 4.0;
    }

    events.emit('ending:curse:triggered', { name: this.name });
  }

  _spawnDarkVortex() {
    this.pillarGroup = new THREE.Group();
    const count = 70;
    const geom = new THREE.TetrahedronGeometry(0.35);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1A0505,
      emissive: 0x8B0000,
      emissiveIntensity: 1.8,
      flatShading: true,
      roughness: 0.6,
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      const angle = (i / count) * Math.PI * 2 * 3;
      const r = 1.0 + Math.random() * 4.5;
      mesh.position.set(
        Math.cos(angle) * r,
        2.5 + Math.random() * 22,
        Math.sin(angle) * r
      );
      mesh.scale.setScalar(0.7 + Math.random() * 0.9);
      this.pillarGroup.add(mesh);
      this.particles.push({
        mesh,
        baseAngle: angle,
        radius: r,
        baseY: mesh.position.y,
        speed: 1.8 + Math.random() * 2.2,
        rotSpeed: 2.0 + Math.random() * 3.0,
      });
    }

    this.scene?.scene?.add(this.pillarGroup);
  }

  update(dt) {
    if (!this.triggered) return;
    this.elapsed += dt;

    // Animazione particelle vortice oscuro
    if (this.particles.length > 0) {
      for (const p of this.particles) {
        p.baseAngle += p.speed * dt;
        p.mesh.position.x = Math.cos(p.baseAngle) * p.radius;
        p.mesh.position.z = Math.sin(p.baseAngle) * p.radius;
        p.mesh.position.y += dt * 4.5;
        if (p.mesh.position.y > 28) {
          p.mesh.position.y = 2.0 + Math.random() * 2.0;
        }
        p.mesh.rotation.x += p.rotSpeed * dt;
        p.mesh.rotation.y += p.rotSpeed * dt;
      }
    }

    // Battito pulsante del sigillo
    if (this.city?.curseSeal) {
      const pulse = 2.0 + Math.sin(this.elapsed * 8.0) * 1.8;
      this.city.curseSeal.material.emissiveIntensity = pulse;
    }

    // Conclusione e trigger overlay dopo ~3.6s
    if (this.elapsed >= 3.6 && this.onFinish) {
      const cb = this.onFinish;
      this.onFinish = null;
      cb({
        endingId: 'curse',
        title: 'La Maledizione di Atlantide',
        badge: '☠️',
        subtitle: 'L\'Antico Sigillo è Infranto',
        text: 'Forse avresti dovuto lasciare la sabbia dov\'era... Hai scavato troppo in profondità e l\'antico sigillo dell\'obelisco è andato in frantumi. Le tenebre millenarie sono state liberate sul mondo, tingendo il cielo di sangue e terrore cosmico.',
      });
    }
  }

  dispose() {
    if (this.pillarGroup) {
      this.scene?.scene?.remove(this.pillarGroup);
      for (const p of this.particles) {
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
      this.pillarGroup = null;
      this.particles = [];
    }
    // Ripristina luci originali se presenti
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

