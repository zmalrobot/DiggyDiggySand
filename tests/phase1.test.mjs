// Test della Fase 1 (senza browser): node --import ./tests/register.mjs tests/phase1.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../js/world/Terrain.js';
import { State, MIN_TICK } from '../js/core/State.js';
import { formatNumber, formatPercent } from '../js/ui/Hud.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('formatNumber', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999.9), '999');
  assert.equal(formatNumber(1000), '1k');
  assert.equal(formatNumber(1234), '1.2k');
  assert.equal(formatNumber(12345), '12.3k');
  assert.equal(formatNumber(123456), '123k');
  assert.equal(formatNumber(1.5e6), '1.5M');
  assert.equal(formatNumber(999999), '1M');
  assert.equal(formatNumber(2.4e9), '2.4B');
  assert.equal(formatNumber(NaN), '0');
});

t('formatPercent', () => {
  assert.equal(formatPercent(0), '0.0%');
  assert.equal(formatPercent(0.5), '50.0%');
  assert.equal(formatPercent(0.0003), '0.03%');
  assert.equal(formatPercent(2), '100.0%');
});

t('State: statistiche iniziali (Shovel T1, raggio 1.5, 2 colpi/s)', () => {
  const s = new State();
  assert.deepEqual(s.stats, { power: 1, radius: 1.5, digRate: 2 });
  assert.ok(MIN_TICK === 0.06);
  s.addSand(5); assert.equal(s.sand, 5);
  assert.equal(s.spend(10), false);
  assert.equal(s.spend(2), true); assert.equal(s.sand, 3);
});

const mk = () => new Terrain({ size: 100, res: 100, startHeight: 12, floor: 0 });

t('Terrain: quote iniziali e sincronizzazione heights/position', () => {
  const tr = mk();
  assert.equal(tr.heights.length, 101 * 101);
  const pos = tr.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 37) { assert.equal(pos.getY(i), 12); assert.equal(tr.heights[i], 12); }
  assert.equal(tr.completion, 0);
});

t('Terrain.dig: falloff, clamp, sync, volume', () => {
  const tr = mk();
  const removed = tr.dig(0, 0, 3, 2);
  assert.ok(removed > 0);
  const c = tr.idx(50, 50);
  assert.equal(tr.heights[c], 10);                       // centro: -power
  assert.equal(tr.geometry.attributes.position.getY(c), 10);
  const mid = tr.heights[tr.idx(51, 50)];                // a 1m: falloff 1 - 1/3
  assert.ok(Math.abs(mid - (12 - 2 * (1 - 1 / 3))) < 1e-5);
  assert.equal(tr.heights[tr.idx(54, 50)], 12);          // fuori raggio
  assert.ok(Math.abs(tr.remainingVolume - (tr.initialVolume - removed)) < 1e-6);
  assert.ok(tr.completion > 0 && tr.completion < 1);
  for (let i = 0; i < 20; i++) tr.dig(0, 0, 3, 5);
  assert.equal(tr.heights[c], 0);                        // clamp al bedrock
  assert.ok(tr.dig(0, 0, 3, 5) === 0 || tr.heights[c] === 0);
});

t('Terrain: scavo completo => completion 1', () => {
  const tr = new Terrain({ size: 20, res: 20, startHeight: 12, floor: 0 });
  for (let x = -10; x <= 10; x += 1) for (let z = -10; z <= 10; z += 1) for (let k = 0; k < 3; k++) tr.dig(x, z, 3, 12);
  assert.ok(tr.completion > 0.999, String(tr.completion));
});

t('Terrain: bordi non crashano', () => {
  const tr = mk();
  tr.dig(-50, -50, 4, 1); tr.dig(50, 50, 4, 1); tr.dig(500, 500, 4, 1);
  assert.ok(tr.completion > 0);
});

t('Terrain.flush: ricolora solo i chunk sporchi e fa upload dopo lo scavo', () => {
  const tr = mk();
  assert.equal(tr.flush(), false);
  tr.dig(0, 0, 3, 11); // porta il centro a Y<=3 (pietra)
  assert.equal(tr.flush(), true);
  assert.equal(tr.flush(), false);
  assert.equal(tr.dirtyCount, 0);
  const col = tr.colors.array, i = tr.idx(50, 50), far = tr.idx(5, 5);
  const centerR = col[i * 3], farR = col[far * 3];
  assert.ok(farR > centerR, 'sabbia chiara lontano, pietra scura al centro');
});

t('Terrain.raycast: colpisce il piano e la buca', () => {
  const tr = mk();
  const ray = new THREE.Ray(new THREE.Vector3(10, 50, -5), new THREE.Vector3(0, -1, 0));
  const p = tr.raycast(ray);
  assert.ok(p && Math.abs(p.y - 12) < 0.01 && Math.abs(p.x - 10) < 1e-6 && Math.abs(p.z + 5) < 1e-6);
  tr.dig(10, -5, 4, 6);
  const q = tr.raycast(ray);
  assert.ok(q.y < 7, `y=${q.y}`);
  // raggio obliquo da camera
  const dir = new THREE.Vector3(-0.3, -0.8, 0.2).normalize();
  const o = new THREE.Vector3(30, 50, -20);
  const r = tr.raycast(new THREE.Ray(o, dir));
  assert.ok(r && Math.abs(r.y - tr.heightAt(r.x, r.z)) < 0.02);
  // fuori dal terreno
  assert.equal(tr.raycast(new THREE.Ray(new THREE.Vector3(500, 50, 0), new THREE.Vector3(0, -1, 0))), null);
  assert.equal(tr.raycast(new THREE.Ray(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, 1, 0))), null);
});

console.log(`\n${n} test passati`);
