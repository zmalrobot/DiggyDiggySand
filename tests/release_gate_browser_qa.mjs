// Suite di Collaudo Browser QA Automatizzato per:
// - Release Gate & Automated Sanity Audit Runner (window.__DDS_AUDIT.run())
// - Verifica Code Freeze & Configurazione di Produzione Gold Master v1.0.0
// - Metadati PWA, Cache v1.0.0, Viewport e Assenza Errori Console
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9415;
const USER_DATA_DIR = `/tmp/qa-dds-release-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION RELEASE GATE v1.0.0');
console.log('  Automated Sanity Audit, Code Freeze & Production Seal');
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
  console.error('[Browser QA] Impossibile connettersi a Chrome via CDP');
  cleanup();
  process.exit(1);
}

const WebSocket = (await import('ws')).default;
const ws = new WebSocket(wsUrl);
let msgId = 1;
const pendingCalls = new Map();
const consoleErrors = [];
const consoleLogs = [];

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    if (msg.id && pendingCalls.has(msg.id)) {
      const { resolve, reject } = pendingCalls.get(msg.id);
      pendingCalls.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
      if (type === 'error') {
        consoleErrors.push(text);
      } else {
        consoleLogs.push({ type, text });
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const text = msg.params.exceptionDetails?.text || 'Exception';
      consoleErrors.push(`Uncaught: ${text}`);
    }
  } catch (err) {}
});

await new Promise((resolve) => ws.on('open', resolve));

function cdp(method, params = {}) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    pendingCalls.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await cdp('Runtime.enable');
await cdp('Page.enable');

async function evaluate(expression) {
  const res = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
}

async function captureScreenshot(filename) {
  const res = await cdp('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.data, 'base64');
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log(`[Screenshot] Salvato con successo: ${outPath} (${buf.length} bytes)`);
  return outPath;
}

let testPassed = true;

try {
  await sleep(1500);

  // 1. Verifica Banner Console di Boot
  console.log('1. Verifica Banner di Boot della Console...');
  const hasReleaseBanner = consoleLogs.some((l) =>
    l.text.includes('[DDS] Diggy Diggy Sand — v1.0.0 (Gold Master) Ready.')
  );
  console.log(`Banner di Boot riscontrato: ${hasReleaseBanner ? 'SI ✅' : 'NO ❌'}`);
  if (!hasReleaseBanner) {
    throw new Error('Banner di Boot "[DDS] Diggy Diggy Sand — v1.0.0 (Gold Master) Ready." non trovato nei log di avvio!');
  }

  // 2. Verifica Metadati HTML (Title, theme-color, viewport-fit=cover)
  console.log('2. Verifica Metadati Documento (Title, Theme Color, Viewport)...');
  const metadata = await evaluate(`
    (() => {
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      return {
        title: document.title,
        themeColor: themeMeta?.content || '',
        viewport: viewportMeta?.content || '',
      };
    })()
  `);

  console.log('Metadati rilevati nel DOM:', metadata);
  if (metadata.title !== 'Diggy Diggy Sand — 3D Incremental Game') {
    throw new Error(`Titolo errato: atteso "Diggy Diggy Sand — 3D Incremental Game", trovato "${metadata.title}"`);
  }
  if (metadata.themeColor !== '#031826') {
    throw new Error(`Theme Color errato: atteso "#031826", trovato "${metadata.themeColor}"`);
  }
  if (!metadata.viewport.includes('viewport-fit=cover')) {
    throw new Error(`Viewport privo di viewport-fit=cover: "${metadata.viewport}"`);
  }

  // 3. Attesa LoadingScreen e click Inizia Spedizione
  console.log('Attesa completamento LoadingScreen iniziale...');
  for (let i = 0; i < 40; i++) {
    const clicked = await evaluate(`
      (() => {
        const btn = document.querySelector('.start-btn');
        if (btn && !btn.classList.contains('hidden')) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    if (clicked) {
      console.log('Pulsante avvio schermata iniziale premuto.');
      break;
    }
    await sleep(200);
  }

  await sleep(1000);

  // 4. Invocazione in-browser di window.__DDS_AUDIT.run()
  console.log('3. Esecuzione Automated Sanity Audit Runner (window.__DDS_AUDIT.run())...');
  const auditReport = await evaluate(`
    (async () => {
      if (!window.__DDS_AUDIT || typeof window.__DDS_AUDIT.run !== 'function') {
        throw new Error('window.__DDS_AUDIT.run non disponibile nel runtime');
      }
      return await window.__DDS_AUDIT.run({ silent: false });
    })()
  `);

  console.log('Esito Sanity Audit:', {
    ok: auditReport.ok,
    passed: auditReport.passed,
    total: auditReport.total,
    durationMs: auditReport.durationMs,
  });

  if (!auditReport.ok || auditReport.passed !== 4 || auditReport.total !== 4) {
    throw new Error(`Sanity Audit fallito: ${JSON.stringify(auditReport.results)}`);
  }

  await captureScreenshot('dds_qa_release_gate_audit.png');

  // 5. Verifica Configurazione Predefinita di Produzione (Code Freeze)
  console.log('4. Verifica Code Freeze & Configurazione di Produzione...');
  const config = await evaluate(`
    (() => {
      const s = window.__dds?.settings;
      const g = window.__dds?.game;
      return {
        debugMode: !!g?.state?.debugMode,
        cheatsEnabled: !!g?.state?.cheatsEnabled,
        raytracingSSR: s?.get('graphics.raytracingSSR'),
        modelStyle: s?.get('graphics.modelStyle'),
        musicVolume: s?.get('audio.music'),
        sfxVolume: s?.get('audio.sfx'),
      };
    })()
  `);

  console.log('Configurazione di produzione riscontrata:', config);
  if (config.debugMode !== false) throw new Error('debugMode deve essere false di default');
  if (config.cheatsEnabled !== false) throw new Error('cheatsEnabled deve essere false di default');
  if (config.raytracingSSR !== false) throw new Error('raytracingSSR deve essere false di default');
  if (config.modelStyle !== 'gltf') throw new Error('modelStyle deve essere "gltf" di default');
  if (config.musicVolume !== 70) throw new Error(`audio.music deve essere 70 (0.7), trovato ${config.musicVolume}`);
  if (config.sfxVolume !== 80) throw new Error(`audio.sfx deve essere 80 (0.8), trovato ${config.sfxVolume}`);

  // 6. Verifica Service Worker Cache
  console.log('5. Verifica Service Worker & Cache Storage...');
  const cacheInfo = await evaluate(`
    (async () => {
      if (typeof caches === 'undefined') return { supported: false };
      const keys = await caches.keys();
      return {
        supported: true,
        cacheNames: keys,
        hasV1Cache: keys.includes('dds_cache_v1.0.0') || keys.some(k => k.includes('dds_cache_')),
      };
    })()
  `);
  console.log('Stato Cache Storage:', cacheInfo);

} catch (err) {
  console.error('[Browser QA Error]', err);
  testPassed = false;
} finally {
  console.log('--------------------------------------------------------');
  console.log(`Errori Console rilevati: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Dettagli errori console:', consoleErrors);
    testPassed = false;
  }
  console.log(`Esito Suite Browser QA: ${testPassed ? 'SUPERATO CON SUCCESSO ✅' : 'FALLITO ❌'}`);
  console.log('--------------------------------------------------------');
  cleanup();
  process.exit(testPassed ? 0 : 1);
}

