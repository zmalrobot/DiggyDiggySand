# PROJECT_HANDOFF: Diggy Diggy Sand

Documento di passaggio per una nuova chat. Contiene ciò che prima esisteva solo nella conversazione. Non duplica `AGENTS.md` né `Ideas/`.

## 0. Come usarlo
Ordine di lettura:
1. `AGENTS.md` (regole tassative, già caricato come regola di progetto).
2. Questo file.
3. `Ideas/` solo quando serve il dettaglio: `diggy-diggy-sand-project.md` (GDD), `brand_book_art_bible.md`, `upgrade_tree_specification.md`, `asset_manifest_download_guide.md`. In caso di conflitto prevalgono Art Bible e Upgrade Tree sul GDD.

Condotta con l'utente (Simone):
- Risposte in italiano, concise. Per decisioni di design: una domanda alla volta, con risposta consigliata (`/grill-me`).
- Per lavori complessi: prima un piano da approvare, poi esecuzione (`/plan`).
- Non dichiarare "fatto" senza verifica reale. Dire sempre cosa NON è stato verificato.

## 1. Stato reale
**Scritto ma MAI eseguito in un browser:** Milestone 0 (scaffolding) e Milestone 0.5 (boot, loading, menu, impostazioni).
Verificato solo che il live server serve i file con HTTP 200. Nessun controllo di console, nessuno screenshot, nessun controllo di sintassi (nella VM mancava `node`; `python` era solo lo stub del Microsoft Store). Il test con il subagente browser non è partito perché non aveva Chrome DevTools.

> **Primo passo obbligatorio per la nuova chat:** aprire `index.html` da un server statico (ad esempio Live Server su `http://127.0.0.1:5500/index.html`, oppure `npx serve .`), controllare la console e correggere gli errori, prima di iniziare la Milestone 1.

Flusso atteso: schermata di caricamento (barra a obelisco, lore a rotazione) → pulsante "Inizia Spedizione" (sblocca l'AudioContext) → dissolvenza → menu con sfondo 3D (cratere con obelisco, camera orbitale) → Impostazioni funzionanti a runtime.

### File esistenti
| File | Responsabilità |
|---|---|
| `index.html` | import map `three` → `vendor/three/`, Google Fonts, canvas `#game`, contenitori `#loading`, `#menu`, `#hud`, `#modal-root` |
| `css/style.css` | variabili Art Bible, `.panel` (vetro, `clip-path` 45°), `.btn`, slider, toggle, `.obelisk-bar`, loading, menu, modali, tab, toast |
| `js/main.js` | boot: crea i manager, lancia il caricamento, poi scena e menu. Espone `window.__dds` per il debug |
| `js/core/Events.js` | event bus |
| `js/core/SettingsManager.js` | schema, validazione, Observer (`subscribe(key\|'*', fn, {immediate})`), salvataggio immediato su `dds_settings_v1`, `exportJSON`/`importJSON`/`resetDefaults` |
| `js/core/AudioEngine.js` | AudioContext lazy (`unlock()` dopo un click), catena music/sfx → master, click/hover/confirm/warn procedurali, ambiente (vento + drone) |
| `js/core/AssetLoader.js` | `THREE.LoadingManager`, timeout 10s per asset e 30s globale, font, manifest, GLTF opzionali, `getModel(id)` con fallback |
| `js/core/Save.js` | chiave `dds_save_v1`, `version`, seed, `createNew()`, `load()`, `clear()`. Per ora solo metadati |
| `js/world/ProceduralFactory.js` | `PALETTE_3D`, mesh di fallback (`flatShading: true`), mappa ID del manifest → generatore |
| `js/world/SceneManager.js` | scena del menu: cielo, terreno non indicizzato colorato per faccia, rovine, particelle, cap FPS, render scale, ombre, shake |
| `js/ui/LoadingScreen.js` | progresso da `LoadingManager` (monotono, con easing), lore, pulsante di avvio |
| `js/ui/MainMenu.js` | Nuova Spedizione (con conferma se esiste un salvataggio), Continua, Impostazioni, Crediti |
| `js/ui/SettingsModal.js` | tab Audio/Grafica/Controlli/Dati; ogni controllo scrive subito sul manager |
| `js/ui/Modal.js` | `ModalManager` (`open`, `confirm`) e `toast` |
| `assets/manifest.json` | tutti i modelli con `available:false`: nessuna richiesta 404 |
| `vendor/three/` | Three.js r160 locale: `three.module.js` + addon GLTFLoader, OrbitControls, BufferGeometryUtils |

Cartelle vuote pronte: `js/systems/`, `js/endings/`, `tests/`, `assets/{models,textures,audio}/...`.

## 2. Decisioni di architettura (grill-me)
| Nodo | Decisione | Perché |
|---|---|---|
| Boot | Provare a caricare tutti i `.glb` prima del menu. Timeout 10s per asset e 30s globale, poi fallback | Il gioco non deve mai bloccarsi |
| Impostazioni | Registro unico con Observer; salvataggio sincrono; cap FPS come limitatore nel `rAF` che non tocca l'economia | Modifiche immediate e disaccoppiate dal motore |
| Heightmap | Chunk 8×8 con dirty flags; normali nello shader (`dFdx`/`dFdy`) o differenze finite, mai `computeVertexNormals` su tutta la mesh; raycast analitico sulla heightmap | Performance su griglia 256 |
| Persistenza | Altezze Uint8 su 128×128, RLE/delta + base64, scrittura in idle ogni 15s e su `visibilitychange`, upsample in ricarica | Meno di 30 KB, nessun blocco del main thread |
| Finale C | Tycoon-lite: 4-5 contratti come maschere di profondità, riuso di Economy/Upgrades/Workers, reputazione come un solo contatore, circa 10 minuti poi modalità libera | Evitare un secondo motore di gioco |
| Three.js | r160 in copia locale, import map | Scelta dell'utente: lavoro offline |

Aperto: le maschere dei contratti del Finale C non devono usare la griglia salvata a 128 (troppo morbida). Servono uno stato separato o una risoluzione piena.

## 3. Deviazioni e scelte non ovvie
- **Palette:** il prompt dell'utente indicava `#060b11`, `#00f2ff` e `#e5a93b`. Ho tenuto la palette dell'Art Bible (`#031826`, `#0FE3C1`, `#F5BA23`), perché `AGENTS.md` dà priorità all'Art Bible. `#060b11` è usato solo come fondo del loading (`--void`).
- **`flatShading`:** il GDD mostra `false`, l'Art Bible impone `true`. Seguire `true`.
- **`AGENTS.md` §6:** modificato per rispecchiare chunk, normali nello shader, Three.js locale e timeout.
- **Niente 404 in console:** `manifest.json` elenca i modelli con `available:false`. Il loader prova a caricare solo quelli con `true`. Dopo aver scaricato un `.glb`, mettere `available:true`.
- **Terreno del menu:** `PlaneGeometry` poi `toNonIndexed()` con colore per faccia. Il terreno di gioco (M1) dovrà seguire la regola dei chunk.
- **Controlli:** `invertY` oggi inverte solo l'oscillazione verticale della camera del menu. Avrà effetto reale quando esisteranno i controlli di gioco.
- **Salvataggio:** `Save.createNew()` conserva `endingsSeen` dal salvataggio precedente.
- **Hook di debug:** `window.__dds = { settings, audio, save, scene, assets, menu }`.

## 4. Rischi e punti da controllare per primi
Se la console mostra errori, sospettare in quest'ordine:
1. Percorsi dell'import map (`vendor/three/three.module.js`) e import degli addon (`from 'three'`).
2. `SceneManager`: ordine di inizializzazione in `_bindSettings` (usa `dust` e `sparks`), `applyShadows` che riattraversa i materiali.
3. `LoadingScreen`: `manager.onProgress` viene assegnato dopo l'avvio di `loadAll()`.
4. `AudioEngine`: nessun suono prima del click su "Inizia Spedizione" è corretto.
5. `#modal-root:empty` nascosto via CSS: verificare che la modale compaia e che si chiuda con Esc.
6. Slider a 0.5× di render scale: controllare che il canvas resti a schermo intero.

Verifiche manuali da fare: valori persistiti dopo il ricaricamento; `localStorage.setItem('dds_settings_v1','{rotto')` seguito da ricarica ripristina i default senza errori; "Continua" attivo solo con un salvataggio valido; conferma di sovrascrittura e di eliminazione salvataggio.

## 5. Roadmap (dal piano approvato)
- [x] **M0** Foundation (verificata in headless Chrome)
- [x] **M0.5** Boot, Loading, Settings, Menu (verificata in headless Chrome)
- [x] **M1** Scavo e audio: `js/world/Terrain.js` (heightmap, flatShading, colori per altezza, raycast analitico), `js/systems/Digging.js` (click e hold, tick cadenzati, audio `playDigSound`), `js/world/Particles.js` (burst a fontana con dissolvenza), `js/core/Game.js` (camera orbitale top-down con clamp). Verificata con 9 test unitari e browser QA.
- [x] **M2** Economia, Negozio Upgrade, Flotta Lavoratori 3D e Persistenza:
  - `js/systems/Upgrades.js`: catalogo rami Manuale e Flotta Autonoma, costi esponenziali, calcolo SPS.
  - `js/systems/Economy.js`: gestione SPS disaccoppiata dal rendering e calcolo progresso offline (50% efficienza, cap 2h).
  - `js/ui/Shop.js`: cassetto scorrevole Atlantean-Kemet, schede a tab, bagliore dorato su bottoni accessibili.
  - `js/systems/Workers.js`: modelli 3D procedurali low-poly (Scarafaggio, Escavatore, Draga), movimento sul terreno e cicli di scavo autonomo.
  - `js/core/Save.js` & `Game.js`: autosave ogni 10s e su `beforeunload`, popup modale di rientro offline.
  - Verificata con 15 test unitari e 7/7 step browser QA (Puppeteer/Headless Chrome).
- [x] **M3** Città sepolta procedurale, stratificazione e sistema di indizi:
  - `js/world/Terrain.js`: stratificazione cromatica esatta a 3 strati (Layer 1 dorato `#e0c27a`, Layer 2 aranciato `#b88a44`, Layer 3 roccioso scuro `#6e563b` con venature teal), particelle conformi allo strato scavato.
  - `js/world/City.js`: generazione procedurale low-poly (santuario centrale con obelisco dorato/teal fino a Y=8.8, viali monumentali colonnati sui 4 punti cardinali, quartieri a terrazze e scalinate nei 4 quadranti, varianti tematiche ending). Interamente collocata tra Y=0 e Y=8.8 sotto la duna iniziale, emerge naturalmente con lo scavo.
  - `js/systems/Foreshadowing.js`: monitoraggio soglia 60% completion e seed ending (Curse, Treasure, Business), mutazione atmosferica (luce e nebbia), particelle contestuali, audio sussurri/chime, toast banner narrativo e letture criptiche Georadar.
  - `js/ui/Hud.js`: widget del Georadar con oscilloscopio a scansione rotante, ping audio e readout di profondità reattivo alla quota scavata.
  - `js/systems/Upgrades.js`: upgrade "Georadar di Profondità" integrato nell'Officina.
  - Verificata con 20 test unitari complessivi e 7/7 step browser QA (Headless Chrome).
- [x] **M4** I Tre Finali Dinamici (Curse, Treasure, Business), Gestione Seed e Galleria Epiloghi:
  - `js/endings/EndingManager.js`: interfaccia unificata per le classi dei finali (`prepare`, `onProgress`, `trigger`, `update`, `dispose`), determinazione ending tramite seed `mulberry32` e override URL `?ending=curse|treasure|business`, trigger automatico a completamento scavo >= 98%.
  - `js/endings/CurseEnding.js`: rottura del sigillo centrale, mutazione atmosferica violenta (cielo rosso sangue `#8B0000`, nebbia porpora `#2E0854`), colonna vorticosa di particelle oscure / locuste, rombo sismico procedurale `playCurseRumble()`, epilogo narrativo (*"Forse avresti dovuto lasciare la sabbia dov'era..."*).
  - `js/endings/TreasureEnding.js`: rivelazione della cripta d'oro sommersa, arpeggio metallico trionfale `playTreasureShower()`, pioggia dinamica di monete d'oro e gemme ciano con rimbalzo a terra, mini-interazione con gemme cliccabili che conferiscono ricchezza istantanea ed emettono tintinnii brillanti `playCoinGlitter()`, epilogo celebrativo (*"Sei oscenamente ricco..."*).
  - `js/endings/BusinessEnding.js`: anticlimax comico con arresto dei cori mistici e fischio solitario del vento `playWindWhistle()`, luce neutrale da cantiere, secchiello di plastica arancione e barriere di sicurezza, calcolo della valutazione d'impresa della flotta di macchinari, certificato di costituzione d'impresa ed opzione per proseguire nella "Modalità Sandbox Libera".
  - `js/ui/Overlay.js`: modale a schermo intero stile Atlantean-Kemetism con angoli a 45°, titolo display, badge tematico (`☠️`, `👑`, `🏗️`), testo narrativo, griglia statistiche (tempo spedizione, sabbia estratta, colpi di pala, percentuale completamento, valutazione), pulsanti "Nuova Spedizione", "Torna al Menu" e "Continua in Sandbox".
  - `js/ui/GalleryModal.js`: modale accessibile dal Menu principale tramite il pulsante "Finali Scoperti (X/3)", con barra di avanzamento e schede per ciascuno dei tre finali (stato sbloccato con descrizione e badge, oppure sigillato con lucchetto `🔒`).
  - Persistenza `endingsSeen` indipendente e tracking statistico di click e tempo trascorso in `Save.js` e `State.js`.
  - Verificata con 28 test unitari complessivi e browser QA.
- [x] **M5** Polish Generale, Supporto Mobile/Touch, Onboarding Minimale e Ottimizzazione Performance:
  - Adattamento Mobile & Controlli Touch: `js/systems/Digging.js` con distinzione tocco singolo (scavo continuo) e pinch/multi-touch (rotazione e zoom camera OrbitControls senza colpi accidentali), blocco pull-to-refresh e gestures indesiderate (`touch-action: none; overscroll-behavior: none; user-select: none;`).
  - Layout Responsive & Safe Touch: HUD adattivo su schermi verticali (portrait, smartphone), pulsanti con target touch >= 44px, cassetto Officina `#shop` espanso a 100vw su mobile.
  - Onboarding Contestuale (`js/ui/Tutorial.js`): guida <30s con anello pulsante al centro per il primo scavo, tooltip sulla valuta sabbia, notifica luminosa all'Officina a 10 Sand, persistenza `tutorialDone` in `State.js` e `Save.js`.
  - Object Pool Particellare e Throttling (`js/world/Particles.js`): budget capped a max 300 particelle attive, struct-of-arrays senza allocazioni Vector3 a runtime, throttling automatico proporzionale alla flotta di lavoratori per garantire 60fps costanti.
  - Tappeto Sonoro e Audio Dinamico (`js/core/AudioEngine.js`): ambiente vento + drone con modulazione di frequenza in base alla quota scavata (`setDepth(depthY)`), sospensione automatica dell'AudioContext quando la scheda non è visibile (`visibilitychange`).
  - Menu di Pausa in-game dedicato (`js/ui/PauseMenu.js`): pulsante "⚙️ Pausa" nell'HUD, ripresa spedizione, impostazioni rapide (volume master, mute, qualità grafica), salva ed esci sincronizzato.
  - Verificata con 34 test unitari complessivi e browser QA headless Chrome (5/5 PASSED).
- [x] **M6** Meta-Progressione (New Game+), Eventi Spontanei nel Deserto e Finale Segreto:
  - Meta-Progressione & Tavolette Antiche (`js/systems/Prestige.js` & `js/core/Save.js`):
    - Formula ricompensa fine run: `tabletsEarned = Math.floor(Math.sqrt(totalSand / 100000)) + 5`.
    - Persistenza tavolette (`state.tablets`, `save.getTablets()`, `dds_tablets_v1`) e perk permanenti attraverso le spedizioni.
    - Santuario dei Predecessori (`js/ui/PrestigeModal.js`): accessibile dal Main Menu con indicatore `(τ X)` e dal PauseMenu in-game:
      - *Eco della Pala (`shovelEcho`):* +15% potenza scavo base permanente per livello.
      - *Progetto dell'Escavatore (`excavatorBlueprint`):* inizia le future spedizioni con 1 Automa Scarabeo già attivo per livello.
      - *Magnetismo delle Tavolette (`tabletMagnetism`):* sconto progressivo del 5% sui costi di sabbia in Officina per livello (max 25%).
  - Eventi Dinamici Spontanei (`js/systems/WorldEvents.js` & `js/ui/EventBanner.js`):
    - Scheduler temporizzato con spawn ogni 3-5 minuti (e trigger di debug `triggerEvent('sandstorm'|'merchant')`).
    - *Tempesta di Sabbia:* durata 30s, audio vento sferzante (`playStormSound()`), nebbia dorata densa, bonus +50% sabbia per colpo/SPS (`sandMultiplier = 1.5`), banner di notifica in alto e badge nell'HUD (`.hud-boost-tag`).
    - *Mercante Nomade:* durata 60s, accampamento 3D low-poly sul bordo della duna (tenda, cassa oricalco, tappeto), banner in alto con azione "Commercia" che apre la modale di scambio (es. *Iper-Scavo Nomade* +100% sabbia per 45s a fronte di 150 sabbia).
  - Finale Segreto — L'Ascensione di Atlantide (`js/endings/SecretEnding.js`):
    - Condizione di sblocco: trigger automatico a completamento 100% se tutti i 3 finali base sono stati scoperti (`endingsSeen.length >= 3`) oppure via override URL `?ending=secret`.
    - Climax visivo e sonoro: risveglio del cuore d'oricalco, 55 geyser di luce/acqua ciano emissiva (`0x0FE3C1`), levitazione poetica delle rovine cittadine, cielo aurorale e fanfara trionfale `playAscensionChime()`.
    - Epilogo e Galleria: overlay dedicato con tema ciano/oricalco, testo narrativo trionfale, badge `🔱` e assegnazione del 4° trofeo nella Galleria dei Finali (`(X/4)`).
  - Verificata con 41 test unitari complessivi (7 specifici M6, tutti passati) e suite end-to-end Puppeteer/Headless Chrome (6/6 PASSED, 0 errori console, screenshot salvati in `scratch/`).
- [x] **M7** Debug Console Suite, Memory Audit (Three.js WebGL Cleanup) e Ottimizzazione Produzione:
  - Debug Suite & Cheat Integrata (`js/core/DebugTools.js`):
    - Esposizione globale sicura `window.DDS_DEBUG` con metodi: `addSand`, `setCompletion`, `forceEnding`, `triggerEvent`, `unlockAllUpgrades`, `addTablets`, `unlockAllEndings`, `resetAll`, `getMemoryReport`, `togglePanel`.
    - Mini-pannello UI a scomparsa attivabile con scorciatoia `F2` o `~` (Backquote) con monitoraggio in tempo reale di: FPS, Draw Calls, Triangoli, Geometrie caricate, Texture WebGL, Particelle attive e JS Heap Memoria.
    - Pulsanti rapidi di azione per test immediati: valuta, completamento 99%, eventi spontanei, finali e pulizia VRAM.
  - Memory Audit & Ciclo di Vita Rigoroso:
    - Rilascio sistematico delle risorse GPU al cambio scena o restart (`geometry.dispose()`, `material.dispose()`).
    - Smontaggio dei lavoratori rimossi durante i downgrade/sync in `Workers.js` e delle strutture perimetrali in `City.js`.
    - Invocazione di `renderer.renderLists.dispose()` su `Game._disposeWorld()` e `Game._leave()` per azzerare i riferimenti nella VRAM WebGL.
  - WebGL ErrorBoundary & Fallback Contesto:
    - Gestione degli eventi canvas `webglcontextlost` (con `event.preventDefault()`) e `webglcontextrestored` in `SceneManager.js`.
    - Schermata di errore / fallback visiva stilizzata in vetro e ambra (`.webgl-fallback-overlay`) per prevenire schermate nere in caso di GPU crash o WebGL disabilitato.
  - Ottimizzazione Bundle & Percorsi Relativi:
    - Zero `console.log` residui nel ciclo di render a 60 FPS.
    - Tutti i percorsi in `index.html` e `style.css` sono relativi per garantire il deployment istantaneo su root o sottocartelle (es. GitHub Pages).
  - Verificata con 48 test unitari complessivi (7 specifici M7) e suite end-to-end Puppeteer/Headless Chrome (5/5 PASSED, 0 errori console, screenshot in `scratch/04_debug_panel_open.png`).
- [x] **M8** Web App Manifest (PWA/Mobile Standalone), Configurazione Deployment Statico e Documentazione di Rilascio:
  - Manifest Web App & Supporto PWA (`manifest.json`):
    - Configurazione `standalone` (rimozione barre URL browser per esperienza fullscreen nativa), orientamento `any`, `theme_color: #0b1522`, `background_color: #060b11`.
    - Icona vettoriale procedurale SVG (`assets/icons/icon.svg`) con pala dorata sovranista, cristallo ciano d'oricalco emissivo e raccordi Atlantean.
    - Metadati `apple-mobile-web-app-capable`, `apple-touch-icon`, `theme-color` e meta tag Open Graph (`og:title`, `og:description`, `og:image`) integrati nell'header di `index.html`.
  - Automazione Deployment GitHub Pages:
    - Workflow GitHub Actions [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) pronto per la pubblicazione automatica sui branch `main` e `master`.
    - Tutti i percorsi degli asset, script e fogli di stile rigorosamente relativi (`./`) per compatibilità assoluta con domini personalizzati o sottocartelle (es. `username.github.io/diggy-diggy-sand/`).
  - Documentazione Completa & Licenza:
    - [`README.md`](README.md) professionale e completo con badge, lore, pilastri di design, tabella controlli Desktop vs Mobile, tabella parametri debug e cheat da URL, istruzioni di avvio locale rapido e crediti.
    - File [`LICENSE`](LICENSE) (Licenza MIT).
    - [`.gitignore`](.gitignore) arricchito per escludere file temporanei OS, IDE, log e scratchpad.
  - Verificata con 53 test unitari complessivi (5 specifici M8) e suite end-to-end Puppeteer/Headless Chrome (5/5 PASSED, 0 errori 404, screenshot in `scratch/05_pwa_standalone_ready.png`).
- [x] **M9** Asset Loader Pipeline, Sostituzione Modelli 3D GLTF e Integrazione Audio Campionato:
  - Asset Loader Pipeline & Fallback Robusto (`js/core/AssetLoader.js`):
    - Registro centralizzato `MODEL_REGISTRY` con fallback procedurali per:
      - Attrezzi: `tools/shovel_basic.glb`, `tools/shovel_atlantean.glb`
      - Flotta macchinari: `machinery/worker_scarab.glb`, `machinery/excavator_steam.glb`, `machinery/dredge.glb`
      - Rovine sepolte: `ruins/column.glb`, `ruins/temple_center.glb`, `ruins/chest.glb`
    - Pattern fallback `loadModel(id, fallbackGenerator)` e `getModel(id, fallbackGenerator)`: caricamento asincrono con `THREE.GLTFLoader`, clonazione mesh con salvaguardia `flatShading: true`, `castShadow = true`, `receiveShadow = true` e fallback istantaneo a `ProceduralFactory.js` o generatori locali se assente o corrotto.
    - Aggiornamento `assets/manifest.json` con flag `available: true` per i modelli GLB operativi.
  - Sostituzione Lavoratori e Città Sepolta (`js/systems/Workers.js` & `js/world/City.js`):
    - `Workers.js`: istanziazione di Scarafaggio, Escavatore e Draga dai modelli GLTF caricati in `assets/models/machinery/` con ancoraggio corretto alla quota Y del terreno e supporto animazione procedurale.
    - `City.js`: impiego dei modelli 3D per le colonne monumentali lungo i viali, il santuario centrale e il forziere aureo con fallback garantito.
  - Web Audio Pool & Audio Campionato (`js/core/AudioEngine.js`):
    - Buffer pool `buffers = new Map()` per campioni audio reali pre-caricati: `sfx_dig_sand.ogg`, `sfx_coin_pickup.ogg`, `sfx_earthquake.ogg`, `ambient_desert_wind.ogg`.
    - Metodo `loadSample(id, url)` con gestione resiliente degli errori e caricamento all'evento `unlock()` (post-gesto utente).
    - `playDigSound(intensity)`: riproduzione campione scavo con randomizzazione pitch `±15%` e modulazione di volume, oppure fallback sul sintetizzatore procedurale a rumore bianco e tonfo sordo.
    - `playPurchaseSound()`: riproduzione monete metalliche campionate o fallback su arpeggio sinusoidale.
    - `playCurseRumble()`: riproduzione boato tellurico o oscillatore low-frequency.
    - `startAmbient()`: routing del loop vento del deserto campionato attraverso la catena di filtri dinamici a modulazione di profondità (`setDepth`).
  - Verificata con 61 test unitari complessivi (8 specifici M9, 100% superati) e verifica end-to-end in browser.

Piano dettagliato con codice e verifiche: vedi la sezione "Roadmap" sopra e le formule in `Ideas/upgrade_tree_specification.md`.

## 6. Convenzioni
- ES modules, una classe per file, nessun monolite. Nessun build step.
- Tutti i `MeshStandardMaterial` con `flatShading: true`. Nessuna suddivisione eccessiva.
- Font solo Cinzel Decorative, Cinzel e Syne, tramite `--font-display`, `--font-heading`, `--font-data`, `--font-body`.
- Ogni asset esterno ha un fallback e un try/catch. L'AudioContext nasce solo dopo un gesto utente.
- L'economia usa `performance.now()`/`Date.now()` e `dt` limitato, mai il numero di frame.
- Le impostazioni si applicano e si salvano subito. Il salvataggio di gioco è separato (`dds_save_v1`) con `version`.

## 7. Ripartenza dopo la migrazione
1. Copiare l'intera cartella, compresi `vendor/three/` e `Ideas/`.
2. Avviare un server statico dalla root (Live Server, `npx serve .` oppure `python -m http.server 8080`).
3. Aprire `index.html`, controllare la console, completare le verifiche della sezione 4.
4. Aggiornare questo file con ciò che è stato davvero verificato, poi iniziare la M1.

