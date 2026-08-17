# Marken-Schriften für das OG-Bild

Statische TTF-Schnitte für `lib/og-image.tsx` (`ImageResponse`/Satori
unterstützt kein `next/font/google`-Ergebnis: nur woff2, gesplittet in
Unicode-Ranges — siehe Kommentar dort). Einmalig von den offiziellen
Google-Fonts-Auslieferungsservern heruntergeladen und hier committed,
damit `npm run build` ohne Netzwerkzugriff läuft.

| Datei | Familie | Schnitt | Verwendung |
|---|---|---|---|
| `Newsreader-Display-Regular.ttf` | Newsreader | Regular, optical size 60pt | Wortmarke "Sentinel." (Headline-Font der App) |
| `IBMPlexSans-Regular.ttf` | IBM Plex Sans | Regular | Claim/Fließtext |
| `IBMPlexSans-Medium.ttf` | IBM Plex Sans | Medium | reserviert für Betonungen |
| `IBMPlexMono-Regular.ttf` | IBM Plex Mono | Regular | Kicker-Zeile |
| `IBMPlexMono-Medium.ttf` | IBM Plex Mono | Medium | Kennzahlen im Fakten-Streifen |

Bezogen über `https://fonts.google.com/download/list?family=...`
(offizieller Google-Fonts-Download-Endpunkt, liefert eine JSON-Manifest
mit direkten `fonts.gstatic.com`-URLs zu den statischen Schnitten jeder
Variable-Font-Familie). Lizenz: SIL Open Font License 1.1, Volltext je
Familie in `OFL-*.txt` daneben — Pflicht laut OFL bei Weitergabe.

Dieselben Familien sind zusätzlich via `next/font/google` in
`app/[lang]/layout.tsx` eingebunden (dort für die eigentliche App-UI,
selbstgehostet/optimiert durch Next.js). Diese Kopien hier sind
ausschließlich für die Build-Zeit-Bildgenerierung in `lib/og-image.tsx`
gedacht, nicht für die Laufzeit-UI.
