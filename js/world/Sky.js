// Cielo procedurale, cupola stellata e luna luminescente per il ciclo notte.
// Punti stella a bassa densità (THREE.Points) per massime performance su mobile.
import * as THREE from 'three';

export class Sky {
  constructor(scene = null) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'sky-celestial';

    this.stars = null;
    this.moon = null;

    this._buildStars();
    this._buildMoon();
    this.scene?.add?.(this.group);
  }

  _buildStars() {
    const starCount = 350; // budget leggero e performante
    const radius = 180;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const c1 = new THREE.Color(0xFFFFFF);
    const c2 = new THREE.Color(0x0FE3C1); // bagliore cyan atlantideo
    const c3 = new THREE.Color(0xF5BA23); // oro stellare

    for (let i = 0; i < starCount; i++) {
      // Distribuzione emisferica superiore (Y > 10)
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = radius * (0.9 + Math.random() * 0.2);

      const sinPhi = Math.sin(phi);
      const x = r * sinPhi * Math.cos(theta);
      const y = Math.abs(r * Math.cos(phi)) + 12; // sempre sopra l'orizzonte
      const z = r * sinPhi * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Colore casuale bianco/ciano/oro
      const pick = Math.random();
      const col = pick < 0.65 ? c1 : pick < 0.85 ? c2 : c3;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.0, // invisibili di giorno
      depthWrite: false,
    });

    this.starsMat = mat;
    this.stars = new THREE.Points(geo, mat);
    this.group.add(this.stars);
  }

  _buildMoon() {
    // Disco lunare oricalco/argento
    const geo = new THREE.SphereGeometry(4.5, 12, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xE8F4F8,
    });
    this.moonMat = mat;
    this.moon = new THREE.Mesh(geo, mat);
    this.moon.position.set(0, -50, 0); // posizionata dinamicamente da DayNightCycle
    this.group.add(this.moon);
  }

  /**
   * Aggiorna opacità delle stelle e posizione della luna in base all'ora (0..1).
   * @param {number} nightFactor 0 = pieno giorno, 1 = notte fonda
   * @param {THREE.Vector3} moonPos Posizione della luna opposta al sole
   */
  update(arg1, arg2) {
    let nightFactor = typeof arg1 === 'number' ? arg1 : 0;
    let moonPos = arg2 instanceof THREE.Vector3 ? arg2 : null;
    if (typeof arg2 === 'number') {
      nightFactor = arg2;
    }
    if (this.starsMat) {
      this.starsMat.opacity = Math.max(0, Math.min(0.95, nightFactor * 1.2));
    }
    if (this.moon) {
      if (moonPos) {
        this.moon.position.copy(moonPos);
        this.moon.visible = moonPos.y > -10;
      } else {
        this.moon.position.y = -40 + nightFactor * 85;
      }
    }
  }

  dispose() {
    if (this.stars) {
      this.stars.geometry.dispose();
      this.stars.material.dispose();
      this.stars = null;
    }
    if (this.moon) {
      this.moon.geometry.dispose();
      this.moon.material.dispose();
      this.moon = null;
    }
    this.scene?.remove?.(this.group);
  }
}
