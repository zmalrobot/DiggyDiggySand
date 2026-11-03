# Diggy Diggy Sand — Asset Manifest & Legal Attributions

> **Scopo del Documento:** Mappatura definitiva di tutti gli asset esterni (modelli 3D, campioni audio, texture PBR), protocollo di fallback procedurale a zero-dipendenze e testo ufficiale per la modale Crediti.
> **Standard di Licenza:** 100% Free per uso commerciale e personale (**CC0 Public Domain**, **MIT**, **SIL OFL**).

---

## 1. Attribuzioni Ufficiali per la Modale Crediti (`CreditsModal.js`)

Il seguente testo strutturato è inserito integralmente all'interno della modale dei Crediti e Riconoscimenti nel gioco:

```
===================================================================
DIGGY DIGGY SAND: THE SUNKEN CITY — RICONOSCIMENTI UFFICIALI
===================================================================

1. MOTORE GRAFICO & LIBRERIE
   - Three.js (r160) — Copyright (c) 2010-2024 Three.js Authors
     Rilasciato sotto Licenza MIT.

2. TIPOGRAFIA & FONT
   - Cinzel Decorative & Cinzel — Disegnati da Natanael Gama
   - Syne — Disegnato da Bonjour Monde, Lucas Descroix
     Rilasciati sotto licenza SIL Open Font License (OFL 1.1).

3. MODELLI 3D & ASSET LOW-POLY
   - Kenney Kits (Pirate, Survival, Medieval, Construction) — Kenney.nl
     Rilasciati sotto licenza Creative Commons Zero (CC0 1.0 Universal).
   - Modular Adventurers — Quaternius (quaternius.com)
     Rilasciati sotto licenza Creative Commons Zero (CC0).
   - Desert Props & Obelisks — iPoly3D (OpenGameArt.org)
     Rilasciati sotto licenza CC0 / Public Domain.

4. EFFETTI SONORI & AMBIENT
   - UI Audio Pack & Digital Audio — Kenney.nl (CC0 1.0)
   - Shovel Dig Sounds — Blender Foundation / OpenGameArt (CC-BY / CC0)
   - Procedural Web Audio Engine — SoundSynth nativo a cura del team di sviluppo.

Tutti gli asset esterni impiegati sono di pubblico dominio o concessi
in licenza libera conforme per la ridistribuzione web gratuita.
===================================================================
```

---

## 2. Registro delle Texture PBR ad Alta Risoluzione (`assets/textures/`)

Tutte le texture sono generate o conservate a risoluzione nativa **2048x2048** con filtraggio anisotropico impostato al massimo supportato dalla scheda grafica (`renderer.capabilities.getMaxAnisotropy()`):

| Asset ID | Nome File | Risoluzione | Canale / Funzione | Descrizione Visiva |
|---|---|---|---|---|
| `TEX_SAND_NORM` | `sand_dune_normal_2k.png` | $2048 \times 2048$ | Normal Map (RGB) | Ondulazioni e micro-increspature eoliche della sabbia. |
| `TEX_SAND_ROUGH` | `sand_roughness_2k.png` | $2048 \times 2048$ | Roughness (Grayscale) | Riflettanza opaca diffusa per granelli di quarzo. |
| `TEX_STONE_NORM` | `ruin_sandstone_normal_2k.png` | $2048 \times 2048$ | Normal Map (RGB) | Mattoni squadrati in arenaria con scanalature d'erosione. |
| `TEX_ORICHALCUM` | `orichalcum_metal_2k.png` | $2048 \times 2048$ | Metallic/Roughness | Mappa composita ad alta riflettanza metallica con intarsi dorati. |

---

## 3. Mappatura Audio e Schemi di Feedback Aptico per Mobile

Il motore sincronizza l'emissione del suono (campionato o di sintesi) con l'API di vibrazione tattile (`navigator.vibrate`):

| Evento di Gioco | File Audio Primario | Frequenza SoundSynth | Pattern Vibrazione Mobile |
|---|---|---|---|
| **Scavo Manuale Normale** | `sand_dig_01.ogg` | Rumore bianco passabanda ($450\text{Hz}$) | `[12]` (impulso secco impercettibile) |
| **Colpo Critico (Solar)** | `solar_crit.ogg` | Triangolare esponenziale ($880 \rightarrow 1760\text{Hz}$) | `[25, 15, 30]` (doppio impulso brillante) |
| **Detonazione Dinamite** | `dynamite_blast.ogg` | Rumore rosa sub-basso ($65\text{Hz}$) | `[60, 40, 100]` (scuotimento pesante) |
| **Acquisto Upgrade** | `ui_upgrade.ogg` | Due toni armonici ($523 \rightarrow 659\text{Hz}$) | `[18]` (conferma click) |
| **Completamento Direttiva** | `directive_complete.ogg` | Arpeggio dorato ($440 \rightarrow 554 \rightarrow 659\text{Hz}$) | `[30, 20, 50]` (celebrazione) |

---

## 4. Architettura a Doppio Binario: Sicurezza e Robustezza

Per rispettare l'obbligo di resilienza offline e prevenire errori bloccanti al caricamento:
1. `AssetLoader.js` verifica la connettività e carica asincronamente i modelli GLTF e le texture 2K.
2. In caso di errore 404, file corrotto o timeout ($10\text{s}$ per singolo asset, $30\text{s}$ globale), il loader **non blocca la schermata**, ma subentra immediatamente con i generatori geometrici matematici di `ProceduralFactory.js` e con la sintesi sonora di `SoundSynth`.
3. Il caricamento si conclude costantemente con successo, garantendo la giocabilità immediata in qualsiasi contesto di rete o host locale.