# Diggy Diggy Sand — Game Design & Technical Document

> **Titolo Ufficiale:** *Diggy Diggy Sand: The Sunken City*  
> **Genere:** Incremental / Clicker 3D a scavo procedurale con finali multipli ed epiloghi narrativi  
> **Piattaforma:** Browser Web moderno (Desktop e Mobile Web standalone PWA)  
> **Stack Tecnologico:** Vanilla JavaScript (ES Modules), HTML5, CSS3 Glassmorphism, Three.js (r160)  
> **Vincolo Architetturale:** 100% Client-Side, Zero Build Step obbligatorio, Funzionamento Offline totale garantito

---

## 1. Visione di Gioco (Pitch)

Un deserto infinito. Una pala di bronzo consumata. Un unico obiettivo apparentemente folle: **rimuovere l'intero deserto fino all'ultimo granello di sabbia**.

Il giocatore scava fisicamente la sabbia in 3D, accumula valuta, acquista potenziamenti e schiera una flotta di macchinari autonomi. Scendendo in profondità, la sabbia muta consistenza e colore finché, sotto la coltre millenaria, riemerge una metropoli sepolta dimenticata dal tempo. 

Quale segreto riposa al centro del sito? Il destino dell'intera spedizione è **estratto in modo deterministico ma occulto dal seed iniziale**: ogni run conduce a una rivelazione imprevedibile (un'antica maledizione cosmica, un bottino incalcolabile, l'ironica fondazione di una multinazionale di movimento terra, o l'ascensione armonica di Atlantide).

---

## 2. Pilastri di Design (Core Pillars)

1. **Scavo Soddisfacente ("Game Juice"):** Ogni singolo tocco o clic garantisce feedback sensoriale immediato: deformazione geometrica in tempo reale, particelle, audio con pitch casuale, micro-tremolio dinamico della telecamera, feedback aptico su mobile e numeri di danno/valuta fluttuanti.
2. **Progressione Fisica Tangibile:** Il deserto si svuota realmente nel mondo 3D. Non ci sono finzioni o schermate statiche: il cratere si allarga, le dune cedono e i piloni monumentali emergono dalla terra.
3. **Mistero Archeologico:** Cosa c'è sepolto laggiù? Il ritmo degli indizi spinge costantemente il giocatore a scavare "ancora per qualche metro".
4. **Rigiocabilità e Rigore Single-Player:** Quattro finali completi (tre base + uno segreto), quattro biomi geologici con modificatori fisici dedicati, e un albero di meta-progressione che premia le spedizioni concluse.
5. **Profondità Senza Attrito (Quality of Life):** Selettori di acquisto massivo ($1\times, 10\times, 100\times, \text{MAX}$), formattazione numerica avanzata, esportazione/importazione dei salvataggi in formato testuale e suite completa di accessibilità.
6. **Integrità Tecnica Commerciale:** Resa grafica chiseled low-poly d'alta fedeltà, profiling diagnostico live delle risorse GPU/CPU e compatibilità totale con display touch verticali e schermi ultrawide.

---

## 3. Core Loop di Gameplay

```
   SCAVO FISICO  ──►  ACCUMULO SABBIA  ──►  POTENZIAMENTI & FLOTTA
        ▲                                          │
        │                                          ▼
   INCREMENTO DPS  ◄──  SINERGIE RELIQUIE  ◄──  SBLOCCO AUTOMAZIONE
        │
   IL CRATERE SCENDE  ──►  LA CITTÀ EMERGE  ──►  SVOLTA NARRATIVA (ENDING)
```

**Tempo stimato di una sessione:** 30–40 minuti (calibrato matematicamente per impedire stalli nell'early e mid-game).

---

## 4. Meccaniche di Gioco Dettagliate

### 4.1 Meccanica di Scavo
- **Click / Tap Singolo:** Rimuove un volume sferico/conico di sabbia centrato sul punto di impatto del raycast.
- **Pressione Prolungata (Hold):** Scavo a frequenza continua regolato dall'upgrade *Kinetic Rhythm*.
- **Caduta Morbida (Falloff):** La funzione di abbassamento vertici applica una curva polinomiale $f(d) = 1 - \left(\frac{d}{R}\right)^2$ per garantire crateri raccordati e realistici.
- **Fondo Insuperabile (Bedrock):** Nessun vertice del terreno può scendere al di sotto di $Y = 0$. Il pavimento roccioso e le fondamenta degli edifici sono indistruttibili.
- **Conversion Ratio:** Ogni metro cubo di terreno geometrico rimosso viene istantaneamente convertito nel conto **Sabbia** del giocatore.

### 4.2 Feedback Visivo e Tattile ("Game Juice")
- **Numeri Fluttuanti (Floating Damage/Resource Text):** A ogni impatto valido, una cifra stilizzata sale dal punto di contatto nel mondo 3D svanendo in dissolvenza verso l'alto (oro per colpi normali, ciano brillante con glow per colpi critici).
- **Camera Shake Procedurale:** Micro-traumi attenuati applicati alla rotazione/offset della camera al verificarsi di colpi critici, detonazioni di dinamite o scavi pesanti della draga.
- **Feedback Aptico (Vibration API):** Su dispositivi mobili compatibili, il browser innesca vibrazioni distinte: $12\text{ms}$ per lo scavo manuale, sequenze marcate $[40\text{ms}, 30\text{ms}, 80\text{ms}]$ per detonazioni o crolli.

### 4.3 Direttive di Spedizione (Contratti / Micro-Obiettivi)
Per eliminare la sensazione di monotonia nel segmento centrale di scavo ($15\% - 60\%$), il sistema attiva ciclicamente **Direttive di Spedizione**:
- Obiettivi dinamici a rotazione rapida mostrati in un pannello retrattile dell'HUD:
  - *"Estrai 15.000 unità di sabbia nel quadrante settentrionale."*
  - *"Raggiungi una combo di scavo continuativo per 12 secondi."*
  - *"Dissotterra la sommità della prima colonna monumentale."*
- **Ricompense Immediate:** Burst di valuta, riduzioni temporanee dei costi in officina o attivazione istantanea di moltiplicatori di scavo.

### 4.4 Stratificazione Cromatica e Resistenza Geologica

| Strato Altimetrico | Aspetto Visivo | Proprietà e Funzione Meccanica |
|---|---|---|
| **Strato 1: Superficie ($Y > 8$)** | Sabbia fine dorata | Scavo rapido e friabile; curva di apprendimento iniziale. |
| **Strato 2: Intermedio ($3 < Y \le 8$)** | Ocra compatta / Argilla densa | Densità superiore; richiede strumenti potenziati o supporto della flotta. |
| **Strato 3: Basamento ($Y \le 3$)** | Roccia sedimentaria scura e venature luminescenti | Pietra antica; emergono obelischi, templi e reliquie. |

---

## 5. I Finali di Spedizione

All'avvio di ogni spedizione, il generatore pseudo-casuale `mulberry32` estrae l'ID del finale associandolo al seed della partita. Il giocatore non conosce l'esito fino al raggiungimento della soglia critica ($98\% - 100\%$).

### 5.1 Finale A — La Maledizione (`curse`)
- **Premessa:** Il sito archeologico era un sepolcro sigillato per imprigionare un'entità ancestrale.
- **Sequenza Climax:** Rottura del sigillo centrale; il cielo e la nebbia virano verso il rosso cremisi; sciame di particelle scure e sussurri a bassa frequenza; comparsa di anomalie visive sul fondo della fossa.
- **Epilogo:** Schermata ironica e solenne: *"Forse avresti dovuto lasciare il deserto dov'era."*

### 5.2 Finale B — Il Tesoro (`treasure`)
- **Premessa:** La città custodisce le riserve auree e i cristalli imperiali di una dinastia dimenticata.
- **Sequenza Climax:** Cascata di monete d'oro e gemme turchesi che piovono sulle rovine; minigioco interattivo a tempo per cliccare le gemme rimbalzanti e moltiplicare a dismisura il conto finale.
- **Epilogo:** Conteggio estimativo del valore di mercato: *"Sei oscenamente ricco. Ora cosa ne farai di tutta questa sabbia?"*

### 5.3 Finale C — L'Impresa di Scavi (`business`)
- **Premessa:** Nessun mistero, nessun tesoro. Solo roccia nuda e un secchiello di plastica arrugginito al centro della fossa.
- **Sequenza Climax:** La musica epica si arresta con un fischio di vento comico; compare l'avviso *"Possiedi macchinari pesanti per milioni di monete. Perché non metterli a frutto?"*; apertura immediata della modalità sandbox **Tycoon** con contratti di scavo industriali.
- **Epilogo:** Certificato di fondazione della ditta di movimento terra con opzione di gioco libero infinito.

### 5.4 Finale D — Il Finale Segreto: L'Ascensione di Atlantide (`secret`)
- **Requisito di Sblocco:** Accessibile solo dopo aver completato e registrato nella galleria tutti e tre i finali base (`endingsSeen.length >= 3`).
- **Sequenza Climax:** Fessure luminescenti aprono il basamento roccioso; geyser d'energia turchese inondano il cratere; il nucleo d'oricalco si risveglia sollevando gli obelischi e i templi in levitazione magnetica verso la volta stellata.
- **Epilogo:** *"Il cuore di Atlantide batte di nuovo. La città risorge nei cieli."*

---

## 6. Architettura Tecnica e Moduli Software

### 6.1 Struttura delle Cartelle

```
/diggy-diggy-sand
├── index.html                   // Punto d'ingresso, viewport, glassmorphism layout
├── manifest.json                // PWA Web App Manifest (display: standalone)
├── css/
│   └── style.css                // Brand Book Atlantean-Kemet, Glassmorphism, Responsive HUD
├── js/
│   ├── main.js                  // Bootstrap, game loop RAF, global error boundaries
│   ├── core/
│   │   ├── Game.js              // Coordinamento sottosistemi, time step dt, ciclo pausa
│   │   ├── State.js             // Oggetto di stato reattivo, flag cheat, seed, quote
│   │   ├── Save.js              // LocalStorage I/O, backup automatico, validazione schema
│   │   ├── SaveSerializer.js    // Esportazione e importazione stringa Base64 con checksum
│   │   ├── Events.js            // Event bus per disaccoppiamento tra logica e UI
│   │   ├── SettingsManager.js   // Sincronizzazione preferenze, audio, rendering e comandi
│   │   ├── AudioEngine.js       // Web Audio API sintetizzatore SoundSynth e campioni audio
│   │   ├── AssetLoader.js       // Caricatore GLTF asincrono con fallback procedurale
│   │   └── I18n.js              // Dizionario bilingue (IT/EN) con aggiornamento DOM dinamico
│   ├── world/
│   │   ├── Terrain.js           // Heightmap 256x256, dune procedurali, sub-grid normals O(k)
│   │   ├── City.js              // Rovine procedurali sommerse per tutti i 4 biomi
│   │   ├── SceneManager.js      // Scena Three.js, camera orbitale, luci e ombre
│   │   ├── BiomeManager.js      // Proprietà fisiche e cromatiche dei 4 biomi
│   │   ├── DayNightCycle.js     // Orbita solare/lunare continua con lerp trigonometrico
│   │   ├── Sky.js               // Cupola celeste procedurale e campo stellare
│   │   ├── Torches.js           // Bracieri delle rovine con sfarfallio notturno
│   │   ├── Atmosphere.js        // Micro-polvere dorata fluttuante (InstancedMesh)
│   │   ├── PostProcessing.js    // MSAA 4x, FXAA, Selective Bloom, Tone Mapping ACES
│   │   ├── SSRPass.js           // Raytracing simulato (Screen-Space Reflections & SSAO)
│   │   └── ProceduralFactory.js // Generatore matematico di mesh low-poly per fallback
│   ├── systems/
│   │   ├── Digging.js           // Raycasting, clamping Y>=0, aggiornamento bounds
│   │   ├── Economy.js           // Calcoli SPS passivi, offline earnings, spesa scalare
│   │   ├── Upgrades.js          // Formule costo singolo e calcolo geometrico multi-buy
│   │   ├── Workers.js           // Flotta 3D autonoma (Scarabei, Escavatori, Draghe)
│   │   ├── Particles.js         // Pool a dimensione fissa (300 unità) senza allocazioni
│   │   ├── GameJuice.js         // Floating text canvas/DOM, camera shake e haptics
│   │   ├── Directives.js        // Micro-contratti dinamici a rotazione temporizzata
│   │   ├── Achievements.js      // Tracciamento trofei con blocco irreversibile cheat
│   │   ├── StatsManager.js      // Statistiche di carriera, tempi record, sabbia storica
│   │   ├── CosmeticsManager.js  // Guardaroba skin (pale, sabbie, automi) via Tavolette τ
│   │   ├── WorldEvents.js       // Tempeste di sabbia con fade continuo e Mercante Nomade
│   │   ├── DebugTools.js        // Cheat console protetti e scorciatoie di collaudo
│   │   └── Tutorial.js          // Onboarding progressivo al primo avvio
│   ├── ui/
│   │   ├── Hud.js               // Barra superiore, contatori, indicatore cheat, micro-bounties
│   │   ├── Shop.js              // Pannello officina con selettore multi-buy (1x, 10x, 100x, MAX)
│   │   ├── Modal.js             // Gestione modali ad alto livello e finestre di dialogo
│   │   ├── SettingsModal.js     // Schede Audio, Grafica, Comandi, Lingua, Raytracing, Trucchi
│   │   ├── ProfilerModal.js     // Monitor live di FPS, tempo di frame, draw calls e VRAM
│   │   ├── StatsModal.js        // Statistiche dettagliate e galleria trofei sbloccati
│   │   ├── BiomeSelectModal.js  // Selettore visivo delle destinazioni di spedizione
│   │   ├── GalleryModal.js      // Registro dei finali scoperti (1/4 .. 4/4)
│   │   ├── WardrobeModal.js     // Negozio cosmetico per skin ed effetti visivi
│   │   ├── HelpModal.js         // Legenda comandi rapidi (Desktop / Mobile)
│   │   ├── CreditsModal.js      // Riconoscimenti e attribuzioni legali (Three.js, Kenney, Fonts)
│   │   ├── PauseMenu.js         // Schermata di pausa in-game e salvataggio rapido
│   │   ├── LoadingScreen.js     // Barra di caricamento asincrona monotona
│   │   └── MainMenu.js          // Titolo principale con vista 3D panoramica del cratere
│   └── vendor/
│       └── three/               // Copia locale Three.js r160 pinned e componenti shader
└── assets/
    ├── audio/                   // Campioni sonori compressi (.ogg / .mp3)
    ├── textures/                // Mappe procedurali PBR ad alta definizione (2048x2048)
    └── models/                  // Modelli 3D low-poly (.glb / .gltf)
```

---

## 7. Motore di Rendering e Ottimizzazioni Grafiche

### 7.1 Deformazione Terreno e Normali Sub-Grid $O(k)$
- La mesh del terreno adotta una griglia di vertici $256 \times 256$ ($65.536$ vertici totali).
- All'impatto della pala o delle scavatrici, il motore **non** ricalcola le normali dell'intera griglia geometrica.
- Tramite il metodo `computeSubGridNormals(minX, minZ, maxX, maxZ)`, vengono ri-analizzati esclusivamente i triangoli inclusi nel bounding box locale del cratere, abbattendo il costo computazionale a poche centinaia di iterazioni per colpo e stabilizzando il framerate a 60 FPS costanti.

### 7.2 Floor di Sicurezza Ambientale e Tone Mapping
- Al fine di sradicare il bug dello schermo nero nelle configurazioni a qualità alta o durante le ore notturne:
  - È sempre presente nella scena una `THREE.AmbientLight(0x0D131A, 0.15)` denominata `ambientFloor`.
  - La componente emisferica notturna del cielo è ancorata al blu abissale `#1B2A40` con intensità minima mai inferiore a $0.25$.
  - Il motore impiega lo standard fotografico:
    ```javascript
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    ```

### 7.3 Post-Processing e Modulo Raytracing / SSR Sperimentale
- **Configurazione Standard ad Alta Fedeltà:**
  - Hardware MSAA $4\times$ nel render buffer WebGL2.
  - Pass FXAA integrato per eliminare le scalettature sulle silhouette poligonali.
  - Selective Bloom con soglia calibrata a $0.85$ e intensità morbida $0.4$, attivo unicamente sui cristalli ciano, sulle gemme e sulle lamine d'oricalco.
- **Raytracing Simulato (Screen-Space Reflections & SSAO) — Default: Disattivato:**
  - Modulo dedicato `SSRPass.js` attivabile manualmente dalla scheda Grafica delle Impostazioni per schede video dedicate.
  - Genera riflessioni speculari in screen-space sul basamento di roccia levigata e sull'acqua del finale segreto, unitamente a ombre di contatto (Screen-Space Ambient Occlusion) sulle scanalature delle colonne e sulle creste delle dune.

---

## 8. Strumenti Diagnostici e Suite Profiler Live

Accessibile tramite toggle nelle Impostazioni (o tasto rapido `F3` / comando debug), il gioco include un profiler visivo non invasivo in sovrimpressione:
- **FPS Live & Frame Time (ms):** Monitoraggio in tempo reale con mini-grafico storico a barre degli ultimi 60 frame per intercettare istantaneamente eventuali micro-stuttering.
- **Metriche WebGL:**
  - Conteggio delle *Draw Calls* al secondo.
  - Numero esatto di triangoli e geometrie renderizzate.
  - Texture attive allocate in VRAM.
- **Memoria Heap JavaScript:** Monitoraggio dell'occupazione della memoria heap (`performance.memory`) per certificare l'assenza di memory leak durante cambi scena e reset prolungati.

---

## 9. Quality of Life, Salvataggi e Accessibilità

### 9.1 Multi-Buy nell'Officina
Il negozio implementa un selettore a quattro stati (`1x`, `10x`, `100x`, `MAX`):
- Il costo cumulativo per $m$ livelli viene calcolato in tempo reale tramite formula analitica a serie geometrica, consentendo acquisti istantanei senza generare cicli `for` intensivi.

### 9.2 Esportazione e Importazione Salvataggi
- Oltre al consueto autosave locale su `localStorage` (`dds_save_v1`), il menu Impostazioni include:
  - **"Esporta Salvataggio":** Codifica lo stato di gioco in una stringa compatta Base64 con checksum SHA-256 minimale, copiabile negli appunti.
  - **"Importa Salvataggio":** Consente di incollare la stringa per ripristinare la propria carriera su qualsiasi altro browser o dispositivo, previo controllo di validità dello schema.

### 9.3 Suite di Accessibilità e Comfort
- **Modalità a Movimento Ridotto (Reduced Motion):** Disattiva il camera shake, rimuove i lampi violenti dello schermo durante le tempeste e rallenta le orbite celesti.
- **Legenda Rapida Comandi (`HelpModal.js`):** Pannello illustrativo richiamabile dall'HUD con tutti i controlli desktop (Mouse, Clic, Tasti Q/E per rotazione, Rotellina per zoom) e mobile (Tocco singolo, Pinch & Drag a due dita).
- **Pausa Automatica su Cambio Scheda:** Monitoraggio dell'evento `document.visibilitychange` per congelare il loop visivo quando la scheda è in background, prevenendo cascate incontrollate di tick al rientro.

### 9.4 Crediti Legali e Riconoscimenti (`CreditsModal.js`)
Finestra modale accessibile dal Menu Principale con ringraziamenti e rispetto delle licenze open-source:
- Motore 3D: *Three.js* (Licenza MIT).
- Tipografia: *Cinzel Decorative*, *Cinzel*, *Syne* (SIL Open Font License).
- Modelli 3D e Campioni Sonori: *Kenney.nl*, *Quaternius*, *OpenGameArt* (CC0 / Public Domain).

---

## 10. Roadmap Finale di Completamento (Fasi 14 — 19)

- [x] **Fase 0 — 13:** Fondamenta, core loop, 4 finali, 4 biomi, ciclo giorno/notte, shader, post-processing e trucchi con lockout.
- [ ] **Fase 14 — Rigore i18n & Reattività Universale del Testo:** Revisione capillare di tutte le chiavi nel dizionario bilingue; eliminazione di stringhe hardcoded nel DOM; cambio lingua istantaneo senza refresh.
- [ ] **Fase 15 — Texturing PBR ad Alta Risoluzione & Asset Fidelity:** Texture procedurali a 2048px; mappe di normali e rugosità differenziata per oricalco, sabbia e pietra; raffinatezza estetica dei modelli 3D.
- [ ] **Fase 16 — Suite Diagnostica delle Risorse (Profiler Live):** Monitor overlay configurabile con FPS, frame time, draw calls, vertici e memoria heap; toggle dedicato nelle opzioni.
- [ ] **Fase 17 — Raytracing Sperimentale (SSR & SSAO):** Pass ottico opzionale a riflessioni speculari nello spazio dello schermo e ombre d'occlusione a contatto.
- [ ] **Fase 18 — Quality of Life & Game Juice:** Integrazione del selettore multi-buy ($1\times, 10\times, 100\times, \text{MAX}$), numeri fluttuanti al danno, camera shake, haptics e contratti di spedizione (direttive secondarie).
- [ ] **Fase 19 — Accessibilità, Crediti & Release Candidate:** Backup ed esportazione Base64, opzioni reduced motion, modale crediti ufficiali e bilanciamento matematico finale della progressione.