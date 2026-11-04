// Suite di Collaudo Browser QA Automatizzato per l'Hub di Meta-Progressione:
// Santuario Ancestrale (Spesa Tavolette τ), Guardaroba Cosmetico e Selettore Biomi.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9412;
const USER_DATA_DIR = `/tmp/qa-dds-metahub-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION META-PROGRESSION HUB');
console.log('  Sanctuary, Dune Wardrobe & Biome Selection Matrix');
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
    throw new Error(res.exceptionDetails.text || 'Evaluation failed');
  }
  return res.result?.value;
}

async function takeScreenshot(filePath) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
}

try {
  console.log('[Browser QA] Attesa schermata di caricamento…');
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

  await sleep(1000);

  console.log('[Browser QA] Attesa inizializzazione applicazione window.__dds…');
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    ready = await evaluate(`!!(window.__dds && window.__dds.menu && window.__dds.save)`);
    if (ready) break;
  }

  if (!ready) {
    throw new Error('Timeout: window.__dds non pronto.');
  }

  console.log('[Browser QA] Iniezione saldo Tavolette Antiche (τ 100) per test meta-progressione…');
  await evaluate(`
    window.__dds.save.addTablets(100);
    window.__dds.menu.refresh();
  `);

  const initialTablets = await evaluate(`window.__dds.save.getTablets()`);
  console.log(`[Browser QA] Saldo tavolette iniziali: τ ${initialTablets}`);

  // ========================================================
  // PASSO 1: Apertura e Test Santuario Ancestrale
  // ========================================================
  console.log('[Browser QA] 1. Apertura Santuario dei Predecessori dal Menu Principale…');
  await evaluate(`
    window.__dds.menu._sanctuary();
  `);
  await sleep(400);

  const sanctuaryState = await evaluate(`(() => {
    const dialog = document.querySelector('.sanctuary-container, .prestige-container');
    const cards = document.querySelectorAll('.sanctuary-card, .prestige-card');
    const currency = document.querySelector('.sanctuary-currency .currency-val, .prestige-currency .currency-val');
    return {
      isOpen: !!dialog,
      cardCount: cards.length,
      currencyText: currency ? currency.textContent.trim() : null,
    };
  })()`);

  console.log('[Browser QA] Stato Santuario:', sanctuaryState);
  if (!sanctuaryState.isOpen || sanctuaryState.cardCount !== 3) {
    throw new Error(`Santuario non aperto correttamente (cards=${sanctuaryState.cardCount})`);
  }

  // Acquisto Eco della Pala (shovelEcho)
  console.log('[Browser QA] Acquisto perk shovelEcho…');
  await evaluate(`(() => {
    const btn = document.querySelector('[data-meta-id="shovelEcho"]');
    if (btn) btn.click();
  })()`);
  await sleep(300);

  const postBuyTablets = await evaluate(`window.__dds.save.getTablets()`);
  const echoLvl = await evaluate(`window.__dds.save.getMetaUpgrades().shovelEcho`);
  console.log(`[Browser QA] Saldo dopo acquisto: τ ${postBuyTablets}, Livello Eco della Pala: Lv. ${echoLvl}`);
  if (echoLvl !== 1) {
    throw new Error(`Livello shovelEcho non aggiornato a 1 (attuale: ${echoLvl})`);
  }

  const sanctuaryShot = path.join(ARTIFACT_DIR, 'dds_qa_sanctuary_modal.png');
  await takeScreenshot(sanctuaryShot);
  console.log(`[Browser QA] Screenshot salvato: ${sanctuaryShot}`);

  // Chiusura Santuario
  await evaluate(`window.__dds.menu.sanctuaryModal.close();`);
  await sleep(300);

  // ========================================================
  // PASSO 2: Apertura e Test Guardaroba Cosmetico
  // ========================================================
  console.log('[Browser QA] 2. Apertura Guardaroba delle Dune…');
  await evaluate(`
    window.__dds.menu._wardrobe();
  `);
  await sleep(400);

  const wardrobeState = await evaluate(`(() => {
    const modal = document.querySelector('.wardrobe-modal');
    if (!modal) return { isOpen: false, tabCount: 0, itemCount: 0 };
    const tabs = modal.querySelectorAll('.tab');
    const cards = modal.querySelectorAll('.wardrobe-card');
    return {
      isOpen: true,
      tabCount: tabs.length,
      itemCount: cards.length,
    };
  })()`);

  console.log('[Browser QA] Stato Guardaroba:', wardrobeState);
  if (!wardrobeState.isOpen || wardrobeState.tabCount !== 3) {
    throw new Error(`Guardaroba non aperto correttamente (tabs=${wardrobeState.tabCount})`);
  }

  // Passa alla scheda Tinte di Sabbia (sand)
  console.log('[Browser QA] Cambio scheda a "Biomi Sabbia" e sblocco skin…');
  await evaluate(`(() => {
    const tabSand = document.querySelector('[data-tab="sand"]');
    if (tabSand) tabSand.click();
  })()`);
  await sleep(250);

  // Sblocca ed equipaggia Sabbia di Marte (sand_mars)
  await evaluate(`(() => {
    const cards = document.querySelectorAll('.wardrobe-card');
    for (const c of cards) {
      if (c.innerHTML.includes('Marte') || c.innerHTML.includes('Mars')) {
        const btn = c.querySelector('button');
        if (btn) btn.click();
        break;
      }
    }
  })()`);
  await sleep(300);

  const equippedSand = await evaluate(`window.__dds.cosmeticsManager.getEquipped('sand')`);
  console.log(`[Browser QA] Skin sabbia equipaggiata: ${equippedSand}`);

  const wardrobeShot = path.join(ARTIFACT_DIR, 'dds_qa_wardrobe_modal.png');
  await takeScreenshot(wardrobeShot);
  console.log(`[Browser QA] Screenshot salvato: ${wardrobeShot}`);

  // Chiusura Guardaroba
  await evaluate(`window.__dds.menu.wardrobeModal.close();`);
  await sleep(300);

  // ========================================================
  // PASSO 3: Selettore Biomi al click su Nuova Spedizione
  // ========================================================
  console.log('[Browser QA] 3. Apertura Selettore Biomi su "Nuova Spedizione"…');
  await evaluate(`
    window.__dds.menu.biomeSelectModal.open();
  `);
  await sleep(400);

  const biomeModalState = await evaluate(`(() => {
    const modal = document.querySelector('#biome-select-modal');
    const cards = document.querySelectorAll('.biome-card');
    const launchBtn = document.querySelector('#btn-confirm-biome');
    return {
      isOpen: modal && !modal.hidden,
      cardCount: cards.length,
      launchBtnText: launchBtn ? launchBtn.textContent.trim() : null,
    };
  })()`);

  console.log('[Browser QA] Stato Selettore Biomi:', biomeModalState);
  if (!biomeModalState.isOpen || biomeModalState.cardCount !== 4) {
    throw new Error(`Selettore biomi non aperto correttamente (cards=${biomeModalState.cardCount})`);
  }

  // Sblocco Oceano Prosciugato (10 τ)
  console.log('[Browser QA] Sblocco Oceano Prosciugato nel selettore…');
  await evaluate(`(() => {
    const oceanCard = document.querySelector('.biome-card[data-biome="ocean"]');
    if (oceanCard) {
      const unlockBtn = oceanCard.querySelector('[data-action="unlock"]');
      if (unlockBtn) unlockBtn.click();
    }
  })()`);
  await sleep(300);

  const isOceanUnlocked = await evaluate(`window.__dds.biomeManager.isUnlocked('ocean')`);
  const selectedBiome = await evaluate(`window.__dds.biomeManager.currentBiome`);
  console.log(`[Browser QA] Oceano sbloccato: ${isOceanUnlocked}, Bioma selezionato: ${selectedBiome}`);

  const biomeShot = path.join(ARTIFACT_DIR, 'dds_qa_biome_select_modal.png');
  await takeScreenshot(biomeShot);
  console.log(`[Browser QA] Screenshot salvato: ${biomeShot}`);

  // Avvia la spedizione nell'Oceano
  console.log('[Browser QA] Avvio spedizione con il bioma selezionato…');
  await evaluate(`(() => {
    const launchBtn = document.querySelector('#btn-confirm-biome');
    if (launchBtn) launchBtn.click();
  })()`);

  // Attendi che il mondo Three.js sia costruito e la fase sia play
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const phase = await evaluate(`window.__dds.game.phase`);
    if (phase === 'play') break;
  }

  const inGameCheck = await evaluate(`(() => {
    const g = window.__dds.game;
    return {
      phase: g.phase,
      currentBiome: g.state.currentBiome,
      hasTerrain: !!g.terrain,
      hasWorkers: !!g.workers,
      sandMultiplier: g.state.sandMultiplier,
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
    };
  })()`);

  console.log('[Browser QA] Verifica In-Game:', inGameCheck);
  if (inGameCheck.phase !== 'play' || !inGameCheck.hasTerrain || !inGameCheck.hudVisible) {
    throw new Error('Spedizione non avviata correttamente in Three.js');
  }

  // Verifica finale errori console
  console.log(`[Browser QA] Errori console rilevati: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('[Browser QA] ERRORI:', consoleErrors);
    throw new Error(`Rilevati ${consoleErrors.length} errori di console!`);
  }

  console.log('========================================================');
  console.log('  TEST BROWSER QA META-PROGRESSION HUB COMPLETATO CON 0 ERRORI!');
  console.log('========================================================');
} catch (err) {
  console.error('[Browser QA] FALLIMENTO TEST:', err);
  process.exitCode = 1;
} finally {
  cleanup();
}
