// Finale B: Il Tesoro d'Oro Puro (Art Bible §6, GDD §5.3)
// Pioggia di monete e gemme luminescenti, cielo dorato splendente, gemme cliccabili per bonus astronomici.
import * as THREE from 'three';
import { events } from '../core/Events.js';
import { toast } from '../ui/Modal.js';
import { formatNumber } from '../ui/Hud.js';

export class TreasureEnding {
  constructor() {
    this.id = 'treasure';
    this.name = 'Il Tesoro d\'Oro Puro';
    this.triggered = false;
    this.elapsed = 0;
    this.treasureGroup = null;
    this.lootItems = [];
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.onFinish = null;
    this._handleClick = this._handleClick.bind(this);
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

    // 1. Audio e cielo dorato
    this.audio?.playTreasureShower?.();
    this.scene?.shake?.(0.18);

    if (this.scene?.sun) {
      this.scene.sun.color.setHex(0xFFE57F);
      this.scene.sun.intensity = 3.6;
    }
    if (this.scene?.scene?.fog) {
      this.scene.scene.fog.color.setHex(0xE0B84D);
      this.scene.scene.fog.density = 0.004;
    }

    // 2. Apri il forziere centrale se presente
    if (this.city?.treasureChest) {
      this.city.treasureChest.position.y += 0.5;
    }

    // 3. Spawna cascata di monete e gemme che precipitano
    this._spawnLootShower();

    // 4. Interazione click sulle gemme rimbalzanti
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this._handleClick);
    }
    toast('Un\'incredibile pioggia d\'oro e gemme! Clicca le gemme sul fondo per raccoglierle!');

    events.emit('ending:treasure:triggered', { name: this.name });
  }

  _spawnLootShower() {
    this.treasureGroup = new THREE.Group();
    const count = 65;

    const coinGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 12);
    const gemGeo = new THREE.OctahedronGeometry(0.4);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xF5BA23,
      metalness: 0.85,
      roughness: 0.25,
      flatShading: true,
      emissive: 0xC89849,
      emissiveIntensity: 0.3,
    });

    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x0FE3C1,
      metalness: 0.3,
      roughness: 0.1,
      flatShading: true,
      emissive: 0x00B4D8,
      emissiveIntensity: 0.9,
    });

    for (let i = 0; i < count; i++) {
      const isGem = i % 3 === 0;
      const mesh = new THREE.Mesh(isGem ? gemGeo : coinGeo, isGem ? gemMat : goldMat);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 22;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const startY = 22 + Math.random() * 20;

      mesh.position.set(x, startY, z);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      this.treasureGroup.add(mesh);
      this.lootItems.push({
        mesh,
        isGem,
        vy: -(12 + Math.random() * 10),
        rx: (Math.random() - 0.5) * 8,
        ry: (Math.random() - 0.5) * 8,
        floorY: Math.max(0.4, this.terrain ? this.terrain.heightAt(x, z) + 0.2 : 0.4),
        bounced: 0,
        collected: false,
      });
    }

    this.scene?.scene?.add(this.treasureGroup);
  }

  _handleClick(e) {
    if (!this.treasureGroup || !this.scene?.camera) return;
    const canvas = this.scene.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.scene.camera);
    const intersects = this.raycaster.intersectObjects(this.treasureGroup.children, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const item = this.lootItems.find((it) => it.mesh === hitMesh && !it.collected);
      if (item) {
        item.collected = true;
        this.treasureGroup.remove(item.mesh);
        this.audio?.playCoinGlitter?.();
        const bonus = item.isGem ? 250000 : 75000;
        this.state?.addSand?.(bonus);
        this.particlesSys?.burst?.(hitMesh.position.x, hitMesh.position.y, hitMesh.position.z, {
          radius: 2,
          color: item.isGem ? 0x0FE3C1 : 0xF5BA23,
          sparks: true,
          intensity: 2.0,
        });
        toast(`+${formatNumber(bonus)} Sabbia raccolta!`);
      }
    }
  }

  update(dt) {
    if (!this.triggered) return;
    this.elapsed += dt;

    // Fisica della caduta e rimbalzo dei tesori
    for (const it of this.lootItems) {
      if (it.collected) continue;
      if (it.mesh.position.y > it.floorY) {
        it.mesh.position.y += it.vy * dt;
        it.vy -= 22 * dt; // gravità
        it.mesh.rotation.x += it.rx * dt;
        it.mesh.rotation.y += it.ry * dt;
      } else {
        it.mesh.position.y = it.floorY;
        if (it.bounced < 2) {
          it.bounced++;
          it.vy = Math.abs(it.vy) * 0.45;
          it.mesh.position.y += it.vy * dt;
        } else {
          // A terra, ruota dolcemente su se stesso
          it.mesh.rotation.y += dt * 1.5;
        }
      }
    }

    // Epilogo mostrato dopo 4.6 secondi
    if (this.elapsed >= 4.6 && this.onFinish) {
      const cb = this.onFinish;
      this.onFinish = null;
      cb({
        endingId: 'treasure',
        title: 'Il Tesoro d\'Oro Puro',
        badge: '👑',
        subtitle: 'La Ricchezza Immortale di Atlantide',
        text: 'Sei oscenamente ricco! Le volte millenarie si sono spalancate, inondando la fossa di monete d\'oro zecchino, gemme cerulee e reliquie inestimabili d\'oricalco. Il deserto è stato domato e il suo tesoro più sontuoso è ora tuo.',
      });
    }
  }

  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this._handleClick);
    }
    if (this.treasureGroup) {
      this.scene?.scene?.remove(this.treasureGroup);
      for (const it of this.lootItems) {
        it.mesh.geometry.dispose();
        it.mesh.material.dispose();
      }
      this.treasureGroup = null;
      this.lootItems = [];
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
