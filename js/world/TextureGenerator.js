// Generatore di texture PBR procedurali ad alta risoluzione (2048x2048 FBM e Normal Maps analitiche Sobel).
import * as THREE from 'three';

// Cache globale delle texture PBR per evitare rigenerazioni multiple e saturazione VRAM
const PBR_CACHE = new Map();

/**
 * Permutazione per pseudo-random noise continuo 2D.
 */
const P = new Uint8Array(512);
const PERM = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
  8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
  35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
  134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
  55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
  18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
  250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
  189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
  172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
  228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
  107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
];
for (let i = 0; i < 256; i++) {
  P[i] = PERM[i];
  P[256 + i] = PERM[i];
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * Perlin Noise 2D periodico/continuo normalizzato in [-1, 1].
 */
export function perlin2D(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = P[P[X] + Y];
  const ab = P[P[X] + Y + 1];
  const ba = P[P[X + 1] + Y];
  const bb = P[P[X + 1] + Y + 1];

  const x1 = lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf));
  const x2 = lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1));

  return lerp(v, x1, x2);
}

/**
 * Fractional Brownian Motion (FBM) multi-ottava per grana fine e stratificazioni geologiche.
 */
export function fbm2D(x, y, octaves = 5, lacunarity = 2.0, gain = 0.5) {
  let sum = 0;
  let amp = 1.0;
  let freq = 1.0;
  let maxAmp = 0;

  for (let o = 0; o < octaves; o++) {
    sum += perlin2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / maxAmp;
}

/**
 * Crea o recupera un canvas offscreen con fallback sicuro in ambienti Node/headless.
 */
function createOffscreenCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof globalThis.__createMockCanvas === 'function') {
    return globalThis.__createMockCanvas(width, height);
  }
  return null;
}

/**
 * Libera le risorse VRAM e memoria di un canvas temporaneo.
 */
function releaseCanvas(canvas) {
  if (!canvas) return;
  try {
    canvas.width = 1;
    canvas.height = 1;
  } catch {}
}

/**
 * Configura i parametri di campionamento PBR su una texture Three.js:
 * Anisotropia massima, mipmaps bilineari e RepeatWrapping.
 */
export function configurePbrTexture(texture, { repeat = 32, maxAnisotropy = 16 } = {}) {
  if (!texture) return null;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = Math.max(1, maxAnisotropy || 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Genera il set PBR per il terreno sabbioso:
 * - normalMap: calcolata con operatore di Sobel sui gradienti FBM per micro-creste e granuli
 * - roughnessMap: valori differenziati (0.80 - 0.96 per sabbia polverosa, 0.35 - 0.55 per glint di quarzo/oricalco)
 */
export function generateSandPbrSet({ size = 2048, repeat = 32, maxAnisotropy = 16, strength = 1.8 } = {}) {
  const cacheKey = `sand_${size}_${repeat}_${maxAnisotropy}`;
  if (PBR_CACHE.has(cacheKey)) {
    return PBR_CACHE.get(cacheKey);
  }

  const heightCanvas = createOffscreenCanvas(size, size);
  if (!heightCanvas) {
    return { normalMap: null, roughnessMap: null };
  }

  // 1. Genera altezza FBM in un buffer Float32Array
  const heights = new Float32Array(size * size);
  const scale = 14.0;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = fbm2D(u * scale, v * scale, 5, 2.1, 0.48);
      heights[row + x] = n;
    }
  }

  // 2. Normal Map Analitica con gradiente Sobel 3x3
  const normalCanvas = createOffscreenCanvas(size, size);
  const normCtx = normalCanvas.getContext('2d');
  const normImg = normCtx.createImageData(size, size);
  const normData = normImg.data;

  // 3. Roughness Map (sabbia opaca con micro-venature minerali riflettenti)
  const roughCanvas = createOffscreenCanvas(size, size);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(size, size);
  const roughData = roughImg.data;

  const w = size;
  const h = size;

  for (let y = 0; y < h; y++) {
    const ym1 = (y - 1 + h) % h;
    const yp1 = (y + 1) % h;
    const yRow = y * w;
    const ym1Row = ym1 * w;
    const yp1Row = yp1 * w;

    for (let x = 0; x < w; x++) {
      const xm1 = (x - 1 + w) % w;
      const xp1 = (x + 1) % w;

      // Sobel kernel per dx
      const zTL = heights[ym1Row + xm1];
      const zL  = heights[yRow + xm1];
      const zBL = heights[yp1Row + xm1];
      const zTR = heights[ym1Row + xp1];
      const zR  = heights[yRow + xp1];
      const zBR = heights[yp1Row + xp1];

      // Sobel kernel per dy
      const zT  = heights[ym1Row + x];
      const zB  = heights[yp1Row + x];

      const dx = (zTR + 2 * zR + zBR) - (zTL + 2 * zL + zBL);
      const dy = (zBL + 2 * zB + zBR) - (zTL + 2 * zT + zTR);

      // Vettore normale normalizzato: (-dx * strength, -dy * strength, 1.0)
      const nx = -dx * strength;
      const ny = -dy * strength;
      const nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);

      const fnx = nx * invLen;
      const fny = ny * invLen;
      const fnz = nz * invLen;

      const idx = (yRow + x) * 4;

      // Codifica Normal Map RGB tangent space: [0..255]
      normData[idx]     = Math.floor((fnx * 0.5 + 0.5) * 255);
      normData[idx + 1] = Math.floor((fny * 0.5 + 0.5) * 255);
      normData[idx + 2] = Math.floor((fnz * 0.5 + 0.5) * 255);
      normData[idx + 3] = 255;

      // Roughness Map differenziata:
      // Valori compresi tra 0.78 e 0.95 per sabbia asciutta, con venature 0.35-0.55 per silice/quarzo
      const currentH = heights[yRow + x];
      const isQuartzGlint = (currentH > 0.42 && (x % 3 === 0 || y % 3 === 0));
      let roughVal;
      if (isQuartzGlint) {
        roughVal = Math.floor(90 + (currentH + 1) * 35); // lucentezza minerale
      } else {
        roughVal = Math.floor(205 + currentH * 45);     // sabbia asciutta diffusa
      }
      roughVal = Math.min(255, Math.max(0, roughVal));

      roughData[idx]     = roughVal;
      roughData[idx + 1] = roughVal;
      roughData[idx + 2] = roughVal;
      roughData[idx + 3] = 255;
    }
  }

  normCtx.putImageData(normImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  configurePbrTexture(normalMap, { repeat, maxAnisotropy });

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  configurePbrTexture(roughnessMap, { repeat, maxAnisotropy });

  // Rilascia canvas temporanei per deallocazione VRAM immediata
  releaseCanvas(heightCanvas);

  const result = { normalMap, roughnessMap };
  PBR_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Genera una Normal Map procedurale per arenaria scalpellata (pietra delle rovine e piramidi).
 */
export function generateChiseledStoneNormalMap({ size = 1024, repeat = 12, maxAnisotropy = 16 } = {}) {
  const cacheKey = `chiseled_stone_${size}_${repeat}_${maxAnisotropy}`;
  if (PBR_CACHE.has(cacheKey)) {
    return PBR_CACHE.get(cacheKey);
  }

  const canvas = createOffscreenCanvas(size, size);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const heights = new Float32Array(size * size);
  const blockScale = 8.0;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const yRow = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Pattern a blocchi di pietra scalpellata con micro-fessure
      const brickU = (u * blockScale) % 1.0;
      const brickV = (v * blockScale) % 1.0;
      const edge = Math.min(brickU, 1 - brickU, brickV, 1 - brickV);
      const groove = edge < 0.08 ? (edge / 0.08) * -0.6 : 0.0;
      const chiselNoise = fbm2D(u * 22.0, v * 22.0, 4, 2.0, 0.5) * 0.45;
      heights[yRow + x] = groove + chiselNoise;
    }
  }

  // Gradiente Sobel per arenaria
  const strength = 2.4;
  for (let y = 0; y < size; y++) {
    const ym1 = (y - 1 + size) % size;
    const yp1 = (y + 1) % size;
    const yRow = y * size;
    const ym1Row = ym1 * size;
    const yp1Row = yp1 * size;

    for (let x = 0; x < size; x++) {
      const xm1 = (x - 1 + size) % size;
      const xp1 = (x + 1) % size;

      const zTL = heights[ym1Row + xm1];
      const zL  = heights[yRow + xm1];
      const zBL = heights[yp1Row + xm1];
      const zTR = heights[ym1Row + xp1];
      const zR  = heights[yRow + xp1];
      const zBR = heights[yp1Row + xp1];

      const zT  = heights[ym1Row + x];
      const zB  = heights[yp1Row + x];

      const dx = (zTR + 2 * zR + zBR) - (zTL + 2 * zL + zBL);
      const dy = (zBL + 2 * zB + zBR) - (zTL + 2 * zT + zTR);

      const nx = -dx * strength;
      const ny = -dy * strength;
      const nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);

      const idx = (yRow + x) * 4;
      data[idx]     = Math.floor((nx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((ny * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor((nz * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  configurePbrTexture(texture, { repeat, maxAnisotropy });

  PBR_CACHE.set(cacheKey, texture);
  return texture;
}

/**
 * Pulisce la cache delle texture PBR e dealloca le istanze GPU.
 */
export function disposePbrTextures() {
  for (const entry of PBR_CACHE.values()) {
    if (entry.normalMap) entry.normalMap.dispose();
    if (entry.roughnessMap) entry.roughnessMap.dispose();
    if (entry.dispose) entry.dispose();
  }
  PBR_CACHE.clear();
}
