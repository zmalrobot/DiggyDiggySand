// Orchestratore della partita: crea terreno, particelle, scavo, HUD e camera di gioco, e gestisce
// transizione dal menu, pausa, autosalvataggio e ritorno al menu. Il rendering legge soltanto lo stato;
// l'accumulo di sabbia avviene a colpi (timestamp reali), non per numero di frame.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { events } from './Events.js';
import { State } from './State.js';
import { Terrain } from '../world/Terrain.js';
import { Particles } from '../world/Particles.js';
import { Digging } from '../systems/Digging.js';
import { Hud } from '../ui/Hud.js';
import { toast } from '../ui/Modal.js';

const WORLD_SIZE = 200;
const AUTOSAVE_MS = 15000;
const INTRO_SECONDS = 1.4;
const CAMERA_TARGET = new THREE.Vector3(0, 6, 0);
const CAMERA_START = { azimuth: 0.6, polar: 0.85, distance: 70 };
const PAN_SPEED = 38; // m/s con WASD / frecce

const smoothstep = (t) => t * t * (3 - 2 * t);

export class Game {
  constructor({ scene, settings, audio, save, modal, settingsModal, menu, canvas, hudRoot }) {
    this.sceneMgr = scene;
    this.settings = settings;
    this.audio = audio;
    this.save = save;
    this.modal = modal;
    this.settingsModal = settingsModal;
    this.menu = menu;
    this.canvas = canvas;

    this.state = new State();
    this.hud = new Hud(hudRoot, { state: this.state });
    this.hud.hide();

    this.running = false;
    this.paused = false;
    this.phase = 'idle'; // idle | intro | play
    this.saveBase = null;
    this.terrain = null;
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

    this._onKeyDown = (e) => {
      if (!this.running) return;
      if (e.key === 'Escape') {
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
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
    window.addEventListener('pagehide', () => this.saveNow());
  }

  /** Avvia (o riavvia) la partita partendo dai dati di salvataggio. */
  async start(data = {}) {
    const sm = this.sceneMgr;
    if (!sm?.ok) { toast('WebGL non disponibile: impossibile avviare la spedizione.'); return; }
    if (this.running) return;
    this.running = true;
    this.phase = 'intro';
    this.saveBase = data;
    this.state.reset(data);

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
  }

  _buildWorld() {
    this._disposeWorld();
    this.particles.alive = 0;
    this.particles.mesh.count = 0;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.terrain = new Terrain({ size: WORLD_SIZE, res: coarse ? 128 : 256, startHeight: 12, floor: 0 });
    this.group.add(this.terrain.group);
    this.sceneMgr.scene.add(this.group);
    this.digging.setTerrain(this.terrain);
    this.state.setCompletion(0);
  }

  _disposeWorld() {
    if (!this.terrain) return;
    this.group.remove(this.terrain.group);
    this.terrain.dispose();
    this.terrain = null;
    this.digging.setTerrain(null);
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
        this.digging.setEnabled(!this.paused);
      }
    } else {
      this._keyboardPan(dt);
      this.controls.update();
      this._clampTarget();
    }

    this.digging.update(dt);
    this.particles.update(dt);
    this.terrain?.flush();      // al massimo un upload GPU per frame
    this.hud.update(dt);
    this.sceneMgr.followSun(this.controls.target.x, this.controls.target.z);

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
    this._setPaused(true);
    const info = document.createElement('div');
    info.innerHTML = `<p class="muted">Sinistro: scava (tieni premuto per scavare di continuo). Destro: ruota. Shift + destro o WASD: sposta. Rotella: zoom. Touch: un dito scava, due dita ruotano e zoomano.</p>`;
    this.modal.open({
      title: 'Pausa',
      content: info,
      actions: [
        { label: 'Impostazioni', keepOpen: true, onClick: () => this.settingsModal.open() },
        { label: 'Torna al Menu', onClick: () => { this._leaving = true; } },
        { label: 'Riprendi' },
      ],
      onClose: () => {
        this._pauseClosedAt = performance.now();
        if (this._leaving) { this._leaving = false; this.returnToMenu(); }
        else this._setPaused(false);
      },
    });
  }

  _setPaused(p) {
    this.paused = p;
    if (this.phase !== 'play') return;
    this.controls.enabled = !p;
    this.digging.setEnabled(!p);
    if (p) this.keys.clear();
  }

  saveNow() {
    if (!this.running) return;
    this._lastSave = performance.now();
    this.save.write(this.state.toSave(this.saveBase ?? {}));
  }

  returnToMenu() {
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
    this.digging.setEnabled(false);
    this.sceneMgr.updaters.delete(this._tick);
    this._unsubSens?.();
    if (this.controls) { this.controls.dispose(); this.controls = null; }
    this.sceneMgr.scene.remove(this.group);
    this._disposeWorld();
    this.sceneMgr.setMode('menu');
    this.hud.hide();
    this.menu.root.classList.remove('fade-out');
  }
}
