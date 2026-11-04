import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9385;
const USER_DATA_DIR = `/tmp/qa-dds-bugfix-shop-hud-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION VERIFICATION');
console.log('  Shop Drawer, Desert Bar, Modal Buttons & Menu Title');
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

  // Set standard laptop viewport 1366x768
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false
  });
  console.log('✓ Viewport impostato a 1366x768');

  // Prepara un salvataggio attivo in localStorage
  await evaluate(`
    localStorage.setItem('dds_save_v1', JSON.stringify({
      version: 1,
      sand: 45000,
      totalSandEarned: 150000,
      timestamp: Date.now() - 3600000,
      upgrades: { shovel_speed: 3, manual_power: 2 },
      relics: [],
      biome: 'desert'
    }));
  `);

  await cdp('Page.reload');
  await sleep(1600);

  // =========================================================================
  // TEST 4: Verifica Titolo Menu Principale (Nessun <BR> letterale, span corretti)
  // =========================================================================
  console.log('\n--- VERIFICA 4: TITOLO MENU PRINCIPALE ---');
  const titleInfo = await evaluate(`
    (() => {
      const titleEl = document.querySelector('.menu-title, .main-title');
      if (!titleEl) return { found: false };
      const rawHtml = titleEl.innerHTML;
      const text = titleEl.textContent;
      const hasLiteralBrTag = text.includes('<BR>') || text.includes('<br>') || rawHtml.includes('&lt;BR&gt;') || rawHtml.includes('&lt;br&gt;');
      const spans = Array.from(titleEl.querySelectorAll('.title-word')).map(s => ({
        className: s.className,
        text: s.textContent.trim()
      }));
      return {
        found: true,
        text,
        rawHtml,
        hasLiteralBrTag,
        spansCount: spans.length,
        spans
      };
    })()
  `);

  console.log('Titolo Menu trovato:', titleInfo.found, 'Spans:', titleInfo.spans);
  if (titleInfo.hasLiteralBrTag) {
    console.error('❌ ERRORE: Il titolo contiene ancora letteralmente il tag <BR>!');
    testPassed = false;
  } else if (titleInfo.spansCount >= 2) {
    console.log(`✓ OK: Il titolo è strutturato semanticamente su due span (${titleInfo.spans[0].text} / ${titleInfo.spans[1].text}) senza tag <BR> letterale!`);
  } else {
    console.log('✓ OK: Nessun tag <BR> grezzo visualizzato nel titolo.');
  }

  // =========================================================================
  // TEST 3: Verifica Modale di Conferma e Pulsanti Affiancati Orizzontalmente
  // =========================================================================
  console.log('\n--- VERIFICA 3: PULSANTI MODALE CONFERMA SPEDIZIONE ---');
  await evaluate(`
    (() => {
      const btn = document.querySelector('button[data-act="new"]');
      if (btn) btn.click();
    })()
  `);
  await sleep(400);

  const modalButtonsInfo = await evaluate(`
    (() => {
      const modal = document.querySelector('.modal');
      const actions = document.querySelector('.modal-actions');
      if (!modal || !actions) return { open: false };
      
      const buttons = Array.from(actions.querySelectorAll('button, .btn'));
      const details = buttons.map(b => {
        const r = b.getBoundingClientRect();
        return {
          id: b.id,
          className: b.className,
          text: b.textContent.trim(),
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height
        };
      });

      const actionsComputed = window.getComputedStyle(actions);
      const isRow = actionsComputed.flexDirection === 'row';

      return {
        open: true,
        count: buttons.length,
        details,
        isRow,
        actionsDisplay: actionsComputed.display
      };
    })()
  `);

  console.log('Dettagli Pulsanti Modale:', JSON.stringify(modalButtonsInfo, null, 2));
  if (!modalButtonsInfo.open || modalButtonsInfo.count < 2) {
    console.error('❌ ERRORE: Modale di conferma non aperto o bottoni mancanti!');
    testPassed = false;
  } else {
    const btn1 = modalButtonsInfo.details[0]; // Dovrebbe essere Sovrascrivi (sinistra)
    const btn2 = modalButtonsInfo.details[1]; // Dovrebbe essere Annulla (destra)
    const isSideBySide = Math.abs(btn1.top - btn2.top) < 15;
    const isFirstOnLeft = btn1.left < btn2.left;

    console.log(`Pulsanti affiancati orizzontalmente: ${isSideBySide} (Top diff: ${Math.abs(btn1.top - btn2.top)}px)`);
    console.log(`Sovrascrivi a sinistra di Annulla: ${isFirstOnLeft} (Left 1: ${btn1.left}px, Left 2: ${btn2.left}px)`);

    if (isSideBySide && isFirstOnLeft) {
      console.log('✓ OK: Pulsanti disposti orizzontalmente con Sovrascrivi a sinistra e Annulla a destra!');
    } else {
      console.error('❌ ERRORE: Layout pulsanti non conforme (non affiancati o ordine errato)!');
      testPassed = false;
    }
  }

  await captureScreenshot('dds_qa_bugfix_modal_buttons.png');

  // Chiudi il modale cliccando su Annulla o premendo Escape
  await evaluate(`
    (() => {
      const cancelBtn = document.getElementById('btn-cancel-overwrite') || document.querySelector('.btn-cancel-action');
      if (cancelBtn) cancelBtn.click();
    })()
  `);
  await sleep(300);

  // Ora avvia la partita cliccando su "Continua Spedizione"
  console.log('\n--- AVVIO SESSIONE DI GIOCO ---');
  await evaluate(`
    (() => {
      const continueBtn = document.querySelector('button[data-act="continue"]') || document.querySelector('button[data-act="new"]');
      if (continueBtn) continueBtn.click();
    })()
  `);
  await sleep(1500);

  // =========================================================================
  // TEST 2: Verifica Adattamento e Larghezza Barra Deserto Scavato
  // =========================================================================
  console.log('\n--- VERIFICA 2: ADATTAMENTO BARRA DESERTO SCAVATO ---');
  const hudProgressInfo = await evaluate(`
    (() => {
      const hudCenter = document.getElementById('hud-metrics-center');
      const panel = document.querySelector('.hud-metrics-panel');
      const progressWrap = document.querySelector('.hud-progress');
      const track = document.querySelector('.progress-bar-track');
      const fill = document.querySelector('.progress-bar-fill');
      const pct = document.getElementById('completion-pct');

      if (!panel || !progressWrap || !track) {
        return { found: false };
      }

      const panelRect = panel.getBoundingClientRect();
      const progressRect = progressWrap.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();

      return {
        found: true,
        panelWidth: panelRect.width,
        progressWidth: progressRect.width,
        trackWidth: trackRect.width,
        trackHeight: trackRect.height,
        pctText: pct ? pct.textContent.trim() : ''
      };
    })()
  `);

  console.log('Geometria Barra Deserto:', JSON.stringify(hudProgressInfo, null, 2));
  if (!hudProgressInfo.found) {
    console.error('❌ ERRORE: Elementi HUD barra deserto non trovati!');
    testPassed = false;
  } else if (hudProgressInfo.trackWidth < 180) {
    console.error(`❌ ERRORE: Barra deserto compressa (${hudProgressInfo.trackWidth}px < 180px)!`);
    testPassed = false;
  } else {
    console.log(`✓ OK: Barra deserto estesa e fluida (${hudProgressInfo.trackWidth.toFixed(1)}px su ${hudProgressInfo.panelWidth.toFixed(1)}px di pannello)!`);
  }

  // =========================================================================
  // TEST 1: Verifica Ripristino e Apertura Cassetto Officina
  // =========================================================================
  console.log('\n--- VERIFICA 1: APERTURA E VISIBILITA CASSETTO OFFICINA ---');
  
  // Clicca sul pulsante Officina nella dock
  const clickShopRes = await evaluate(`
    (() => {
      const btn = document.getElementById('btn-shop') || document.querySelector('button[data-act="shop"]');
      if (!btn) return 'btn-shop not found';
      btn.click();
      return 'clicked';
    })()
  `);
  console.log('Stato click Officina:', clickShopRes);
  await sleep(500); // attesa transizione CSS 350ms

  const shopDrawerInfo = await evaluate(`
    (() => {
      const container = document.querySelector('.shop-container');
      const drawer = document.getElementById('shop-drawer') || document.querySelector('.shop-drawer');
      const backdrop = document.querySelector('.shop-backdrop');

      if (!container || !drawer) {
        return { found: false };
      }

      const drawerRect = drawer.getBoundingClientRect();
      const drawerStyle = window.getComputedStyle(drawer);
      const containerStyle = window.getComputedStyle(container);
      const backdropStyle = backdrop ? window.getComputedStyle(backdrop) : null;

      return {
        found: true,
        isOpen: container.classList.contains('open') || container.classList.contains('is-open'),
        drawerClasses: drawer.className,
        rect: {
          left: drawerRect.left,
          right: drawerRect.right,
          top: drawerRect.top,
          bottom: drawerRect.bottom,
          width: drawerRect.width,
          height: drawerRect.height
        },
        transform: drawerStyle.transform,
        zIndex: drawerStyle.zIndex,
        visibility: drawerStyle.visibility,
        containerPointerEvents: containerStyle.pointerEvents,
        backdropOpacity: backdropStyle ? backdropStyle.opacity : null,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        insideViewport: drawerRect.left < window.innerWidth && drawerRect.right > 0 && drawerRect.width > 200
      };
    })()
  `);

  console.log('Stato Cassetto Officina:', JSON.stringify(shopDrawerInfo, null, 2));

  if (!shopDrawerInfo.found) {
    console.error('❌ ERRORE: Elementi cassetto officina non trovati!');
    testPassed = false;
  } else if (!shopDrawerInfo.isOpen || !shopDrawerInfo.insideViewport) {
    console.error('❌ ERRORE: Il cassetto non è visibile all\'interno del viewport dopo il click!');
    testPassed = false;
  } else {
    console.log(`✓ OK: Cassetto Officina perfettamente visibile! Width: ${shopDrawerInfo.rect.width}px, Left: ${shopDrawerInfo.rect.left}px (Viewport: ${shopDrawerInfo.windowWidth}px), Transform: ${shopDrawerInfo.transform}`);
  }

  // Cattura screenshot con officina aperta
  await captureScreenshot('dds_qa_bugfix_shop_open.png');

  // Test chiusura officina
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('.shop-close-btn');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(400);

  const shopClosedInfo = await evaluate(`
    (() => {
      const container = document.querySelector('.shop-container');
      return {
        isOpen: container ? (container.classList.contains('open') || container.classList.contains('is-open')) : false
      };
    })()
  `);
  console.log('Officina chiusa con successo:', !shopClosedInfo.isOpen);

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
  testPassed = false;
} finally {
  cleanup();
}

if (!testPassed) {
  console.error('\n❌ QA TEST FALLITO');
  process.exit(1);
} else {
  console.log('\n✅ TUTTI I 4 CONTROLLI DI INTERFACCIA SONO SUPERATI CON SUCCESSO!');
  process.exit(0);
}

