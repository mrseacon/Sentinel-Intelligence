// Wiederverwendeter Lade-Platzhalter (FRONTEND_DECISIONS.md §3): jede
// 🐢-View rendert ihr Layout sofort und füllt Datenkacheln hiermit statt
// eines globalen Ladebalkens.
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Lädt…"
      className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`}
    />
  );
}
