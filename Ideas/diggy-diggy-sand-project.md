# Diggy Diggy Sand — Game Design & Technical Document

> **Title:** *Diggy Diggy Sand*
> **Genre:** Incremental / Clicker 3D game with multiple random endings
> **Platform:** Web browser (desktop and mobile)
> **Technologies:** HTML, CSS, JavaScript, Three.js

---

## 1. Pitch

A huge desert. A shovel. One dream: **empty the entire desert**.

The player digs sand, turns it into resources, and buys upgrades to dig faster and faster, until a buried city is revealed underneath. But what is really down there? The ending is **chosen randomly at the start of every new game**, so no run is the same and the player never knows what to expect until the very end.

**In one sentence:** *a relaxing incremental game where you dig up an entire desert, with a different plot twist every time.*

---

## 2. Design Pillars

1. **Satisfying digging.** Every click must give visual, audio, and numeric feedback.
2. **Visible progress.** The desert really empties in 3D: the player sees the pit grow.
3. **Mystery.** What is underneath? The player should want to keep digging to find out.
4. **Replayability.** Four very different endings (Curse, Treasure, Business, and the secret Ascension), plus 4 alternate expedition biomes.
5. **Simplicity.** Few, clear mechanics, suitable for short sessions, including on a phone.
6. **Light tone.** A touch of humor, even in the darkest endings.

---

## 3. Core Loop

```
   DIG SAND  ──►  ACCUMULATE SAND  ──►  BUY UPGRADES
        ▲                                     │
        └────────── dig faster ◄──────────────┘

   Desert empties  ──►  city appears  ──►  ENDING
```

**Target length of one run:** 30–45 minutes (adjustable through balancing).

---

## 4. Gameplay Mechanics

### 4.1 Digging

- **Click / tap:** digs one spot on the terrain.
- **Hold:** continuous digging (at a rate determined by upgrades).
- Digging lowers the terrain in a circular area with soft edges (falloff), so the pit looks natural.
- Under the sand there is a **floor** (bedrock / the city's ground) that cannot be dug through.
- Every unit of sand removed is converted into **Sand** (the game's currency).

### 4.2 Currency

- **Sand:** the only currency, earned by digging.
- Light lore: the sand is sold to construction sites, so the more you dig, the more you earn.

### 4.3 Upgrades

Cost of level *n*: `cost = baseCost × 1.15^n` (the multiplier can vary per upgrade).

| Upgrade | Effect | Base cost | Notes |
|---|---|---|---|
| **Better Shovel** | +1 sand per hit | 10 | The first purchase, teaches the system |
| **Dig Rate** | More hits per second (while holding) | 40 | Reduces the delay between hits |
| **Dig Radius** | Wider area per hit | 75 | Also changes the look of the pit |
| **Workers** | Dig on their own at random spots | 150 | 3D worker figures appear and dig |
| **Excavator** | Automatic digging with a large radius | 2,500 | Animated 3D model |
| **Giant Dredge** | Digs huge amounts | 50,000 | Late-game |
| **Dynamite** | Instant crater (single use) | 500 | Explosion effect, paid recharge |
| **Georadar** *(optional)* | Shows mysterious signals under the sand | 5,000 | Ambiguous hints, see section 5 |

> These numbers are a starting point and must be balanced through playtesting.

### 4.4 Progress and Layers

The desert is dug layer by layer to create a sense of advancement:

| Layer | Look | Function |
|---|---|---|
| 1. Fine sand | Light yellow | Fast digging, early game |
| 2. Compact sand | Orange | Slower digging, difficulty increases |
| 3. Ruins | Stone, bricks, columns poking out | The city emerges, mystery begins |

**Completion bar:** percentage of sand removed compared with the initial volume. At **100%** (or at a threshold like 98%, with automatic cleanup of the remainder) the ending is triggered.

### 4.5 Optional Events (future version)

- **Sandstorm:** partially refills the pit. Use with caution since it can feel frustrating. It could be countered with a dedicated upgrade.
- **Nomad merchant:** sells rare upgrades or gives temporary bonuses.

---

## 5. The Endings

At the start of **every new game**, the game randomly picks an ending and saves it (together with a seed). The player does not know which one it is until the city is uncovered.

### 5.1 Ending A — The Curse

**Idea:** by uncovering the city, the player releases something that should have stayed buried.

- **Trigger:** at 100% the city is fully visible, with a seal / sarcophagus / obelisk at its center. The last shovel hit breaks it.
- **Two variants (chosen randomly between them):**
  - **Plagues of Egypt:** the sky turns red, then plagues follow one after another: water turning to blood, frogs, locusts, darkness. Each plague is a visual effect (particles, color filter, sound).
  - **Cosmic horror (Cthulhu-style):** the pit turns into an abyss, tentacles rise from the bottom, the sky warps, the stars shift position.
- **Epilogue:** end screen with ironic text, for example *"Maybe you should have left the desert where it was."*
- **Intended feeling:** shock, a little fear, a little laughter.

### 5.2 Ending B — The Treasure

**Idea:** the city hides incredible riches.

- **Trigger:** at 100% the city shines with gold and gemstones.
- **Sequence:**
  - A rain of coins and precious stones with glowing particles.
  - Mini-interaction: the player can **click the gems** to collect them and watch the total rise.
  - End screen showing the total value of the treasure.
- **Epilogue:** *"You're filthy rich. Now what will you do with all this sand?"*
- **Intended feeling:** satisfaction, reward.

### 5.3 Ending C — The Digging Business

**Idea:** there is **nothing** under the sand. But the player now owns a massive fleet of expensive equipment...

- **Trigger:** at 100% a flat expanse of bare rock is revealed. The only find is a plastic bucket or a rusty sign (visual gag).
- **Twist:** the message *"You own a lot of expensive equipment. Why not put it to use?"* appears and the game switches to a **tycoon mode**:
  - Digging contracts for clients (swimming pools, foundations, underground parking, tunnels).
  - Upgrades become a **fleet of vehicles** to manage.
  - Reputation and new types of clients.
- **Epilogue:** screen reading *"Your excavation company is open for business!"*, with the option to keep playing in free mode.
- **Intended feeling:** irony, plus an unexpected second game.

### 5.4 Ending D — The Secret Ending (The Ascension of Atlantis)

**Idea:** by uncovering all previous truths, the player awakens the living, slumbering heartbeat of the ancient city.

- **Trigger:** Unlocked only after completing all three base endings (`endingsSeen.length >= 3`). At 100% completion, the central monolith begins humming with resonant Atlantean frequency.
- **Sequence:**
  - The floor cracks open, emitting colossal geysers of glowing cyan light.
  - The orichalcum core awakens, levitating monoliths and stone blocks into the celestial sky.
  - The night sky is pierced by vertical teal beams and aurora waves.
- **Epilogue:** *"The city sleeps no more. Atlantis ascends into the celestial heavens."*
- **Intended feeling:** awe, wonder, true ultimate triumph.

### 5.5 How the Random Choice Works

```js
// js/endings/EndingManager.js
export const ENDINGS = [
  { id: 'curse',    weight: 1 },
  { id: 'treasure', weight: 1 },
  { id: 'business', weight: 1 },
];

// Seeded pseudo-random number generator (mulberry32)
export function makeRng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickEnding(seed, endingsSeen = []) {
  // If player has discovered all 3 base endings, unlock Secret Ending
  const pool = [...ENDINGS];
  if (endingsSeen.includes('curse') && endingsSeen.includes('treasure') && endingsSeen.includes('business')) {
    pool.push({ id: 'secret', weight: 1 });
  }

  const rng = makeRng(seed);
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of pool) {
    if ((r -= e.weight) < 0) return e.id;
  }
  return pool[0].id;
}
```

The `seed` and the chosen ending are stored in the save data, so reloading the page does not change the ending (and the player cannot "reroll" by refreshing).

### 5.6 Hints and Foreshadowing

To avoid spoiling too much, hints appear **only after about 60% completion** and are deliberately ambiguous:

| Ending | Subtle hint |
|---|---|
| Curse | Unnatural wind, distant whispers, symbols carved into the ruins, slightly reddish light |
| Treasure | Glints in the sand, isolated coins surfacing, metallic sounds |
| Business | No hints. Silence is the hint |
| Secret | Pulsing cyan leyline ripples, weightless sand grains, harmonic subterranean drone |

The **Georadar** can give ambiguous readings such as "anomaly detected" or "weak signal". It can also be somewhat unreliable: it is a curiosity, not a trustworthy spoiler.

### 5.7 Meta-Progression & Ancient Tablets ($\tau$)

- **Endings gallery:** endings already seen are saved and shown in the menu (1/4, 2/4, 3/4, 4/4).
- **Ancient Tablets ($\tau$):** completing an expedition awards meta-currency $\tau$ based on speed and new endings discovered, used in the *Ancestral Sanctuary* for permanent meta-perks across all runs.
- **Wardrobe & Custom Skins:** players can unlock custom shovels, sand skins, and automaton models using $\tau$ and achievements.

### 5.8 Cheat System & Permanent Achievement Lockout

- **Settings "Trucchi" Tab:** dedicated visual controls for sandbox/debug (add sand, force completion 50%/95%/99%, force climax ending, trigger sandstorm/merchant, God Mode super shovel, max all upgrades).
- **Irreversible Confirmation Modal:** the first interaction with any cheat requires explicit confirmation:
  > *"Attenzione: Modalità Trucchi - L'attivazione dei trucchi disabiliterà definitivamente lo sblocco di tutti gli Obiettivi per questa spedizione. Continuare?"*
- **Permanent Lockout:** once confirmed, `state.cheatsEnabled = true` is immediately written to persistent storage (`dds_save_v1`). `Achievements.js` immediately halts all unlocks (`if (state.cheatsEnabled) return;`), the HUD displays a warning badge `.hud-cheats-badge`, and the Trophy screen shows `.cheats-lockout-banner`.

---

## 6. Look, Feel, and Interface

### 6.1 Visual Style

- **Soft low-poly** with warm colors, inspired by relaxing games.
- Directional sunlight with shadows, gradient sky, light fog on the horizon.
- Sand color varies by height and by layer.
- Sand particles on every hit.
- Atmosphere changes during the endings (red sky, golden glow, etc.).

### 6.2 Camera & Interaction Controls

- Tilted top-down view with dynamic vertical FOV compensation (`updateProjectionMatrix()`) to prevent side clipping on vertical smartphone screens ($9:16$ and $9:19.5$) and ultrawide desktop monitors ($21:9$).
- Clicking on the terrain executes an analytical raycast on the active heightmap mesh to pinpoint exact crater coordinates.
- **Adaptive Multi-Touch Controls:**
  - *Single Touch / Click:* excavation with tactile haptic impulse (`Haptics.js`). Holding down triggers continuous excavation at kinetic rhythm rate.
  - *Two Fingers:* multi-touch pinch-to-zoom (Euclidean finger distance calculation) and two-finger drag for orbiting camera angle and pan.

### 6.3 HUD

- **Top:** Sand counter, desert completion bar, SPS meter, and temporary storm/buff badges.
- **Left:** Compact retractable Expedition Directives widget (`DirectivesWidget.js`) tracking active contracts and countdown timers.
- **Right / Bottom:** Quick action buttons for **Officina (Shop)**, **Pause / Settings**, and **Help / Legend**.
- **Shop:** multi-tab drawer with Multi-Buy toggle (`1x`, `10x`, `100x`, `MAX`), upgrade cards, and Relics threshold unlocking.

### 6.4 Audio

- Digging sound with procedural pitch modulation and depth low-pass filtering (`setDepth()`) as excavation approaches bedrock.
- Dual-track sound engine: lightweight sampled OGG loops with instantaneous procedural fallback (`SoundSynth` via Web Audio API).
- Relaxing ambient music that evolves dynamically with the diurnal cycle and climax endings.

### 6.5 Responsive 3-Tier Architecture

The entire interface dynamically conforms to three distinct hardware form factors without DOM element duplication:
1. **Tier 1 — Desktop ($\ge 1025\text{px}$):**
   - Full horizontal HUD topbar across the top edge.
   - Lateral slide-out Shop drawer on the right side ($380\text{px}$ width).
   - Fixed-width centered ceremonial glassmorphism modal dialogs ($680\text{px}$).
   - Desktop shortcuts: `Space` (instant dig), `Q`/`E` (orbit camera), `F2` (debug console), `F3` (hardware profiler).
2. **Tier 2 — Tablet ($601\text{px} - 1024\text{px}$):**
   - Enlarged interactive touch targets ($\ge 44\text{px} \times 44\text{px}$) across all buttons, tabs, and toggles.
   - Landscape orientation: lateral Shop drawer occupying $45\%$ of screen width.
   - Portrait orientation: bottom sheet Shop extending to $55\%$ of screen height.
   - Ergonomic lateral margins preventing accidental finger palm touches along the bezel.
3. **Tier 3 — Smartphone ($\le 600\text{px}$):**
   - **Safe Area Insets:** strict integration of `padding-top: max(10px, env(safe-area-inset-top))` and `padding-bottom: max(10px, env(safe-area-inset-bottom))` to respect camera notches, dynamic islands, and OS gesture bars.
   - **Mobile Bottom Sheet:** the Shop transforms into an animated pull-up bottom drawer with rounded top corners ($20\text{px}$ radius) and a tactile visual drag handle.
   - **Compact Mobile HUD:** grouped metrics (Sand, SPS, % completion) in a single-row centered glass bar with scaled typography (`Syne` numbers), maintaining an unobstructed excavation field.

---

## 7. Technical Architecture

### 7.1 Stack

- **HTML** for structure and interfaces (HUD, shop, menus as DOM elements over the canvas).
- **CSS** for styling the interfaces.
- **JavaScript** (ES modules) for all logic.
- **Three.js** for 3D rendering.
- No build step required: an import map loading Three.js from a CDN at a **pinned version**, or Vite if a more convenient workflow is preferred.

### 7.2 Folder Structure

```
/diggy-diggy-sand
├── index.html
├── manifest.json                // PWA Web App Manifest
├── sw.js                        // Root PWA Service Worker (Cache-First + Network Fallback)
├── css/
│   └── style.css                // Brand Book Atlantean-Kemet, Glassmorphism, 3-Tier Responsive UI
├── js/
│   ├── main.js                  // Entry point, initialization, window.__dds debug
│   ├── core/
│   │   ├── Game.js              // Game loop coordination & camera frustum
│   │   ├── State.js             // Game state, cheatsEnabled flag, upgrade levels, relic multipliers
│   │   ├── Save.js              // LocalStorage persistence, backup restore & schema check
│   │   ├── SaveSerializer.js    // Portable Save Import/Export (Base64 + CRC32 verification)
│   │   ├── Events.js            // Event bus
│   │   ├── SettingsManager.js   // Reactive settings, audio/graphics/cheats bindings
│   │   ├── AudioEngine.js       // SoundSynth Web Audio & dual-path sampled audio loader
│   │   ├── AssetLoader.js       // GLTF loading manager with procedural 3D fallbacks
│   │   ├── I18n.js              // Bilingual dictionary (IT / EN) & localization
│   │   ├── Haptics.js           // Tactile kinetic vibration engine for touch devices
│   │   ├── Formatters.js        // Number notation (standard compact K/M/B/T vs scientific 1.25e6)
│   │   ├── Accessibility.js     // Reduced motion dampening & smart tab pause with dt clamping
│   │   └── Logger.js            // Production logger & styled Gold Master boot banner
│   ├── world/
│   │   ├── Terrain.js           // Heightmap, procedural dunes, O(k) sub-grid normals, biomes
│   │   ├── TextureGenerator.js  // Procedural 2048px FBM & analytical Sobel normal maps
│   │   ├── City.js              // Procedural buried city & ending architectural variants
│   │   ├── SceneManager.js      // 3D scene, responsive camera FOV, lighting & shadows
│   │   ├── BiomeManager.js      // Expedition biomes (Desert, Ocean, Glacier, Jungle)
│   │   ├── DayNightCycle.js     // Dynamic solar/lunar orbit, atmosphere & ambient floor
│   │   ├── Sky.js               // Procedural starfield dome & celestial moon
│   │   ├── Torches.js           // Ruin torches with night flicker PointLights
│   │   ├── Atmosphere.js        // Floating dust motes (InstancedMesh)
│   │   ├── PostProcessing.js    // MSAA 4x, FXAA, Selective Bloom, DepthTexture, SSR & SSAO
│   │   ├── DisposeUtils.js      // Recursive GPU memory disposal (geometries, materials, textures)
│   │   └── ProceduralFactory.js // Mathematical low-poly fallback 3D meshes
│   ├── systems/
│   │   ├── Digging.js           // Raycasting, anti-tunneling clamp Y>=0, dynamic bounds
│   │   ├── Economy.js           // Offline progression, decoupled ticks & simulateProgression()
│   │   ├── Upgrades.js          // Multi-buy math, geometric cost scaling & SPS calculations
│   │   ├── Workers.js           // 3D workers & excavator fleet synchronization
│   │   ├── Particles.js         // 300-capacity instanced particle pool
│   │   ├── Directives.js        // Dynamic expedition bounties with rotating objectives & buffs
│   │   ├── Profiler.js          // F3 WebGL runtime telemetry, framerate & memory profiler
│   │   ├── Achievements.js      // Trophy unlock manager & cheats lockout guard
│   │   ├── StatsManager.js      // Expedition metrics, clicks, playtime & records
│   │   ├── CosmeticsManager.js  // Wardrobe skins catalog (shovels, sands, automatons)
│   │   ├── WorldEvents.js       // Dynamic sandstorms & nomad merchants
│   │   ├── DebugTools.js        // F2 console tools & memory leak auditor
│   │   └── Tutorial.js          // Onboarding tutorial lifecycle
│   ├── endings/
│   │   ├── EndingManager.js     // Ending picker & climax director
│   │   ├── CurseEnding.js       // Cosmic horror & plagues
│   │   ├── TreasureEnding.js    // Golden coin cascade & gem clicking
│   │   ├── BusinessEnding.js    // Tycoon mode & sandbox contracts
│   │   └── SecretEnding.js      // Awakening of Atlantis & ascending monoliths
│   └── ui/
│       ├── Hud.js               // Topbar, cheats badge, SPS & completion meters
│       ├── Shop.js              // Upgrades drawer, Multi-Buy selector (1x/10x/100x/MAX) & Relics tab
│       ├── DirectivesWidget.js  // Compact HUD widget with contract progress & countdown
│       ├── FloatingText.js      // 3D-to-2D pooled floating damage & sand acquisition numbers
│       ├── Modal.js             // ModalManager dialogs & toast notifications
│       ├── SettingsModal.js     // Audio, Graphics, Controls, Language & Cheats tabs
│       ├── StatsModal.js        // Statistics overview & Trophies screen with lockout banner
│       ├── BiomeSelectModal.js  // Expedition destination picker
│       ├── GalleryModal.js      // Endings discovery showcase
│       ├── WardrobeModal.js     // Cosmetic customization interface
│       ├── HelpModal.js         // Contextual controls legend & gameplay guide
│       ├── CreditsModal.js      // Open source software attributions & legal licenses
│       ├── ProfilerOverlay.js   // Real-time canvas sparklines & hardware stats overlay
│       ├── PauseMenu.js         // In-game pause overlay
│       ├── LoadingScreen.js     // Monotonic loading bar & lore quotes
│       └── MainMenu.js          // Title screen & 3D background view
├── vendor/three/                // Pinned local copy of Three.js r160 & addons
└── assets/
    ├── audio/                   // SFX & ambient loops with SoundSynth fallback
    ├── textures/                // App icons & glyphs
    └── models/                  // CC0 3D models with ProceduralFactory fallback
```

### 7.3 The Terrain: Natural Procedural Dunes & Optimized Sub-Grid Normals

The terrain is built on a high-performance $256 \times 256$ heightmap deformed in real time:

- **Natural Procedural Dunes:** Rather than a flat, artificial initial plane (`startHeight = 12`), heights are initialized procedurally per biome via `getInitialBiomeHeightOffset(vx, vz, biome)`:
  - *Desert:* undulating sinusoidal dune ridges (`Math.sin(vx * 0.05) * 1.5 + Math.cos(vz * 0.03) * 1.2 + Math.sin((vx + vz) * 0.04) * 0.6`).
  - *Drained Ocean:* central sunken depression basin (`-2.8 * exp(-r²/3000)`) with seabed ripple ripples.
  - *Glacier:* angular, faceted permafrost ridges (`abs(sin)` & `abs(cos)`).
  - *Jungle:* organic root mounds and step elevation.
- **Accurate Initial Volume:** `initialVolume = sum((heights[i] - floor) * cellArea)`. As a result, the excavation progress `completion` starts at exactly `0.00%` and tracks every displaced cubic meter with precision.
- **Visual Style & Flat Shading:** All meshes utilize `MeshStandardMaterial` with `flatShading: true`, accentuating chiseled polygonal faces.
- **Sub-Grid Normal Recalculation $O(k)$:** Eliminates costly global `geometry.computeVertexNormals()` calls across all $65,536$ vertices on every click. Only the vertices within the localized bounding box `[dirtyIxMin, dirtyIzMin]` to `[dirtyIxMax, dirtyIzMax]` have their normal vectors analytically updated via `computeSubGridNormals()`, maintaining a rock-solid 60 FPS even during continuous rapid-fire excavation or dynamite blasts.
- **Anti-Tunneling & Bounding Box:** Vertex clamping guarantees $Y \ge 0$ (bedrock level), preventing the shovel from creating holes in the mesh. `updateBounds()` keeps raycaster intersections accurate even in the deepest excavation trenches.

### 7.4 Rendering Pipeline, Lighting, PBR & Post-Processing

- **Photometric Safety Floor (Ambient Floor):**
  - To prevent black screen rendering bugs on high settings or during the night cycle, an ambient base light `THREE.AmbientLight(0x0D131A, 0.15)` (`ambientFloor`) is permanently active in the scene.
  - Night sky hemispheric illumination is clamped to a minimum intensity $\ge 0.25$ with celestial blue `#1B2A40`, ensuring the terrain silhouette is always crisp and visible.
- **Tone Mapping & Anisotropy:**
  ```javascript
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // Anisotropia al massimo livello supportato dalla GPU fisica
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  texture.anisotropy = Math.min(maxAniso, 16);
  ```
- **Procedural PBR Material Engine (`TextureGenerator.js`):**
  - Generates high-definition $2048 \times 2048\text{px}$ seamless procedural noise textures directly on the client without external network latency.
  - Multi-octave Fractional Brownian Motion (FBM) with 4 octaves, persistence $0.5$, and lacunarity $2.0$.
  - Analytical Sobel Normal Map filtering computing tangent-space surface gradients ($dX, dY$) to produce tactile chiseled sandstone relief.
- **Post-Processing & Antialiasing (`PostProcessing.js`):**
  - Managed with an offscreen `THREE.WebGLRenderTarget` paired with a native `THREE.DepthTexture`.
  - **Hardware MSAA 4x:** configured with `samples: 4` on WebGL2 to eliminate geometric aliasing in offscreen passes.
  - **FXAA Shader Integration:** integrated Fast Approximate Anti-Aliasing pass based on luminance contrast, smoothing low-poly silhouette edges.
  - **Selective Bloom:** multi-tap radial bloom extracting only high-luminance emissive highlights (`uBloomThreshold: 0.85, uBloomIntensity: 0.4, uBloomRadius: 0.5`) such as Atlantean turquoise crystals and golden artifacts without darkening or overexposing the surrounding dunes.
  - **Screen-Space Reflections (SSR) & Ambient Occlusion (SSAO):**
    - Experimental optical pass using view-space depth reconstruction via `tDepth` buffer and inverse projection matrices.
    - Simulates specular raymarching reflections on polished metals (orichalcum, gold) and contact ambient occlusion in excavated craters and around ruin colonnades.
    - **Zero-Cost Bypass:** disabled by default in Settings (`graphics.ssrEnabled: false`); when turned off, the shader acts as an instantaneous zero-cost passthrough with zero GPU raymarching overhead.
  - **Opaque Buffer Output:** `gl_FragColor = vec4(finalColor, 1.0)` prevents zero-alpha canvas blackouts.
  - Disables completely with zero runtime overhead on Low/Mobile graphics settings.
- **Hardware Telemetry & Runtime Profiler (`Profiler.js` / `ProfilerOverlay.js`):**
  - Activated by pressing `F3` or via the Graphics Settings panel.
  - Real-time Canvas 2D sparkline monitoring instantaneous FPS, rolling 60-frame min/max frame time in milliseconds, GPU draw calls, rendered triangles, and VRAM texture memory consumption.

### 7.5 The Buried City

- A group of simple meshes (cube buildings, columns, a central area) placed **below** the initial sand level.
- As the terrain lowers, the buildings naturally emerge from the sand, with no special effects needed.
- For the **Business** ending the city **is not created**: only the flat floor remains (plus the bucket gag).
- For the **Curse** ending, a central element (seal / obelisk) is added. For the **Treasure** ending, scattered coins and gems and a chest are added.

### 7.6 State and Saving

```js
// js/core/State.js
export const state = {
  version: 1,
  seed: 0,
  endingId: null,        // 'curse' | 'treasure' | 'business'
  endingVariant: null,   // e.g. 'plagues' | 'cosmic' for the curse
  sand: 0,
  upgrades: {},          // { shovel: 3, digRate: 1, ... }
  completion: 0,
  heights: null,         // optional: terrain state (can be compressed)
  endingsSeen: [],       // for the endings gallery
};
```

- Automatic saving to `localStorage` every 10–15 seconds and when the page is closed.
- Saving the full terrain can be heavy. Options: save only dug areas, compress it, or save the list of hits and replay them on load.
- The state includes a `version` field to support future migrations.

### 7.6 Main Loop

```js
// js/main.js (outline)
const clock = new THREE.Clock();

function loop() {
  const dt = clock.getDelta();

  digging.update(dt);        // continuous digging while the button is held
  workers.update(dt);        // workers and excavators
  terrain.updateNormalsIfNeeded();
  endings.update(dt);        // checks thresholds and animates endings
  hud.update();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
```

### 7.7 Debug Tools

- URL parameter to force an ending during testing: `?ending=curse`, `?ending=treasure`, `?ending=business`.
- `?cheat=1` parameter to grant infinite sand or jump to 95% completion.
- FPS panel and counter of modified vertices.

---

## 8. Ending Handling in Code

Each ending is a module with the same interface:

```js
// Common interface
export class Ending {
  prepare(scene, terrain, state) {}   // adds elements to the scene at the start of the game
  onProgress(completion) {}           // hints and atmosphere based on progress
  trigger() {}                        // starts the final sequence
  update(dt) {}                       // animations
  dispose() {}                        // resource cleanup
}
```

- `EndingManager` picks the ending (`pickEnding(seed)`), instantiates it, and connects it to the game.
- When `terrain.completion >= 0.98`, `trigger()` is called.
- At the end, the seen ending is recorded and the closing screen is shown.

---

## 9. Development Roadmap (100% Implemented & Verified)

The project has fully executed all planned developmental milestones, verified with 92 automated unit tests and extensive headless browser QA audits:

### Phase 0 — Core Setup & Architecture
- [x] Full-screen responsive HTML5 canvas with glassmorphism UI.
- [x] Three.js r160 pinned local vendor integration via native ES Module import map.
- [x] Solid base folder structure, events bus, and state management.

### Phase 0.5 — 3D Title Menu & Synchronous Settings
- [x] 3D background crater with central obelisk, dynamic orbiting camera, and chiseled terrain.
- [x] Synchronous `SettingsManager` with immediate `localStorage` (`dds_settings_v1`) persistence.
- [x] `AudioEngine` with Web Audio API procedural sound synthesizer (`SoundSynth`) for click, hover, confirm, and warning SFX.

### Phase 1 — Digging & Physical Mechanics
- [x] Real-time deformable heightmap terrain with falloff math.
- [x] Analytical raycasting and click/hold excavation.
- [x] Instanced dust particles on impact and procedural dig audio.
- [x] Sand currency accumulation and exact completion percentage tracking.

### Phase 2 — Economy, Upgrades & 3D Fleet
- [x] Shop with tiered scaling upgrades (Shovel, Dig Rate, Radius).
- [x] Autonomous 3D workers and excavator fleet digging physically in the world.
- [x] Offline progress calculation with real `performance.now()` timestamps.

### Phase 3 — Procedural Buried City & Stratification
- [x] Monumental buried city emerging naturally as sand is excavated ($Y \le 8.8$).
- [x] Sand layer chromatic banding (Surface gold, Mid orange, Bedrock dark stone with teal veins).
- [x] Ambient foreshadowing hints triggering past 60% completion.

### Phase 4 — The Three Base Endings
- [x] Deterministic PRNG ending selection (`mulberry32`) tied to seed.
- [x] **Treasure Ending (`treasure`):** cascading gold coins, interactive gem clicking, and vault valuation.
- [x] **Curse Ending (`curse`):** red sky shift, blood rain, cosmic tentacles, and satirical epilogue.
- [x] **Business Ending (`business`):** industrial anticlimax, client contracts, fleet management, and sandbox mode.
- [x] Endings Gallery modal tracking discovered storylines.

### Phase 5 — Engine Hardening & Mobile Experience
- [x] 300-capacity bounded particle pool (`Particles.js`) preventing memory leaks.
- [x] Depth-based audio filtering (`setDepth`) modulating reverb as excavation deepens.
- [x] Guided onboarding tutorial with first-run completion flag.
- [x] Mobile touch gestures: single-finger dig, two-finger orbit/pan/zoom.

### Phase 6 — Meta-Progression & Ancient Tablets ($\tau$)
- [x] Ancient Tablets ($\tau$) awarded on completion for permanent New Game+ meta-perks.
- [x] **Secret Ending (4/4 - `secret`):** The Ascension of Atlantis unlocked after seeing all 3 base endings.
- [x] Dynamic desert events: Sandstorms (+50% bonus) and Nomad Merchant caravans.

### Phase 7 — Developer Diagnostics & Memory Profiling
- [x] Debug suite activated via `F2` or `~` and query params (`?debug=1`, `?cheat=1`, `?ending=...`).
- [x] Memory auditor (`getMemoryReport`) verifying clean GPU resource disposal on scene reset.

### Phase 8 — PWA Standalone & CI/CD Deployment
- [x] Web App Manifest with standalone display and Atlantean vector icons.
- [x] Automated GitHub Actions deployment pipeline to GitHub Pages.

### Phase 9 — Dual-Track Asset Pipeline & Procedural Fallbacks
- [x] Hybrid loading engine for 3D GLTF models and sampled OGG audio.
- [x] Zero-failure guarantee: automatic procedural fallbacks (`ProceduralFactory.js` and `SoundSynth`) on network timeouts or missing assets.

### Phase 10 — Internationalization & Achievement System
- [x] Complete bilingual dictionary (Italian & English) with instant reactive switching.
- [x] Expedition statistics recorder (clicks, playtime, sand excavated, historical records).
- [x] 10 diverse gameplay trophies with toast notifications and trophy room.

### Phase 11 — Dynamic Day/Night Cycle & Cosmetic Wardrobe
- [x] Continuous 4-minute solar/lunar orbit with dynamic shadow shifts.
- [x] Procedural celestial star dome and ruin torches with night flicker.
- [x] Wardrobe system for equipping custom shovels, sand skins, and automaton models.

### Phase 12 — Alternate Expedition Biomes
- [x] 4 Distinct playable biomes: Egyptian Desert, Drained Ocean, Archaic Glacier, Buried Jungle.
- [x] Biome-specific physical modifiers (+15% volume, +35% permafrost resistance, buried jungle roots).
- [x] Culturally differentiated buried architectures for all 4 expedition destinations.

### Phase 13 — Settings Cheats & Permanent Trophy Lockout
- [x] Sandbox cheats tab in Settings (instant sand, fast completion, forced endings, God Mode shovel).
- [x] Irreversible confirmation modal warning players of permanent achievement lockout.
- [x] Strict security check in `Achievements.js` and persistent `cheatsEnabled: true` save marking.

### Phase 14 — Post-Processing, Sub-Grid Optimization & Stability
- [x] Compositing shader pass: Selective Bloom, warmth color grading, cinematic vignette.
- [x] 100 atmospheric dust motes with Brownian motion.
- [x] Sub-grid normal recalculation $O(k)$ maintaining 60 FPS under continuous digging.
- [x] Anti-tunneling vertex clamping ($Y \ge 0$), dynamic camera frustum, and automatic save backup/recovery.

### Phase 15 — High-Graphics Blackout Resolution, Antialiasing & Procedural Dunes
- [x] Photometric ambient floor lighting (`#0D131A` at 0.15 + `#1B2A40` at $\ge 0.25$) preventing blackouts.
- [x] Standardized tone mapping (`ACESFilmicToneMapping`, exposure 1.0) and opaque alpha buffer output.
- [x] Antialiasing on all tiers: Hardware MSAA 4x in WebGLRenderTarget plus luminance FXAA shader pass.
- [x] Natural procedural dune elevation (`getInitialBiomeHeightOffset`) replacing flat initial planes, with exact initial volume conservation.

### Phase 16 — Hardware Diagnostics, WebGL Profiler & Sparkline Overlay
- [x] Telemetry monitor (`Profiler.js`) tracking FPS, frame time distribution (min/avg/max), draw calls, geometry triangles, and VRAM texture memory.
- [x] Real-time Canvas 2D overlay (`ProfilerOverlay.js`) with dynamic 60-sample sparkline and Atlantean glassmorphism styling.
- [x] Keyboard toggle shortcut (`F3`) and Settings integration with immediate observer persistence.

### Phase 17 — Raytracing Simulation (SSR & SSAO Raymarching Pass)
- [x] Native `THREE.DepthTexture` integration in WebGLRenderTarget for linear view-space depth reconstruction.
- [x] Screen-Space Reflections (SSR) raymarching shader pass simulating specular reflections on orichalcum, gold, and submerged ruins.
- [x] Screen-Space Ambient Occlusion (SSAO) contact shadows emphasizing depth in excavated trenches and around monument pillars.
- [x] Zero-cost pass-through bypass when disabled in settings (`graphics.ssrEnabled: false`) to safeguard mobile and low-end hardware.

### Phase 18 — Quality of Life & Game Juice
- [x] Multi-Buy selector (`1x`, `10x`, `100x`, `MAX`) with exact analytical geometric series cost summation and max affordable level calculations.
- [x] Numeric notation toggle between Standard Compact (`K, M, B, T, Qa`) and Scientific Notation (`1.25e6`).
- [x] Portable Save Import/Export (`SaveSerializer.js`) via Base64 serialization and CRC32 integrity validation.
- [x] Floating Text system (`FloatingText.js`) with lightweight DOM/Canvas pool projecting 3D crater hits to 2D screen coordinates.
- [x] Exponential decay camera trauma shake (`Camera.js`) and tactile haptic vibration pulses (`Haptics.js`).

### Phase 18.1 — Adaptive 3-Tier Architecture & Multi-Touch Gestures
- [x] 3-Tier CSS responsive layout: Desktop ($\ge 1025\text{px}$), Tablet ($601 - 1024\text{px}$), and Smartphone ($\le 600\text{px}$).
- [x] Touch target enlargement ($\ge 44\text{px} \times 44\text{px}$) and Safe Area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
- [x] Mobile pull-up Bottom Sheet for the Shop with rounded top corners ($20\text{px}$) and tactile drag handle.
- [x] Multi-finger touch gesture handling: 1 finger excavation, 2 fingers pinch-zoom and orbital rotation.
- [x] Dynamic vertical FOV compensation for tall mobile screens ($9:16$, $9:19.5$) and ultrawide monitors ($21:9$).

### Phase 19 — Dynamic Expedition Directives, Accessibility & Legal Transparency
- [x] Dynamic Directives system (`Directives.js` & `DirectivesWidget.js`) generating rotating procedural bounties with instant sand rewards and temporary buffs (shop discount, SPS surge).
- [x] Accessibility suite (`Accessibility.js`) with native *Reduced Motion* support (dampening particle counts, camera shake, and floating numbers) and *Smart Pause* clamping delta time ($dt$) on background tab switching.
- [x] Contextual Help Modal (`HelpModal.js`) with responsive controls legend adapted for mouse/keyboard and mobile touch.
- [x] Official Credits Modal (`CreditsModal.js`) detailing open source attributions (Three.js MIT, Google Fonts SIL OFL, Kenney/Quaternius CC0).

### Phase 20 — Mathematical Economic Balancing, Stability Audit, Offline PWA & Gold Master v1.0.0
- [x] Fine-tuned economic balance: $1.15$ cost multiplier for clicks, $1.16 - 1.18$ for autonomous fleet, and 5 Relics of Resonance unlocked at excavation thresholds ($15\%, 25\%, 50\%, 65\%, 80\%$).
- [x] Analytical progression simulator (`window.__DDS_DEBUG.simulateProgression()`) executing in $< 20\text{ms}$ and validating the target completion curve of $30 - 35$ minutes.
- [x] Production logger (`Logger.js`) suppressing debug overhead and printing the official Gold Master ASCII/CSS banner at boot.
- [x] Comprehensive GPU memory recycling (`DisposeUtils.js`) deeply traversing geometries, materials, textures, and depth render targets on expedition teardown.
- [x] Root Service Worker (`sw.js`) with `dds_cache_v1.0.0` providing 100% offline standalone PWA playability via Cache-First + Network Fallback.
- [x] Release v1.0.0 Gold Master bump across all files and 100% pass on 92+ unit tests and headless Chrome CDP browser QA suite (0 console errors, 0 page exceptions).

### Phase 20.5 — Global Specification & Documentation Synchronization
- [x] Full synchronization of all project markdown documentation (`diggy-diggy-sand-project.md`, `upgrade_tree_specification.md`, `brand_book_art_bible.md`, `asset_manifest_download_guide.md`, `README.md`) reflecting the complete codebase architecture at v1.0.0 Gold Master.

---

## 10. Design Philosophy & Multiplayer Clarification

During development, the experimental concept of network cooperative multiplayer was evaluated. It was **officially superseded and replaced by the Alternate Expedition Biomes system (Drained Ocean, Archaic Glacier, Buried Jungle)**. 

This decision was made to:
1. Preserve the tranquil, solitary atmosphere of archaeological discovery.
2. Ensure 100% offline standalone capability without reliance on external backend servers or websocket infrastructure.
3. Provide deep single-player replayability with radically distinct physical properties, architectures, and environmental mechanics across all 4 expedition destinations.

---

## 11. Closing Notes

*Diggy Diggy Sand* succeeds as a masterclass in modern web game architecture: zero build dependencies, 100% offline capability, rich procedural depth, fluid 60 FPS performance, and an unforgettable narrative twist at the conclusion of every excavation.
