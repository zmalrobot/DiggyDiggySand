// Scena 3D di sfondo del menu: duna/cratere "Chiseled Low-Poly", obelisco seminterrato, camera orbitale.
// Reagisce in tempo reale alle impostazioni grafiche e di controllo.
import * as THREE from 'three';
import { PALETTE_3D } from './ProceduralFactory.js';
import { DayNightCycle } from './DayNightCycle.js';
import { Atmosphere } from './Atmosphere.js';
import { PostProcessing } from './PostProcessing.js';

const PARTICLE_COUNTS = { low: [30, 3], med: [90, 8], high: [220, 18] };
const SHADOW_SIZE = { low: 1024, high: 2048 };

/** Altezza del terreno: dune + cratere centrale. */
export function terrainHeight(x, z) {
  const dunes = 10 + 1.8 * Math.sin(x * 0.09) + 1.4 * Math.cos(z * 0.11 + x * 0.03) + 0.9 * Math.sin((x + z) * 0.21);
  const crater = 11 * Math.exp(-((x * x + z * z) / (13 * 13)));
  return Math.max(0.2, dunes - crater);
}

const fract = (n) => n - Math.floor(n);
const faceHash = (i) => fract(Math.sin(i * 12.9898) * 43758.5453);

/** Configura l'anisotropia massima e filtri lineari per garantire nitidezza su superfici e texture. */
export function configureTextureAnisotropy(texture, maxAnisotropy = 16) {
  if (!texture || typeof texture !== 'object') return;
  texture.anisotropy = Math.max(1, maxAnisotropy || 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
}

export class SceneManager {
  constructor(canvas, settings, assets) {
    this.canvas = canvas;
    this.settings = settings;
    this.assets = assets;
    this.ok = false;
    this.running = false;
    this.time = 0;
    this.angle = 0.6;
    this.lastFrame = 0;
    this.shakeT = 0;
    this.unsubs = [];
    this.mode = 'menu';        // 'menu' (camera orbitale) | 'game' (camera pilotata da Game/OrbitControls)
    this.updaters = new Set(); // callback(dt) eseguite ogni frame in modalità game
    this._shakeApplied = null;
    this.profiler = null;

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      console.warn('[Scene] WebGL non disponibile, il menu funziona senza sfondo 3D', e);
      this._showWebGLError(
        'Accelerazione 3D Non Disponibile',
        'Il tuo browser o dispositivo non supporta WebGL 2 o l\'accelerazione grafica hardware è disabilitata.'
      );
      return;
    }

    this._setupContextListeners(canvas);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAnisotropy = this.renderer.capabilities?.getMaxAnisotropy?.() ?? 16;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);

    this._buildSky();
    this._buildLights();
    this._buildTerrain();
    this._buildRuins();
    this._buildParticles();
    this._groupMenuObjects();
    this._bindSettings();

    this.atmosphere = new Atmosphere(this.scene, this.settings);
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera, this.settings);

    this.dayNight = new DayNightCycle(this);
    if (this.settings?.get?.('graphics.dayNightCycle')) {
      this.dayNight.setMode(this.settings.get('graphics.dayNightCycle'));
    }
    this.unsubs.push(
      this.settings?.subscribe?.('graphics.dayNightCycle', (m) => this.dayNight?.setMode(m))
    );

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
    this.ok = true;
  }

  _buildSky() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1d3b52');
    grad.addColorStop(0.55, '#7d8f8c');
    grad.addColorStop(0.85, '#e0b979');
    grad.addColorStop(1, '#ecd599');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    configureTextureAnisotropy(tex, this.maxAnisotropy);
    this.scene.background = tex;
    this.scene.fog = new THREE.FogExp2(0xd9b97a, 0.011);
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(PALETTE_3D.ambientSky, PALETTE_3D.sandBedrock, 0.9);
    this.scene.add(this.hemi);

    // Illuminazione di sicurezza suolo (Ambient Floor): impedisce il blackout completo nelle zone d'ombra
    this.ambientLight = new THREE.AmbientLight(0x0D131A, 0.15);
    this.ambientLight.name = 'ambientFloor';
    this.scene.add(this.ambientLight);

    const sun = new THREE.DirectionalLight(PALETTE_3D.sunLight, 2.4);
    sun.position.set(30, 40, 20);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -45;
    sun.shadow.camera.right = sun.shadow.camera.top = 45;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.05;
    this.sun = sun;
    this.scene.add(sun);

    this.glow = new THREE.PointLight(PALETTE_3D.crystalLight, 25, 22, 2);
    this.glow.position.set(0, terrainHeight(0, 0) + 2, 0);
    this.scene.add(this.glow);
  }

  _buildTerrain() {
    const size = 120, seg = 60;
    let geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    geo = geo.toNonIndexed(); // facce piane indipendenti: colore per triangolo
    geo.computeVertexNormals();

    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const sand = new THREE.Color(PALETTE_3D.sandTop);
    const ocher = new THREE.Color(PALETTE_3D.sandMid);
    const stone = new THREE.Color(PALETTE_3D.ruinsStone);
    const vein = new THREE.Color(PALETTE_3D.atlantisCoreTeal);
    const c = new THREE.Color();
    for (let f = 0; f < p.count / 3; f++) {
      const y = (p.getY(f * 3) + p.getY(f * 3 + 1) + p.getY(f * 3 + 2)) / 3;
      const h = faceHash(f);
      if (y > 8) c.copy(sand);
      else if (y > 3) c.copy(ocher);
      else {
        c.copy(stone);
        if (h < 0.14) c.lerp(vein, 0.55); // venature teal
      }
      c.multiplyScalar(0.9 + h * 0.2); // variazione per faccia, effetto scalpellato
      for (let k = 0; k < 3; k++) c.toArray(colors, (f * 3 + k) * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    this.scene.add(this.terrain);
  }

  _buildRuins() {
    const floorY = terrainHeight(0, 0);
    const obelisk = this.assets.getModel('RUIN_OBELISK');
    obelisk.scale.setScalar(1.7);
    obelisk.position.set(0, floorY + 2.3, 0);
    obelisk.rotation.z = 0.09;
    this.scene.add(obelisk);

    const ringMat = new THREE.MeshStandardMaterial({
      color: PALETTE_3D.abyss, emissive: PALETTE_3D.atlantisCoreTeal, emissiveIntensity: 1.2, flatShading: true,
    });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.12, 4, 6), ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.set(0, floorY + 0.35, 0);
    this.scene.add(this.ring);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const r = 9 + faceHash(i + 3) * 4;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pillar = this.assets.getModel('RUIN_PILLAR');
      pillar.position.set(x, terrainHeight(x, z) + 0.5, z);
      pillar.rotation.set((faceHash(i) - 0.5) * 0.5, faceHash(i + 9) * 3, (faceHash(i + 5) - 0.5) * 0.5);
      pillar.scale.setScalar(0.8 + faceHash(i + 1) * 0.5);
      this.scene.add(pillar);
    }
  }

  /** Raccoglie scenografia del menu (terreno, rovine, polvere) in un gruppo, così il gioco può nasconderla. */
  _groupMenuObjects() {
    this.menuGroup = new THREE.Group();
    for (const o of [...this.scene.children]) if (!o.isLight) this.menuGroup.add(o);
    this.scene.add(this.menuGroup);
    this.scene.add(this.sun.target);
    this.menuFogDensity = this.scene.fog.density;
  }

  /** Passa tra scena del menu e scena di gioco. In game il contenuto viene aggiunto da Game a `scene`. */
  setMode(mode) {
    this.mode = mode;
    const game = mode === 'game';
    this.menuGroup.visible = !game;
    this.glow.visible = !game;
    this.scene.fog.density = game ? 0.0035 : this.menuFogDensity;
    this.shakeT = 0;
    if (!game) {
      this.sun.position.set(30, 40, 20);
      this.sun.target.position.set(0, 0, 0);
    }
    this.sun.target.updateMatrixWorld();
  }

  /** In game la luce (e la sua ombra) segue il punto guardato dalla camera. */
  followSun(x, z) {
    this.sun.position.set(x + 30, 40, z + 20);
    this.sun.target.position.set(x, 0, z);
    this.sun.target.updateMatrixWorld();
  }

  _makePoints(max, color, size, spread, height) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = Math.random() * height;
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: true,
    }));
    pts.frustumCulled = false;
    pts.userData = { height };
    this.scene.add(pts);
    return pts;
  }

  _buildParticles() {
    const [dust, spark] = PARTICLE_COUNTS.high;
    this.dust = this._makePoints(dust, PALETTE_3D.particleDust, 0.22, 70, 18);
    this.sparks = this._makePoints(spark, PALETTE_3D.particleSpark, 0.3, 10, 9);
  }

  _bindSettings() {
    const s = this.settings;
    const on = (key, fn) => this.unsubs.push(s.subscribe(key, fn, { immediate: true }));
    on('graphics.renderScale', () => this.applyRenderScale());
    on('graphics.shadows', (v) => this.applyShadows(v));
    on('graphics.particles', (v) => this.applyParticles(v));
    // fpsCap, cameraSens, invertY e screenShake vengono letti ad ogni frame.
  }

  applyRenderScale() {
    const base = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(base * this.settings.get('graphics.renderScale'));
    this.resize();
  }

  applyShadows(mode) {
    const enabled = mode !== 'off';
    this.renderer.shadowMap.enabled = enabled;
    this.sun.castShadow = enabled;
    if (enabled) {
      const size = SHADOW_SIZE[mode];
      if (this.sun.shadow.mapSize.x !== size) {
        this.sun.shadow.mapSize.set(size, size);
        this.sun.shadow.map?.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.scene.traverse((o) => {
      if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; });
    });
  }

  applyParticles(q) {
    const [d, s] = PARTICLE_COUNTS[q];
    this.dust.geometry.setDrawRange(0, d);
    this.sparks.geometry.setDrawRange(0, s);
  }

  resize() {
    if (!this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;

    // Compensazione adattiva del FOV per schermi verticali (portrait / mobile con notch) e ultra-wide (21:9 / 32:9)
    const baseFov = 50;
    const aspect = w / h;
    if (aspect < 1.0) {
      // Schermo portrait / mobile: allarga progressivamente il FOV per mantenere duna e HUD visibili
      this.camera.fov = Math.min(78, Math.max(50, baseFov / Math.pow(aspect, 0.65)));
    } else if (aspect > 2.05) {
      // Display ultra-wide (21:9 e 32:9): calibra il FOV per evitare distorsioni da lente ai margini
      this.camera.fov = Math.max(42, Math.min(baseFov, baseFov * (1.78 / aspect) * 1.05));
    } else {
      this.camera.fov = baseFov;
    }
    this.camera.updateProjectionMatrix();
    this.postProcessing?.setSize?.(w, h);
  }

  /** Scossone di camera. Rispetta il toggle "Screen shake". */
  shake(intensity = 0.4) {
    if (!this.settings.get('controls.screenShake')) return;
    this.shakeT = intensity;
  }

  setProfiler(profiler) {
    this.profiler = profiler;
    if (this.profiler && this.renderer) {
      this.profiler.setRenderer(this.renderer);
    }
  }

  start() {
    if (!this.ok || this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      const cap = this.settings.get('graphics.fpsCap');
      const elapsed = now - this.lastFrame;
      if (cap > 0 && elapsed < 1000 / cap - 0.5) return;
      this.lastFrame = now;
      this.profiler?.beginFrame?.(now);
      this.update(Math.min(elapsed / 1000, 0.1));
      if (this.postProcessing) {
        this.postProcessing.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      this.profiler?.endFrame?.(now);
      if (this._shakeApplied) { this.camera.position.sub(this._shakeApplied); this._shakeApplied = null; }
    };
    this.raf = requestAnimationFrame(frame);
  }

  update(dt) {
    this.time += dt;
    this.dayNight?.update(dt);
    this.atmosphere?.update(dt);
    if (this.mode === 'game') { this._updateGame(dt); return; }
    const sens = this.settings.get('controls.cameraSens');
    const dir = this.settings.get('controls.invertY') ? -1 : 1;
    this.angle += dt * 0.07 * sens;

    const radius = 34;
    this.camera.position.set(
      Math.cos(this.angle) * radius,
      15 + Math.sin(this.time * 0.12) * 2.5 * dir,
      Math.sin(this.angle) * radius
    );
    if (this.shakeT > 0) {
      const k = this.shakeT;
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k;
      this.shakeT = Math.max(0, this.shakeT - dt * 1.2);
    }
    this.camera.lookAt(0, 4, 0);

    this.ring.rotation.z += dt * 0.4;
    this.glow.intensity = 25 + Math.sin(this.time * 1.6) * 6;

    this._drift(this.dust, dt, 1.2);
    this._drift(this.sparks, dt, 0.8);
  }

  _updateGame(dt) {
    for (const fn of this.updaters) {
      try { fn(dt); } catch (e) { console.error('[Scene] updater', e); }
    }
    if (this.shakeT > 0) {
      // Offset temporaneo: viene tolto dopo il render, così non combatte con OrbitControls.
      const k = this.shakeT;
      this._shakeApplied = new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
      this.camera.position.add(this._shakeApplied);
      this.shakeT = Math.max(0, this.shakeT - dt * 1.2);
    }
  }

  _drift(points, dt, speed) {
    const a = points.geometry.attributes.position;
    const h = points.userData.height;
    for (let i = 0; i < a.count; i++) {
      a.setX(i, a.getX(i) + dt * speed * 0.8);
      a.setY(i, a.getY(i) + Math.sin(this.time + i) * dt * 0.3);
      if (a.getX(i) > 40) a.setX(i, -40);
      if (a.getY(i) < 0.5) a.setY(i, h);
    }
    a.needsUpdate = true;
  }

  _setupContextListeners(canvas) {
    if (!canvas?.addEventListener) return;

    this._onContextLost = (e) => {
      e.preventDefault();
      console.warn('[Scene] Contesto WebGL perso!');
      this.contextLost = true;
      this.running = false;
      this._showWebGLError(
        'Contesto Grafico Interrotto',
        'Il dispositivo ha temporaneamente sospeso l\'accelerazione grafica WebGL (risorse GPU sature o riavvio del driver). Il motore tenterà il ripristino automatico.'
      );
    };

    this._onContextRestored = () => {
      console.info('[Scene] Contesto WebGL ripristinato!');
      this.contextLost = false;
      this._hideWebGLError();
      try {
        this.renderer?.renderLists?.dispose?.();
        this._buildSky();
        this.start();
      } catch (err) {
        console.error('[Scene] Errore ripristino post-contextrestored', err);
      }
    };

    canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);
  }

  _showWebGLError(title, message) {
    if (typeof document === 'undefined') return;
    if (!this.errorOverlay) {
      this.errorOverlay = document.createElement('div');
      this.errorOverlay.className = 'webgl-fallback-overlay';
      document.body.appendChild(this.errorOverlay);
    }
    this.errorOverlay.innerHTML = `
      <div class="webgl-error-card panel glow-amber">
        <div class="webgl-error-icon">⚠️</div>
        <h2 class="display webgl-error-title">${title}</h2>
        <p class="webgl-error-msg muted">${message}</p>
        <div class="webgl-error-actions">
          <button type="button" class="btn" onclick="window.location.reload()">Ricarica Pagina</button>
        </div>
      </div>
    `;
    this.errorOverlay.classList.remove('hidden');
  }

  _hideWebGLError() {
    if (this.errorOverlay) {
      this.errorOverlay.classList.add('hidden');
    }
  }

  dispose() {
    this.running = false;
    this.dayNight?.dispose?.();
    this.atmosphere?.dispose?.();
    this.postProcessing?.dispose?.();
    cancelAnimationFrame(this.raf);
    this.unsubs.forEach((u) => u());
    window.removeEventListener('resize', this._onResize);
    if (this._onContextLost && this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    }
    this.renderer?.renderLists?.dispose?.();
    this.renderer?.dispose();
    if (this.errorOverlay?.parentElement) {
      this.errorOverlay.parentElement.removeChild(this.errorOverlay);
      this.errorOverlay = null;
    }
  }
}

