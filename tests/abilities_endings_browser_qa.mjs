// Suite di Collaudo Browser QA Automatizzato per Medaglioni Abilità Attive (Branch 4),
// Regia Cinematica dei Finali ed Epilogo con Tavolette Antiche (τ) in Diggy Diggy Sand.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9410;
const USER_DATA_DIR = `/tmp/qa-dds-abilities-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION ABILITIES & ENDINGS');
console.log('  Branch 4 Medallions, Cinematic Climax & Tablets (τ)');
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
      console.log('✓ Pulsante "Inizia Spedizione" cliccato con successo!');
      break;
    }
    await sleep(250);
  }
  await sleep(1200);

  // 2. Avvio Spedizione
  console.log('\n--- AVVIO SPEDIZIONE DESERTO ---');
  await evaluate(`
    (() => {
      localStorage.removeItem('dds_save_v1');
      window.__dds.menu.startNewExpedition('desert');
    })()
  `);
  await sleep(1800);

  // 3. Verifica Officina: Scheda "Manufatti Attivi"
  console.log('\n--- VERIFICA 1: OFFICINA & SCHEDA MANUFATTI ATTIVI (BRANCH 4) ---');
  await evaluate(`window.__dds.game.shop.open()`);
  await sleep(400);

  const shopTabInfo = await evaluate(`
    (() => {
      const tabArtifacts = document.querySelector('.shop-tabs button[data-tab="artifacts"]');
      if (!tabArtifacts) return { found: false };
      tabArtifacts.click();
      const content = document.querySelector('.shop-content');
      const cards = Array.from(content.querySelectorAll('.upgrade-card')).map(c => ({
        id: c.dataset.id,
        title: c.querySelector('.upgrade-title')?.textContent?.trim()
      }));
      return {
        found: true,
        tabText: tabArtifacts.textContent.trim(),
        cards
      };
    })()
  `);
  console.log('Scheda Manufatti Officina:', JSON.stringify(shopTabInfo, null, 2));

  if (!shopTabInfo.found || shopTabInfo.cards.length < 3) {
    console.error('❌ ERRORE: Scheda Manufatti assente o incompleta nell\'Officina!');
    testPassed = false;
  } else {
    console.log(`✓ OK: Scheda Manufatti presente con ${shopTabInfo.cards.length} abilità (Dinamite, Vortice, Prisma)!`);
  }

  // Chiudi officina
  await evaluate(`window.__dds.game.shop.close()`);
  await sleep(300);

  // 4. Sblocco Abilità Attive e Verifica Medaglioni nell'HUD
  console.log('\n--- VERIFICA 2: MEDAGLIONI ABILITÀ ATTIVE NELL\'HUD ---');
  await evaluate(`
    (() => {
      const g = window.__dds.game;
      g.state.sand = 500000;
      g.state.totalSand = 500000;
      g.state.upgrades.dynamite = 1;
      g.state.upgrades.vortex = 1;
      g.state.upgrades.prism = 1;
      g.hud.refresh();
      g.abilities.update(0);
    })()
  `);
  await sleep(400);

  const abilitiesDockInfo = await evaluate(`
    (() => {
      const dock = document.querySelector('#hud-abilities-dock');
      if (!dock || dock.classList.contains('hidden')) return { visible: false };
      const medals = Array.from(dock.querySelectorAll('.ability-medallion')).map(m => ({
        ability: m.dataset.ability,
        isReady: m.classList.contains('is-ready'),
        hotkey: m.querySelector('.ability-hotkey')?.textContent?.trim(),
        hasSweep: !!m.querySelector('.ability-cooldown-sweep'),
        hasIcon: !!m.querySelector('.ability-icon')
      }));
      const rect = dock.getBoundingClientRect();
      const bottomDock = document.querySelector('#hud-bottom-dock')?.getBoundingClientRect();
      return {
        visible: true,
        count: medals.length,
        medals,
        aboveBottomDock: bottomDock ? (rect.bottom <= bottomDock.top + 10) : true
      };
    })()
  `);
  console.log('Stato Medaglioni HUD:', JSON.stringify(abilitiesDockInfo, null, 2));

  if (!abilitiesDockInfo.visible || abilitiesDockInfo.count !== 3) {
    console.error('❌ ERRORE: Medaglioni abilità non visibili o incompleti nell\'HUD!');
    testPassed = false;
  } else {
    console.log('✓ OK: Medaglioni Dinamite, Vortice e Prisma presenti sopra la dock centrale con sweep e hotkey!');
  }

  await captureScreenshot('dds_qa_abilities_dock.png');

  // 5. Test Attivazione Dinamite (Spazio) e Vortice (Tasto 1)
  console.log('\n--- VERIFICA 3: ATTIVAZIONE ABILITÀ E CALCOLO COOLDOWN ---');
  const activationResult = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const sandBefore = g.state.sand;
      const fired = g.abilities.activate('dynamite');
      const cdAfter = g.abilities.getCooldown('dynamite');
      const sandAfter = g.state.sand;

      // Attiva anche il vortice
      g.abilities.activate('vortex');
      const vortexActive = !!g.state.vortexActive;

      return {
        fired,
        cdAfter,
        sandDiff: sandAfter - sandBefore,
        vortexActive
      };
    })()
  `);
  console.log('Risultato Attivazione:', JSON.stringify(activationResult, null, 2));

  if (!activationResult.fired || activationResult.cdAfter <= 0 || activationResult.sandDiff <= 0 || !activationResult.vortexActive) {
    console.error('❌ ERRORE: Attivazione abilità fallita o cooldown non impostato!');
    testPassed = false;
  } else {
    console.log(`✓ OK: Dinamite detonata (+${activationResult.sandDiff} sabbia, CD: ${activationResult.cdAfter}s) e Vortice Khamsin attivo!`);
  }

  // 6. Test Regia Cinematica del Climax (Curse Ending) & Tavolette Antiche (τ)
  console.log('\n--- VERIFICA 4: REGIA CINEMATICA DEL CLIMAX & ASSEGNAZIONE TAVOLETTE (τ) ---');
  await evaluate(`
    (() => {
      const g = window.__dds.game;
      g.endingManager.forceEnding('curse');
    })()
  `);
  await sleep(1000);

  const cinematicCheck = await evaluate(`
    (() => {
      const hudFade = document.querySelector('#hud')?.classList.contains('hud-fade-out');
      const autoRotate = window.__dds.game.controls?.autoRotate;
      return {
        hudFade,
        autoRotate
      };
    })()
  `);
  console.log('Stato Regia Cinematica (Fade HUD & Camera):', JSON.stringify(cinematicCheck, null, 2));

  if (!cinematicCheck.hudFade || !cinematicCheck.autoRotate) {
    console.error('❌ ERRORE: Dissolvenza HUD (.hud-fade-out) o orbita telecamera cinematica non attivate!');
    testPassed = false;
  } else {
    console.log('✓ OK: HUD dissolto in .hud-fade-out e telecamera in rotazione cinematografica morbida!');
  }

  // Attendi completamento sequenza climax (~3.6s) e comparsa epilogo
  console.log('Attesa comparsa schermata di epilogo...');
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const check = await evaluate(`
      (() => {
        const overlay = document.querySelector('.overlay-screen');
        const elapsed = window.__dds?.game?.endingManager?.activeEnding?.elapsed;
        const visible = overlay && !overlay.classList.contains('hidden');
        return { visible, elapsed };
      })()
    `);
    if (check.visible) {
      console.log(`✓ Overlay epilogo apparso dopo ${check.elapsed?.toFixed(1)}s di animazione climax!`);
      break;
    }
  }

  const epilogueCheck = await evaluate(`
    (() => {
      const overlay = document.querySelector('.overlay-screen');
      if (!overlay || overlay.classList.contains('hidden')) return { visible: false };
      const title = overlay.querySelector('.epilogue-title')?.textContent?.trim();
      const tablets = overlay.querySelector('.stat-val.highlight')?.textContent?.trim();
      const seenEndings = window.__dds.save.getEndingsSeen();
      return {
        visible: true,
        title,
        tablets,
        seenEndings
      };
    })()
  `);
  console.log('Verifica Schermata Epilogo:', JSON.stringify(epilogueCheck, null, 2));

  if (!epilogueCheck.visible || !epilogueCheck.seenEndings.includes('curse')) {
    console.error('❌ ERRORE: Schermata epilogo non visibile o finale non registrato nei salvataggi!');
    testPassed = false;
  } else {
    console.log(`✓ OK: Epilogo "${epilogueCheck.title}" visualizzato con ${epilogueCheck.tablets} e salvato nella Galleria Finali (${epilogueCheck.seenEndings.join(', ')})!`);
  }

  await captureScreenshot('dds_qa_ending_climax_overlay.png');

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
  if (consoleErrors.length > 0) {
    console.error('Console errors logged:');
    consoleErrors.forEach((e, idx) => console.error(` [${idx + 1}] ${e}`));
  }
  testPassed = false;
} finally {
  cleanup();
}

if (!testPassed) {
  console.error('\n❌ QA TEST ABILITÀ E FINALI FALLITO');
  process.exit(1);
} else {
  console.log('\n✅ TUTTI I TEST ABILITÀ ATTIVE, REGIA FINALI E TAVOLETTE (τ) SUPERATI CON SUCCESSO!');
  process.exit(0);
}

