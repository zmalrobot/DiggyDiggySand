import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9359;
const USER_DATA_DIR = `/tmp/qa-dds-phase17-ssr-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('  DIGGY DIGGY SAND - QA AUTOMATION PHASE 17 SSR RAYTRACING');
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
  // Attesa pulsante di avvio schermata iniziale
  console.log('[Browser QA] In attesa del pulsante di avvio...');
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
        break;
      }
    } catch {}
  }

  // Attesa inizializzazione window.__dds
  console.log('[Browser QA] In attesa di window.__dds...');
  let loaded = false;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const isReady = await cdp.eval(`
      !!(window.__dds && window.__dds.scene && window.__dds.scene.postProcessing && window.__dds.settings)
    `);
    if (isReady) {
      loaded = true;
      break;
    }
  }
  if (!loaded) throw new Error('Timeout boot window.__dds e postProcessing');

  // 1. Verifica Stato Iniziale di SSR (Disattivato di Default con zero overhead)
  console.log('[Browser QA] Verifica stato iniziale SSR...');
  const initialSSRState = await cdp.eval(`
    (() => {
      const pp = window.__dds.scene.postProcessing;
      return {
        settingValue: window.__dds.settings.get('graphics.raytracingSSR'),
        aliasValue: window.__dds.settings.get('raytracingSSR'),
        raytracingSSREnabled: pp.raytracingSSREnabled,
        hasDepthTexture: !!pp.renderTarget.depthTexture,
        uRaytracingSSR: pp.postMaterial.uniforms.uRaytracingSSR.value,
      };
    })()
  `);
  console.log('[Initial SSR State]:', initialSSRState);

  if (initialSSRState.settingValue !== false) throw new Error('graphics.raytracingSSR deve essere false di default');
  if (initialSSRState.aliasValue !== false) throw new Error('alias raytracingSSR deve essere false di default');
  if (initialSSRState.raytracingSSREnabled !== false) throw new Error('pp.raytracingSSREnabled deve essere false di default');
  if (initialSSRState.hasDepthTexture) throw new Error('DepthTexture non deve essere allocata se SSR è spento (zero-cost bypass)');
  if (initialSSRState.uRaytracingSSR !== 0.0) throw new Error('uRaytracingSSR uniform deve essere 0.0');

  console.log('✓ 1. Zero-cost bypass iniziale verificato: depth texture non allocata e SSR disattivato.');

  // 2. Apri Impostazioni Grafica e verifica Toggle SSR
  console.log('[Browser QA] Apertura pannello Impostazioni nel tab Grafica...');
  await cdp.eval(`
    (() => {
      if (window.__dds.menu && window.__dds.menu.settingsModal) {
        window.__dds.menu.settingsModal.open('graphics');
      } else if (window.__dds.hud && window.__dds.hud.settingsModal) {
        window.__dds.hud.settingsModal.open('graphics');
      }
    })()
  `);
  await sleep(600);

  const toggleCheck = await cdp.eval(`
    (() => {
      const input = document.querySelector('input[name="graphics.raytracingSSR"]');
      return {
        found: !!input,
        checked: input ? input.checked : null,
      };
    })()
  `);
  console.log('[Toggle Check]:', toggleCheck);
  if (!toggleCheck.found) throw new Error('Toggle input[name="graphics.raytracingSSR"] non trovato nel modal impostazioni');
  if (toggleCheck.checked !== false) throw new Error('Toggle SSR dovrebbe essere non spuntato inizialmente');

  // Cattura screenshot impostazioni
  await cdp.screenshot('dds_qa_ssr_settings_toggle.png');
  console.log('✓ 2. Toggle SSR presente e verificato nel tab Grafica delle Impostazioni.');

  // 3. Attivazione di SSR tramite impostazioni
  console.log('[Browser QA] Attivazione SSR tramite SettingsManager...');
  await cdp.eval(`
    (() => {
      window.__dds.settings.set('graphics.raytracingSSR', true);
    })()
  `);
  await sleep(400);

  const activeSSRState = await cdp.eval(`
    (() => {
      const pp = window.__dds.scene.postProcessing;
      const input = document.querySelector('input[name="graphics.raytracingSSR"]');
      return {
        settingValue: window.__dds.settings.get('graphics.raytracingSSR'),
        aliasValue: window.__dds.settings.get('raytracingSSR'),
        raytracingSSREnabled: pp.raytracingSSREnabled,
        hasDepthTexture: !!pp.renderTarget.depthTexture,
        depthType: pp.renderTarget.depthTexture ? pp.renderTarget.depthTexture.type : null,
        uRaytracingSSR: pp.postMaterial.uniforms.uRaytracingSSR.value,
        inputChecked: input ? input.checked : null,
      };
    })()
  `);
  console.log('[Active SSR State]:', activeSSRState);

  if (activeSSRState.settingValue !== true) throw new Error('graphics.raytracingSSR non impostato a true');
  if (activeSSRState.raytracingSSREnabled !== true) throw new Error('pp.raytracingSSREnabled non abilitato');
  if (!activeSSRState.hasDepthTexture) throw new Error('DepthTexture non allocata dopo attivazione SSR');
  if (activeSSRState.uRaytracingSSR !== 1.0) throw new Error('uRaytracingSSR uniform non impostato a 1.0');
  if (activeSSRState.inputChecked !== true) throw new Error('Toggle input non sincronizzato con lo stato');

  console.log('✓ 3. Attivazione SSR e allocazione DepthTexture verificate con successo.');

  // 4. Chiudi impostazioni, avvia la spedizione ed esegui scavo per visualizzare rovine riflettenti
  console.log('[Browser QA] Chiusura impostazioni e avvio partita...');
  await cdp.eval(`
    (() => {
      if (window.__dds.menu && window.__dds.menu.settingsModal) {
        window.__dds.menu.settingsModal.close();
      } else if (window.__dds.hud && window.__dds.hud.settingsModal) {
        window.__dds.hud.settingsModal.close();
      }
      if (window.__dds.game && window.__dds.game.start) {
        window.__dds.game.start();
      }
    })()
  `);
  await sleep(1500);

  // Eseguiamo alcuni scavi per esporre rovine e piramidi
  console.log('[Browser QA] Scavo crateri per esporre le superfici riflettenti e fessure SSAO...');
  await cdp.eval(`
    (() => {
      const terrain = window.__dds.scene.terrain;
      if (terrain && terrain.dig) {
        terrain.dig(0, 0, 8.0, 5.0);
        terrain.flush();
      }
    })()
  `);
  await sleep(1500);

  // Cattura screenshot della scena in-game con SSR attivo
  await cdp.screenshot('dds_qa_ssr_reflections_hud.png');
  console.log('✓ 4. Rendering in-game con SSR e SSAO catturato con successo.');

  // 5. Test Disattivazione Dinamica (Verifica deallocazione VRAM / DepthTexture)
  console.log('[Browser QA] Disattivazione SSR per verificare pulizia risorse VRAM...');
  await cdp.eval(`
    (() => {
      window.__dds.settings.set('graphics.raytracingSSR', false);
    })()
  `);
  await sleep(300);

  const cleanedSSRState = await cdp.eval(`
    (() => {
      const pp = window.__dds.scene.postProcessing;
      return {
        settingValue: window.__dds.settings.get('graphics.raytracingSSR'),
        raytracingSSREnabled: pp.raytracingSSREnabled,
        hasDepthTexture: !!pp.renderTarget.depthTexture,
        uRaytracingSSR: pp.postMaterial.uniforms.uRaytracingSSR.value,
        dummyActive: pp.postMaterial.uniforms.tDepth.value === pp.dummyDepthTexture,
      };
    })()
  `);
  console.log('[Cleaned SSR State]:', cleanedSSRState);

  if (cleanedSSRState.hasDepthTexture) throw new Error('DepthTexture non è stata rilasciata dopo la disattivazione');
  if (cleanedSSRState.uRaytracingSSR !== 0.0) throw new Error('uRaytracingSSR non è tornato a 0.0');
  if (!cleanedSSRState.dummyActive) throw new Error('tDepth non è tornato al dummyDepthTexture 1x1');

  console.log('✓ 5. Rilascio completo DepthTexture e ripristino bypass verificati.');

  // 6. Verifica Integrità Console & Eccezioni Browser
  console.log('[Browser QA] Controllo errori di console ed eccezioni...');
  if (cdp.consoleErrors.length > 0) {
    throw new Error(`Rilevati ${cdp.consoleErrors.length} errori console: ${JSON.stringify(cdp.consoleErrors)}`);
  }
  if (cdp.pageErrors.length > 0) {
    throw new Error(`Rilevate ${cdp.pageErrors.length} eccezioni di pagina: ${JSON.stringify(cdp.pageErrors)}`);
  }
  console.log('✓ 6. 0 Errori console e 0 eccezioni browser verificati!');

  console.log('========================================================');
  console.log('  TEST BROWSER QA FASE 17 SUPERATO CON SUCCESSO AL 100%!');
  console.log('========================================================');

} catch (err) {
  console.error('[Browser QA Errore Critico]', err);
  process.exitCode = 1;
} finally {
  cdp.close();
  cleanup();
}

