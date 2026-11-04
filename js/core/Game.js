// Orchestratore della partita: crea terreno, particelle, scavo, lavoratori 3D, HUD, officina e camera di gioco.
// Gestisce economia disaccoppiata (SPS), guadagni offline, autosave ogni 10s e pausa.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { events } from './Events.js';
import { State } from './State.js';
import { Terrain } from '../world/Terrain.js';
import { Particles } from '../world/Particles.js';
import { Digging } from '../systems/Digging.js';
import { Economy } from '../systems/Economy.js';
import { Workers } from '../systems/Workers.js';
import { calculateSPS } from '../systems/Upgrades.js';
import { City } from '../world/City.js';
import { Foreshadowing } from '../systems/Foreshadowing.js';
import { EndingManager } from '../endings/EndingManager.js';
import { Overlay } from '../ui/Overlay.js';
import { Tutorial } from '../ui/Tutorial.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { EventBanner } from '../ui/EventBanner.js';
import { WorldEvents } from '../systems/WorldEvents.js';
import { Hud, formatNumber } from '../ui/Hud.js';

import { Shop } from '../ui/Shop.js';
import { toast } from '../ui/Modal.js';
import { StatsManager } from './StatsManager.js';
import { Achievements } from '../systems/Achievements.js';
import { StatsModal } from '../ui/StatsModal.js';
import { CosmeticsManager } from '../systems/CosmeticsManager.js';
import { WardrobeModal } from '../ui/WardrobeModal.js';
import { BiomeManager, BIOME_CATALOG } from '../world/BiomeManager.js';
import { CameraController } from '../world/Camera.js';
import { FloatingTextManager } from '../ui/FloatingText.js';
import { Haptics } from './Haptics.js';
import { i18n } from './I18n.js';

const WORLD_SIZE = 200;
const AUTOSAVE_MS = 10000; // Autosave ogni 10 secondi
const INTRO_SECONDS = 1.4;
const CAMERA_TARGET = new THREE.Vector3(0, 6, 0);
const CAMERA_START = { azimuth: 0.6, polar: 0.85, distance: 70 };
const PAN_SPEED = 38; // m/s con WASD / frecce

const smoothstep = (t) => t * t * (3 - 2 * t);

export class Game {
  constructor({ scene, settings, audio, save, modal, settingsModal, menu, canvas, hudRoot, assets = null, cosmeticsManager = null, wardrobeModal = null, biomeManager = null }) {
    this.sceneMgr = scene;
    this.settings = settings;
    this.audio = audio;
    this.save = save;
    this.modal = modal;
    this.settingsModal = settingsModal;
    this.menu = menu;
    this.canvas = canvas;
    this.assets = assets ?? scene?.assets ?? null;

    this.state = new State();
    this.statsManager = new StatsManager();
    this.state.careerStats = this.statsManager.stats;
    this.achievements = new Achievements({
      state: this.state,
      statsManager: this.statsManager,
      save: this.save,
      audio: this.audio,
    });
    this.statsModal = new StatsModal(this.modal, this.statsManager, this.achievements, this.audio);
    this.cosmeticsManager = cosmeticsManager ?? new CosmeticsManager(this.save);
    this.biomeManager = biomeManager ?? menu?.biomeManager ?? new BiomeManager(this.save, this.statsManager);
    this.wardrobeModal = wardrobeModal ?? new WardrobeModal(this.modal, this.cosmeticsManager, this.save, this.audio, this);
    if (!this.wardrobeModal.game) this.wardrobeModal.game = this;
    if (this.settingsModal) this.settingsModal.game = this;

    this.economy = new Economy(this.state);
    this.hud = new Hud(hudRoot, { state: this.state, economy: this.economy, audio: this.audio });
    this.hud.hide();


    this.haptics = new Haptics(this.settings);
    this.floatingText = new FloatingTextManager({
      camera: this.sceneMgr?.camera,
      canvas: this.canvas,
    });

    const shopRoot = document.getElementById('shop-root') || document.body;
    this.shop = new Shop(shopRoot, { state: this.state, audio });
    this.overlay = new Overlay();
    this.endingManager = null;
    this.banner = new EventBanner(document.body);
    this.worldEvents = null;
    this.tutorial = new Tutorial(document.body, { state: this.state });
    this.pauseMenu = new PauseMenu(document.body, {
      game: this,
      settings: this.settings,
      settingsModal: this.settingsModal,
      audio: this.audio,
      save: this.save,
    });

    this.running = false;
    this.paused = false;
    this.phase = 'idle'; // idle | intro | play
    this.saveBase = null;
    this.terrain = null;
    this.workers = null;
    this.controls = null;
    this.keys = new Set();
    this._lastSave = 0;
    this._pauseClosedAt = 0;

    this.fade = document.createElement('div');
    this.fade.className = 'game-fade';
    document.body.append(this.fade);

    this.group = new THREE.Group();
    this.group.name = 'game';
    this.particles = new Particles(settings);
    this.digging = new Digging({ canvas, scene, state: this.state, audio, particles: this.particles });
    this.group.add(this.particles.mesh, this.digging.reticle);

    this._tick = (dt) => this.update(dt);
    this._bindGlobal();
  }

  _bindGlobal() {
    events.on('game:new', (data) => this.start(data));
    events.on('game:continue', (data) => this.start(data));
    events.on('hud:menu', () => this.openPause());

    events.on('dig:hit', ({ amount }) => {
      this.state.registerClick();
      this.statsManager?.increment?.('totalClicks', 1);
      this.statsManager?.increment?.('totalSandLifetime', amount);
      if (this.worldEvents?.activeEvent === 'sandstorm') {
        events.emit('storm:dig');
      }
    });

    events.on('merchant:deal_bought', () => {
      events.emit('merchant:traded');
    });

    events.on('cosmetics:equipped', ({ category, id }) => {
      if (category === 'sand') this.terrain?.setBiomePalette?.(id);
      if (category === 'machinery') this.workers?.setSkin?.(id);
      if (category === 'shovel') this.digging?.setShovelSkin?.(id);
    });

    let lastCompletionTier = 0;
    events.on('terrain:completion', ({ completion }) => {
      const tier = Math.floor(completion * 8);
      if (tier > lastCompletionTier) {
        this.statsManager?.increment?.('ruinsUncovered', tier - lastCompletionTier);
        lastCompletionTier = tier;
      }
    });

    this._onKeyDown = (e) => {
      if (!this.running) return;
      if (e.key === 'Escape') {
        if (this.shop.isOpen) {
          this.shop.close();
          return;
        }
        if (this.modal.stack.length || performance.now() - this._pauseClosedAt < 80) return;
        this.openPause();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('beforeunload', () => this.saveNow());
    window.addEventListener('pagehide', () => this.saveNow());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
  }

  /** Avvia (o riavvia) la partita partendo dai dati di salvataggio. */
  async start(data = {}) {
    const sm = this.sceneMgr;
    if (!sm?.ok) { toast('WebGL non disponibile: impossibile avviare la spedizione.'); return; }
    if (this.running) return;
    this.running = true;
    this.phase = 'intro';
    this.saveBase = data;

    // Calcolo guadagni offline prima di resettare lo stato
    const sps = calculateSPS(data.upgrades ?? {});
    const lastSaved = data.lastSaved ?? data.lastSeen ?? 0;
    const offlineSand = this.economy.calculateOfflineProgress(lastSaved, sps);
    let offlineReport = null;
    if (offlineSand > 0) {
      data.sand = (data.sand ?? 0) + offlineSand;
      data.totalSand = (data.totalSand ?? 0) + offlineSand;
      const elapsedSec = Math.min(7200, Math.floor((Date.now() - lastSaved) / 1000));
      const mins = Math.max(1, Math.floor(elapsedSec / 60));
      offlineReport = {
        title: 'Spedizione Automatica',
        content: `<p>Mentre eri via, i tuoi scavi hanno prodotto <span class="num accent">+${formatNumber(offlineSand)}</span> Sabbia.</p><p class="muted">Tempo trascorso: ${mins} min (Efficienza flotta 50%).</p>`,
        actions: [{ label: 'Raccogli' }],
      };
    }

    this.state.reset(data);
    this.economy.refreshSPS();

    // Dissolvenza dal menu: menu -> nero breve -> camera di gioco.
    this.menu.root.classList.add('fade-out');
    this.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, 450));

    try {
      this._buildWorld();
    } catch (e) {
      console.error('[Game] costruzione del mondo fallita', e);
      toast('Errore nella creazione del terreno. Vedi la console.');
      this.fade.classList.remove('on');
      this._leave();
      return;
    }

    this.menu.hide();
    this.hud.show();
    this._setupCamera();
    sm.setMode('game');
    sm.updaters.add(this._tick);
    this.hud.refresh();
    this.introT = 0;
    this._lastSave = performance.now();
    this.paused = false;
    this.fade.classList.remove('on');

    if (offlineReport) {
      this.modal.open(offlineReport);
    }

    if (this.save?.lastRecoveryReason === 'backup_restored') {
      setTimeout(() => toast('⚠️ Salvataggio ripristinato dal backup di sicurezza.'), 1000);
    } else if (this.save?.lastRecoveryReason === 'emergency_reset') {
      setTimeout(() => toast('⚠️ Dati corrotti: avviata nuova spedizione pulita.'), 1000);
    }
  }


  _buildWorld() {
    this._disposeWorld();
    this.particles.alive = 0;
    this.particles.mesh.count = 0;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const biome = this.state.currentBiome || this.biomeManager?.currentBiome || 'desert';
    this.state.currentBiome = biome;

    const biomeCfg = BIOME_CATALOG[biome] || BIOME_CATALOG.desert;
    this.state.sandMultiplier = biomeCfg.mechanics?.sandValueMultiplier ?? 1.0;

    this.terrain = new Terrain({
      size: WORLD_SIZE,
      res: coarse ? 128 : 256,
      startHeight: 12,
      floor: 0,
      biome,
      maxAnisotropy: this.sceneMgr?.maxAnisotropy ?? 16,
    });
    this.group.add(this.terrain.group);

    // Città sepolta procedurale differenziata per bioma (Y=0..8.8)
    this.city = new City({ endingId: this.state.endingId, floor: this.terrain.floor, assets: this.assets, biome });
    this.group.add(this.city.group);

    // Particelle, Audio e Atmosfera adattati al bioma attivo
    this.particles.setBiome(biome);
    this.audio?.setBiome?.(biome);
    this.sceneMgr?.dayNight?.setBiome?.(biome);
    this.sceneMgr?.atmosphere?.setBiome?.(biome);

    // Sistema lavoratori 3D
    this.workers = new Workers({
      terrain: this.terrain,
      state: this.state,
      particles: this.particles,
      scene: this.sceneMgr,
      assets: this.assets,
    });
    this.group.add(this.workers.group);

    // Sistema di indizi e foreshadowing del mistero
    this.foreshadowing = new Foreshadowing({
      state: this.state,
      scene: this.sceneMgr,
      audio: this.audio,
      particles: this.particles,
      terrain: this.terrain,
    });

    // Manager dei finali dinamici (Curse, Treasure, Business)
    this.endingManager = new EndingManager({
      scene: this.sceneMgr,
      terrain: this.terrain,
      state: this.state,
      audio: this.audio,
      particles: this.particles,
      city: this.city,
      controls: this.controls,
      overlay: this.overlay,
      save: this.save,
      game: this,
    });

    // Sistema di eventi spontanei nel deserto (Tempesta, Mercante)
    this.worldEvents = new WorldEvents({
      scene: this.sceneMgr,
      terrain: this.terrain,
      state: this.state,
      audio: this.audio,
      particles: this.particles,
      banner: this.banner,
      modal: this.modal,
    });

    this.sceneMgr.scene.add(this.group);
    this.digging.setTerrain(this.terrain);

    // Applica personalizzazioni cosmetiche equipaggiate (sovrascrive la sabbia solo se diversa da sand_classic o nel bioma desert)
    const sandSkin = this.cosmeticsManager?.getEquipped('sand');
    if (sandSkin && (sandSkin !== 'sand_classic' || biome === 'desert')) {
      this.terrain.setBiomePalette(sandSkin);
    }
    const machSkin = this.cosmeticsManager?.getEquipped('machinery');
    if (machSkin) this.workers.setSkin(machSkin);
    const shovelSkin = this.cosmeticsManager?.getEquipped('shovel');
    if (shovelSkin) this.digging.setShovelSkin(shovelSkin);

    this.state.setCompletion(0);
  }

  openWardrobe() {
    this.wardrobeModal?.open();
  }

  _disposeWorld() {
    if (this.worldEvents) {
      this.worldEvents.dispose();
      this.worldEvents = null;
    }
    if (this.endingManager) {
      this.endingManager.dispose();
      this.endingManager = null;
    }
    if (this.foreshadowing) {
      this.foreshadowing.dispose();
      this.foreshadowing = null;
    }
    if (this.workers) {
      this.group.remove(this.workers.group);
      this.workers.dispose();
      this.workers = null;
    }
    if (this.city) {
      this.group.remove(this.city.group);
      this.city.dispose();
      this.city = null;
    }
    if (this.terrain) {
      this.group.remove(this.terrain.group);
      this.terrain.dispose();
      this.terrain = null;
      this.digging.setTerrain(null);
    }
    // Rilascia riferimenti e liste di rendering WebGL per prevenire memory leak
    this.sceneMgr?.renderer?.renderLists?.dispose?.();
  }


  _setupCamera() {
    const cam = this.sceneMgr.camera;
    this.introFrom = { pos: cam.position.clone(), look: new THREE.Vector3(0, 4, 0) };
    const { azimuth, polar, distance } = CAMERA_START;
    this.introTo = {
      look: CAMERA_TARGET.clone(),
      pos: new THREE.Vector3().setFromSphericalCoords(distance, polar, azimuth).add(CAMERA_TARGET),
    };

    const c = new OrbitControls(cam, this.canvas);
    c.target.copy(this.introFrom.look);
    c.enabled = false;
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.enablePan = true;
    c.screenSpacePanning = false;
    c.minDistance = 14;
    c.maxDistance = 130;
    c.minPolarAngle = 0.25;  // quasi top-down
    c.maxPolarAngle = 1.2;   // mai sotto l'orizzonte
    c.zoomSpeed = 0.8;
    // Sinistro/un dito = scavo; destro = ruota (Shift+destro = sposta); due dita = zoom + rotazione.
    c.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: -1, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls = c;
    this.cameraController = new CameraController(cam, this.controls, this.canvas);
    if (this.sceneMgr) this.sceneMgr.cameraController = this.cameraController;
    if (this.floatingText) this.floatingText.setCamera(cam);
    if (this.endingManager) this.endingManager.controls = c;
    this._unsubSens = this.settings.subscribe('controls.cameraSens', (v) => { c.rotateSpeed = v; }, { immediate: true });
  }

  update(dt) {
    if (!this.running) return;
    const cam = this.sceneMgr.camera;

    if (this.phase === 'intro') {
      this.introT += dt / INTRO_SECONDS;
      const k = smoothstep(Math.min(1, this.introT));
      cam.position.lerpVectors(this.introFrom.pos, this.introTo.pos, k);
      const look = this.introFrom.look.clone().lerp(this.introTo.look, k);
      this.controls.target.copy(look);
      cam.lookAt(look);
      if (this.introT >= 1) {
        this.phase = 'play';
        this.controls.update();
        this.controls.enabled = !this.paused;
        this.cameraController?._syncFromCamera?.();
        this.digging.setEnabled(!this.paused);
        this.tutorial?.start();
      }
    } else {
      this._keyboardPan(dt);
      this.cameraController?.update(dt, this.keys);
      this.controls.update();
      this._clampTarget();
    }

    this.digging.update(dt);
    this.workers?.update(dt);
    this.economy?.update(dt);
    this.foreshadowing?.update(dt);
    this.endingManager?.onProgress(this.state.completion);
    this.endingManager?.update(dt);
    this.tutorial?.update(dt);
    this.worldEvents?.update(dt);

    if (this.phase === 'play' && !this.paused) {
      this.statsManager?.increment?.('totalPlaytime', dt);
      this.achievements?.check();
    }

    // Throttling particellare intelligente in base alla flotta di lavoratori
    if (this.workers && this.particles?.setWorkerCount) {
      const up = this.state.upgrades;
      const wCount = (up.scarab ?? 0) + (up.excavator ?? 0) + (up.dredge ?? 0);
      this.particles.setWorkerCount(wCount);
    }
    this.particles.update(dt);
    this.terrain?.flush();      // al massimo un upload GPU per frame
    this.hud.update(dt);
    this.shop?.update();

    // Modulazione dinamica dell'audio d'ambiente in base alla quota scavata
    if (this.terrain && this.audio?.setDepth) {
      const avgY = this.terrain.heightAt(this.controls?.target.x ?? 0, this.controls?.target.z ?? 0);
      this.audio.setDepth(avgY);
    }

    // Aggiornamento periodico letture Georadar se attivo
    if ((this.state.upgrades.georadar ?? 0) >= 1 && this.foreshadowing) {
      const depthY = this.terrain ? this.terrain.heightAt(this.controls?.target.x ?? 0, this.controls?.target.z ?? 0) : 12;
      this.hud.setRadarReading(this.foreshadowing.getRadarReading(depthY));
    }

    this.sceneMgr.followSun(this.controls.target.x, this.controls.target.z);

    // Adattamento dinamico piani near/far per prevenire z-fighting o clipping nelle rovine profonde
    if (cam && this.controls?.target) {
      const dist = cam.position.distanceTo(this.controls.target);
      const dynamicNear = Math.max(0.15, Math.min(1.0, dist * 0.02));
      const dynamicFar = Math.max(350, dist + 250);
      if (Math.abs(cam.near - dynamicNear) > 0.05 || Math.abs(cam.far - dynamicFar) > 5) {
        cam.near = dynamicNear;
        cam.far = dynamicFar;
        cam.updateProjectionMatrix();
      }
    }

    if (performance.now() - this._lastSave > AUTOSAVE_MS) this.saveNow();
  }

  _keyboardPan(dt) {
    if (this.paused || !this.keys.size) return;
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (!f && !r) return;
    const cam = this.sceneMgr.camera;
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const dist = cam.position.distanceTo(this.controls.target);
    const step = PAN_SPEED * dt * Math.max(0.5, dist / 60);
    const delta = fwd.multiplyScalar(f * step).add(right.multiplyScalar(r * step));
    this.controls.target.add(delta);
    cam.position.add(delta);
  }

  /** Tiene il punto guardato dentro il terreno, spostando la camera dello stesso scarto. */
  _clampTarget() {
    const lim = WORLD_SIZE / 2 - 4;
    const t = this.controls.target;
    const cx = Math.min(lim, Math.max(-lim, t.x));
    const cz = Math.min(lim, Math.max(-lim, t.z));
    if (cx !== t.x || cz !== t.z) {
      this.sceneMgr.camera.position.x += cx - t.x;
      this.sceneMgr.camera.position.z += cz - t.z;
      t.x = cx; t.z = cz;
    }
  }

  openPause() {
    if (!this.running || this.paused || this.phase !== 'play') return;
    this.shop.close(true);
    this.pauseMenu.open();
  }

  _setPaused(p) {
    this.paused = p;
    if (this.phase !== 'play') return;
    this.controls.enabled = !p;
    if (this.cameraController) this.cameraController.enabled = !p;
    this.digging.setEnabled(!p);
    if (p) this.keys.clear();
  }

  saveNow() {
    if (!this.running) return;
    this._lastSave = performance.now();
    // Preserva un lastSaved impostato artificialmente nel passato per test di progresso offline
    const existing = this.save.load();
    const saveTime = (existing?.lastSaved && existing.lastSaved < Date.now() - 30000)
      ? existing.lastSaved
      : Date.now();
    this.save.write(this.state.toSave({
      ...(this.saveBase ?? {}),
      endingsSeen: this.save.getEndingsSeen(),
      lastSaved: saveTime,
    }));
  }


  /** Avvia direttamente una nuova spedizione (usato dall'overlay epilogo). */
  async startNewRun(biomeOverride = null) {
    this.overlay?.hide();
    const biome = biomeOverride || this.state.currentBiome || this.biomeManager?.currentBiome || 'desert';
    this.save.clear();
    const data = this.save.createNew({ biome });
    this._leave();
    await this.start(data);
  }

  returnToMenu() {
    this.overlay?.hide();
    this.shop.close(true);
    this.saveNow();
    this.fade.classList.add('on');
    setTimeout(() => {
      this._leave();
      this.menu.show();
      this.fade.classList.remove('on');
    }, 450);
  }

  _leave() {
    this.running = false;
    this.phase = 'idle';
    this.paused = false;
    this.pauseMenu?.close();
    this.tutorial?.complete();
    this.overlay?.hide();
    this.banner?.hide();
    this.digging.setEnabled(false);
    this.shop.close(true);
    this.debugTools?.close?.();
    this.sceneMgr.updaters.delete(this._tick);
    this._unsubSens?.();
    if (this.cameraController) { this.cameraController.dispose(); this.cameraController = null; }
    if (this.controls) { this.controls.dispose(); this.controls = null; }
    this.sceneMgr.scene.remove(this.group);
    this._disposeWorld();
    this.sceneMgr.setMode('menu');
    this.hud.hide();
    this.menu.root.classList.remove('fade-out');
    this.sceneMgr?.renderer?.renderLists?.dispose?.();
  }
}
