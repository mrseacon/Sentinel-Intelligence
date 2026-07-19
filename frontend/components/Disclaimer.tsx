// Fester Disclaimer-Text (Designprinzip 3, ARCHITECTURE.md §1: "Disclaimer
// fest in der UI"). Reine Server-Komponente, keine Interaktivität nötig.
export function Disclaimer() {
  return (
    <p className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
      Sentinel beschreibt Portfolioeigenschaften (z.&nbsp;B. Klumpenrisiko,
      Volatilität) auf Basis vergangener Kurse. Das ist{" "}
      <strong>keine Anlageberatung</strong> und keine Empfehlung für
      einzelne Wertpapiere. Kurse sind bis zu 15 Minuten verzögert.
    </p>
  );
}
