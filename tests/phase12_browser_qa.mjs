import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9337;
const USER_DATA_DIR = `/tmp/qa-dds-phase12-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('   DIGGY DIGGY SAND - QA AUTOMATION PHASE 12 TEST');
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
  // 1. Boot & Main Menu (v12.0 · Fase 12)
  // =========================================================================
  console.log('\n--- 1. Boot & Main Menu (v12.0 · Fase 12) ---');
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
  console.log('Pulsante start su schermata di caricamento pronto:', startBtnReady);
  if (!startBtnReady) throw new Error('Pulsante start non divenuto visibile entro il timeout');

  await evaluate(`
    (() => {
      const btn = document.querySelector('#start-btn, .start-btn');
      if (btn) btn.click();
    })()
  `);

  let menuInfo = null;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    menuInfo = await evaluate(`
      (() => {
        const m = document.getElementById('menu');
        const visible = m ? !m.classList.contains('hidden') : false;
        const footer = m?.querySelector('.menu-foot')?.textContent?.trim() || '';
        return { visible, footer };
      })()
    `);
    if (menuInfo?.visible) break;
  }
  console.log('MainMenu stato:', menuInfo);
  if (!menuInfo?.visible) {
    console.error('Console logs:', consoleLogs);
    console.error('Console errors:', consoleErrors);
    console.error('Page errors:', pageErrors);
    throw new Error('MainMenu non visibile');
  }
  if (menuInfo.footer !== 'v12.0 · Fase 12') {
    throw new Error(`Footer MainMenu atteso 'v12.0 · Fase 12', trovato: '${menuInfo.footer}'`);
  }
  console.log('Console errors al boot:', consoleErrors.length, '| Page exceptions:', pageErrors.length);
  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`Errori rilevati al boot: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  }

  // =========================================================================
  // 2. Expedition Selector (BiomeSelectModal)
  // =========================================================================
  console.log('\n--- 2. Expedition Selector (BiomeSelectModal) ---');
  await evaluate(`
    (() => {
      // Assicuriamoci che non ci sia un salvataggio preesistente che apra un confirm dialog
      window.__dds?.save?.clear?.();
      window.__dds?.menu?.refresh?.();
      const newBtn = document.querySelector('[data-act="new"]');
      if (newBtn) newBtn.click();
    })()
  `);
  await sleep(400);

  const modalCheck = await evaluate(`
    (() => {
      const modal = document.getElementById('biome-select-modal');
      if (!modal) return { exists: false };
      const cards = Array.from(modal.querySelectorAll('article.biome-card')).map((c) => ({
        biome: c.dataset.biome,
        hasSvg: !!c.querySelector('svg.biome-svg'),
        title: c.querySelector('.biome-card__title')?.textContent?.trim(),
        subtitle: c.querySelector('.biome-card__subtitle')?.textContent?.trim(),
        lore: c.querySelector('.biome-card__lore')?.textContent?.trim(),
        modifier: c.querySelector('.biome-card__modifier')?.textContent?.trim(),
        swatchCount: c.querySelectorAll('.biome-swatch').length,
      }));
      return {
        exists: true,
        hidden: modal.hidden,
        cardCount: cards.length,
        cards,
      };
    })()
  `);

  console.log('BiomeSelectModal check:', JSON.stringify(modalCheck, null, 2));
  if (!modalCheck.exists || modalCheck.hidden !== false) {
    throw new Error('BiomeSelectModal non aperta correttamente (hidden !== false)');
  }
  if (modalCheck.cardCount !== 4) {
    throw new Error(`Attese 4 biome-card, trovate: ${modalCheck.cardCount}`);
  }
  const expectedBiomes = ['desert', 'ocean', 'glacier', 'jungle'];
  for (const bId of expectedBiomes) {
    const card = modalCheck.cards.find((c) => c.biome === bId);
    if (!card) throw new Error(`Card bioma mancante: ${bId}`);
    if (!card.hasSvg) throw new Error(`SVG mancante in card: ${bId}`);
    if (!card.title || !card.subtitle || !card.lore || !card.modifier) {
      throw new Error(`Testi mancanti in card ${bId}: ${JSON.stringify(card)}`);
    }
    if (card.swatchCount !== 4) {
      throw new Error(`Attesi 4 color swatches in card ${bId}, trovati: ${card.swatchCount}`);
    }
  }

  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_biome_modal.png'));

  // =========================================================================
  // 3. Unlocking Biomes with Ancient Tablets τ & Launching Ocean Expedition (ocean)
  // =========================================================================
  console.log('\n--- 3. Unlocking Ocean with Ancient Tablets τ & Launching Expedition ---');
  const unlockOceanCheck = await evaluate(`
    (() => {
      window.DDS_DEBUG.addTablets(100);
      window.__dds.biomeSelectModal.render();
      const unlockBtn = document.querySelector('#biome-select-modal [data-action="unlock"][data-biome="ocean"]');
      const hadUnlockBtn = !!unlockBtn && !unlockBtn.disabled;
      if (unlockBtn) unlockBtn.click();
      return {
        hadUnlockBtn,
        isUnlocked: window.__dds.biomeManager.isUnlocked('ocean', window.__dds.save, window.__dds.statsManager),
        currentBiome: window.__dds.biomeManager.currentBiome,
        confirmBtnText: document.getElementById('btn-confirm-biome')?.textContent?.trim(),
      };
    })()
  `);
  console.log('Unlock Ocean result:', unlockOceanCheck);
  if (!unlockOceanCheck.isUnlocked || unlockOceanCheck.currentBiome !== 'ocean') {
    throw new Error(`Ocean non sbloccato/selezionato correttamente: ${JSON.stringify(unlockOceanCheck)}`);
  }

  // Click #btn-confirm-biome ([data-action="launch"])
  await evaluate(`
    (() => {
      const btn = document.getElementById('btn-confirm-biome');
      if (btn) btn.click();
    })()
  `);

  // Wait for game.phase === 'play'
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    const phase = await evaluate(`window.__dds?.game?.phase`);
    if (phase === 'play') break;
  }
  await evaluate(`if (window.__dds?.game) window.__dds.game.phase = 'play';`);

  const oceanVerify = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const t = g.terrain;
      const c = g.city;
      return {
        phase: g.phase,
        stateCurrentBiome: g.state.currentBiome,
        terrainExpeditionBiome: t.expeditionBiome,
        resistance: t.biomeMechanics.resistance,
        volumeMultiplier: t.biomeMechanics.volumeMultiplier,
        startHeight: t.startHeight,
        hasSunkenShip: !!c.sunkenShip && !!c.group.getObjectByName('sunken-ship'),
        hasShellArches: !!c.shellArches && !!c.group.getObjectByName('shell-arches'),
        audioCurrentBiome: window.__dds.audio.currentBiome,
      };
    })()
  `);
  console.log('Ocean Expedition verification:', oceanVerify);
  if (oceanVerify.stateCurrentBiome !== 'ocean' || oceanVerify.terrainExpeditionBiome !== 'ocean') {
    throw new Error('Bioma ocean non impostato su state/terrain');
  }
  if (oceanVerify.resistance !== 0.8 || oceanVerify.volumeMultiplier !== 1.15) {
    throw new Error(`Meccaniche ocean errate: ${JSON.stringify(oceanVerify)}`);
  }
  if (!oceanVerify.hasSunkenShip || !oceanVerify.hasShellArches) {
    throw new Error('Mesh 3D sunkenShip o shellArches mancanti nella scena Ocean');
  }
  if (oceanVerify.audioCurrentBiome !== 'ocean') {
    throw new Error(`Audio currentBiome atteso 'ocean', trovato '${oceanVerify.audioCurrentBiome}'`);
  }

  // Scava al centro e attorno per scoprire la nave sommersa e gli archi di conchiglie
  await evaluate(`
    (() => {
      const g = window.__dds.game;
      const t = g.terrain;
      // Scaviamo in (0,0) e nei punti della nave e degli archi per far emergere bene le rovine
      for (let i = 0; i < 16; i++) {
        t.dig(0, 0, 22, 1.2);
        t.dig(-2, -4, 16, 1.0);
        t.dig(2, 4, 16, 1.0);
        t.dig(0, 16, 12, 0.9);
        t.dig(16, 0, 12, 0.9);
      }
      t.flush();
      g.state.setCompletion(t.completion);
      g.hud.refresh();
      g.tutorial?.complete?.();
      document.getElementById('toast-host')?.remove();
      document.querySelectorAll('.tutorial-overlay, .ach-toast').forEach(el => el.remove());
    })()
  `);
  await sleep(500);
  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_biome_ocean.png'));

  // =========================================================================
  // 4. Glacier Expedition (glacier)
  // =========================================================================
  console.log('\n--- 4. Glacier Expedition (glacier) ---');
  await evaluate(`window.DDS_DEBUG.setBiome('glacier');`);
  await sleep(750);
  await evaluate(`
    (() => {
      const g = window.__dds.game;
      if (g) {
        g.phase = 'play';
        g.controls.enabled = true;
        g.digging.setEnabled(true);
      }
    })()
  `);

  const glacierVerify = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const t = g.terrain;
      const c = g.city;
      return {
        phase: g.phase,
        stateCurrentBiome: g.state.currentBiome,
        terrainExpeditionBiome: t.expeditionBiome,
        midLayerResistance: t.biomeMechanics.midLayerResistance,
        sandValueMultiplier: t.biomeMechanics.sandValueMultiplier,
        hasIceMonolith: !!c.iceMonolith && c.group.children.length > 0,
        hasCrystallineSpires: !!c.crystallineSpires && !!c.group.getObjectByName('crystalline-spires'),
        audioCurrentBiome: window.__dds.audio.currentBiome,
      };
    })()
  `);
  console.log('Glacier Expedition verification:', glacierVerify);
  if (glacierVerify.stateCurrentBiome !== 'glacier' || glacierVerify.midLayerResistance !== 1.35) {
    throw new Error(`Verifica Glacier fallita: ${JSON.stringify(glacierVerify)}`);
  }
  if (!glacierVerify.hasIceMonolith || !glacierVerify.hasCrystallineSpires) {
    throw new Error('Mesh 3D iceMonolith o crystallineSpires mancanti nella scena Glacier');
  }

  // Scava per scoprire il monolite esagonale di ghiaccio e le guglie cristalline
  await evaluate(`
    (() => {
      const g = window.__dds.game;
      const t = g.terrain;
      for (let i = 0; i < 18; i++) {
        t.dig(0, 0, 22, 1.3);
        t.dig(0, 14, 14, 1.1);
        t.dig(14, 0, 14, 1.1);
      }
      t.flush();
      g.state.setCompletion(t.completion);
      g.hud.refresh();
      g.tutorial?.complete?.();
      document.getElementById('toast-host')?.remove();
      document.querySelectorAll('.tutorial-overlay, .ach-toast').forEach(el => el.remove());
    })()
  `);
  await sleep(500);
  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_biome_glacier.png'));

  // =========================================================================
  // 5. Jungle Expedition (jungle) & Root Blocking Mechanics
  // =========================================================================
  console.log('\n--- 5. Jungle Expedition (jungle) & Root Blocking Mechanics ---');
  await evaluate(`window.DDS_DEBUG.setBiome('jungle');`);
  await sleep(750);
  await evaluate(`
    (() => {
      const g = window.__dds.game;
      if (g) {
        g.phase = 'play';
        g.controls.enabled = true;
        g.digging.setEnabled(true);
      }
    })()
  `);

  const jungleVerify = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const t = g.terrain;
      const c = g.city;

      const durBefore = t.getRootDurabilityAt(0, 0);
      t.dig(0, 0, 8, 1.2);
      const durAfter1 = t.getRootDurabilityAt(0, 0);
      const blocked1 = t.lastRootBlocked;

      t.dig(0, 0, 8, 1.2);
      const durAfter2 = t.getRootDurabilityAt(0, 0);
      const blocked2 = t.lastRootBlocked;

      t.dig(0, 0, 8, 1.2);
      const durAfter3 = t.getRootDurabilityAt(0, 0);
      const blocked3 = t.lastRootBlocked;

      t.dig(0, 0, 8, 1.2);
      const durAfter4 = t.getRootDurabilityAt(0, 0);
      const blocked4 = t.lastRootBlocked;

      return {
        stateCurrentBiome: g.state.currentBiome,
        terrainExpeditionBiome: t.expeditionBiome,
        durabilityProgression: [durBefore, durAfter1, durAfter2, durAfter3, durAfter4],
        blockedProgression: [blocked1, blocked2, blocked3, blocked4],
        hasSteppedZiggurat: !!c.steppedZiggurat && !!c.group.getObjectByName('stepped-ziggurat'),
        hasEngravedMenhirs: !!c.engravedMenhirs && !!c.group.getObjectByName('engraved-menhirs'),
        audioCurrentBiome: window.__dds.audio.currentBiome,
      };
    })()
  `);
  console.log('Jungle Expedition & Root Mechanics verification:', jungleVerify);

  const [d0, d1, d2, d3, d4] = jungleVerify.durabilityProgression;
  if (d0 !== 3 || d1 !== 2 || d2 !== 1 || d3 !== 0 || d4 !== 0) {
    throw new Error(`Progressione durabilità radici errata: ${JSON.stringify(jungleVerify.durabilityProgression)}`);
  }
  if (!jungleVerify.hasSteppedZiggurat || !jungleVerify.hasEngravedMenhirs) {
    throw new Error('Mesh 3D steppedZiggurat o engravedMenhirs mancanti nella scena Jungle');
  }

  // Scava ulteriormente per rivelare la Ziggurat a gradoni smeraldo e i menhir incisi
  await evaluate(`
    (() => {
      const g = window.__dds.game;
      const t = g.terrain;
      for (let i = 0; i < 20; i++) {
        t.dig(0, 0, 24, 1.3);
        t.dig(0, 15, 14, 1.1);
        t.dig(15, 0, 14, 1.1);
        t.dig(-11, 11, 14, 1.1);
      }
      t.flush();
      g.state.setCompletion(t.completion);
      g.hud.refresh();
      g.tutorial?.complete?.();
      document.getElementById('toast-host')?.remove();
      document.querySelectorAll('.tutorial-overlay, .ach-toast').forEach(el => el.remove());
    })()
  `);
  await sleep(500);
  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_biome_jungle.png'));

  // =========================================================================
  // REPORT FINALE
  // =========================================================================
  console.log('\n========================================================');
  console.log('   REPORT FINALE QA PHASE 12 & CONSOLE AUDIT');
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

  console.log('\n--- TUTTI I TEST DELLA FASE 12 COMPLETATI CON SUCCESSO! ---');
} catch (err) {
  console.error('\n!!! TEST FALLITO CON ECCEZIONE !!!');
  console.error(err);
  process.exitCode = 1;
} finally {
  cleanup();
  ws.close();
}
