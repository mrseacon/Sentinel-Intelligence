"use client";

// Freundlicher Hinweis bei langsamen Anfragen: Auf dem Free-Tier schläft das
// Backend ein und braucht beim ersten Aufruf bis zu eine Minute (README,
// "Bekannte Einschränkungen"). Ohne Hinweis wirkt die App in dieser Zeit
// kaputt. Eine EINZIGE globale Komponente statt Logik in jeder View:
// `useIsFetching`/`useIsMutating` zählen alle laufenden TanStack-Query-
// Anfragen, egal von welcher Seite sie kommen.
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";

export const SLOW_REQUEST_THRESHOLD_MS = 8_000;

function useIsBusyLongerThan(thresholdMs: number): boolean {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [slow, setSlow] = useState(false);

  // Der Timer läuft nur, solange etwas lädt. Das Zurücksetzen passiert in
  // der Cleanup-Funktion (wird beim Ende des Ladens bzw. Unmount aufgerufen),
  // damit `slow` nie "hängen bleibt" und kein setState direkt im Effekt-Body
  // nötig ist.
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), thresholdMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [busy, thresholdMs]);

  return busy && slow;
}

export function SlowRequestNotice() {
  const { dict } = useI18n();
  const show = useIsBusyLongerThan(SLOW_REQUEST_THRESHOLD_MS);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-md border border-border-strong bg-surface px-4 py-3 text-sm text-ink shadow-lg"
    >
      {dict.common.slowRequest}
    </div>
  );
}
