# Monte-Carlo-Zukunftssimulation – Architektur-Entscheidungen

Status: **Entwurf, wartet auf Feedback** · Datum: 2026-07-09
Feature: Wahrscheinlichkeitsfächer für den Depotwert über 1/5/10 Jahre
(10./50./90.-Perzentil-Pfade) – die Zukunfts-Ergänzung zu Stress-Replay
(Vergangenheit) und Score/Ampel (Gegenwart).

Nach Freigabe werden ARCHITECTURE.md §3 (Modul), §6 (Endpunkt) und §10
(Kalibrierungen) nachgezogen – das Feature ist dort bisher nicht
vorgesehen, dieses Dokument ist der Beschluss dazu.

---

## 1. Simulationsmethode: Bootstrap vs. parametrisch

**Empfehlung: Historischer Bootstrap (nicht-parametrisches Resampling
echter Tagesrenditen). Keine Normal-/t-Verteilungs-Monte-Carlo in v1.**

**Begründung:**
- **Konsistenz mit risk/var.py:** Das Projekt behandelt den historischen
  Ansatz bereits als Default – der historische CVaR speist den Score,
  der parametrische ist explizit "comparison and education only", mit
  dokumentierter Schwäche "underestimates fat tails". Eine Simulation,
  die auf der Normalverteilung basiert, würde genau die Tail-Risiken
  glätten, deren Verständnis das Kernziel der App ist.
- **Fat Tails und Schiefe bleiben erhalten:** Der Fächer enthält echte
  Crash-Tage aus der Historie – das 10. Perzentil sieht so aus, wie sich
  schlechte Jahre wirklich anfühlen.
- **Erklärbarkeit (Prinzip 1):** "Wir mischen die tatsächlichen
  Tagesbewegungen deines Depots zufällig neu und spielen sie viele Male
  ab" ist einem Einsteiger in einem Satz erklärbar. Eine multivariate
  Normalverteilung mit Cholesky-Zerlegung ist es nicht.

**Trade-offs:**
- *Bootstrap:* kann nichts Schlimmeres erzeugen als die schlimmste
  beobachtete Tagesbewegung; die Qualität steht und fällt mit der
  Input-Historie (→ Frage 6). i.i.d.-Ziehung zerstört Vol-Clustering
  (ruhige/turbulente Phasen wechseln in Realität in Clustern) –
  akzeptierter v1-Trade-off, siehe Frage 2.
- *Parametrisch (Normal):* glatter, unbegrenzt extrapolierbar, aber
  systematisch zu dünne Tails – didaktisch kontraproduktiv.
- *Parametrisch (t-Verteilung):* fettere Tails, aber Freiheitsgrad-
  Fitting ist eine neue, schwer erklärbare Kalibrierungsentscheidung.
  Kandidat für einen Phase-2-Vergleichsmodus ("Was wäre, wenn die
  Zukunft normalverteilt wäre?"), analog zum parametrischen CVaR.

---

## 2. Korrelationsstruktur

**Empfehlung: Ganze Handelstage ziehen – konkret: die Portfolio-
Tagesrenditen werden VOR der Simulation gebildet (`portfolio_returns`),
und der Bootstrap zieht aus dieser 1-D-Serie.**

Da die Gewichte konstant bleiben (→ Frage 3), ist das Ziehen ganzer
Tages-Vektoren über alle Ticker mathematisch identisch mit dem Ziehen
aus der fertigen Portfolio-Return-Serie – jeder gezogene Tag trägt die
echten gemeinsamen Bewegungen aller Assets bereits in sich. Die
Korrelationsstruktur bleibt damit **exakt** erhalten, und die
Implementierung wird trivial (1-D-Resampling statt Matrix-Logik) und
nutzt den bestehenden, Shuffle-Test-gesicherten Alignment-Pfad.

**Der zu vermeidende Fehler (explizit, weil verlockend einfach):
unabhängige Ziehung pro Asset.** Wer für jedes Asset separat Tage zieht,
zerstört die Korrelationen: Diversifikation wirkt dann künstlich
perfekt, weil simulierte Krisentage eines Assets auf Normaltage der
anderen treffen. Der Fächer wird unrealistisch schmal und suggeriert
Sicherheit, die es nicht gibt – exakt die Sorte geglättetes Ergebnis,
die eine Lern-App nicht produzieren darf (in echten Krisen fallen die
Werte gemeinsam, Korrelationen springen Richtung 1, siehe
Finanzkrise-Lernkarte).

**Trade-offs:**
- *1-D-Portfolio-Bootstrap (gewählt):* keine per-Asset-Pfade im Ergebnis
  (v1 zeigt ohnehin nur den Depotwert) und an die Konstante-Gewichte-
  Annahme gekoppelt.
- *Block-Bootstrap (mehrtägige Blöcke):* würde zusätzlich das
  Vol-Clustering erhalten, bringt aber eine unkalibrierbare
  Blocklängen-Entscheidung mit. Bewusst vertagt; im Ergebnisobjekt/
  Doku als bekannte Vereinfachung dokumentieren.

---

## 3. Rebalancing-Annahme

**Empfehlung: Heutige Gewichte über den gesamten Horizont konstant –
identisch zur Stress-Replay-Entscheidung (STRESS_TEST_DECISIONS.md §4).**

**Begründung:** Score, Ampel, Stress-Replay und Simulation beantworten
dann alle dieselbe Frage über dasselbe Objekt: *"Wie verhält sich diese
Allokation?"* Ein einziges Portfoliomodell im ganzen Produkt ist für
Einsteiger wichtiger als punktueller Realismus – und es ermöglicht den
1-D-Bootstrap aus Frage 2. Der bestehende Transparenzsatz ("Annahme:
Deine heutigen Gewichte bleiben konstant") wird wiederverwendet.

**Trade-offs:** Über 10 Jahre driftet ein echtes Buy&Hold-Depot deutlich
(Gewinner werden schwerer – Konzentration wächst von selbst). Das ist
ein eigener Lerninhalt, aber einer für eine Phase-2-Vergleichsansicht
("konstant vs. laufen lassen"), die dann Stress-Replay und Simulation
**gemeinsam** umstellen müsste. Unterschiedliche Annahmen in zwei
Zeit-Features wären die schlechteste Variante.

---

## 4. Anzahl Pfade & Performance

**Empfehlung: 2 000 Pfade, fester Seed, synchron in der API-Response,
Antwort auf ~monatliche Stützstellen ausgedünnt. Kein Async, kein Cache.**

- **2 000 Pfade** stabilisieren das 10./50./90. Perzentil völlig
  ausreichend (Fehler ~1/√n; wir zeigen keine 1-%-Extremquantile).
  Rechnung: 10 Jahre ≈ 2 520 Handelstage × 2 000 Pfade = ~5 Mio.
  Ziehungen – vektorisiert mit numpy deutlich unter einer Sekunde und
  ~40 MB Peak-Memory. Das läuft synchron in einer FastAPI-Response;
  eine Job-Queue wäre Phase-1-Overengineering.
- **Fester, deterministischer Seed** (Konstante): gleiche Eingabe →
  gleicher Fächer. Ohne das "zappelt" der Fächer bei jedem Reload und
  wirkt wie ein Zufallsorakel statt wie eine Analyse; außerdem werden
  Tests damit exakt statt nur statistisch.
- **Ausgedünnte Antwort:** nicht 2 520 Tagespunkte × 3 Perzentile,
  sondern ~monatliche Stützstellen (~121 Punkte bei 10 Jahren) – kleine
  Payload, fürs Chart mehr als genug.
- Pfadanzahl/Seed als Konstanten in `constants.py` (unkalibriert → §10).

**Trade-offs:** 10 000 Pfade wären in den äußersten Tails präziser
(brauchen wir nicht) bei ~5-facher Zeit/Memory; 500 Pfade wären schneller,
aber die 10./90.-Linien würden sichtbar rauschen. Caching lohnt nicht:
Das Ergebnis ist depot-spezifisch und die Berechnung billiger als ein
Cache-Roundtrip wäre.

---

## 5. Darstellung & Lernaspekt (Prinzip 1 vs. Prinzip 3)

**Empfehlung: Frequenz-Formulierungen statt Wahrscheinlichkeits-Sprache,
Konjunktiv, fester Disclaimer, Median nie als "erwartet" labeln.**

- **Formulierung der Perzentile als Simulationshäufigkeit:** "In 8 von
  10 simulierten Verläufen lag der Depotwert nach 5 Jahren zwischen X €
  und Y €." Das ist ehrlicher als "mit 80 % Wahrscheinlichkeit" – es
  sind Häufigkeiten in unserer Simulation, keine Wahrscheinlichkeiten
  über die echte Zukunft – und für Laien greifbarer.
- **Nie:** "Prognose", "erwartet", "wird", Zielerreichungs-Framing
  ("Du erreichst X mit 90 % Wahrscheinlichkeit" wäre quasi-Beratung).
  **Immer:** Konjunktiv ("könnte"), wie beim Stress-Replay.
- **Median-Falle:** Die 50.-Perzentil-Linie wird als "mittlerer
  simulierter Verlauf" bezeichnet, nicht als "erwartete Entwicklung" –
  sonst liest der Nutzer sie als Versprechen und die Bandbreite als
  Fehlertoleranz.
- **Fester Disclaimer** (analog `STRESS_DISCLAIMER`): "Simulation auf
  Basis vergangener Tagesrenditen deines Depots – keine Vorhersage.
  Die Zukunft kann außerhalb jeder gezeigten Bandbreite liegen.
  Annahme: Deine heutigen Gewichte bleiben konstant."
- **Lernkarte** (statisch, ticker-frei): was ein Bootstrap ist, warum
  die Bandbreite mit dem Horizont wächst, warum der Median kein
  Versprechen ist.
- **Regressionswächter:** Der bestehende Handlungsverb-Test wird auf
  explanation/lesson/disclaimer der Simulation ausgeweitet (gleiches
  Muster wie Ampel und Stress).

---

## 6. Zeithorizont-Grenzen & kurze Historie

**Empfehlung: Feste Horizonte 1/5/10 Jahre (keine freie Eingabe),
Mindesthistorie 250 Handelstage, Transparenz-Pflichtfeld zur
tatsächlich genutzten Datenbasis.**

- **Horizonte als Preset-Liste** (Konstante): drei Werte reichen für
  den Lerneffekt "Bandbreite wächst mit der Zeit"; freie Eingabe lädt
  zu Pseudo-Finanzplanung ein.
- **Input-Historie:** bis zu 5 Jahre tägliche Kurse (Loader-Fenster);
  `daily_returns` truncated wie überall auf die **gemeinsame** Historie
  – ein junges Asset verkürzt also die Basis des ganzen Depots. Das
  Ergebnis weist deshalb verpflichtend aus: genutzte Historienlänge und
  welcher Titel sie begrenzt ("Datenbasis: 1,4 Jahre, begrenzt durch
  ABNB").
- **Mindesthistorie `SIM_MIN_HISTORY_DAYS = 250`** (~1 Handelsjahr,
  unkalibriert → §10): darunter sprechende Ablehnung ("Zu wenig
  Kurshistorie für eine aussagekräftige Simulation…"). Zwischen 1 und
  ~3 Jahren Basis läuft die Simulation, aber die Erklärung kennzeichnet
  die dünne Grundlage ausdrücklich ("basiert auf nur 1,4 Jahren –
  seltene Ereignisse wie Crashs fehlen in dieser Basis womöglich
  vollständig").
- **1 Jahr Basis + 10-Jahres-Horizont** ist statistisch dünn (dieselben
  ~250 Tage werden ~25-fach recycelt). Bewusst **erlaubt mit Warnung**
  statt abgelehnt: Einsteiger-Depots sind jung; ein hartes Verbot würde
  genau die Zielgruppe aussperren. Der Warnhinweis ist der Lerninhalt.

**Trade-offs:** Härtere Schwelle (z.B. 3 Jahre) wäre statistisch
sauberer, macht das Feature aber für die Kernzielgruppe unsichtbar;
weichere (100 Tage) produziert Fächer aus fast nichts. 250 ist der
Anker "ein volles Marktjahr inkl. mindestens einer Berichtssaison".

---

## 7. Modul-Schnitt

**Empfehlung: Neues Modul `sentinel_core/simulation/` (eine Datei
`monte_carlo.py`) – keine Erweiterung von `stress/`.**

**Begründung:** `stress/` spielt deterministisch eine fixierte
Vergangenheit nach (Preset-Fenster, unveränderlicher Datei-Cache); die
Simulation erzeugt stochastisch mögliche Zukünfte (Horizont, Seed,
Pfade). Anderes Ergebnismodell, andere Parameter, kein gemeinsamer Code
außer den `risk/metrics`-Funktionen, die beide sowieso importieren.
Die Produktgeschichte bleibt sauber: **Vergangenheit (`stress/`) –
Gegenwart (`education/`) – Zukunft (`simulation/`)**, drei Module, drei
UI-Ansichten. Ein Sammel-Modul "alles mit Szenarien" würde mit jeder
Erweiterung unschärfer.

**Trade-offs:** Ein Modul mehr im Baum (bewusst kein Platzhalter: es
startet mit genau einer Datei voller Fachlogik). Sollten später
gemeinsame Szenario-Utilities entstehen, gehören sie nach
`risk/metrics.py`, nicht in ein Querschnitts-Modul.
API-Endpunkt: `POST /simulation/monte-carlo` (§6 nachziehen).

---

## Übergreifende Leitplanken (aus ARCHITECTURE §1)

1. **Keine Anlageberatung:** Alle Texte beschreiben Simulationsausgänge
   im Konjunktiv, nie Zukunftsbehauptungen oder Handlungen; Wächter-Test
   Pflicht (Frage 5).
2. **Graceful Degradation:** Ohne ausreichende Historie oder Internet →
   sprechende deutsche `ValueError`, Rest der App unberührt.
3. **Pflicht-Tests:** deterministischer Seed (gleiche Eingabe = gleicher
   Fächer), Perzentil-Ordnung (p10 ≤ p50 ≤ p90 an jedem Stützpunkt),
   Korrelations-Erhalt (anti-korreliertes 2-Asset-Depot muss engeren
   Fächer haben als dasselbe Depot mit unabhängig gemischten Assets),
   Mindesthistorie-Grenzfall, Historien-Transparenzfeld, Shuffle-Test
   für den Eintrittspunkt, Textwächter.
