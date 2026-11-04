// Entry point: boot -> caricamento -> menu. Nessun errore fatale: ogni modulo opzionale ha un fallback.
import { events } from './core/Events.js';
import { Logger } from './core/Logger.js';
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
import { DebugTools } from './core/DebugTools.js';
import { i18n } from './core/I18n.js';
import { StatsManager } from './core/StatsManager.js';
import { Achievements } from './systems/Achievements.js';
import { CosmeticsManager } from './systems/CosmeticsManager.js';
import { WardrobeModal } from './ui/WardrobeModal.js';
import { BiomeManager } from './world/BiomeManager.js';
import { BiomeSelectModal } from './ui/BiomeSelectModal.js';
import { Profiler } from './systems/Profiler.js';
import { ProfilerOverlay } from './ui/ProfilerOverlay.js';
import { Accessibility } from './core/Accessibility.js';
import { simulateProgression } from './systems/Economy.js';

window.addEventListener('error', (e) => console.error('[DDS] errore non gestito', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[DDS] promise rifiutata', e.reason));

async function boot() {
  Logger.init();

  if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const settings = new SettingsManager();
  const audio = new AudioEngine(settings);
  const save = new Save();
  const assets = new AssetLoader(settings);
  const modal = new ModalManager(document.getElementById('modal-root'));
  const statsManager = new StatsManager();

  // Inizializza lingua corrente da impostazioni
  i18n.settings = settings;
  i18n.lang = settings.get('game.language') || 'it';
  settings.subscribe('game.language', (l) => i18n.setLanguage(l));

  const achievements = new Achievements({ statsManager, save, audio });

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
    if (scene.ok) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth <= 1024);
      const maxDpr = isMobile ? Math.min(window.devicePixelRatio, 1.75) : Math.min(window.devicePixelRatio, 2.0);
      scene.renderer.setPixelRatio(maxDpr * (settings.get('graphics.renderScale') || 1));
      if (scene.maxAnisotropy) assets.setMaxAnisotropy(scene.maxAnisotropy);
      scene.start();
    }
    else scene = null;
  } catch (e) {
    console.error('[DDS] scena 3D non inizializzata', e);
    scene = null;
  }

  const settingsModal = new SettingsModal({ settings, modal, save, audio });
  const cosmeticsManager = new CosmeticsManager(save);
  const wardrobeModal = new WardrobeModal(modal, cosmeticsManager, save, audio, null);
  const biomeManager = new BiomeManager(save, statsManager);
  const biomeSelectModal = new BiomeSelectModal(biomeManager, save, statsManager, audio, null);
  const menu = new MainMenu(document.getElementById('menu'), {
    save, modal, settingsModal, audio, scene, statsManager, achievements, cosmeticsManager, wardrobeModal, biomeManager, biomeSelectModal,
  });
  biomeSelectModal.onConfirmBiome = (chosenBiome) => menu.startNewExpedition(chosenBiome);
  document.addEventListener('dds:save-cleared', () => menu.refresh());

  // Fase 1: "Nuova Spedizione" / "Continua" (eventi game:new / game:continue) avviano la partita.
  const game = new Game({
    scene, settings, audio, save, modal, settingsModal, menu,
    canvas: document.getElementById('game'),
    hudRoot: document.getElementById('hud'),
    cosmeticsManager, wardrobeModal, biomeManager,
  });
  settingsModal.game = game;

  // Suite di Debug e Memory Audit (Fase 7)
  const debugTools = new DebugTools({ game, scene, state: game.state, save, audio });
  game.debugTools = debugTools;

  // Suite Diagnostica Hardware & Profiler WebGL (Fase 16)
  const profiler = new Profiler({ renderer: scene?.renderer, settings });
  const profilerOverlay = new ProfilerOverlay({ profiler });
  if (scene) scene.setProfiler(profiler);

  // Accessibilità e Comfort Visivo (Fase 19: Reduced Motion & Smart Pause)
  const accessibility = new Accessibility({ settings, audioEngine: audio, sceneMgr: scene, game });

  // Scorciatoia da tastiera F3 per attivazione/disattivazione rapida
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F3' || e.code === 'F3') {
      e.preventDefault();
      const next = !settings.get('graphics.showProfiler');
      settings.set('graphics.showProfiler', next);
    }
  });

  // Hook di debug per i test.
  window.__dds = { settings, settingsModal, audio, save, scene, assets, menu, game, debugTools, statsManager, achievements, cosmeticsManager, wardrobeModal, biomeManager, biomeSelectModal, i18n, profiler, profilerOverlay, accessibility, simulateProgression };
  window.__DDS_DEBUG = window.__DDS_DEBUG || {};
  window.__DDS_DEBUG.simulateProgression = simulateProgression;

  await startClicked;
  menu.show();
}

boot().catch((e) => {
  console.error('[DDS] boot fallito', e);
});
