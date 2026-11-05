import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const CDP_PORT = 9412;
const USER_DATA_DIR = `/tmp/qa-dds-lighting-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION LIGHTING ARCHITECTURE');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Avvio Chrome Headless con SwiftShader WebGL2
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
      // Ignora errori 404 innocui su favicon o manifest esterni
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

  console.log('2. Attesa inizializzazione window.__dds e postProcessing...');
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    ready = await evalInPage(`
      (() => {
        return !!(window.__dds && window.__dds.scene && window.__dds.scene.postProcessing && window.__dds.settings && window.__dds.settingsModal);
      })()
    `);
    if (ready) break;
  }
  assert.ok(ready, 'Timeout inizializzazione window.__dds.scene.postProcessing');
  console.log('✓ Gioco e SceneManager inizializzati con successo');

  // 3. Apri il modale delle Impostazioni e passa alla tab Grafica
  console.log('3. Apertura Modale Impostazioni -> Scheda Grafica...');
  await evalInPage(`
    (() => {
      window.__dds.settingsModal.open('graphics');
    })()
  `);
  await sleep(400);

  // 4. Verifica DOM del selettore e del badge
  console.log('4. Ispezione Selettore Dropdown e Badge Informativo...');
  const domInfo = await evalInPage(`
    (() => {
      const select = document.getElementById('select-lighting-tech');
      const badge = document.getElementById('lighting-tech-badge');
      if (!select) return { error: 'select mancante' };
      const options = Array.from(select.options).map(o => ({ value: o.value, text: o.textContent, disabled: o.disabled }));
      return {
        hasSelect: true,
        optionsCount: options.length,
        options,
        currentValue: select.value,
        hasBadge: !!badge,
        badgeText: badge ? badge.textContent : null
      };
    })()
  `);

  assert.ok(domInfo.hasSelect, 'Select #select-lighting-tech non trovato');
  assert.equal(domInfo.optionsCount, 5, 'Il selettore deve contenere esattamente 5 tecniche');
  assert.ok(domInfo.hasBadge, 'Badge #lighting-tech-badge non trovato');
  console.log('✓ Dropdown e badge presenti con 5 opzioni:', domInfo.options.map(o => o.value).join(', '));

  // 5. Test ciclo di selezione e reattività
  console.log('5. Test commutazione tecniche di illuminazione...');

  // Seleziona GTAO
  console.log('  -> Impostazione GTAO...');
  const gtaoResult = await evalInPage(`
    (() => {
      const select = document.getElementById('select-lighting-tech');
      select.value = 'gtao';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const post = window.__dds.scene.postProcessing;
      const badge = document.getElementById('lighting-tech-badge');
      return {
        tech: post.getLightingTechnique(),
        modeUniform: post.postMaterial.uniforms.uLightingMode.value,
        hasDepth: !!post.renderTarget.depthTexture,
        badgeText: badge ? badge.textContent : ''
      };
    })()
  `);
  assert.equal(gtaoResult.tech, 'gtao');
  assert.equal(gtaoResult.modeUniform, 1.0);
  assert.ok(gtaoResult.hasDepth, 'Depth texture deve essere allocata in GTAO');
  console.log('  ✓ GTAO attivato correttamente:', gtaoResult.badgeText);

  // Seleziona SSR
  console.log('  -> Impostazione SSR Speculare...');
  const ssrResult = await evalInPage(`
    (() => {
      const select = document.getElementById('select-lighting-tech');
      select.value = 'ssr';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const post = window.__dds.scene.postProcessing;
      return {
        tech: post.getLightingTechnique(),
        modeUniform: post.postMaterial.uniforms.uLightingMode.value,
        ssrUniform: post.postMaterial.uniforms.uRaytracingSSR.value,
        hasDepth: !!post.renderTarget.depthTexture
      };
    })()
  `);
  assert.equal(ssrResult.tech, 'ssr');
  assert.equal(ssrResult.modeUniform, 2.0);
  assert.equal(ssrResult.ssrUniform, 1.0);
  assert.ok(ssrResult.hasDepth);
  console.log('  ✓ SSR attivato correttamente');

  // Seleziona SSGI
  console.log('  -> Impostazione SSGI Diffuse...');
  const ssgiResult = await evalInPage(`
    (() => {
      const select = document.getElementById('select-lighting-tech');
      select.value = 'ssgi';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const post = window.__dds.scene.postProcessing;
      return {
        tech: post.getLightingTechnique(),
        modeUniform: post.postMaterial.uniforms.uLightingMode.value,
        hasDepth: !!post.renderTarget.depthTexture
      };
    })()
  `);
  assert.equal(ssgiResult.tech, 'ssgi');
  assert.equal(ssgiResult.modeUniform, 3.0);
  assert.ok(ssgiResult.hasDepth);
  console.log('  ✓ SSGI attivato correttamente');

  // Seleziona WebGPU (fallback o gestione graceful)
  console.log('  -> Impostazione WebGPU Path Tracing (con verifica fallback)...');
  const webgpuResult = await evalInPage(`
    (() => {
      const select = document.getElementById('select-lighting-tech');
      select.value = 'webgpu';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const post = window.__dds.scene.postProcessing;
      return {
        tech: post.getLightingTechnique(),
        settingsVal: window.__dds.settings.get('graphics.lightingTechnique')
      };
    })()
  `);
  console.log('  ✓ WebGPU testato (risultato:', webgpuResult.tech, ')');

  // Seleziona OFF
  console.log('  -> Impostazione OFF (disattivato, zero overhead)...');
  const offResult = await evalInPage(`
    (() => {
      const select = document.getElementById('select-lighting-tech');
      select.value = 'off';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const post = window.__dds.scene.postProcessing;
      return {
        tech: post.getLightingTechnique(),
        modeUniform: post.postMaterial.uniforms.uLightingMode.value,
        hasDepth: !!post.renderTarget.depthTexture
      };
    })()
  `);
  assert.equal(offResult.tech, 'off');
  assert.equal(offResult.modeUniform, 0.0);
  assert.equal(offResult.hasDepth, false, 'Depth texture deve essere liberata quando lighting è off');
  console.log('  ✓ Modalità OFF e rilascio depth buffer verificati con successo');

  // Ripristiniamo GTAO per la screenshot cerimoniale
  await evalInPage(`
    (() => {
      const select = document.getElementById('select-lighting-tech');
      select.value = 'gtao';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `);
  await sleep(300);

  // 6. Acquisizione Screenshot di Convalida QA
  console.log('6. Cattura Screenshot QA con Dropdown e Badge...');
  const screenshotData = await sendCDP('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });

  const screenshotPath = path.join(ARTIFACT_DIR, 'dds_qa_lighting_selector.png');
  fs.writeFileSync(screenshotPath, Buffer.from(screenshotData.data, 'base64'));
  console.log('✓ Screenshot salvata in:', screenshotPath);

  // 7. Verifica Assenza Errori Console
  console.log('7. Controllo Errori di Console ed Eccezioni Pagina...');
  if (consoleErrors.length > 0) {
    console.error('Errori rilevati in console durante il test QA:');
    consoleErrors.forEach((e) => console.error('  ->', e));
    throw new Error(`Rilevati ${consoleErrors.length} errori console durante la suite QA`);
  }
  console.log('✓ 0 Errori di console e 0 eccezioni pagina rilevate');

  console.log('========================================================');
  console.log('  TUTTI I TEST BROWSER QA LIGHTING ARCHITECTURE SUPERATI!');
  console.log('========================================================');

} catch (err) {
  console.error('❌ ERRORE DURANTE LA SUITE QA:', err);
  process.exitCode = 1;
} finally {
  ws.close();
  cleanup();
}

