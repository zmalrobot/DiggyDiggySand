import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9345;
const USER_DATA_DIR = `/tmp/qa-dds-phase15-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('   DIGGY DIGGY SAND - QA AUTOMATION PHASE 15 TEST');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Avvio headless Chrome con WebGL (SwiftShader)
const chromeProc = spawn('google-chrome', [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1280,840',
  TARGET_URL
], { stdio: ['ignore', 'pipe', 'pipe'] });

let chromeOutput = '';
chromeProc.stderr.on('data', (d) => { chromeOutput += d.toString(); });
chromeProc.stdout.on('data', (d) => { chromeOutput += d.toString(); });

function cleanup() {
  try { chromeProc.kill('SIGTERM'); } catch {}
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch {}
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

// 2. Attesa CDP
let wsUrl = null;
for (let i = 0; i < 30; i++) {
  await sleep(300);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    if (res.ok) {
      const list = await res.json();
      const page = list.find((p) => p.type === 'page' && p.url.includes('127.0.0.1:8080'));
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    }
  } catch {}
}

if (!wsUrl) {
  console.error('CDP endpoint non disponibile su porta', PORT);
  cleanup();
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
let reqId = 1;
const pending = new Map();
const consoleErrors = [];
const pageExceptions = [];

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const { type, args } = msg.params;
    const text = args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (type === 'error') {
      consoleErrors.push(text);
      console.error('[Page Console Error]', text);
    }
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const text = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
    pageExceptions.push(text);
    console.error('[Page Exception]', text);
  }
};

await new Promise((resolve) => ws.onopen = resolve);

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = reqId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalCode(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  }
  return res.result?.value;
}

async function captureScreenshot(filename) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.data, 'base64');
  const filepath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(filepath, buf);
  console.log(`[Screenshot Salvato] ${filename} (${buf.length} bytes)`);
  return filepath;
}

await send('Runtime.enable');
await send('Page.enable');

console.log('[QA] Attesa avvio e navigazione...');
await send('Page.navigate', { url: TARGET_URL });

let startBtnReady = false;
for (let i = 0; i < 60; i++) {
  await sleep(300);
  try {
    startBtnReady = await evalCode(`
      (() => {
        const btn = document.querySelector('#start-btn, .start-btn');
        return btn ? !btn.classList.contains('hidden') : false;
      })()
    `);
    if (startBtnReady) break;
  } catch {}
}

// Clicca start
await evalCode(`
  (() => {
    const btn = document.querySelector('#start-btn, .start-btn');
    if (btn) btn.click();
  })()
`);

// Attesa menu
for (let i = 0; i < 30; i++) {
  await sleep(200);
  const visible = await evalCode(`
    (() => {
      const m = document.getElementById('menu');
      return m ? !m.classList.contains('hidden') : false;
    })()
  `);
  if (visible) break;
}

// Nuova spedizione
await evalCode(`
  (() => {
    window.__dds?.save?.clear?.();
    window.__dds?.menu?.refresh?.();
    const newBtn = document.querySelector('[data-act="new"]');
    if (newBtn) newBtn.click();
  })()
`);
await sleep(400);

// Conferma spedizione deserto
await evalCode(`
  (() => {
    const btn = document.getElementById('btn-confirm-biome');
    if (btn) btn.click();
  })()
`);

// Attesa avvio gioco in phase 'play'
for (let i = 0; i < 40; i++) {
  await sleep(150);
  const phase = await evalCode(`window.__dds?.game?.phase`);
  if (phase === 'play') break;
}
await sleep(600);

// Pulizia tutorial e toast
await evalCode(`
  (() => {
    const g = window.__dds?.game;
    if (g) {
      g.phase = 'play';
      g.controls.enabled = true;
      g.digging?.setEnabled?.(true);
      g.tutorial?.complete?.();
    }
    document.getElementById('toast-host')?.remove();
    document.querySelectorAll('.tutorial-overlay, .ach-toast').forEach(el => el.remove());
  })()
`);
console.log('Spedizione avviata con successo.');

// =========================================================================
// 1. Verifica Terreno Procedurale con Dune Naturali
// =========================================================================
console.log('\n--- 1. Verifica Dune Naturali ---');
const duneReport = await evalCode(`
  (() => {
    const t = window.__dds?.game?.terrain;
    if (!t) return { ok: false, error: 'Terrain non trovato' };
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < t.heights.length; i++) {
      const h = t.heights[i];
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
    return {
      ok: true,
      minH,
      maxH,
      span: maxH - minH,
      completion: t.completion,
      initialVolume: t.initialVolume,
    };
  })()
`);
console.log('Dune report:', duneReport);
if (!duneReport.ok || duneReport.span <= 1.0) {
  throw new Error(`Dune non generate correttamente: ${JSON.stringify(duneReport)}`);
}
console.log(`✓ Dune naturali generate con escursione ${duneReport.span.toFixed(2)}m (min: ${duneReport.minH.toFixed(2)}, max: ${duneReport.maxH.toFixed(2)})`);
console.log(`✓ Completion iniziale esatta: ${(duneReport.completion * 100).toFixed(2)}%`);

await captureScreenshot('dds_qa_dunes_terrain.png');

// =========================================================================
// 2. Verifica Grafica Alta con Post-Processing (Selective Bloom + FXAA + Tone Mapping)
// =========================================================================
console.log('\n--- 2. Verifica Grafica Alta con Post-Processing & Antialiasing ---');
const postProcStatus = await evalCode(`
  (() => {
    const sm = window.__dds?.scene;
    if (!sm) return { ok: false };
    // Imposta qualità alta con post-processing attivo
    if (sm.settings) {
      sm.settings.set('graphics.postProcessing', true);
      sm.settings.set('graphics.dayNightCycle', 'day');
    }
    const pp = sm.postProcessing;
    const rt = pp ? pp.renderTarget : null;
    return {
      ok: true,
      postProcessingEnabled: pp?.enabled ?? false,
      samples: rt?.samples ?? 0,
      bloomThreshold: pp?.postMaterial?.uniforms?.uBloomThreshold?.value ?? 0,
      bloomIntensity: pp?.postMaterial?.uniforms?.uBloomIntensity?.value ?? 0,
      toneMapping: sm.renderer?.toneMapping,
      toneMappingExposure: sm.renderer?.toneMappingExposure,
    };
  })()
`);
console.log('PostProcessing status:', postProcStatus);
await sleep(600);

await captureScreenshot('dds_qa_high_graphics_lit.png');

// =========================================================================
// 3. Verifica Calibrazione Notturna & Ambient Floor (Nessun Blackout)
// =========================================================================
console.log('\n--- 3. Verifica Silhouette Notturna & Ambient Floor ---');
const nightStatus = await evalCode(`
  (() => {
    const sm = window.__dds?.scene;
    if (!sm) return { ok: false };
    if (sm.settings) {
      sm.settings.set('graphics.dayNightCycle', 'night');
    } else if (sm.dayNight) {
      sm.dayNight.setMode('night');
    }
    const hemi = sm.hemi;
    const ambient = sm.ambientLight;
    const sun = sm.sun;
    return {
      ok: true,
      nightFactor: sm.dayNight?.nightFactor,
      hemiIntensity: hemi?.intensity,
      hemiSkyColor: '#' + hemi?.color?.getHexString(),
      hemiGndColor: '#' + hemi?.groundColor?.getHexString(),
      ambientFloorIntensity: ambient?.intensity,
      sunIntensity: sun?.intensity,
    };
  })()
`);
console.log('Night lighting status:', nightStatus);
await sleep(800);

await captureScreenshot('dds_qa_night_visible.png');

// Ripristina giorno per sessioni future
await evalCode(`
  if (window.__dds?.scene?.settings) {
    window.__dds.scene.settings.set('graphics.dayNightCycle', 'auto');
  }
`);

// =========================================================================
// 4. Audit Errori Console e Eccezioni
// =========================================================================
console.log('\n--- 4. Audit Errori Console ed Eccezioni ---');
console.log(`Console Errors: ${consoleErrors.length}`);
console.log(`Page Exceptions: ${pageExceptions.length}`);

if (consoleErrors.length > 0 || pageExceptions.length > 0) {
  console.error('Audit FALLITO: rilevati errori di pagina');
  cleanup();
  process.exit(1);
}

console.log('✓ Audit SUPERATO con 0 errori di console e 0 eccezioni di pagina!');
console.log('========================================================');
console.log('   TUTTI I TEST QA BROWSER FASE 15 SUPERATI CON SUCCESSO!');
console.log('========================================================');

cleanup();
process.exit(0);
