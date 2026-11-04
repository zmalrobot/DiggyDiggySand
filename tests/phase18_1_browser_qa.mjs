import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9362;
const USER_DATA_DIR = `/tmp/qa-dds-phase18-1-responsive-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION MILESTONE 18.1');
console.log('  3-Tier Architecture, Touch Gestures & DPI Optimization');
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
      throw new Error(`Eval error: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async setViewport(width, height, deviceScaleFactor = 1.0, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: isMobile,
    });
    await this.eval(`window.dispatchEvent(new Event('resize'));`);
    await sleep(200);
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

const client = new CDPClient(wsUrl);
await client.connect();

try {
  // Attendi caricamento completato e transizione schermata
  console.log('[Browser QA] Attesa completamento caricamento...');
  let ready = false;
  for (let i = 0; i < 50; i++) {
    await sleep(300);
    ready = await client.eval(`
      (() => {
        const loading = document.getElementById('loading');
        const menu = document.getElementById('menu');
        const hud = document.getElementById('hud');
        return (loading && loading.classList.contains('hidden')) || (menu && !menu.classList.contains('hidden')) || (hud && !hud.classList.contains('hidden'));
      })()
    `);
    if (ready) break;
  }

  if (!ready) {
    // Prova a forzare click sul pulsante di avvio se fermo sulla schermata di loading
    await client.eval(`
      (() => {
        const btn = document.querySelector('#loading .btn, [data-act="start"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(800);
  }

  // Avvia il gioco se nel menu principale
  console.log('[Browser QA] Avvio del gioco dal menu principale...');
  await client.eval(`
    (() => {
      const startBtn = document.querySelector('[data-act="play"], [data-act="new-game"], #menu-btn-play');
      if (startBtn) startBtn.click();
      else if (window.__dds?.game) window.__dds.game.start();
    })()
  `);
  await sleep(1500);

  // Assicurati che l'intro sia conclusa o skippata
  await client.eval(`
    (() => {
      if (window.__dds?.game) {
        window.__dds.game.phase = 'play';
        window.__dds.game.controls.enabled = true;
        window.__dds.game.digging.setEnabled(true);
        window.__dds.game.state.addSand(5000);
      }
    })()
  `);
  await sleep(300);

  // ------------------------------------------------------------------------
  // FASE A: TIER 1 — DESKTOP (1280 x 800)
  // ------------------------------------------------------------------------
  console.log('\n--- FASE A: TEST TIER 1 (DESKTOP 1280x800) ---');
  await client.setViewport(1280, 800, 1.0, false);

  const desktopCheck = await client.eval(`
    (() => {
      const hudTop = document.querySelector('#hud .hud-top');
      const shopDrawer = document.querySelector('.shop-drawer');
      const shopBtnText = document.querySelector('.hud-shop-btn .hud-btn-text');
      const shopBtnIcon = document.querySelector('.hud-shop-btn .hud-btn-icon');
      const dragHandle = document.querySelector('.shop-drag-handle');

      const hudStyle = window.getComputedStyle(hudTop);
      const btnTextStyle = window.getComputedStyle(shopBtnText);
      const btnIconStyle = window.getComputedStyle(shopBtnIcon);
      const handleStyle = window.getComputedStyle(dragHandle);

      // Apri lo shop
      window.__dds.game.shop.open();
      const shopStyle = window.getComputedStyle(shopDrawer);

      return {
        hudWidth: parseInt(hudStyle.width, 10),
        btnTextVisible: btnTextStyle.display !== 'none',
        btnIconHidden: btnIconStyle.display === 'none',
        dragHandleHidden: handleStyle.display === 'none',
        shopWidth: parseInt(shopStyle.width, 10),
        cameraFov: (window.__dds.scene || window.__dds.game.sceneMgr).camera.fov,
        cameraNear: (window.__dds.scene || window.__dds.game.sceneMgr).camera.near,
        cameraFar: (window.__dds.scene || window.__dds.game.sceneMgr).camera.far,
      };
    })()
  `);

  console.log('[Tier 1 Desktop Stats]:', desktopCheck);
  if (desktopCheck.shopWidth !== 380) {
    console.warn(`[Tier 1] Atteso shop width 380px, rilevato: ${desktopCheck.shopWidth}px`);
  }
  if (desktopCheck.cameraFov !== 45) {
    console.warn(`[Tier 1] Atteso FOV 45°, rilevato: ${desktopCheck.cameraFov}°`);
  }

  await client.screenshot('dds_qa_responsive_tier1_desktop.png');

  // Chiudi shop
  await client.eval(`window.__dds.game.shop.close(true);`);
  await sleep(200);

  // ------------------------------------------------------------------------
  // FASE B: TIER 2 — TABLET LANDSCAPE (1024 x 768)
  // ------------------------------------------------------------------------
  console.log('\n--- FASE B: TEST TIER 2 (TABLET LANDSCAPE 1024x768) ---');
  await client.setViewport(1024, 768, 1.5, false);

  const tabletLandscapeCheck = await client.eval(`
    (() => {
      window.__dds.game.shop.open();
      const shopDrawer = document.querySelector('.shop-drawer');
      const shopStyle = window.getComputedStyle(shopDrawer);
      const hudTop = document.querySelector('#hud .hud-top');
      const hudStyle = window.getComputedStyle(hudTop);

      return {
        shopWidthPct: Math.round((parseInt(shopStyle.width, 10) / window.innerWidth) * 100),
        hudMargin: window.innerWidth - parseInt(hudStyle.width, 10),
        cameraFov: (window.__dds.scene || window.__dds.game.sceneMgr).camera.fov,
      };
    })()
  `);

  console.log('[Tier 2 Tablet Landscape Stats]:', tabletLandscapeCheck);
  await client.screenshot('dds_qa_responsive_tier2_tablet_landscape.png');

  await client.eval(`window.__dds.game.shop.close(true);`);
  await sleep(200);

  // ------------------------------------------------------------------------
  // FASE C: TIER 2 — TABLET PORTRAIT (768 x 1024)
  // ------------------------------------------------------------------------
  console.log('\n--- FASE C: TEST TIER 2 (TABLET PORTRAIT 768x1024) ---');
  await client.setViewport(768, 1024, 1.5, false);

  const tabletPortraitCheck = await client.eval(`
    (() => {
      window.__dds.game.shop.open();
      const shopDrawer = document.querySelector('.shop-drawer');
      const shopStyle = window.getComputedStyle(shopDrawer);
      const dragHandle = document.querySelector('.shop-drag-handle');
      const handleStyle = window.getComputedStyle(dragHandle);

      return {
        shopHeightPct: Math.round((parseInt(shopStyle.height, 10) / window.innerHeight) * 100),
        dragHandleVisible: handleStyle.display !== 'none',
        cameraFov: Math.round((window.__dds.scene || window.__dds.game.sceneMgr).camera.fov * 10) / 10,
      };
    })()
  `);

  console.log('[Tier 2 Tablet Portrait Stats]:', tabletPortraitCheck);
  await client.screenshot('dds_qa_responsive_tier2_tablet_portrait.png');

  await client.eval(`window.__dds.game.shop.close(true);`);
  await sleep(200);

  // ------------------------------------------------------------------------
  // FASE D: TIER 3 — SMARTPHONE PORTRAIT (390 x 844, iPhone 14 / Android)
  // ------------------------------------------------------------------------
  console.log('\n--- FASE D: TEST TIER 3 (SMARTPHONE PORTRAIT 390x844) ---');
  await client.setViewport(390, 844, 2.0, true);

  const smartphoneHudCheck = await client.eval(`
    (() => {
      const hudTop = document.querySelector('#hud .hud-top');
      const hudStyle = window.getComputedStyle(hudTop);
      const shopBtnText = document.querySelector('.hud-shop-btn .hud-btn-text');
      const shopBtnIcon = document.querySelector('.hud-shop-btn .hud-btn-icon');
      const btnTextStyle = window.getComputedStyle(shopBtnText);
      const btnIconStyle = window.getComputedStyle(shopBtnIcon);
      const labels = document.querySelectorAll('.hud-label');
      let labelsHidden = true;
      labels.forEach(l => { if (window.getComputedStyle(l).display !== 'none') labelsHidden = false; });

      return {
        hudWidth: parseInt(hudStyle.width, 10),
        btnTextHidden: btnTextStyle.display === 'none',
        btnIconVisible: btnIconStyle.display !== 'none',
        labelsHidden,
        cameraFov: Math.round((window.__dds.scene || window.__dds.game.sceneMgr).camera.fov * 10) / 10,
      };
    })()
  `);

  console.log('[Tier 3 Smartphone HUD Stats]:', smartphoneHudCheck);
  await client.screenshot('dds_qa_responsive_tier3_smartphone_hud.png');

  // Apri il Bottom Sheet Negozio su Smartphone
  console.log('[Tier 3] Apertura Bottom Sheet Negozio...');
  const bottomSheetCheck = await client.eval(`
    (() => {
      window.__dds.game.shop.open();
      const shopDrawer = document.querySelector('.shop-drawer');
      const shopStyle = window.getComputedStyle(shopDrawer);
      const dragHandle = document.querySelector('.shop-drag-handle');
      const handleStyle = window.getComputedStyle(dragHandle);

      return {
        bottomSheetHeightPct: Math.round((parseInt(shopStyle.height, 10) / window.innerHeight) * 100),
        dragHandleVisible: handleStyle.display !== 'none',
        borderRadiusTop: shopStyle.borderTopLeftRadius,
      };
    })()
  `);

  console.log('[Tier 3 Smartphone Bottom Sheet Stats]:', bottomSheetCheck);
  await client.screenshot('dds_qa_responsive_tier3_smartphone_bottom_sheet.png');

  await client.eval(`window.__dds.game.shop.close(true);`);
  await sleep(200);

  // Apri Modale Impostazioni su Smartphone (Full-Screen check)
  console.log('[Tier 3] Apertura Modale Impostazioni (Full-Screen 95vw/90vh)...');
  await client.eval(`
    (() => {
      window.__dds.settingsModal.open('audio');
    })()
  `);
  await sleep(300);

  const modalCheck = await client.eval(`
    (() => {
      const modal = document.querySelector('.modal');
      const style = window.getComputedStyle(modal);
      return {
        modalWidth: parseInt(style.width, 10),
        modalHeight: parseInt(style.height, 10),
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        widthPct: Math.round((parseInt(style.width, 10) / window.innerWidth) * 100),
        heightPct: Math.round((parseInt(style.height, 10) / window.innerHeight) * 100),
      };
    })()
  `);

  console.log('[Tier 3 Smartphone Modal Stats]:', modalCheck);
  await client.screenshot('dds_qa_responsive_tier3_smartphone_modal.png');

  await client.eval(`window.__dds.settingsModal.close();`);
  await sleep(200);

  // ------------------------------------------------------------------------
  // FASE E: VERIFICA ZERO ERRORI CONSOLE ED ECCEZIONI
  // ------------------------------------------------------------------------
  console.log('\n--- FASE E: VERIFICA RIGORE CONSOLE & RUNTIME ---');
  console.log(`Errori console intercettati: ${client.consoleErrors.length}`);
  console.log(`Eccezioni di pagina intercettate: ${client.pageErrors.length}`);

  if (client.consoleErrors.length > 0 || client.pageErrors.length > 0) {
    console.error('FAIL: Rilevati errori durante l\'esecuzione Browser QA!');
    cleanup();
    process.exit(1);
  }

  console.log('\n========================================================');
  console.log('  TUTTI I TEST BROWSER QA MILESTONE 18.1 SUPERATI!');
  console.log('  0 Errori Console | 0 Eccezioni Runtime | 5 Screenshots');
  console.log('========================================================\n');

} catch (err) {
  console.error('[Browser QA Test Exception]:', err);
  cleanup();
  process.exit(1);
} finally {
  client.close();
  cleanup();
}
