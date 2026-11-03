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
4. **Replayability.** Three very different endings, chosen at random.
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

### 5.4 How the Random Choice Works

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

export function pickEnding(seed) {
  const rng = makeRng(seed);
  const total = ENDINGS.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of ENDINGS) {
    if ((r -= e.weight) < 0) return e.id;
  }
  return ENDINGS[0].id;
}
```

The `seed` and the chosen ending are stored in the save data, so reloading the page does not change the ending (and the player cannot "reroll" by refreshing).

### 5.5 Hints and Foreshadowing

To avoid spoiling too much, hints appear **only after about 60% completion** and are deliberately ambiguous:

| Ending | Subtle hint |
|---|---|
| Curse | Unnatural wind, distant whispers, symbols carved into the ruins, slightly reddish light |
| Treasure | Glints in the sand, isolated coins surfacing, metallic sounds |
| Business | No hints. Silence is the hint |

The **Georadar** can give ambiguous readings such as "anomaly detected" or "weak signal". It can also be somewhat unreliable: it is a curiosity, not a trustworthy spoiler.

### 5.6 Meta-Progression

- **Endings gallery:** endings already seen are saved and shown in the menu (1/3, 2/3, 3/3).
- **Secret ending (idea):** after seeing all three endings, a fourth unlocks, perhaps a combination of all of them (curse + treasure + digging company).
- **New Game+ (idea):** cosmetic or starting bonuses for each ending discovered.

---

## 6. Look, Feel, and Interface

### 6.1 Visual Style

- **Soft low-poly** with warm colors, inspired by relaxing games.
- Directional sunlight with shadows, gradient sky, light fog on the horizon.
- Sand color varies by height and by layer.
- Sand particles on every hit.
- Atmosphere changes during the endings (red sky, golden glow, etc.).

### 6.2 Camera

- Tilted top-down view with limited **OrbitControls** (restricted zoom and rotation).
- Clicking on the sand uses a **Raycaster** to find the dig point.
- On mobile: one finger digs, two fingers rotate/zoom.

### 6.3 HUD

- **Top:** Sand counter, desert completion bar.
- **Right / bottom:** button to open the **Upgrade Shop**.
- **Shop:** list of upgrades showing cost, current level, and effect; grayed-out button when not affordable.
- **Menu:** new game, save, settings (audio, graphics quality), endings gallery.

### 6.4 Audio

- Digging sound with slight pitch variations to avoid repetition.
- Relaxing ambient music that changes depending on the ending.
- Effects for purchased upgrades, explosions, and for each plague/event in the endings.

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
├── css/
│   └── style.css
├── js/
│   ├── main.js                  // entry point, main loop
│   ├── core/
│   │   ├── Game.js              // coordinates everything
│   │   ├── State.js             // global state (sand, upgrades, ending)
│   │   ├── Save.js              // saving to localStorage
│   │   └── Events.js            // small event bus
│   ├── world/
│   │   ├── Terrain.js           // height grid + desert mesh
│   │   ├── City.js              // the buried city
│   │   └── Sky.js               // sky, light, atmosphere
│   ├── systems/
│   │   ├── Digging.js           // digging logic and raycasting
│   │   ├── Economy.js           // sand, costs, earnings
│   │   ├── Upgrades.js          // upgrade definitions and purchasing
│   │   └── Workers.js           // automatic workers/excavators
│   ├── endings/
│   │   ├── EndingManager.js     // ending selection and launch
│   │   ├── CurseEnding.js
│   │   ├── TreasureEnding.js
│   │   └── BusinessEnding.js    // includes the tycoon mode
│   └── ui/
│       ├── Hud.js
│       ├── Shop.js
│       └── Overlay.js           // end screens and menus
└── assets/
    ├── audio/
    ├── textures/
    └── models/
```

### 7.3 The Terrain: Height Grid

For the MVP, the simplest and most efficient solution is a **heightmap**: a grid of height values that deforms a `PlaneGeometry`. Digging lowers the vertices around the hit point.

```js
// js/world/Terrain.js (simplified outline)
import * as THREE from 'three';

export class Terrain {
  constructor({ size = 200, res = 256, startHeight = 12, floor = 0 } = {}) {
    this.size = size;
    this.res = res;
    this.floor = floor;
    this.heights = new Float32Array((res + 1) * (res + 1)).fill(startHeight);

    this.geometry = new THREE.PlaneGeometry(size, size, res, res);
    this.geometry.rotateX(-Math.PI / 2);

    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, startHeight);
    this.geometry.computeVertexNormals();

    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({ color: 0xe0c27a, flatShading: false })
    );
    this.initialVolume = this.heights.length * (startHeight - floor);
    this.remainingVolume = this.initialVolume;
  }

  /** Digs around point (x, z). Returns the amount of sand removed. */
  dig(x, z, radius, power) {
    const cell = this.size / this.res;
    const cx = Math.round((x + this.size / 2) / cell);
    const cz = Math.round((z + this.size / 2) / cell);
    const r = Math.ceil(radius / cell);
    const pos = this.geometry.attributes.position;
    let removed = 0;

    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const ix = cx + i, iz = cz + j;
        if (ix < 0 || iz < 0 || ix > this.res || iz > this.res) continue;

        const dist = Math.hypot(i, j) * cell;
        if (dist > radius) continue;

        const falloff = 1 - dist / radius;
        const idx = iz * (this.res + 1) + ix;
        const newH = Math.max(this.floor, this.heights[idx] - power * falloff);

        removed += this.heights[idx] - newH;
        this.heights[idx] = newH;
        pos.setY(idx, newH);
      }
    }

    pos.needsUpdate = true;
    this.needsNormals = true;          // normals are recomputed every few frames
    this.remainingVolume -= removed;
    return removed;
  }

  get completion() {
    return 1 - this.remainingVolume / this.initialVolume;
  }
}
```

**Planned optimizations:**

- Recompute normals (`computeVertexNormals`) not on every hit but every 2–3 frames, only if digging occurred.
- If needed, split the terrain into **chunks** (for example 8×8) and update only the modified ones.
- Limit the number of active particles and use `InstancedMesh` for workers, coins, and gems.
- Adjust resolution (`res`) based on the device (128 on mobile, 256 on desktop).

**More advanced alternative (future):** voxel-based terrain with `InstancedMesh`, which allows more "physical" digging but is much heavier.

### 7.4 The Buried City

- A group of simple meshes (cube buildings, columns, a central area) placed **below** the initial sand level.
- As the terrain lowers, the buildings naturally emerge from the sand, with no special effects needed.
- For the **Business** ending the city **is not created**: only the flat floor remains (plus the bucket gag).
- For the **Curse** ending, a central element (seal / obelisk) is added. For the **Treasure** ending, scattered coins and gems and a chest are added.

### 7.5 State and Saving

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

## 9. Development Roadmap

### Phase 0 — Setup
- [ ] Full-screen HTML page with canvas
- [ ] Three.js scene with light, sky, and camera
- [ ] Folder structure and ES modules

### Phase 1 — Digging (playable prototype)
- [ ] Heightmap terrain
- [ ] Raycasting and digging on click
- [ ] Continuous digging while holding
- [ ] Sand particles and basic sound
- [ ] Sand counter and completion bar

### Phase 2 — Economy and Upgrades
- [ ] Shop with basic upgrades (Shovel, Dig Rate, Radius)
- [ ] Automatic workers
- [ ] Excavator and Dredge
- [ ] Saving to localStorage

### Phase 3 — City and Mystery
- [ ] Buried city that emerges
- [ ] Sand layers with different colors
- [ ] Hint system after 60%

### Phase 4 — The Three Endings
- [ ] Random selection system with seed
- [ ] **Treasure** ending (the simplest, to test the architecture)
- [ ] **Curse** ending (plagues, then the cosmic variant)
- [ ] **Business** ending (gag + basic tycoon mode)
- [ ] Endings gallery

### Phase 5 — Polish
- [ ] Progression balancing
- [ ] Mobile optimization
- [ ] Complete audio and music
- [ ] Menus, settings, and minimal tutorial
- [ ] Testing on multiple browsers and devices

### Phase 6 — Extensions (optional)
- [ ] Secret ending
- [ ] Events (sandstorms, merchant)
- [ ] New Game+
- [ ] Other deserts or settings

---

## 10. MVP (Minimum Playable Version)

To have something to try and show quickly:

1. A desert that can be dug with clicks.
2. Sand as currency and 3–4 upgrades.
3. Completion bar.
4. A simple city that emerges.
5. **Two endings** (Treasure and Business, the fastest to build) with random selection.
6. Automatic saving.

The Curse ending, with its dramatic effects, can come right after.

---

## 11. Risks and Solutions

| Risk | Solution |
|---|---|
| Performance on mobile | Lower resolution, fewer particles, `InstancedMesh`, normals recomputed at intervals |
| Terrain save data too heavy | Compression, per-area saving, or hit replay |
| The game becomes repetitive | Different layers, events, upgrades with visible effects, progressive hints |
| An ending feels disappointing | Playtest all three; keep their length and impact comparable |
| The Business ending feels like a joke on the player | Make it genuinely playable with the tycoon mode |
| Players restart to change the ending | Ending tied to the saved seed; the gallery encourages replaying to see the others |
| Spoilers from hints | Ambiguous hints and an unreliable Georadar |

---

## 12. Future Ideas

- Cosmetics: shovels, excavator skins, sand colors.
- "Night" mode with torches and lights in the city.
- Achievements (e.g. *"First million sand"*, *"All endings"*).
- Leaderboard for completion time.
- Other buried biomes: ice, jungle, drained ocean.
- Cooperative multiplayer: several players digging the same desert.

---

## 13. Closing Notes

The core idea is simple but effective: **a relaxing incremental game with a plot twist**. The strength of the project is the random ending: the player spends an hour digging, and only at the end finds out whether they released a curse, found a treasure, or simply founded a construction company.
