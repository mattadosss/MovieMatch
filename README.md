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
- ein Supabase-Projekt
- ein TMDb **API Read Access Token** für die Edge Functions

## Installation

```bash
npm install
```

Für die mobile App `apps/mobile/.env.example` nach `apps/mobile/.env` kopieren
und die folgenden Werte setzen:

```dotenv
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
3. Im **SQL Editor** die Dateien aus `supabase/migrations` in zeitlicher
   Reihenfolge ausführen oder sie mit `supabase db push` anwenden. Die
   Migrationen erstellen die Verlaufstabelle einschließlich Streaming-Anbietern,
   aktivieren Row Level Security und erlauben angemeldeten Benutzern
   ausschließlich Zugriff auf ihre eigenen Datensätze.
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

### TMDb Edge Functions

Die Expo-App enthält keinen TMDb-Schlüssel und ruft TMDb nicht direkt auf.
Suche, Trends, Filmdetails, Genres, Empfehlungen und Streaming-Verfügbarkeit
laufen über Supabase Edge Functions. Der Token liegt ausschließlich als
Supabase Secret vor.

Einmalig anmelden, das Projekt verknüpfen und den TMDb **API Read Access Token**
als Secret setzen:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase secrets set TMDB_ACCESS_TOKEN=<your_tmdb_bearer_token>
```

Danach die Functions deployen:

```bash
npx supabase functions deploy search-movies
npx supabase functions deploy trending
npx supabase functions deploy movie-details
```

Die Functions akzeptieren sowohl eingeloggte Benutzer als auch den
Publishable-Key der App für den Gastmodus. `movie-details` erlaubt nur fest
definierte TMDb-Operationen und ist kein frei verwendbarer URL-Proxy.

Für lokale Function-Entwicklung kann der Token in einer nicht eingecheckten
Datei wie `supabase/functions/.env` stehen:

```dotenv
TMDB_ACCESS_TOKEN=your_tmdb_bearer_token
```

```bash
npx supabase functions serve --env-file supabase/functions/.env
```

### Offline-First-Synchronisierung

- Der Verlauf wird weiterhin zuerst lokal in AsyncStorage geschrieben. Die App
  bleibt ohne Konto und ohne Netzwerk vollständig benutzbar.
- Supabase-Sessions werden mit der von Expo SQLite bereitgestellten
  `localStorage`-Implementierung über App-Neustarts hinweg gespeichert.
- Bei Anmeldung, lokalen Änderungen und über **Jetzt synchronisieren** wird der
  Verlauf in beide Richtungen abgeglichen.
- Bevorzugte Schweizer Streaming-Anbieter werden ebenfalls lokal gespeichert
  und mit dem Benutzerkonto synchronisiert. Empfehlungen priorisieren Titel,
  die bei diesen Diensten im Abo, kostenlos oder werbefinanziert verfügbar sind.
  Gibt es keinen passenden Treffer, verwendet MovieMatch die normale Auswahl
  als Fallback.
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

### Next.js-Web-App

Die vollständige Web-App läuft unter `/app` und bietet denselben Kernablauf wie
Mobile: Gastmodus, Anmeldung, Netflix-CSV-Import, manuellen Import, Verlauf,
Empfehlungen, Streaming-Präferenzen und Supabase-Sync.

Für `apps/web/.env.local` beziehungsweise in den Vercel Environment Variables
werden diese öffentlichen Werte benötigt:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Auf Vercel müssen beide Variablen für Production gesetzt und das Projekt danach
neu deployed werden. Der TMDb-Token gehört weiterhin ausschließlich in das
Supabase Function Secret `TMDB_ACCESS_TOKEN`.

## Prüfung

```bash
npm run lint
npm run typecheck
npm run build
```
