"use client";

// QueryClientProvider muss eine Client-Komponente sein (React-Context
// funktioniert nicht in Server-Komponenten). Der QueryClient wird per
// useState EINMAL pro Browser-Sitzung erzeugt, nicht bei jedem Render
// und nicht serverseitig geteilt — offizielles Next.js-App-Router-Muster.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/lib/api";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Kurse sind ohnehin 15 min verzögert (ARCHITECTURE §1) —
            // häufigeres Neuladen könnte keine neueren Daten liefern
            // (FRONTEND_DECISIONS §1).
            staleTime: FIFTEEN_MINUTES_MS,
            // Nur bei Upstream-Ausfall erneut versuchen, genau einmal —
            // fachliche 422er erneut zu senden ist sinnlos.
            retry: (failureCount, error) =>
              failureCount < 1 &&
              error instanceof ApiError &&
              error.code === "UPSTREAM_UNAVAILABLE",
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
