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
- [ ] **M4** Finali e persistenza avanzata: `js/endings/{EndingManager,CurseEnding,TreasureEnding,BusinessEnding}.js` (mulberry32, `?ending=`, `?cheat=1`), codec compresso del terreno in `Save.js`, `js/ui/Overlay.js`, galleria finali.
- [ ] **M5** Polish e mobile: `js/systems/TouchControls.js` (un dito scava, due ruotano e zoomano), bilanciamento ed eventi sonori completi.

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

