# Diggy Diggy Sand — Brand Book & Art Bible

> **Identità Artistica Ufficiale:** *Atlantean-Kemetism* (Incontro tra l'Egitto Monumentale e la Tecnologia Arcana di Atlantide)  
> **Scopo del Documento:** Canoni estetici tassativi per l'interfaccia utente (HTML/CSS), il rendering Three.js, il Game Juice e la tipografia.

---

## 1. Visione Estetica Fondamentale

Il mondo visivo di *Diggy Diggy Sand* riposa sul netto contrasto tra superficie e profondità:
* **Superficie Egizia (Kemet):** Arenaria dorata, pietre squadrate, calore solare accecante, polvere sottile e metalli bruniti dal vento.
* **Profondità Atlantidea:** Architetture megalitiche sommerse con canali intarsiati di resina luminescente, oricalco riflettente, bagliori turchesi (`#0FE3C1`) e vibrazioni abissali.

---

## 2. Tipografia e Ruoli Grafici

I font adottati appartengono alla libreria open-source **Google Fonts** (licenza SIL Open Font License) e sono predisposti per l'uso locale o CDN:

| Famiglia Carattere | Pesi Utilizzati | Destinazione d'Uso |
|---|---|---|
| **Cinzel Decorative** | 700 (Bold), 900 (Black) | Logo principale, titoli delle schermate finali, banner dei trofei monumentali. |
| **Cinzel** | 600 (SemiBold), 700 (Bold) | Intestazioni dei pannelli HUD, nomi degli upgrade, bottoni principali. |
| **Syne** | 700 (Bold), 800 (ExtraBold) | Dati numerici, contatore sabbia, rateo SPS, cifre del profiler diagnostico. |
| **Syne** | 400 (Regular), 500 (Medium) | Testi narrativi, descrizioni di officina, tooltip e note dei crediti. |

---

## 3. Specifiche Visive del "Game Juice"

### 3.1 Numeri Fluttuanti (Floating Damage & Resource Text)
A ogni impatto della pala o delle scavatrici, un micro-vettore tipografico sale dal punto di contatto disperdendosi verso l'alto:
- **Colpo Manuale Standard:** Font `Syne 800`, colore oro solare `#F5BA23`, outline scuro `#031826` ($1.5\text{px}$), traslazione verticale di $+2.5\text{m}$ in $0.7\text{s}$ con curva d'uscita esponenziale.
- **Colpo Critico (Solar Cleave):** Font `Syne 800` a dimensione $1.5\times$, colore turchese brillante `#84FFF0` con alone ciano (`text-shadow: 0 0 8px #0FE3C1`), accompagnato dalla scritta `CRIT!`.
- **Ricompensa Direttiva:** Font `Cinzel Bold`, colore verde smeraldo `#2ECC71`.

### 3.2 Camera Shake Procedurale
Il micro-trauma della telecamera orbitale viene gestito tramite decadimento armonico smorzato:
$$\text{Offset}_{\text{cam}}(t) = A \cdot e^{-\lambda t} \cdot \sin(\omega t)$$
- **Colpo Critico:** Ampiezza $A = 0.08^{\circ}$, durata $0.25\text{s}$.
- **Detonazione Dinamite:** Ampiezza $A = 0.35^{\circ}$, durata $0.65\text{s}$.
- **Attivazione Raggio di Atlantide:** Vibrazione continua ad alta frequenza ($A = 0.05^{\circ}$, $\omega = 45\text{ rad/s}$).
- **Vincolo Accessibilità:** Se l'utente attiva la preferenza *Movimento Ridotto* (Reduced Motion), tutti i valori di ampiezza $A$ collassano a $0$.

---

## 4. Palette Cromatica Ufficiale

```css
:root {
  /* --- PALETTE KEMET (Superficie, Sole, Arenaria) --- */
  --sand-surface:      #E4C580; /* Sabbia dorata fine superficiale */
  --sand-compact:      #C89849; /* Strato intermedio compatto */
  --sandstone-deep:    #8C5828; /* Arenaria basale e blocchi grezzi */
  --gold-pharaoh:      #F5BA23; /* Oro solare per reward e icone */
  --gold-glow:         #FFE380; /* Bagliore metallico caldo */

  /* --- PALETTE ATLANTEA (Luce, Tecnologia, Oricalco) --- */
  --atlantis-teal:     #0FE3C1; /* Cianite / Energia primaria */
  --atlantis-cyan:     #00B4D8; /* Frequenza concentrata */
  --atlantis-abyss:    #031826; /* Blu notte abissale per sfondi UI */
  --orichalcum:        #D87D38; /* Rame-oricalco fuso riflettente */
  --crystal-pulse:     #84FFF0; /* Picco di emissione bioluminescente */

  /* --- INTERFACCIA UTENTE GLASSMORPHISM --- */
  --ui-bg:             rgba(3, 24, 38, 0.88);     /* Vetro scuro abissale */
  --ui-surface:        rgba(10, 42, 64, 0.70);    /* Card interne shop */
  --ui-border-gold:    #D4AF37;                  /* Bordo metallico oricalco */
  --ui-border-teal:    rgba(15, 227, 193, 0.45); /* Bordo luminescente attivo */
  --text-main:         #FBF7EE;                  /* Bianco pergamena chiaro */
  --text-muted:        #94A8B3;                  /* Grigio mare antico */
  --text-accent:       #0FE3C1;                  /* Ciano atlantideo per numeri attivi */
}
```

---

## 5. Specifiche di Rendering PBR e Shader

### 5.1 Calibrazione Materiali PBR Three.js
Per evitare superfici plastiche o uniformi:
- **Terreno e Sabbia:** `roughness: 0.88`, `metalness: 0.05`, `flatShading: true`, con mappa di normali procedurale a 2048px che simula le increspature del vento.
- **Rovine in Arenaria:** `roughness: 0.75`, `metalness: 0.15`.
- **Intarsi in Oricalco e Punte degli Obelischi:** `roughness: 0.22`, `metalness: 0.85`, riflettanza dorata accentuata.
- **Cristalli di Atlantide:** `emissive: #0FE3C1`, `emissiveIntensity: 0.85`, componente speculare elevata con Selective Bloom.

### 5.2 Raytracing Sperimentale (SSR & SSAO)
Quando abilitato nella scheda grafica:
- **Screen-Space Reflections (SSR):** Il pavimento basale riflette le colonne e la luce delle torce con attenuazione della rugosità (`fresnelExponent: 3.0`).
- **Screen-Space Ambient Occlusion (SSAO):** Aggiunge micro-ombre di contatto scure nei punti di giunzione tra le dune e i muri degli edifici sepolti (`radius: 0.4, intensity: 1.2`).