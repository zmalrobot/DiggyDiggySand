# Diggy Diggy Sand: The Sunken City

[![Licenza: MIT](https://img.shields.io/badge/Licenza-MIT-F5BA23.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r160%20(Locale)-0FE3C1.svg)](https://threejs.org/)
[![PWA](https://img.shields.io/badge/PWA-Standalone%20Ready-00B4D8.svg)](manifest.json)
[![Tests](https://img.shields.io/badge/Test%20Suite-48%2F48%20Passing-brightgreen.svg)](tests/)
[![Build Status](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue.svg)](https://pages.github.com/)

> *"Svuota il deserto. Scopri cosa dorme sotto le sabbie d'Egitto."*

**Diggy Diggy Sand** è un gioco incrementale 3D (3D Sand Miner / Reverse City-Builder) per browser desktop e mobile. Il giocatore scava manualmente e con una flotta di macchinari autonomi una duna desertica deformabile in tempo reale, portando alla luce una metropoli monumentale sepolta della civiltà perduta di Atlantide, fino a innescare uno dei 4 finali dinamici.

---

## 🏛️ Pilastri di Design & Architettura

- **Stile Visivo "Chiseled Low-Poly":** Geometrie angolate con `flatShading: true`, palette cromatica Atlantean-Kemet (oro e sabbia `#F5BA23`, `#E4C580` contrapposti a ciano e oricalco `#0FE3C1`, `#00B4D8`).
- **Terreno Deformabile Stratificato:** Heightmap ad alte prestazioni a chunk 8×8 con dirty flags e ricolorazione dinamica per quota (Superficie dorata $Y>8$, Sabbia aranciata $3<Y\le8$, Roccia scura e detriti $Y\le3$ con venature cerulee).
- **Città Sepolta Procedurale:** Santuario centrale con obelisco, viali colonnati sui punti cardinali e quartieri a terrazze posizionati interamente al di sotto della duna iniziale ($Y \le 8.8$), rivelati naturalmente dallo scavo.
- **Economia Disaccoppiata dal Rendering:** Calcolo Sand Per Second (SPS), usura e guadagni offline con timestamp reali indipendenti dal frame rate.
- **Flotta Lavoratori 3D:** Scarafaggi meccanici, Escavatori a vapore e Draghe sabbiose che pattugliano la fossa e scavano fisicamente il terreno.
- **I Quattro Finali Dinamici:**
  - ☠️ **La Maledizione di Atlantide (`curse`):** Tempesta di sangue cosmico e risveglio dell'antico terrore.
  - 👑 **Il Tesoro d'Oro Puro (`treasure`):** Cascata di monete e gemme preziose d'oro massiccio.
  - 🏗️ **L'Impresa Mineraria (`business`):** Anticlimax corporativo, cantieristica industriale e modalità Sandbox libera.
  - 🔱 **L'Ascensione di Atlantide (`secret`):** Il risveglio del cuore d'oricalco, geyser di luce ciano e levitazione delle rovine.
- **Meta-Progressione (New Game+):** Guadagno di Tavolette Antiche ($\tau$) ad ogni epilogo per sbloccare perk permanenti nel *Santuario dei Predecessori*.
- **Eventi Spontanei nel Deserto:** Tempeste di sabbia con bonus $+50\%$ e carovane del Mercante Nomade con contratti a tempo limitato.
- **Zero Build Step:** HTML5, CSS3 moderno, ES Modules nativi e copia pinnata locale di Three.js r160 in `vendor/three/`.

---

## 🎮 Controlli di Gioco

Il gioco supporta nativamente mouse/tastiera su desktop e gesture touch avanzate su smartphone e tablet:

| Azione | Desktop (Mouse / Tastiera) | Mobile / Touch Screen |
|---|---|---|
| **Scavo Sabbia** | Click sinistro (tap) o Tieni premuto (hold) | Tocco singolo o Tap prolungato con un dito |
| **Rotazione Camera** | Click destro + Trascina | Gesto a due dita (Pinch & Orbit Drag) |
| **Pan / Spostamento** | Tasti `W`, `A`, `S`, `D` o Frecce direzionali | Shift + Click destro oppure Pan a due dita |
| **Zoom / Dolly** | Rotellina del mouse | Pinch to zoom con due dita |
| **Officina Upgrade** | Click sul pulsante `Officina` nell'HUD | Tap su `Officina` (cassetto espanso a tutto schermo) |
| **Pausa & Opzioni** | Tasto `Esc` o pulsante `⚙️ Pausa` | Tap sul pulsante `⚙️ Pausa` nell'HUD |
| **Suite Debug** | Tasto rapido **`F2`** o **`~` / `` ` ``** (Backquote) | Tramite console o parametro URL `?debug=1` |

---

## 🛠️ Suite Debug & Parametri URL

Diggy Diggy Sand include strumenti di collaudo e parametri query per testare rapidamente ogni meccanica:

### Parametri URL
| Parametro | Descrizione | Esempio |
|---|---|---|
| `?debug=1` | Attiva la suite di debug estesa con log dettagliati | `index.html?debug=1` |
| `?cheat=1` | Abilita i comandi cheat immediati | `index.html?cheat=1` |
| `?ending=<id>` | Forza il finale della run: `curse`, `treasure`, `business`, `secret` | `index.html?ending=secret` |

### Comandi Console Rapidi (`window.DDS_DEBUG`)
Aprendo gli Strumenti per Sviluppatori (`F12`), è disponibile l'interfaccia:
```javascript
// Accredita sabbia istantanea
window.DDS_DEBUG.addSand(50000);

// Forza percentuale di scavo al 99%
window.DDS_DEBUG.setCompletion(0.99);

// Forza l'attivazione immediata di un finale
window.DDS_DEBUG.forceEnding('secret'); // 'curse' | 'treasure' | 'business' | 'secret'

// Lancia un evento dinamico nel deserto
window.DDS_DEBUG.triggerEvent('sandstorm'); // oppure 'merchant'

// Sblocca tutti gli upgrade al livello massimo
window.DDS_DEBUG.unlockAllUpgrades();

// Aggiungi Tavolette Antiche tau
window.DDS_DEBUG.addTablets(10);

// Sblocca tutti i finali nella Galleria trofei
window.DDS_DEBUG.unlockAllEndings();

// Monitoraggio risorse WebGL e memoria
console.table(window.DDS_DEBUG.getMemoryReport());

// Pulisci liste di rendering VRAM GPU
window.DDS_DEBUG.cleanVRAM();

// Apri / Chiudi il pannello grafico live
window.DDS_DEBUG.togglePanel();
```

---

## 🚀 Avvio Locale Rapido

Poiché il gioco utilizza i moduli JavaScript ES nativi (`import`/`export`), è necessario servirlo tramite un server HTTP statico locale (non tramite doppio click su `file://`):

### Con Python (Preinstallato su Linux/macOS/Windows):
```bash
python3 -m http.server 8080
```
Apri poi il browser su: **`http://localhost:8080`**

### Con Node.js / npx:
```bash
npx serve .
```

### Con Visual Studio Code:
Installa l'estensione **Live Server**, fai clic destro su `index.html` e seleziona *"Open with Live Server"*.

---

## 📦 Deployment su GitHub Pages

Il repository include il workflow GitHub Actions pronto all'uso in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Istruzioni per la pubblicazione:
1. Crea un repository su GitHub e carica il codice:
   ```bash
   git remote add origin https://github.com/<tuo-utente>/<tuo-repo>.git
   git push -u origin main
   ```
2. Vai su **Settings** > **Pages** del repository GitHub.
3. Nella sezione **Build and deployment** > **Source**, seleziona **GitHub Actions**.
4. Il workflow si avvierà automaticamente a ogni commit e renderà il gioco giocabile all'indirizzo:
   `https://<tuo-utente>.github.io/<tuo-repo>/`

---

## 🧪 Esecuzione della Suite di Test

Il progetto dispone di una suite di test completa (48 unit test) eseguibili direttamente da riga di comando senza dipendenze pesanti:

```bash
# Esegui tutti i test (Fasi 1-7)
node --import ./tests/register.mjs tests/phase1.test.mjs
node --import ./tests/register.mjs tests/phase2.test.mjs
node --import ./tests/register.mjs tests/phase3.test.mjs
node --import ./tests/register.mjs tests/phase4.test.mjs
node --import ./tests/register.mjs tests/phase5.test.mjs
node --import ./tests/register.mjs tests/phase6.test.mjs
node --import ./tests/register.mjs tests/phase7.test.mjs
```

---

## 📜 Licenza & Riconoscimenti

- **Codice:** Rilasciato sotto Licenza [MIT](LICENSE).
- **Libreria 3D:** [Three.js r160](https://threejs.org/) (Licenza MIT) inclusa in copia locale in `vendor/three/`.
- **Tipografia:** Google Fonts:
  - *Cinzel Decorative* (700, 900) per titoli e display epiloghi.
  - *Cinzel* (600, 700) per pulsanti, header e officina.
  - *Syne* (400–800) per metriche numeriche, contatori e corpo del testo.
- **Audio:** Sintetizzatore procedurale basato su Web Audio API nativa (`AudioEngine.js`), senza dipendenze o file audio esterni proprietari.
