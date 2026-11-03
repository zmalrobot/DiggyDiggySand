# Diggy Diggy Sand — Upgrade Tree & Economy Design

> **Document Purpose:** Complete game economy and upgrade mechanics specification for Antigravity. Zero ambiguity: all formulas, triggers, costs, caps, and visual asset mappings are defined here.
> **Language & Formula Standard:** English, strict mathematical notation, consistent with the *Atlantean-Kemet* brand book.

---

## 1. Economy Math & Scaling Principles

### 1.1 Cost Formula
For any upgrade at level $n$ (where $n$ is current owned level, starting at 0 for purchase of level 1):
$$\text{Cost}(n) = \text{round}\left( \text{BaseCost} \times (\text{Multiplier})^n \right)$$

* Standard linear upgrades use $\text{Multiplier} = 1.15$
* High-impact/automation upgrades use $\text{Multiplier} = 1.18$ to $1.22$
* Unique one-off unlocks have fixed costs with no scaling.

### 1.2 Target Progression Timeline (30–40 Minutes Total)

| Phase | Time Window | Target Sand Dig Rate | Sand Cleared % | Visual Stage |
|---|---|---|---|---|
| **Early Game (Manual Focus)** | 0 – 5 min | $1 - 25 \text{ sand/s}$ | $0\% - 10\%$ | Dune surface, rusted tools, basic workers |
| **Mid Game (Industrial Transition)** | 5 – 18 min | $25 - 600 \text{ sand/s}$ | $10\% - 45\%$ | Excavators, dust storms, stone ruin tips visible |
| **Late Game (Atlantean Magic)** | 18 – 30 min | $600 - 15,000 \text{ sand/s}$ | $45\% - 85\%$ | Resonators, beam conduits, monoliths emerging |
| **Endgame (Mythic Excavation)** | 30 – 40 min | $15,000 - 80,000+ \text{ sand/s}$ | $85\% - 100\%$ | Sky warp, abyss cracks, ending trigger |

---

## 2. Upgrade Categories Overview

The upgrade tree is divided into **4 distinct branches**:
1. **Manual / Click Power:** Increases direct player agency, critical hit chances, crater radius, and continuous hold speed.
2. **Autonomous Fleet (Idle/DPS):** Entities that dig on their own at fixed intervals using 3D models or instanced props.
3. **Atlantean Relics (Synergy & Multipliers):** Percentage boosts, cooldown reductions, and mystical cross-buffs unlocked at ruin thresholds.
4. **Active Artifacts (Consumables / Clickable Abilities):** Large burst dig tools with tactical cooldowns.

---

## 3. Branch 1: Manual Digging (Click & Hold)

### U1.1 — Bronze Trowel to Orichalcum Spade (Click Power)
* **Base Cost:** 10
* **Multiplier:** 1.15
* **Max Level:** 50
* **Effect:** $+1$ base Sand removed per click/tick per level.
* **Formula:** $\text{Power}_{\text{click}} = 1 + n$
* **Asset/Visual:** UI shovel icon changes tier every 10 levels: Rusty Bronze $\rightarrow$ Forged Iron $\rightarrow$ Gilded Brass $\rightarrow$ Orichalcum Blade.

### U1.2 — Kinetic Rhythm (Hold Rate / Dig Speed)
* **Base Cost:** 45
* **Multiplier:** 1.17
* **Max Level:** 20
* **Effect:** Reduces tick interval while holding down mouse/touch.
* **Formula:** $\text{TickInterval} = \max(0.06\text{s}, 0.35\text{s} \times 0.93^n)$
* **Notes:** Capped at $\approx 16.6\text{ hits/sec}$ to prevent raycaster stalls and browser lag.

### U1.3 — Excavation Radius (Crater Area)
* **Base Cost:** 90
* **Multiplier:** 1.16
* **Max Level:** 15
* **Effect:** Increases radius of the circular crater falloff.
* **Formula:** $\text{Radius} = 2.0\text{m} + (n \times 0.45\text{m})$
* **Visual:** Sand splash particles scale proportionally to the radius.

### U1.4 — Solar Cleave (Critical Dig Chance)
* **Base Cost:** 350
* **Multiplier:** 1.20
* **Max Level:** 10
* **Unlock Requirement:** 5% Total Sand Cleared
* **Effect:** Grants a chance to trigger a Critical Hit dealing $5\times$ sand extraction and a golden spark VFX.
* **Formula:** $\text{CritChance} = n \times 3\%$ (Max $30\%$)

---

## 4. Branch 2: Autonomous Fleet (Passive DPS)

All units in this branch spawn physical representations on the dig site or perimeter.

### U2.1 — Nomad Diggers (Fellahin Crew)
* **Base Cost:** 120
* **Multiplier:** 1.15
* **Max Level:** 50
* **Effect:** Digs 1 spot every 2.0s dealing 2 sand damage.
* **Formula:** $\text{DPS}_{\text{nomads}} = n \times 1.0 \text{ sand/s}$
* **3D Asset Concept:** Simple low-poly human figures with turbans/tunics wielding shovels, using procedural bouncing rotation while digging.

### U2.2 — Heavy Bronze Sifters
* **Base Cost:** 650
* **Multiplier:** 1.15
* **Max Level:** 40
* **Unlock Requirement:** U2.1 Level 5
* **Effect:** Stationary sifter stations placed along the perimeter; passively processes loose sand.
* **Formula:** $\text{DPS}_{\text{sifters}} = n \times 6.5 \text{ sand/s}$
* **3D Asset Concept:** Wooden/bronze A-frame tripod with a swinging mesh basket.

### U2.3 — Steam-Piston Excavator
* **Base Cost:** 3,200
* **Multiplier:** 1.16
* **Max Level:** 30
* **Unlock Requirement:** 15% Total Sand Cleared
* **Effect:** Large mechanical digger that strikes every 3 seconds creating wide local craters.
* **Formula:** $\text{DPS}_{\text{excavator}} = n \times 45 \text{ sand/s}$
* **3D Asset Concept:** Low-poly industrial tracked backhoe/digger with brass pipes, emitting steam puff particles.

### U2.4 — Rotary Sand Dredge
* **Base Cost:** 18,500
* **Multiplier:** 1.17
* **Max Level:** 25
* **Unlock Requirement:** U2.3 Level 5
* **Effect:** Massive bucket-wheel apparatus grinding continuously along the dune trenches.
* **Formula:** $\text{DPS}_{\text{dredge}} = n \times 280 \text{ sand/s}$
* **3D Asset Concept:** Rotating wheel of scoop buckets mounted on a stationary scaffold.

### U2.5 — Atlantean Resonance Monolith
* **Base Cost:** 95,000
* **Multiplier:** 1.18
* **Max Level:** 20
* **Unlock Requirement:** 45% Sand Cleared + Ruin Layer Reached
* **Effect:** Floating obelisk emitting periodic teal energy pulses that vaporize layers of sand across a wide radial pattern.
* **Formula:** $\text{DPS}_{\text{monolith}} = n \times 1,450 \text{ sand/s}$
* **3D Asset Concept:** Levitating stone needle with glowing cyan runes, rotating slowly on the Y-axis.

### U2.6 — Chrono-Borer of the Deep (Endgame Super-Unit)
* **Base Cost:** 600,000
* **Multiplier:** 1.20
* **Max Level:** 10
* **Unlock Requirement:** 70% Sand Cleared
* **Effect:** Subterranean worm-drill made of floating orichalcum segments, boring upward through bedrock.
* **Formula:** $\text{DPS}_{\text{borer}} = n \times 8,200 \text{ sand/s}$
* **3D Asset Concept:** Articulated geometric rings with cyan core beams burrowing in and out of the sand.

---

## 5. Branch 3: Atlantean Relics (Multipliers & Synergies)

Relics are high-cost threshold upgrades. They do not increase linearly forever; they provide strategic percentage multipliers that make earlier units remain viable.

```
                  ┌──────────────────────┐
                  │ 15% City Uncovered   │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [R3.1 Papyrus Cartel]             [R3.2 Leyline Tuning]
   (All Fleets +25% Output)          (Click inherits 4% DPS)
            │                                 │
            └────────────────┬────────────────┘
                             │
                  ┌──────────▼───────────┐
                  │ 50% City Uncovered   │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [R3.3 Orichalcum Gearing]         [R3.4 Anomaly Harmonizer]
   (Excavator & Dredge x2)           (Passive Sand Value +50%)
                             │
                  ┌──────────▼───────────┐
                  │ 80% City Uncovered   │
                  └──────────┬───────────┘
                             │
                    [R3.5 Eye of the Abyss]
                    (Total Output x3.0)
```

### Relic Details

| ID | Relic Name | Cost (Flat Sand) | Unlock Trigger | Precise Effect |
|---|---|---|---|---|
| **R3.1** | **Papyrus Cartel** | 8,000 | 15% Cleared | Increases all Branch 2 Fleet DPS by $+25\%$. |
| **R3.2** | **Leyline Tuning** | 15,000 | 25% Cleared | Every manual click automatically deals $+4\%$ of total passive DPS as bonus damage. |
| **R3.3** | **Orichalcum Gearing** | 75,000 | 50% Cleared | Doubles base output ($+100\%$) of Steam Excavators and Dredges. |
| **R3.4** | **Anomaly Harmonizer** | 250,000 | 65% Cleared | Every unit of sand removed yields $+50\%$ currency value. |
| **R3.5** | **Eye of the Abyss** | 1,200,000 | 80% Cleared | Global multiplier: all sand production and click power $\times 3.0$. |

---

## 6. Branch 4: Active Artifacts (Abilities with Cooldowns)

These abilities sit on the main HUD as circular stone medallions with cooldown sweeps.

### A4.1 — Nitroglycerin Cask (Dynamite Charge)
* **Base Cost to Unlock:** 1,500
* **Cooldown:** 45 seconds
* **Recharge Cost:** Free (timer-based) OR instant recharge for $10\%$ of current sand stock.
* **Action:** Target any spot on the terrain. On click, detonates a crater 3× normal size, immediately yielding all displaced sand and blasting outward physical debris particles.
* **Damage:** Instantly clears 1,200 sand volume in selected radius.

### A4.2 — Khamsin Vortex (Sandstorm Channel)
* **Base Cost to Unlock:** 25,000
* **Cooldown:** 90 seconds
* **Duration:** 10 seconds active
* **Unlock Trigger:** 35% Cleared
* **Action:** Summons a localized golden tornado. While active, every screen hold/click digs at $3\times$ speed and auto-collects all debris without drop-off.

### A4.3 — Prism of Atlantis (Solar-Orbital Beam)
* **Base Cost to Unlock:** 180,000
* **Cooldown:** 150 seconds
* **Duration:** 6 seconds active
* **Unlock Trigger:** 60% Cleared
* **Action:** A focused cyan beam descends from the clouds, tracing a spiral toward the center of the desert, vaporizing topsoil down to bedrock level. Yields $15,000 + (10\% \text{ of lifetime sand earned})$.

---

## 7. Replayability, Sanctuary Meta-Progression & Cosmetic Wardrobe

When an expedition reaches its climax, the player earns **Ancient Tablets** ($\tau$) based on total sand excavated and run performance:
$$\tau = \left\lfloor \sqrt{\frac{\text{TotalSand}}{100,000}} \right\rfloor + 5$$

Tablets are stored persistently across all runs (`dds_save_v1`) and never reset upon starting a new expedition.

### 7.1 Ancestral Sanctuary (Persistent Meta-Upgrades)

The Ancestral Sanctuary can be accessed from the Main Menu or pause screen to permanently enhance future expeditions:

| ID | Meta Upgrade | Base Cost ($\tau$) | Multiplier | Max Level | Effect |
|---|---|---|---|---|---|
| `shovelEcho` | **Eco della Pala (Shovel Echo)** | $3\ \tau$ | $1.6$ | 10 | $+15\%$ base click digging power per level across all expeditions. |
| `excavatorBlueprint` | **Progetto Escavatore (Excavator Blueprint)** | $5\ \tau$ | $2.0$ | 5 | Start every future expedition with active Beetle Automata digging from frame 1. |
| `tabletMagnetism` | **Magnetismo Tavolette (Tablet Magnetism)** | $4\ \tau$ | $1.8$ | 5 | Ancient favor: $-5\%$ discount per level on all workshop sand costs (up to $-25\%$). |

### 7.2 Dune Wardrobe (Cosmetics & Custom Skins)

Players can spend Ancient Tablets ($\tau$) in the **Dune Wardrobe** modal (`WardrobeModal.js` / `CosmeticsManager.js`) to personalize the visual look of their excavation tools, terrain particles, and machinery without altering physical hitboxes:

#### 1. Shovels & Digging Tools (`category: shovel`)
| Skin ID | Name | Cost ($\tau$) | Visual & Particle Look |
|---|---|---|---|
| `shovel_bronze` | **Pala di Bronzo (Bronze Spade)** | $0\ \tau$ (Default) | Weathered bronze blade, granular sand sparks (`#B88A44`). |
| `shovel_gold` | **Pala d'Oro Reale (Royal Gold)** | $15\ \tau$ | Burnished pharaonic gold, radiant sun glints (`#FFDF00`). |
| `shovel_crystal` | **Pala di Cristallo (Atlantean Crystal)** | $25\ \tau$ | Ethereal cyan blade, bioluminescent energy sparks (`#0FE3C1`). |
| `shovel_obsidian` | **Pala d'Ossidiana (Abyssal Obsidian)** | $40\ \tau$ | Pitch-black volcanic glass, cosmic purple trail (`#2A1F2D`). |

#### 2. Sand Tints & Cosmetic Biomes (`category: sand`)
| Skin ID | Name | Cost ($\tau$) | Chromatic Banding & Dust |
|---|---|---|---|
| `sand_classic` | **Sabbia Classica Egizia** | $0\ \tau$ (Default) | Golden surface `#E0C27A`, ochre mid `#B88A44`, bedrock `#6E563B`. |
| `sand_mars` | **Sabbia Rossa di Marte** | $20\ \tau$ | Crimson dust `#C84B31`, dark oxide `#8C2C1D`, ember `#2D1B1B`. |
| `sand_caribbean` | **Sabbia Bianca Caraibica** | $25\ \tau$ | Pearl white `#F4F6F0`, seafoam `#D8E8E4`, deep lagoon `#2A6F7B`. |
| `sand_volcanic` | **Sabbia Nera Vulcanica** | $35\ \tau$ | Basalt ash `#484B52`, charcoal `#2C2F36`, obsidian magma `#17181C`. |

#### 3. Machinery & Automaton Chassis (`category: machinery`)
| Skin ID | Name | Cost ($\tau$) | Mesh Material & Highlights |
|---|---|---|---|
| `machinery_standard` | **Flotta da Cantiere Standard** | $0\ \tau$ (Default) | Industrial bronze casing with steam pipes (`#8C5828`). |
| `machinery_royal_gold` | **Flotta Aureo-Reale** | $30\ \tau$ | Polished ceremonial gold armor and solar insignias (`#F5BA23`). |
| `machinery_atlantis_teal` | **Flotta d'Oricalco Celestiale** | $50\ \tau$ | Levitation conduits and pulsating turquoise energy cores (`#00F2FF`). |

### 7.3 Expedition Biome Unlock Matrix

In addition to cosmetics, Ancient Tablets or expedition victories unlock new geological destinations:

| Bioma | Sblocco Requisito | Modificatore Fisico Principale |
|---|---|---|
| **Deserto Egizio (`desert`)** | Disponibile all'inizio | Baseline standard di scavo e rilievi dunari morbidi. |
| **Oceano Prosciugato (`ocean`)** | $10\ \tau$ oppure 1 Vittoria | $+15\%$ volume totale, $-20\%$ resistenza del suolo (scavo rapido). |
| **Ghiacciaio Arcaico (`glacier`)** | $20\ \tau$ oppure 2 Vittorie | $+35\%$ resistenza allo strato di permafrost intermedio ($3 < Y \le 8$). |
| **Giungla Sepolta (`jungle`)** | $35\ \tau$ oppure 3 Vittorie | Radici sepolte resistenti che richiedono colpi multipli per essere spezzate. |

---

## 8. Low-Poly Free Asset Requirements (For Next Step)

Every upgrade in this tree is mapped to simple 3D asset archetypes that can be downloaded from free repositories (Kenney, Poly Pizza, Quaternius) or easily composed using Three.js CSG/primitives:

1. **Tools:** Simple low-poly shovel, pickaxe, trowel.
2. **Characters:** Low-poly modular human (adventurer / worker with turban or hardhat).
3. **Machinery:** Low-poly steam shovel / tracked excavator, gear wheel, generator box.
4. **Architecture & Relics:** Egyptian obelisk, pyramid capstone, Atlantean glowing crystal pillar, stone urn/chest, dynamite barrel.
5. **VFX:** Procedural dust puffs (billboard particles), spark meshes, ring expansion meshes for shockwaves.