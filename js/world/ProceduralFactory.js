// Mesh procedurali di fallback (Chiseled Low-Poly: flatShading sempre attivo).
import * as THREE from 'three';
import { generateChiseledStoneNormalMap } from './TextureGenerator.js';

export const PALETTE_3D = {
  sandTop: 0xE4C580,
  sandMid: 0xC89849,
  sandBedrock: 0x8C5828,
  ruinsStone: 0x4A4138,
  ruinsGoldInlay: 0xF5BA23,
  atlantisCoreTeal: 0x0FE3C1,
  sunLight: 0xFFF3D6,
  ambientSky: 0x3A5A6D,
  crystalLight: 0x00E5FF,
  particleDust: 0xECD599,
  particleSpark: 0x0FE3C1,
  orichalcum: 0xD87D38,
  abyss: 0x031826,
};

const getStoneNormalMap = () => generateChiseledStoneNormalMap();

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
const mesh = (geo, material, pos = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

export const FallbackMeshes = {
  createWorker() {
    const g = new THREE.Group();
    // Tronco conico con tunica chiara (chiseled low-poly 6 facce)
    const robe = mesh(
      new THREE.CylinderGeometry(0.22, 0.45, 1.2, 6),
      mat(PALETTE_3D.sandTop, { roughness: 0.85, metalness: 0.05 }),
      [0, 0.6, 0]
    );
    // Testa stilizzata
    const head = mesh(
      new THREE.SphereGeometry(0.2, 6, 5),
      mat(PALETTE_3D.sandMid, { roughness: 0.85, metalness: 0.05 }),
      [0, 1.3, 0]
    );
    // Pala in mano: manico lungo in legno/pietra e lama metallica dorata/oricalco
    const handle = mesh(
      new THREE.BoxGeometry(0.06, 1.25, 0.06),
      mat(PALETTE_3D.sandBedrock, { roughness: 0.85, metalness: 0.1 }),
      [0.38, 0.55, 0.15]
    );
    const blade = mesh(
      new THREE.BoxGeometry(0.26, 0.35, 0.05),
      mat(PALETTE_3D.orichalcum, { metalness: 0.8, roughness: 0.3 }),
      [0.38, -0.05, 0.15]
    );
    g.add(robe, head, handle, blade);
    return g;
  },

  createSifter() {
    const g = new THREE.Group();
    const m = mat(PALETTE_3D.sandBedrock, { roughness: 0.88, metalness: 0.02 });
    for (const [x, z] of [[-0.6, 0], [0.6, 0]]) {
      const leg = mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), m, [x, 0.8, z]);
      leg.rotation.z = x < 0 ? -0.2 : 0.2;
      g.add(leg);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.3, 6), mat(PALETTE_3D.orichalcum, { metalness: 0.85, roughness: 0.22 }), [0, 0.9, 0]));
    return g;
  },

  createExcavator() {
    const g = new THREE.Group();
    // Chassis squadrato marrone/ocra
    const chassis = mesh(
      new THREE.BoxGeometry(1.8, 0.65, 2.4),
      mat(PALETTE_3D.sandBedrock, { roughness: 0.75, metalness: 0.2 }),
      [0, 0.35, 0]
    );
    // Cingoli pesanti ai due lati
    const trackL = mesh(new THREE.BoxGeometry(0.42, 0.45, 2.6), mat(PALETTE_3D.ruinsStone, { roughness: 0.85, metalness: 0.1 }), [-0.85, 0.22, 0]);
    const trackR = mesh(new THREE.BoxGeometry(0.42, 0.45, 2.6), mat(PALETTE_3D.ruinsStone, { roughness: 0.85, metalness: 0.1 }), [0.85, 0.22, 0]);

    // Cabina dorata rialzata
    const cab = mesh(
      new THREE.BoxGeometry(0.95, 0.85, 1.1),
      mat(PALETTE_3D.ruinsGoldInlay, { metalness: 0.85, roughness: 0.22 }),
      [0.35, 0.95, 0.15]
    );

    // Braccio con benna grigia metallica inclinata
    const arm = mesh(
      new THREE.BoxGeometry(0.24, 0.24, 2.2),
      mat(PALETTE_3D.orichalcum, { metalness: 0.85, roughness: 0.22 }),
      [-0.25, 1.1, -1.0]
    );
    arm.rotation.x = 0.55;

    const bucket = mesh(
      new THREE.BoxGeometry(0.85, 0.55, 0.65),
      mat(PALETTE_3D.ruinsStone, { metalness: 0.8, roughness: 0.35 }),
      [-0.25, 0.45, -2.0]
    );
    bucket.rotation.x = -0.35;

    g.add(chassis, trackL, trackR, cab, arm, bucket);
    return g;
  },

  createMonolith() {
    const g = new THREE.Group();
    const needle = mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      mat(PALETTE_3D.abyss, { emissive: 0x00F2FF, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.1 })
    );
    needle.scale.set(0.6, 2.2, 0.6);
    g.add(needle);
    return g;
  },

  createObelisk() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.7, 4.0, 4), mat(PALETTE_3D.sandBedrock, { roughness: 0.88, metalness: 0.02, normalMap: getStoneNormalMap() })));
    // punta dorata
    g.add(mesh(
      new THREE.ConeGeometry(0.4, 0.8, 4),
      mat(PALETTE_3D.ruinsGoldInlay, { metalness: 0.85, roughness: 0.22 }),
      [0, 2.4, 0]
    ));
    // fascia con incisione teal
    g.add(mesh(
      new THREE.CylinderGeometry(0.52, 0.56, 0.12, 4),
      mat(PALETTE_3D.abyss, { emissive: 0x00F2FF, emissiveIntensity: 0.9, roughness: 0.1 }),
      [0, 0.6, 0]
    ));
    return g;
  },

  createPillar() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.2, 6), mat(PALETTE_3D.ruinsStone, { roughness: 0.88, metalness: 0.02, normalMap: getStoneNormalMap() })));
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), mat(PALETTE_3D.sandBedrock, { roughness: 0.88, metalness: 0.02, normalMap: getStoneNormalMap() }), [0, 1.7, 0]));
    return g;
  },

  createChest() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1, 0.6, 0.6), mat(PALETTE_3D.sandBedrock, { roughness: 0.88, metalness: 0.02, normalMap: getStoneNormalMap() }), [0, 0.3, 0]));
    g.add(mesh(new THREE.BoxGeometry(1.04, 0.2, 0.64), mat(PALETTE_3D.ruinsGoldInlay, { metalness: 0.85, roughness: 0.22 }), [0, 0.7, 0]));
    return g;
  },

  createShovel() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), mat(PALETTE_3D.sandBedrock, { roughness: 0.88, metalness: 0.02 })));
    g.add(mesh(new THREE.BoxGeometry(0.35, 0.4, 0.05), mat(PALETTE_3D.orichalcum, { metalness: 0.85, roughness: 0.22 }), [0, -0.7, 0]));
    return g;
  },

  createDynamite() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 6), mat(PALETTE_3D.sandBedrock, { roughness: 0.88, metalness: 0.02 })));
    g.add(mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.1, 6), mat(PALETTE_3D.orichalcum, { metalness: 0.85, roughness: 0.22 }), [0, 0.2, 0]));
    return g;
  },

  createGem() {
    return mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      mat(0x1D3557, { emissive: 0x00F2FF, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.1 })
    );
  },

  createCone() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.ConeGeometry(0.3, 0.9, 6), mat(0xFF6B00, { roughness: 0.4, metalness: 0.1 }), [0, 0.45, 0]));
    g.add(mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), mat(0x333333, { roughness: 0.88, metalness: 0.02 }), [0, 0.04, 0]));
    return g;
  },

  createSarcophagus() {
    return mesh(new THREE.BoxGeometry(1.1, 0.7, 2.4), mat(0x100A0A, { metalness: 0.02, roughness: 0.88, normalMap: getStoneNormalMap() }), [0, 0.35, 0]);
  },
};

/** Mappa asset ID del manifest -> generatore di fallback. */
const ID_TO_FALLBACK = {
  TOOL_SHOVEL: 'createShovel',
  TOOL_PICKAXE: 'createShovel',
  TOOL_DYNAMITE: 'createDynamite',
  MODEL_SHOVEL: 'createShovel',
  UNIT_NOMAD: 'createWorker',
  UNIT_SCARAB: 'createWorker',
  MODEL_WORKER: 'createWorker',
  UNIT_SIFTER: 'createSifter',
  UNIT_EXCAVATOR: 'createExcavator',
  MODEL_EXCAVATOR: 'createExcavator',
  UNIT_DREDGE: 'createMonolith',
  UNIT_MONOLITH: 'createMonolith',
  RUIN_COLUMN: 'createPillar',
  RUIN_PILLAR: 'createPillar',
  RUIN_OBELISK: 'createObelisk',
  MODEL_OBELISK: 'createObelisk',
  RUIN_TEMPLE: 'createObelisk',
  RUIN_WALL: 'createPillar',
  RUIN_CHEST: 'createChest',
  MODEL_CHEST: 'createChest',
  END_CURSE_CORE: 'createSarcophagus',
  END_TREASURE_GEM: 'createGem',
  END_BIZ_CONE: 'createCone',
};

/** Crea il fallback per un ID di asset. ID sconosciuto: monolite cerimoniale articolato (zero cubi piatti). */
export function createFallback(id) {
  const fn = FallbackMeshes[ID_TO_FALLBACK[id]];
  if (fn) return fn();
  // Struttura archeologica articolata multi-pezzo per garantire sempre zero cubi grezzi
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 6), mat(PALETTE_3D.sandBedrock, { roughness: 0.85, metalness: 0.05, normalMap: getStoneNormalMap() }), [0, 0.7, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.25, 6), mat(PALETTE_3D.orichalcum, { metalness: 0.85, roughness: 0.22 }), [0, 1.5, 0]));
  g.add(mesh(new THREE.OctahedronGeometry(0.35, 0), mat(PALETTE_3D.atlantisCoreTeal, { emissive: 0x00F2FF, emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.1 }), [0, 1.85, 0]));
  return g;
}

/**
 * Crea una mesh procedurale per una chiave asset generica o percorso file.
 * @param {string} assetKey
 */
export function createMesh(assetKey) {
  if (!assetKey) return createFallback('RUIN_PILLAR');
  const cleanKey = String(assetKey).toLowerCase().replace(/^assets\/models\//, '').replace(/\.glb$/, '');
  if (cleanKey.includes('shovel')) return FallbackMeshes.createShovel();
  if (cleanKey.includes('worker') || cleanKey.includes('scarab')) return FallbackMeshes.createWorker();
  if (cleanKey.includes('excavator')) return FallbackMeshes.createExcavator();
  if (cleanKey.includes('dredge') || cleanKey.includes('monolith')) return FallbackMeshes.createMonolith();
  if (cleanKey.includes('obelisk') || cleanKey.includes('temple')) return FallbackMeshes.createObelisk();
  if (cleanKey.includes('chest')) return FallbackMeshes.createChest();
  if (cleanKey.includes('column') || cleanKey.includes('pillar')) return FallbackMeshes.createPillar();
  return createFallback(assetKey);
}

export const FALLBACK_IDS = Object.keys(ID_TO_FALLBACK);
export const ProceduralFactory = { FallbackMeshes, createFallback, createMesh, FALLBACK_IDS };


