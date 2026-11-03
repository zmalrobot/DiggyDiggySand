// Entry point: boot -> caricamento -> menu. Nessun errore fatale: ogni modulo opzionale ha un fallback.
import { events } from './core/Events.js';
import { SettingsManager } from './core/SettingsManager.js';
import { AudioEngine } from './core/AudioEngine.js';
import { AssetLoader } from './core/AssetLoader.js';
import { Save } from './core/Save.js';
import { SceneManager } from './world/SceneManager.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { MainMenu } from './ui/MainMenu.js';
import { SettingsModal } from './ui/SettingsModal.js';
import { ModalManager } from './ui/Modal.js';
import { Game } from './core/Game.js';

window.addEventListener('error', (e) => console.error('[DDS] errore non gestito', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[DDS] promise rifiutata', e.reason));

async function boot() {
  const settings = new SettingsManager();
  const audio = new AudioEngine(settings);
  const save = new Save();
  const assets = new AssetLoader();
  const modal = new ModalManager(document.getElementById('modal-root'));

  // Suoni UI procedurali (attivi solo dopo lo sblocco dell'AudioContext).
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('.btn:not(:disabled), .tab');
    if (el && !el.contains(e.relatedTarget)) audio.playHover();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('.btn:not(:disabled), .tab, .toggle')) audio.playClick();
  });

  const loading = new LoadingScreen(document.getElementById('loading'));
  const loadPromise = assets.loadAll();
  const startClicked = loading.run(assets.manager, loadPromise, { audio, getReport: () => assets.report });

  await loadPromise;

  let scene = null;
  try {
    scene = new SceneManager(document.getElementById('game'), settings, assets);
    if (scene.ok) scene.start();
    else scene = null;
  } catch (e) {
    console.error('[DDS] scena 3D non inizializzata', e);
    scene = null;
  }

  const settingsModal = new SettingsModal({ settings, modal, save, audio });
  const menu = new MainMenu(document.getElementById('menu'), { save, modal, settingsModal, audio, scene });
  document.addEventListener('dds:save-cleared', () => menu.refresh());

  // Fase 1: "Nuova Spedizione" / "Continua" (eventi game:new / game:continue) avviano la partita.
  const game = new Game({
    scene, settings, audio, save, modal, settingsModal, menu,
    canvas: document.getElementById('game'),
    hudRoot: document.getElementById('hud'),
  });

  await startClicked;
  menu.show();

  // Hook di debug per i test.
  window.__dds = { settings, audio, save, scene, assets, menu, game };
}

boot().catch((e) => {
  console.error('[DDS] boot fallito', e);
});
