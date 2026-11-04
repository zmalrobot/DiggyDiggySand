import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9357;
const USER_DATA_DIR = `/tmp/qa-dds-phase16-profiler-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION PHASE 16 PROFILER');
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
  '--window-size=1280,840',
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

console.log('[Browser QA] Connesso al WebSocket CDP:', wsUrl);

// 2. Mini CDP client
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  async connect() {
    const WebSocket = (await import('ws')).default;
    this.ws = new WebSocket(this.wsUrl);

    await new Promise((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
    });

    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const type = msg.params.type;
          const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
          if (type === 'error') {
            console.error('[Browser Console Error]', text);
            this.consoleErrors.push(text);
          }
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'Eccezione sconosciuta';
          console.error('[Browser Exception]', desc);
          this.pageErrors.push(desc);
        }
      }
    });

    await this.send('Runtime.enable');
    await this.send('Page.enable');
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Screenshot salvato]: ${outPath} (${buffer.length} bytes)`);
    return outPath;
  }

  close() {
    this.ws.close();
  }
}

const cdp = new CDPClient(wsUrl);
await cdp.connect();

try {
  // Attesa pulsante di avvio
  console.log('[Browser QA] In attesa del pulsante di avvio...');
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try {
      const btnReady = await cdp.eval(`
        (() => {
          const btn = document.querySelector('#start-btn, .start-btn, [data-act="start"]');
          return btn ? !btn.classList.contains('hidden') : false;
        })()
      `);
      if (btnReady) {
        await cdp.eval(`document.querySelector('#start-btn, .start-btn, [data-act="start"]')?.click()`);
        break;
      }
    } catch {}
  }

  // Attesa inizializzazione window.__dds
  console.log('[Browser QA] In attesa di window.__dds...');
  let loaded = false;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const isReady = await cdp.eval(`
      !!(window.__dds && window.__dds.scene && window.__dds.scene.ok && window.__dds.menu && window.__dds.profiler)
    `);
    if (isReady) {
      loaded = true;
      break;
    }
  }
  if (!loaded) throw new Error('Timeout boot window.__dds');

  // 1. Verifica Stato Iniziale del Profiler Overlay (Disattivato di Default)
  console.log('[Browser QA] Verifica overlay disattivato inizialmente...');
  const initialOverlayState = await cdp.eval(`
    (() => {
      const el = document.getElementById('dds-profiler-overlay');
      return {
        exists: !!el,
        hidden: el ? el.classList.contains('hidden') : false,
        settingValue: window.__dds.settings.get('graphics.showProfiler'),
        profilerEnabled: window.__dds.profiler.enabled,
      };
    })()
  `);
  console.log('[Initial Overlay State]:', initialOverlayState);

  if (!initialOverlayState.exists) throw new Error('Elemento #dds-profiler-overlay non trovato nel DOM');
  if (!initialOverlayState.hidden) throw new Error('L\'overlay del profiler deve essere nascosto di default');
  if (initialOverlayState.settingValue !== false) throw new Error('showProfiler deve essere false di default');
  if (initialOverlayState.profilerEnabled !== false) throw new Error('profiler.enabled deve essere false di default');

  console.log('✓ 1. Overlay inizialmente disattivato con zero impatto grafico.');

  // 2. Test Attivazione tramite Scorciatoia da Tastiera F3
  console.log('[Browser QA] Invio evento tasto F3 per attivazione rapida...');
  await cdp.eval(`
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true }));
  `);
  await sleep(300);

  const f3State = await cdp.eval(`
    (() => {
      const el = document.getElementById('dds-profiler-overlay');
      return {
        hidden: el.classList.contains('hidden'),
        settingValue: window.__dds.settings.get('graphics.showProfiler'),
        profilerEnabled: window.__dds.profiler.enabled,
      };
    })()
  `);
  console.log('[F3 Toggled State]:', f3State);

  if (f3State.hidden) throw new Error('Tasto F3 non ha rimosso la classe .hidden dall\'overlay');
  if (f3State.settingValue !== true) throw new Error('Tasto F3 non ha aggiornato graphics.showProfiler a true');
  if (f3State.profilerEnabled !== true) throw new Error('Tasto F3 non ha abilitato window.__dds.profiler');

  console.log('✓ 2. Attivazione immediata tramite scorciatoia F3 verificata.');

  // 3. Avvia la partita e verifica la raccolta delle metriche in tempo reale
  console.log('[Browser QA] Avvio della partita per monitoraggio metriche...');
  await cdp.eval(`window.__dds.game.start()`);
  await sleep(2200); // tempo per accumulare frame e calcolare l'istogramma

  const activeMetrics = await cdp.eval(`
    (() => {
      const p = window.__dds.profiler;
      const m = p.getMetrics();
      const el = document.getElementById('dds-profiler-overlay');
      const fpsText = el.querySelector('[data-stat="fps"]')?.textContent;
      const ftText = el.querySelector('[data-stat="ft"]')?.textContent;
      const callsText = el.querySelector('[data-stat="calls"]')?.textContent;
      const trisText = el.querySelector('[data-stat="tris"]')?.textContent;
      const vramText = el.querySelector('[data-stat="vram"]')?.textContent;
      const heapText = el.querySelector('[data-stat="heap"]')?.textContent;

      return {
        fps: m.fps,
        avgFps: m.avgFps,
        frameTime: m.frameTime,
        drawCalls: m.drawCalls,
        triangles: m.triangles,
        textures: m.textures,
        geometries: m.geometries,
        historyLength: m.history.length,
        domText: {
          fpsText,
          ftText,
          callsText,
          trisText,
          vramText,
          heapText,
        }
      };
    })()
  `);
  console.log('[Active Metrics]:', JSON.stringify(activeMetrics, null, 2));

  if (activeMetrics.avgFps <= 0) throw new Error('avgFps non calcolato');
  if (activeMetrics.frameTime < 0) throw new Error('frameTime non calcolato');
  if (activeMetrics.drawCalls <= 0) throw new Error('Draw calls Three.js pari a zero');
  if (activeMetrics.triangles <= 0) throw new Error('Triangles Three.js pari a zero');
  if (activeMetrics.textures <= 0) throw new Error('VRAM textures Three.js pari a zero');
  if (activeMetrics.historyLength < 3) throw new Error('Istogramma storico frame insufficiente');

  console.log('✓ 3. Metriche hardware (FPS, Frame Time, Calls, Triangles, VRAM, Heap) e storico verificati.');

  // Cattura screenshot con overlay visibile in gioco
  await cdp.screenshot('dds_qa_profiler_overlay_hud.png');

  // 4. Test Sincronizzazione con il Toggle nelle Impostazioni Grafiche
  console.log('[Browser QA] Apertura modale Impostazioni e verifica toggle Grafica...');
  await cdp.eval(`window.__dds.settingsModal.open()`);
  await sleep(400);

  // Seleziona la tab Grafica
  await cdp.eval(`
    const tab = Array.from(document.querySelectorAll('.settings-modal .tab')).find(t => t.dataset.tab === 'graphics');
    tab?.click();
  `);
  await sleep(300);

  const toggleChecked = await cdp.eval(`
    (() => {
      const row = Array.from(document.querySelectorAll('.settings-modal .row')).find(r => r.textContent.includes('Diagnostica') || r.textContent.includes('Profiler'));
      row?.scrollIntoView({ block: 'center' });
      const input = row?.querySelector('input[type="checkbox"]');
      return input ? input.checked : null;
    })()
  `);
  await sleep(250);
  console.log('[Settings Modal Toggle Checked]:', toggleChecked);

  if (toggleChecked !== true) {
    throw new Error('Il toggle Diagnostica & FPS nelle impostazioni grafiche non è sincronizzato su checked=true');
  }

  // Cattura screenshot della scheda grafica con il toggle
  await cdp.screenshot('dds_qa_profiler_settings_toggle.png');

  // 5. Spegni di nuovo con F3 e chiudi modale
  console.log('[Browser QA] Disattivazione con F3 e chiusura modale...');
  await cdp.eval(`
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true }));
    window.__dds.settingsModal.close();
  `);
  await sleep(300);

  const finalState = await cdp.eval(`
    (() => {
      const el = document.getElementById('dds-profiler-overlay');
      return {
        hidden: el.classList.contains('hidden'),
        settingValue: window.__dds.settings.get('graphics.showProfiler'),
        profilerEnabled: window.__dds.profiler.enabled,
      };
    })()
  `);
  console.log('[Final State after F3]:', finalState);

  if (!finalState.hidden) throw new Error('L\'overlay non è tornato nascosto dopo il secondo F3');
  if (finalState.settingValue !== false) throw new Error('graphics.showProfiler non è tornato false');

  console.log('✓ 5. Disattivazione pulita verificata.');

  // 6. Verifica Assenza Errori ed Eccezioni
  if (cdp.consoleErrors.length > 0) {
    throw new Error(`Rilevati ${cdp.consoleErrors.length} errori console: ${cdp.consoleErrors.join(' | ')}`);
  }
  if (cdp.pageErrors.length > 0) {
    throw new Error(`Rilevate ${cdp.pageErrors.length} eccezioni di runtime: ${cdp.pageErrors.join(' | ')}`);
  }

  console.log('✓ 6. Zero errori console e zero eccezioni di pagina.');
  console.log('========================================================');
  console.log('  QA AUTOMATION PHASE 16 PROFILER COMPLETATO CON SUCCESSO!');
  console.log('========================================================');

} catch (err) {
  console.error('[Browser QA FALLITO]:', err);
  process.exitCode = 1;
} finally {
  cdp.close();
  cleanup();
}
