// Suite di Collaudo Browser QA Automatizzato per:
// - Galleria Finali Scoperti (EndingsModal / Codex)
// - Registro Statistiche di Carriera e Scheda Trofei con Lockout Trucchi (StatsModal)
// - Toast Notifica Visiva & Sonora dei Trofei (AchievementToast)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9412;
const USER_DATA_DIR = `/tmp/qa-dds-achievements-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION TROPHIES, STATS & ENDINGS');
console.log('  Codex Finali, Registro Statistiche, Trofei & Toast Animato');
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

  // 1. Attesa LoadingScreen e click Inizia Spedizione
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
      console.log('Pulsante avvio schermata iniziale premuto.');
      break;
    }
    await sleep(200);
  }

  await sleep(1000);

  // 2. Collaudo Galleria Finali (EndingsModal / Codex)
  console.log('Apertura Galleria Finali Scoperti dal Menu Principale...');
  const openedEndings = await evaluate(`
    (() => {
      // Inietta due finali sbloccati per testare sia lo stato unlocked che locked
      const save = window.__dds?.save;
      if (save) {
        save.recordEnding('curse', 'desert');
        save.recordEnding('treasure', 'ocean');
      }
      const btn = document.querySelector('[data-act="gallery"]') ||
                  document.querySelector('[data-act="endings"]') ||
                  Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Finali') || b.textContent.includes('Endings'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()
  `);

  if (!openedEndings) {
    throw new Error('Pulsante Galleria Finali non trovato nel Menu Principale!');
  }

  await sleep(600);

  const endingsModalInfo = await evaluate(`
    (() => {
      const modal = document.querySelector('.endings-modal-container') ||
                    document.querySelector('.gallery-container') ||
                    document.querySelector('#modal-root .modal');
      const cards = document.querySelectorAll('.ending-card');
      const lockedCards = document.querySelectorAll('.ending-card.locked');
      const unlockedCards = document.querySelectorAll('.ending-card.unlocked');
      return {
        hasModal: !!modal,
        cardCount: cards.length,
        lockedCount: lockedCards.length,
        unlockedCount: unlockedCards.length,
      };
    })()
  `);

  console.log('Stato Galleria Finali:', endingsModalInfo);
  if (!endingsModalInfo.hasModal || endingsModalInfo.cardCount !== 4) {
    throw new Error(`Galleria Finali incompleta o errata (card trovate: ${endingsModalInfo.cardCount})`);
  }

  await captureScreenshot('dds_qa_endings_modal.png');

  // Chiudi Galleria Finali
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('#modal-root .modal-btn') ||
                       document.querySelector('#modal-root .modal-close');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(400);

  // 3. Collaudo Registro Statistiche & Trofei (StatsModal)
  console.log('Apertura Registro Statistiche & Trofei dal Menu Principale...');
  const openedStats = await evaluate(`
    (() => {
      const btn = document.querySelector('[data-act="stats"]') ||
                  Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Statistiche') || b.textContent.includes('Stats'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()
  `);

  if (!openedStats) {
    throw new Error('Pulsante Statistiche & Trofei non trovato nel Menu Principale!');
  }

  await sleep(600);

  // Verifica Tab Carriera (9 metriche)
  const statsInfo = await evaluate(`
    (() => {
      const modal = document.querySelector('.stats-modal');
      const statCards = document.querySelectorAll('.stats-grid .stat-card');
      const tabs = document.querySelectorAll('.stats-modal .tab');
      return {
        hasModal: !!modal,
        statCount: statCards.length,
        tabCount: tabs.length,
      };
    })()
  `);

  console.log('Stato Tab Statistiche Carriera:', statsInfo);
  if (!statsInfo.hasModal || statsInfo.statCount < 8) {
    throw new Error(`Tab Statistiche errata (metriche trovate: ${statsInfo.statCount})`);
  }

  // Switch a Tab Trofei
  console.log('Switch a Tab Trofei...');
  await evaluate(`
    (() => {
      const trophiesTab = Array.from(document.querySelectorAll('.stats-modal .tab')).find(t => t.dataset.tab === 'trophies');
      if (trophiesTab) trophiesTab.click();
    })()
  `);
  await sleep(400);

  const trophiesInfo = await evaluate(`
    (() => {
      const cards = document.querySelectorAll('.trophies-list .trophy-card');
      return {
        trophiesCount: cards.length,
      };
    })()
  `);

  console.log('Stato Tab Trofei:', trophiesInfo);
  if (trophiesInfo.trophiesCount !== 12) {
    throw new Error(`Tab Trofei deve mostrare 12 trofei, trovati: ${trophiesInfo.trophiesCount}`);
  }

  await captureScreenshot('dds_qa_stats_modal.png');

  // Chiudi StatsModal
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('#modal-root .modal-btn') ||
                       document.querySelector('#modal-root .modal-close');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(400);

  // 4. Avvia Nuova Spedizione per collaudare Toast Trofeo in-game
  console.log('Avvio Spedizione in-game per test sblocco trofeo...');
  await evaluate(`
    (() => {
      const newGameBtn = document.querySelector('[data-act="new"]') ||
                         Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Nuova') || b.textContent.includes('New'));
      if (newGameBtn) newGameBtn.click();
    })()
  `);
  await sleep(600);

  // Se compare BiomeSelectModal, seleziona Deserto
  await evaluate(`
    (() => {
      const startExp = document.querySelector('#biome-start-btn');
      if (startExp) startExp.click();
    })()
  `);
  await sleep(1000);

  // Innesca sblocco trofeo (first_strike) e verifica Toast Notifica
  console.log('Trigger sblocco trofeo "first_strike" per verificare AchievementToast...');
  const toastTriggered = await evaluate(`
    (() => {
      const ach = window.__dds?.achievements;
      if (ach) {
        ach.unlock('first_strike');
        return true;
      }
      return false;
    })()
  `);

  if (!toastTriggered) {
    throw new Error('Impossibile accedere al sistema Achievements in-game!');
  }

  await sleep(400);

  const toastInfo = await evaluate(`
    (() => {
      const toast = document.querySelector('.achievement-toast');
      const hasGlow = !!document.querySelector('.achievement-toast-glow');
      const hasSparkles = !!document.querySelector('.achievement-sparkles-container');
      const title = document.querySelector('.achievement-toast-title')?.textContent || '';
      const desc = document.querySelector('.achievement-toast-desc')?.textContent || '';
      return {
        hasToast: !!toast,
        hasGlow,
        hasSparkles,
        title,
        desc
      };
    })()
  `);

  console.log('Stato Toast Notifica Trofeo:', toastInfo);
  if (!toastInfo.hasToast || !toastInfo.title) {
    throw new Error('AchievementToast non visualizzato a schermo!');
  }

  await captureScreenshot('dds_qa_achievement_toast.png');

  // 5. Verifica Anti-Cheat Lockout Banner in StatsModal
  console.log('Attivazione modalità cheat e verifica banner lockout trofei...');
  await evaluate(`
    (() => {
      const game = window.__dds?.game;
      if (game) {
        game.state.enableCheats?.();
        game.state.cheatsEnabled = true;
      }
      const save = window.__dds?.save;
      if (save) {
        const cur = save.load() || {};
        cur.cheatsEnabled = true;
        save.write(cur);
      }
      if (window.__dds?.achievements?.state) {
        window.__dds.achievements.state.cheatsEnabled = true;
      }
      // Apri StatsModal
      const statsModal = window.__dds?.menu?.statsModal ||
                         window.__dds?.statsModal ||
                         window.__dds?.mainMenu?.statsModal;
      if (statsModal) {
        statsModal.open();
      }
    })()
  `);

  await sleep(600);

  const cheatBannerInfo = await evaluate(`
    (() => {
      const banner = document.querySelector('.cheats-lockout-banner');
      return {
        hasBanner: !!banner,
        bannerText: banner?.textContent?.trim() || ''
      };
    })()
  `);

  console.log('Stato Banner Lockout Trucchi:', cheatBannerInfo);
  if (!cheatBannerInfo.hasBanner) {
    throw new Error('Banner .cheats-lockout-banner non presente con cheatsEnabled === true!');
  }

  await captureScreenshot('dds_qa_stats_modal_cheats_lockout.png');

  // Chiudi StatsModal
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('#modal-root .modal-btn') ||
                       document.querySelector('#modal-root .modal-close');
      if (closeBtn) closeBtn.click();
    })()
  `);

} catch (err) {
  console.error('[Browser QA Error]', err);
  testPassed = false;
} finally {
  console.log('--------------------------------------------------------');
  console.log(`Errori Console rilevati: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Dettagli errori console:', consoleErrors);
    testPassed = false;
  }
  console.log(`Esito Suite Browser QA: ${testPassed ? 'SUPERATO CON SUCCESSO ✅' : 'FALLITO ❌'}`);
  console.log('--------------------------------------------------------');
  cleanup();
  process.exit(testPassed ? 0 : 1);
}
