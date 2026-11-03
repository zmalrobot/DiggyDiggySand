# Diggy Diggy Sand — Upgrade Tree & Economy Design

> **Document Purpose:** Specifiche matematiche complete dell'albero dei potenziamenti, delle formule multi-buy, delle direttive di spedizione e del bilanciamento economico per *Diggy Diggy Sand*.

---

## 1. Modello Matematico dell'Economia

### 1.1 Formula del Costo Singolo
Per qualsiasi potenziamento al livello corrente $n$ (dove $n=0$ rappresenta il livello base non acquistato):
$$\text{Cost}(n) = \text{round}\left( \text{BaseCost} \times M^n \right)$$

* Moltiplicatore standard per potenziamenti manuali: $M = 1.15$
* Moltiplicatore per unità della flotta automatica: $M = 1.18 - 1.22$
* Sblocco una tantum (Reliquie ed Abilità Attive): Costo fisso non scalare.

### 1.2 Formule per l'Acquisto Multiplo (Multi-Buy Math)
Quando il giocatore imposta il selettore del negozio su $10\times$, $100\times$ o $\text{MAX}$, il costo cumulativo non viene calcolato iterativamente, bensì attraverso la somma analitica della serie geometrica finita:

#### Costo per $m$ livelli consecutivi a partire dal livello $n$:
$$\text{Cost}_{\text{bulk}}(n, m) = \sum_{k=0}^{m-1} \text{Cost}(n+k) = \text{round}\left( \text{BaseCost} \times M^n \times \frac{M^m - 1}{M - 1} \right)$$

#### Calcolo del livello massimo acquistabile ($\text{MAX}$) con saldo disponibile $S$:
$$m_{\text{max}} = \left\lfloor \frac{\ln\left(1 + \frac{S \times (M - 1)}{\text{BaseCost} \times M^n}\right)}{\ln(M)} \right\rfloor$$
Se $m_{\text{max}} < 1$, il pulsante di acquisto rimane disabilitato indicando il costo per il singolo livello successivo ($m=1$).

---

## 2. Ramo 1: Strumenti Manuali (Click & Hold Power)

### U1.1 — Pala d'Oricalco (Click Power)
* **Base Cost:** 10 | **Multiplier:** 1.15 | **Max Level:** 50
* **Formula Efficacia:** $\text{Power}_{\text{click}} = 1 + n \times (1 + \text{Bonus}_{\text{Sanctuary}})$
* **Impatto Visivo:** L'icona dell'attrezzo e il modello visivo avanzano ogni 10 livelli (Bronzo grezzo $\rightarrow$ Ferro forgiato $\rightarrow$ Ottone cerimoniale $\rightarrow$ Lama d'Oricalco).

### U1.2 — Ritmo Cinetico (Hold Dig Rate)
* **Base Cost:** 45 | **Multiplier:** 1.17 | **Max Level:** 20
* **Formula Intervallo:** $\Delta t_{\text{tick}} = \max\left(0.06\text{s},\ 0.35\text{s} \times 0.93^n\right)$
* **Nota di Rendering:** Il tetto massimo di frequenza a $\approx 16.6\text{ colpi/s}$ tutela il raycaster Three.js da cali di framerate sui dispositivi mobili.

### U1.3 — Raggio di Fenditura (Excavation Radius)
* **Base Cost:** 90 | **Multiplier:** 1.16 | **Max Level:** 15
* **Formula Raggio:** $R = 2.0\text{m} + (n \times 0.45\text{m})$
* **Impatto Visivo:** L'area circolare del cratere e l'estensione del pool particellare crescono proporzionalmente a $R$.

### U1.4 — Fendente Solare (Critical Hit Chance)
* **Base Cost:** 350 | **Multiplier:** 1.20 | **Max Level:** 10
* **Requisito di Sblocco:** $5\%$ di completamento dello scavo.
* **Effetto:** Probabilità percentuale di sferrare un colpo critico che moltiplica per $5\times$ la sabbia estratta.
* **Formula:** $\text{CritChance} = n \times 3\%$ (Cap al $30\%$).
* **Feedback "Game Juice":** Numeri fluttuanti color ciano con glow brillante, scintille dorate e micro-vibrazione della telecamera.

---

## 3. Ramo 2: Flotta Autonoma (Passive SPS)

Tutte le unità di questo ramo istanziano modelli fisici 3D calcolati sulla quota $Y$ della superficie del terreno.

| ID | Nome Unità | Base Cost | Multiplier | Max Lv | Resa Unitaria Base | Descrizione e Modello 3D |
|---|---|---|---|---|---|---|
| **U2.1** | **Automa Scarabeo** | 120 | 1.15 | 50 | $+1.5\text{ sand/s}$ | Piccolo costrutto meccanico a 6 zampe con scocca dorata. |
| **U2.2** | **Setacciatore Meccanico** | 650 | 1.15 | 40 | $+8.0\text{ sand/s}$ | Treppiede con cesto oscillante posizionato sul bordo del cratere. |
| **U2.3** | **Escavatore a Vapore** | 3.200 | 1.16 | 30 | $+55.0\text{ sand/s}$ | Macchinario su cingoli con pistoni in ottone ed emissione di sbuffi di vapore. |
| **U2.4** | **Draga Rotante di Sabbia** | 18.500 | 1.17 | 25 | $+320.0\text{ sand/s}$ | Ruota gigante a tazze che incide solchi continui lungo le dune. |
| **U2.5** | **Monolite di Risonanza** | 95.000 | 1.18 | 20 | $+1.650.0\text{ sand/s}$ | Ago di pietra levitante che emette onde concentriche turchesi. |
| **U2.6** | **Trivella Tellurica Profonda** | 600.000 | 1.20 | 10 | $+9.500.0\text{ sand/s}$ | Segmenti cilindrici d'oricalco che perforano la roccia dal basso verso l'alto. |

---

## 4. Ramo 3: Reliquie di Atlantide (Moltiplicatori e Sinergie)

Potenziamenti a costo fisso sbloccati al raggiungimento di traguardi percentuali di scavo:

| ID | Nome Reliquia | Costo Fisso | Soglia di Sblocco | Effetto Moltiplicativo |
|---|---|---|---|---|
| **R3.1** | **Cartiglio di Papiro** | 8.000 | $15\%$ Scavato | $+25\%$ di produzione su tutta la Flotta Autonoma (Ramo 2). |
| **R3.2** | **Sintonia Tellurica** | 15.000 | $25\%$ Scavato | Ogni clic manuale riceve un bonus di danno pari al $+4\%$ del DPS passivo totale. |
| **R3.3** | **Ingranaggi d'Oricalco** | 75.000 | $50\%$ Scavato | Raddoppia la produzione base ($+100\%$) di Escavatori e Draghe Rotanti. |
| **R3.4** | **Armonizzatore d'Anomalie** | 250.000 | $65\%$ Scavato | Ogni unità di volume di terreno estratta frutta il $+50\%$ di valore in valuta. |
| **R3.5** | **Occhio dell'Abisso** | 1.200.000 | $80\%$ Scavato | Moltiplicatore universale: triplica ($\times 3.0$) sia la sabbia passiva che il click manuale. |

---

## 5. Ramo 4: Artefatti Attivi (Abilità a Ricarica)

Icone cerimoniali posizionate lateralmente sull'HUD con animazione sweep del tempo di ricarica:

### A4.1 — Carica di Nitroglicerina (Dinamite Rapida)
* **Costo Sblocco:** 1.500 | **Cooldown:** 45 secondi
* **Azione:** Cliccando in qualsiasi punto del deserto, genera un'esplosione immediata con cratere triplo, particelle di macerie e accredito istantaneo di tutta la sabbia rimossa.

### A4.2 — Vortice Khamsin (Tempesta Concentrata)
* **Costo Sblocco:** 25.000 | **Cooldown:** 90 secondi | **Durata Attiva:** 10 secondi
* **Azione:** Evoca un mini-tornado dorato. Per tutta la durata, lo scavo continuo scava a velocità $3\times$ senza alcuna dispersione.

### A4.3 — Raggio Orbitale di Atlantide
* **Costo Sblocco:** 180.000 | **Cooldown:** 150 secondi | **Durata Attiva:** 6 secondi
* **Azione:** Un raggio turchese scende verticalmente dalla volta celeste e traccia una spirale verso il centro del deserto, polverizzando il terreno fino alla roccia basale.

---

## 6. Direttive di Spedizione (Contratti e Micro-Obiettivi)

Le direttive offrono micro-ricompense durante la sessione di gioco per mantenere elevato il ritmo di engagement:

| Tipo Direttiva | Condizione di Completamento | Esempio Target | Ricompensa Erogata |
|---|---|---|---|
| **Volumetrica** | Scavare $X$ unità di volume in un quadrante | *5.000 sabbia a Nord* | $+15\%$ del saldo corrente in regalo. |
| **Ritmica** | Mantenere lo scavo attivo senza interruzioni | *Hold continuativo per 10s* | Moltiplicatore scavo $\times 2.0$ per 30 secondi. |
| **Archeologica** | Dissotterrare completamente una struttura | *Liberare la prima colonna* | Accredito immediato di $1\ \tau$ (Tavoletta Antica). |
| **Flotta** | Schierare un numero minimo di macchinari | *Raggiungi 8 Automi attivi* | Sconto del $-15\%$ sul prossimo acquisto in officina. |

---

## 7. Formattazione dei Grandi Numeri

Il giocatore può selezionare dal menu Impostazioni la notazione desiderata:

1. **Notazione Compatta Ingegneristica (Default):**
   * $< 10.000$: visualizzazione intera (es. `4,850`).
   * $\ge 10.000$: suffissi internazionali a 2 cifre decimali:
     * $10^3 \rightarrow \mathbf{K}$ (Mila)
     * $10^6 \rightarrow \mathbf{M}$ (Milioni)
     * $10^9 \rightarrow \mathbf{B}$ (Miliardi)
     * $10^{12} \rightarrow \mathbf{T}$ (Trilioni)
     * $10^{15} \rightarrow \mathbf{Qa}$ (Quadrilioni)
2. **Notazione Scientifica Pura:**
   * Visualizzazione esponenziale con mantissa: es. `1.25e6`, `4.80e9`, `8.12e14`.