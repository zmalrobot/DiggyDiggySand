// Sistema delle Abilità Attive (Branch 4: Active Artifacts):
// Dinamite (A4.1), Vortice Khamsin (A4.2), Prisma di Atlantide (A4.3).
// Gestisce tempi di ricarica, durate attive, effetti fisici sul terreno, feedback VFX e SFX.
import * as THREE from 'three';
import { events } from '../core/Events.js';

export const ABILITY_DEFS = {
  dynamite: {
    id: 'dynamite',
    maxCd: 45,
    hotkey: 'SPACE',
    keyCodes: ['Space'],
    icon: `<svg class="ability-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 9h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/>
      <path d="M9 9V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/>
      <line x1="12" y1="2" x2="12" y2="4"/>
      <circle cx="12" cy="15" r="2" fill="currentColor"/>
    </svg>`,
  },
  vortex: {
    id: 'vortex',
    maxCd: 90,
    duration: 10,
    hotkey: '1',
    keyCodes: ['Digit1', 'Numpad1'],
    icon: `<svg class="ability-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 4c7 0 12 3 12 7s-5 7-12 7"/>
      <path d="M7 8c5 0 9 2 9 5s-4 5-9 5"/>
      <path d="M10 12c3 0 6 1 6 3s-3 3-6 3"/>
    </svg>`,
  },
  prism: {
    id: 'prism',
    maxCd: 150,
    duration: 6,
    hotkey: '2',
    keyCodes: ['Digit2', 'Numpad2', 'Digit3', 'Numpad3'],
    icon: `<svg class="ability-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
      <line x1="12" y1="22" x2="12" y2="12"/>
      <line x1="12" y1="12" x2="22" y2="8.5"/>
      <line x1="12" y1="12" x2="2" y2="8.5"/>
    </svg>`,
  },
};

export class Abilities {
  constructor({ game, state, scene, audio, digging, terrain = null, particles = null, haptics = null }) {
    this.game = game;
    this.state = state;
    this.scene = scene;
    this.audio = audio;
    this.digging = digging;
    this.terrain = terrain;
    this.particles = particles;
    this.haptics = haptics;

    this.cooldowns = {
      dynamite: 0,
      vortex: 0,
      prism: 0,
    };

    this.active = {
      vortex: 0,
      prism: 0,
    };

    this.prismBeamMesh = null;
    this._initPrismMesh();

    this._unsubs = [
      events.on('ability:trigger', ({ id }) => this.activate(id)),
    ];
  }

  setTerrain(t) {
    this.terrain = t;
  }

  _initPrismMesh() {
    if (!this.scene?.scene) return;
    const geom = new THREE.CylinderGeometry(0.8, 2.5, 45, 12, 1, true);
    geom.translate(0, 22.5, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00F2FF,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.prismBeamMesh = new THREE.Mesh(geom, mat);
    this.prismBeamMesh.visible = false;
    this.scene.scene.add(this.prismBeamMesh);
  }

  isUnlocked(id) {
    if (!id || !ABILITY_DEFS[id]) return false;
    return !!((this.state.upgrades[id] ?? 0) >= 1 || this.state.godMode);
  }

  getCooldown(id) {
    return Math.max(0, this.cooldowns[id] || 0);
  }

  canActivate(id) {
    return this.isUnlocked(id) && this.getCooldown(id) <= 0;
  }

  activate(id) {
    if (!this.canActivate(id)) return false;
    const def = ABILITY_DEFS[id];
    if (!def) return false;

    this.cooldowns[id] = def.maxCd;

    switch (id) {
      case 'dynamite':
        this._activateDynamite();
        break;
      case 'vortex':
        this._activateVortex();
        break;
      case 'prism':
        this._activatePrism();
        break;
    }

    events.emit('ability:used', { id });
    events.emit('abilities:update', this.getStatus());
    return true;
  }

  _activateDynamite() {
    const target = this._getTargetPoint();
    const stats = this.state.stats;
    const radius = Math.max(4.5, (stats.radius || 1.5) * 3.0);
    const depth = Math.max(2.0, (stats.power || 1.0) * 0.6 * 2.5);

    let removed = 0;
    if (this.terrain) {
      removed = this.terrain.dig(target.x, target.z, radius, depth);
      this.terrain.updateBounds?.();
      this.state.setCompletion(this.terrain.completion);
    }

    const baseGain = 1200;
    const amount = Math.floor(Math.max(baseGain, removed * 2.5) * (this.state.sandMultiplier || 1.0));
    this.state.addSand(amount);

    if (this.particles) {
      this.particles.burst(target.x, target.y + 0.5, target.z, {
        radius: radius * 1.2,
        color: 0xF5BA23,
        sparks: true,
      });
    }

    this.audio?.playDynamite?.();
    this.scene?.shake?.(0.38);
    this.haptics?.dynamite?.();

    if (this.game?.floatingText?.spawn3D) {
      this.game.floatingText.spawn3D({
        x: target.x,
        y: target.y + 2,
        z: target.z,
        text: `💥 +${amount}`,
        isCrit: true,
      });
    }
  }

  _activateVortex() {
    this.active.vortex = ABILITY_DEFS.vortex.duration;
    this.state.vortexActive = true;

    this.audio?.playVortex?.();
    this.scene?.shake?.(0.18);
    this.haptics?.burst?.();

    events.emit('event:boost', { active: true, label: '🌪️ VORTICE KHAMSIN (3x)' });
  }

  _activatePrism() {
    this.active.prism = ABILITY_DEFS.prism.duration;

    const target = this._getTargetPoint();
    if (this.prismBeamMesh) {
      this.prismBeamMesh.position.set(target.x, Math.max(0, target.y), target.z);
      this.prismBeamMesh.visible = true;
    }

    if (this.terrain) {
      this.terrain.dig(target.x, target.z, 5.5, 8.0);
      this.terrain.updateBounds?.();
      this.state.setCompletion(this.terrain.completion);
    }

    const lifetimeSand = this.state.totalSand || 0;
    const bounty = 15000 + Math.floor(lifetimeSand * 0.10);
    this.state.addSand(bounty);

    if (this.particles) {
      this.particles.burst(target.x, target.y + 1, target.z, {
        radius: 6.0,
        color: 0x0FE3C1,
        sparks: true,
      });
    }

    this.audio?.playPrismBeam?.();
    this.scene?.shake?.(0.28);
    this.haptics?.burst?.();

    if (this.game?.floatingText?.spawn3D) {
      this.game.floatingText.spawn3D({
        x: target.x,
        y: target.y + 3,
        z: target.z,
        text: `⚡ +${bounty}`,
        isCrit: true,
      });
    }
  }

  _getTargetPoint() {
    if (this.digging && this.digging.pointer?.inside) {
      const p = this.digging.pick(this.digging.pointer.x, this.digging.pointer.y);
      if (p) return p;
    }
    const ctrlTarget = this.game?.controls?.target;
    if (ctrlTarget && this.terrain) {
      const y = this.terrain.heightAt(ctrlTarget.x, ctrlTarget.z);
      return new THREE.Vector3(ctrlTarget.x, y, ctrlTarget.z);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  handleKeyDown(code) {
    for (const [id, def] of Object.entries(ABILITY_DEFS)) {
      if (def.keyCodes.includes(code)) {
        if (this.canActivate(id)) {
          this.activate(id);
          return true;
        }
      }
    }
    return false;
  }

  update(dt) {
    let dirty = false;

    // Aggiornamento cooldowns
    for (const id of Object.keys(this.cooldowns)) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
        dirty = true;
      }
    }

    // Aggiornamento durate attive
    if (this.active.vortex > 0) {
      this.active.vortex = Math.max(0, this.active.vortex - dt);
      if (this.active.vortex <= 0) {
        this.state.vortexActive = false;
        events.emit('event:boost', { active: false });
      }
      dirty = true;
    }

    if (this.active.prism > 0) {
      this.active.prism = Math.max(0, this.active.prism - dt);
      if (this.prismBeamMesh) {
        this.prismBeamMesh.rotation.y += dt * 5.0;
        const progress = this.active.prism / ABILITY_DEFS.prism.duration;
        this.prismBeamMesh.material.opacity = 0.35 + progress * 0.45;
      }
      if (this.active.prism <= 0 && this.prismBeamMesh) {
        this.prismBeamMesh.visible = false;
      }
      dirty = true;
    }

    if (dirty) {
      events.emit('abilities:update', this.getStatus());
    }
  }

  getStatus() {
    const list = {};
    for (const [id, def] of Object.entries(ABILITY_DEFS)) {
      const unlocked = this.isUnlocked(id);
      const cd = this.getCooldown(id);
      const pct = Math.max(0, Math.min(100, Math.round((cd / def.maxCd) * 100)));
      list[id] = {
        id,
        unlocked,
        cooldown: cd,
        maxCd: def.maxCd,
        cdPct: pct,
        isReady: unlocked && cd <= 0,
        active: this.active[id] > 0,
        hotkey: def.hotkey,
      };
    }
    return list;
  }

  dispose() {
    this._unsubs.forEach((u) => u());
    if (this.prismBeamMesh) {
      if (this.prismBeamMesh.parent) this.prismBeamMesh.parent.remove(this.prismBeamMesh);
      this.prismBeamMesh.geometry.dispose();
      this.prismBeamMesh.material.dispose();
      this.prismBeamMesh = null;
    }
  }
}
