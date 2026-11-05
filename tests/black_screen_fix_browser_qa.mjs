import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const CDP_PORT = 9422;
const USER_DATA_DIR = `/tmp/qa-dds-blackscreen-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION BLACK SCREEN FIX');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      const text = msg.params.args.map((a) => a.value || a.description).join(' ');
      if (!text.includes('favicon.ico')) {
        consoleErrors.push(text);
      }
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
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  }
  return res.result?.value;
}

try {
  await sendCDP('Runtime.enable');
  await sendCDP('Page.enable');

  console.log('1. Attesa e avvio schermata iniziale (LoadingScreen)...');
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try {
      const btnReady = await evalInPage(`
        (() => {
          const btn = document.querySelector('#start-btn, .start-btn, [data-act="start"]');
          return btn ? !btn.classList.contains('hidden') : false;
        })()
      `);
      if (btnReady) {
        await evalInPage(`document.querySelector('#start-btn, .start-btn, [data-act="start"]')?.click()`);
        break;
      }
    } catch {}
  }

  console.log('2. Attesa inizializzazione gioco e avvio Nuova Spedizione...');
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const ready = await evalInPage(`
      (() => {
        return !!(window.__dds && window.__dds.scene && window.__dds.scene.postProcessing && window.__dds.menu);
      })()
    `);
    if (ready) break;
  }

  // Avvia una spedizione dal menu principale se non già avviata
  await evalInPage(`
    (() => {
      if (window.__dds.menu?.startNewExpedition) {
        window.__dds.menu.startNewExpedition('desert');
      }
    })()
  `);
  await sleep(600);

  // 3. Test campionamento pixel per ciascuna modalità di illuminazione
  const techniquesToTest = ['gtao', 'ssr', 'ssgi', 'off'];

  for (const tech of techniquesToTest) {
    console.log(`3. Test Tecnica di Illuminazione: "${tech.toUpperCase()}"...`);

    const result = await evalInPage(`
      (() => {
        const game = window.__dds.game;
        const sceneMgr = window.__dds.scene;
        const pp = sceneMgr.postProcessing;

        // Imposta la tecnica
        pp.setLightingTechnique('${tech}');
        window.__dds.settings.set('graphics.lightingTechnique', '${tech}');

        // Forza un render tramite postProcessing
        pp.render(0.016);

        // Campiona i pixel centrali del canvas WebGL2
        const gl = sceneMgr.renderer.getContext();
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;

        // Legge un blocco 16x16 al centro del canvas
        const pixels = new Uint8Array(16 * 16 * 4);
        gl.readPixels(Math.floor(w / 2 - 8), Math.floor(h / 2 - 8), 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
        const count = 16 * 16;
        for (let i = 0; i < pixels.length; i += 4) {
          sumR += pixels[i];
          sumG += pixels[i + 1];
          sumB += pixels[i + 2];
          sumA += pixels[i + 3];
        }

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        const avgLuma = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

        return {
          tech: pp.getLightingTechnique(),
          avgR,
          avgG,
          avgB,
          avgLuma,
          isBlack: avgLuma < 2.0,
          drawCalls: sceneMgr.renderer.info?.render?.calls || 0,
          triangles: sceneMgr.renderer.info?.render?.triangles || 0
        };
      })()
    `);

    console.log(`  -> Esito [${tech}]: Luminanza media = ${result.avgLuma.toFixed(1)} (R: ${result.avgR.toFixed(0)}, G: ${result.avgG.toFixed(0)}, B: ${result.avgB.toFixed(0)}) | DrawCalls: ${result.drawCalls}`);
    assert.equal(result.isBlack, false, `ERRORE CRITICO: La modalità "${tech}" ha generato uno schermo completamente nero (luma: ${result.avgLuma})!`);

    // Cattura screenshot di verifica per ciascuna tecnica attiva
    const screenshotData = await sendCDP('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(ARTIFACT_DIR, `dds_qa_screen_${tech}.png`);
    fs.writeFileSync(shotPath, Buffer.from(screenshotData.data, 'base64'));
    console.log(`  ✓ Screenshot salvato: ${shotPath}`);
  }

  // 4. Verifica Assenza Errori Console
  console.log('4. Controllo errori console...');
  if (consoleErrors.length > 0) {
    console.error('Errori rilevati in console durante la suite QA:');
    consoleErrors.forEach((e) => console.error('  ->', e));
    throw new Error(`Rilevati ${consoleErrors.length} errori console durante la suite QA`);
  }
  console.log('✓ 0 Errori console rilevati!');

  console.log('========================================================');
  console.log('  TUTTI I TEST BROWSER QA BLACK SCREEN FIX SUPERATI!');
  console.log('========================================================');

} catch (err) {
  console.error('❌ ERRORE DURANTE LA SUITE QA:', err);
  process.exitCode = 1;
} finally {
  ws.close();
  cleanup();
}
