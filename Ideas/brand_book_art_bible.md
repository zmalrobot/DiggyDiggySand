# Diggy Diggy Sand — Brand Book & Art Bible

> **Codename Visivo:** *Atlantean-Kemetism* (Incontro tra l'Egitto Monumentale e la Tecnologia Ancestrale di Atlantide)  
> **Target Implementazione:** Regole tassative di stile per codice UI (HTML/CSS) e 3D Shader/Materiali (Three.js) da fornire ad Antigravity.

---

## 1. Visione Estetica & Filosofia del Design

Il gioco fonde due universi archeologici mitologici:
- **Egitto (Kemet / Sole / Sabbia):** Arenaria scolpita, blocchi massicci dorati, simbolismo solare, calore secco, ocra, polvere e decadenza maestosa.
- **Atlantide (Abisso / Luce / Oricalco):** Cristalli emittenti, turchese luminescente, ciano abissale, ottone dorato lucente (*oricalco*), geometrie esoteriche perfette e tecnologia sottomarina dimenticata.

### Il Contrasto Visivo Chiave
* **In superficie (Inizio):** Il mondo sembra un arido deserto egizio, dominato da sabbia calda e vecchi attrezzi di metallo battuto.
* **In profondità (Avanzamento):** Emergono rilievi scolpiti in arenaria che presentano venature e canali intagliati riempiti di una resina/cristallo turchese brillante (*Atlantean Energy*).

---

## 2. Tipografia Ufficiale

Tutti i caratteri scelti sono gratuiti sotto licenza open-source (**SIL Open Font License**) e disponibili su **Google Fonts**. Possono essere scaricati in locale (`.woff2` / `.ttf`) o importati via CDN web.

### 2.1 Mappatura dei Ruoli

| Ruolo | Font Family | Pesi | Uso |
|---|---|---|---|
| **Display / Titoli Maggiori** | `Cinzel Decorative` | 700 (Bold), 900 (Black) | Logo, titoli schermate finali, banner di traguardo |
| **Header UI / Nomi Shop** | `Cinzel` | 600 (SemiBold), 700 (Bold) | Nomi degli upgrade, pulsanti primari, intestazioni pannelli |
| **Numeri / Moneta / Statistiche** | `Syne` | 700 (Bold), 800 (ExtraBold) | Contatore sabbia, rateo per secondo, indicatori di completamento |
| **Body / Descrizioni Tooltip** | `Syne` | 400 (Regular), 500 (Medium) | Testo esplicativo, lore, dialoghi, log di eventi |

### 2.2 Codice di Integrazione Immediata (HTML / CSS)

```html
<!-- Inserire nell'head di index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@600;700&family=Syne:wght@400;500;700;800&display=swap" rel="stylesheet">
```

```css
/* Variabili CSS di font */
:root {
  --font-display: 'Cinzel Decorative', serif;
  --font-heading: 'Cinzel', serif;
  --font-data: 'Syne', sans-serif;
  --font-body: 'Syne', sans-serif;
}
```

---

## 3. Palette Cromatica Ufficiale

### 3.1 Codici Esadecimali & Variabili CSS

```css
:root {
  /* --- PALETTE EGIZIA (Terra, Sabbia, Arenaria) --- */
  --sand-surface:      #E4C580; /* Sabbia fine superficiale */
  --sand-compact:      #C89849; /* Sabbia compatta (strato medio) */
  --sandstone-deep:    #8C5828; /* Roccia arenaria e mattoni di scavo */
  --gold-pharaoh:      #F5BA23; /* Oro solare per reward e icone base */
  --gold-glow:         #FFE380; /* Bagliore oro caldo */

  /* --- PALETTE ATLANTEA (Cristalli, Tecnologia, Etere) --- */
  --atlantis-teal:     #0FE3C1; /* Cianite / Luce primaria dei cristalli */
  --atlantis-cyan:     #00B4D8; /* Energia sottomarina concentrata */
  --atlantis-abyss:    #031826; /* Blu notte abissale per fondi UI */
  --orichalcum:        #D87D38; /* Rame-oricalco metallico */
  --crystal-pulse:     #84FFF0; /* Picco di emissione bioluminescente */

  /* --- INTERFACCIA UTENTE (Sfondo, Bordi, Testo) --- */
  --ui-bg:             rgba(3, 24, 38, 0.88);     /* Vetro scuro con riflesso abisso */
  --ui-surface:        rgba(10, 42, 64, 0.70);    /* Superficie card shop */
  --ui-border-gold:    #D4AF37;                  /* Bordo in ottone/oro antico */
  --ui-border-teal:    rgba(15, 227, 193, 0.4);  /* Bordo illuminato da condotto atlantideo */
  --text-main:         #FBF7EE;                  /* Bianco pergamena chiaro */
  --text-muted:        #94A8B3;                  /* Grigio mare antico */
  --text-accent:       #0FE3C1;                  /* Valori modificati / bonus */
}
```

### 3.2 Corrispondenza Three.js (Hex Numerici)

```javascript
export const PALETTE_3D = {
  // Sabbia e Terreno
  sandTop: 0xE4C580,
  sandMid: 0xC89849,
  sandBedrock: 0x8C5828,

  // Città Perduta (Mesh di base)
  ruinsStone: 0x4A4138,
  ruinsGoldInlay: 0xF5BA23,
  atlantisCoreTeal: 0x0FE3C1,
  
  // Illuminazione Ambientale & Luci
  sunLight: 0xFFF3D6,
  ambientSky: 0x3A5A6D,
  crystalLight: 0x00E5FF,
  
  // Particellare
  particleDust: 0xECD599,
  particleSpark: 0x0FE3C1
};
```

### 3.3 Palette Ufficiale dei 4 Biomi di Spedizione

Ciascun bioma possiede una precisa stratificazione cromatica per quota altimetrica ($Y>8$, $3<Y\le8$, $Y\le3$) e per le venature luminescenti del basamento:

| Bioma | Strato 1: Superficie ($Y>8$) | Strato 2: Intermedio ($3<Y\le8$) | Strato 3: Basamento ($Y\le3$) | Venature Luminescenti |
|---|---|---|---|---|
| **Deserto Egizio (`desert`)** | Sabbia dorata fine `#E0C27A` (`0xE0C27A`) | Ocra compatta `#B88A44` (`0xB88A44`) | Arenaria scura `#6E563B` (`0x6E563B`) | Turchese atlantideo `#0FE3C1` |
| **Oceano Prosciugato (`ocean`)** | Sabbia corallina chiara `#F5E6CA` (`0xF5E6CA`) | Sedimenti marini `#4A7C82` (`0x4A7C82`) | Abisso pietrificato `#1B3240` (`0x1B3240`) | Oro puro d'oricalco `#F5BA23` |
| **Ghiacciaio Arcaico (`glacier`)** | Neve e permafrost `#E8F4F8` (`0xE8F4F8`) | Ghiaccio compatto azzurro `#7BAEC2` (`0x7BAEC2`) | Roccia scistosa fredda `#2A3B45` (`0x2A3B45`) | Ciano bioluminescente `#00F2FF` |
| **Giungla Sepolta (`jungle`)** | Humus e muschio `#3D5C38` (`0x3D5C38`) | Argilla e corteccia `#5C4028` (`0x5C4028`) | Basamento di fango fossile `#2E241C` (`0x2E241C`) | Smeraldo vitale `#2ECC71` |

---

## 4. Linee Guida UI / HUD (Look & Feel)

L'interfaccia deve sembrare una **lastra cerimoniale oracolare**: non un banale menu flat moderno, ma un manufatto antico che si illumina di energia atlantea a contatto con le dita del giocatore.

### 4.1 Caratteristiche Visive dei Componenti

1. **Finestre e Card (Glassmorphism Antico):**
   - Sfondo blu abisso semitrasparente (`--ui-bg`) con `backdrop-filter: blur(12px)`.
   - Angoli smussati tagliati a 45 gradi (bevel geometrico in puro stile piramidale/monolitico) anziché curve morbide moderne (`clip-path` angolare).
   - Doppia bordatura: filetto esterno sottile in oro satinato (`--ui-border-gold`) e riflesso interno tenue in ciano atlantideo.

2. **Pulsanti di Acquisto:**
   - Stato normale: cornice dorata scura con texture di pietra o gradiente metallico oricalco.
   - Stato attivo/cliccabile: i caratteri usano `Cinzel`, il bordo pulsa con un'ombra al neon (`box-shadow: 0 0 12px rgba(15, 227, 193, 0.5)`).
   - Stato disattivato (senza sabbia sufficiente): desaturato al 60%, opacità 0.45.

3. **Barra di Completamento dello Scavo:**
   - La barra non è una capsula liscia: è decorata come un **obelisco orizzontale graduato** o un glifo intarsiato.
   - Il riempimento si accende con una transizione da oro caldo (a inizio partita) a turchese radioattivo quando si scende verso la città sepolta.

---

## 5. Direzione Artistica 3D (Three.js)

### 5.1 Stile di Rendering: "Chiseled Low-Poly"
- **Ombre e Shading:** Usa `flatShading: true` sui materiali standard per esaltare le facce triangolari delle dune e dei crateri scavati. L'estetica deve ricordare blocchi di pietra squadrati e sabbia grezza.
- **Colorazione per Altezza del Terreno (Vertex Color Shader):**
  - Quota $Y > 8$: Gradiente sabbia chiara solare.
  - Quota $3 < Y \le 8$: Ocra compatta.
  - Quota $Y \le 3$: Pietra scura con venature di colore `0x0FE3C1` che emettono bagliori quando la luce solare cala.

### 5.2 Aspetto della Città Sepolta
Non semplici cubi generici, ma strutture che ricordano:
- Piramidi tronche a gradoni con incisioni geometriche rettilinee.
- Piloni e obelischi con punte dorate (`MeshStandardMaterial({ metalness: 0.8, roughness: 0.2 })`).
- Serbatoi e condotti circolari concentrici tipici della pianta classica di Atlantide.

### 5.3 Sistemi Particellari
- **Al Click/Scavo:** Non solo nuvolette di fumo; una miscela di:
  1. Piccole particelle triangolari/quadrate di sabbia (`#E4C580`).
  2. Rari frammenti di scintille acquamarina luminescente (`#0FE3C1`), a suggerire che sotto la sabbia c'è energia viva che aspetta di essere liberata.

### 5.4 Illuminazione Notturna, Floor di Sicurezza e Tone Mapping
- **Ambient Floor di Sicurezza:**
  - Nella scena deve essere **sempre attiva** una sorgente `THREE.AmbientLight(0x0D131A, 0.15)` denominata `ambientFloor` per prevenire il collasso al nero totale nelle cavità profonde.
  - La luce emisferica notturna del cielo è ancorata al blu abissale `#1B2A40` con un'intensità minima inderogabile $\ge 0.25$, mentre la luce riflessa del terreno è `#0D131A`.
  - La luce solare/lunare non si azzera mai completamente di notte ($\text{intensità} \ge 0.35$), mantenendo chiaramente visibile la silhouette plastica delle dune.
- **Tone Mapping Standard:**
  ```javascript
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  ```

### 5.5 Post-Processing Visivo & Antialiasing
- **Selective Bloom Calibrato:**
  - Estrazione multi-tap radiale applicata esclusivamente alle componenti con luminanza superiore a `0.85` (cristalli ciano, gemme, riflessi metallici dell'oricalco).
  - Parametri di riferimento bilanciati: `uBloomThreshold: 0.85, uBloomIntensity: 0.4, uBloomRadius: 0.5`.
  - Color grading caldo nei mezzitoni (`uWarmth: 0.08`) e vignette periferica morbida (`uVignetteDarkness: 0.28, uVignetteOffset: 0.95`).
- **Antialiasing Doppia Barriera:**
  - *Hardware MSAA 4x:* `samples: 4` su `THREE.WebGLRenderTarget` per il buffer offscreen.
  - *FXAA Integrato:* campionamento sub-pixel anti-aliasing sul quad compositore per eliminare le scalettature sulle facce low-poly.
  - *Opaque Output:* il fragment shader finale emette sempre `gl_FragColor = vec4(finalColor, 1.0)` per prevenire canvas trasparenti.

---

## 6. Archetipi Visivi per i Quattro Finali

| Finale | Condizione Visiva Dominante | Palette Riservata |
|---|---|---|
| **A. La Maledizione (Curse)** | Il cielo terso viene oscurato; la luce ciana si trasforma in cremisi sanguigno o verde putrido; le rovine cominciano a fumare ombre scure. | Rosso carminio (`#8B0000`), Nero ossidiana (`#100A0A`), Viola vuoto (`#2E0854`) |
| **B. Il Tesoro (Treasure)** | I canali d'acqua di Atlantide si riempiono di luce pura solare; le pietre si trasformano in oricalco fuso, zaffiri e lapislazzuli scintillanti. | Oro puro brillante (`#FFDF00`), Lapislazzulo (`#1D3557`), Bianco diamante (`#FFFFFF`) |
| **C. L'Impresa di Scavo (Business)** | Il misticismo svanisce all'improvviso. La luce acquatica scompare lasciando posto a un cantiere moderno; compaiono cartelli arancioni fluo e coni spartitraffico low-poly sulla roccia sterile. | Arancione fluo da cantiere (`#FF6B00`), Grigio asfalto (`#333333`), Giallo segnaletica (`#FFDE00`) |
| **D. L'Ascensione di Atlantide (Secret)** | Il cuore d'oricalco sepolto pulsa a frequenza armonica; fessure d'energia ciano squarciano la roccia, eruttando geyser di luce che sollevano obelischi e piloni verso la volta celeste. | Ciano nucleare (`#00F2FF`), Oricalco ardente (`#FF7A36`), Luce eterea (`#84FFF0`), Viola vuoto cosmico (`#1A0B2E`) |

---

## 7. Regole di Conformità per Antigravity

Ogni volta che Antigravity genera codice per questo progetto, deve rispettare rigorosamente i seguenti vincoli:

1. **Nessun font standard di sistema:** Mai usare `Arial`, `Inter`, `Roboto` o `system-ui`. I font sono unicamente **Cinzel Decorative**, **Cinzel** e **Syne**.
2. **Nessun componente UI piatto/monocromatico:** I contenitori dell'interfaccia devono adottare il tema "Atlantean-Kemet": pannelli in vetro blu scuro, con bordo dorato o ciano brillante.
3. **Gerarchia dell'oro e del ciano:**
   - L'**Oro** rappresenta la *ricchezza immediata* e la *materia* (la sabbia scavata, il costo base, il sole).
   - Il **Ciano/Teal** rappresenta il *mistero*, la *tecnologia perduta*, il progresso magico e il completamento della percentuale.
4. **Resa Low-Poly coerente:** Nelle geometrie Three.js non inserire smussature o suddivisioni eccessive; preservare spigoli netti, facce piane e giochi di luce calcolati per triangolo.