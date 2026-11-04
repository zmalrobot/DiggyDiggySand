import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9368;
const USER_DATA_DIR = `/tmp/qa-dds-phase19-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION PHASE 19');
console.log('  Directives, Accessibility (Reduced Motion), Help & Credits');
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
  // Attesa iniziale del caricamento asset e del pulsante "Inizia Spedizione"
  console.log('[Browser QA] Attesa del completamento del caricamento asset...');
  await sleep(2500);

  const startBtnExists = await cdp.eval(`
    (() => {
      const btn = document.querySelector('#loading .btn, [data-act="start"]');
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);
  console.log('[Browser QA] Click schermata di avvio:', startBtnExists);

  await sleep(1500);

  // 1. Verifica Modale Aiuto dal Menu Principale
  console.log('[Browser QA] 1. Apertura Modale Aiuto & Comandi dal Menu Principale...');
  const helpOpened = await cdp.eval(`
    (() => {
      const btn = document.querySelector('[data-act="help"]');
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);
  console.log('[Browser QA] Click tasto Aiuto:', helpOpened);
  await sleep(600);

  const helpRendered = await cdp.eval(`
    (() => {
      const modal = document.querySelector('#modal-root .modal');
      const content = modal?.querySelector('.help-modal-content');
      const desktop = content?.querySelector('.help-section');
      return !!(modal && content && desktop);
    })()
  `);
  console.log('[Browser QA] Contenuto HelpModal renderizzato:', helpRendered);
  if (!helpRendered) throw new Error('HelpModal non renderizzato correttamente');

  await cdp.screenshot('dds_qa_phase19_help_modal.png');

  // Chiusura HelpModal
  await cdp.eval(`
    (() => {
      const closeBtn = document.querySelector('#modal-root .modal-actions .btn, #modal-root [data-act="close"]');
      closeBtn?.click();
    })()
  `);
  await sleep(400);

  // 2. Verifica Modale Crediti dal Menu Principale
  console.log('[Browser QA] 2. Apertura Modale Crediti & Risorse Open Source...');
  const creditsOpened = await cdp.eval(`
    (() => {
      const btn = document.querySelector('[data-act="credits"]');
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);
  console.log('[Browser QA] Click tasto Crediti:', creditsOpened);
  await sleep(600);

  const creditsRendered = await cdp.eval(`
    (() => {
      const modal = document.querySelector('#modal-root .modal');
      const banner = modal?.querySelector('.credits-header-banner');
      const links = modal?.querySelectorAll('.credits-link');
      return !!(modal && banner && links?.length >= 3);
    })()
  `);
  console.log('[Browser QA] Contenuto CreditsModal renderizzato con link licenze:', creditsRendered);
  if (!creditsRendered) throw new Error('CreditsModal non renderizzato con link licenze open source');

  await cdp.screenshot('dds_qa_phase19_credits_modal.png');

  // Chiusura CreditsModal
  await cdp.eval(`
    (() => {
      const closeBtn = document.querySelector('#modal-root .modal-actions .btn, #modal-root [data-act="close"]');
      closeBtn?.click();
    })()
  `);
  await sleep(400);

  // 3. Avvio Nuova Spedizione per entrare nel mondo di gioco
  console.log('[Browser QA] 3. Avvio Nuova Spedizione...');
  await cdp.eval(`
    (() => {
      if (window.__dds?.menu) {
        window.__dds.menu.startNewExpedition();
      } else if (window.__dds?.game) {
        window.__dds.game.start();
      }
    })()
  `);
  await sleep(2500);

  // 4. Verifica Widget Direttive di Spedizione nell'HUD
  console.log('[Browser QA] 4. Verifica Widget Direttive di Spedizione...');
  const widgetStatus = await cdp.eval(`
    (() => {
      const root = document.querySelector('#directives-root');
      const card = root?.querySelector('.directives-card');
      const title = card?.querySelector('.directives-title')?.textContent;
      const progress = card?.querySelector('.directives-progress-text')?.textContent;
      const bar = card?.querySelector('.directives-bar-fill');
      const toggle = card?.querySelector('.directives-toggle-btn');
      return {
        hasRoot: !!root,
        hasCard: !!card,
        isShown: !root?.classList?.contains('hidden'),
        title: title || '',
        progress: progress || '',
        barWidth: bar?.style?.width || '0%',
        hasToggle: !!toggle,
      };
    })()
  `);
  console.log('[Browser QA] Stato Widget Direttive:', widgetStatus);
  if (!widgetStatus.hasRoot || !widgetStatus.hasCard || !widgetStatus.isShown) {
    throw new Error('Widget Direttive non visibile o non renderizzato in gioco');
  }

  await cdp.screenshot('dds_qa_phase19_directives_widget.png');

  // Test minimizzazione/espansione (toggle button)
  console.log('[Browser QA] Test toggle collapse widget direttive...');
  const isCollapsedAfterClick = await cdp.eval(`
    (() => {
      const toggle = document.querySelector('#directives-root .directives-toggle-btn');
      toggle?.click();
      return document.querySelector('#directives-root .directives-card')?.classList.contains('collapsed');
    })()
  `);
  console.log('[Browser QA] Widget collassato:', isCollapsedAfterClick);
  if (!isCollapsedAfterClick) throw new Error('Il pulsante di toggle non ha collassato il widget direttive');

  // Ri-espandi
  await cdp.eval(`document.querySelector('#directives-root .directives-toggle-btn')?.click();`);
  await sleep(300);

  // 5. Verifica Pulsante Aiuto nell'HUD di gioco
  console.log('[Browser QA] 5. Test pulsante Aiuto (?) nell\'HUD...');
  const hudHelpClicked = await cdp.eval(`
    (() => {
      const btn = document.querySelector('#hud .hud-help-btn, [data-act="help"]');
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);
  console.log('[Browser QA] Click tasto Aiuto HUD:', hudHelpClicked);
  await sleep(500);

  const inGameHelpModal = await cdp.eval(`
    (() => {
      const modal = document.querySelector('#modal-root .modal');
      return !!modal?.querySelector('.help-modal-content');
    })()
  `);
  console.log('[Browser QA] HelpModal aperta in-game:', inGameHelpModal);
  if (!inGameHelpModal) throw new Error('HelpModal non si apre tramite il pulsante HUD (?)');

  // Chiudi
  await cdp.eval(`document.querySelector('#modal-root .modal-actions .btn')?.click();`);
  await sleep(400);

  // 6. Verifica Modalità "Riduzione Movimento" (Reduced Motion) nelle Impostazioni Grafiche
  console.log('[Browser QA] 6. Test Riduzione Movimento nelle Impostazioni Grafiche...');
  await cdp.eval(`window.__dds?.settingsModal?.open?.()`);
  await sleep(500);

  // Passa alla tab Grafica
  await cdp.eval(`
    (() => {
      const tabs = document.querySelectorAll('#modal-root .tab');
      for (const t of tabs) {
        if (t.dataset.tab === 'graphics' || t.textContent.includes('Grafica') || t.textContent.includes('Graphics')) {
          t.click();
          break;
        }
      }
    })()
  `);
  await sleep(400);

  const reducedMotionToggle = await cdp.eval(`
    (() => {
      const toggle = document.querySelector('#modal-root input[name="accessibility.reducedMotion"]');
      if (toggle) {
        toggle.click();
        return {
          found: true,
          checked: toggle.checked,
          htmlHasClass: document.documentElement.classList.contains('reduced-motion'),
          bodyHasClass: document.body.classList.contains('reduced-motion'),
        };
      }
      return { found: false };
    })()
  `);
  console.log('[Browser QA] Toggle Riduzione Movimento:', reducedMotionToggle);
  if (!reducedMotionToggle.found || !reducedMotionToggle.htmlHasClass) {
    throw new Error('Toggle Reduced Motion non applica la classe .reduced-motion a <html>');
  }

  await cdp.screenshot('dds_qa_phase19_reduced_motion.png');

  // Chiudi SettingsModal
  await cdp.eval(`document.querySelector('#modal-root .modal-close')?.click() || window.__dds?.settingsModal?.close?.()`);
  await sleep(400);

  // 7. Audit Console Errors & Exceptions
  console.log('[Browser QA] 7. Verifica errori di pagina e console...');
  console.log(`[Browser QA] Console Errors: ${cdp.consoleErrors.length}`);
  console.log(`[Browser QA] Page Exceptions: ${cdp.pageErrors.length}`);

  if (cdp.consoleErrors.length > 0 || cdp.pageErrors.length > 0) {
    throw new Error(`Rilevati errori nel browser: ${cdp.consoleErrors.length} errori console, ${cdp.pageErrors.length} eccezioni`);
  }

  console.log('========================================================');
  console.log('  TUTTI I TEST BROWSER QA FASE 19 SUPERATI AL 100%!');
  console.log('  0 Errori Console, 0 Eccezioni Pagina, UI Validata.');
  console.log('========================================================');

} catch (err) {
  console.error('[Browser QA FAILED]', err);
  process.exitCode = 1;
} finally {
  cleanup();
}
