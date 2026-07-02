# MovieMatch

MovieMatch ist ein npm-Workspaces-Monorepo mit einer Expo-App für iOS/Android und
einer Next.js-Web-App.

## Struktur

```text
apps/
  mobile/  Expo SDK 54 + Expo Router
  web/     Next.js 16
packages/  Platz für künftig gemeinsam genutzte Pakete
```

## Voraussetzungen

- Node.js 20.19 oder neuer
- npm 11 oder neuer
- ein TMDb API-v3-Schlüssel für die mobile App

## Installation

```bash
npm install
```

Für die mobile App `apps/mobile/.env.example` nach `apps/mobile/.env` kopieren
und `EXPO_PUBLIC_TMDB_API_KEY` setzen.

## Entwicklung

```bash
npm run dev          # Next.js-Web-App
npm run dev:mobile   # Expo Dev Server
npm run android      # Expo auf Android
npm run ios          # Expo auf iOS
npm run expo:web     # optionale Expo-Web-Ausgabe
```

## Prüfung

```bash
npm run lint
npm run typecheck
npm run build
```
