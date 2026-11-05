import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const CDP_PORT = 9435;
const USER_DATA_DIR = `/tmp/qa-dds-mobile-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION MOBILE UI OVERHAUL');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Avvio Chrome in modalità mobile (390x844 - iPhone / Modern Android)
const chromeProc = spawn('google-chrome', [
  '--headless=new',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=390,844',
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

async function takeScreenshot(fileName) {
  const { data } = await sendCDP('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(data, 'base64');
  const outPath = path.join(ARTIFACT_DIR, fileName);
  fs.writeFileSync(outPath, buf);
  console.log(`  📸 Screenshot salvato: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
  return outPath;
}

try {
  await sendCDP('Runtime.enable');
  await sendCDP('Page.enable');
  await sendCDP('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });

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

  await sleep(1500);

  // Dal menu principale, avvia la spedizione
  console.log('2. Avvio Spedizione...');
  await evalInPage(`
    (() => {
      if (window.__dds?.menu?.startNewExpedition) {
        window.__dds.menu.startNewExpedition('desert');
      } else {
        const btn = document.querySelector('#menu [data-act="new"]') || document.querySelector('#menu [data-act="continue"]');
        if (btn) btn.click();
      }
    })()
  `);

  // Attendi il completamento dell'intro e l'ingresso in fase di gioco
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    const isPlay = await evalInPage(`
      (() => {
        if (window.__dds?.game) {
          if (window.__dds.game.phase === 'intro') {
            window.__dds.game.introT = 1.0;
            window.__dds.game.phase = 'play';
          }
          return window.__dds.game.phase === 'play';
        }
        return false;
      })()
    `);
    if (isPlay) break;
  }
  await sleep(500);

  // 3. Verifica Auto-Scaler e Viewport Mobile
  console.log('3. Verifica Auto-Scaler e Viewport Mobile...');
  const scalerInfo = await evalInPage(`
    (() => {
      const cs = getComputedStyle(document.documentElement);
      const fs = cs.fontSize;
      const uiScale = cs.getPropertyValue('--ui-scale').trim();
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      return { fs, uiScale, winW, winH };
    })()
  `);
  console.log('   Dati viewport & scaler:', scalerInfo);
  assert.equal(scalerInfo.fs, '12px', 'Su schermo <= 480px, font-size html deve essere 12px');
  assert.equal(scalerInfo.uiScale, '0.76', 'Su schermo <= 480px, --ui-scale deve essere 0.76');

  // 4. Verifica Visibilità HUD Dock su Mobile
  console.log('4. Verifica Visibilità HUD Dock...');
  const dockInfo = await evalInPage(`
    (() => {
      const dock = document.querySelector('#hud-bottom-dock, .hud-bottom-dock');
      const rect = dock.getBoundingClientRect();
      const cs = getComputedStyle(dock);
      const helpBtn = document.querySelector('#btn-help');
      const shopBtn = document.querySelector('#btn-shop');
      const pauseBtn = document.querySelector('#btn-pause');
      return {
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0',
        zIndex: cs.zIndex,
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right },
        windowH: window.innerHeight,
        buttons: {
          help: !!helpBtn && helpBtn.offsetWidth > 0,
          shop: !!shopBtn && shopBtn.offsetWidth > 0,
          pause: !!pauseBtn && pauseBtn.offsetWidth > 0,
        }
      };
    })()
  `);
  console.log('   Info dock comandi HUD:', dockInfo);
  assert.ok(dockInfo.visible, 'Il dock comandi inferiore deve essere visibile');
  assert.equal(dockInfo.zIndex, '850', 'Il dock deve avere z-index: 850');
  assert.ok(dockInfo.rect.bottom <= dockInfo.windowH, `Il dock deve trovarsi dentro il viewport (bottom: ${dockInfo.rect.bottom} <= ${dockInfo.windowH})`);
  assert.ok(dockInfo.buttons.help && dockInfo.buttons.shop && dockInfo.buttons.pause, 'Tutti e 3 i bottoni Aiuto/Officina/Pausa devono essere attivi e misurabili');

  await takeScreenshot('dds_qa_mobile_hud.png');

  // 5. Verifica Menu Pausa (Traduzioni, Nessun Doppio Contatore)
  console.log('5. Apertura e Verifica Menu di Pausa...');
  await evalInPage(`document.querySelector('#btn-pause')?.click()`);
  await sleep(600);

  const pauseInfo = await evalInPage(`
    (() => {
      const overlay = document.querySelector('.pause-overlay');
      const card = document.querySelector('.pause-card');
      const elapsedEl = document.querySelector('.pause-sub');
      const prestigeBtn = document.querySelector('.pause-actions [data-act="prestige"]');
      const resumeBtn = document.querySelector('.pause-actions [data-act="resume"]');
      const cardRect = card?.getBoundingClientRect();
      return {
        cardVisible: !!card && cardRect.height > 0,
        cardHeight: cardRect?.height,
        windowH: window.innerHeight,
        elapsedText: elapsedEl?.textContent || '',
        prestigeText: prestigeBtn?.textContent || '',
        resumeVisible: !!resumeBtn && resumeBtn.offsetHeight > 0,
      };
    })()
  `);
  console.log('   Info menu pausa:', pauseInfo);
  assert.ok(pauseInfo.cardVisible, 'La card del menu pausa deve essere visibile');
  assert.ok(pauseInfo.elapsedText.includes('Tempo trascorso:'), 'Il testo deve contenere "Tempo trascorso:" tradotto');
  assert.ok(!pauseInfo.elapsedText.includes('pause.elapsed'), 'Non deve contenere la chiave grezza pause.elapsed');
  assert.ok(pauseInfo.prestigeText.includes('Santuario dei Predecessori'), 'Deve contenere "Santuario dei Predecessori"');
  assert.ok(!pauseInfo.prestigeText.includes('{count}') && !pauseInfo.prestigeText.includes('{COUNT}'), 'Nessun placeholder grezzo {count}');
  assert.ok(!pauseInfo.prestigeText.includes('(T {COUNT})'), 'Nessun (T {COUNT}) duplicato');

  // Verifica che non vi siano doppi contatori (es. "Santuario dei Predecessori (τ 0) (τ 0)")
  const countMatches = pauseInfo.prestigeText.match(/\([τtT]\s*\d+\)/g) || [];
  assert.ok(countMatches.length <= 1, `Il contatore tavolette deve apparire al massimo 1 volta, trovato: ${countMatches.length}`);

  await takeScreenshot('dds_qa_mobile_pause_menu.png');

  // Chiudi menu pausa
  console.log('   Chiusura Menu Pausa...');
  await evalInPage(`document.querySelector('.pause-actions [data-act="resume"]')?.click()`);
  await sleep(600);

  // 6. Verifica Officina / Shop su Mobile (Pulsanti Acquisto Visibili, Bottom Sheet)
  console.log('6. Apertura e Verifica Officina / Shop...');
  await evalInPage(`document.querySelector('#btn-shop')?.click()`);
  await sleep(800);

  const shopInfo = await evalInPage(`
    (() => {
      const drawer = document.querySelector('#shop-drawer, .shop-drawer');
      const drawerRect = drawer?.getBoundingClientRect();
      const content = document.querySelector('.shop-content');
      const cards = Array.from(document.querySelectorAll('.upgrade-card, .shop-item'));

      const cardsData = cards.slice(0, 5).map((c) => {
        const title = c.querySelector('.upgrade-name')?.textContent?.trim() || '';
        const btn = c.querySelector('.btn-buy, .upgrade-buy-btn');
        const cRect = c.getBoundingClientRect();
        const bRect = btn?.getBoundingClientRect();
        const csBtn = btn ? getComputedStyle(btn) : null;
        return {
          title,
          cardHeight: cRect.height,
          btnVisible: !!btn && csBtn?.display !== 'none' && csBtn?.visibility !== 'hidden',
          btnHeight: bRect?.height || 0,
          btnText: btn?.textContent?.trim() || '',
        };
      });

      return {
        drawerHeight: drawerRect?.height,
        windowH: window.innerHeight,
        totalCards: cards.length,
        cardsData,
      };
    })()
  `);
  console.log('   Info officina mobile:', shopInfo);
  assert.ok(shopInfo.totalCards > 0, 'Devono essere presenti le schede di upgrade');

  // Verifica che TUTTI i pulsanti di acquisto delle schede siano visibili e abbiano altezza >= 30px
  shopInfo.cardsData.forEach((cd, idx) => {
    assert.ok(cd.btnVisible, `Scheda ${idx} (${cd.title}): Bottone acquisto non visibile!`);
    assert.ok(cd.btnHeight >= 30, `Scheda ${idx} (${cd.title}): Altezza bottone insufficiente (${cd.btnHeight}px)`);
    console.log(`   ✓ Card ${idx + 1} (${cd.title}): bottone acquisto visibile [${cd.btnText}] (${cd.btnHeight.toFixed(0)}px)`);
  });

  await takeScreenshot('dds_qa_mobile_shop_cards.png');

  // Chiudi officina
  console.log('   Chiusura Officina...');
  await evalInPage(`document.querySelector('.shop-close-btn')?.click()`);
  await sleep(600);

  // Verifica che al ritorno al gioco il dock comandi sia ancora perfettamente visibile
  const postCloseDock = await evalInPage(`
    (() => {
      const dock = document.querySelector('#hud-bottom-dock, .hud-bottom-dock');
      const cs = getComputedStyle(dock);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    })()
  `);
  assert.ok(postCloseDock, 'Il dock inferiore deve rimanere visibile dopo la chiusura del drawer Officina');

  // 7. Controllo Errori Console
  console.log('7. Verifica Errori Console...');
  console.log('   Errori registrati:', consoleErrors);
  assert.equal(consoleErrors.length, 0, `Nessun errore console ammesso: trovati ${consoleErrors.length}`);

  console.log('========================================================');
  console.log('  🎉 QA MOBILE UI OVERHAUL COMPLETATO CON SUCCESSO!     ');
  console.log('========================================================');

} catch (err) {
  console.error('TEST FALLITO:', err);
  process.exitCode = 1;
} finally {
  cleanup();
}
