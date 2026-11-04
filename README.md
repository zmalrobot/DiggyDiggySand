# Diggy Diggy Sand: The Sunken City

[![Versione: v1.0.0](https://img.shields.io/badge/Versione-v1.0.0%20(Gold%20Master)-F5BA23.svg)](manifest.json)
[![Licenza: MIT](https://img.shields.io/badge/Licenza-MIT-0FE3C1.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r160%20(Locale)-00B4D8.svg)](https://threejs.org/)
[![PWA](https://img.shields.io/badge/PWA-Offline%20Cache%20v1.0.0-brightgreen.svg)](sw.js)
[![Tests](https://img.shields.io/badge/Test%20Suite-100%25%20Passing-brightgreen.svg)](tests/)

> *"Svuota il deserto. Scopri cosa dorme sotto le sabbie d'Egitto."*

**Diggy Diggy Sand** è un miner 3D incrementale e reverse city-builder low-poly chiseled per browser desktop, tablet e smartphone. Il giocatore scava manualmente e con una flotta autonoma di automi e macchinari pesanti una duna desertica deformabile in tempo reale, portando alla luce una metropoli monumentale sepolta della civiltà perduta di Atlantide, fino a innescare uno dei 4 finali dinamici con risvolti narrativi imprevedibili.

---

## 🏛️ Caratteristiche Principali del Gioco

- **Stile Visivo "Chiseled Low-Poly":** Geometrie angolate con `flatShading: true` e palette cromatica Atlantean-Kemet (oro e sabbia `#F5BA23`, `#E4C580` contrapposti a ciano e oricalco `#0FE3C1`, `#00B4D8`).
- **Terreno Procedurale a Dune Ondulate:** Generazione altimetrica differenziata per bioma (`getInitialBiomeHeightOffset`), conservazione rigorosa del volume iniziale e aggiornamento sub-grid analitico delle normali $O(k)$ per 60 FPS granitici.
- **Pipeline Grafica Avanzata & PBR Procedurale:**
  - *Texture PBR a 2048px:* generazione runtime in memoria di rumore continuo FBM a 4 ottave e mappe di normali Sobel senza download esterni.
  - *Illuminazione Ambient Floor:* sorgente di sicurezza `#0D131A` e cielo notturno $\ge 0.25$ per scongiurare schermi neri a grafica alta.
  - *Tone Mapping Cinematografico:* `THREE.ACESFilmicToneMapping` con esposizione 1.0 e anisotropia massima GPU (fino a $16\times$).
  - *Doppio Antialiasing:* Hardware MSAA 4x su `WebGLRenderTarget` e shader pass FXAA su scala di luminanza.
  - *Raytracing Sperimentale (SSR & SSAO):* riflessi speculari screen-space sui metalli e occlusione ambientale nelle cavità scavate (default disattivato con bypass a costo zero).
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
- **Ciclo Giorno/Notte Continuo:** Orbita solare/lunare di 4 minuti con sole, luna oricalco, cupola stellata procedurale e torce arcaiche ad emissione tremolante.
- **Quality of Life & Game Juice:**
  - *Multi-Buy nel Negozio:* selettore $1\times, 10\times, 100\times, \text{MAX}$ con calcolo analitico della serie geometrica.
  - *Notazione Numerica:* toggle tra formato compatto standard (`K, M, B, T, Qa`) e notazione scientifica (`1.25e6`).
  - *Save Import/Export:* esportazione e importazione portabile del salvataggio in Base64 con verifica di integrità CRC32.
  - *Floating Text:* cifre dorate e turchesi fluttuanti proiettate direttamente dal punto d'impatto 3D.
  - *Camera Shake & Haptic Feedback:* scotimento con decadimento esponenziale ed impulsi di vibrazione tattile su mobile.
- **Direttive di Spedizione Dinamiche:** Bounties effimere a rotazione con ricompense immediate in sabbia e buff temporanei (sconti bottega, picchi di estrazione).
- **Accessibilità & Comfort Visivo:** Preset *Reduced Motion* (azzeramento scotimento e riduzione particellare) e *Smart Pause* con arresto dell'accumulo $dt$ all'uscita dal tab.
- **Supporto PWA Offline Completo:** Service Worker (`sw.js`) con cache `dds_cache_v1.0.0` per giocare al 100% senza connessione internet.
- **Doppio Binario Asset con Fallback Garantito:** Caricamento modelli GLTF e campioni audio OGG con subentro immediato e trasparente dei generatori procedurali `ProceduralFactory.js` e `SoundSynth`.
- **Zero Build Step:** HTML5, CSS3 Glassmorphism, ES Modules nativi e Three.js r160 pinnato in locale.

---

## 🎮 Schema Completo dei Controlli

Il gioco riconosce automaticamente la periferica in uso e adatta interfaccia e controlli:

| Azione | Desktop (Mouse / Tastiera) | Mobile / Tablet (Touch Screen) |
|---|---|---|
| **Scavo Sabbia** | Click sinistro (tap) o Tieni premuto (hold) | Tocco singolo o Tap prolungato con un dito (con haptic pulse) |
| **Scavo Rapido / Istantaneo** | Barra Spaziatrice (`Space`) | — |
| **Rotazione Camera** | Click destro + Trascina oppure Tasti `Q` / `E` | Gesto a due dita (Two-Finger Orbit Drag) |
| **Pan / Spostamento** | Tasti `W`, `A`, `S`, `D` o Frecce direzionali | Shift + Click destro oppure Pan a due dita |
| **Zoom / Carrello** | Rotellina del mouse | Pinch-to-zoom con due dita |
| **Officina / Negozio** | Click sul pulsante `Officina` nell'HUD | Tap su `Officina` (apre il Bottom Sheet scorrevole) |
| **Pausa & Menu** | Tasto `Esc` o pulsante `⚙️ Pausa` | Tap sul pulsante `⚙️ Pausa` nell'HUD |
| **Guida & Legenda** | Tasto `H` o pulsante `❓ Aiuto` | Tap sul pulsante `❓ Aiuto` nell'HUD |
| **Suite Debug** | Tasto rapido **`F2`** o **`~` / `` ` ``** | Parametro query string `?debug=1` |
| **Profiler Hardware WebGL** | Tasto rapido **`F3`** | Toggle nel pannello Grafica delle Impostazioni |

---

## 📱 Architettura Adattiva a 3 Tier

Diggy Diggy Sand si adatta a tre livelli hardware preservando identica fedeltà grafica:
1. **Tier 1 — Desktop ($\ge 1025\text{px}$):** Topbar orizzontale, cassetto Negozio laterale destro da $380\text{px}$, modali cerimoniali centrate.
2. **Tier 2 — Tablet ($601\text{px} - 1024\text{px}$):** Bottoni maggiorati a minimo $44\text{px} \times 44\text{px}$ per facilitare il tocco, layout ottimizzato per landscape ($45\%$ larghezza) e portrait ($55\%$ altezza).
3. **Tier 3 — Smartphone ($\le 600\text{px}$):** Bottom Sheet a scomparsa dal basso con bordi arrotondati superiori da $20\text{px}$ e maniglia tattile, rispetto dei margini notch/home bar (`env(safe-area-inset-*)`) e compensazione del FOV verticale per display $9:16$ e $9:19.5$.

---

## 🛠️ Parametri URL di Test & Suite Debug

Per il collaudo rapido e la verifica delle milestone, sono disponibili parametri URL dedicati:

| Parametro URL | Funzione | Esempio Pratico |
|---|---|---|
| `?debug=1` | Attiva la console di diagnostica avanzata e il monitor FPS | `index.html?debug=1` |
| `?cheat=1` | Sblocca immediatamente la scheda Trucchi e i comandi sandbox | `index.html?cheat=1` |
| `?ending=curse` | Forza il climax sul finale *La Maledizione di Atlantide* | `index.html?ending=curse` |
| `?ending=treasure` | Forza il climax sul finale *Il Tesoro d'Oro Puro* | `index.html?ending=treasure` |
| `?ending=business` | Forza il climax sul finale *L'Impresa Mineraria SRL* | `index.html?ending=business` |
| `?ending=secret` | Forza il climax sul finale segreto *L'Ascensione di Atlantide* | `index.html?ending=secret` |

### API da Console (`window.DDS_DEBUG` / `window.__DDS_DEBUG`)
```javascript
// Calcola in < 20ms la progressione economica completa e valida la curva target (30-35 min)
window.__DDS_DEBUG.simulateProgression();

// Accredita 500.000 unità di sabbia
window.DDS_DEBUG.addSand(500000);

// Imposta lo stato di scavo al 95%
window.DDS_DEBUG.setCompletion(0.95);

// Attiva immediatamente una tempesta di sabbia (+50% resa)
window.DDS_DEBUG.triggerEvent('sandstorm');

// Genera il report della memoria GPU (geometrie, materiali, texture caricate)
console.table(window.DDS_DEBUG.getMemoryReport());
```

---

## 🚀 Avvio Locale Rapido

Poiché il progetto utilizza i moduli ES nativi di JavaScript (`import`/`export`) e import map, è necessario servirlo tramite un web server HTTP statico (non tramite protocollo `file://`):

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

### Installazione come PWA Offline:
Su Chrome o Edge (Desktop/Android), fai clic sull'icona **"Installa app"** nella barra degli indirizzi; su Safari iOS, tocca il pulsante Condividi e seleziona **"Aggiungi alla schermata Home"**. Il gioco funzionerà al 100% anche senza connessione internet.

### Deployment su GitHub Pages:
Il repository include un workflow GitHub Actions in `.github/workflows/deploy.yml` per la pubblicazione automatica su **GitHub Pages** a ogni push sul branch `master`.

---

## 🧪 Suite di Test Automatizzati

Il progetto include una suite completa di test unitari (Fasi 1-20), eseguibili tramite il register loader di Node.js:

```bash
# Esegui tutti i test unitari
for f in tests/phase*.test.mjs; do node --import ./tests/register.mjs "$f" || exit 1; done

# Esegui il test di bilanciamento economico e stabilità memoria
node --import ./tests/register.mjs tests/phase20_economy_stability.test.mjs

# Esegui il collaudo headless con Chrome DevTools Protocol
node tests/phase20_browser_qa.mjs
```

---

## 📜 Licenze & Attribuzioni Open Source

Tutto il codice sorgente e le risorse adottate rispettano licenze open source permissive:

- **Codice Sorgente:** Licenza MIT — vedi il file [`LICENSE`](LICENSE).
- **Motore 3D:** Three.js r160 (MIT License, © 2010-2024 Three.js Authors, mrdoob).
- **Tipografia:** SIL Open Font License 1.1 (Cinzel Decorative, Cinzel di Natanael Gama; Syne di Bonjour Monde e Lucas Descroix).
- **Modelli 3D & Effetti Sonori:** CC0 1.0 Universal / Public Domain (Kenney, Quaternius, OpenGameArt).
