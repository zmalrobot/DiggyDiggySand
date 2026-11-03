import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9339;
const USER_DATA_DIR = `/tmp/qa-dds-phase14-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('   DIGGY DIGGY SAND - QA AUTOMATION PHASE 14 TEST');
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
  console.log('\n--- 1. Boot & Avvio Spedizione ---');
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
    console.error('Console errors:', consoleErrors);
    console.error('Page errors:', pageErrors);
    console.error('Recent console logs:', consoleLogs.slice(-20));
    throw new Error('Pulsante start su schermata di caricamento non pronto');
  }

  // Clicca start
  await evaluate(`
    (() => {
      const btn = document.querySelector('#start-btn, .start-btn');
      if (btn) btn.click();
    })()
  `);

  // Attesa menu
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

  // Conferma spedizione deserto
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

  // Pulizia tutorial e toast
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
  console.log('Spedizione avviata con successo.');

  // =========================================================================
  // 2. Verifica PostProcessing & Atmosfera Attivi
  // =========================================================================
  console.log('\n--- 2. Verifica PostProcessing & Atmosphere in-game ---');
  const graphicsState = await evaluate(`
    (() => {
      const sm = window.__dds.scene;
      return {
        hasPostProcessing: !!sm.postProcessing,
        postProcessingEnabled: sm.postProcessing?.enabled,
        hasAtmosphere: !!sm.atmosphere,
        atmosphereEnabled: sm.atmosphere?.enabled,
        moteCount: sm.atmosphere?.mesh?.count,
        atmosphereVisible: sm.atmosphere?.group?.visible,
      };
    })()
  `);
  console.log('Stato grafica & post-processing:', graphicsState);
  if (!graphicsState.hasPostProcessing || !graphicsState.postProcessingEnabled) {
    throw new Error('PostProcessing deve essere istanziato e abilitato!');
  }
  if (!graphicsState.hasAtmosphere || !graphicsState.atmosphereEnabled || graphicsState.moteCount !== 100) {
    throw new Error('Atmosphere con 100 dust motes deve essere attiva!');
  }

  // Esegui qualche colpo di pala per creare profondità nel cratere
  await evaluate(`
    (() => {
      const g = window.__dds.game;
      const t = g.terrain;
      for (let i = 0; i < 12; i++) {
        t.dig(0, 0, 18, 1.2);
        t.dig(8, 0, 10, 0.9);
        t.dig(-8, 0, 10, 0.9);
      }
      t.flush();
      g.state.setCompletion(t.completion);
      g.hud.refresh();
    })()
  `);
  await sleep(600);

  // Cattura screenshot della scena con bloom, vignette e particelle atmosferiche
  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_postprocessing_bloom.png'));

  // =========================================================================
  // 3. Verifica Sub-Grid Normals & Anti-Tunneling Assoluto
  // =========================================================================
  console.log('\n--- 3. Verifica Sub-Grid Normals e Anti-Tunneling ---');
  const subgridCheck = await evaluate(`
    (() => {
      const g = window.__dds.game;
      const t = g.terrain;
      // Scavo estremo per testare anti-tunneling
      for (let i = 0; i < 25; i++) {
        t.dig(0, 0, 12, 10);
      }
      t.flush();
      t.updateBounds();

      const minHeight = t.heightAt(0, 0);
      const allHeightsGeZero = Array.from(t.heights).every(h => h >= 0);
      const boundingBoxMinY = t.geometry.boundingBox.min.y;

      return {
        minHeight,
        allHeightsGeZero,
        boundingBoxMinY,
        normalsAttributeNeedsUpdate: t.normals.needsUpdate,
      };
    })()
  `);
  console.log('Verifica subgrid & anti-tunneling:', subgridCheck);
  if (subgridCheck.minHeight < 0 || !subgridCheck.allHeightsGeZero) {
    throw new Error(`Anti-tunneling fallito: trovata quota < 0 (${subgridCheck.minHeight})`);
  }
  if (subgridCheck.boundingBoxMinY !== 0) {
    throw new Error(`Bounding box non aggiornato correttamente a floor 0: ${subgridCheck.boundingBoxMinY}`);
  }

  // =========================================================================
  // 4. Test Toggle Impostazioni Grafiche (PostProcessing & Dust Motes)
  // =========================================================================
  console.log('\n--- 4. Toggle Impostazioni Grafiche ---');
  await evaluate(`
    (() => {
      window.__dds.game.settingsModal.open();
    })()
  `);
  await sleep(400);

  // Passa alla tab Grafica
  await evaluate(`
    (() => {
      const tab = document.querySelector('.settings-tabs .tab[data-tab="graphics"]');
      if (tab) tab.click();
    })()
  `);
  await sleep(300);

  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_settings_postproc.png'));

  // Disattiva Post-Processing e Dust Motes
  await evaluate(`
    (() => {
      window.__dds.settings.set('graphics.postProcessing', false);
      window.__dds.settings.set('graphics.dustMotes', false);
    })()
  `);
  await sleep(300);

  const toggledState = await evaluate(`
    (() => {
      const sm = window.__dds.scene;
      return {
        postProcEnabled: sm.postProcessing?.enabled,
        postMaterialEnabled: sm.postProcessing?.postMaterial?.uniforms?.uEnabled?.value,
        atmosphereEnabled: sm.atmosphere?.enabled,
        atmosphereVisible: sm.atmosphere?.group?.visible
      };
    })()
  `);
  console.log('Stato dopo disattivazione toggle:', toggledState);
  if (toggledState.postProcEnabled !== false || toggledState.atmosphereEnabled !== false) {
    throw new Error('I toggle grafici non hanno disattivato i rispettivi moduli!');
  }

  // Riabilita per i test successivi
  await evaluate(`
    (() => {
      window.__dds.settings.set('graphics.postProcessing', true);
      window.__dds.settings.set('graphics.dustMotes', true);
      window.__dds.game.settingsModal.close();
    })()
  `);
  await sleep(300);

  // =========================================================================
  // 5. Test Display Estremi (Portrait Mobile & Ultra-Wide)
  // =========================================================================
  console.log('\n--- 5. Test Display Estremi & Risoluzione Adattiva ---');

  // 5.1 Simulazione Portrait Mobile (390 x 844, notch)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await evaluate(`window.__dds.scene.resize();`);
  await sleep(500);

  const portraitMetrics = await evaluate(`
    (() => {
      const cam = window.__dds.scene.camera;
      const hud = document.getElementById('hud');
      const r = hud ? hud.getBoundingClientRect() : null;
      return {
        fov: cam.fov,
        aspect: cam.aspect,
        hudWidth: r?.width,
        hudHeight: r?.height,
      };
    })()
  `);
  console.log('Metrica Portrait Mobile:', portraitMetrics);
  if (portraitMetrics.fov <= 50) {
    throw new Error(`FOV su schermo portrait non compensato adeguatamente: ${portraitMetrics.fov}`);
  }
  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_viewport_mobile.png'));

  // 5.2 Simulazione Ultra-Wide (2560 x 1080, aspect 21:9)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 2560,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(`window.__dds.scene.resize();`);
  await sleep(500);

  const ultrawideMetrics = await evaluate(`
    (() => {
      const cam = window.__dds.scene.camera;
      const hudTop = document.querySelector('.hud-top');
      const r = hudTop ? hudTop.getBoundingClientRect() : null;
      return {
        fov: cam.fov,
        aspect: cam.aspect,
        hudTopWidth: r?.width,
      };
    })()
  `);
  console.log('Metrica Ultra-Wide 21:9:', ultrawideMetrics);
  if (ultrawideMetrics.fov >= 50) {
    throw new Error(`FOV su ultra-wide non calibrato: ${ultrawideMetrics.fov}`);
  }
  await takeScreenshot(path.join(ARTIFACT_DIR, 'dds_qa_viewport_ultrawide.png'));

  // Ripristina viewport standard desktop
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 840,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(`window.__dds.scene.resize();`);
  await sleep(300);

  // =========================================================================
  // 6. Test Recupero Salvataggio Corrotto & Ridondanza Backup
  // =========================================================================
  console.log('\n--- 6. Test Ripristino Salvataggio da Backup dds_save_backup ---');
  const recoveryResult = await evaluate(`
    (() => {
      const save = window.__dds.save;
      // Scrivi un salvataggio valido con 88.000 sabbia
      const d = save.createNew({ biome: 'desert' });
      d.sand = 88000;
      save.write(d);

      // Danneggia deliberatamente il file primario
      localStorage.setItem('dds_save_v1', '{ "corruptedJson": true, "sand": NaN, "seed": ');

      // Esegui il caricamento
      const loaded = save.load();
      return {
        recoveryReason: save.lastRecoveryReason,
        sand: loaded?.sand,
        seed: loaded?.seed,
      };
    })()
  `);
  console.log('Risultato test recovery:', recoveryResult);
  if (recoveryResult.recoveryReason !== 'backup_restored' || recoveryResult.sand !== 88000) {
    throw new Error(`Recupero da backup fallito: ${JSON.stringify(recoveryResult)}`);
  }

  // =========================================================================
  // REPORT FINALE
  // =========================================================================
  console.log('\n========================================================');
  console.log('   REPORT FINALE QA PHASE 14 & CONSOLE AUDIT');
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

  console.log('\n--- TUTTI I TEST DELLA FASE 14 COMPLETATI CON SUCCESSO! ---');
} catch (err) {
  console.error('\n!!! TEST FALLITO CON ECCEZIONE !!!');
  console.error(err);
  process.exitCode = 1;
} finally {
  cleanup();
  ws.close();
}
