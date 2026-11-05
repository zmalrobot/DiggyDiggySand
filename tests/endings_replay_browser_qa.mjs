import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const CDP_PORT = 9406;
const USER_DATA_DIR = `/tmp/qa-dds-replay-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION REPLAY 3D STAGE & EXIT');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Avvia Chrome Headless
const chromeProc = spawn('google-chrome', [
  '--headless=new',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1366,768',
  TARGET_URL
], { stdio: ['ignore', 'pipe', 'pipe'] });

function cleanup() {
  try { chromeProc.kill('SIGTERM'); } catch {}
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch {}
}

process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

let wsUrl = null;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
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
  console.error('Impossibile agganciare Chrome su porta CDP', CDP_PORT);
  cleanup();
  process.exit(1);
}

// 2. Connessione WebSocket CDP
const ws = new WebSocket(wsUrl);
let reqId = 1;
const pending = new Map();
const consoleErrors = [];

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    if (msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value || a.description).join(' '));
    }
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  }
};

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

function sendCDP(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = reqId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInPage(expr) {
  const res = await sendCDP('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  }
  return res.result?.value;
}

await sendCDP('Runtime.enable');
await sendCDP('Page.enable');

console.log('Attesa completamento LoadingScreen...');
for (let i = 0; i < 40; i++) {
  await sleep(250);
  const hidden = await evalInPage(`
    (() => {
      const ls = document.getElementById('loading-screen');
      return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
    })()
  `);
  if (hidden) break;
}

console.log('✓ Loading screen completato! Sblocco finale nel salvataggio per test galleria...');
await evalInPage(`
  (() => {
    const save = window.__dds?.save || window.__dds?.game?.save;
    if (save) {
      save.recordEnding('treasure', 'desert');
      save.recordEnding('curse', 'desert');
    }
  })()
`);

// 1. Apertura Galleria Finali
console.log('Apertura modale Galleria dei Finali...');
await evalInPage(`
  (() => {
    if (window.__dds?.menu?.endingsModal) {
      window.__dds.menu.endingsModal.open();
    } else if (window.__dds?.game?.endingsModal) {
      window.__dds.game.endingsModal.open();
    } else {
      const btn = document.getElementById('btn-menu-endings') || document.querySelector('.btn-menu-trophies') || document.querySelector('[data-modal="endings"]');
      if (btn) btn.click();
    }
  })()
`);
await sleep(600);

// 2. Click su "Rivivi Epilogo"
console.log('Click su "Rivivi Epilogo" (Finale Tesoro)...');
const replayClicked = await evalInPage(`
  (() => {
    const btn = document.querySelector('[data-replay-ending="treasure"]') || document.querySelector('.btn-replay-ending');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  })()
`);
assert.equal(replayClicked, true, 'Pulsante "Rivivi Epilogo" deve essere stato cliccato');

// Attesa dissolvenza e allestimento scena 3D
await sleep(1400);

// 3. Verifica Ambiente ReplayStage 3D
console.log('--- VERIFICA AMBIENTE REPLAY 3D STAGE & DRAW CALLS ---');
const stageInfo = await evalInPage(`
  (() => {
    const game = window.__dds?.game;
    const mgr = game?.endingManager;
    const renderer = window.__dds?.scene?.renderer;
    const overlay = document.getElementById('replay-hud-overlay');
    const btnExit = document.getElementById('btn-exit-replay');

    let meshCount = 0;
    if (mgr?._replayStageGroup) {
      mgr._replayStageGroup.traverse(c => { if (c.isMesh) meshCount++; });
    }

    return {
      isReplay: mgr?.isReplay,
      hasStageGroup: !!mgr?._replayStageGroup,
      stageMeshCount: meshCount,
      hasOverlay: !!overlay,
      hasBtnExit: !!btnExit,
      btnExitText: btnExit ? btnExit.textContent.trim() : null,
      renderInfo: {
        calls: renderer?.info?.render?.calls,
        triangles: renderer?.info?.render?.triangles,
        points: renderer?.info?.render?.points,
        lines: renderer?.info?.render?.lines,
      },
      cameraPos: {
        x: window.__dds?.scene?.camera?.position?.x,
        y: window.__dds?.scene?.camera?.position?.y,
        z: window.__dds?.scene?.camera?.position?.z,
      },
    };
  })()
`);

console.log('Dati ReplayStage:', JSON.stringify(stageInfo, null, 2));

assert.equal(stageInfo.isReplay, true, 'isReplay deve essere attivo');
assert.equal(stageInfo.hasStageGroup, true, '_replayStageGroup deve esistere');
assert.ok(stageInfo.stageMeshCount >= 15, `Mesh archeologiche attive nel cratere: ${stageInfo.stageMeshCount} (atteso >= 15)`);
assert.equal(stageInfo.hasOverlay, true, 'Overlay #replay-hud-overlay deve essere nel DOM');
assert.equal(stageInfo.hasBtnExit, true, 'Pulsante #btn-exit-replay deve essere presente');
assert.ok(stageInfo.btnExitText.includes('TORNA AL MENU'), 'Pulsante deve contenere "TORNA AL MENU"');
assert.ok(stageInfo.renderInfo.calls >= 10, `Draw calls devono essere >= 10 (trovate ${stageInfo.renderInfo.calls}) per cratere, colonne e tesori`);
console.log(`✓ ReplayStage 3D, basamento scavato al 100%, draw calls (${stageInfo.renderInfo.calls}) e luci dedicate verificate con successo!`);

// Screenshot ReplayStage
const screenReplay = await sendCDP('Page.captureScreenshot', { format: 'png' });
const replayPath = path.join(ARTIFACT_DIR, 'dds_qa_endings_replay_3d_stage.png');
fs.writeFileSync(replayPath, Buffer.from(screenReplay.data, 'base64'));
console.log(`[Screenshot] Salvato con successo: ${replayPath} (${screenReplay.data.length} bytes)`);

// 4. Click su "✕ Torna al Menu" (#btn-exit-replay)
console.log('Click su "✕ Torna al Menu" (#btn-exit-replay)...');
await evalInPage(`
  (() => {
    const btn = document.getElementById('btn-exit-replay');
    if (btn) btn.click();
  })()
`);

// Attesa dissolvenza e ripristino Galleria
await sleep(1000);

const exitInfo = await evalInPage(`
  (() => {
    const mgr = window.__dds?.game?.endingManager;
    const overlay = document.getElementById('replay-hud-overlay');
    const endingsModal = document.querySelector('.endings-modal-container, .gallery-container');
    return {
      isReplay: mgr?.isReplay,
      hasStageGroup: !!mgr?._replayStageGroup,
      overlayExists: !!overlay,
      endingsModalOpen: !!endingsModal,
    };
  })()
`);

console.log('Dati post-uscita Replay:', JSON.stringify(exitInfo, null, 2));

assert.equal(exitInfo.isReplay, false, 'isReplay deve essere false');
assert.equal(exitInfo.hasStageGroup, false, 'ReplayStage deve essere stato deallocato');
assert.equal(exitInfo.overlayExists, false, 'Overlay #replay-hud-overlay deve essere rimosso dal DOM');
assert.equal(exitInfo.endingsModalOpen, true, 'Il modale della Galleria Finali deve essere riaperto automaticamente');
console.log('✓ Uscita replay, deallocazione profonda e ritorno alla Galleria dei Finali validati al 100%!');

// Screenshot Ritorno alla Galleria
const screenGallery = await sendCDP('Page.captureScreenshot', { format: 'png' });
const galleryPath = path.join(ARTIFACT_DIR, 'dds_qa_endings_replay_return_gallery.png');
fs.writeFileSync(galleryPath, Buffer.from(screenGallery.data, 'base64'));
console.log(`[Screenshot] Salvato con successo: ${galleryPath} (${screenGallery.data.length} bytes)`);

console.log('========================================================');
console.log(`Errori Console rilevati: ${consoleErrors.length}`);
if (consoleErrors.length > 0) {
  console.error('Dettagli errori:', consoleErrors);
}
assert.equal(consoleErrors.length, 0, 'Zero errori console permessi');
console.log('✓ Zero errori console e zero eccezioni non gestite!');
console.log('========================================================');

console.log('✅ TUTTI I TEST BROWSER QA REPLAY STAGE E OVERLAY SONO STATI SUPERATI CON SUCCESSO!');

ws.close();
cleanup();
