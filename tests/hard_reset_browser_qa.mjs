import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const CDP_PORT = 9425;
const USER_DATA_DIR = `/tmp/qa-dds-hard-reset-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION HARD RESET & CACHE WIPE');
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

async function takeScreenshot(filename) {
  const res = await sendCDP('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.data, 'base64');
  const filepath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`[QA Screenshot] Salvato: ${filename} (${buffer.length} bytes)`);
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
          const btn = document.getElementById('loading-start-btn');
          if (btn && !btn.disabled) {
            btn.click();
            return true;
          }
          return false;
        })()
      `);
      if (btnReady) break;
    } catch {}
  }

  await sleep(1000);

  console.log('2. Apertura del modale Impostazioni (Scheda Dati)...');
  await evalInPage(`
    (() => {
      window.__dds.settingsModal.open('data');
    })()
  `);
  await sleep(500);

  const dataZoneInfo = await evalInPage(`
    (() => {
      const btn = document.getElementById('btn-hard-reset-data');
      if (!btn) return null;
      return {
        id: btn.id,
        text: btn.textContent,
        classes: Array.from(btn.classList),
      };
    })()
  `);
  assert.ok(dataZoneInfo, 'Pulsante hard reset presente nella scheda Dati');
  assert.ok(dataZoneInfo.classes.includes('btn-danger-wipe'), 'Classe .btn-danger-wipe presente');
  console.log('✓ Scheda Dati: pulsante Hard Reset presente e formattato:', dataZoneInfo);

  await takeScreenshot('dds_qa_settings_hard_reset_zone.png');

  console.log('3. Navigazione alla Scheda Trucchi (Cheats)...');
  await evalInPage(`
    (() => {
      window.__dds.settingsModal.open('cheats');
    })()
  `);
  await sleep(500);

  const cheatsBtnInfo = await evalInPage(`
    (() => {
      const btn = document.getElementById('btn-hard-reset-all');
      if (!btn) return null;
      return {
        id: btn.id,
        text: btn.textContent,
        classes: Array.from(btn.classList),
      };
    })()
  `);
  assert.ok(cheatsBtnInfo, 'Pulsante hard reset presente nella scheda Trucchi');
  assert.ok(cheatsBtnInfo.classes.includes('btn-danger-wipe'), 'Classe .btn-danger-wipe presente');
  console.log('✓ Scheda Trucchi: pulsante Hard Reset presente:', cheatsBtnInfo);

  console.log('4. Test click 1 (Stato Conferma a Due Stadi)...');
  await evalInPage(`
    (() => {
      const btn = document.getElementById('btn-hard-reset-all');
      btn.click();
    })()
  `);
  await sleep(300);

  const confirmingState = await evalInPage(`
    (() => {
      const btn = document.getElementById('btn-hard-reset-all');
      return {
        text: btn.textContent,
        isConfirming: btn.classList.contains('is-confirming'),
      };
    })()
  `);
  assert.equal(confirmingState.isConfirming, true, 'Il pulsante deve acquisire la classe .is-confirming');
  assert.equal(confirmingState.text.includes('Conferma'), true, 'Il testo deve richiedere conferma esplicita');
  console.log('✓ Stato conferma a due stadi attivo:', confirmingState);

  await takeScreenshot('dds_qa_cheats_hard_reset_confirm.png');

  console.log('5. Popolamento storage di prova e test centralizzato performHardReset()...');
  const wipeResult = await evalInPage(`
    (async () => {
      localStorage.setItem('dds_qa_test', '12345');
      sessionStorage.setItem('dds_qa_session', 'active');
      if ('caches' in window) {
        await caches.open('dds_qa_cache_test');
      }

      // Esegui hard reset con reload disattivato per verificare stato pulito nel test runner
      const res = await window.__DDS_DEBUG.hardReset({ reload: false });
      return {
        ok: res.ok,
        wipingFlag: window.__DDS_WIPING_DATA,
        localLen: localStorage.length,
        sessionLen: sessionStorage.length,
        cacheKeys: 'caches' in window ? (await caches.keys()).length : 0,
      };
    })()
  `);
  console.log('Esito esecuzione hard reset:', wipeResult);
  assert.equal(wipeResult.ok, true, 'hardReset deve ritornare ok: true');
  assert.equal(wipeResult.wipingFlag, true, 'window.__DDS_WIPING_DATA deve essere true');
  assert.equal(wipeResult.localLen, 0, 'localStorage deve essere completamente vuoto');
  assert.equal(wipeResult.sessionLen, 0, 'sessionStorage deve essere completamente vuoto');
  assert.equal(wipeResult.cacheKeys, 0, 'Tutte le chiavi Cache Storage devono essere eliminate');
  console.log('✓ Hard Reset eseguito con successo, memoria ripulita e cache eliminate.');

  console.log('6. Verifica Console Errors ed Eccezioni Page...');
  if (consoleErrors.length > 0) {
    console.error('Console errors rilevati:', consoleErrors);
    throw new Error(`Rilevati ${consoleErrors.length} errori console durante la QA.`);
  }
  console.log('✓ 0 Errori Console, 0 Eccezioni Rilevate.');

  console.log('\n========================================================');
  console.log('  QA AUTOMATION HARD RESET SUPERATA CON SUCCESSO!       ');
  console.log('========================================================');
  cleanup();
  process.exit(0);
} catch (err) {
  console.error('[QA FAILED]', err);
  cleanup();
  process.exit(1);
}
