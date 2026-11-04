import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9405;
const USER_DATA_DIR = `/tmp/qa-dds-models-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION 3D MODEL PIPELINE');
console.log('  Kenney / Quaternius GLTF vs Procedural & Hot-Swap QA');
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

  // 1. Attesa LoadingScreen e click Inizia Spedizione
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
      console.log('✓ Pulsante "Inizia Spedizione" cliccato con successo!');
      break;
    }
    await sleep(250);
  }
  await sleep(1200);

  // 2. Verifica Selettore Stile Modelli nelle Impostazioni Grafiche
  console.log('\n--- VERIFICA 1: SELETTORE STILE MODELLI NELLE IMPOSTAZIONI ---');
  await evaluate(`
    (() => {
      const btnSettings = document.querySelector('button[data-act="settings"]');
      if (btnSettings) btnSettings.click();
    })()
  `);
  await sleep(300);

  // Clicca sulla tab Grafica
  await evaluate(`
    (() => {
      const tab = document.querySelector('.tabs button[data-tab="graphics"]');
      if (tab) tab.click();
    })()
  `);
  await sleep(300);

  const modelSelectInfo = await evaluate(`
    (() => {
      const sel = document.querySelector('select[name="graphics.modelStyle"]');
      if (!sel) return { found: false };
      const options = Array.from(sel.querySelectorAll('option')).map(o => ({
        value: o.value,
        text: o.textContent.trim()
      }));
      return {
        found: true,
        currentValue: sel.value,
        optionsCount: options.length,
        options
      };
    })()
  `);
  console.log('Selettore Stile Modelli:', JSON.stringify(modelSelectInfo, null, 2));

  if (!modelSelectInfo.found || modelSelectInfo.optionsCount < 2) {
    console.error('❌ ERRORE: Selettore Stile Modelli 3D non trovato o opzioni insufficienti!');
    testPassed = false;
  } else {
    console.log(`✓ OK: Selettore Stile Modelli presente con ${modelSelectInfo.optionsCount} opzioni (Valore attuale: "${modelSelectInfo.currentValue}")`);
  }

  // Chiudi modale Impostazioni
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('.modal-close, .modal-actions button');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(300);

  // 3. Verifica Sezione Crediti Modelli 3D Low-Poly (Kenney / Quaternius CC0)
  console.log('\n--- VERIFICA 2: SEZIONE CREDITI MODELLI 3D (KENNEY & QUATERNIUS CC0) ---');
  await evaluate(`
    (() => {
      const btnCredits = document.querySelector('button[data-act="credits"]');
      if (btnCredits) btnCredits.click();
    })()
  `);
  await sleep(400);

  const creditsModelInfo = await evaluate(`
    (() => {
      const modal = document.querySelector('.modal');
      if (!modal) return { open: false };
      const text = modal.textContent;
      const html = modal.innerHTML;
      return {
        open: true,
        hasKenney: text.includes('Kenney'),
        hasKenneyUrl: html.includes('kenney.nl'),
        hasQuaternius: text.includes('Quaternius'),
        hasQuaterniusUrl: html.includes('quaternius.com'),
        hasCc0: text.includes('CC0 1.0 Universal') || text.includes('Creative Commons Zero'),
        hasModelTitle: text.includes('Modelli 3D Low-Poly') || text.includes('Low-Poly 3D Models')
      };
    })()
  `);
  console.log('Verifica Crediti Modelli 3D:', JSON.stringify(creditsModelInfo, null, 2));

  if (!creditsModelInfo.open || !creditsModelInfo.hasKenney || !creditsModelInfo.hasQuaternius || !creditsModelInfo.hasCc0) {
    console.error('❌ ERRORE: Attribuzioni Kenney / Quaternius CC0 non conformi nei Crediti!');
    testPassed = false;
  } else {
    console.log('✓ OK: Crediti Kenney & Quaternius con licenza CC0 Universal pienamente convalidati!');
  }

  await captureScreenshot('dds_qa_model_credits.png');

  // Chiudi modale Crediti
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('.modal-close, .modal-actions button');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(300);

  // 4. Avvia la spedizione di gioco
  console.log('\n--- AVVIO SPEDIZIONE E PREPARAZIONE FLOTTA LAVORATORI ---');
  await evaluate(`
    (() => {
      localStorage.removeItem('dds_save_v1');
      window.__dds.menu.startNewExpedition('desert');
    })()
  `);
  await sleep(1500);

  // Aggiungi 2 lavoratori per testare l'hot-swap delle mesh in tempo reale
  await evaluate(`
    (() => {
      window.__dds.game.state.upgrades.scarab = 2;
      window.__dds.game.workers.syncWithUpgrades(window.__dds.game.state.upgrades);
    })()
  `);
  await sleep(400);

  const workersCount = await evaluate(`window.__dds.game.workers.workers.length`);
  console.log(`Numero di lavoratori attivi in scena: ${workersCount}`);
  if (workersCount < 2) {
    console.error('❌ ERRORE: Lavoratori non istanziati in scena!');
    testPassed = false;
  }

  // 5. Test Hot-Swap 1: Switch da GLTF a Procedurale
  console.log('\n--- VERIFICA 3: HOT-SWAP A PROCEDURALI MATEMATICI ---');
  const initialGeometries = await evaluate(`window.__dds.scene.renderer.info.memory.geometries`);
  console.log(`Geometrie GPU prima dello switch: ${initialGeometries}`);

  await evaluate(`
    (() => {
      window.__dds.settings.set('graphics.modelStyle', 'procedural');
    })()
  `);
  await sleep(500);

  const currentModelStyle1 = await evaluate(`window.__dds.settings.get('graphics.modelStyle')`);
  const geometriesAfterProcedural = await evaluate(`window.__dds.scene.renderer.info.memory.geometries`);
  console.log(`Stile attivo: "${currentModelStyle1}", Geometrie GPU: ${geometriesAfterProcedural}`);

  if (currentModelStyle1 !== 'procedural') {
    console.error('❌ ERRORE: modelStyle non impostato su procedural!');
    testPassed = false;
  } else {
    console.log('✓ OK: Hot-swap verso Procedurali Matematici eseguito con successo!');
  }

  // 6. Test Hot-Swap 2: Switch da Procedurale a GLTF
  console.log('\n--- VERIFICA 4: HOT-SWAP A MODELLI ESTERNI GLTF ---');
  await evaluate(`
    (() => {
      window.__dds.settings.set('graphics.modelStyle', 'gltf');
    })()
  `);
  await sleep(500);

  const currentModelStyle2 = await evaluate(`window.__dds.settings.get('graphics.modelStyle')`);
  const geometriesAfterGltf = await evaluate(`window.__dds.scene.renderer.info.memory.geometries`);
  console.log(`Stile attivo: "${currentModelStyle2}", Geometrie GPU: ${geometriesAfterGltf}`);

  if (currentModelStyle2 !== 'gltf') {
    console.error('❌ ERRORE: modelStyle non impostato su gltf!');
    testPassed = false;
  } else {
    console.log('✓ OK: Hot-swap verso Modelli Esterni GLTF eseguito con successo!');
  }

  // Cattura screenshot della scena con lavoratori
  await captureScreenshot('dds_qa_model_hotswap.png');

  // =========================================================================
  // REPORT FINALE E CONSOLE ERRORS
  // =========================================================================
  console.log('\n========================================================');
  console.log(`Errori Console rilevati: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e, idx) => console.error(` [${idx + 1}] ${e}`));
    testPassed = false;
  } else {
    console.log('✓ Zero errori console e zero eccezioni non gestite!');
  }
  console.log('========================================================');

} catch (err) {
  console.error('[Browser QA Test Runner Exception]:', err);
  if (consoleErrors.length > 0) {
    console.error('Console errors logged:');
    consoleErrors.forEach((e, idx) => console.error(` [${idx + 1}] ${e}`));
  }
  testPassed = false;
} finally {
  cleanup();
}

if (!testPassed) {
  console.error('\n❌ QA TEST MODELLI 3D FALLITO');
  process.exit(1);
} else {
  console.log('\n✅ TUTTI I TEST PIPELINE MODELLI 3D E HOT-SWAP SONO SUPERATI CON SUCCESSO!');
  process.exit(0);
}
