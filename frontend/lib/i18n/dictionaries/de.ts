/**
 * Deutsches Dictionary — UI-Chrome-Text (I18N_DECISIONS.md §0/§5).
 * NICHT enthalten: backend-generierte Erklärtexte (explanation/lesson/
 * disclaimer aus explanations.py bleiben Phase-2, §2) und Core-
 * Fehlermeldungen (eigene Mapping-Tabelle, §3, error-messages.en.ts).
 * `en.ts` muss exakt dieselbe Form haben — durchgesetzt über
 * `const en: typeof de` dort.
 */
const de = {
  meta: {
    description:
      "Paper-Trading mit Risiko-Ampel: vom ersten Spielgeld-Trade zum verstandenen Portfolio.",
  },
  nav: {
    depot: "Depot",
    ampel: "Ampel",
    stress: "Stress-Test",
    simulation: "Simulation",
  },
  disclaimer: {
    intro:
      "Sentinel beschreibt Portfolioeigenschaften (z. B. Klumpenrisiko, Volatilität) auf Basis vergangener Kurse. Das ist ",
    strong: "keine Anlageberatung",
    tail: " und keine Empfehlung für einzelne Wertpapiere. Kurse sind bis zu 15 Minuten verzögert.",
  },
  common: {
    loading: "Lädt…",
    retry: "Erneut versuchen",
    whatDoesThisMean: "Was heißt das?",
    goToDepot: "Zum Depot",
    notAvailable: "nicht verfügbar",
  },
  languageSwitcher: {
    switchToGerman: "Zu Deutsch wechseln",
    switchToEnglish: "Switch to English",
  },
  landing: {
    nav: {
      how: "Wie es funktioniert",
      ampel: "Risiko-Ampel",
      crises: "Krisen-Vergleich",
      methodology: "Methodik",
      ctaShort: "Starten",
    },
    ctaStart: "Kostenlos starten",
    hero: {
      eyebrow: "Jede Kennzahl kommt mit einer Erklärung",
      title: "Verstehen statt raten.",
      body: "Sentinel zeigt dir nicht nur eine Risikozahl, sondern erklärt in einem Satz, woher sie kommt: welche Position zu schwer wiegt, wo Diversifikation fehlt, wie stark deine Kurse historisch geschwankt sind.",
      ctaHint: "Mit virtuellem Kapital. Keine Anmeldung nötig.",
    },
    how: {
      eyebrow: "Wie es funktioniert",
      title: "In vier Schritten vom ersten Trade zum verstandenen Depot",
      body: "Kein Kurs und kein Video. Du lernst am eigenen Depot, und jede Auswertung erklärt sich selbst.",
      steps: [
        {
          number: "01",
          title: "Depot eröffnen, mit Spielgeld",
          body: "Du startest mit 10.000 € virtuellem Kapital. Kein Account, keine Einzahlung, kein Risiko.",
        },
        {
          number: "02",
          title: "Zu echten Kursen kaufen und verkaufen",
          body: "Die Marktdaten sind real, aber bis zu 15 Minuten verzögert. Positionen und Historie bleiben jederzeit nachvollziehbar.",
        },
        {
          number: "03",
          title: "Risiko-Ampel lesen",
          body: "Drei Ampeln beschreiben dein Depot in Worten: Klumpenrisiko, Diversifikation und Volatilität. Nie als Kaufempfehlung.",
        },
        {
          number: "04",
          title: "Gegen Krisen und Zukünfte prüfen",
          body: "Der Stress-Test rechnet mit echten Krisenzeiträumen. Die Monte-Carlo-Simulation zeigt die Bandbreite möglicher Verläufe.",
        },
      ],
    },
    ampel: {
      eyebrow: "Risiko-Ampel",
      title: "Drei Fragen, die dein Depot beantworten muss",
      body: "Der Status steht nie nur in einer Farbe. Es gibt immer ein Zeichen, ein Wort und eine Erklärung, was daraus folgt.",
      examples: [
        {
          status: "green" as const,
          title: "Diversifikation",
          icon: "✓",
          label: "Grün",
          text: "Dein Kapital ist auf mehrere Branchen verteilt. Ein schwacher Sektor trifft dich damit nicht mit voller Wucht.",
          lesson:
            "Was heißt das? Diversifikation ist keine Garantie gegen Verluste. Sie sorgt dafür, dass nicht alles gleichzeitig fällt.",
        },
        {
          status: "yellow" as const,
          title: "Klumpenrisiko",
          icon: "!",
          label: "Gelb",
          text: "Deine größte Position wiegt 38 Prozent. Das Depot folgt damit vor allem einem einzigen Unternehmen.",
          lesson:
            "Was heißt das? Konzentration verstärkt beide Richtungen, Gewinn und Verlust. Entscheidend ist, dass du sie bewusst wählst.",
        },
        {
          status: "red" as const,
          title: "Volatilität",
          icon: "✕",
          label: "Rot",
          text: "Die Kurse deiner Positionen schwankten historisch stark. Wertänderungen von mehreren Prozent am Tag sind hier normal.",
          lesson:
            "Was heißt das? Volatilität misst Schwankung, nicht Qualität. Die Frage ist, ob du sie aushältst, ohne panisch zu verkaufen.",
        },
      ],
    },
    crises: {
      eyebrow: "Historischer Vergleich",
      title: "Wie hätte sich dein Depot 2008 geschlagen?",
      body: "Sentinel legt dein aktuelles Portfolio über drei tatsächliche Krisenzeiträume und rechnet mit den echten Tagesrenditen dieser Monate. Kein Szenario ist eine Prognose. Es ist eine Erinnerung daran, wie tief Märkte fallen können.",
      footnote:
        "Die Balken zeigen die relative Tiefe und Dauer der jeweiligen Phase. Vergangene Wertentwicklung sagt nichts über die Zukunft. Der Vergleich dient dazu, deine eigene Verlusttoleranz einzuschätzen, bevor echtes Geld im Spiel ist.",
      examples: [
        {
          title: "Finanzkrise",
          range: "Okt 2007 bis Mär 2009",
          depth: 82,
          text: "Ein langer, zäher Rückgang über 17 Monate. Die Krise, die Geduld am stärksten testet.",
        },
        {
          title: "Corona-Crash",
          range: "Feb bis Mär 2020",
          depth: 58,
          text: "Ein sehr schneller Einbruch in wenigen Wochen, gefolgt von einer ebenso schnellen Erholung.",
        },
        {
          title: "Zinswende",
          range: "Jan bis Okt 2022",
          depth: 44,
          text: "Ein breiter Rückgang, bei dem auch klassische Absicherungen wenig geholfen haben.",
        },
      ],
    },
    simulation: {
      eyebrow: "Zukunftssimulation",
      title: "Eine Bandbreite, keine Prognose",
      body: "Die Monte-Carlo-Simulation zieht tausende Pfade aus echten historischen Tagesrenditen deiner Positionen. Das Ergebnis ist ein Korridor: wie gut es laufen könnte, wie schlecht, und wie breit die Unsicherheit dazwischen ist.",
      axis: { today: "heute", y1: "1 Jahr", y5: "5 Jahre", y10: "10 Jahre" },
      bands: {
        top: {
          label: "Oberes Fünftel",
          text: "Deutlich über dem Einsatz. Der Fall, den man sich gern merkt.",
        },
        middle: {
          label: "Mittlerer Pfad",
          text: "Der Verlauf, an dem du deine Erwartung ausrichten solltest.",
        },
        bottom: {
          label: "Unteres Fünftel",
          text: "Der Fall, den du aushalten musst, ohne die Strategie zu verwerfen.",
        },
      },
    },
    methodology: {
      eyebrow: "Methodik und Grenzen",
      title: "Was Sentinel rechnet und was es nicht kann",
      body: "Sentinel beschreibt Portfolioeigenschaften wie Klumpenrisiko, Diversifikation und Volatilität auf Basis vergangener Kurse. Das ist keine Anlageberatung und keine Empfehlung für einzelne Wertpapiere.",
      cards: [
        {
          title: "Echte Marktdaten, verzögert",
          body: "Kurse und Renditen stammen aus echten historischen Marktdaten. Sie sind bis zu 15 Minuten verzögert.",
        },
        {
          title: "Nachvollziehbare Formeln",
          body: "Die Kennzahlen basieren auf Gewichtung, Korrelation und Standardabweichung. Jede Regel ist offen dokumentiert.",
        },
        {
          title: "Keine Empfehlungen",
          body: "Sentinel beschreibt Portfolioeigenschaften. Es sagt dir nie, welches Wertpapier du kaufen oder verkaufen sollst.",
        },
        {
          title: "Kein echtes Geld",
          body: "Alle Trades sind virtuell. Es gibt kein Konto, keine Order an eine Börse und keine Gebühren.",
        },
      ],
    },
    start: {
      eyebrow: "Jetzt üben",
      title: "Der erste Fehler sollte dich nichts kosten.",
      body: "Starte mit virtuellem Kapital, beobachte dein Risiko und entscheide später mit echtem Geld. Dann aber informiert.",
      ctaHint: "Keine Anmeldung, keine Zahlungsdaten, kein echtes Geld.",
    },
    heroDemo: {
      sectors: { tech: "Technologie", energie: "Energie", anleihen: "Anleihen" },
      reset: "Zurücksetzen",
      concentrationLabel: "Klumpenrisiko",
      liveHint: "Genau das siehst du live in deinem eigenen Depot.",
      textRed: (topName: string, top: number) =>
        `${topName} macht ${top} Prozent aus. Ein einzelner Bereich bestimmt damit fast dein ganzes Ergebnis.`,
      textYellow: (topName: string, top: number) =>
        `${topName} wiegt mit ${top} Prozent deutlich schwerer als der Rest. Dein Depot folgt vor allem diesem Bereich.`,
      textGreen: (top: number) =>
        `Kein Bereich kommt über ${top} Prozent. Die Last ist auf alle drei Bereiche verteilt.`,
      lessonRed:
        "Bei dieser Konzentration entscheidet die Entwicklung eines Sektors über dein Depot. Gewinne und Verluste fallen entsprechend groß aus.",
      lessonYellow:
        "Eine Übergewichtung kann bewusst gewollt sein. Wichtig ist, dass du weißt, welchen Teil deines Ergebnisses sie bestimmt.",
      lessonGreen:
        "Bei ausgewogener Verteilung zieht ein schwacher Bereich das Depot nur anteilig nach unten. Das schützt nicht vor Verlusten, dämpft sie aber.",
      ariaValueText: (value: number) => `${value} Prozent`,
    },
    footer: {
      methodology: "Methodik",
      how: "Wie es funktioniert",
    },
  },
  depot: {
    kicker: (startCash: string) => `${startCash} virtuelles Kapital`,
    title: "Dein Paper-Depot",
    firstTradeTitle: "Dein erster Trade",
    firstTradeBody:
      "Noch keine Positionen. Probier einen ersten Kauf aus, um zu sehen, wie sich dein Depot und dein Risiko verändern.",
    justTraded: "Trade ausgeführt. Was bedeutet das für dein Risiko?",
    goToAmpel: "Zur Ampel",
    newTrade: "Neuer Trade",
    tradeDialog: "Trade-Dialog",
    stats: {
      value: "Depotwert",
      cash: "Cash",
      totalPnl: "Gesamt-P&L",
      positions: "Positionen",
      invested: "Investiert",
      shareOfPortfolio: (pct: string) => `${pct} des Depots`,
      largestPosition: (ticker: string, pct: string) =>
        `Größte: ${ticker} (${pct})`,
    },
    table: {
      ticker: "Ticker",
      quantity: "Stück",
      avgBuyPrice: "Ø Kaufpreis",
      price: "Kurs",
      value: "Wert",
      weight: "Gewicht",
      pnl: "P&L",
      news: "Nachrichten",
    },
    weighting: "Positionsgewichtung",
    weightingHint: "nach Positionswert",
    weightingCenterCaption: "Positionswert",
    weightingCenterSub: (n: number) =>
      `${n} ${n === 1 ? "Position" : "Positionen"}`,
    positionsTitle: "Deine Positionen",
    positionsHint: "Zum Aufklappen klicken",
  },
  tradeForm: {
    popularTickers: "Beliebte Werte",
    selectAria: (name: string) => `${name} auswählen`,
    ticker: "Ticker",
    side: "Seite",
    buy: "Kaufen",
    sell: "Verkaufen",
    quantity: "Menge (Stück)",
    showPrice: "Preis anzeigen",
    tickerFormatError:
      "Ticker darf nur Großbuchstaben, Ziffern und . - ^ = enthalten (max. 15 Zeichen).",
    orderVolume: "Ordervolumen",
    cashAfter: "Cash danach",
    weightAfter: "Gewicht danach",
    feeLabel: "Gebühr",
    executing: "Wird ausgeführt…",
    confirmTrade: "Trade bestätigen",
  },
  ampel: {
    kicker: "Risikoanalyse",
    title: "Risiko-Ampel",
    subtitle:
      "Drei Ampeln auf Basis deiner aktuellen Depot-Positionen: Klumpenrisiko, Diversifikation und Volatilität.",
    emptyTitle: "Noch keine Positionen",
    emptyBody:
      "Die Ampel braucht ein Depot mit mindestens einer Position. Starte auf der Depot-Seite mit deinem ersten Trade.",
    statusLabels: { green: "Grün", yellow: "Gelb", red: "Rot" },
    readings: {
      concentration: (value: string) => `HHI ${value}`,
      diversification: (value: string) => `Ratio ${value}`,
      volatility: (value: string) => `${value} (p.a.)`,
    },
    stressLinkText: "Wie hätte sich dein Depot in einer vergangenen Krise geschlagen?",
    stressLinkCta: "Zum Stress-Test",
    correlation: {
      title: "Korrelation deiner Positionen",
      explanation:
        "Positionen mit hoher Korrelation bewegen sich ähnlich, das schwächt den Diversifikationseffekt: Verluste treffen dann mehrere Positionen gleichzeitig statt sich gegenseitig auszugleichen.",
      needsTwoPositions:
        "Für eine Korrelationsmatrix braucht es mindestens 2 Positionen im Depot.",
      tableAriaLabel: "Korrelationsmatrix der Depot-Positionen",
      tableCaption:
        "Korrelation der täglichen Renditen zwischen je zwei Positionen, Werte von -1 (gegenläufig) bis +1 (gleichläufig).",
      legend: [
        { glyph: "▲▲▲", label: "sehr hoch", range: "0,70 – 1,00" },
        { glyph: "▲▲", label: "hoch", range: "0,40 – 0,70" },
        { glyph: "▲", label: "moderat", range: "0,15 – 0,40" },
        { glyph: "•", label: "gering", range: "-0,15 – 0,15" },
        { glyph: "▽", label: "negativ", range: "< -0,15" },
      ],
    },
    germanOnlyNotice:
      "Die ausführlichen Erklärungen unten liegen aktuell nur auf Deutsch vor; eine englische Version ist für ein späteres Update geplant.",
  },
  stress: {
    kicker: "Historische Krisen",
    title: "Historischer Stress-Test",
    subtitle:
      "Wie hätte sich dein heutiges Depot in einer vergangenen Krise entwickelt? Wähle ein Szenario aus.",
    emptyTitle: "Noch keine Positionen",
    emptyBody:
      "Der Stress-Test braucht ein Depot mit mindestens einer Position. Starte auf der Depot-Seite mit deinem ersten Trade.",
    coverage: (pct: number) => `${pct} % deines Depots simuliert.`,
    excluded: (tickers: string) =>
      `Nicht enthalten: ${tickers} (im Zeitraum noch nicht handelbar).`,
    chartTitle: "Depotwert im Krisenverlauf",
    chartValueTooltip: "Depotwert",
    legendDepot: "Depotwert",
    legendStart: "Ausgangswert",
    trough: "Tiefpunkt",
    stats: {
      maxDrawdown: "Maximaler Drawdown",
      totalReturn: "Rendite im Zeitraum",
      volatility: "Volatilität im Zeitraum",
    },
    simulationLinkText: "Wohin könnte sich dein Depot in Zukunft entwickeln?",
    simulationLinkCta: "Zur Simulation",
    germanOnlyNotice:
      "Die ausführliche Erklärung, Lernkarte und der Disclaimer unten liegen aktuell nur auf Deutsch vor; eine englische Version ist für ein späteres Update geplant.",
    monthsShort: [
      "Jan",
      "Feb",
      "Mär",
      "Apr",
      "Mai",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Okt",
      "Nov",
      "Dez",
    ],
    to: "bis",
  },
  simulation: {
    kicker: "Monte-Carlo-Simulation",
    title: "Zukunftssimulation",
    subtitle: "Wohin könnte sich dein heutiges Depot entwickeln? Wähle einen Zeithorizont.",
    emptyTitle: "Noch keine Positionen",
    emptyBody:
      "Die Simulation braucht ein Depot mit mindestens einer Position. Starte auf der Depot-Seite mit deinem ersten Trade.",
    horizonLabel: "Zeithorizont",
    horizon1Year: "1 Jahr",
    horizonYears: (n: number) => `${n} Jahre`,
    chartTitle: "Mögliche Wertentwicklung",
    legendBand: "80 % der Verläufe",
    legendMedian: "Median",
    legendStart: "Ausgangswert",
    assumptions: {
      title: "Annahmen der Simulation",
      horizon: "Horizont",
      paths: "Simulierte Pfade",
      history: "Kurshistorie",
      recyclingFactor: "Wiederverwendungsfaktor",
      years: (n: string) => `${n} Jahre`,
      factor: (n: string) => `×${n}`,
    },
    thinHistoryLabel: "Dünne Datenbasis:",
    thinHistoryBody: (
      years: string,
      limitClause: string,
      recyclingFactor: string,
    ) =>
      `Nur ${years} Jahre Kurshistorie${limitClause} verfügbar. Sie wird rechnerisch rund ${recyclingFactor}-mal wiederverwendet: Seltene Ereignisse wie Crashs fehlen darin womöglich vollständig.`,
    limitedBy: (ticker: string) => ` (begrenzt durch ${ticker})`,
    bandTooltip: "80 % der Verläufe",
    medianTooltip: "mittlerer Verlauf",
    stats: {
      p10: "Unteres Perzentil (10 %)",
      p50: "Mittlerer Verlauf (50 %)",
      p90: "Oberes Perzentil (90 %)",
    },
    germanOnlyNotice:
      "Die ausführliche Erklärung, Lernkarte und der Disclaimer unten liegen aktuell nur auf Deutsch vor; eine englische Version ist für ein späteres Update geplant.",
    axisMonths: "Mon.",
    axisYears: "J.",
    afterMonth: (n: number) => `nach ${n} ${n === 1 ? "Monat" : "Monaten"}`,
    afterYear: (n: number) => `nach ${n} ${n === 1 ? "Jahr" : "Jahren"}`,
  },
  analyze: {
    backToHome: "← Zur Startseite",
    kicker: "Eigenes Portfolio",
    pageTitle: "Freie Portfolio-Analyse",
    independentNote: "Dies ist eine unabhängige Analyse, kein Bezug zu deinem Paper-Depot.",
    sectionAnalyze: "Analyse",
    sectionBenchmark: "Vergleich mit Index",
    sectionOptimize: "Optimieren",
    source: {
      title: "Portfolio-Quelle",
      manualTab: "Manuell",
      csvTab: "CSV",
    },
    score: {
      hint: "Basierend auf Volatilität, Drawdown, VaR/CVaR und Konzentration",
      gaugeLow: "Niedrig",
      gaugeHigh: "Sehr hoch",
      note: "Score von 0 bis 100, höher bedeutet höheres Risiko.",
    },
    csvUpload: {
      title: "CSV-Upload",
      body: "Spalten ticker und weight, beliebige positive Skala (z. B. Euro-Beträge oder Stückzahlen).",
      dropTitle: "Datei hier ablegen",
      dropSub: "oder klicken, um eine Datei auszuwählen",
      formatLabel: "Format",
      formatHead: "ticker,weight",
      formatRow: "AAPL,5000",
      chooseFile: "Datei auswählen",
      onlyCsv: "Nur .csv-Dateien werden unterstützt.",
      tooLarge: (sizeMb: string, maxMb: number) =>
        `Datei ist ${sizeMb} MB groß, maximal ${maxMb} MB.`,
      uploading: "Wird hochgeladen…",
      upload: "Hochladen",
    },
    manualEntry: {
      title: "Manuelle Eingabe",
      countOf: (count: number, max: number) => `${count} von ${max}`,
      popularTickers: "Beliebte Werte",
      addAria: (name: string) => `${name} hinzufügen`,
      tickerPlaceholder: "Ticker",
      amountPlaceholder: "Betrag",
      removePosition: "Position entfernen",
      addPosition: "+ Position hinzufügen",
      invalidTicker:
        "Mindestens ein Ticker hat ein ungültiges Format (Großbuchstaben, Ziffern, . - ^ =, max. 15 Zeichen).",
      invalidWeight: "Beträge müssen positive Zahlen sein.",
      limitReached: (max: number) => `Maximal ${max} Positionen erreicht.`,
      submit: "Portfolio analysieren",
    },
    result: {
      riskScore: "Risiko-Score",
      topDrivers: "Größte Treiber",
      volatility: "Volatilität (p.a.)",
      maxDrawdown: "Maximaler Drawdown",
      diversificationRatio: "Diversification Ratio",
      var95: "VaR 95 % (täglich)",
      cvar95: "CVaR 95 % (täglich)",
      hhi: "HHI (Klumpenrisiko)",
      riskContributionPerPosition: "Risikoanteil je Position",
      labels: { Low: "Niedrig", Moderate: "Moderat", High: "Hoch", Severe: "Sehr hoch" },
    },
    benchmark: {
      yourPortfolio: "Dein Portfolio",
      riskScore: "Risiko-Score",
      germanOnlyNotice:
        "Der Vergleichstext unten liegt aktuell nur auf Deutsch vor; eine englische Version ist für ein späteres Update geplant.",
    },
    optimize: {
      needsTwoPositions: "Die Optimierung braucht mindestens 2 Positionen.",
      cta: "Portfolio optimieren",
      expectedReturn: "Erwartete Rendite (p.a.)",
      volatility: "Volatilität (p.a.)",
      sharpeRatio: "Sharpe Ratio",
      suggestedWeights: "Vorgeschlagene Gewichtung",
      positionCol: "Position",
      currentCol: "Aktuell",
      modelCol: "Modell",
      germanOnlyNotice:
        "Der Disclaimer unten liegt aktuell nur auf Deutsch vor; eine englische Version ist für ein späteres Update geplant.",
    },
  },
  positionNews: {
    summary: "Aktuelle Nachrichten",
    none: "Keine aktuellen Meldungen.",
    coverageFor: (ticker: string) => `Aktuelle Berichterstattung zu ${ticker}:`,
  },
  reportDownload: {
    creating: "Report wird erstellt…",
    download: "Als PDF-Report herunterladen",
  },
};

// KEIN `as const`: das würde `Dictionary` auf die exakten deutschen
// String-Literale festnageln (typeof mit as const erzeugt Literaltypen),
// wodurch `en.ts` gezwungen wäre, denselben Wortlaut zu verwenden. Ohne
// `as const` weiten sich Strings/Arrays zu `string`/`T[]` — `Dictionary`
// beschreibt so nur noch die FORM (Keys + Werttypen + Funktionssignaturen),
// die `en.ts` per `const en: Dictionary = {...}` erfüllen muss.
export default de;
export type Dictionary = typeof de;
