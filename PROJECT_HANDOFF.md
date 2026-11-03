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
- [x] **M0** Foundation (scritta, da verificare)
- [x] **M0.5** Boot, Loading, Settings, Menu (scritta, da verificare)
- [ ] **M1** Scavo e audio: `js/world/Terrain.js` (chunk 8×8, `flatShading`, colori per altezza), `js/systems/Digging.js` (raycast analitico, click e hold, tick `max(0.06, 0.35×0.93^n)`), `js/world/Particles.js` (`InstancedMesh`, sabbia `#E4C580` e scintille `#0FE3C1`), `playDig`/`playCrit` in `AudioEngine`, `js/world/Sky.js`, `js/core/Game.js`.
- [ ] **M2** Economia e HUD: `js/core/State.js`, `js/systems/Economy.js` (timestamp reali, `dt` limitato), `js/systems/Upgrades.js` (U1.1-U1.4: costi 10/45/90/350, moltiplicatori 1.15/1.17/1.16/1.20), `js/ui/Hud.js`, `js/ui/Shop.js`.
- [ ] **M3** Flotta e rovine: `js/systems/Workers.js` (Nomad, Excavator, Monolith), `js/world/City.js`.
- [ ] **M4** Finali e persistenza: `js/endings/{EndingManager,CurseEnding,TreasureEnding,BusinessEnding}.js` (mulberry32, `?ending=`, `?cheat=1`), codec di salvataggio del terreno in `Save.js`, `js/ui/Overlay.js`, galleria finali.
- [ ] **M5** Polish e mobile: `js/systems/TouchControls.js` (un dito scava, due ruotano e zoomano), simulazione di bilanciamento 30-40 min in `tests/`.

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

