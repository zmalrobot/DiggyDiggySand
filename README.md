# Diggy Diggy Sand: The Sunken City

[![Licenza: MIT](https://img.shields.io/badge/Licenza-MIT-F5BA23.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r160%20(Locale)-0FE3C1.svg)](https://threejs.org/)
[![PWA](https://img.shields.io/badge/PWA-Standalone%20Ready-00B4D8.svg)](manifest.json)
[![Tests](https://img.shields.io/badge/Test%20Suite-92%2F92%20Passing-brightgreen.svg)](tests/)
[![Build Status](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue.svg)](https://pages.github.com/)

> *"Svuota il deserto. Scopri cosa dorme sotto le sabbie d'Egitto."*

**Diggy Diggy Sand** è un gioco incrementale 3D (3D Sand Miner / Reverse City-Builder) per browser desktop e mobile. Il giocatore scava manualmente e con una flotta di macchinari e automi autonomi una duna desertica deformabile in tempo reale, portando alla luce una metropoli monumentale sepolta della civiltà perduta di Atlantide, fino a innescare uno dei 4 finali dinamici con risvolti narrativi imprevedibili.

---

## 🏛️ Pilastri di Design & Architettura Tecnica

- **Stile Visivo "Chiseled Low-Poly":** Geometrie angolate con `flatShading: true`, palette cromatica Atlantean-Kemet (oro e sabbia `#F5BA23`, `#E4C580` contrapposti a ciano e oricalco `#0FE3C1`, `#00B4D8`).
- **Terreno Procedurale a Dune Ondulate:** Generazione altimetrica non-piatta differenziata per bioma (`getInitialBiomeHeightOffset`), conservazione rigorosa del volume iniziale e calcolo immediato delle normali 3D per un'illuminazione plastica fin dal frame 1.
- **Ottimizzazione Sub-Grid delle Normali $O(k)$:** Eliminato il ricalcolo globale della mesh $256 \times 256$ a ogni colpo. Aggiornamento analitico delle normali circoscritto alla sola sub-regione di scavo, mantenendo 60 FPS granitici.
- **Pipeline Grafica & Antialiasing:**
  - *Illuminazione Ambient Floor:* sorgente di sicurezza `#0D131A` (0.15) e cielo notturno $\ge 0.25$ che scongiurano lo schermo nero a grafica alta.
  - *Tone Mapping:* standard cinematografico `THREE.ACESFilmicToneMapping` con esposizione 1.0.
  - *Selective Bloom & Post-Processing:* estrazione mirata della bioluminescenza dei cristalli e riflessi dorati senza scurire la sabbia.
  - *Doppio Antialiasing:* Hardware MSAA 4x su `WebGLRenderTarget` e shader pass FXAA su scala di luminanza per levigare i poligoni low-poly.
- **I Quattro Finali Dinamici:**
  - ☠️ **La Maledizione di Atlantide (`curse`):** Tempesta cremisi, pioggia di sangue e risveglio dell'antico orrore cosmico.
  - 👑 **Il Tesoro d'Oro Puro (`treasure`):** Cascata di gemme preziose e monete d'oro con minigioco di raccolta a click.
  - 🏗️ **L'Impresa Mineraria SRL (`business`):** Anticlimax corporativo, cantieristica moderna e contratti in modalità Sandbox libera.
  - 🔱 **L'Ascensione di Atlantide (`secret`):** Sbloccato dopo aver visto tutti e 3 i finali base; il risveglio dell'antico cuore d'oricalco, geyser di luce ciano e levitazione delle rovine verso la volta celeste.
- **Spedizioni nei 4 Biomi Alternativi:**
  - 🏜️ **Deserto d'Oro Egizio (`desert`):** Baseline classica con rilievi dunari morbidi.
  - 🌊 **Oceano Prosciugato (`ocean`):** Bacino a depressione centrale, $+15\%$ volume totale e $-20\%$ resistenza del suolo.
  - ❄️ **Ghiacciaio Arcaico (`glacier`):** Rilievi sfaccettati e strato intermedio di permafrost con resistenza $+35\%$.
  - 🌴 **Giungla Sepolta (`jungle`):** Dislivelli organici e radici sotterranee da spezzare con colpi multipli.
- **Ciclo Giorno/Notte Dinamico & Torce:** Orbita continua di 4 minuti con sole, luna oricalco, cupola stellata procedurale e torce arcaiche con luce tremolante.
- **Guardaroba Cosmetico:** Personalizzazione dell'aspetto di pale, biomi sabbia e automi tramite Tavolette Antiche ($\tau$).
- **Economia Disaccoppiata:** Calcolo Sand Per Second (SPS), progresso offline e usura basati su timestamp reali `performance.now()`, totalmente indipendenti dal frame rate.
- **Doppio Binario Asset:** Caricamento asincrono GLTF/Audio campionato con fallback trasparente e immediato sui generatori procedurali Three.js (`ProceduralFactory.js`) e Web Audio API (`SoundSynth`).
- **Internazionalizzazione (i18n):** Supporto bilingue reattivo Italiano / Inglese.
- **Zero Build Step:** HTML5, CSS3 Glassmorphism, ES Modules nativi e Three.js r160 locale in `vendor/three/`.

---

## 🎮 Controlli di Gioco

Il gioco supporta nativamente mouse/tastiera su desktop e gesture touch su smartphone e tablet:

| Azione | Desktop (Mouse / Tastiera) | Mobile / Touch Screen |
|---|---|---|
| **Scavo Sabbia** | Click sinistro (tap) o Tieni premuto (hold) | Tocco singolo o Tap prolungato con un dito |
| **Rotazione Camera** | Click destro + Trascina | Gesto a due dita (Pinch & Orbit Drag) |
| **Pan / Spostamento** | Tasti `W`, `A`, `S`, `D` o Frecce direzionali | Shift + Click destro oppure Pan a due dita |
| **Zoom / Dolly** | Rotellina del mouse | Pinch to zoom con due dita |
| **Officina Upgrade** | Click sul pulsante `Officina` nell'HUD | Tap su `Officina` nell'HUD |
| **Pausa & Menu** | Tasto `Esc` o pulsante `⚙️ Pausa` | Tap sul pulsante `⚙️ Pausa` |
| **Suite Debug** | Tasto rapido **`F2`** o **`~` / `` ` ``** | Parametro query string `?debug=1` |

---

## 🛠️ Suite Debug, Trucchi & Parametri URL

Diggy Diggy Sand include strumenti di collaudo avanzati sia visivi che da console:

### Scheda "Trucchi" nel Pannello Impostazioni
All'interno del modale Impostazioni è presente la scheda **Trucchi / Modalità Creativa**:
- **Conferma Irreversibile:** Al primo tocco di qualsiasi comando di debug, viene mostrato un avviso chiaro: l'attivazione dei cheat disabilita in modo permanente lo sblocco di tutti gli Obiettivi per la run in corso.
- **Lockout Obiettivi:** Confermando, viene scritto immediatamente `cheatsEnabled = true` nel salvataggio persistente (`dds_save_v1`). `Achievements.js` blocca l'assegnazione dei trofei, l'HUD mostra il badge `🔧 Cheats` e la schermata Trofei espone il banner di blocco.
- **Comandi Disponibili:** Accredito immediato $+100.000$ o $+1.000.000$ Sabbia, completamento rapido a $50\%$, $95\%$ o $99\%$, forzatura del climax narrativo (Curse, Treasure, Business, Secret), innesco di Tempeste o Mercanti, Super Pala (God Mode) e sblocco di tutti gli upgrade al massimo.

### Parametri URL
| Parametro | Descrizione | Esempio |
|---|---|---|
| `?debug=1` | Attiva la console di diagnostica avanzata e overlay FPS | `index.html?debug=1` |
| `?cheat=1` | Abilita i comandi cheat immediati | `index.html?cheat=1` |
| `?ending=<id>` | Forza il finale della spedizione: `curse`, `treasure`, `business`, `secret` | `index.html?ending=secret` |

### Comandi Console Rapidi (`window.DDS_DEBUG`)
Aprendo la console DevTools (`F12`), sono disponibili le API:
```javascript
// Accredita sabbia istantanea
window.DDS_DEBUG.addSand(500000);

// Imposta la percentuale di completamento dello scavo
window.DDS_DEBUG.setCompletion(0.95);

// Avvia immediatamente un finale
window.DDS_DEBUG.forceEnding('secret'); // 'curse' | 'treasure' | 'business' | 'secret'

// Scatena un evento dinamico nel deserto
window.DDS_DEBUG.triggerEvent('sandstorm'); // oppure 'merchant'

// Massimizza tutti gli strumenti e lavoratori
window.DDS_DEBUG.unlockAllUpgrades();

// Aggiungi Tavolette Antiche meta-valuta
window.DDS_DEBUG.addTablets(25);

// Sblocca tutti i cosmetici nel Guardaroba
window.DDS_DEBUG.unlockAllSkins();

// Sblocca tutti i biomi di spedizione
window.DDS_DEBUG.unlockAllBiomes();

// Report della memoria GPU (geometrie, texture, particelle)
console.table(window.DDS_DEBUG.getMemoryReport());
```

---

## 🚀 Avvio Locale Rapido

Poiché il progetto adotta i moduli ES nativi di JavaScript (`import`/`export`) e import map, è necessario servirlo tramite un web server HTTP statico (non via doppio click con protocollo `file://`):

### Con Python (Linux / macOS / Windows):
```bash
python3 -m http.server 8080
```
Apri poi il browser all'indirizzo: **`http://localhost:8080`**

### Con Node.js / npx:
```bash
npx serve .
```

### Con Visual Studio Code:
Installa l'estensione **Live Server**, fai clic destro su `index.html` e seleziona *"Open with Live Server"*.

---

## 🧪 Esecuzione della Suite di Test

Il progetto dispone di una suite di 92 test unitari automatizzati, eseguibili con il loader nativo dei moduli di Node.js:

```bash
# Esegui tutte le suite di test (Fasi 1-15)
for f in tests/phase*.test.mjs; do node --import ./tests/register.mjs "$f"; done
```

---

## 📦 Deployment su GitHub Pages

Il repository include il workflow GitHub Actions pronto all'uso in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. Su GitHub, accedi a **Settings** > **Pages**.
2. Nella sezione **Build and deployment** > **Source**, seleziona **GitHub Actions**.
3. A ogni push su `master`, il gioco viene compilato e pubblicato automaticamente su GitHub Pages.

---

## 📜 Licenza & Diritti

- **Codice sorgente:** Licenza MIT — vedi il file [`LICENSE`](LICENSE).
- **Tipografia:** SIL Open Font License (Cinzel Decorative, Cinzel, Syne).
- **Asset 3D & Audio:** CC0 1.0 Universal / Public Domain (Kenney, Quaternius, OpenGameArt).
