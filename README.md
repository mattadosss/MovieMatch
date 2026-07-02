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
und die folgenden Werte setzen:

```dotenv
EXPO_PUBLIC_TMDB_API_KEY=...
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_AUTH_REDIRECT_URL=https://moviematchweb.vercel.app/auth/callback
```

Expo stellt Client-Variablen nur mit dem Präfix `EXPO_PUBLIC_` bereit. Verwende
in der App niemals einen Supabase Secret Key oder Service-Role-Key.

## Supabase einrichten

1. Im Supabase-Dashboard ein Projekt erstellen.
2. Unter **Project Settings → API** die Project URL und den Publishable Key
   kopieren und in `apps/mobile/.env` eintragen.
3. Im **SQL Editor** den Inhalt von
   `supabase/migrations/202607020001_create_watch_history_entries.sql`
   ausführen. Die Migration erstellt die Verlaufstabelle, aktiviert Row Level
   Security und erlaubt angemeldeten Benutzern ausschließlich Zugriff auf ihre
   eigenen Datensätze.
4. Unter **Authentication → Providers → Email** E-Mail/Passwort aktivieren.
   Falls **Confirm email** aktiv ist, muss ein neues Konto vor der ersten
   Anmeldung über die empfangene E-Mail bestätigt werden.
5. Unter **Authentication → URL Configuration** konfigurieren:

   ```text
   Site URL: https://moviematchweb.vercel.app
   Redirect URL: https://moviematchweb.vercel.app/auth/callback
   ```

   Damit landen Bestätigungslinks immer auf einer öffentlich erreichbaren
   Next.js-Seite. Diese zeigt Erfolg oder Fehler verständlich an und bietet für
   installierte App-Builds zusätzlich einen `moviematch://`-Link zurück zur App.
   Falls ein angepasstes Supabase-E-Mail-Template verwendet wird, muss dessen
   Link `{{ .RedirectTo }}` statt `{{ .SiteURL }}` verwenden.
6. Den Expo-Dev-Server nach Änderungen an `.env` neu starten.

### Offline-First-Synchronisierung

- Der Verlauf wird weiterhin zuerst lokal in AsyncStorage geschrieben. Die App
  bleibt ohne Konto und ohne Netzwerk vollständig benutzbar.
- Supabase-Sessions werden mit der von Expo SQLite bereitgestellten
  `localStorage`-Implementierung über App-Neustarts hinweg gespeichert.
- Bei Anmeldung, lokalen Änderungen und über **Jetzt synchronisieren** wird der
  Verlauf in beide Richtungen abgeglichen.
- Haben Lokal- und Cloud-Version dieselbe ID, gewinnt der neuere
  `updated_at`-Zeitstempel.
- Löschungen werden als `deleted_at`-Tombstone synchronisiert, damit offline
  gelöschte Einträge nicht von einem anderen Gerät wiederhergestellt werden.
- Bereits vorhandene lokale Gastdaten werden bei der ersten Synchronisierung
  dem angemeldeten Benutzer zugeordnet.

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
