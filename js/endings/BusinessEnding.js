// Finale C: L'Impresa di Scavo SRL (Art Bible §6, GDD §5.4)
// Anticlimax ironico: nessun tesoro né maledizione, solo roccia sterile, un secchiello e una flotta di macchinari quotata in borsa.
import * as THREE from 'three';
import { events } from '../core/Events.js';
import { toast } from '../ui/Modal.js';
import { formatNumber } from '../ui/Hud.js';

export class BusinessEnding {
  constructor() {
    this.id = 'business';
    this.name = 'L\'Impresa di Scavo SRL';
    this.triggered = false;
    this.elapsed = 0;
    this.siteSigns = null;
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
  }

  onProgress(completion) {}

  trigger(onFinish) {
    if (this.triggered) return;
    this.triggered = true;
    this.onFinish = onFinish;
    this.elapsed = 0;

    // 1. Zittisci la musica epica e lancia il fischio del vento
    this.audio?.stopAmbient?.();
    this.audio?.playWindWhistle?.();

    // 2. Luce asettica da cantiere a cielo aperto
    if (this.scene?.sun) {
      this.scene.sun.color.setHex(0xFFFFFF);
      this.scene.sun.intensity = 2.1;
    }
    if (this.scene?.scene?.fog) {
      this.scene.scene.fog.color.setHex(0xB0BEC5);
      this.scene.scene.fog.density = 0.0025;
    }

    // 3. Spunta cartello cantiere supplementare
    this._spawnConstructionProps();

    toast('Nessun mistero antico... Solo 300 tonnellate di roccia sterile rimossa!');
    events.emit('ending:business:triggered', { name: this.name });
  }

  _spawnConstructionProps() {
    this.siteSigns = new THREE.Group();
    // Barriere di sicurezza e birilli a strisce bianche e rosse
    const coneGeo = new THREE.ConeGeometry(0.3, 0.9, 8);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xFF5722, roughness: 0.5, flatShading: true });

    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      const a = (i / 4) * Math.PI * 2;
      cone.position.set(Math.cos(a) * 2.2, 0.45, Math.sin(a) * 2.2);
      this.siteSigns.add(cone);
    }

    this.scene?.scene?.add(this.siteSigns);
  }

  update(dt) {
    if (!this.triggered) return;
    this.elapsed += dt;

    if (this.elapsed >= 3.0 && this.onFinish) {
      const cb = this.onFinish;
      this.onFinish = null;

      const up = this.state?.upgrades ?? {};
      const fleetCount = (up.scarab ?? 0) + (up.excavator ?? 0) + (up.dredge ?? 0);
      const valuation = Math.floor(2500000 + (this.state?.totalSand ?? 0) * 8 + fleetCount * 150000);

      cb({
        endingId: 'business',
        title: 'L\'Impresa di Scavo SRL',
        badge: '🏗️',
        subtitle: 'Certificato di Costituzione Impresa Edile',
        text: 'Nessuna antica divinità, nessun cataclisma cosmico e nessun tesoro millenario. In fondo allo scavo c\'era solo un vecchio secchiello arrugginito. In compenso, hai rimosso milioni di tonnellate di sabbia fondando un colosso dell\'edilizia pesante con una flotta inarrestabile!',
        extra: {
          label: 'Valutazione d\'Impresa Stimata',
          value: `€ ${formatNumber(valuation)}`,
          fleetCount,
        },
        sandboxAvailable: true,
      });
    }
  }

  dispose() {
    if (this.siteSigns) {
      this.scene?.scene?.remove(this.siteSigns);
      for (const c of this.siteSigns.children) {
        c.geometry.dispose();
        c.material.dispose();
      }
      this.siteSigns = null;
    }
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
