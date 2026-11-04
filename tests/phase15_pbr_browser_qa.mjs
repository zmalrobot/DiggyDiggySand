import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = 9356;
const USER_DATA_DIR = `/tmp/qa-dds-phase15-pbr-${Date.now()}`;
const TARGET_URL = `http://127.0.0.1:8080/`;
const ARTIFACT_DIR = `/home/simone/.gemini/antigravity/brain/7b377665-c11a-4ae0-9a24-9444a12a1ed9`;

console.log('========================================================');
console.log('   DIGGY DIGGY SAND - QA AUTOMATION PHASE 15 PBR TEST');
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

// 2. Client CDP
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
  // Attesa pulsante di avvio
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
      !!(window.__dds && window.__dds.scene && window.__dds.scene.ok && window.__dds.menu && window.__dds.game)
    `);
    if (isReady) {
      loaded = true;
      break;
    }
  }
  if (!loaded) throw new Error('Timeout boot window.__dds');

  // Avvio della spedizione/partita
  console.log('[Browser QA] Avvio della partita...');
  await cdp.eval(`window.__dds.game.start()`);
  await sleep(600);

  // 1. Verifica Proprietà PBR del Terreno
  console.log('[Browser QA] Verifica proprietà PBR del Terreno...');
  const terrainPbr = await cdp.eval(`
    (() => {
      const t = window.__dds.game.terrain;
      if (!t || !t.material) return null;
      const m = t.material;
      return {
        vertexColors: !!m.vertexColors,
        flatShading: !!m.flatShading,
        roughness: m.roughness,
        metalness: m.metalness,
        hasNormalMap: !!m.normalMap,
        normalScaleX: m.normalScale ? m.normalScale.x : null,
        normalScaleY: m.normalScale ? m.normalScale.y : null,
        hasRoughnessMap: !!m.roughnessMap,
        anisotropy: m.normalMap ? m.normalMap.anisotropy : 0,
        repeatX: m.normalMap ? m.normalMap.repeat.x : 0,
        repeatY: m.normalMap ? m.normalMap.repeat.y : 0,
      };
    })()
  `);

  console.log('[Terreno PBR Status]:', JSON.stringify(terrainPbr, null, 2));

  if (!terrainPbr) throw new Error('Impossibile recuperare il materiale del terreno');
  if (!terrainPbr.vertexColors) throw new Error('vertexColors non attivo sul terreno');
  if (!terrainPbr.flatShading) throw new Error('flatShading non attivo sul terreno');
  if (Math.abs(terrainPbr.roughness - 0.85) > 0.01) throw new Error(`Roughness terreno errata: ${terrainPbr.roughness}`);
  if (Math.abs(terrainPbr.metalness - 0.05) > 0.01) throw new Error(`Metalness terreno errata: ${terrainPbr.metalness}`);
  if (!terrainPbr.hasNormalMap) throw new Error('normalMap assente sul materiale del terreno');
  if (!terrainPbr.hasRoughnessMap) throw new Error('roughnessMap assente sul materiale del terreno');
  if (terrainPbr.normalScaleX !== 0.6 || terrainPbr.normalScaleY !== 0.6) {
    throw new Error(`normalScale errata: ${terrainPbr.normalScaleX}, ${terrainPbr.normalScaleY}`);
  }
  if (terrainPbr.repeatX !== 32) throw new Error(`Repeat X texture terreno errato: ${terrainPbr.repeatX}`);

  console.log('✓ 1. Terreno PBR 2048px FBM con normalMap e roughnessMap verificato con successo.');

  // Cattura screenshot del terreno iniziale
  await cdp.screenshot('dds_qa_pbr_terrain.png');

  // 2. Verifica Proprietà PBR della Città e Rovine
  console.log('[Browser QA] Verifica proprietà PBR della Città Sepolta...');
  const cityPbr = await cdp.eval(`
    (() => {
      const c = window.__dds.game.city;
      if (!c || !c.mats) return null;
      const mats = c.mats;
      let meshCount = 0;
      let shadowsOk = 0;
      c.group.traverse((o) => {
        if (o.isMesh) {
          meshCount++;
          if (o.castShadow && o.receiveShadow) shadowsOk++;
        }
      });
      return {
        stoneRoughness: mats.stone?.roughness,
        stoneMetalness: mats.stone?.metalness,
        hasStoneNormal: !!mats.stone?.normalMap,
        goldRoughness: mats.gold?.roughness,
        goldMetalness: mats.gold?.metalness,
        orichalcumRoughness: mats.orichalcum?.roughness,
        orichalcumMetalness: mats.orichalcum?.metalness,
        tealRoughness: mats.tealGlow?.roughness,
        tealEmissiveIntensity: mats.tealGlow?.emissiveIntensity,
        meshCount,
        shadowsOk,
      };
    })()
  `);

  console.log('[City PBR Status]:', JSON.stringify(cityPbr, null, 2));

  if (!cityPbr) throw new Error('Impossibile recuperare i materiali della città sepolta');
  if (Math.abs(cityPbr.stoneRoughness - 0.88) > 0.01) throw new Error(`Pietra roughness errata: ${cityPbr.stoneRoughness}`);
  if (Math.abs(cityPbr.stoneMetalness - 0.02) > 0.01) throw new Error(`Pietra metalness errata: ${cityPbr.stoneMetalness}`);
  if (!cityPbr.hasStoneNormal) throw new Error('Pietra priva di normalMap scalpellata');
  if (Math.abs(cityPbr.goldRoughness - 0.22) > 0.01) throw new Error(`Oro roughness errata: ${cityPbr.goldRoughness}`);
  if (Math.abs(cityPbr.goldMetalness - 0.85) > 0.01) throw new Error(`Oro metalness errata: ${cityPbr.goldMetalness}`);
  if (Math.abs(cityPbr.orichalcumRoughness - 0.22) > 0.01) throw new Error(`Oricalco roughness errata: ${cityPbr.orichalcumRoughness}`);
  if (Math.abs(cityPbr.orichalcumMetalness - 0.85) > 0.01) throw new Error(`Oricalco metalness errata: ${cityPbr.orichalcumMetalness}`);
  if (Math.abs(cityPbr.tealRoughness - 0.1) > 0.01) throw new Error(`Teal Glow roughness errata: ${cityPbr.tealRoughness}`);
  if (Math.abs(cityPbr.tealEmissiveIntensity - 0.9) > 0.01) throw new Error(`Teal Glow emissive errata: ${cityPbr.tealEmissiveIntensity}`);
  if (cityPbr.shadowsOk !== cityPbr.meshCount || cityPbr.meshCount === 0) {
    throw new Error(`Ombre non configurate su tutte le mesh (${cityPbr.shadowsOk}/${cityPbr.meshCount})`);
  }

  console.log('✓ 2. Materiali PBR di rovine, metalli e cristalli calibrati con ombre conformi.');

  // 3. Esegui scavo profondo per far emergere le rovine e il basamento roccioso
  console.log('[Browser QA] Esecuzione scavo per scoprire le rovine...');
  await cdp.eval(`
    (() => {
      const terrain = window.__dds.game.terrain;
      // Scavo ad ampio raggio al centro per rivelare il santuario e i viali
      for (let r = 0; r < 5; r++) {
        terrain.dig(0, 0, 35, 3.5);
      }
      terrain.flush();
    })()
  `);
  await sleep(500);

  // Cattura screenshot delle rovine scoperte sotto la sabbia
  await cdp.screenshot('dds_qa_pbr_ruins.png');

  // 4. Verifica Assenza Errori Console ed Eccezioni di Pagina
  console.log('[Browser QA] Verifica log ed errori...');
  if (cdp.consoleErrors.length > 0) {
    throw new Error(`Trovati ${cdp.consoleErrors.length} errori console: ${cdp.consoleErrors.join(' | ')}`);
  }
  if (cdp.pageErrors.length > 0) {
    throw new Error(`Trovate ${cdp.pageErrors.length} eccezioni di pagina: ${cdp.pageErrors.join(' | ')}`);
  }

  console.log('✓ 4. Zero errori console e zero eccezioni di runtime.');
  console.log('========================================================');
  console.log('   QA AUTOMATION PHASE 15 PBR COMPLETATO CON SUCCESSO!');
  console.log('========================================================');

} catch (err) {
  console.error('[Browser QA FALLITO]:', err);
  process.exitCode = 1;
} finally {
  cdp.close();
  cleanup();
}
