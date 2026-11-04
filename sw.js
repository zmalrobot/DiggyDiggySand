// Service Worker PWA per "Diggy Diggy Sand" — Gold Master v1.0.0
// Strategia: Cache-First con Network Fallback per funzionamento offline completo a zero latenza.

const CACHE_NAME = 'dds_cache_v1.0.0';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './assets/icons/icon.svg',
  './assets/manifest.json',

  // Vendor Three.js r160 locale
  './vendor/three/three.module.js',
  './vendor/three/addons/controls/OrbitControls.js',
  './vendor/three/addons/loaders/GLTFLoader.js',
  './vendor/three/addons/utils/BufferGeometryUtils.js',

  // Core moduli JS
  './js/main.js',
  './js/core/Accessibility.js',
  './js/core/AssetLoader.js',
  './js/core/AudioEngine.js',
  './js/core/DebugTools.js',
  './js/core/DisposeUtils.js',
  './js/core/Events.js',
  './js/core/Game.js',
  './js/core/Haptics.js',
  './js/core/I18n.js',
  './js/core/Logger.js',
  './js/core/Save.js',
  './js/core/SaveSerializer.js',
  './js/core/SettingsManager.js',
  './js/core/State.js',
  './js/core/StatsManager.js',

  // Sistemi
  './js/systems/Achievements.js',
  './js/systems/CosmeticsManager.js',
  './js/systems/Digging.js',
  './js/systems/Directives.js',
  './js/systems/Economy.js',
  './js/systems/Foreshadowing.js',
  './js/systems/Prestige.js',
  './js/systems/Profiler.js',
  './js/systems/Upgrades.js',
  './js/systems/Workers.js',
  './js/systems/WorldEvents.js',

  // Interfaccia UI
  './js/ui/BiomeSelectModal.js',
  './js/ui/CreditsModal.js',
  './js/ui/DirectivesWidget.js',
  './js/ui/EventBanner.js',
  './js/ui/FloatingText.js',
  './js/ui/GalleryModal.js',
  './js/ui/HelpModal.js',
  './js/ui/Hud.js',
  './js/ui/LoadingScreen.js',
  './js/ui/MainMenu.js',
  './js/ui/Modal.js',
  './js/ui/Overlay.js',
  './js/ui/PauseMenu.js',
  './js/ui/PrestigeModal.js',
  './js/ui/ProfilerOverlay.js',
  './js/ui/SettingsModal.js',
  './js/ui/Shop.js',
  './js/ui/StatsModal.js',
  './js/ui/Toast.js',
  './js/ui/Tutorial.js',
  './js/ui/WardrobeModal.js',

  // Mondo 3D & Grafica
  './js/world/Atmosphere.js',
  './js/world/BiomeManager.js',
  './js/world/Camera.js',
  './js/world/City.js',
  './js/world/DayNightCycle.js',
  './js/world/DisposeUtils.js',
  './js/world/Particles.js',
  './js/world/PostProcessing.js',
  './js/world/ProceduralFactory.js',
  './js/world/SceneManager.js',
  './js/world/Sky.js',
  './js/world/Terrain.js',
  './js/world/TextureGenerator.js',
  './js/world/Torches.js',

  // Finali
  './js/endings/BusinessEnding.js',
  './js/endings/CurseEnding.js',
  './js/endings/EndingManager.js',
  './js/endings/SecretEnding.js',
  './js/endings/TreasureEnding.js',
];

// 1. Installazione e precaching degli asset core
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        // Ignora errori su singoli asset facoltativi
        return Promise.all(
          CORE_ASSETS.map((url) => cache.add(url).catch(() => {}))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Attivazione e pulizia delle cache obsolete (dds_cache_v*)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k.startsWith('dds_cache_') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Strategia Fetch: Cache-First con Network Fallback e caching dinamico
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cache-First per asset locali e Google Fonts
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        // Salva in cache dinamica le risorse GET valide
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Fallback navigazione offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

