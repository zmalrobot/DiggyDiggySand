import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9380;
const USER_DATA_DIR = `/tmp/qa-dds-hud-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/?cheat=1`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION HUD RESTRUCTURING');
console.log('  Top-Center Metrics, Bottom-Center Dock, Bottom-Right Cheats');
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
  '--window-size=1920,1080',
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
  await sleep(1800);

  // 1. Avvia partita se nel menu iniziale
  await evaluate(`
    (() => {
      const newBtn = document.querySelector('button[data-act="new"]');
      if (newBtn) {
        newBtn.click();
      }
      const confirmBiomeBtn = document.querySelector('#btn-confirm-biome');
      if (confirmBiomeBtn) {
        confirmBiomeBtn.click();
      }
    })()
  `);
  await sleep(1000);

  // ----------------------------------------------------
  // TEST 1: DESKTOP TIER 1 (1920x1080)
  // ----------------------------------------------------
  console.log('\n--- VERIFICA TIER 1: DESKTOP (1920x1080) ---');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(300);

  const desktopInfo = await evaluate(`
    (() => {
      const metrics = document.querySelector('#hud-metrics-center');
      const dock = document.querySelector('#hud-bottom-dock');
      const cheats = document.querySelector('#hud-cheats-zone');
      const directives = document.querySelector('#directives-root');

      const mRect = metrics?.getBoundingClientRect();
      const dRect = dock?.getBoundingClientRect();
      const cRect = cheats?.getBoundingClientRect();
      const dirRect = directives?.getBoundingClientRect();

      const btnHelp = document.querySelector('#btn-help');
      const btnShop = document.querySelector('#btn-shop');
      const btnPause = document.querySelector('#btn-pause');
      const btnCheats = document.querySelector('#btn-cheats-toggle');
      const sandCounter = document.querySelector('#sand-counter');
      const sandRate = document.querySelector('#sand-rate');
      const completionPct = document.querySelector('#completion-pct');
      const completionBar = document.querySelector('#completion-bar');

      return {
        metricsCenter: mRect ? { top: mRect.top, bottom: mRect.bottom, left: mRect.left, right: mRect.right, width: mRect.width, centerX: (mRect.left + mRect.right) / 2 } : null,
        dockCenter: dRect ? { top: dRect.top, bottom: dRect.bottom, left: dRect.left, right: dRect.right, width: dRect.width, centerX: (dRect.left + dRect.right) / 2 } : null,
        cheatsZone: cRect ? { top: cRect.top, bottom: cRect.bottom, left: cRect.left, right: cRect.right } : null,
        directives: dirRect ? { top: dirRect.top, bottom: dirRect.bottom, left: dirRect.left, right: dirRect.right } : null,
        buttons: {
          hasHelp: !!btnHelp,
          hasShop: !!btnShop,
          shopIsPrimary: btnShop?.classList.contains('hud-dock-btn-primary'),
          hasPause: !!btnPause,
          hasCheats: !!btnCheats,
        },
        elements: {
          hasSandCounter: !!sandCounter,
          hasSandRate: !!sandRate,
          hasCompletionPct: !!completionPct,
          hasCompletionBar: !!completionBar,
        },
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
    })()
  `);

  console.log('Geometria Desktop:', JSON.stringify(desktopInfo, null, 2));

  // Asserzioni Top-Center
  if (!desktopInfo.metricsCenter) throw new Error('Metriche #hud-metrics-center non trovate');
  if (desktopInfo.metricsCenter.top > 30) throw new Error(`Metriche top troppo basso: ${desktopInfo.metricsCenter.top}`);
  if (Math.abs(desktopInfo.metricsCenter.centerX - 1920 / 2) > 10) throw new Error(`Metriche non centrate orizzontalmente: centerX=${desktopInfo.metricsCenter.centerX}`);
  console.log('✓ Metriche di scavo perfettamente ancorate in ALTO AL CENTRO');

  // Asserzioni Bottom-Center
  if (!desktopInfo.dockCenter) throw new Error('Dock #hud-bottom-dock non trovata');
  if (desktopInfo.dockCenter.bottom < 1000) throw new Error(`Dock bottom non in basso: ${desktopInfo.dockCenter.bottom}`);
  if (Math.abs(desktopInfo.dockCenter.centerX - 1920 / 2) > 10) throw new Error(`Dock non centrata orizzontalmente: centerX=${desktopInfo.dockCenter.centerX}`);
  if (!desktopInfo.buttons.hasHelp || !desktopInfo.buttons.hasShop || !desktopInfo.buttons.hasPause) throw new Error('Pulsanti della dock mancanti');
  if (!desktopInfo.buttons.shopIsPrimary) throw new Error('Pulsante Officina non ha evidenza primaria .hud-dock-btn-primary');
  console.log('✓ Dock cerimoniale perfettamente ancorata in BASSO AL CENTRO con pulsante Officina primario');

  // Asserzioni Bottom-Right (Cheats)
  if (!desktopInfo.cheatsZone) throw new Error('Zona trucchi #hud-cheats-zone non trovata');
  if (desktopInfo.cheatsZone.right < 1850) throw new Error(`Zona trucchi non a destra: right=${desktopInfo.cheatsZone.right}`);
  if (desktopInfo.cheatsZone.bottom < 1000) throw new Error(`Zona trucchi non in basso: bottom=${desktopInfo.cheatsZone.bottom}`);
  console.log('✓ Sigillo Trucchi perfettamente posizionato in BASSO A DESTRA');

  // Nessuna collisione con direttive a sinistra
  if (desktopInfo.directives && desktopInfo.directives.right >= desktopInfo.metricsCenter.left) {
    throw new Error(`Collisione tra direttive (${desktopInfo.directives.right}) e metriche (${desktopInfo.metricsCenter.left})`);
  }
  console.log('✓ Spaziatura perfetta: nessuna collisione tra Widget Direttive (top-left) e Metriche (top-center)');

  // Screenshot Desktop
  const scrDesktop = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'dds_qa_hud_desktop_layout.png'), Buffer.from(scrDesktop.data, 'base64'));
  console.log('✓ Screenshot Desktop salvato: dds_qa_hud_desktop_layout.png');

  // Interazioni Desktop
  console.log('\n--- Test Interazioni Dock e Sigillo Trucchi ---');
  // 1. Click Officina
  await evaluate(`document.querySelector('#btn-shop').click();`);
  await sleep(400);
  const shopOpen = await evaluate(`document.querySelector('.shop-container')?.classList.contains('open')`);
  if (!shopOpen) throw new Error('Click su #btn-shop non ha aperto il cassetto Officina');
  console.log('✓ Click su #btn-shop apre regolarmente il Negozio Officina');
  await evaluate(`document.querySelector('.shop-close-btn').click();`);
  await sleep(300);

  // 2. Click Sigillo Trucchi
  await evaluate(`document.querySelector('#btn-cheats-toggle').click();`);
  await sleep(400);
  const modalOpen = await evaluate(`!!document.querySelector('#modal-root .modal, .settings-modal')`);
  if (!modalOpen) throw new Error('Click su #btn-cheats-toggle non ha aperto il modale');
  console.log('✓ Click su #btn-cheats-toggle apre regolarmente il pannello Trucchi/Impostazioni');
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('#modal-root [data-action="close"], #modal-root .btn');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(300);

  // ----------------------------------------------------
  // TEST 2: TABLET TIER 2 (800x1280 Portrait & 1024x768 Landscape)
  // ----------------------------------------------------
  console.log('\n--- VERIFICA TIER 2: TABLET (1024x768) ---');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(300);

  const tabletInfo = await evaluate(`
    (() => {
      const dock = document.querySelector('#hud-bottom-dock');
      const cheats = document.querySelector('#hud-cheats-zone');
      const btnShop = document.querySelector('#btn-shop');
      const btnCheats = document.querySelector('#btn-cheats-toggle');
      const dRect = dock?.getBoundingClientRect();
      const cRect = cheats?.getBoundingClientRect();
      const shopRect = btnShop?.getBoundingClientRect();
      const cheatsRect = btnCheats?.getBoundingClientRect();

      return {
        touchTargetShop: shopRect ? { width: shopRect.width, height: shopRect.height } : null,
        touchTargetCheats: cheatsRect ? { width: cheatsRect.width, height: cheatsRect.height } : null,
        gapDockToCheats: (cRect && dRect) ? cRect.left - dRect.right : null,
      };
    })()
  `);
  console.log('Dettagli Tablet:', tabletInfo);
  if (!tabletInfo.touchTargetShop || tabletInfo.touchTargetShop.height < 44) {
    throw new Error(`Touch target Shop < 44px: ${tabletInfo.touchTargetShop?.height}`);
  }
  if (!tabletInfo.touchTargetCheats || tabletInfo.touchTargetCheats.height < 44) {
    throw new Error(`Touch target Cheats < 44px: ${tabletInfo.touchTargetCheats?.height}`);
  }
  if (tabletInfo.gapDockToCheats !== null && tabletInfo.gapDockToCheats < 12) {
    throw new Error(`Distanza dock - cheats insufficiente: ${tabletInfo.gapDockToCheats}px < 12px`);
  }
  console.log('✓ Touch targets >= 44px e separazione sicura thumb-zone su Tablet');

  const scrTablet = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'dds_qa_hud_tablet_layout.png'), Buffer.from(scrTablet.data, 'base64'));
  console.log('✓ Screenshot Tablet salvato: dds_qa_hud_tablet_layout.png');

  // ----------------------------------------------------
  // TEST 3: SMARTPHONE TIER 3 (390x844 - iPhone / Modern Android)
  // ----------------------------------------------------
  console.log('\n--- VERIFICA TIER 3: SMARTPHONE (390x844) ---');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(400);

  const mobileInfo = await evaluate(`
    (() => {
      const metrics = document.querySelector('#hud-metrics-center');
      const dock = document.querySelector('#hud-bottom-dock');
      const cheats = document.querySelector('#hud-cheats-zone');
      const directives = document.querySelector('#directives-root');

      const mRect = metrics?.getBoundingClientRect();
      const dRect = dock?.getBoundingClientRect();
      const cRect = cheats?.getBoundingClientRect();
      const dirRect = directives?.getBoundingClientRect();

      return {
        metricsWidth: mRect?.width,
        metricsWithinScreen: mRect ? mRect.right <= 390 && mRect.left >= 0 : false,
        dockWithinScreen: dRect ? dRect.bottom <= 844 : false,
        cheatsWithinScreen: cRect ? cRect.right <= 390 && cRect.bottom <= 844 : false,
        directivesBelowHeader: (dirRect && mRect) ? dirRect.top >= mRect.bottom : false,
        gapDockToCheats: (cRect && dRect) ? cRect.left - dRect.right : null,
      };
    })()
  `);
  console.log('Dettagli Smartphone:', mobileInfo);

  if (!mobileInfo.metricsWithinScreen) throw new Error('Metriche fuori dallo schermo mobile');
  if (!mobileInfo.dockWithinScreen) throw new Error('Dock fuori dallo schermo mobile');
  if (!mobileInfo.cheatsWithinScreen) throw new Error('Sigillo trucchi fuori dallo schermo mobile');
  console.log('✓ Tutti i componenti HUD rispettano safe areas e viewport mobile a 390px');

  const scrMobile = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'dds_qa_hud_smartphone_layout.png'), Buffer.from(scrMobile.data, 'base64'));
  console.log('✓ Screenshot Smartphone salvato: dds_qa_hud_smartphone_layout.png');

  // Controllo finale errori console
  console.log('\nErrori Console rilevati durante la sessione:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
    throw new Error(`Rilevati ${consoleErrors.length} errori console.`);
  }

  console.log('\n========================================================');
  console.log('  TUTTI I TEST BROWSER QA RISTRUTTURAZIONE HUD SUPERATI!');
  console.log('========================================================\n');

} catch (err) {
  console.error('[Browser QA Test Failure]', err);
  process.exitCode = 1;
} finally {
  ws.close();
  cleanup();
}

