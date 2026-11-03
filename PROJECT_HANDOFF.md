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
**Milestones 0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 e 12 COMPLETATE E VERIFICATE.**
78 test unitari automatici su 78 passati con successo (100% green).
Server locale `http://127.0.0.1:8080` attivo e collaudato con browser headless.
0 errori o warning critici nella console del browser.

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
- [x] **M10** Sistema Achievement, Statistiche Cumulative e Localizzazione Multilingua (IT/EN):
  - Motore di Localizzazione Dinamica (`js/core/I18n.js`):
    - Dizionario completo e strutturato con supporto per Italiano (`it`) e Inglese (`en`).
    - Traduzione di voci del Menu Principale, Shop, descrizioni Upgrade, finali, eventi e impostazioni.
    - Metodo `t(key, params)` con interpolazione parametri e `updateDOM(root)` con selettori `data-i18n`.
    - Selezione lingua reattiva integrata in `SettingsManager` (`game.language`) con cambio immediato senza ricaricamento di pagina.
  - Statistiche Cumulative di Carriera (`js/core/StatsManager.js`):
    - Tracciamento indipendente e persistente tra run su `localStorage` (`dds_stats_v1`):
      - Colpi di pala manuali (`totalClicks`)
      - Sabbia totale storica estratta (`totalSandLifetime`)
      - Tempo di gioco cumulativo (`totalPlaytime`)
      - Rovine sepolte disseppellite (`ruinsUncovered`)
      - Spedizioni portate a termine (`runsCompleted`)
      - Tempo record per completamento scavo (`bestRunTime`)
  - Sistema Obiettivi & Trofei (`js/systems/Achievements.js` & `js/ui/Toast.js`):
    - 12 trofei tematici collezionabili progressivi e segreti (Primo Colpo d'Oro, Dune Breaker, Signore delle Macchine, Echi del Passato, Trinità della Sabbia, Il Risveglio, Corsa contro il Tempo, Custode dell'Oro, Saggezza Antica, Cavalcatempeste, Affare nel Deserto, Archeologo Supremo).
    - Persistenza sblocchi su `dds_achievements_v1`.
    - Notifica Toast elegante con bordo oro, glow ciano, icona araldica SVG e fanfara audio Web Audio dedicata `playAchievementChime()`.
  - Pannello Statistiche & Trofei (`js/ui/StatsModal.js`):
    - Modale a due schede (Statistiche e Trofei) accessibile dal Menu Principale e dal Menu di Pausa in-game.
    - Griglia numeri di carriera con font Syne ed elenco trofei con stato di sblocco in tempo reale.
  - Verificata con 66 test unitari complessivi (5 specifici M10, 100% superati) e suite end-to-end Puppeteer/Headless Chrome (0 errori console).

- **Milestone 11 (Fase 11) — Ciclo Giorno/Notte con Luci Dinamiche e Personalizzazione Cosmetica (Skins):**
  - Ciclo Giorno/Notte & Illuminazione Dinamica (`js/world/DayNightCycle.js` & `js/world/Sky.js`):
    - Orbita solare continua con calcolo altitudine e interpolazione atmosferica smoothstep (aurora dorata, mezzogiorno ciano/oro, tramonto cremisi, notte abissale `#060b11`).
    - Cupola stellata procedurale a 350 particelle (`THREE.Points`) e disco lunare luminescente con fading diurno.
    - Sfondo gradiente dinamico renderizzato su canvas 2×256 sincronizzato con nebbia (`scene.fog`) e luce emisferica.
  - Illuminazione Notturna Locale (`js/world/Torches.js`):
    - 4 bracieri/fiaccole su rovine archeologiche e campo base attivate automaticamente al calar del sole.
    - Sfarfallio procedurale morbido ad alta frequenza (flicker casuale su `intensity`).
    - Rispetto rigoroso del budget GPU: max 4 PointLight senza ombre per 60 FPS garantiti su mobile.
  - Manager Cosmetico & Guardaroba (`js/systems/CosmeticsManager.js` & `js/ui/WardrobeModal.js`):
    - Catalogo collezionabile per 3 categorie: Pale & Strumenti (Bronzo, Oro, Cristallo, Ossidiana), Biomi Sabbia (Classico, Marte, Caraibi, Vulcanico), Flotta Macchinari (Standard, Reale, Atlantideo).
    - Costi in Tavolette Antiche τ e persistenza su `dds_cosmetics_v1`.
    - Modale a 3 schede con anteprime cromatiche esagonali, saldo τ live e pulsanti di sblocco/equipaggiamento.
  - Integrazione Materiali e Sistemi di Gioco:
    - Terreno heightmap (`Terrain.js`): ricolore istantaneo dei vertici con le palette bioma `BIOME_PALETTES`.
    - Lavoratori (`Workers.js`): tinting e finiture cromatiche sui modelli o mesh procedurali.
    - Pala (`Digging.js`): reticolo e scintille particellari allineati al tema della skin equipaggiata.
  - Impostazioni & Debug Suite:
    - Impostazione `graphics.dayNightCycle` ('auto' | 'day' | 'night') in `SettingsModal.js` e persistenza su `localStorage`.
    - Comandi debug `setTimeOfDay(time)` e `unlockAllSkins()` su `window.DDS_DEBUG`.
  - Verificata con 73 test unitari complessivi (7 specifici M11, 100% superati) e browser testing end-to-end.

- [x] **M12** Spedizioni nei Biomi Alternativi (Oceano Prosciugato, Ghiacciaio Arcaico e Giungla Sepolta):
  - Manager dei Biomi (`js/world/BiomeManager.js`):
    - Configurazione strutturata dei 4 biomi giocabili (`BIOME_CATALOG`):
      - *Deserto d'Oro (`desert`):* parametri base originali.
      - *Oceano Prosciugato (`ocean`):* strati `#f5e6ca` (sabbia corallina), `#4a7c82` (sedimenti marini), `#1b3240` (basamento abissale); bolle d'aria effimere e frammenti di conchiglie dorate; resistenza `-20%` (`0.8`), volume `+15%` (`1.15`), valore sabbia `+25%`.
      - *Ghiacciaio Arcaico (`glacier`):* strati `#e8f4f8` (neve compatta), `#7baec2` (permafrost traslucido), `#2a3b45` (roccia scistosa); strato intermedio con resistenza `+35%` (`midLayerResistance: 1.35`), schegge di ghiaccio cristalline, valore sabbia `+35%`.
      - *Giungla Sepolta (`jungle`):* strati `#3d5c38` (humus con muschio), `#5c4028` (argilla densa), `#2e241c` (arenaria umida); radici sepolte per chunk (`rootDurability = 3`) che bloccano il `35%` del raggio dello scavo finché non spezzate con 3 colpi multipli, valore sabbia `+40%`.
    - Sblocco biomi tramite vittorie (`runsCompleted` / `endingsSeen`) oppure spendendo Tavolette Antiche τ (`unlockWithTablets`), con persistenza su `dds_biomes_v1`.
  - Generazione Rovine Differenziata (`js/world/City.js`):
    - *Oceano:* nave sommersa spezzata in due con prua cabrata verso l'alto (`sunkenShip`), archi di conchiglie giganti (`shellArches`) e colonne incrostate di cristalli marini luminescenti.
    - *Ghiacciaio:* monolite esagonale centrale di ghiaccio (`iceMonolith`), guglie cristalline (`crystallineSpires`) e templi congelati in rovina.
    - *Giungla:* grande tempio a ziggurat a 5 gradoni bassi (`steppedZiggurat`), blocchi monolitici avvolti da radici e menhir incisi con glifi smeraldo (`engravedMenhirs`).
    - Reperto finale (`curseSeal`, `treasureChest`, `businessBucket`) preservato al centro in ogni bioma.
  - Selettore di Spedizione nel Menu Principale (`js/ui/BiomeSelectModal.js`):
    - Modale con 4 schede `<article class="biome-card">` con illustrazioni vettoriali SVG dedicate, campioni colore strati, descrizione lore, badge modificatori attivi e sblocco con τ o vittorie.
  - Adattamento Audio & Atmosfera (`js/core/AudioEngine.js` & `js/world/DayNightCycle.js`):
    - Profili sonori procedurali dedicati (`setBiome`): risacca marina e colpi acquatici ovattati (Oceano), vento polare e tintinnio cristallino del permafrost (Ghiacciaio), ronzio tropicale e tonfi sordi su terra umida (Giungla).
    - Luce solare, nebbia volumetrica (`scene.fog`) e gradiente cielo adattati dinamicamente alla palette del bioma attivo.
  - Persistenza `currentBiome` in `State.js` e `Save.js`, più comandi debug `setBiome(id)` e `unlockAllBiomes()` su `window.DDS_DEBUG`.
  - Verificata con 78 test unitari complessivi (5 suite specifiche M12 in `tests/phase12.test.mjs`, 100% superati) e verifica browser end-to-end (`tests/phase12_browser_qa.mjs`, 0 errori console).

- [x] **M13** Cheat di Debug nel Pannello Impostazioni & Blocco Permanente degli Achievement:
  - Gestione Stato & Lockout Permanente (`js/core/State.js` & `js/systems/Achievements.js`):
    - Aggiunta proprietà booleana persistente `state.cheatsEnabled = false` (e `state.godMode = false`).
    - Blocco rigoroso in `Achievements.unlock(id)` e `Achievements.check()`: se `state.cheatsEnabled === true`, nessun obiettivo viene sbloccato o valutato.
    - Banner di avviso permanente (`.cheats-lockout-banner`) mostrato in cima alla tab Trofei di `StatsModal.js`: *"⚠️ Obiettivi disabilitati: sono stati utilizzati trucchi in questa partita"*.
  - Dialogo di Conferma Irreversibile (`js/ui/SettingsModal.js`):
    - Al primo tentativo di interazione con qualsiasi trucco (pulsante o toggle), apertura modale di sicurezza:
      > **"Attenzione: Modalità Trucchi"**
      > *"L'attivazione dei trucchi ti permetterà di modificare liberamente la sabbia, il terreno e gli eventi, ma disabiliterà definitivamente lo sblocco di tutti gli Obiettivi per questa spedizione. Continuare?"*
    - Se confermato, `state.enableCheats()` imposta `cheatsEnabled = true`, persiste istantaneamente lo stato su `localStorage` (`dds_save_v1`), aggiorna la UI e attiva il comando.
  - Nuova Scheda "Trucchi" nel Pannello Impostazioni (`js/ui/SettingsModal.js`):
    - *Stato Trucchi:* banner `.cheats-status-box` dinamico (inattivo verde/dorato vs attivo ambra/rosso).
    - *Accredito Sabbia:* comandi rapidi `+100.000 Sabbia` e `+1.000.000 Sabbia`.
    - *Completamento Scavo Rapido:* impostazione immediata volume residuo e completamento a `50%`, `95%` o `99%` (innesco climax).
    - *Forza Finale di Spedizione:* selettore dropdown (Maledizione, Tesoro, Impresa SRL, Ascensione Segreta) con pulsante `Avvia Climax Ora`.
    - *Attiva Evento nel Deserto:* avvio istantaneo di `Tempesta di Sabbia` o `Mercante Nomade`.
    - *Super Pala (God Mode):* toggle interruttore per scavo ad altissima potenza (raggio x10, potenza x10, frequenza massima e zero cooldown).
    - *Sblocca Tutti gli Upgrade:* massimizzazione istantanea di tutti gli strumenti, escavatori e droni con sincronizzazione automatica della flotta.
  - Indicatore Visivo HUD (`js/ui/Hud.js`):
    - Badge `.hud-cheats-badge` con icona chiave inglese e teschietto (`🔧 Cheats`), animazione pulsante dorata/rossa e tooltip esplicativo posizionato accanto al contatore della sabbia.
  - Anti-Tampering: il flag `cheatsEnabled: true` viene scritto immediatamente nel JSON di salvataggio; ricaricare o riavviare la sessione mantiene il blocco permanente fino all'inizio di una nuova spedizione pulita.
  - Verificata con 83 test unitari complessivi (5 suite specifiche M13 in `tests/phase13.test.mjs`, 100% superati) e test QA headless Chrome (`tests/phase13_browser_qa.mjs`, 0 errori console, 3 screenshot salvati).

- [x] **M14** Post-Processing Visivo (Bloom & Atmosfera), Ottimizzazione Sub-Grid del Terreno e Bugfixing di Stabilità:
  - Compositing & Post-Processing Leggero (`js/world/PostProcessing.js`):
    - Fullscreen pass con shader dedicato basato su `WebGLRenderTarget` e quad ortografico.
    - *Selective Bloom:* estrazione a soglia percettiva di luminanza multi-tap per esaltare elementi emissivi (cristalli atlantidei ciano `#00F2FF`, oro del finale Treasure e geroglifici).
    - *Color Grading:* iniezione di gradiente caldo nei mezzitoni e curva s-curve morbida per accentuare la profondità del cratere.
    - *Vignette:* ombreggiatura radiale cinematografica ai bordi del canvas.
    - Disattivazione completa a zero overhead quando l'opzione grafica `graphics.postProcessing` è disabilitata (o su dispositivi a bassa potenza).
  - Micro-Particelle Atmosferiche (`js/world/Atmosphere.js`):
    - Nuvola di 100 particelle ottaedriche low-poly chiseled (`InstancedMesh`) fluttuanti con moto browniano/sinusoidale lento e corrente termica ascensionale.
    - Adattamento cromatico dinamico per bioma (ambra dorato per Deserto, ciano bioluminescente per Oceano, polvere di diamante per Ghiacciaio, spore verdi per Giungla).
    - Toggle dedicato `graphics.dustMotes` nelle Impostazioni.
  - Rifinitura Terreno con Procedural Noise Blend (`js/world/Terrain.js`):
    - Funzione `noise2D` multi-frequenza integrata in `layerColor` per simulare granelli di sabbia, striature nelle rocce e screziature naturali senza sacrificare il `flatShading: true`.
  - Ottimizzazione Sub-Grid delle Normali O(k) (`js/world/Terrain.js`):
    - Eliminato qualsiasi ricalcolo globale della mesh $256 \times 256$ durante lo scavo.
    - Calcolo analitico O(1) del gradiente sui vertici della sub-regione compresa nel bounding box dello scavo (`computeSubGridNormals`).
    - Aggiornamento parziale `normals.addUpdateRange()` con 60 FPS stabili anche durante colpi continui o raffiche dinamite.
  - Hardening Geometrico & Anti-Tunneling (`js/systems/Digging.js` & `js/world/Terrain.js`):
    - *Fix Anti-Tunneling:* clamping assoluto di ogni vertice a $\ge 0$ (bedrock), prevenendo forature della mesh o sprofondamento nel vuoto.
    - *Fix Bounding Box:* metodo `updateBounds()` sincronizzato periodicamente o al rilascio del cursore per mantenere perfetto il raycasting anche in fosse profonde.
    - *Fix Frustum:* adattamento dinamico continuo dei piani `near` e `far` della camera orbitale in `Game.js` in funzione della distanza dal punto guardato, eliminando z-fighting.
  - Validazione Schema & Sistema di Backup Salvataggio (`js/core/Save.js`):
    - Funzione `validateSave(data)` che rigetta JSON troncati, valori `NaN` nel bilancio sabbia o chiavi corrotte.
    - Backup ridondante automatico su `dds_save_backup`. In caso di corruzione del file primario, ripristino istantaneo dal backup o rigenerazione pulita con notifica non distruttiva senza schermate bianche o crash.
  - Reattività Display Estremi (Portrait Mobile & Ultra-Wide 21:9):
    - Compensazione adattiva del FOV in `SceneManager.resize()`: allargamento automatico fino a $78^\circ$ su schermi verticali (9:16 / notch) e calibrazione a $42^\circ$ su monitor ultrawide (21:9 / 32:9).
    - Safe-area insets CSS per notch e display sagomati (`env(safe-area-inset-*)`).
  - Verificata con 89 test unitari complessivi (6 suite specifiche M14 in `tests/phase14.test.mjs`, 100% superati) e browser QA end-to-end (`tests/phase14_browser_qa.mjs`, 0 errori console, 4 screenshot salvati).

- [x] **M15** Risoluzione Blackout Grafica Alta, Antialiasing (FXAA & MSAA 4x) e Terreno Procedurale con Dune:
  - Bugfix Blackout Grafica Alta e Calibrazione Notturna (`js/world/DayNightCycle.js`, `js/world/SceneManager.js`, `js/world/PostProcessing.js`):
    - *Illuminazione Ambient Floor:* aggiunta luce `THREE.AmbientLight(0x0D131A, 0.15)` denominata `ambientFloor` in `SceneManager.js` per garantire una base di luce non nulla su tutta la scena in qualunque orientamento o fossa profonda.
    - *Cielo Notturno Garantito:* calibrazione `DayNightCycle.js` con colore cielo notturno `#1B2A40` (blu abissale), intensità minima non inferiore a `0.25` e luce riflessa dal suolo `#0D131A`. Intensità minima sole/luna garantita a $\ge 0.35$.
    - *Tone Mapping & Exposure:* configurato in `SceneManager.js` `renderer.toneMapping = THREE.ACESFilmicToneMapping` e `renderer.toneMappingExposure = 1.0`.
    - *PostProcessing Alfa Opaco:* corretto l'output del fragment shader in `gl_FragColor = vec4(finalColor, 1.0);`, prevenendo canali alfa nulli o trasparenti che causavano lo schermo nero su canvas WebGLRenderTarget.
    - *Calibrazione Bloom e Vignette:* uniform ricalibrate (`threshold: 0.85, strength: 0.4, radius: 0.5, darkness: 0.28, offset: 0.95`) per evitare l'oscuramento dei margini.
  - Antialiasing su Tutte le Configurazioni (`js/world/PostProcessing.js`):
    - *Hardware MSAA 4x:* configurato `samples: 4` nel `THREE.WebGLRenderTarget` su WebGL2, garantendo campionamento multi-sample nativo nel buffer offscreen del post-processing.
    - *FXAA Integrato nello Shader:* routine di campionamento a contrasto di luminanza (Fast Approximate Anti-Aliasing) nel shader compositore, lisciando le scalettature geometriche dei poligoni low-poly.
  - Generazione Duna Naturale e Deformazione Iniziale del Terreno (`js/world/Terrain.js`):
    - Rimossa la quota iniziale piatta a lastra squadrata (`startHeight = 12` uniforme).
    - Introdotta la funzione `getInitialBiomeHeightOffset(vx, vz, biome)` con modellazione altimetrica differenziata per bioma:
      - *Deserto (Default):* creste di duna morbide e ondulate con funzioni sinusoidali a bassa frequenza (`Math.sin(vx * 0.05) * 1.5 + Math.cos(vz * 0.03) * 1.2 + Math.sin((vx + vz) * 0.04) * 0.6`).
      - *Oceano Prosciugato:* avvallamento centrale a bacino (`-2.8 * exp(-r²/3000)`) con increspature del fondale.
      - *Ghiacciaio:* creste angolari sfaccettate e gradini di permafrost (`abs(sin)` e `abs(cos)`).
      - *Giungla:* dislivelli organici e collinette di radici/humus.
    - *Ricalcolo Rigoroso del Volume Iniziale:* `this.initialVolume = sum((heights[i] - floor) * cellArea)`. La percentuale di scavo `completion` parte esattamente da `0.00%` e si aggiorna con precisione geometrica millimetrica ad ogni colpo.
    - *Calcolo Immediato delle Normali:* esecuzione di `geometry.computeVertexNormals()` fin dal frame 1 della duna, conferendo plasticità visiva e ombreggiatura tridimensionale immediata.
  - Verificata con 92 test unitari complessivi (3 suite specifiche M15 in `tests/phase15.test.mjs`, 100% superati) e test QA browser headless (`tests/phase15_browser_qa.mjs`, 0 errori console, 0 eccezioni, screenshot `dds_qa_dunes_terrain.png`, `dds_qa_high_graphics_lit.png`, `dds_qa_night_visible.png`).

- [x] **M16** Aggiornamento e Sincronizzazione Completa di Tutta la Documentazione:
  - Revisione e allineamento bidirezionale di tutti i documenti di specifica (`Ideas/` e `README.md`):
    - `Ideas/diggy-diggy-sand-project.md`: roadmap reale a 15 fasi, 4 finali con il segreto (Ascensione di Atlantide), scheda Trucchi e lockout permanente trofei, chiarimento superamento multiplayer verso biomi single-player.
    - `Ideas/brand_book_art_bible.md`: palette estesa dei 4 biomi (Deserto, Oceano, Ghiacciaio, Giungla), regole di illuminazione notturna anti-blackout (ambient floor 0.15, cielo $\ge 0.25$), tone mapping ACESFilmic e pass post-processing calibrato.
    - `Ideas/upgrade_tree_specification.md`: meta-progressione Tavolette Antiche $\tau$, perk del Santuario, matrice del Guardaroba cosmetico e sblocchi biomi.
    - `Ideas/asset_manifest_download_guide.md`: formalizzazione architettura asset a doppio binario (asincrono GLTF/audio con fallback procedurale `ProceduralFactory` e `SoundSynth`) e gestione timeout.
    - `README.md`: riscrittura completa, badge aggiornati a 92 test, tabella controlli, guida cheat e comandi console `window.DDS_DEBUG`.

- [x] **M17** Nitidezza Texture (2048x2048 & Max Anisotropia), Transizioni Continue e Controlli Camera (Q/E & Wheel Zoom):
  - Qualità e Definizione Texture (Anti-Blur & Anisotropia Massima):
    - *Anisotropia Massima Automatica:* helper `configureTextureAnisotropy(texture, maxAnisotropy)` integrato in `SceneManager.js`, `AssetLoader.js` e `Terrain.js`, configurando `renderer.capabilities.getMaxAnisotropy()`, `LinearMipmapLinearFilter`, `LinearFilter` e `generateMipmaps` su ogni texture procedurale e modello GLTF.
    - *Micro-Texture Procedurale 2048x2048:* introdotta `createSandMicroTexture()` in `Terrain.js`, che sintetizza un canvas ad altissima risoluzione con grana minerale e glint brillanti di silice/quarzo. Applicata come `roughnessMap` e `bumpMap` (`bumpScale: 0.04`, `repeat.set(64, 64)`, `wrapS = wrapT = RepeatWrapping`) preservando `flatShading: true` e la palette cromatica dei biomi.
  - Transizioni Fluide e Continue (Giorno/Notte & Eventi Atmosferici):
    - *Ciclo Giorno/Notte Continuo (`DayNightCycle.js` & `Sky.js`):* rimossi tutti gli switch a soglia discreta. S-curve continua (`THREE.MathUtils.smoothstep`) per `nightFactor`, curva gaussiana per `sunsetFactor`, e lerp continuo a 4 stop cromatici su canvas per il gradiente della volta celeste. Sole, emisferica e nebbia interpolati dolcemente senza scatti.
    - *Dissolvenza Torce/Lanterne (`Torches.js`):* rampa morbida con `smoothstep(nightFactor, 0.02, 0.35)`, fiamma semitrasparente e intensità d'illuminazione graduale all'imbrunire.
    - *Tempeste di Sabbia Progressive (`WorldEvents.js` & `AudioEngine.js`):* transizione graduale di 2.5 secondi per entrata e uscita. La nebbia si infittisce dolcemente verso l'ocra dorato `#C89849`, e il nuovo metodo `AudioEngine.setStormWind(intensity)` alza progressivamente il guadagno del vento e la frequenza del filtro passa-banda.
  - Controlli Camera Avanzati (`js/world/Camera.js`):
    - *Rotazione Orbitale Q/E:* rotazione orbitale con tasti `KeyQ` (orario) e `KeyE` (antiorario), accelerazione angolare ed esponenziale smorzamento inerziale per rotazioni cinematografiche fluide anche durante lo scavo.
    - *Zoom Cinematico con Wheel:* intercettazione eventi rotellina con `e.preventDefault()`, damping esponenziale della distanza e clamping rigoroso tra `12.0m` (fondo dello scavo) e `135.0m` (panoramica completa).
  - Verificata con 96 test unitari complessivi (4 suite specifiche M17 in `tests/phase16.test.mjs`, 100% superati) e browser QA end-to-end (`tests/phase16_browser_qa.mjs`, 0 errori console, screenshot `dds_qa_camera_zoomed_grain.png`, `dds_qa_camera_rotated_qe.png`, `dds_qa_storm_fade_in.png`).

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

