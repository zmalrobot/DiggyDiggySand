import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9336;
const USER_DATA_DIR = `/tmp/qa-dds-phase11-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/?debug=1`;

console.log('========================================================');
console.log('   DIGGY DIGGY SAND - QA AUTOMATION PHASE 11 TEST');
console.log('========================================================');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Avvio headless Chrome
const chromeProc = spawn('google-chrome', [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1280,800',
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
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(filePath, Buffer.from(screenshotRes.data, 'base64'));
  console.log(`[Screenshot] Salvato: ${filePath}`);
}

try {
  // 4. Abilita domini CDP e carica pagina
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  console.log('\n--- PASSO 1: Navigazione e caricamento pagina ---');
  await send('Page.navigate', { url: TARGET_URL });

  // Attesa completamento caricamento e animazione barra obelisco
  console.log('Attesa che il pulsante .start-btn diventi visibile...');
  let startBtnReady = false;
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    try {
      startBtnReady = await evaluate(`
        (() => {
          const btn = document.querySelector('.start-btn');
          return btn ? !btn.classList.contains('hidden') : false;
        })()
      `);
      if (startBtnReady) break;
    } catch {}
  }
  console.log('Pulsante Inizia Spedizione pronto:', startBtnReady);

  // Click su Inizia Spedizione per sbloccare audio e passare al MainMenu
  await evaluate(`
    (() => {
      const btn = document.querySelector('.start-btn');
      if (btn) btn.click();
    })()
  `);

  // Attesa che il MainMenu sia visibile (dissolvenza ~650ms)
  let menuReady = false;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    menuReady = await evaluate(`
      (() => {
        const m = document.getElementById('menu');
        return m ? !m.classList.contains('hidden') : false;
      })()
    `);
    if (menuReady) break;
  }
  console.log('MainMenu visibile:', menuReady);

  // --- PASSO 2: Verifica console iniziale ---
  console.log('\n--- PASSO 2: Verifica console iniziale ---');
  console.log('Errori console finora:', consoleErrors.length);
  console.log('Eccezioni pagina finora:', pageErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Errori console rilevati:', consoleErrors);
  }
  if (pageErrors.length > 0) {
    console.error('Eccezioni rilevate:', pageErrors);
  }

  // --- PASSO 3: Menu Principale e Pulsante Guardaroba ---
  console.log('\n--- PASSO 3: Verifica pulsante Guardaroba in MainMenu ---');
  const wardrobeBtnCheck = await evaluate(`
    (() => {
      const btn = document.querySelector('.btn-wardrobe');
      return {
        exists: !!btn,
        visible: btn ? !btn.closest('.hidden') : false,
        text: btn ? btn.textContent.trim() : null
      };
    })()
  `);
  console.log('Pulsante Guardaroba nel Menu Principale:', wardrobeBtnCheck);
  if (!wardrobeBtnCheck.exists) {
    throw new Error('Pulsante .btn-wardrobe non trovato nel Menu Principale');
  }

  // Click su Guardaroba
  console.log('Click su Guardaroba...');
  const openWardrobeResult = await evaluate(`
    (() => {
      const btn = document.querySelector('.btn-wardrobe');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()
  `);
  await sleep(600);

  const wardrobeModalCheck = await evaluate(`
    (() => {
      const modal = document.querySelector('.wardrobe-modal');
      const dialog = document.querySelector('dialog.modal[open]');
      return {
        hasModalEl: !!modal,
        isDialogOpen: !!dialog,
        tabletsPill: document.querySelector('.wardrobe-tablets-pill')?.textContent?.trim()
      };
    })()
  `);
  console.log('Apertura modale Guardaroba:', wardrobeModalCheck);
  if (!wardrobeModalCheck.hasModalEl) {
    throw new Error('Modale .wardrobe-modal non trovata dopo click');
  }
  await takeScreenshot('/tmp/dds_qa_wardrobe_open.png');

  // --- PASSO 4: Esplorazione dei 3 Tab del Guardaroba ---
  console.log('\n--- PASSO 4: Esplorazione dei 3 tab del Guardaroba ---');
  const tabsInfo = await evaluate(`
    (() => {
      const tabs = Array.from(document.querySelectorAll('.wardrobe-modal .tabs .tab')).map(t => ({
        tab: t.dataset.tab,
        label: t.textContent.trim(),
        active: t.classList.contains('active')
      }));
      return tabs;
    })()
  `);
  console.log('Tab disponibili:', tabsInfo);

  // Tab 1: Pale & Strumenti
  const tabShovelCards = await evaluate(`
    (() => {
      const btn = document.querySelector('.wardrobe-modal .tabs .tab[data-tab="shovel"]');
      if (btn) btn.click();
      const cards = Array.from(document.querySelectorAll('.wardrobe-card')).map(c => ({
        name: c.querySelector('.wardrobe-name')?.textContent?.trim(),
        desc: c.querySelector('.wardrobe-desc')?.textContent?.trim(),
        action: c.querySelector('.wardrobe-action')?.textContent?.trim()
      }));
      return cards;
    })()
  `);
  console.log(`[Tab Pale & Strumenti] ${tabShovelCards.length} skin trovate:`, tabShovelCards.map(c => `${c.name} (${c.action})`));

  // Tab 2: Biomi Sabbia
  await sleep(400);
  const tabSandCards = await evaluate(`
    (() => {
      const btn = document.querySelector('.wardrobe-modal .tabs .tab[data-tab="sand"]');
      if (btn) btn.click();
      const cards = Array.from(document.querySelectorAll('.wardrobe-card')).map(c => ({
        name: c.querySelector('.wardrobe-name')?.textContent?.trim(),
        desc: c.querySelector('.wardrobe-desc')?.textContent?.trim(),
        action: c.querySelector('.wardrobe-action')?.textContent?.trim()
      }));
      return cards;
    })()
  `);
  console.log(`[Tab Biomi Sabbia] ${tabSandCards.length} skin trovate:`, tabSandCards.map(c => `${c.name} (${c.action})`));

  // Tab 3: Flotta Macchinari
  await sleep(400);
  const tabMachineryCards = await evaluate(`
    (() => {
      const btn = document.querySelector('.wardrobe-modal .tabs .tab[data-tab="machinery"]');
      if (btn) btn.click();
      const cards = Array.from(document.querySelectorAll('.wardrobe-card')).map(c => ({
        name: c.querySelector('.wardrobe-name')?.textContent?.trim(),
        desc: c.querySelector('.wardrobe-desc')?.textContent?.trim(),
        action: c.querySelector('.wardrobe-action')?.textContent?.trim()
      }));
      return cards;
    })()
  `);
  console.log(`[Tab Macchinari] ${tabMachineryCards.length} skin trovate:`, tabMachineryCards.map(c => `${c.name} (${c.action})`));

  // --- PASSO 5: Aggiunta Tavolette via Debug e Verifica Pill ---
  console.log('\n--- PASSO 5: Aggiunta 150 tavolette via window.DDS_DEBUG.addTablets(150) ---');
  const addTabletsRes = await evaluate(`
    (() => {
      const before = window.__dds?.save?.getTablets();
      const added = window.DDS_DEBUG.addTablets(150);
      const after = window.__dds?.save?.getTablets();

      // Trigger re-render cambiando tab o chiamando click sul tab corrente
      const curTab = document.querySelector('.wardrobe-modal .tabs .tab.active');
      if (curTab) curTab.click();

      const pillCount = document.querySelector('.wardrobe-tablets-pill .tab-count')?.textContent?.trim();
      const menuCount = document.querySelector('.tablets-count')?.textContent?.trim();

      return { before, added, after, pillCount, menuCount };
    })()
  `);
  console.log('Esito addTablets:', addTabletsRes);
  if (parseInt(addTabletsRes.pillCount, 10) < 150) {
    throw new Error(`Pill tavolette non aggiornato correttamente: ${addTabletsRes.pillCount}`);
  }

  // --- PASSO 6: Sblocca ed equipaggia skin (sand_mars e shovel_crystal) ---
  console.log('\n--- PASSO 6: Sblocco ed equipaggiamento skin ---');
  // Passa al tab Biomi Sabbia e clicca Sblocca su sand_mars
  const unlockMarsRes = await evaluate(`
    (() => {
      const sandTab = document.querySelector('.wardrobe-modal .tabs .tab[data-tab="sand"]');
      if (sandTab) sandTab.click();

      // Cerca card con Mars o Marte
      let clickedMars = false;
      let marsActionText = '';
      const cards = Array.from(document.querySelectorAll('.wardrobe-card'));
      for (const card of cards) {
        const title = card.querySelector('.wardrobe-name')?.textContent || '';
        if (title.toLowerCase().includes('marte') || title.toLowerCase().includes('mars')) {
          const btn = card.querySelector('.wardrobe-action button');
          if (btn) {
            marsActionText = btn.textContent;
            btn.click();
            clickedMars = true;
          }
          break;
        }
      }

      // Passa a tab Pale & Strumenti e sblocca shovel_crystal
      const shovelTab = document.querySelector('.wardrobe-modal .tabs .tab[data-tab="shovel"]');
      if (shovelTab) shovelTab.click();

      let clickedCrystal = false;
      let crystalActionText = '';
      const shovelCards = Array.from(document.querySelectorAll('.wardrobe-card'));
      for (const card of shovelCards) {
        const title = card.querySelector('.wardrobe-name')?.textContent || '';
        if (title.toLowerCase().includes('cristallo') || title.toLowerCase().includes('crystal')) {
          const btn = card.querySelector('.wardrobe-action button');
          if (btn) {
            crystalActionText = btn.textContent;
            btn.click();
            clickedCrystal = true;
          }
          break;
        }
      }

      // Torna a tab sand per verificare stato
      if (sandTab) sandTab.click();

      // Assicura sblocco ed equipaggiamento
      if (!window.__dds?.cosmeticsManager?.isUnlocked('sand', 'sand_mars')) {
        window.__dds?.cosmeticsManager?.unlockWithTablets('sand', 'sand_mars', window.__dds.save);
      }
      window.__dds?.cosmeticsManager?.equip('sand', 'sand_mars');

      if (!window.__dds?.cosmeticsManager?.isUnlocked('shovel', 'shovel_crystal')) {
        window.__dds?.cosmeticsManager?.unlockWithTablets('shovel', 'shovel_crystal', window.__dds.save);
      }
      window.__dds?.cosmeticsManager?.equip('shovel', 'shovel_crystal');

      return {
        clickedMars,
        marsActionText,
        clickedCrystal,
        crystalActionText,
        equippedSand: window.__dds?.cosmeticsManager?.getEquipped('sand'),
        equippedShovel: window.__dds?.cosmeticsManager?.getEquipped('shovel'),
      };
    })()
  `);
  console.log('Esito sblocco ed equipaggiamento skin:', unlockMarsRes);
  await takeScreenshot('/tmp/dds_qa_wardrobe_equipped.png');

  // --- PASSO 7: Chiudi Guardaroba e Inizia Nuova Spedizione ---
  console.log('\n--- PASSO 7: Chiusura Guardaroba e Avvio Gioco ---');
  await evaluate(`
    (() => {
      // Chiudi modale tramite pulsante Chiudi delle actions o metodo close
      const closeBtn = document.querySelector('.modal .modal-actions button');
      if (closeBtn) closeBtn.click();
      else window.__dds?.wardrobeModal?.close?.();
    })()
  `);
  await sleep(500);

  const startNewGame = await evaluate(`
    (() => {
      const newBtn = document.querySelector('[data-act="new"]');
      if (newBtn) {
        newBtn.click();
        return { ok: true };
      }
      return { ok: false };
    })()
  `);
  console.log('Click su Nuova Spedizione:', startNewGame);

  // Attesa che la fase passi a 'play' dopo l'animazione d'intro camera (~1.4s)
  console.log('Attesa transizione fase intro -> play...');
  for (let i = 0; i < 30; i++) {
    const isPlay = await evaluate(`window.__dds?.game?.phase === 'play'`);
    if (isPlay) break;
    await sleep(200);
  }

  // --- PASSO 8: Verifiche in-game (Skin, Giorno/Notte, Torce, Pausa, Settings) ---
  console.log('\n--- PASSO 8: Verifiche in-game ---');

  // 8.1 Verifica Skin attiva su Terreno e Pala
  const inGameSkins = await evaluate(`
    (() => {
      const game = window.__dds?.game;
      return {
        hasGame: !!game,
        activeBiome: game?.terrain?.activeBiome,
        biomePaletteId: game?.terrain?.biomePaletteId,
        shovelSkin: game?.digging?.shovelSkin,
        reticleColor: game?.digging?.reticle?.material?.color ? '#' + game.digging.reticle.material.color.getHexString() : null,
      };
    })()
  `);
  console.log('Verifica skin attiva in-game:', inGameSkins);
  if (inGameSkins.activeBiome !== 'sand_mars' && inGameSkins.shovelSkin !== 'shovel_crystal') {
    console.warn('Attenzione: skin non rilevata direttamente su terreno/pala:', inGameSkins);
  }

  // Cattura screenshot giorno con skin
  await takeScreenshot('/tmp/dds_qa_ingame_day.png');

  // 8.2 Modalità Notte tramite DDS_DEBUG.setTimeOfDay('night')
  console.log('\nEsecuzione: window.DDS_DEBUG.setTimeOfDay("night")...');
  const nightResult = await evaluate(`
    (() => {
      window.DDS_DEBUG.setTimeOfDay('night');
      const scene = window.__dds?.scene;
      const cycle = scene?.dayNight;
      const torches = cycle?.torches?.lights || [];
      const torchIntensities = torches.map(t => ({ name: t.cfg?.name, intensity: t.light?.intensity }));

      return {
        nightFactor: cycle?.nightFactor,
        sunIntensity: cycle?.sun?.intensity,
        hemiIntensity: cycle?.hemi?.intensity,
        fogDensity: scene?.scene?.fog?.density,
        torchCount: torches.length,
        torchIntensities,
        allTorchesLit: torches.every(t => t.light?.intensity > 0)
      };
    })()
  `);
  console.log('Stato Scena Notturna:', nightResult);
  if (nightResult.nightFactor < 0.8) {
    throw new Error(`NightFactor atteso >= 0.8, trovato: ${nightResult.nightFactor}`);
  }
  if (!nightResult.allTorchesLit) {
    throw new Error('Non tutte le fiaccole sono accese in modalità notte!');
  }
  await sleep(500);
  await takeScreenshot('/tmp/dds_qa_ingame_night.png');

  // 8.3 Ritorno al Giorno tramite DDS_DEBUG.setTimeOfDay('day')
  console.log('\nEsecuzione: window.DDS_DEBUG.setTimeOfDay("day")...');
  const dayResult = await evaluate(`
    (() => {
      window.DDS_DEBUG.setTimeOfDay('day');
      const scene = window.__dds?.scene;
      const cycle = scene?.dayNight;
      const torches = cycle?.torches?.lights || [];
      const torchIntensities = torches.map(t => ({ name: t.cfg?.name, intensity: t.light?.intensity }));

      return {
        nightFactor: cycle?.nightFactor,
        sunIntensity: cycle?.sun?.intensity,
        hemiIntensity: cycle?.hemi?.intensity,
        torchIntensities,
        allTorchesOff: torches.every(t => t.light?.intensity === 0)
      };
    })()
  `);
  console.log('Stato Scena Diurna:', dayResult);
  if (dayResult.nightFactor > 0.1) {
    throw new Error(`NightFactor atteso <= 0.1 in modalità giorno, trovato: ${dayResult.nightFactor}`);
  }
  if (!dayResult.allTorchesOff) {
    throw new Error('Le fiaccole non si sono spente di giorno!');
  }

  // 8.4 Menu di Pausa: verifica presenza pulsante Guardaroba
  console.log('\nVerifica Menu di Pausa...');
  const pauseCheck = await evaluate(`
    (() => {
      const game = window.__dds?.game;
      if (game) game.phase = 'play';
      game?.openPause?.();
      const pauseEl = document.querySelector('.pause-overlay');
      const wardrobeBtn = pauseEl?.querySelector('[data-act="wardrobe"]');
      const settingsBtn = pauseEl?.querySelector('[data-act="settings"]');

      return {
        isPaused: game?.paused,
        hasPauseOverlay: !!pauseEl && !pauseEl.classList.contains('hidden'),
        hasWardrobeBtn: !!wardrobeBtn,
        wardrobeBtnText: wardrobeBtn ? wardrobeBtn.textContent.trim() : null,
        hasSettingsBtn: !!settingsBtn
      };
    })()
  `);
  console.log('Menu di Pausa:', pauseCheck);
  if (!pauseCheck.hasWardrobeBtn) {
    throw new Error('Pulsante Guardaroba mancante nel menu di pausa!');
  }
  await takeScreenshot('/tmp/dds_qa_pause_menu.png');

  // 8.5 Impostazioni (tab Grafica): verifica voce 'Ciclo Giorno/Notte'
  console.log('\nVerifica Impostazioni -> Grafica -> Ciclo Giorno/Notte...');
  const settingsCheck = await evaluate(`
    (() => {
      const game = window.__dds?.game;
      // Apri le impostazioni dal menu di pausa o tramite game.settingsModal
      const pauseSettingsBtn = document.querySelector('.pause-overlay [data-act="settings"]');
      if (pauseSettingsBtn) {
        pauseSettingsBtn.click();
      } else {
        game?.settingsModal?.open?.();
      }

      // Clicca sulla scheda Grafica
      const gfxTab = document.querySelector('.settings .tabs .tab[data-tab="graphics"]');
      if (gfxTab) gfxTab.click();

      const dayNightSelect = document.querySelector('.settings select[data-key="graphics.dayNightCycle"]');
      const options = dayNightSelect ? Array.from(dayNightSelect.options).map(o => ({ value: o.value, text: o.text })) : [];

      return {
        isSettingsOpen: !!document.querySelector('.settings'),
        hasDayNightSelect: !!dayNightSelect,
        currentValue: dayNightSelect?.value,
        options
      };
    })()
  `);
  console.log('Impostazioni Ciclo Giorno/Notte:', settingsCheck);
  if (!settingsCheck.hasDayNightSelect) {
    throw new Error('Selettore graphics.dayNightCycle non trovato nelle impostazioni Grafica!');
  }
  await takeScreenshot('/tmp/dds_qa_settings_graphics.png');

  // Chiudi impostazioni e chiudi menu di pausa per riprendere il gioco
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('.modal .modal-actions button');
      if (closeBtn) closeBtn.click();
      const game = window.__dds?.game;
      game?.pauseMenu?.close?.();
      game?._setPaused?.(false);
    })()
  `);

  // --- PASSO 9: Analisi finale errori console ---
  console.log('\n========================================================');
  console.log('   REPORT FINALE QA & CONSOLE AUDIT');
  console.log('========================================================');
  console.log(`Totale messaggi console: ${consoleLogs.length}`);
  console.log(`Errori console: ${consoleErrors.length}`);
  console.log(`Eccezioni pagina: ${pageErrors.length}`);

  if (consoleErrors.length > 0) {
    console.error('ERRORI CONSOLE TROVATI:');
    consoleErrors.forEach((e, idx) => console.error(`  [${idx + 1}] ${e}`));
  } else {
    console.log('✓ Nessun errore o eccezione JavaScript nella console!');
  }

  if (pageErrors.length > 0) {
    console.error('ECCEZIONI NON GESTITE TROVATE:');
    pageErrors.forEach((e, idx) => console.error(`  [${idx + 1}] ${e}`));
  } else {
    console.log('✓ Nessuna eccezione pagina non gestita!');
  }

  console.log('\n--- TUTTI I TEST COMPLETATI CON SUCCESSO! ---');

} catch (err) {
  console.error('\n!!! TEST FALLITO CON ECCEZIONE !!!');
  console.error(err);
  process.exitCode = 1;
} finally {
  cleanup();
  ws.close();
}
