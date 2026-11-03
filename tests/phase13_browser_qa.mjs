import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9338;
const USER_DATA_DIR = `/tmp/qa-dds-phase13-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('   DIGGY DIGGY SAND - QA AUTOMATION PHASE 13 TEST');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Avvio headless Chrome con WebGL (SwiftShader)
const chromeProc = spawn('google-chrome', [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1280,840',
  TARGET_URL
], { stdio: ['ignore', 'pipe', 'pipe'] });

let chromeOutput = '';
chromeProc.stderr.on('data', (d) => { chromeOutput += d.toString(); });
chromeProc.stdout.on('data', (d) => { chromeOutput += d.toString(); });

function cleanup() {
  try { chromeProc.kill('SIGTERM'); } catch {}
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch {}
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

// 2. Attesa CDP
let wsUrl = null;
for (let i = 0; i < 30; i++) {
  await sleep(300);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
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
  console.error('ERRORE: Impossibile connettersi a Chrome DevTools su porta', PORT);
  console.error(chromeOutput);
  cleanup();
  process.exit(1);
}

console.log('Connesso a Chrome CDP su:', wsUrl);

// 3. Client WebSocket CDP
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 1;
const pending = new Map();
const consoleLogs = [];
const consoleErrors = [];
const pageErrors = [];

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(data.error);
    else resolve(data.result);
  }

  if (data.method === 'Runtime.consoleAPICalled') {
    const type = data.params.type;
    const args = data.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
    consoleLogs.push({ type, text: args });
    if (type === 'error') {
      consoleErrors.push(args);
    }
  } else if (data.method === 'Runtime.exceptionThrown') {
    const text = data.params.exceptionDetails?.text || 'Eccezione';
    const desc = data.params.exceptionDetails?.exception?.description || '';
    pageErrors.push(`${text}: ${desc}`);
  }
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  }
  return res.result?.value;
}

async function takeScreenshot(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(filePath, Buffer.from(screenshotRes.data, 'base64'));
  console.log(`[Screenshot] Salvato: ${filePath}`);
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  // =========================================================================
  // 1. Boot & Game Launch
  // =========================================================================
  console.log('\n--- 1. Boot & Avvio Partita ---');
  await send('Page.navigate', { url: TARGET_URL });

  let startBtnReady = false;
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    try {
      startBtnReady = await evaluate(`
        (() => {
          const btn = document.querySelector('#start-btn, .start-btn');
          return btn ? !btn.classList.contains('hidden') : false;
        })()
      `);
      if (startBtnReady) break;
    } catch {}
  }

  if (!startBtnReady) {
    throw new Error('Pulsante start su schermata di caricamento non pronto');
  }

  // Clicca start per andare al Menu Principale
  await evaluate(`
    (() => {
      const btn = document.querySelector('#start-btn, .start-btn');
      if (btn) btn.click();
    })()
  `);

  // Attendi che il menu appaia
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    const visible = await evaluate(`
      (() => {
        const m = document.getElementById('menu');
        return m ? !m.classList.contains('hidden') : false;
      })()
    `);
    if (visible) break;
  }

  // Nuova spedizione
  await evaluate(`
    (() => {
      window.__dds?.save?.clear?.();
      window.__dds?.menu?.refresh?.();
      const newBtn = document.querySelector('[data-act="new"]');
      if (newBtn) newBtn.click();
    })()
  `);
  await sleep(400);

  // Conferma spedizione predefinita (deserto)
  await evaluate(`
    (() => {
      const btn = document.getElementById('btn-confirm-biome');
      if (btn) btn.click();
    })()
  `);

  // Attesa avvio gioco
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    const phase = await evaluate(`window.__dds?.game?.phase`);
    if (phase === 'play') break;
  }
  await sleep(600);

  // Rimuovi eventuali tutorial o toast per avere una schermata pulita
  await evaluate(`
    (() => {
      const g = window.__dds?.game;
      if (g) {
        g.phase = 'play';
        g.controls.enabled = true;
        g.digging.setEnabled(true);
        g.tutorial?.complete?.();
      }
      document.getElementById('toast-host')?.remove();
      document.querySelectorAll('.tutorial-overlay, .ach-toast').forEach(el => el.remove());
    })()
  `);
  console.log('Partita avviata con successo.');

  // =========================================================================
  // 2. Verifica Stato Iniziale dei Cheat (disabilitati)
  // =========================================================================
  console.log('\n--- 2. Verifica Stato Iniziale Trucchi ---');
  const initialCheatState = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const badge = document.querySelector('.hud-cheats-badge');
      return {
        cheatsEnabled: g.state.cheatsEnabled,
        godMode: g.state.godMode,
        badgeVisible: badge ? !badge.classList.contains('hidden') : false
      };
    })()
  `);
  console.log('Stato iniziale:', initialCheatState);
  if (initialCheatState.cheatsEnabled !== false) {
    throw new Error('cheatsEnabled deve essere false di default!');
  }
  if (initialCheatState.badgeVisible !== false) {
    throw new Error('Il badge trucchi nella HUD non deve essere visibile inizialmente!');
  }

  // =========================================================================
  // 3. Apertura Impostazioni -> Scheda Trucchi & Dialogo di Conferma
  // =========================================================================
  console.log('\n--- 3. Apertura Impostazioni e Scheda Trucchi ---');
  await evaluate(`
    (() => {
      window.__dds.game.settingsModal.open();
    })()
  `);
  await sleep(400);

  // Clicca sulla tab 'cheats'
  await evaluate(`
    (() => {
      const tab = document.querySelector('.settings-tabs .tab[data-tab="cheats"]');
      if (tab) tab.click();
    })()
  `);
  await sleep(300);

  const cheatsTabRendered = await evaluate(`
    (() => {
      const statusBox = document.querySelector('.cheats-status-box.inactive');
      const add100kBtn = document.querySelector('#cheat-add-sand-100k');
      return {
        hasInactiveStatus: !!statusBox,
        hasAddBtn: !!add100kBtn
      };
    })()
  `);
  console.log('Scheda Trucchi renderizzata:', cheatsTabRendered);
  if (!cheatsTabRendered.hasInactiveStatus || !cheatsTabRendered.hasAddBtn) {
    throw new Error('Scheda Trucchi non renderizzata correttamente!');
  }

  // Test 3.1: Clicca sul pulsante "+100.000 Sabbia" e verifica la comparsa del modale di conferma
  console.log('Test annullamento conferma...');
  await evaluate(`
    (() => {
      const btn = document.querySelector('#cheat-add-sand-100k');
      btn.click();
    })()
  `);
  await sleep(300);

  const confirmModalActive = await evaluate(`
    (() => {
      const confirmModal = Array.from(document.querySelectorAll('#modal-root .modal-backdrop')).find(b =>
        b.querySelector('.modal-title')?.textContent?.includes('Attenzione')
      );
      return {
        hasConfirmModal: !!confirmModal,
        hasDangerBtn: !!confirmModal?.querySelector('.modal-actions .btn.danger'),
        hasCancelBtn: !!confirmModal?.querySelector('.modal-actions .btn:not(.danger)')
      };
    })()
  `);
  console.log('Modale conferma attivo:', confirmModalActive);
  if (!confirmModalActive.hasConfirmModal || !confirmModalActive.hasDangerBtn || !confirmModalActive.hasCancelBtn) {
    throw new Error('Modale di conferma irreversibile non apparso sopra SettingsModal!');
  }

  // Clicca su "Annulla" del modale di conferma
  await evaluate(`
    (() => {
      const confirmModal = Array.from(document.querySelectorAll('#modal-root .modal-backdrop')).find(b =>
        b.querySelector('.modal-title')?.textContent?.includes('Attenzione')
      );
      const cancelBtn = confirmModal?.querySelector('.modal-actions .btn:not(.danger)');
      if (cancelBtn) cancelBtn.click();
    })()
  `);
  await sleep(300);

  const stateAfterCancel = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const confirmModal = Array.from(document.querySelectorAll('#modal-root .modal-backdrop')).find(b =>
        b.querySelector('.modal-title')?.textContent?.includes('Attenzione')
      );
      return {
        cheatsEnabled: g.state.cheatsEnabled,
        sand: g.state.sand,
        confirmClosed: !confirmModal
      };
    })()
  `);
  console.log('Stato dopo annulla:', stateAfterCancel);
  if (stateAfterCancel.cheatsEnabled !== false) {
    throw new Error('cheatsEnabled non deve essere attivo dopo aver annullato!');
  }
  if (!stateAfterCancel.confirmClosed) {
    throw new Error('Il modale di conferma doveva chiudersi dopo Annulla!');
  }

  // Test 3.2: Clicca di nuovo sul pulsante "+100.000 Sabbia" e conferma l'attivazione
  console.log('Test accettazione conferma...');
  await evaluate(`
    (() => {
      const btn = document.querySelector('#cheat-add-sand-100k');
      btn.click();
    })()
  `);
  await sleep(300);

  await evaluate(`
    (() => {
      const confirmModal = Array.from(document.querySelectorAll('#modal-root .modal-backdrop')).find(b =>
        b.querySelector('.modal-title')?.textContent?.includes('Attenzione')
      );
      const dangerBtn = confirmModal?.querySelector('.modal-actions .btn.danger');
      if (dangerBtn) dangerBtn.click();
    })()
  `);
  await sleep(400);

  const stateAfterConfirm = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const statusActive = document.querySelector('.cheats-status-box.active');
      return {
        cheatsEnabled: g.state.cheatsEnabled,
        sand: g.state.sand,
        hasActiveBox: !!statusActive
      };
    })()
  `);
  console.log('Stato dopo conferma trucchi:', stateAfterConfirm);
  if (stateAfterConfirm.cheatsEnabled !== true) {
    throw new Error('cheatsEnabled deve essere true dopo conferma!');
  }
  if (stateAfterConfirm.sand < 100000) {
    throw new Error(`Sabbia non incrementata correttamente: ${stateAfterConfirm.sand}`);
  }
  if (!stateAfterConfirm.hasActiveBox) {
    throw new Error('Box di stato attivo (.cheats-status-box.active) non presente!');
  }

  // Cattura screenshot della scheda trucchi attiva
  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_settings_cheats.png'));

  // =========================================================================
  // 4. Test Super Pala (God Mode) & HUD Badge
  // =========================================================================
  console.log('\n--- 4. Attivazione God Mode e Verifica Badge HUD ---');
  // Toggle God Mode switch nel tab Trucchi
  await evaluate(`
    (() => {
      const toggle = document.querySelector('#cheat-god-mode');
      if (toggle && !toggle.checked) {
        toggle.click();
      }
    })()
  `);
  await sleep(300);

  const godModeActive = await evaluate(`
    (() => {
      const g = window.__dds.game;
      return {
        godMode: g.state.godMode,
        radius: g.state.stats.radius,
        power: g.state.stats.power,
        digRate: g.state.stats.digRate
      };
    })()
  `);
  console.log('God Mode attivo:', godModeActive);
  if (godModeActive.godMode !== true) {
    throw new Error('God Mode non abilitato!');
  }
  if (godModeActive.radius < 10) {
    throw new Error('God Mode deve avere raggio aumentato (>= 10)!');
  }

  // Chiudi impostazioni e torna al gioco
  await evaluate(`
    (() => {
      window.__dds.game.settingsModal.close();
      const g = window.__dds.game;
      g.phase = 'play';
      g.hud.refresh();
    })()
  `);
  await sleep(500);

  const hudBadgeVisible = await evaluate(`
    (() => {
      const badge = document.querySelector('.hud-cheats-badge');
      return badge ? !badge.classList.contains('hidden') : false;
    })()
  `);
  console.log('HUD Cheats Badge visibile:', hudBadgeVisible);
  if (!hudBadgeVisible) {
    throw new Error('Badge trucchi nella HUD non visibile!');
  }

  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_hud_cheats_badge.png'));

  // =========================================================================
  // 5. Verifica Blocco Obiettivi e Banner Lockout nel Pannello Trofei
  // =========================================================================
  console.log('\n--- 5. Verifica Blocco Obiettivi e Banner nel Pannello Trofei ---');
  // Tenta sblocco manuale di un obiettivo
  const unlockResult = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const res = g.achievements.unlock('first_dig');
      return {
        returned: res,
        isUnlocked: g.achievements.isUnlocked('first_dig'),
        unlockedCount: g.achievements.getUnlockedCount()
      };
    })()
  `);
  console.log('Tentativo sblocco achievement con cheat:', unlockResult);
  if (unlockResult.returned !== false || unlockResult.isUnlocked !== false) {
    throw new Error('Gli achievement NON devono potersi sbloccare quando i trucchi sono attivi!');
  }

  // Apri StatsModal su tab Trofei
  await evaluate(`
    (() => {
      window.__dds.game.statsModal.open();
    })()
  `);
  await sleep(300);

  await evaluate(`
    (() => {
      const trophyTab = document.querySelector('.stats-modal .tab[data-tab="trophies"], .tab[data-tab="trophies"]');
      if (trophyTab) trophyTab.click();
    })()
  `);
  await sleep(300);

  const trophiesPageBanner = await evaluate(`
    (() => {
      const banner = document.querySelector('.cheats-lockout-banner');
      return {
        hasBanner: !!banner,
        bannerText: banner ? banner.innerText.trim() : null
      };
    })()
  `);
  console.log('Banner lockout trofei:', trophiesPageBanner);
  if (!trophiesPageBanner.hasBanner) {
    throw new Error('Banner .cheats-lockout-banner non visibile nella pagina trofei!');
  }

  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_trophies_lockout.png'));

  // =========================================================================
  // 6. Test Persistenza Lockout su LocalStorage
  // =========================================================================
  console.log('\n--- 6. Test Persistenza Salvataggio ---');
  const savedData = await evaluate(`
    (() => {
      const raw = localStorage.getItem('dds_save_v1');
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        cheatsEnabled: data.cheatsEnabled,
        godMode: data.godMode,
        sand: data.sand
      };
    })()
  `);
  console.log('Dati salvati su localStorage:', savedData);
  if (!savedData || savedData.cheatsEnabled !== true) {
    throw new Error('I trucchi non risultano persistiti correttamente su dds_save_v1!');
  }

  // =========================================================================
  // REPORT FINALE
  // =========================================================================
  console.log('\n========================================================');
  console.log('   REPORT FINALE QA PHASE 13 & CONSOLE AUDIT');
  console.log('========================================================');
  console.log(`Totale messaggi console: ${consoleLogs.length}`);
  console.log(`Errori console: ${consoleErrors.length}`);
  console.log(`Eccezioni pagina: ${pageErrors.length}`);

  if (consoleErrors.length > 0) {
    console.error('ERRORI CONSOLE TROVATI:', consoleErrors);
    process.exitCode = 1;
  } else {
    console.log('✓ 0 errori nella console JavaScript!');
  }

  if (pageErrors.length > 0) {
    console.error('ECCEZIONI NON GESTITE TROVATE:', pageErrors);
    process.exitCode = 1;
  } else {
    console.log('✓ 0 eccezioni pagina non gestite!');
  }

  console.log('\n--- TUTTI I TEST DELLA FASE 13 COMPLETATI CON SUCCESSO! ---');
} catch (err) {
  console.error('\n!!! TEST FALLITO CON ECCEZIONE !!!');
  console.error(err);
  process.exitCode = 1;
} finally {
  cleanup();
  ws.close();
}
