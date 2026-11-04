import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9360;
const USER_DATA_DIR = `/tmp/qa-dds-phase18-qol-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION PHASE 18 QOL & JUICE');
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
  // Attesa pulsante di avvio schermata iniziale
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
      !!(window.__dds && window.__dds.scene && window.__dds.game && window.__dds.game.shop)
    `);
    if (isReady) {
      loaded = true;
      break;
    }
  }
  if (!loaded) throw new Error('Timeout boot window.__dds');

  // 1. Avvia la partita ed accredita sabbia per testare il negozio
  console.log('[Browser QA] Avvio partita ed accredito sabbia...');
  await cdp.eval(`
    (() => {
      window.__dds.game.start();
      window.__dds.game.state.addSand(50000);
    })()
  `);
  await sleep(1200);

  // 2. Apri Officina e verifica Selettore Multi-Buy
  console.log('[Browser QA] Apertura Officina e test pulsantiera Multi-Buy...');
  await cdp.eval(`window.__dds.game.shop.open()`);
  await sleep(600);

  const shopMultiBuyCheck = await cdp.eval(`
    (() => {
      const bar = document.querySelector('.shop-multibuy-bar');
      const btns = Array.from(document.querySelectorAll('[data-multibuy]')).map(b => b.dataset.multibuy);
      const activeBtn = document.querySelector('[data-multibuy].active')?.dataset.multibuy;
      return {
        barExists: !!bar,
        buttons: btns,
        active: activeBtn,
      };
    })()
  `);
  console.log('[Shop Multi-Buy Check]:', shopMultiBuyCheck);

  if (!shopMultiBuyCheck.barExists) throw new Error('Barra .shop-multibuy-bar non presente nel negozio');
  if (!shopMultiBuyCheck.buttons.includes('1') || !shopMultiBuyCheck.buttons.includes('10') || !shopMultiBuyCheck.buttons.includes('MAX')) {
    throw new Error('Pulsanti 1x, 10x, 100x o MAX mancanti');
  }

  // Clicca sul pulsante 10x
  console.log('[Browser QA] Selezione modalità 10x nel negozio...');
  await cdp.eval(`
    (() => {
      const btn10 = document.querySelector('[data-multibuy="10"]');
      btn10?.click();
    })()
  `);
  await sleep(400);

  // Cattura screenshot Negozio con Multi-Buy 10x attivo
  await cdp.screenshot('dds_qa_qol_multibuy_shop.png');
  console.log('✓ 1. Selettore Multi-Buy verificato e screenshot salvato.');

  // Chiudi negozio
  await cdp.eval(`window.__dds.game.shop.close(true)`);
  await sleep(400);

  // 3. Test Floating Text (Colpi normali e critici)
  console.log('[Browser QA] Test generazione Numeri Fluttuanti (Floating Text)...');
  const ftCheck = await cdp.eval(`
    (() => {
      const container = document.getElementById('floating-text-container');
      const ft = window.__dds.game.floatingText;

      // Genera colpo normale e colpo critico
      ft.spawn2D({ screenX: 640, screenY: 420, text: '+25', isCrit: false });
      ft.spawn2D({ screenX: 720, screenY: 380, text: '+250 CRIT!', isCrit: true });

      const activeTexts = Array.from(container.querySelectorAll('.floating-text'))
        .filter(el => el.style.display !== 'none')
        .map(el => ({ text: el.textContent, className: el.className }));

      return {
        hasContainer: !!container,
        activeTexts,
      };
    })()
  `);
  console.log('[Floating Text Check]:', ftCheck);

  if (!ftCheck.hasContainer) throw new Error('#floating-text-container non trovato nel DOM');
  if (ftCheck.activeTexts.length < 2) throw new Error('I testi fluttuanti non sono stati renderizzati nel container');

  // Cattura screenshot con i floating text visibili a schermo
  await cdp.screenshot('dds_qa_qol_floating_text.png');
  console.log('✓ 2. Floating Text normale e critico verificati e screenshot catturato.');

  // 4. Test Camera Shake & Haptics
  console.log('[Browser QA] Test Camera Shake con modello a Trauma...');
  const shakeCheck = await cdp.eval(`
    (() => {
      const cam = window.__dds.game.cameraController;
      cam.addTrauma(0.5);
      return {
        trauma: cam.trauma,
        hapticsEnabled: window.__dds.game.haptics.enabled,
      };
    })()
  `);
  console.log('[Camera Shake & Haptics Check]:', shakeCheck);
  if (shakeCheck.trauma < 0.5) throw new Error('Trauma non registrato correttamente sul CameraController');
  if (shakeCheck.hapticsEnabled !== true) throw new Error('Haptics non abilitato di default');
  console.log('✓ 3. Modello a Trauma e Haptics verificati.');

  // 5. Test Export / Import Salvataggio nel Modal Impostazioni
  console.log('[Browser QA] Apertura Impostazioni Dati per Export Salvataggio...');
  await cdp.eval(`
    (() => {
      window.__dds.game?.saveNow?.();
      const sm = window.__dds.settingsModal || window.__dds.game?.settingsModal || window.__dds.menu?.settingsModal;
      sm?.open?.('data');
    })()
  `);
  await sleep(600);

  // Clicca su "Esporta Salvataggio"
  await cdp.eval(`
    (() => {
      const exportBtn = document.querySelector('[data-act="export-save"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Esporta Salvataggio'));
      exportBtn?.click();
    })()
  `);
  await sleep(600);

  const saveExportCheck = await cdp.eval(`
    (() => {
      const saveArea = document.querySelector('[data-save-area]') || Array.from(document.querySelectorAll('textarea.json-area')).find(a => a.value.startsWith('DDS1_'));
      return {
        found: !!saveArea,
        value: saveArea ? saveArea.value : null,
      };
    })()
  `);
  console.log('[Save Export Check]:', { found: saveExportCheck.found, length: saveExportCheck.value?.length });

  if (!saveExportCheck.found || !saveExportCheck.value?.startsWith('DDS1_')) {
    throw new Error('Esportazione salvataggio Base64 fallita: stringa DDS1_ non trovata');
  }

  // Cattura screenshot Impostazioni con codice di salvataggio Base64 esportato
  await cdp.screenshot('dds_qa_qol_save_export_import.png');
  console.log('✓ 4. Salvataggio esportato in Base64 (DDS1_...) con successo e screenshot salvato.');

  // Chiudi impostazioni
  await cdp.eval(`
    (() => {
      const sm = window.__dds.settingsModal || window.__dds.game?.settingsModal || window.__dds.menu?.settingsModal;
      sm?.close?.();
    })()
  `);
  await sleep(400);

  // 6. Verifica integrità console e assenza errori
  console.log('[Browser QA] Verifica assenza errori console ed eccezioni...');
  if (cdp.consoleErrors.length > 0) {
    throw new Error(`Rilevati ${cdp.consoleErrors.length} errori console: ${JSON.stringify(cdp.consoleErrors)}`);
  }
  if (cdp.pageErrors.length > 0) {
    throw new Error(`Rilevate ${cdp.pageErrors.length} eccezioni runtime: ${JSON.stringify(cdp.pageErrors)}`);
  }
  console.log('✓ 5. 0 Errori console e 0 eccezioni browser confermati!');

  console.log('========================================================');
  console.log('  TEST BROWSER QA FASE 18 SUPERATO CON SUCCESSO AL 100%!');
  console.log('========================================================');

} catch (err) {
  console.error('[Browser QA Errore Critico]', err);
  process.exitCode = 1;
} finally {
  cdp.close();
  cleanup();
}
