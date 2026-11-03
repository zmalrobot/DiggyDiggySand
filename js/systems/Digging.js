// Input e meccanica di scavo: tap singolo e hold con colpi cadenzati da `digRate`.
// Raycast analitico sulla heightmap (Terrain.raycast). Mouse/touch: un puntatore scava,
// il secondo puntatore (gesto a due dita) annulla lo scavo e lascia la camera a OrbitControls.
import * as THREE from 'three';
import { events } from '../core/Events.js';
import { MIN_TICK } from '../core/State.js';
import { getLayerColor } from '../world/Terrain.js';


const DEPTH_PER_POWER = 0.6; // metri scavati al centro per punto di power
const RETICLE_SEGMENTS = 48;
const MAX_HITS_PER_FRAME = 3;

export class Digging {
  /** @param {{canvas, scene, state, audio, particles}} deps  scene = SceneManager (camera, shake). */
  constructor({ canvas, scene, state, audio, particles }) {
    this.canvas = canvas;
    this.scene = scene;
    this.state = state;
    this.audio = audio;
    this.particles = particles;
    this.terrain = null;
    this.enabled = false;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.pointers = new Map();   // pointerId -> {x, y}
    this.primaryId = null;
    this.holding = false;
    this.multi = false;          // gesto a più dita in corso
    this.cooldown = 0;
    this.lastHit = 0;
    this.hoverDirty = false;
    this._boundsTimer = 0;
    this._needsBoundsUpdate = false;
    this.pointer = { x: 0, y: 0, inside: false };
    this.shovelSkin = 'shovel_bronze';

    this._buildReticle();
    this._bind();

    this._unsubCosmetics = events.on('cosmetics:equipped', ({ category, id }) => {
      if (category === 'shovel') this.setShovelSkin(id);
    });
  }

  setShovelSkin(skinId) {
    this.shovelSkin = skinId;
    const colors = {
      shovel_bronze: 0x0FE3C1,
      shovel_gold: 0xF5BA23,
      shovel_crystal: 0x00F2FF,
      shovel_obsidian: 0xFF3366,
    };
    if (this.reticle?.material && colors[skinId]) {
      this.reticle.material.color.setHex(colors[skinId]);
    }
  }

  setTerrain(terrain) { this.terrain = terrain; }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this._cancel();
    this.reticle.visible = false;
  }

  _buildReticle() {
    const pts = [];
    for (let i = 0; i < RETICLE_SEGMENTS; i++) pts.push(new THREE.Vector3(Math.cos((i / RETICLE_SEGMENTS) * Math.PI * 2), 0, Math.sin((i / RETICLE_SEGMENTS) * Math.PI * 2)));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.reticle = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x0FE3C1, transparent: true, opacity: 0.85, depthTest: false }));
    this.reticle.renderOrder = 10;
    this.reticle.frustumCulled = false;
    this.reticle.visible = false;
    this._unit = pts;
  }

  _bind() {
    const c = this.canvas;
    if (c) c.style.touchAction = 'none';

    this._onDown = (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return; // destro/centrale: camera
      if (e.pointerType === 'touch') e.preventDefault?.();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
      if (this.pointers.size > 1) { this.multi = true; this._cancel(); return; }
      this.primaryId = e.pointerId;
      this.holding = true;
      this.cooldown = 1 / Math.max(0.1, this.state.stats.digRate);
      this._hit(); // colpo immediato = tap singolo
    };
    this._onMove = (e) => {
      if (e.pointerType === 'touch') e.preventDefault?.();
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
      const p = this.pointers.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }
      this.hoverDirty = true;
    };
    this._onUp = (e) => {
      this.pointers.delete(e.pointerId);
      if (e.pointerId === this.primaryId) this._cancel();
      if (e.pointerType !== 'mouse') this.pointer.inside = false;
      if (this.pointers.size === 0) this.multi = false;
    };
    this._onLeave = () => { this.pointer.inside = false; this.reticle.visible = false; };
    this._onBlur = () => { this.pointers.clear(); this.multi = false; this._cancel(); };
    this._onCtx = (e) => e.preventDefault();
    this._onGesture = (e) => e.preventDefault();

    c?.addEventListener?.('pointerdown', this._onDown, { passive: false });
    c?.addEventListener?.('pointermove', this._onMove, { passive: false });
    c?.addEventListener?.('pointerleave', this._onLeave);
    c?.addEventListener?.('contextmenu', this._onCtx);

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pointerup', this._onUp);
      window.addEventListener('pointercancel', this._onUp);
      window.addEventListener('blur', this._onBlur);
      window.addEventListener('gesturestart', this._onGesture, { passive: false });
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', this._onBlur);
    }
  }

  _cancel() {
    this.holding = false;
    this.primaryId = null;
    if (this._needsBoundsUpdate) {
      this.terrain?.updateBounds?.();
      this._needsBoundsUpdate = false;
    }
  }

  /** Converte coordinate schermo in punto world sul terreno (o null). */
  pick(clientX, clientY) {
    if (!this.terrain) return null;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.scene.camera);
    return this.terrain.raycast(this.raycaster.ray);
  }

  /** Esegue un colpo alla posizione corrente del puntatore. Ritorna la sabbia guadagnata (0 se niente). */
  _hit() {
    const now = performance.now();
    const minInterval = this.state?.godMode ? 0 : MIN_TICK * 1000;
    if (now - this.lastHit < minInterval) return 0;
    const p = this.pick(this.pointer.x, this.pointer.y);
    if (!p) return 0;
    this.lastHit = now;
    this._needsBoundsUpdate = true;
    this.state?.registerClick?.();
    return this.dig(p);
  }

  /** Scavo in un punto world già calcolato (usato anche dai test e da futuri worker). */
  dig(p) {
    const { power, radius } = this.state.stats;
    const depth = power * DEPTH_PER_POWER;
    const removed = this.terrain.dig(p.x, p.z, radius, depth);
    if (removed <= 0) return 0; // bedrock raggiunto

    // Sabbia = power * quota del volume "ideale" (cono pieno) effettivamente rimossa.
    const cone = (depth * Math.PI * radius * radius) / 3;
    const amount = power * Math.min(1, removed / cone);
    this.state.addSand(amount);
    this.state.setCompletion(this.terrain.completion);

    const activePalette = this.terrain?.activeBiome;
    const col = getLayerColor(p.y, activePalette);
    const biomeId = this.terrain?.expeditionBiome || 'desert';
    const hasSparks = p.y <= 3.2 || biomeId === 'glacier' || biomeId === 'ocean';
    this.particles.burst(p.x, p.y, p.z, { radius, color: col, sparks: hasSparks });

    this.audio.playDigSound(Math.min(1.5, 0.6 + power * 0.2));
    this.scene.shake(0.05);
    events.emit('dig:hit', { x: p.x, y: p.y, z: p.z, amount, removed, radius, rootBlocked: !!this.terrain?.lastRootBlocked });
    return amount;
  }

  /** Da chiamare ad ogni frame con dt reale limitato. */
  update(dt) {
    if (!this.enabled || !this.terrain) return;

    if (this.holding && !this.multi) {
      const interval = this.state?.godMode ? MIN_TICK : Math.max(MIN_TICK, 1 / this.state.stats.digRate);
      this.cooldown -= dt;
      let n = 0;
      const maxHits = this.state?.godMode ? 8 : MAX_HITS_PER_FRAME;
      while (this.cooldown <= 0 && n++ < maxHits) {
        this._hit();
        this.cooldown += interval;
      }
      if (this.cooldown < -interval) this.cooldown = 0; // niente raffiche dopo un lag
      this.hoverDirty = true;
    }

    // Refresh periodico o al rilascio del cursore per AABB e sfera limite della geometria
    this._boundsTimer += dt;
    if (this._needsBoundsUpdate && (!this.holding || this._boundsTimer >= 1.0)) {
      this.terrain.updateBounds();
      this._needsBoundsUpdate = false;
      this._boundsTimer = 0;
    }

    this._updateReticle();
  }

  _updateReticle() {
    const show = this.pointer.inside && !this.multi && (this.hoverDirty || this.reticle.visible);
    if (!show) { this.reticle.visible = false; return; }
    this.hoverDirty = false;
    const p = this.pick(this.pointer.x, this.pointer.y);
    if (!p) { this.reticle.visible = false; return; }
    const r = this.state.stats.radius;
    const attr = this.reticle.geometry.attributes.position;
    for (let i = 0; i < RETICLE_SEGMENTS; i++) {
      const x = p.x + this._unit[i].x * r, z = p.z + this._unit[i].z * r;
      attr.setXYZ(i, x, this.terrain.heightAt(x, z) + 0.15, z);
    }
    attr.needsUpdate = true;
    this.reticle.visible = true;
  }

  dispose() {
    const c = this.canvas;
    c?.removeEventListener?.('pointerdown', this._onDown);
    c?.removeEventListener?.('pointermove', this._onMove);
    c?.removeEventListener?.('pointerleave', this._onLeave);
    c?.removeEventListener?.('contextmenu', this._onCtx);
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('pointerup', this._onUp);
      window.removeEventListener('pointercancel', this._onUp);
      window.removeEventListener('blur', this._onBlur);
      window.removeEventListener('gesturestart', this._onGesture);
    }
    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('visibilitychange', this._onBlur);
    }
    this.reticle.geometry.dispose();
    this.reticle.material.dispose();
    this._unsubCosmetics?.();
  }
}
