# Review Tool v0

> Mini-UI zum Pruefen und Korrigieren der KI-Kategorisierung

## Quick Start

```bash
cd apps/review-tool
pnpm install
pnpm dev
# Open http://localhost:5174
```

## Features

- **Queue-Ansicht:** Filtere nach Status, Kategorie, Verdaechtige
- **Detail-Panel:** Zeige Vorschlaege, Confidence, Anhaenge
- **1-Klick Bestaetigung:** Approve wenn KI korrekt
- **Korrektur:** Dropdown fuer manuelle Kategorisierung
- **Attachment Preview:** PDF (1. Seite), Bilder als Thumbnail
- **Ampel-Status:** % Sonstiges in letzten 48h

## API Key

Der INTERNAL_API_KEY wird im Browser-LocalStorage gespeichert.
Nie an Dritte uebertragen - nur fuer lokalen Admin-Zugriff.

## Spaeter ins Frontend

Die Komponenten sind 1:1 uebertragbar:
- `src/components/StatsPanel.tsx`
- `src/components/ReviewQueue.tsx`
- `src/components/DetailPanel.tsx`
- `src/components/AttachmentPreview.tsx`
- `src/lib/api.ts`

## Smoke Test

```bash
./smoke-test.sh <INTERNAL_API_KEY>
```
