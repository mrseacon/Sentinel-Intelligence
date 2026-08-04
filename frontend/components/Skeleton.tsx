"use client";

// Wiederverwendeter Lade-Platzhalter (FRONTEND_DECISIONS.md §3): jede
// 🐢-View rendert ihr Layout sofort und füllt Datenkacheln hiermit statt
// eines globalen Ladebalkens. Braucht useI18n() für das aria-label ->
// Client-Komponente (war zuvor rein serverseitig, da der Text hartkodiert war).
import { useI18n } from "@/lib/i18n/I18nProvider";

export function Skeleton({ className = "" }: { className?: string }) {
  const { dict } = useI18n();

  return (
    <div
      role="status"
      aria-label={dict.common.loading}
      className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`}
    />
  );
}
