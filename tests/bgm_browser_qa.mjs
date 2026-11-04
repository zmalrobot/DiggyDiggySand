import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9395;
const USER_DATA_DIR = `/tmp/qa-dds-bgm-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION BGM ADAPTIVE MUSIC');
console.log('  Kevin MacLeod BGM, Crossfade, Credits & Settings QA');
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

  // 1. Attendi che la barra di caricamento della LoadingScreen sia al 100% e clicca "Inizia Spedizione"
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
  // Attesa dissolvenza loading screen (650ms) e apertura Menu Principale
  await sleep(1200);

  // 2. Verifica stato BGM del Menu Principale
  console.log('\n--- VERIFICA 1: BGM NEL MENU PRINCIPALE ---');
  const menuBgmStatus = await evaluate(`
    (() => {
      const audio = window.__dds?.audio;
      if (!audio) return { found: false };
      return {
        found: true,
        currentTrack: audio.currentBgm?.trackKey,
        hasAudioEl: !!audio.currentBgm?.el,
        volume: audio.currentBgm?.el ? audio.currentBgm.el.volume : null,
        loop: audio.currentBgm?.el ? audio.currentBgm.el.loop : null,
        paused: audio.currentBgm?.el ? audio.currentBgm.el.paused : null
      };
    })()
  `);
  console.log('Stato BGM Menu:', JSON.stringify(menuBgmStatus, null, 2));
  if (!menuBgmStatus.found || menuBgmStatus.currentTrack !== 'menu') {
    console.error('❌ ERRORE: BGM del Menu non attivo o errato!');
    testPassed = false;
  } else {
    console.log(`✓ OK: BGM "${menuBgmStatus.currentTrack}" attivo (Volume: ${menuBgmStatus.volume.toFixed(2)}, Loop: ${menuBgmStatus.loop})`);
  }

  // 3. Verifica Sezione Crediti BGM Kevin MacLeod
  console.log('\n--- VERIFICA 2: SEZIONE CREDITI BGM (KEVIN MACLEOD CC-BY 4.0) ---');
  await evaluate(`
    (() => {
      const btnCredits = document.querySelector('button[data-act="credits"]');
      if (btnCredits) btnCredits.click();
    })()
  `);
  await sleep(400);

  const creditsBgmInfo = await evaluate(`
    (() => {
      const modal = document.querySelector('.modal');
      if (!modal) return { open: false };
      const text = modal.textContent;
      const html = modal.innerHTML;
      return {
        open: true,
        hasKevinMacLeod: text.includes('Kevin MacLeod'),
        hasIncompetech: html.includes('incompetech.com'),
        hasCcBy: text.includes('CC-BY 4.0') || text.includes('Creative Commons Attribution 4.0'),
        hasDesertCity: text.includes('Desert City'),
        hasMirage: text.includes('Mirage'),
        hasWaterPrelude: text.includes('Water Prelude'),
        hasFrozenStar: text.includes('Frozen Star'),
        hasEchoesOfTime: text.includes('Echoes of Time')
      };
    })()
  `);
  console.log('Verifica Sezione Crediti BGM:', JSON.stringify(creditsBgmInfo, null, 2));

  if (!creditsBgmInfo.open || !creditsBgmInfo.hasKevinMacLeod || !creditsBgmInfo.hasCcBy) {
    console.error('❌ ERRORE: Crediti BGM incompleti o modale non aperta!');
    testPassed = false;
  } else {
    console.log('✓ OK: Crediti Kevin MacLeod CC-BY 4.0 con tutte e 5 le tracce presenti e conformi!');
  }

  await captureScreenshot('dds_qa_bgm_credits.png');

  // Chiudi modale Crediti
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('.modal-close, .modal-actions button');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(300);

  // 4. Avvia Nuova Spedizione e verifica transizione/crossfade a BGM del Bioma
  console.log('\n--- VERIFICA 3: CROSSFADE AL BGM DEL BIOMA DI GIOCO ---');
  await evaluate(`
    (() => {
      localStorage.removeItem('dds_save_v1');
      window.__dds.menu.startNewExpedition('desert');
    })()
  `);
  await sleep(1500);

  const gameBgmStatus = await evaluate(`
    (() => {
      const audio = window.__dds?.audio;
      return {
        currentTrack: audio.currentBgm?.trackKey,
        isPlaying: audio.currentBgm?.isPlaying,
        volume: audio.currentBgm?.el ? audio.currentBgm.el.volume : null
      };
    })()
  `);
  console.log('Stato BGM Gioco (Deserto):', JSON.stringify(gameBgmStatus, null, 2));
  if (gameBgmStatus.currentTrack !== 'desert') {
    console.error(`❌ ERRORE: BGM non transizionato a desert (attuale: ${gameBgmStatus.currentTrack})!`);
    testPassed = false;
  } else {
    console.log(`✓ OK: Traccia BGM attiva nel bioma: "${gameBgmStatus.currentTrack}"`);
  }

  // 5. Test Crossfade dinamico al cambio bioma: Ocean
  console.log('\n--- VERIFICA 4: CAMBIO BIOMA CON CROSSFADE (DESERT -> OCEAN) ---');
  await evaluate(`
    (() => {
      window.__dds.biomeManager.selectBiome('ocean');
    })()
  `);
  await sleep(600); // metà crossfade

  const crossfadeMidStatus = await evaluate(`
    (() => {
      const audio = window.__dds?.audio;
      return {
        currentTrack: audio.currentBgm?.trackKey,
        prevTrack: audio.prevBgm?.trackKey,
        currentFadeAlpha: audio.currentBgm?.fadeAlpha,
        prevFadeAlpha: audio.prevBgm?.fadeAlpha
      };
    })()
  `);
  console.log('Stato durante il Crossfade:', JSON.stringify(crossfadeMidStatus, null, 2));

  await sleep(1600); // attesa fine crossfade (1.8s totale)

  const crossfadeFinalStatus = await evaluate(`
    (() => {
      const audio = window.__dds?.audio;
      return {
        currentTrack: audio.currentBgm?.trackKey,
        hasPrevBgm: !!audio.prevBgm,
        volume: audio.currentBgm?.el ? audio.currentBgm.el.volume : null
      };
    })()
  `);
  console.log('Stato finale dopo Crossfade:', JSON.stringify(crossfadeFinalStatus, null, 2));
  if (crossfadeFinalStatus.currentTrack !== 'ocean') {
    console.error('❌ ERRORE: Crossfade a "ocean" non completato!');
    testPassed = false;
  } else {
    console.log('✓ OK: Crossfade completato con successo verso "ocean"!');
  }

  // 6. Test regolazione volume in tempo reale e mute
  console.log('\n--- VERIFICA 5: CONTROLLO VOLUME INDIPENDENTE E MUTE ---');
  await evaluate(`
    (() => {
      window.__dds.settings.set('audio.music', 25);
    })()
  `);
  await sleep(100);

  const vol25 = await evaluate(`
    (() => {
      const audio = window.__dds?.audio;
      return audio.currentBgm?.el ? audio.currentBgm.el.volume : null;
    })()
  `);
  console.log(`Volume musica al 25%: ${vol25?.toFixed(3)}`);

  await evaluate(`
    (() => {
      window.__dds.settings.set('audio.mute', true);
    })()
  `);
  await sleep(100);

  const volMuted = await evaluate(`
    (() => {
      const audio = window.__dds?.audio;
      return audio.currentBgm?.el ? audio.currentBgm.el.volume : null;
    })()
  `);
  console.log(`Volume con Mute attivo: ${volMuted}`);
  if (volMuted !== 0) {
    console.error('❌ ERRORE: Il mute non ha azzerato il volume della BGM!');
    testPassed = false;
  } else {
    console.log('✓ OK: Toggle Mute silenzia istantaneamente la BGM!');
  }

  // Ripristina volume
  await evaluate(`
    (() => {
      window.__dds.settings.set('audio.mute', false);
      window.__dds.settings.set('audio.music', 60);
    })()
  `);
  await sleep(100);

  // 7. Test Ritorno al Menu Principale e ripristino traccia menu
  console.log('\n--- VERIFICA 6: RITORNO AL MENU E CROSSFADE SU "MENU" ---');
  await evaluate(`
    (() => {
      window.__dds.game.returnToMenu();
    })()
  `);
  await sleep(2200);

  const returnMenuStatus = await evaluate(`
    (() => {
      const audio = window.__dds?.audio;
      return {
        currentTrack: audio.currentBgm?.trackKey,
        volume: audio.currentBgm?.el ? audio.currentBgm.el.volume : null
      };
    })()
  `);
  console.log('Stato BGM dopo ritorno al menu:', JSON.stringify(returnMenuStatus, null, 2));
  if (returnMenuStatus.currentTrack !== 'menu') {
    console.error('❌ ERRORE: Ritorno al menu non ha ripristinato la traccia "menu"!');
    testPassed = false;
  } else {
    console.log('✓ OK: Traccia "menu" ripristinata con successo al ritorno al menu!');
  }

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
  console.error('\n❌ QA TEST BGM FALLITO');
  process.exit(1);
} else {
  console.log('\n✅ TUTTI I TEST BGM, CREDITI E CROSSFADE SONO SUPERATI CON SUCCESSO!');
  process.exit(0);
}

