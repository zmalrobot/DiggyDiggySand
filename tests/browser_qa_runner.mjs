import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9335;
const USER_DATA_DIR = `/tmp/qa-dds-profile-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/?debug=1`;

console.log('--- AVVIO BROWSER QA DIGGY DIGGY SAND ---');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Avvio headless Chrome
const chromeProc = spawn('google-chrome', [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1280,800',
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

// 2. Attesa disponibilità porta CDP
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
  console.error('ERRORE: Impossibile connettersi a Chrome DevTools su porta', PORT);
  console.error(chromeOutput);
  cleanup();
  process.exit(1);
}

console.log('Connesso a Chrome CDP su:', wsUrl);

// 3. Client WebSocket CDP
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 1;
const pending = new Map();
const consoleLogs = [];
const consoleErrors = [];
const pageErrors = [];

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(data.error);
    else resolve(data.result);
  }

  // Cattura console log ed eventi
  if (data.method === 'Runtime.consoleAPICalled') {
    const type = data.params.type;
    const args = data.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
    consoleLogs.push({ type, text: args });
    if (type === 'error') {
      consoleErrors.push(args);
    }
  } else if (data.method === 'Runtime.exceptionThrown') {
    const text = data.params.exceptionDetails?.text || 'Eccezione sconosciuta';
    const desc = data.params.exceptionDetails?.exception?.description || '';
    pageErrors.push(`${text}: ${desc}`);
  }
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
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

// 4. Abilita domini CDP
await send('Page.enable');
await send('Runtime.enable');
await send('Console.enable');

console.log('Domini CDP abilitati, ricarico pagina per monitorare console dall\'avvio...');
await send('Page.navigate', { url: TARGET_URL });


// 5. Attesa caricamento pagina e AssetLoader
console.log('Attesa completamento caricamento asset...');
let loadedReport = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try {
    const report = await evaluate(`window.__dds?.assets?.report || null`);
    if (report && (report.loaded.length > 0 || report.fallback.length > 0)) {
      loadedReport = report;
      break;
    }
  } catch {}
}

console.log('\n========================================');
console.log('REPORT ASSETLOADER (loaded vs fallback):');
console.log('========================================');
console.log('Loaded:', loadedReport?.loaded);
console.log('Fallback:', loadedReport?.fallback);

// Verifica pulsante "Inizia Spedizione"
const startBtnVisible = await evaluate(`
  (() => {
    const btn = document.querySelector('.start-btn');
    return btn ? !btn.classList.contains('hidden') : false;
  })()
`);
console.log('Pulsante "Inizia Spedizione" visibile:', startBtnVisible);

// 6. Click sul pulsante "Inizia Spedizione"
console.log('\n--- CLICK SUL PULSANTE "INIZIA SPEDIZIONE" ---');
const unlockResult = await evaluate(`
  (async () => {
    const btn = document.querySelector('.start-btn');
    if (btn) {
      btn.click();
      return { clicked: true };
    }
    return { clicked: false };
  })()
`);
console.log('Esito click pulsante Inizia Spedizione:', unlockResult);
await sleep(1000);

// Verifica stato audio dopo click
const audioState = await evaluate(`
  (() => {
    const audio = window.__dds?.audio;
    return {
      ready: audio?.ready,
      ctxState: audio?.ctx?.state,
      buffersCount: audio?.buffers?.size,
      bufferKeys: audio?.buffers ? Array.from(audio.buffers.keys()) : [],
    };
  })()
`);
console.log('Stato Audio dopo sblocco:', audioState);

// 7. Click su "Nuova Spedizione" nel MainMenu per avviare la partita
console.log('\n--- AVVIO PARTITA DA MAIN MENU ("Nuova Spedizione") ---');
const startNewGame = await evaluate(`
  (() => {
    const newBtn = document.querySelector('[data-act="new"]');
    if (newBtn) {
      newBtn.click();
      return { ok: true };
    }
    // Oppure se è già in corso o continua
    const contBtn = document.querySelector('[data-act="continue"]');
    if (contBtn) {
      contBtn.click();
      return { ok: true, continued: true };
    }
    return { ok: false };
  })()
`);
console.log('Esito avvio partita da menu:', startNewGame);
await sleep(1500);

// Verifica che il gioco sia attivo e HUD visibile
const gameStatus = await evaluate(`
  (() => {
    const game = window.__dds?.game;
    return {
      hasGame: !!game,
      hasScene: !!window.__dds?.scene,
      sand: game?.state?.sand,
      active: !!game?.terrain,
      hasWorkers: !!game?.workers,
      workersCount: game?.workers?.workers?.length || 0,
    };
  })()
`);
console.log('Stato gioco dopo avvio:', gameStatus);

// 8. Test di scavo e playDigSound
console.log('\n--- TEST DI SCAVO E PLAY DIG SOUND ---');
const digTestResult = await evaluate(`
  (() => {
    const audio = window.__dds?.audio;
    const game = window.__dds?.game;
    const sandBefore = game?.state?.sand || 0;

    // Test chiamata playDigSound diretta
    let soundPlayed = false;
    try {
      audio?.playDigSound?.(1.0);
      soundPlayed = true;
    } catch (e) {
      soundPlayed = e.message;
    }

    // Test scavo tramite metodo digging.dig(p)
    let digResult = null;
    if (game?.digging && game?.terrain) {
      const y = game.terrain.getHeightAt(0, 0);
      const amount = game.digging.dig({ x: 0, y, z: 0 });
      digResult = { amount, y };
    }

    // Test scavo anche tramite simulazione pointerdown su canvas
    const canvas = document.getElementById('game');
    let pointerFired = false;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const evtDown = new PointerEvent('pointerdown', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
        isPrimary: true,
        pointerId: 1
      });
      canvas.dispatchEvent(evtDown);
      pointerFired = true;
      const evtUp = new PointerEvent('pointerup', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
        isPrimary: true,
        pointerId: 1
      });
      canvas.dispatchEvent(evtUp);
    }

    return {
      soundPlayed,
      digResult,
      pointerFired,
      sandBefore,
      sandAfter: game?.state?.sand,
    };
  })()
`);
console.log('Esito test scavo & suono:', digTestResult);

// 9. Test Negozio & Acquisto Scarabeo
console.log('\n--- TEST NEGOZIO & ACQUISTO SCARABEO ---');
const buyScarabResult = await evaluate(`
  (() => {
    const debug = window.DDS_DEBUG;
    const game = window.__dds?.game;
    const shop = game?.shop;

    // Aggiungi sabbia per permettere l'acquisto
    debug?.addSand(5000);

    // Apri negozio
    shop?.open();

    // Passa alla scheda Flotta
    const fleetTab = shop?.root?.querySelector('[data-tab="fleet"]');
    if (fleetTab) fleetTab.click();

    // Acquista Scarabeo
    const scarabBtn = shop?.content?.querySelector('[data-buy="scarab"]');
    const btnFound = !!scarabBtn;
    if (scarabBtn) {
      scarabBtn.click();
    }

    const scarabLevel = game?.state?.upgrades?.scarab || 0;
    const workersCount = game?.workers?.workers?.length || 0;
    const firstWorker = game?.workers?.workers?.[0];
    let workerDetails = null;
    if (firstWorker?.mesh) {
      const m = firstWorker.mesh;
      const meshNodes = [];
      m.traverse((node) => {
        meshNodes.push({
          type: node.type,
          name: node.name,
          isMesh: !!node.isMesh,
          geometry: node.geometry?.type,
          material: Array.isArray(node.material) ? node.material.map(mat => mat.type) : node.material?.type,
        });
      });
      workerDetails = {
        name: m.name,
        type: m.type,
        position: { x: m.position.x.toFixed(2), y: m.position.y.toFixed(2), z: m.position.z.toFixed(2) },
        visible: m.visible,
        nodesCount: meshNodes.length,
        nodes: meshNodes.slice(0, 10),
      };
    }

    return {
      shopOpen: shop?.isOpen,
      btnFound,
      scarabLevel,
      workersCount,
      workerDetails,
    };
  })()
`);
console.log('Esito test acquisto Scarabeo e spawn 3D:', buyScarabResult);

// Attesa per permettere un ciclo di rendering
await sleep(1000);

// 10. Cattura screenshot per verifica grafica
const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
const screenshotPath = '/tmp/dds_phase9_qa.png';
fs.writeFileSync(screenshotPath, Buffer.from(screenshotRes.data, 'base64'));
console.log(`Screenshot salvato con successo in: ${screenshotPath}`);

// 11. Analisi di console log ed errori
console.log('\n========================================');
console.log('ANALISI ERRORI E CONSOLE BROWSER:');
console.log('========================================');
console.log(`Totale messaggi console: ${consoleLogs.length}`);
console.log(`Errori console: ${consoleErrors.length}`);
console.log(`Eccezioni pagina: ${pageErrors.length}`);

if (consoleErrors.length > 0) {
  console.log('\nDettaglio Errori Console:');
  consoleErrors.forEach((err, idx) => console.log(`  [${idx + 1}]`, err));
}

if (pageErrors.length > 0) {
  console.log('\nDettaglio Eccezioni Pagina:');
  pageErrors.forEach((exc, idx) => console.log(`  [${idx + 1}]`, exc));
}

console.log('\nEstratto log DDS rilevanti:');
const ddsLogs = consoleLogs.filter(l => l.text.includes('[DDS]') || l.text.includes('[Assets]') || l.text.includes('[Audio]'));
ddsLogs.forEach(l => console.log(`  ${l.type}: ${l.text}`));

// Cleanup finale
cleanup();
ws.close();
console.log('\n--- TEST QA COMPLETATO CON SUCCESSO ---');
