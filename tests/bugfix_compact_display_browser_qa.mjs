import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9375;
const USER_DATA_DIR = `/tmp/qa-dds-bugfix-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION BUGFIX COMPACT 14"');
console.log('  Translations & Compact Viewport Modals / HUD QA');
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

try {
  // Attendi il boot dell'applicazione
  await sleep(1500);

  // Imposta viewport 1366x768 (standard laptop 14")
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('✓ Viewport impostato a 1366x768 (Laptop 14")');

  // Prepara un salvataggio attivo in localStorage per innescare il prompt di sovrascrittura
  await evaluate(`
    localStorage.setItem('dds_save_v1', JSON.stringify({
      version: 1,
      sand: 50000,
      totalSandEarned: 120000,
      timestamp: Date.now() - 3600000,
      upgrades: { shovel_speed: 3 },
      relics: [],
      biome: 'desert'
    }));
  `);

  // Ricarica la pagina per leggere il save
  await cdp('Page.reload');
  await sleep(1800);

  // Clicca sul pulsante "Nuova Spedizione"
  const clickRes = await evaluate(`
    (() => {
      const btn = document.querySelector('button[data-act="new"]');
      if (!btn) return 'button[data-act="new"] not found';
      btn.click();
      return 'clicked';
    })()
  `);
  console.log('Stato click Nuova Spedizione:', clickRes);

  await sleep(400);

  // 1. Verifica contenuti del Modale di Sovrascrittura
  const modalInfo = await evaluate(`
    (() => {
      const modal = document.querySelector('#modal-root .modal');
      if (!modal) return null;
      const title = modal.querySelector('.modal-title')?.textContent?.trim() || '';
      const body = modal.querySelector('.modal-body')?.textContent?.trim() || '';
      const buttons = Array.from(modal.querySelectorAll('.modal-actions .btn')).map(b => b.textContent?.trim());
      const rect = modal.getBoundingClientRect();
      const actions = modal.querySelector('.modal-actions')?.getBoundingClientRect();
      return {
        title,
        body,
        buttons,
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
        actions: actions ? { top: actions.top, bottom: actions.bottom } : null,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    })()
  `);

  console.log('Dettagli Modale Sovrascrittura:', modalInfo);

  if (!modalInfo) {
    throw new Error('Modale di sovrascrittura non apparso nel DOM');
  }

  // Asserzioni sulle traduzioni
  if (modalInfo.title !== 'Sovrascrivere la Spedizione?') {
    throw new Error(`Titolo non corretto: "${modalInfo.title}"`);
  }
  if (!modalInfo.body.includes('Una spedizione è già in corso nel deserto')) {
    throw new Error(`Corpo del modale non corretto: "${modalInfo.body}"`);
  }
  if (!modalInfo.buttons.includes('Sovrascrivi e Inizia') || !modalInfo.buttons.includes('Annulla')) {
    throw new Error(`Pulsanti non corretti: ${JSON.stringify(modalInfo.buttons)}`);
  }
  console.log('✓ Titolo e pulsanti tradotti perfettamente in Italiano (nessuna chiave grezza)');

  // Asserzioni geometriche (completamente dentro il viewport di 768px)
  if (modalInfo.rect.bottom > modalInfo.viewportHeight) {
    throw new Error(`Modale fuoriuscito dal bordo inferiore: bottom ${modalInfo.rect.bottom} > viewport ${modalInfo.viewportHeight}`);
  }
  if (modalInfo.actions && modalInfo.actions.bottom > modalInfo.viewportHeight) {
    throw new Error(`Pulsanti di azione non visibili: bottom ${modalInfo.actions.bottom} > viewport ${modalInfo.viewportHeight}`);
  }
  console.log('✓ Modale e pulsanti .modal-actions 100% visibili e ancorati dentro il viewport (768px)');

  // Scatta screenshot del modale di sovrascrittura su display 14"
  const screenshotRes = await cdp('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = path.join(ARTIFACT_DIR, 'dds_qa_compact_viewport_modal.png');
  fs.writeFileSync(screenshotPath, Buffer.from(screenshotRes.data, 'base64'));
  console.log(`✓ Screenshot salvato in: ${screenshotPath}`);

  // 2. Verifica lingua Inglese (EN)
  console.log('\n--- Verifica Lingua Inglese (EN) ---');
  await evaluate(`
    (() => {
      // Chiudi il modale corrente cliccando su Annulla
      const cancelBtn = Array.from(document.querySelectorAll('#modal-root .modal-actions .btn')).find(b => b.textContent.includes('Annulla'));
      if (cancelBtn) cancelBtn.click();
    })()
  `);
  await sleep(300);

  // Imposta lingua inglese e riapri il modale
  const enModalInfo = await evaluate(`
    (() => {
      const i18n = window.__dds?.i18n;
      if (i18n) i18n.setLanguage('en');
      const btn = document.querySelector('button[data-act="new"]');
      if (btn) btn.click();
      const modal = document.querySelector('#modal-root .modal');
      if (!modal) return null;
      return {
        title: modal.querySelector('.modal-title')?.textContent?.trim() || '',
        buttons: Array.from(modal.querySelectorAll('.modal-actions .btn')).map(b => b.textContent?.trim()),
      };
    })()
  `);
  console.log('Dettagli Modale Sovrascrittura (EN):', enModalInfo);

  if (enModalInfo.title !== 'Overwrite Expedition?' || !enModalInfo.buttons.includes('Overwrite & Start') || !enModalInfo.buttons.includes('Cancel')) {
    throw new Error(`Traduzioni EN fallite: ${JSON.stringify(enModalInfo)}`);
  }
  console.log('✓ Traduzioni Inglesi verificate con successo ("Overwrite Expedition?", "Overwrite & Start", "Cancel")');

  // Chiudi modale
  await evaluate(`
    (() => {
      const cancelBtn = Array.from(document.querySelectorAll('#modal-root .modal-actions .btn')).find(b => b.textContent.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
      if (window.__dds?.i18n) window.__dds.i18n.setLanguage('it');
    })()
  `);
  await sleep(300);

  // 3. Test Viewport Ultra-Compatto 1280x720 (Scaling 150% su display Full HD 14" o 1366x768 con interfaccia browser)
  console.log('\n--- Test Viewport 1280x720 (Scaling OS 150%) ---');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(300);

  // Riapri Nuova Spedizione e procedi per vedere il modale Biomi
  await evaluate(`
    (() => {
      const btn = document.querySelector('button[data-act="new"]');
      if (btn) btn.click();
      // Clicca Sovrascrivi
      const confirmBtn = Array.from(document.querySelectorAll('#modal-root .modal-actions .btn')).find(b => b.textContent.includes('Sovrascrivi'));
      if (confirmBtn) confirmBtn.click();
    })()
  `);
  await sleep(500);

  // Verifica modale Biomi a 720px di altezza
  const biomeModalInfo = await evaluate(`
    (() => {
      const dialog = document.querySelector('.biome-modal-dialog');
      if (!dialog) return null;
      const rect = dialog.getBoundingClientRect();
      const footer = dialog.querySelector('.biome-modal-footer')?.getBoundingClientRect();
      return {
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
        footer: footer ? { top: footer.top, bottom: footer.bottom } : null,
        viewportHeight: window.innerHeight,
      };
    })()
  `);
  console.log('Dettagli Modale Biomi a 1280x720:', biomeModalInfo);

  if (!biomeModalInfo) {
    throw new Error('Modale Biomi non trovato');
  }
  if (biomeModalInfo.rect.bottom > biomeModalInfo.viewportHeight) {
    throw new Error(`Modale Biomi fuoriuscito: bottom ${biomeModalInfo.rect.bottom} > viewport ${biomeModalInfo.viewportHeight}`);
  }
  if (biomeModalInfo.footer && biomeModalInfo.footer.bottom > biomeModalInfo.viewportHeight) {
    throw new Error(`Footer Biomi non visibile: bottom ${biomeModalInfo.footer.bottom} > viewport ${biomeModalInfo.viewportHeight}`);
  }
  console.log('✓ Modale Biomi e footer d\'azione 100% contenuti e visibili a 720px di altezza');

  // Verifica errori console
  console.log('\nErrori Console registrati:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
    throw new Error(`Rilevati ${consoleErrors.length} errori console imprevisti.`);
  }

  console.log('\n========================================================');
  console.log('  TUTTI I TEST BROWSER QA DISPLAY 14" SUPERATI CON SUCCESSO!');
  console.log('========================================================\n');

} catch (err) {
  console.error('[Browser QA Test Failure]', err);
  process.exitCode = 1;
} finally {
  ws.close();
  cleanup();
}
