// Sistema Lavoratori e Macchinari 3D: automi procedurali low-poly su terreno,
// animazione e scavo autonomo fisico con emissione di particelle e accumulo sabbia.
import * as THREE from 'three';
import { PALETTE_3D } from '../world/ProceduralFactory.js';
import { UPGRADE_CATALOG } from './Upgrades.js';
import { events } from '../core/Events.js';
import { getLayerColor } from '../world/Terrain.js';
import { DisposeUtils } from '../world/DisposeUtils.js';


const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra });

const mesh = (geo, material, pos = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

// Limiti visivi per evitare cali di frame rate con molti livelli acquistati
const VISUAL_CAPS = {
  scarab: 8,
  excavator: 4,
  dredge: 2,
};

export const TERRAIN_SIZE = 200;
export const BOUNDARY_LIMIT = (TERRAIN_SIZE / 2) - 2.5;

/** Crea il modello 3D dello Scarafaggio Meccanico. */
export function createScarabModel() {
  const root = new THREE.Group();
  root.name = 'scarab';

  // Carapace a facce dorate
  const shellMat = mat(PALETTE_3D.ruinsGoldInlay, { metalness: 0.8, roughness: 0.25 });
  const shell = mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.35, 6), shellMat, [0, 0.35, 0]);
  shell.scale.set(0.9, 1, 1.25);

  // Linea dorsale teal atlantidea
  const seam = mesh(
    new THREE.BoxGeometry(0.08, 0.38, 0.85),
    mat(PALETTE_3D.abyss, { emissive: PALETTE_3D.atlantisCoreTeal, emissiveIntensity: 1.0 }),
    [0, 0.36, -0.05]
  );

  // Testa
  const head = mesh(new THREE.BoxGeometry(0.45, 0.22, 0.32), mat(PALETTE_3D.orichalcum), [0, 0.28, 0.58]);

  // Occhi teal luminescenti
  const eyeL = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat(0x000000, { emissive: PALETTE_3D.atlantisCoreTeal, emissiveIntensity: 1.5 }), [-0.15, 0.34, 0.7]);
  const eyeR = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat(0x000000, { emissive: PALETTE_3D.atlantisCoreTeal, emissiveIntensity: 1.5 }), [0.15, 0.34, 0.7]);

  // Mandibole a prisma
  const bladeL = mesh(new THREE.ConeGeometry(0.08, 0.3, 3), mat(PALETTE_3D.sandBedrock), [-0.18, 0.24, 0.85]);
  bladeL.rotation.x = Math.PI / 2;
  bladeL.rotation.z = -0.3;
  const bladeR = mesh(new THREE.ConeGeometry(0.08, 0.3, 3), mat(PALETTE_3D.sandBedrock), [0.18, 0.24, 0.85]);
  bladeR.rotation.x = Math.PI / 2;
  bladeR.rotation.z = 0.3;

  // 6 zampe a prisma
  const legsGroup = new THREE.Group();
  const legMat = mat(PALETTE_3D.sandMid);
  const legCoords = [
    [-0.55, 0.15, 0.3, -0.4],
    [-0.6, 0.15, 0.0, 0.0],
    [-0.55, 0.15, -0.3, 0.4],
    [0.55, 0.15, 0.3, 0.4],
    [0.6, 0.15, 0.0, 0.0],
    [0.55, 0.15, -0.3, -0.4],
  ];
  for (const [lx, ly, lz, rz] of legCoords) {
    const l = mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), legMat, [lx, ly, lz]);
    l.rotation.z = rz;
    legsGroup.add(l);
  }

  root.add(shell, seam, head, eyeL, eyeR, bladeL, bladeR, legsGroup);
  root.userData = { legs: legsGroup, head };
  return root;
}

/** Crea il modello 3D dell'Escavatore a Vapore. */
export function createExcavatorModel() {
  const root = new THREE.Group();
  root.name = 'excavator';

  // Cingoli pesanti in bronzo scuro
  const trackMat = mat(PALETTE_3D.ruinsStone);
  const trackL = mesh(new THREE.BoxGeometry(0.65, 0.5, 2.6), trackMat, [-0.95, 0.25, 0]);
  const trackR = mesh(new THREE.BoxGeometry(0.65, 0.5, 2.6), trackMat, [0.95, 0.25, 0]);

  // Corpo / Cabina oricalco
  const body = mesh(
    new THREE.BoxGeometry(1.7, 0.9, 1.9),
    mat(PALETTE_3D.orichalcum, { metalness: 0.65, roughness: 0.35 }),
    [0, 0.8, 0]
  );
  // Cabina pilota scura
  const cab = mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), mat(PALETTE_3D.abyss), [0.3, 1.3, 0.3]);

  // Ciminiera di scarico a vapore
  const pipe = mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1.0, 6),
    mat(PALETTE_3D.ruinsGoldInlay, { metalness: 0.8, roughness: 0.2 }),
    [-0.5, 1.6, -0.5]
  );

  // Braccio mobile e benna
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 0.9, 0.9);

  const mainBoom = mesh(new THREE.BoxGeometry(0.28, 0.32, 2.3), mat(PALETTE_3D.ruinsGoldInlay), [0, 0.6, 0.9]);
  mainBoom.rotation.x = -0.5;

  const bucket = mesh(
    new THREE.BoxGeometry(0.95, 0.55, 0.75),
    mat(PALETTE_3D.sandBedrock, { metalness: 0.5, roughness: 0.4 }),
    [0, 0.1, 2.0]
  );
  bucket.rotation.x = 0.4;

  armPivot.add(mainBoom, bucket);
  root.add(trackL, trackR, body, cab, pipe, armPivot);
  root.userData = { armPivot, pipe };
  return root;
}

/** Crea il modello 3D della Draga di Sabbia Atlantea. */
export function createDredgeModel() {
  const root = new THREE.Group();
  root.name = 'dredge';

  // Traliccio e basamento
  const base = mesh(
    new THREE.CylinderGeometry(2.2, 3.0, 1.4, 6),
    mat(PALETTE_3D.abyss, { metalness: 0.3, roughness: 0.8 }),
    [0, 0.7, 0]
  );

  // Pilastri di supporto
  const p1 = mesh(new THREE.BoxGeometry(0.35, 3.4, 0.35), mat(PALETTE_3D.ruinsStone), [-1.2, 2.2, 0]);
  const p2 = mesh(new THREE.BoxGeometry(0.35, 3.4, 0.35), mat(PALETTE_3D.ruinsStone), [1.2, 2.2, 0]);

  // Nucleo energetico teal pulsante
  const core = mesh(
    new THREE.OctahedronGeometry(0.7, 0),
    mat(PALETTE_3D.atlantisCoreTeal, { emissive: PALETTE_3D.atlantisCoreTeal, emissiveIntensity: 1.2 }),
    [0, 2.5, 0]
  );

  // Grande ruota rotante a tazze
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(0, 2.2, 1.8);

  const rim = mesh(
    new THREE.TorusGeometry(1.8, 0.15, 5, 12),
    mat(PALETTE_3D.orichalcum, { metalness: 0.75, roughness: 0.25 }),
    [0, 0, 0]
  );

  // 6 tazze/benne lungo il bordo della ruota
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const b = mesh(
      new THREE.BoxGeometry(0.45, 0.35, 0.5),
      mat(PALETTE_3D.sandBedrock, { metalness: 0.6 }),
      [Math.cos(angle) * 1.8, Math.sin(angle) * 1.8, 0]
    );
    b.rotation.z = angle + Math.PI / 2;
    wheelPivot.add(b);
  }
  wheelPivot.add(rim);

  root.add(base, p1, p2, core, wheelPivot);
  root.userData = { wheelPivot, core };
  return root;
}

export class Workers {
  constructor({ terrain, state, particles, scene, assets = null }) {
    this.terrain = terrain;
    this.state = state;
    this.particles = particles;
    this.scene = scene;
    this.assets = assets ?? scene?.assets ?? null;

    this.group = new THREE.Group();
    this.group.name = 'workers-fleet';

    this.workers = []; // { type, mesh, timer, cycleTime, x, z, targetX, targetZ, digRadius, powerPerHit }
    this.currentSkin = 'machinery_standard';
    this._unsubs = [
      events.on('upgrade:bought', ({ id }) => {
        if (UPGRADE_CATALOG[id]?.branch === 'fleet') {
          this.syncWithUpgrades(this.state.upgrades);
        }
      }),
      events.on('cosmetics:equipped', ({ category, id }) => {
        if (category === 'machinery') {
          this.setSkin(id);
        }
      }),
      events.on('settings:modelStyleChanged', () => {
        this.rebuildVisualMeshes();
      }),
    ];

    this.syncWithUpgrades(this.state.upgrades);
  }

  setTerrain(t) {
    this.terrain = t;
    this.repositionAll();
  }

  /** Riposiziona tutti i lavoratori alla quota corretta della heightmap. */
  repositionAll() {
    if (!this.terrain) return;
    for (const w of this.workers) {
      w.mesh.position.y = this.terrain.heightAt(w.mesh.position.x, w.mesh.position.z);
    }
  }

  /**
   * Ricostruisce le mesh visive di tutti i lavoratori attivi a runtime
   * in seguito al cambio di stile modello nelle impostazioni (GLTF vs Procedurali).
   * Esegue DisposeUtils.deepDispose() su ciascuna vecchia mesh per liberare memoria GPU.
   */
  rebuildVisualMeshes() {
    if (!this.workers || !this.workers.length) return;
    for (const w of this.workers) {
      if (!w.mesh) continue;
      const oldMesh = w.mesh;
      const pos = oldMesh.position.clone();
      const rot = oldMesh.rotation.clone();

      this.group.remove(oldMesh);
      DisposeUtils.deepDispose(oldMesh);

      let newMesh = null;
      if (w.type === 'scarab') {
        newMesh = this.assets?.getModel
          ? this.assets.getModel('machinery/worker_scarab.glb', createScarabModel)
          : createScarabModel();
      } else if (w.type === 'excavator') {
        newMesh = this.assets?.getModel
          ? this.assets.getModel('machinery/excavator_steam.glb', createExcavatorModel)
          : createExcavatorModel();
      } else if (w.type === 'dredge') {
        newMesh = this.assets?.getModel
          ? this.assets.getModel('machinery/dredge.glb', createDredgeModel)
          : createDredgeModel();
      }

      if (newMesh) {
        if (!newMesh.userData) newMesh.userData = {};
        if (this.currentSkin && this.currentSkin !== 'machinery_standard') {
          this._applySkinToMesh(newMesh, this.currentSkin);
        }
        newMesh.position.copy(pos);
        newMesh.rotation.copy(rot);
        this.group.add(newMesh);
        w.mesh = newMesh;
      }
    }
  }

  /**
   * Sincronizza i modelli 3D e i parametri di scavo in base ai livelli attuali.
   */
  syncWithUpgrades(upgrades = {}) {
    const counts = {
      scarab: upgrades.scarab ?? 0,
      excavator: upgrades.excavator ?? 0,
      dredge: upgrades.dredge ?? 0,
    };

    for (const [type, lvl] of Object.entries(counts)) {
      const def = UPGRADE_CATALOG[type];
      if (!def) continue;

      const currentOfType = this.workers.filter((w) => w.type === type);
      const targetVisual = Math.min(lvl, VISUAL_CAPS[type]);

      // Rimuovi se in eccesso
      while (currentOfType.length > targetVisual) {
        const removed = currentOfType.pop();
        this.group.remove(removed.mesh);
        removed.mesh.traverse((o) => {
          o.geometry?.dispose?.();
          if (o.material) [].concat(o.material).forEach((m) => m?.dispose?.());
        });
        this.workers = this.workers.filter((w) => w !== removed);
      }

      // Aggiungi nuovi modelli se aumentati
      while (currentOfType.length < targetVisual) {
        const w = this._spawnWorker(type, def);
        currentOfType.push(w);
        this.workers.push(w);
      }

      // Ricalcola la potenza erogata per hit da ogni entità visiva per coprire l'intero livello
      if (targetVisual > 0) {
        const totalDPS = lvl * def.dpsPerLevel;
        const totalSandPerCycle = totalDPS * def.cycleTime;
        const powerPerWorker = totalSandPerCycle / targetVisual;
        for (const w of currentOfType) {
          w.powerPerHit = powerPerWorker;
        }
      }
    }
  }

  _spawnWorker(type, def) {
    let m = null;
    let distMin = 14;
    let distMax = 50;

    if (type === 'scarab') {
      m = this.assets?.getModel
        ? this.assets.getModel('machinery/worker_scarab.glb', createScarabModel)
        : createScarabModel();
      distMin = 10; distMax = 42;
    } else if (type === 'excavator') {
      m = this.assets?.getModel
        ? this.assets.getModel('machinery/excavator_steam.glb', createExcavatorModel)
        : createExcavatorModel();
      distMin = 22; distMax = 65;
    } else if (type === 'dredge') {
      m = this.assets?.getModel
        ? this.assets.getModel('machinery/dredge.glb', createDredgeModel)
        : createDredgeModel();
      distMin = 35; distMax = 75;
    }

    if (!m.userData) m.userData = {};
    if (this.currentSkin && this.currentSkin !== 'machinery_standard') {
      this._applySkinToMesh(m, this.currentSkin);
    }

    const angle = Math.random() * Math.PI * 2;
    const r = distMin + Math.random() * (distMax - distMin);
    const rawX = Math.cos(angle) * r;
    const rawZ = Math.sin(angle) * r;
    const x = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, rawX));
    const z = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, rawZ));
    const y = this.terrain ? this.terrain.heightAt(x, z) : 12;

    m.position.set(x, y, z);
    m.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(m);

    const targetPos = this.getNewTargetPosition(x, z, 8);
    const worker = {
      type,
      mesh: m,
      get position() { return m.position; },
      timer: def.cycleTime * 0.85, // scava quasi subito dopo l'acquisto
      cycleTime: def.cycleTime,
      digRadius: def.digRadius,
      powerPerHit: def.dpsPerLevel * def.cycleTime,
      x, z,
      targetX: targetPos.x,
      targetZ: targetPos.z,
      animPhase: Math.random() * 6.28,
    };
    return worker;
  }

  getNewTargetPosition(fromX = 0, fromZ = 0, range = 12) {
    const rawX = fromX + (Math.random() - 0.5) * range;
    const rawZ = fromZ + (Math.random() - 0.5) * range;
    return {
      x: Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, rawX)),
      z: Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, rawZ)),
    };
  }

  update(renderDt) {
    if (!this.terrain) return;

    // Disaccoppiamento dal frame rate del rendering (Regola 4): usa timestamp reali o dt esplicito
    const now = performance.now();
    if (!this._lastUpdate) this._lastUpdate = now;
    const realDt = (renderDt !== undefined && renderDt > 0.5)
      ? renderDt
      : Math.min(0.5, Math.max(renderDt || 0.001, (now - this._lastUpdate) / 1000));
    this._lastUpdate = now;

    for (const w of this.workers) {
      w.timer += realDt;
      w.animPhase += realDt;

      // Clamping immediato su coordinate e mesh del lavoratore / escavatore
      const worker = w.mesh;
      worker.position.x = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, worker.position.x));
      worker.position.z = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, worker.position.z));
      w.x = worker.position.x;
      w.z = worker.position.z;

      // Se un mezzo tocca il perimetro di sicurezza, inverti il vettore di direzione verso il centro della duna (0, 0, 0)
      if (Math.abs(w.x) >= BOUNDARY_LIMIT || Math.abs(w.z) >= BOUNDARY_LIMIT) {
        const toCenterX = -w.x;
        const toCenterZ = -w.z;
        const len = Math.hypot(toCenterX, toCenterZ) || 1;
        const nudge = 12 + Math.random() * 8;
        w.targetX = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.x + (toCenterX / len) * nudge));
        w.targetZ = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.z + (toCenterZ / len) * nudge));
      }

      // Aggiornamento posizioni e animazioni procedurali
      if (w.type === 'scarab') {
        this._updateScarab(w, realDt);
      } else if (w.type === 'excavator') {
        this._updateExcavator(w, realDt);
      } else if (w.type === 'dredge') {
        this._updateDredge(w, realDt);
      }

      // Controllo del ciclo di scavo
      if (w.timer >= w.cycleTime) {
        w.timer -= w.cycleTime;
        this._executeDig(w);
      }
    }
  }

  _updateScarab(w, dt) {
    // Muove lentamente verso il bersaglio
    const dx = w.targetX - w.x;
    const dz = w.targetZ - w.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.4) {
      const speed = 1.6;
      w.x += (dx / dist) * speed * dt;
      w.z += (dz / dist) * speed * dt;
      w.x = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.x));
      w.z = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.z));
      w.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      // Sceglie un nuovo punto vicino strettamente interno al perimetro
      const nextTarget = this.getNewTargetPosition(w.x, w.z, 12);
      w.targetX = nextTarget.x;
      w.targetZ = nextTarget.z;
    }

    // Assicura quota sempre sulla superficie del terreno
    w.x = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.x));
    w.z = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.z));
    w.mesh.position.set(w.x, this.terrain.heightAt(w.x, w.z), w.z);

    // Movimento oscillatorio delle zampette
    if (w.mesh.userData.legs) {
      w.mesh.userData.legs.rotation.y = Math.sin(w.animPhase * 8) * 0.15;
    }
  }

  _updateExcavator(w, dt) {
    // Posizionato stabilmente sulle dune con confinamento perimetrale
    w.mesh.position.x = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.mesh.position.x));
    w.mesh.position.z = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.mesh.position.z));
    w.x = w.mesh.position.x;
    w.z = w.mesh.position.z;
    w.mesh.position.y = this.terrain.heightAt(w.x, w.z);

    // Animazione braccio: si alza e si prepara a colpire
    if (w.mesh.userData.armPivot) {
      const progress = w.timer / w.cycleTime; // 0..1
      // Slancio e colpo sul finale del ciclo
      if (progress > 0.75) {
        const strikeP = (progress - 0.75) / 0.25;
        w.mesh.userData.armPivot.rotation.x = -0.4 + Math.sin(strikeP * Math.PI) * 0.75;
      } else {
        w.mesh.userData.armPivot.rotation.x = -0.4;
      }
    }
  }

  _updateDredge(w, dt) {
    w.mesh.position.x = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.mesh.position.x));
    w.mesh.position.z = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, w.mesh.position.z));
    w.x = w.mesh.position.x;
    w.z = w.mesh.position.z;
    w.mesh.position.y = this.terrain.heightAt(w.x, w.z);

    // Rotazione continua della grande ruota a tazze
    if (w.mesh.userData.wheelPivot) {
      w.mesh.userData.wheelPivot.rotation.z += dt * 1.6;
    }
    // Pulsazione del nucleo
    if (w.mesh.userData.core) {
      const s = 1.0 + Math.sin(w.animPhase * 4) * 0.12;
      w.mesh.userData.core.scale.set(s, s, s);
    }
  }

  _executeDig(w) {
    const x = w.mesh.position.x;
    const z = w.mesh.position.z;
    const y = w.mesh.position.y;
    const radius = w.digRadius;
    const power = w.powerPerHit;

    // Se il terreno in quel punto è già a livello bedrock, sposta leggermente il lavoratore verso l'interno
    if (y <= this.terrain.floor + 0.05) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 12;
      const rawX = w.x + Math.cos(a) * r;
      const rawZ = w.z + Math.sin(a) * r;
      w.x = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, rawX));
      w.z = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, rawZ));
      const nextTarget = this.getNewTargetPosition(w.x, w.z, 8);
      w.targetX = nextTarget.x;
      w.targetZ = nextTarget.z;
      w.mesh.position.set(w.x, this.terrain.heightAt(w.x, w.z), w.z);
      return;
    }

    // Scavo fisico della mesh
    const removed = this.terrain.dig(x, z, radius, power * 0.25);
    // Assegna la sabbia allo stato del giocatore
    this.state.addSand(power);
    this.state.setCompletion(this.terrain.completion);

    // Effetti grafici e particelle conformi allo strato di scavo
    const intensity = w.type === 'scarab' ? 0.8 : w.type === 'excavator' ? 1.4 : 2.0;
    const layerCol = getLayerColor(y);
    this.particles.burst(x, y, z, {
      radius,
      color: layerCol,
      intensity,
      sparks: y <= 3.2 || w.type === 'dredge',
    });


    if (w.type === 'excavator') {
      this.scene?.shake?.(0.03);
    }
  }

  setSkin(skinId) {
    this.currentSkin = skinId;
    for (const w of this.workers) {
      this._applySkinToMesh(w.mesh, skinId);
    }
  }

  _applySkinToMesh(mesh, skinId) {
    if (!mesh) return;
    mesh.traverse((o) => {
      if (o.isMesh && o.material) {
        if (skinId === 'machinery_royal_gold') {
          o.material.color?.setHex?.(0xF5BA23);
          if (o.material.metalness !== undefined) o.material.metalness = 0.85;
          if (o.material.roughness !== undefined) o.material.roughness = 0.2;
        } else if (skinId === 'machinery_atlantis_teal') {
          o.material.color?.setHex?.(0x031826);
          o.material.emissive?.setHex?.(0x0FE3C1);
          o.material.emissiveIntensity = 0.65;
          if (o.material.metalness !== undefined) o.material.metalness = 0.5;
        } else {
          // Standard
          if (o.material.emissive && skinId === 'machinery_standard') {
            if (o.material.emissive.getHex() === 0x0FE3C1 && !o.name.includes('eye') && !o.name.includes('core')) {
              o.material.emissive.setHex(0x000000);
            }
          }
        }
        o.material.needsUpdate = true;
      }
    });
  }

  dispose() {
    this._unsubs.forEach((u) => u());
    for (const w of this.workers) {
      this.group.remove(w.mesh);
      w.mesh.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose?.());
      });
    }
    this.workers = [];
  }
}

