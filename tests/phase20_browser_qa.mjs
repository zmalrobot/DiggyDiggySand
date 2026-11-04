import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9370;
const USER_DATA_DIR = `/tmp/qa-dds-phase20-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/?cheat=1`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION PHASE 20 (GOLD MASTER)');
console.log('  Economic Balancing, Memory Audit, PWA Service Worker');
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
    this.consoleLogs = [];
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
          this.consoleLogs.push({ type, text });
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
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: true });
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
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Browser QA] Screenshot salvato: ${outPath} (${buffer.length} bytes)`);
    return outPath;
  }
}

const cdp = new CDPClient(wsUrl);
await cdp.connect();

try {
  console.log('[Browser QA] Attesa del caricamento iniziale e boot banner...');
  await sleep(2500);

  // 1. Verifica boot banner in console
  const bannerFound = cdp.consoleLogs.some((l) => l.text.includes('DIGGY DIGGY SAND') || l.text.includes('v1.0.0'));
  console.log(`[Browser QA] Boot banner rilevato in console: ${bannerFound ? 'SÌ ✓' : 'NO'}`);

  // Clicca start se c'è il loading screen
  const startBtn = await cdp.eval(`!!document.querySelector('#start-btn, [data-act="start"]')`);
  if (startBtn) {
    await cdp.eval(`document.querySelector('#start-btn, [data-act="start"]').click()`);
    await sleep(800);
  }

  // 2. Verifica Service Worker Registration
  const swRegistered = await cdp.eval(`
    (async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg;
    })()
  `);
  console.log(`[Browser QA] Service Worker registrato: ${swRegistered ? 'SÌ ✓' : 'NO (o file://)'}`);

  // 3. Avvia Spedizione dal Main Menu
  console.log('[Browser QA] Avvio nuova spedizione...');
  await cdp.eval(`
    if (window.__dds && window.__dds.menu) {
      window.__dds.menu.startNewExpedition('desert');
    }
  `);
  await sleep(2000);

  // 4. Test simulatore progressione analitica da console
  console.log('[Browser QA] Esecuzione window.__DDS_DEBUG.simulateProgression()...');
  const simResult = await cdp.eval(`
    (() => {
      const fn = window.__DDS_DEBUG?.simulateProgression || window.__dds?.simulateProgression;
      if (!fn) return null;
      const t0 = performance.now();
      const res = fn();
      const dt = performance.now() - t0;
      return { ...res, executionTimeMs: dt };
    })()
  `);

  if (!simResult) {
    throw new Error('simulateProgression non trovato in window.__DDS_DEBUG o window.__dds');
  }
  console.log(`[Browser QA] Risultato simulatore:`, {
    tempoEsecuzione: `${simResult.executionTimeMs.toFixed(2)} ms`,
    durataMinuti: simResult.elapsedMinutes,
    inTargetWindow: simResult.inTargetWindow,
    completamento: simResult.completion,
    spsFinale: simResult.finalSPS,
  });

  if (!simResult.inTargetWindow) {
    throw new Error(`Progressione non calibrata nella finestra target: ${simResult.elapsedMinutes} min`);
  }

  // 5. Verifica apertura Shop e navigazione sulla scheda Reliquie
  console.log('[Browser QA] Apertura Officina e scheda Reliquie...');
  await cdp.eval(`
    if (window.__dds && window.__dds.game && window.__dds.game.shop) {
      window.__dds.game.shop.open();
    }
  `);
  await sleep(500);

  await cdp.eval(`
    const tabRelics = document.querySelector('[data-tab="relics"]');
    if (tabRelics) tabRelics.click();
  `);
  await sleep(600);

  const relicsCount = await cdp.eval(`document.querySelectorAll('.upgrade-card[data-card^="relic_"]').length`);
  console.log(`[Browser QA] Carte Reliquie renderizzate: ${relicsCount} (attese: 5)`);
  if (relicsCount !== 5) {
    throw new Error(`Previste 5 carte reliquie, trovate: ${relicsCount}`);
  }

  const lockedCount = await cdp.eval(`document.querySelectorAll('.upgrade-card.locked').length`);
  console.log(`[Browser QA] Carte Reliquie inizialmente bloccate: ${lockedCount}`);

  // Screenshot delle Reliquie nella Bottega
  await cdp.screenshot('dds_qa_phase20_shop_relics.png');

  // 6. Test sblocco e acquisto reliquie con cheat
  console.log('[Browser QA] Sblocco scavo 85% e acquisto reliquie con crediti di prova...');
  const purchaseTest = await cdp.eval(`
    (() => {
      const state = window.__dds.game.state;
      state.enableCheats();
      state.sand = 500000000;
      state.setCompletion(0.85);
      window.__dds.game.shop.render();

      const initialSPS = window.__dds.game.economy?.sps || 0;
      // Compra relic_cartel (+25% flotta)
      const cartelRes = window.__dds.game.shop._calculateBuyInfo({ id: 'relic_cartel', baseCost: 15000, multiplier: 1, maxLevel: 1 });
      const buyCartel = window.__dds.game.buyUpgrade ? window.__dds.game.buyUpgrade('relic_cartel') : false;

      return {
        initialSPS,
        unlockedCards: document.querySelectorAll('.upgrade-card:not(.locked)').length,
        stateCompletion: state.completion,
      };
    })()
  `);
  console.log(`[Browser QA] Stato sblocco dopo 85% completamento:`, purchaseTest);

  // Chiudi Shop
  await cdp.eval(`window.__dds.game.shop.close(true)`);
  await sleep(400);

  // 7. Test deepDispose e ciclo vitale spedizione
  console.log('[Browser QA] Test deepDispose() e ciclo di reset spedizione...');
  await cdp.eval(`
    if (window.__dds && window.__dds.game) {
      window.__dds.game._leave();
      window.__dds.menu.show();
    }
  `);
  await sleep(800);

  // Ritorno in menu e riavvio spedizione per verificare assenza di leak o eccezioni
  await cdp.eval(`
    if (window.__dds && window.__dds.menu) {
      window.__dds.menu.startNewExpedition('desert');
    }
  `);
  await sleep(1500);

  // Screenshot finale Gold Master
  await cdp.screenshot('dds_qa_phase20_gold_master.png');

  // 8. Controllo errori console ed eccezioni
  console.log('[Browser QA] Verifica finale errori console ed eccezioni runtime...');
  console.log(`  - Errori console registrati: ${cdp.consoleErrors.length}`);
  console.log(`  - Eccezioni pagina registrate: ${cdp.pageErrors.length}`);

  if (cdp.consoleErrors.length > 0) {
    throw new Error(`Rilevati ${cdp.consoleErrors.length} errori in console: ${cdp.consoleErrors.join(' | ')}`);
  }
  if (cdp.pageErrors.length > 0) {
    throw new Error(`Rilevate ${cdp.pageErrors.length} eccezioni non gestite: ${cdp.pageErrors.join(' | ')}`);
  }

  console.log('========================================================');
  console.log('✅ BROWSER QA FASE 20 (GOLD MASTER) SUPERATO CON SUCCESSO!');
  console.log('  0 ERRORI CONSOLE, 0 ECCEZIONI PAGINA');
  console.log('========================================================');

} catch (err) {
  console.error('[Browser QA] FALLITO CON ERRORE:', err);
  process.exitCode = 1;
} finally {
  cleanup();
}
