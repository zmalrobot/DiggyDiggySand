// Micro-particelle atmosferiche fluttuanti (Dust Motes) per dare tangibilità e profondità all'aria del deserto.
// 100 particelle dorate/traslucide con moto browniano/sinusoidale lento attorno all'area di scavo.
import * as THREE from 'three';

const MOTE_COUNT = 100;
const BOUNDS = { x: 30, yMin: 0.5, yMax: 18, z: 30 };

const BIOME_MOTE_COLORS = {
  desert: [new THREE.Color(0xF5BA23), new THREE.Color(0xE4C580), new THREE.Color(0xD4AF37)],
  ocean: [new THREE.Color(0x00F2FF), new THREE.Color(0x4A7C82), new THREE.Color(0x70E4EF)],
  glacier: [new THREE.Color(0xE8F4F8), new THREE.Color(0x7BAEC2), new THREE.Color(0xA9DEF9)],
  jungle: [new THREE.Color(0x2ECC71), new THREE.Color(0x88D49E), new THREE.Color(0xF9E79F)],
};

export class Atmosphere {
  constructor(scene, settings = null) {
    this.scene = scene;
    this.settings = settings;
    this.enabled = this.settings ? this.settings.get('graphics.dustMotes') !== false : true;
    this.biome = 'desert';
    this.time = 0;

    this.group = new THREE.Group();
    this.group.name = 'atmosphere-dust-motes';

    // Geometria chiseled low-poly (ottaedro) conforme all'Art Bible Three.js
    const geo = new THREE.OctahedronGeometry(0.14, 0);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xF5BA23,
      emissive: 0xC89849,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.65,
      flatShading: true,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, MOTE_COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    // Buffer dati particelle: [x, y, z, vx, vy, vz, rotSpeed, scaleBase, seed]
    this.particles = [];
    const dummy = new THREE.Object3D();
    const colors = BIOME_MOTE_COLORS[this.biome] || BIOME_MOTE_COLORS.desert;

    for (let i = 0; i < MOTE_COUNT; i++) {
      const p = {
        x: (Math.random() - 0.5) * BOUNDS.x * 2,
        y: BOUNDS.yMin + Math.random() * (BOUNDS.yMax - BOUNDS.yMin),
        z: (Math.random() - 0.5) * BOUNDS.z * 2,
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        scale: 0.6 + Math.random() * 0.8,
        speedX: 0.2 + Math.random() * 0.3,
        speedY: 0.12 + Math.random() * 0.2,
        speedZ: 0.2 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      };
      this.particles.push(p);

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.scale);
      dummy.rotation.set(p.rx, p.ry, 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      const col = colors[i % colors.length];
      this.mesh.setColorAt(i, col);
    }

    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;

    this.group.add(this.mesh);
    this.group.visible = this.enabled;
    this.scene.add(this.group);

    this._dummy = dummy;
    this._unsub = this.settings?.subscribe?.('graphics.dustMotes', (val) => {
      this.setEnabled(!!val);
    });
  }

  setBiome(biomeId) {
    if (!BIOME_MOTE_COLORS[biomeId]) return;
    this.biome = biomeId;
    const colors = BIOME_MOTE_COLORS[biomeId];
    for (let i = 0; i < MOTE_COUNT; i++) {
      const col = colors[i % colors.length];
      this.mesh.setColorAt(i, col);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    if (biomeId === 'ocean') {
      this.material.color.setHex(0x00F2FF);
      this.material.emissive.setHex(0x00B4D8);
    } else if (biomeId === 'glacier') {
      this.material.color.setHex(0xE8F4F8);
      this.material.emissive.setHex(0x7BAEC2);
    } else if (biomeId === 'jungle') {
      this.material.color.setHex(0x2ECC71);
      this.material.emissive.setHex(0x1B4D3E);
    } else {
      this.material.color.setHex(0xF5BA23);
      this.material.emissive.setHex(0xC89849);
    }
  }

  setEnabled(val) {
    this.enabled = !!val;
    this.group.visible = this.enabled;
  }

  update(dt) {
    if (!this.enabled || !this.group.visible) return;
    this.time += dt;
    const t = this.time;
    const dummy = this._dummy;

    for (let i = 0; i < MOTE_COUNT; i++) {
      const p = this.particles[i];

      // Moto sinusoidale / browniano lento
      p.x += Math.sin(t * p.speedX + p.phase) * dt * 0.85;
      p.y += (Math.cos(t * p.speedY + p.phase) * 0.4 + 0.25) * dt; // leggera corrente ascendente termica
      p.z += Math.cos(t * p.speedZ + p.phase * 1.3) * dt * 0.85;

      p.rx += dt * 0.45;
      p.ry += dt * 0.65;

      // Wrap-around morbido nei limiti del cratere
      if (p.y > BOUNDS.yMax) {
        p.y = BOUNDS.yMin + Math.random() * 2;
        p.x = (Math.random() - 0.5) * BOUNDS.x * 2;
        p.z = (Math.random() - 0.5) * BOUNDS.z * 2;
      }
      if (Math.abs(p.x) > BOUNDS.x) p.x = -Math.sign(p.x) * (BOUNDS.x - 1);
      if (Math.abs(p.z) > BOUNDS.z) p.z = -Math.sign(p.z) * (BOUNDS.z - 1);

      // Micro-pulsazione della scala
      const currentScale = p.scale * (0.9 + Math.sin(t * 1.5 + p.phase) * 0.15);

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, 0);
      dummy.scale.setScalar(currentScale);
      dummy.updateMatrix();

      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this._unsub?.();
    this.scene.remove(this.group);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

