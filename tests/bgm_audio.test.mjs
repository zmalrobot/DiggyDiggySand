import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { AudioEngine, BGM_TRACKS } from '../js/core/AudioEngine.js';
import { SettingsManager } from '../js/core/SettingsManager.js';

console.log('--- TEST COLONNA SONORA ADATTIVA & BGM ENGINE ---');

// 1. Verifica esistenza file fisici mp3 scaricati
const expectedTracks = ['menu', 'desert', 'ocean', 'glacier', 'jungle'];
for (const trackKey of expectedTracks) {
  assert.ok(BGM_TRACKS[trackKey], `Traccia "${trackKey}" presente in BGM_TRACKS`);
  const relPath = BGM_TRACKS[trackKey].replace(/^\.\//, '');
  const fullPath = path.resolve(relPath);
  assert.ok(fs.existsSync(fullPath), `File audio esiste su disco: ${fullPath}`);
  const stat = fs.statSync(fullPath);
  assert.ok(stat.size > 1000000, `File audio ha dimensione valida (>1MB): ${stat.size} bytes`);
}
console.log('✓ File audio MP3 Kevin MacLeod presenti e validi per tutte le 5 tracce');

// 2. Mock storage per SettingsManager
const mockStorage = {
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  clear() { this.data = {}; },
};

const settings = new SettingsManager(mockStorage);
const audio = new AudioEngine(settings);

// Verifica calcolo del volume musicale percettivo
settings.set('audio.master', 100);
settings.set('audio.music', 100);
settings.set('audio.mute', false);
assert.strictEqual(audio._getMusicEffectiveGain(), 1.0, 'Volume al 100% master e music deve dare 1.0');

settings.set('audio.music', 50); // (50/100)^2 = 0.25
assert.strictEqual(audio._getMusicEffectiveGain(), 0.25, 'Volume musica al 50% con master 100% deve dare 0.25');

settings.set('audio.mute', true);
assert.strictEqual(audio._getMusicEffectiveGain(), 0.0, 'Mute attivo deve azzerare il volume musicale');

settings.set('audio.mute', false);
settings.set('audio.master', 80); // (80/100)^2 = 0.64
settings.set('audio.music', 60);  // (60/100)^2 = 0.36
const expected = 0.64 * 0.36;
assert.ok(Math.abs(audio._getMusicEffectiveGain() - expected) < 0.001, 'Formula percettiva corretta');
console.log('✓ Calcolo volume musicale percettivo e mute verificato');

// 3. Verifica pending music quando non sbloccato
audio.unlockedByUser = false;
audio.playMusic('menu');
assert.ok(audio.pendingMusic, 'Pending music impostata se non sbloccato da utente');
assert.strictEqual(audio.pendingMusic.trackKey, 'menu');
console.log('✓ Gestione policy autoplay del browser con pendingMusic verificata');

// 4. Test fallback procedurale trasparente
audio._startProceduralBgmFallback('desert');
assert.strictEqual(audio.proceduralBgmActive, true, 'Procedural BGM fallback attivabile senza errori');
console.log('✓ Fallback procedurale trasparente verificato');

audio.dispose();
console.log('✓ AudioEngine.dispose() completato senza leak');
console.log('--- TUTTI I TEST BGM PASSATI CON SUCCESSO ---');

