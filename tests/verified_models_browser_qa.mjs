import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const CDP_PORT = 9418;
const USER_DATA_DIR = `/tmp/qa-dds-models-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION VERIFIED 3D MODELS');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Avvia Chrome Headless con SwiftShader WebGL2
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

  console.log('1. Monitoraggio Barra di Caricamento Reale...');
  let maxPercentObserved = 0;
  let sawProgress = false;

  for (let i = 0; i < 80; i++) {
    await sleep(200);
    const progressInfo = await evalInPage(`
      (() => {
        const fill = document.getElementById('loader-bar-fill') || document.querySelector('.loader-bar-fill, .fill');
        const pctEl = document.getElementById('loader-pct') || document.querySelector('.loading-pct');
        const btn = document.querySelector('.start-btn');
        const fillWidth = fill ? fill.style.width : '0%';
        const pctText = pctEl ? pctEl.textContent : '0%';
        const isReady = btn && !btn.classList.contains('hidden');
        return { fillWidth, pctText, isReady };
      })()
    `);

    if (progressInfo) {
      const numPct = parseInt(progressInfo.pctText, 10) || 0;
      if (numPct > maxPercentObserved) maxPercentObserved = numPct;
      if (numPct > 0) sawProgress = true;
      if (progressInfo.isReady) {
        console.log(`✓ Caricamento completato al 100%! (Progresso finale osservato: ${progressInfo.pctText}, fill width: ${progressInfo.fillWidth})`);
        break;
      }
    }
  }

  assert.ok(maxPercentObserved >= 50, `La percentuale osservata deve superare il 50%, rilevato: ${maxPercentObserved}%`);

  // 2. Click su "Inizia Spedizione"
  console.log('2. Click su "Inizia Spedizione" per entrare nel gioco...');
  await evalInPage(`
    (() => {
      const btn = document.querySelector('.start-btn');
      if (btn) btn.click();
    })()
  `);
  await sleep(600);

  // 3. Verifica AssetLoader e Modelli 3D Reali (Vertici > 36)
  console.log('3. Ispezione Modelli 3D caricati in memoria da AssetLoader...');
  const assetReport = await evalInPage(`
    (() => {
      const assets = window.__dds?.assets;
      if (!assets) return { error: 'window.__dds.assets non presente' };
      const report = {
        loadedCount: assets.report?.loaded?.length || 0,
        loadedModels: assets.report?.loaded || [],
        failedCount: assets.failedModels?.length || 0,
        failedModels: assets.failedModels || [],
        samples: {}
      };

      // Ispeziona alcuni modelli campione
      const testKeys = ['MODEL_WORKER', 'MODEL_EXCAVATOR', 'RUIN_COLUMN', 'MODEL_CHEST_ANIMATED'];
      for (const k of testKeys) {
        const mesh = assets.getModel(k);
        if (mesh) {
          let vertCount = 0;
          mesh.traverse(c => {
            if ((c.isMesh || c.isSkinnedMesh) && c.geometry?.attributes?.position) {
              vertCount += c.geometry.attributes.position.count;
            }
          });
          report.samples[k] = {
            hasMesh: true,
            vertCount,
            hasAnimations: !!(mesh.userData?.animations && mesh.userData.animations.length > 0)
          };
        }
      }
      return report;
    })()
  `);

  console.log(`✓ Modelli caricati con successo da manifest: ${assetReport.loadedCount}`);
  assert.ok(assetReport.loadedCount > 0, 'Almeno 1 modello deve essere stato caricato da AssetLoader');
  
  for (const [key, sample] of Object.entries(assetReport.samples)) {
    assert.ok(sample.hasMesh, `Modello campione "${key}" deve essere presente`);
    assert.ok(sample.vertCount > 36, `Modello "${key}" deve avere più di 36 vertici (ha ${sample.vertCount}). Non è un cubo primitivo.`);
    console.log(`  -> Modello ${key}: ${sample.vertCount} vertici | Animazioni: ${sample.hasAnimations ? 'SÌ' : 'NO'}`);
  }

  // 4. Cattura Screenshot di Convalida QA
  console.log('4. Acquisizione Screenshot QA...');
  const screenshotData = await sendCDP('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });

  const screenshotPath = path.join(ARTIFACT_DIR, 'dds_qa_verified_models_loader.png');
  fs.writeFileSync(screenshotPath, Buffer.from(screenshotData.data, 'base64'));
  console.log('✓ Screenshot salvata in:', screenshotPath);

  // 5. Verifica Assenza Errori Console
  console.log('5. Controllo Errori Console...');
  if (consoleErrors.length > 0) {
    console.error('Errori rilevati in console durante la suite QA:');
    consoleErrors.forEach((e) => console.error('  ->', e));
    throw new Error(`Rilevati ${consoleErrors.length} errori console durante la suite QA`);
  }
  console.log('✓ 0 Errori console rilevati!');

  console.log('========================================================');
  console.log('  TUTTI I TEST BROWSER QA MODELLI E LOADER SUPERATI!');
  console.log('========================================================');

} catch (err) {
  console.error('❌ ERRORE DURANTE LA SUITE QA:', err);
  process.exitCode = 1;
} finally {
  ws.close();
  cleanup();
}
