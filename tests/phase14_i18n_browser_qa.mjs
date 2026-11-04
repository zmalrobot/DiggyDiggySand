import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9355;
const USER_DATA_DIR = `/tmp/qa-dds-phase14-i18n-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('   DIGGY DIGGY SAND - QA AUTOMATION PHASE 14 i18n TEST');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Start Headless Chrome
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
  // Attesa che il loading screen presenti il pulsante di avvio
  console.log('[Browser QA] In attesa del caricamento asset e del pulsante di avvio...');
  let ready = false;
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
        ready = true;
        break;
      }
    } catch {}
  }

  // Attesa che il gioco completi il boot ed entri nel menu principale
  console.log('[Browser QA] In attesa di window.__dds e del menu principale...');
  let loaded = false;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const isReady = await cdp.eval(`
      !!(window.__dds && window.__dds.scene && window.__dds.scene.ok && window.__dds.menu && window.__dds.game)
    `);
    if (isReady) {
      loaded = true;
      break;
    }
  }

  if (!loaded) throw new Error('Timeout in attesa dell\'inizializzazione di window.__dds');
  console.log('✓ Boot completato con successo.');

  // 1. Verifica Main Menu in Italiano di Default
  const menuTitle = await cdp.eval(`document.querySelector('.menu-title')?.textContent?.trim()`);
  const newGameBtn = await cdp.eval(`document.querySelector('[data-act="new"]')?.textContent?.trim()`);
  const settingsBtn = await cdp.eval(`document.querySelector('[data-act="settings"]')?.textContent?.trim()`);

  console.log(`[Main Menu IT] Titolo: "${menuTitle}", Nuova Spedizione: "${newGameBtn}", Impostazioni: "${settingsBtn}"`);
  if (!newGameBtn.includes('Nuova Spedizione')) {
    throw new Error(`Main menu non in italiano: atteso 'Nuova Spedizione', trovato '${newGameBtn}'`);
  }
  console.log('✓ 1. Menu principale renderizzato in Italiano di default.');

  await cdp.screenshot('dds_qa_i18n_menu_it.png');

  // 2. Apri Impostazioni e verifica tab e titolo
  console.log('[Browser QA] Apertura modale Impostazioni...');
  await cdp.eval(`window.__dds.settingsModal.open()`);
  await sleep(400);

  const modalTitleIt = await cdp.eval(`document.querySelector('.modal-title')?.textContent?.trim()`);
  const activeTabIt = await cdp.eval(`document.querySelector('.settings-modal .tab.active')?.textContent?.trim()`);
  console.log(`[Settings Modal IT] Titolo: "${modalTitleIt}", Tab attiva: "${activeTabIt}"`);
  if (modalTitleIt !== 'Impostazioni') throw new Error(`Titolo impostazioni errato in IT: ${modalTitleIt}`);

  // Seleziona la scheda Dati & Lingua
  await cdp.eval(`
    const tab = Array.from(document.querySelectorAll('.settings-modal .tab')).find(t => t.dataset.tab === 'data');
    tab?.click();
  `);
  await sleep(300);

  // 3. Switch Lingua: Italiano -> English in tempo reale
  console.log('[Browser QA] Cambio lingua a "English"...');
  await cdp.eval(`
    window.__dds.settings.set('game.language', 'en');
  `);
  await sleep(400);

  const modalTitleEn = await cdp.eval(`document.querySelector('.modal-title')?.textContent?.trim()`);
  const tabsEn = await cdp.eval(`
    Array.from(document.querySelectorAll('.settings-modal .tab')).map(t => t.textContent.trim())
  `);
  const closeBtnText = await cdp.eval(`document.querySelector('.modal-actions .btn')?.textContent?.trim()`);

  console.log(`[Settings Modal EN] Titolo: "${modalTitleEn}", Tabs: ${JSON.stringify(tabsEn)}, Close btn: "${closeBtnText}"`);
  if (modalTitleEn !== 'Settings') throw new Error(`Titolo impostazioni non aggiornato in EN: ${modalTitleEn}`);
  if (closeBtnText !== 'Close') throw new Error(`Pulsante chiudi non aggiornato in EN: ${closeBtnText}`);
  if (!tabsEn.includes('Data & Language') || !tabsEn.includes('Audio') || !tabsEn.includes('Graphics')) {
    throw new Error(`Tab impostazioni non tradotte in EN: ${JSON.stringify(tabsEn)}`);
  }
  console.log('✓ 2. Modale Impostazioni ri-renderizzata istantaneamente in Inglese senza reload!');

  await cdp.screenshot('dds_qa_i18n_settings_en.png');

  // 4. Chiudi modale e verifica Main Menu tradotto in Inglese
  console.log('[Browser QA] Chiusura impostazioni e verifica Main Menu in English...');
  await cdp.eval(`window.__dds.settingsModal.close()`);
  await sleep(300);

  const newGameBtnEn = await cdp.eval(`document.querySelector('[data-act="new"]')?.textContent?.trim()`);
  const settingsBtnEn = await cdp.eval(`document.querySelector('[data-act="settings"]')?.textContent?.trim()`);
  const galleryBtnEn = await cdp.eval(`document.querySelector('[data-act="gallery"]')?.textContent?.trim()`);

  console.log(`[Main Menu EN] Nuova Spedizione: "${newGameBtnEn}", Impostazioni: "${settingsBtnEn}", Finali: "${galleryBtnEn}"`);
  if (!newGameBtnEn.includes('New Expedition')) throw new Error(`Nuova Spedizione non tradotta: ${newGameBtnEn}`);
  if (!settingsBtnEn.includes('Settings')) throw new Error(`Impostazioni non tradotte: ${settingsBtnEn}`);
  console.log('✓ 3. Main Menu reattivo: tutti i pulsanti aggiornati in Inglese.');

  // 5. Avvia Spedizione e verifica HUD & Shop in English
  console.log('[Browser QA] Avvio Spedizione in English...');
  await cdp.eval(`window.__dds.menu.startNewExpedition('desert')`);
  await sleep(800);

  const hudSandLabel = await cdp.eval(`document.querySelector('.hud-sand .hud-label')?.textContent?.trim()`);
  const hudProgressLabel = await cdp.eval(`document.querySelector('.hud-progress .hud-label')?.textContent?.trim()`);
  const hudWorkshopBtn = await cdp.eval(`document.querySelector('[data-act="shop"]')?.textContent?.trim()`);
  const hudPauseBtn = await cdp.eval(`document.querySelector('[data-act="menu"]')?.textContent?.trim()`);

  console.log(`[HUD EN] Sand: "${hudSandLabel}", Progress: "${hudProgressLabel}", Workshop: "${hudWorkshopBtn}", Pause: "${hudPauseBtn}"`);
  if (hudSandLabel !== 'Sand') throw new Error(`Etichetta Sand errata: ${hudSandLabel}`);
  if (hudProgressLabel !== 'Excavated Desert') throw new Error(`Etichetta progresso errata: ${hudProgressLabel}`);
  if (hudWorkshopBtn !== 'Workshop') throw new Error(`Pulsante Officina errato: ${hudWorkshopBtn}`);

  await cdp.screenshot('dds_qa_i18n_hud_en.png');

  // Apri Negozio
  console.log('[Browser QA] Apertura Negozio in English...');
  await cdp.eval(`window.__dds.game.shop.open()`);
  await sleep(400);

  const shopTitle = await cdp.eval(`document.querySelector('.shop-title')?.textContent?.trim()`);
  const shopTabManual = await cdp.eval(`document.querySelector('.shop-tabs .tab[data-tab="manual"]')?.textContent?.trim()`);
  const firstUpgradeName = await cdp.eval(`document.querySelector('.upgrade-card .upgrade-name')?.textContent?.trim()`);
  const buyBtnTextShop = await cdp.eval(`document.querySelector('.upgrade-card .buy-action')?.textContent?.trim()`);

  console.log(`[Shop EN] Titolo: "${shopTitle}", Tab Manual: "${shopTabManual}", Primo Upgrade: "${firstUpgradeName}", Buy: "${buyBtnTextShop}"`);
  if (shopTitle !== 'Dune Workshop') throw new Error(`Titolo negozio errato: ${shopTitle}`);
  if (shopTabManual !== 'Manual Tools') throw new Error(`Tab strumenti errata: ${shopTabManual}`);
  if (firstUpgradeName !== 'Orichalcum Shovel') throw new Error(`Nome pala errato: ${firstUpgradeName}`);
  if (buyBtnTextShop !== 'Buy') throw new Error(`Testo acquisto errato: ${buyBtnTextShop}`);

  await cdp.screenshot('dds_qa_i18n_shop_en.png');

  await cdp.eval(`window.__dds.game.shop.close(true)`);
  await sleep(300);

  // 6. Ritorno dinamico in-game ad Italiano
  console.log('[Browser QA] Cambio lingua in-game tornando ad Italiano...');
  await cdp.eval(`window.__dds.settings.set('game.language', 'it')`);
  await sleep(300);

  const hudSandIt = await cdp.eval(`document.querySelector('.hud-sand .hud-label')?.textContent?.trim()`);
  const hudProgressIt = await cdp.eval(`document.querySelector('.hud-progress .hud-label')?.textContent?.trim()`);
  const hudWorkshopIt = await cdp.eval(`document.querySelector('[data-act="shop"]')?.textContent?.trim()`);

  console.log(`[HUD Re-IT] Sabbia: "${hudSandIt}", Progresso: "${hudProgressIt}", Officina: "${hudWorkshopIt}"`);
  if (hudSandIt !== 'Sabbia') throw new Error(`HUD non tornato a 'Sabbia': ${hudSandIt}`);
  if (hudProgressIt !== 'Deserto scavato') throw new Error(`HUD non tornato a 'Deserto scavato': ${hudProgressIt}`);
  if (hudWorkshopIt !== 'Officina') throw new Error(`HUD non tornato a 'Officina': ${hudWorkshopIt}`);

  await cdp.screenshot('dds_qa_i18n_hud_re_it.png');
  console.log('✓ 4. Ciclo bilingue IT -> EN -> IT in-game completato con successo!');

  // 7. Verifica errori console e page exceptions
  console.log('[Browser QA] Verifica log di runtime...');
  if (cdp.consoleErrors.length > 0) {
    throw new Error(`Rilevati ${cdp.consoleErrors.length} errori di console: ${cdp.consoleErrors.join('; ')}`);
  }
  if (cdp.pageErrors.length > 0) {
    throw new Error(`Rilevate ${cdp.pageErrors.length} eccezioni di pagina: ${cdp.pageErrors.join('; ')}`);
  }
  console.log('✓ 0 errori console e 0 eccezioni pagina verificati (Regola 8).');

  console.log('========================================================');
  console.log('   TUTTI I TEST BROWSER QA DELLA FASE 14 I18N SUPERATI!');
  console.log('========================================================');

} finally {
  cdp.close();
  cleanup();
}
