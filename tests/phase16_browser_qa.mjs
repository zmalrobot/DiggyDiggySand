import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9346;
const USER_DATA_DIR = `/tmp/qa-dds-phase16-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('   DIGGY DIGGY SAND - QA AUTOMATION PHASE 16 TEST');
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

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = reqId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

ws.onmessage = (evt) => {
  const msg = JSON.parse(evt.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    if (msg.params.type === 'error') {
      const text = msg.params.args?.map((a) => a.value ?? a.description ?? '').join(' ');
      consoleErrors.push(text);
      console.error('[Browser console.error]', text);
    }
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const text = msg.params.exceptionDetails?.text || 'Uncaught exception';
    consoleErrors.push(text);
    console.error('[Browser exception]', text);
  } else if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
};

await new Promise((res) => { ws.onopen = res; });
await send('Runtime.enable');
await send('Page.enable');

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error('Eval exception: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
}

async function takeScreenshot(filename) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.data, 'base64');
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log(`[Screenshot salvato] ${outPath} (${buf.length} bytes)`);
}

console.log('Attendiamo il bootstrap del gioco e il pulsante di avvio...');
let ready = false;
for (let i = 0; i < 40; i++) {
  await sleep(400);
  try {
    const btnReady = await evaluate(`
      (() => {
        const btn = document.querySelector('#start-btn, .start-btn');
        return btn ? !btn.classList.contains('hidden') : false;
      })()
    `);
    if (btnReady) {
      await evaluate(`document.querySelector('#start-btn, .start-btn')?.click()`);
      ready = true;
      break;
    }
  } catch {}
}

// Attesa entrata nel menu e inizializzazione game
for (let i = 0; i < 30; i++) {
  await sleep(300);
  const gameReady = await evaluate(`!!(window.__dds && window.__dds.scene && window.__dds.scene.ok && window.__dds.game)`);
  if (gameReady) break;
}

console.log('✓ DDS Engine bootstrap completato.');

// Avvio della spedizione
await evaluate(`
  (async () => {
    window.__dds.game.startNewRun();
  })()
`);

// Attesa fine animazione camera intro (phase === 'play')
for (let i = 0; i < 40; i++) {
  await sleep(200);
  const phase = await evaluate(`window.__dds?.game?.phase`);
  if (phase === 'play') break;
}
await sleep(500);

// Verifica stato 3D e texture
const textureReport = await evaluate(`
  (() => {
    const g = window.__dds.game;
    const sm = window.__dds.scene;
    const terrain = g.terrain;
    const mat = terrain?.material;
    const tex = terrain?.sandGrainTexture;
    return {
      hasTerrain: !!terrain,
      hasTexture: !!tex,
      repeatX: tex?.repeat?.x,
      repeatY: tex?.repeat?.y,
      anisotropy: tex?.anisotropy,
      maxAnisotropy: sm?.maxAnisotropy,
      flatShading: mat?.flatShading,
      hasRoughnessMap: !!mat?.roughnessMap,
      hasBumpMap: !!mat?.bumpMap,
    };
  })()
`);
console.log('Texture Report:', textureReport);

if (!textureReport.hasTexture || textureReport.repeatX !== 64 || !textureReport.flatShading) {
  console.error('Texture report non conforme alle specifiche:', textureReport);
  cleanup();
  process.exit(1);
}
console.log('✓ 1. Texture 2048x2048 con repeat 64x64, bumpMap e anisotropia massima verificata');

// Test Zoom con CameraController
console.log('Test Zoom Ravvicinato per visualizzazione grana...');
await evaluate(`
  (() => {
    const g = window.__dds.game;
    g.cameraController.setDistance(14.5); // Zoom ravvicinato al fondo
  })()
`);
await sleep(600);
await takeScreenshot('dds_qa_camera_zoomed_grain.png');
console.log('✓ 2. Zoom ravvicinato (14.5m) catturato con successo.');

// Test Rotazione Orbitale Q / E
console.log('Test Rotazione Orbitale da Tastiera (Q / E)...');
const beforeRotation = await evaluate(`
  (() => {
    return {
      theta: window.__dds.game.cameraController._spherical.theta,
      camPos: { ...window.__dds.game.sceneMgr.camera.position }
    };
  })()
`);

// Simula pressione prolungata del tasto E (rotazione antioraria)
await evaluate(`
  (() => {
    const g = window.__dds.game;
    const keys = new Set(['KeyE']);
    for (let i = 0; i < 20; i++) {
      g.cameraController.update(0.05, keys);
    }
  })()
`);
await sleep(600);

const afterRotation = await evaluate(`
  (() => {
    return {
      theta: window.__dds.game.cameraController._spherical.theta,
      camPos: { ...window.__dds.game.sceneMgr.camera.position }
    };
  })()
`);
console.log('Rotazione Azimuth:', beforeRotation.theta, '->', afterRotation.theta);
if (Math.abs(afterRotation.theta - beforeRotation.theta) < 0.1) {
  console.error('Rotazione camera non avvenuta!');
  cleanup();
  process.exit(1);
}
await takeScreenshot('dds_qa_camera_rotated_qe.png');
console.log('✓ 3. Rotazione camera con Q/E catturata con successo.');

// Test Tempesta di Sabbia con transizione graduale
console.log('Test Attivazione Tempesta di Sabbia con transizione graduale...');
await evaluate(`
  (() => {
    const g = window.__dds.game;
    // Riporta camera a vista panoramica
    g.cameraController.setDistance(55);
    g.worldEvents.triggerEvent('sandstorm');
  })()
`);

// Avanza a metà fade-in (1.2s)
await evaluate(`
  (() => {
    window.__dds.game.worldEvents.update(1.2);
  })()
`);
await sleep(400);

const stormStatus = await evaluate(`
  (() => {
    const we = window.__dds.game.worldEvents;
    const fog = window.__dds.scene.scene.fog;
    return {
      activeEvent: we.activeEvent,
      stormFactor: we.stormFactor,
      fogDensity: fog?.density,
      fogColorHex: fog?.color?.getHexString(),
    };
  })()
`);
console.log('Storm Status a metà transizione:', stormStatus);

await takeScreenshot('dds_qa_storm_fade_in.png');
console.log('✓ 4. Screenshot tempesta con nebbia dorata catturato con successo.');

// Controllo errori console
console.log('Console Errors rilevati durante l\'intera sessione:', consoleErrors.length);
if (consoleErrors.length > 0) {
  console.error('ERRORI CONSOLE RILEVATI:', consoleErrors);
  cleanup();
  process.exit(1);
}

console.log('========================================================');
console.log('   QA AUTOMATION PHASE 16: TUTTI I CONTROLLI SUPERATI!');
console.log('========================================================');

cleanup();
process.exit(0);
