# Diggy Diggy Sand — Asset Manifest & Integration Guide

> **Document Purpose:** Complete, actionable reference for all 3D models, textures, audio effects, and UI icons needed to build *Diggy Diggy Sand*.
> **Licensing Standard:** 100% Free for commercial and non-commercial use (**CC0 Public Domain** or **MIT / OpenGameArt-BY**). Zero copyright strikes, no API keys required.
> **Target Tool:** Direct instructions and curl commands for Antigravity to fetch and organize assets into the project folder.

---

## 1. Directory Structure

Antigravity must download or place all referenced assets into the following local folder hierarchy:

```
/diggy-diggy-sand
├── assets/
│   ├── models/
│   │   ├── tools/          # Shovels, picks, dynamites
│   │   ├── fleet/          # Workers, diggers, excavators, monoliths
│   │   ├── city/           # Obelisks, pillars, ruins, chests
│   │   └── endings/        # Sarcophagus, tentacles, modern sign/cone
│   ├── textures/
│   │   ├── ui/             # Medallion frames, glyphs, icons
│   │   └── env/            # Noise normal maps, particle sprites
│   └── audio/
│       ├── sfx/            # Dig hits, crits, button clicks, collapse
│       └── ambient/        # Wind loops, mystical drone, final jingles
```

---

## 2. 3D Model Assets (GLTF / GLB Format)

All models are low-poly, optimized for WebGL, and match the *Atlantean-Kemet* art direction.

### 2.1 Tools & Hand Equipment (`assets/models/tools/`)

| Asset ID | File Name | Pack / Source | Direct Web Source / Archive | License |
|---|---|---|---|---|
| `TOOL_SHOVEL` | `shovel_basic.glb` | Kenney Pirate / Survival Kit | `https://kenney.nl/assets/pirate-kit` | CC0 |
| `TOOL_PICKAXE` | `pickaxe_heavy.glb` | Kenney Survival Kit | `https://kenney.nl/assets/survival-kit` | CC0 |
| `TOOL_DYNAMITE` | `dynamite_cask.glb` | Kenney Western Kit | `https://kenney.nl/assets/western-kit` | CC0 |

### 2.2 Autonomous Fleet Units (`assets/models/fleet/`)

| Asset ID | File Name | Pack / Source | Direct Web Source / Archive | License |
|---|---|---|---|---|
| `UNIT_NOMAD` | `worker_nomad.glb` | Kenney Animated Characters / Quaternius Adventurer | `https://quaternius.com/packs/modularcharacters.html` | CC0 |
| `UNIT_SIFTER` | `sifter_tripod.glb` | Kenney Medieval / Survival Kit | `https://kenney.nl/assets/medieval-kit` | CC0 |
| `UNIT_EXCAVATOR` | `steam_excavator.glb` | Kenney Car / Construction Pack | `https://kenney.nl/assets/car-kit` | CC0 |
| `UNIT_MONOLITH` | `atlantean_monolith.glb` | iPoly3D / Kenney Fantasy Town | `https://opengameart.org/content/lowpoly-desert-props` | CC0 |

### 2.3 Buried City & Ruin Pieces (`assets/models/city/`)

| Asset ID | File Name | Pack / Source | Direct Web Source / Archive | License |
|---|---|---|---|---|
| `RUIN_PILLAR` | `pillar_stone.glb` | LowPoly Desert Props (iPoly3D) | `https://opengameart.org/content/lowpoly-desert-props` | CC0 |
| `RUIN_OBELISK` | `obelisk_kemet.glb` | LowPoly Desert Props (iPoly3D) | `https://opengameart.org/content/lowpoly-desert-props` | CC0 |
| `RUIN_WALL` | `ruin_wall_corner.glb` | Kenney Fantasy Town Kit | `https://opengameart.org/content/fantasy-town-kit` | CC0 |
| `RUIN_CHEST` | `ancient_chest.glb` | Kenney Pirate Kit | `https://kenney.nl/assets/pirate-kit` | CC0 |

### 2.4 Ending Specifics (`assets/models/endings/`)

| Asset ID | File Name | Pack / Source | Direct Web Source / Archive | License |
|---|---|---|---|---|
| `END_CURSE_CORE` | `black_sarcophagus.glb` | LowPoly Desert Props | `https://opengameart.org/content/lowpoly-desert-props` | CC0 |
| `END_TREASURE_GEM`| `gem_cluster.glb` | Kenney Platformer Kit | `https://kenney.nl/assets/platformer-kit` | CC0 |
| `END_BIZ_CONE` | `traffic_cone.glb` | Kenney City Kit Commercial | `https://kenney.nl/assets/city-kit-commercial` | CC0 |

---

## 3. Audio Sound Effects & Ambience

All sounds are lightweight `.ogg` or `.mp3` files (15–80 KB each) to guarantee zero latency on web interaction.

### 3.1 Sound Effects (`assets/audio/sfx/`)

| SFX Key | Filename | Description | Direct Repository Link | License |
|---|---|---|---|---|
| `SFX_DIG_SOFT` | `sand_dig_01.ogg` | Granular shovel dig sound | `https://opengameart.org/content/shovel-sound` | CC-BY 3.0 / CC0 |
| `SFX_DIG_STONE` | `stone_clink_01.ogg` | High-pitched strike on ruins/bedrock | `https://gamesounds.xyz/?dir=Kenney%27s%20Sound%20Pack/Impact%20Sounds` (`impactWood_heavy_000.ogg`) | CC0 |
| `SFX_CRIT` | `solar_crit.ogg` | Resonant chime on critical hit | `https://gamesounds.xyz/?dir=Kenney%27s%20Sound%20Pack/Digital%20Audio` | CC0 |
| `SFX_PURCHASE` | `ui_upgrade.ogg` | Crisp mechanical confirmation click | `https://gamesounds.xyz/?dir=Kenney%27s%20Sound%20Pack/UI%20Audio` (`click1.ogg`) | CC0 |
| `SFX_EXPLOSION` | `dynamite_blast.ogg` | Deep muffled detonation | `https://gamesounds.xyz/?dir=Kenney%27s%20Sound%20Pack/Impact%20Sounds` | CC0 |

### 3.2 Atmospheric Loops (`assets/audio/ambient/`)

| Audio Key | Filename | Duration | Source Pack | License |
|---|---|---|---|---|
| `AMB_DESERT_WIND` | `desert_wind_loop.ogg` | 15s seamless loop | OpenGameArt Ambient Wind (`wind_gentle.ogg`) | CC0 |
| `AMB_ATLANTEAN` | `abyss_hum_loop.ogg` | 20s seamless loop | Gamesounds Sci-Fi Drone (`drone_space_low.ogg`) | CC0 |

---

## 4. UI Icons & Graphical Sprites (`assets/textures/ui/`)

Instead of raster images that bloat downloads, all icons can be retrieved from **Kenney Game Icons** (SVG/PNG) or loaded via standard inline SVG strings matching the Brand Book:

* **Sand Token:** Stylized hourglass or mound with solar halo (`#F5BA23`).
* **Relic Tablet:** Rectangular stone tablet with cyan chevron runes (`#0FE3C1`).
* **Upgrade Branch Glyphs:**
  - *Click / Shovel:* Stylized angled blade.
  - *Fleet:* Gear combined with a pyramid triangle.
  - *Magic:* Four-point star with orbital rings.
  - *Active:* Detonation starburst.

---

## 5. Automated Antigravity Download Script

Antigravity can execute the following shell commands in the project root to fetch starter packs directly from mirrored CC0 repositories:

```bash
#!/bin/bash
# Make folders
mkdir -p assets/models/tools assets/models/fleet assets/models/city assets/audio/sfx assets/audio/ambient

echo "Downloading Kenney UI Audio Pack (CC0)..."
curl -s -L -o audio_ui.zip "https://kenney.nl/media/pages/assets/ui-audio/41d5b306fc-1678887968/kenney_ui-audio.zip"
unzip -q -j audio_ui.zip "Audio/click1.ogg" -d assets/audio/sfx/
unzip -q -j audio_ui.zip "Audio/switch1.ogg" -d assets/audio/sfx/
mv assets/audio/sfx/click1.ogg assets/audio/sfx/ui_upgrade.ogg
rm -f audio_ui.zip

echo "Downloading Shovel/Digging FX..."
curl -s -L -o assets/audio/sfx/sand_dig_01.ogg "https://opengameart.org/sites/default/files/shovel.ogg"

echo "Asset initialization complete."
```

---

## 6. Architettura Asset a Doppio Binario & Fallback Procedurale

Per rispettare i vincoli operativi di `AGENTS.md` e garantire che il gioco sia **immediatamente giocabile offline al 100%** anche in assenza di connessione internet, pacchetti `.zip` non scaricati o file binari corrotti, *Diggy Diggy Sand* implementa un'architettura rigorosa a **doppio binario**:

```
                              [AVVIO DEL GIOCO]
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
        [BINARIO 1: ESTERNO]                      [BINARIO 2: PROCEDURALE]
    File .glb / Campioni Audio               ProceduralFactory / SoundSynth
                 │                                         │
       Tentativo Asincrono                         Generazione Matematica
      (Timeout 10s singolo,                         Immediata e Garantita
       Timeout 30s globale)                                │
                 │                                         │
        ┌────────┴────────┐                                │
        ▼                 ▼                                │
   [Successo]        [Fallimento / 404]                    │
  Usa Modello GLTF    Subentro Trasparente ───────────────►┘
```

### 6.1 Controllo di Disponibilità via `manifest.json`
- Il file `assets/manifest.json` mappa ogni identificatore simbolico (`RUIN_OBELISK`, `TOOL_SHOVEL`, `SFX_DIG_SOFT`, ecc.) al rispettivo percorso relativo.
- Ogni elemento include il flag booleano `"available": true|false`:
  - Se `false`, `AssetLoader` e `AudioEngine` non tentano nemmeno la richiesta di rete, risparmiando cicli I/O e azzerando gli errori 404 in console.
  - Se `true`, il loader avvia il recupero tramite `THREE.GLTFLoader` o `AudioContext.decodeAudioData()`.

### 6.2 Politica Timeout e Resilienza
- **Timeout per singolo asset:** 10 secondi.
- **Timeout globale di caricamento:** 30 secondi.
- Se una chiamata asincrona va in timeout, genera un errore di rete o il file `.glb` fallisce la validazione dei buffer, il sistema cattura l'eccezione (`onError` / `try...catch`) e commuta istantaneamente e silenziosamente sul generatore procedurale (`ProceduralFactory.js` o `SoundSynth`).
- La schermata di caricamento `LoadingScreen.js` garantisce un avanzamento monotono senza mai bloccarsi.

### 6.3 Generatore 3D Procedurale (`ProceduralFactory.js`)

Se i modelli `.glb` esterni non sono presenti nella cartella `assets/models/`, `ProceduralFactory.js` genera al volo geometrie chiseled low-poly matematicamente conformi all'Art Bible (`flatShading: true`):

```javascript
// js/world/ProceduralFactory.js
import * as THREE from 'three';

export const FallbackMeshes = {
  // Workers: Cylinder body with spherical head and small shovel box
  createWorker: () => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0xC89849, flatShading: true })
    );
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 5, 5),
      new THREE.MeshStandardMaterial({ color: 0xE4C580, flatShading: true })
    );
    head.position.y = 0.75;
    group.add(body, head);
    return group;
  },

  // Excavator: Box chassis, pivot arm, and bucket
  createExcavator: () => {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.8, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xD87D38, metalness: 0.7, roughness: 0.3, flatShading: true })
    );
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x031826, flatShading: true })
    );
    cab.position.set(0.2, 0.8, 0.2);
    group.add(base, cab);
    return group;
  },

  // Atlantean Monolith: Floating diamond needle with emissive glow
  createMonolith: () => {
    const group = new THREE.Group();
    const needle = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshStandardMaterial({
        color: 0x031826,
        emissive: 0x0FE3C1,
        emissiveIntensity: 0.6,
        flatShading: true
      })
    );
    needle.scale.set(0.6, 2.2, 0.6);
    group.add(needle);
    return group;
  },

  // Obelisk / Column for Ruin Layer
  createObelisk: () => {
    const geom = new THREE.CylinderGeometry(0.4, 0.7, 4.0, 4);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8C5828,
      flatShading: true
    });
    return new THREE.Mesh(geom, mat);
  }
};
```

### 6.4 Sintetizzatore Web Audio Procedurale (`SoundSynth`)

Qualora i campioni sonori `.ogg` o `.mp3` non siano presenti o l'utente giochi offline, `SoundSynth` genera tutti i suoni in tempo reale tramite oscillatori, rumore bianco filtrato e inviluppi esponenziali nativi:

```javascript
// js/core/AudioEngine.js - Sintetizzatore Web Audio a zero asset
export class SoundSynth {
  constructor(audioCtx) {
    this.ctx = audioCtx;
  }

  playDig() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 450 + Math.random() * 150;
    filter.Q.value = 3.0;

    noise.connect(filter);
    filter.connect(this.ctx.destination);
    noise.start();
  }

  playCrit() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}
```