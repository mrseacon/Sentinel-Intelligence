/**
 * English dictionary — UI chrome text only (I18N_DECISIONS.md §0/§5).
 * Must match `de.ts`'s shape exactly; `const en: Dictionary` enforces
 * that at compile time (missing/extra keys or wrong value types fail
 * `npm run build`).
 */
import type { Dictionary } from "./de";

const en: Dictionary = {
  meta: {
    description:
      "Paper trading with a risk traffic light: from your first play-money trade to a portfolio you understand.",
  },
  nav: {
    depot: "Portfolio",
    ampel: "Risk Light",
    stress: "Stress Test",
    simulation: "Simulation",
  },
  disclaimer: {
    intro:
      "Sentinel describes portfolio properties (e.g. concentration risk, volatility) based on past prices. This is ",
    strong: "not investment advice",
    tail: " and not a recommendation for any individual security. Prices are delayed by up to 15 minutes.",
  },
  common: {
    loading: "Loading…",
    retry: "Retry",
    whatDoesThisMean: "What does this mean?",
    goToDepot: "Go to portfolio",
    notAvailable: "not available",
  },
  languageSwitcher: {
    switchToGerman: "Zu Deutsch wechseln",
    switchToEnglish: "Switch to English",
  },
  landing: {
    nav: {
      how: "How it works",
      ampel: "Risk light",
      crises: "Crisis comparison",
      methodology: "Methodology",
      ctaShort: "Start",
    },
    ctaStart: "Start for free",
    hero: {
      eyebrow: "Every number comes with an explanation",
      title: "Understand, don't guess.",
      body: "Sentinel doesn't just show you a risk number — it explains in one sentence where it comes from: which position weighs too much, where diversification is missing, how much your prices have historically swung.",
      ctaHint: "With virtual capital. No sign-up required.",
    },
    how: {
      eyebrow: "How it works",
      title: "From your first trade to an understood portfolio in four steps",
      body: "No course, no video. You learn on your own portfolio, and every result explains itself.",
      steps: [
        {
          number: "01",
          title: "Open a portfolio with play money",
          body: "You start with €10,000 in virtual capital. No account, no deposit, no risk.",
        },
        {
          number: "02",
          title: "Buy and sell at real prices",
          body: "Market data is real, but delayed by up to 15 minutes. Positions and history stay traceable at all times.",
        },
        {
          number: "03",
          title: "Read the risk traffic light",
          body: "Three lights describe your portfolio in words: concentration risk, diversification and volatility. Never as a buy recommendation.",
        },
        {
          number: "04",
          title: "Check it against crises and futures",
          body: "The stress test runs real historical crisis periods. The Monte Carlo simulation shows the range of possible paths.",
        },
      ],
    },
    ampel: {
      eyebrow: "Risk traffic light",
      title: "Three questions your portfolio has to answer",
      body: "The status is never just a color. There's always a symbol, a word and an explanation of what it means.",
      examples: [
        {
          status: "green" as const,
          title: "Diversification",
          icon: "✓",
          label: "Green",
          text: "Your capital is spread across several sectors. A weak sector won't hit you at full force.",
          lesson:
            "What does this mean? Diversification is no guarantee against losses. It makes sure not everything falls at once.",
        },
        {
          status: "yellow" as const,
          title: "Concentration risk",
          icon: "!",
          label: "Yellow",
          text: "Your largest position weighs 38 percent. Your portfolio mostly follows a single company.",
          lesson:
            "What does this mean? Concentration amplifies both directions, gains and losses. What matters is that you choose it deliberately.",
        },
        {
          status: "red" as const,
          title: "Volatility",
          icon: "✕",
          label: "Red",
          text: "The prices of your positions have historically swung strongly. Multi-percent daily moves are normal here.",
          lesson:
            "What does this mean? Volatility measures swings, not quality. The question is whether you can tolerate it without panic-selling.",
        },
      ],
    },
    crises: {
      eyebrow: "Historical comparison",
      title: "How would your portfolio have fared in 2008?",
      body: "Sentinel overlays your current portfolio onto three real crisis periods and computes with the actual daily returns of those months. No scenario is a forecast. It's a reminder of how far markets can fall.",
      footnote:
        "The bars show the relative depth and length of each phase. Past performance says nothing about the future. The comparison helps you gauge your own loss tolerance before real money is at stake.",
      examples: [
        {
          title: "Financial crisis",
          range: "Oct 2007 to Mar 2009",
          depth: 82,
          text: "A long, grinding decline over 17 months. The crisis that tests patience the most.",
        },
        {
          title: "Covid crash",
          range: "Feb to Mar 2020",
          depth: 58,
          text: "A very fast plunge over a few weeks, followed by an equally fast recovery.",
        },
        {
          title: "Rate-hike bear market",
          range: "Jan to Oct 2022",
          depth: 44,
          text: "A broad decline where even classic hedges offered little protection.",
        },
      ],
    },
    simulation: {
      eyebrow: "Future simulation",
      title: "A range, not a forecast",
      body: "The Monte Carlo simulation draws thousands of paths from your positions' real historical daily returns. The result is a corridor: how well it could go, how badly, and how wide the uncertainty is in between.",
      axis: { today: "today", y1: "1 year", y5: "5 years", y10: "10 years" },
      bands: {
        top: {
          label: "Top fifth",
          text: "Well above your stake. The case people like to remember.",
        },
        middle: {
          label: "Median path",
          text: "The path your expectations should be anchored to.",
        },
        bottom: {
          label: "Bottom fifth",
          text: "The case you need to be able to stomach without abandoning the strategy.",
        },
      },
    },
    methodology: {
      eyebrow: "Methodology and limits",
      title: "What Sentinel calculates and what it can't do",
      body: "Sentinel describes portfolio properties like concentration risk, diversification and volatility based on past prices. This is not investment advice and not a recommendation for any individual security.",
      cards: [
        {
          title: "Real market data, delayed",
          body: "Prices and returns come from real historical market data. They are delayed by up to 15 minutes.",
        },
        {
          title: "Traceable formulas",
          body: "The metrics are based on weighting, correlation and standard deviation. Every rule is openly documented.",
        },
        {
          title: "No recommendations",
          body: "Sentinel describes portfolio properties. It never tells you which security to buy or sell.",
        },
        {
          title: "No real money",
          body: "All trades are virtual. There is no account, no order sent to an exchange, and no fees.",
        },
      ],
    },
    start: {
      eyebrow: "Practice now",
      title: "Your first mistake shouldn't cost you anything.",
      body: "Start with virtual capital, watch your risk, and decide later with real money — informed this time.",
      ctaHint: "No sign-up, no payment details, no real money.",
    },
    heroDemo: {
      sectors: { tech: "Technology", energie: "Energy", anleihen: "Bonds" },
      reset: "Reset",
      concentrationLabel: "Concentration risk",
      liveHint: "That's exactly what you'll see live in your own portfolio.",
      textRed: (topName: string, top: number) =>
        `${topName} makes up ${top} percent. A single area determines almost your entire result.`,
      textYellow: (topName: string, top: number) =>
        `${topName} weighs in at ${top} percent, clearly heavier than the rest. Your portfolio mostly follows this area.`,
      textGreen: (top: number) =>
        `No area exceeds ${top} percent. The load is spread across all three areas.`,
      lessonRed:
        "At this concentration, the development of one sector decides your portfolio. Gains and losses turn out correspondingly large.",
      lessonYellow:
        "An overweight can be deliberate. What matters is knowing how much of your result it determines.",
      lessonGreen:
        "With a balanced spread, a weak area only drags the portfolio down proportionally. That doesn't protect against losses, but it does cushion them.",
      ariaValueText: (value: number) => `${value} percent`,
    },
    footer: {
      methodology: "Methodology",
      how: "How it works",
    },
  },
  depot: {
    title: "Your paper portfolio",
    subtitle: (startCash: string) =>
      `Starting capital ${startCash}. Prices are delayed by up to 15 minutes.`,
    firstTradeTitle: "Your first trade",
    firstTradeBody:
      "No positions yet. Try a first purchase to see how your portfolio and your risk change.",
    justTraded: "Trade executed. What does that mean for your risk?",
    goToAmpel: "Go to risk light",
    newTrade: "New trade",
    tradeDialog: "Trade dialog",
    stats: { value: "Portfolio value", cash: "Cash", totalPnl: "Total P&L" },
    table: {
      ticker: "Ticker",
      quantity: "Qty",
      avgBuyPrice: "Avg. buy price",
      price: "Price",
      value: "Value",
      pnl: "P&L",
      news: "News",
    },
  },
  tradeForm: {
    popularTickers: "Popular tickers",
    selectAria: (name: string) => `Select ${name}`,
    ticker: "Ticker",
    side: "Side",
    buy: "Buy",
    sell: "Sell",
    quantity: "Quantity (shares)",
    showPrice: "Show price",
    tickerFormatError:
      "Ticker may only contain uppercase letters, digits and . - ^ = (max. 15 characters).",
    quotePreview: (
      side: string,
      quantity: number,
      ticker: string,
      price: string,
      time: string,
    ) => `${side} of ${quantity}× ${ticker} at ${price} (price as of ${time})`,
    fee: (fee: string) => `Fee: ${fee}`,
    cashDelta: (delta: string) => `Cash change: ${delta}`,
    executing: "Executing…",
    confirmTrade: "Confirm trade",
  },
  ampel: {
    title: "Risk traffic light",
    subtitle:
      "Three lights based on your current portfolio positions: concentration risk, diversification and volatility.",
    emptyTitle: "No positions yet",
    emptyBody:
      "The risk light needs a portfolio with at least one position. Start on the portfolio page with your first trade.",
    statusLabels: { green: "Green", yellow: "Yellow", red: "Red" },
    stressLinkText: "How would your portfolio have fared in a past crisis?",
    stressLinkCta: "Go to stress test",
    correlation: {
      title: "Correlation of your positions",
      explanation:
        "Positions with high correlation move similarly, which weakens the diversification effect: losses then hit several positions at once instead of offsetting each other.",
      needsTwoPositions:
        "A correlation matrix needs at least 2 positions in your portfolio.",
      tableAriaLabel: "Correlation matrix of your portfolio positions",
      tableCaption:
        "Correlation of daily returns between each pair of positions, values from -1 (opposite) to +1 (in lockstep).",
    },
    germanOnlyNotice:
      "The detailed explanations below are currently German-only; an English version is planned for a later update.",
  },
  stress: {
    title: "Historical stress test",
    subtitle:
      "How would your portfolio have developed in a past crisis? Choose a scenario.",
    emptyTitle: "No positions yet",
    emptyBody:
      "The stress test needs a portfolio with at least one position. Start on the portfolio page with your first trade.",
    coverage: (pct: number) => `${pct}% of your portfolio simulated.`,
    excluded: (tickers: string) =>
      `Not included: ${tickers} (not yet tradable in this period).`,
    chartValueTooltip: "Portfolio value",
    trough: "Trough",
    stats: {
      maxDrawdown: "Maximum drawdown",
      totalReturn: "Return over the period",
      volatility: "Volatility over the period",
    },
    simulationLinkText: "Where could your portfolio go in the future?",
    simulationLinkCta: "Go to simulation",
    germanOnlyNotice:
      "The detailed explanation, lesson card and disclaimer below are currently German-only; an English version is planned for a later update.",
    monthsShort: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    to: "to",
  },
  simulation: {
    title: "Future simulation",
    subtitle: "Where could your portfolio go from here? Choose a time horizon.",
    emptyTitle: "No positions yet",
    emptyBody:
      "The simulation needs a portfolio with at least one position. Start on the portfolio page with your first trade.",
    horizon1Year: "1 year",
    horizonYears: (n: number) => `${n} years`,
    thinHistoryLabel: "Thin data basis:",
    thinHistoryBody: (
      years: string,
      limitClause: string,
      recyclingFactor: string,
    ) =>
      `Only ${years} years of price history${limitClause} available. It gets reused roughly ${recyclingFactor}× in the calculation: rare events like crashes may be entirely missing from it.`,
    limitedBy: (ticker: string) => ` (limited by ${ticker})`,
    bandTooltip: "80% of paths",
    medianTooltip: "median path",
    stats: {
      p10: "Lower percentile (10%)",
      p50: "Median path (50%)",
      p90: "Upper percentile (90%)",
    },
    germanOnlyNotice:
      "The detailed explanation, lesson card and disclaimer below are currently German-only; an English version is planned for a later update.",
    axisMonths: "mo.",
    axisYears: "yr.",
    afterMonth: (n: number) => `after ${n} ${n === 1 ? "month" : "months"}`,
    afterYear: (n: number) => `after ${n} ${n === 1 ? "year" : "years"}`,
  },
  analyze: {
    backToHome: "← Back to home",
    pageTitle: "Free portfolio analysis",
    independentNote: "This is an independent analysis, not connected to your paper portfolio.",
    sectionAnalyze: "Analysis",
    sectionBenchmark: "Compare with index",
    sectionOptimize: "Optimize",
    csvUpload: {
      title: "CSV upload",
      body: "Columns ticker and weight, any positive scale (e.g. euro amounts or share counts).",
      chooseFile: "Choose file",
      onlyCsv: "Only .csv files are supported.",
      tooLarge: (sizeMb: string, maxMb: number) =>
        `File is ${sizeMb} MB, maximum is ${maxMb} MB.`,
      uploading: "Uploading…",
      upload: "Upload",
    },
    manualEntry: {
      title: "Manual entry",
      countOf: (count: number, max: number) => `${count} of ${max}`,
      popularTickers: "Popular tickers",
      addAria: (name: string) => `Add ${name}`,
      tickerPlaceholder: "Ticker",
      amountPlaceholder: "Amount",
      removePosition: "Remove position",
      addPosition: "+ Add position",
      invalidTicker:
        "At least one ticker has an invalid format (uppercase letters, digits, . - ^ =, max. 15 characters).",
      invalidWeight: "Amounts must be positive numbers.",
      limitReached: (max: number) => `Maximum of ${max} positions reached.`,
      submit: "Analyze portfolio",
    },
    result: {
      riskScore: "Risk score",
      topDrivers: "Top drivers",
      volatility: "Volatility (annualized)",
      maxDrawdown: "Maximum drawdown",
      diversificationRatio: "Diversification ratio",
      var95: "VaR 95% (daily)",
      cvar95: "CVaR 95% (daily)",
      hhi: "HHI (concentration risk)",
      riskContributionPerPosition: "Risk share per position",
      labels: { Low: "Low", Moderate: "Moderate", High: "High", Severe: "Severe" },
    },
    benchmark: {
      yourPortfolio: "Your portfolio",
      riskScore: "Risk score",
      germanOnlyNotice:
        "The comparison text below is currently German-only; an English version is planned for a later update.",
    },
    optimize: {
      needsTwoPositions: "Optimization needs at least 2 positions.",
      cta: "Optimize portfolio",
      expectedReturn: "Expected return (annualized)",
      volatility: "Volatility (annualized)",
      sharpeRatio: "Sharpe ratio",
      suggestedWeights: "Suggested weighting",
      germanOnlyNotice:
        "The disclaimer below is currently German-only; an English version is planned for a later update.",
    },
  },
  positionNews: {
    summary: "Latest news",
    none: "No current headlines.",
    coverageFor: (ticker: string) => `Current coverage for ${ticker}:`,
  },
  reportDownload: {
    creating: "Generating report…",
    download: "Download as PDF report",
  },
};

export default en;
