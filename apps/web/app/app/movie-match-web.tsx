"use client";
/* eslint-disable @next/next/no-img-element */

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { parseNetflixCsv } from "@/lib/csv";
import { getSupabase } from "@/lib/supabase";
import { loadHistory, loadProviderIds, saveHistory, saveProviderIds, syncHistory, syncProviders } from "@/lib/storage";
import { enrichMovie, getProviders, recommend, searchMovies } from "@/lib/tmdb";
import type { HistoryEntry, Movie, Provider, Recommendation } from "@/lib/types";
import styles from "./movie-match.module.css";

type Tab = "home" | "import" | "history" | "profile";

export default function MovieMatchWeb() {
  const [tab, setTab] = useState<Tab>("home");
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [providerIds, setProviderIds] = useState<number[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerQuery, setProviderQuery] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const visibleHistory = history.filter((entry) => !entry.deleted_at);
  const genreProfile = useMemo(() => {
    const counts = new Map<number, { id: number; name: string; count: number }>();
    for (const entry of visibleHistory) entry.genre_ids.forEach((id, index) => {
      const item = counts.get(id) ?? { id, name: entry.genre_names[index] ?? "Unbekannt", count: 0 };
      item.count += 1; counts.set(id, item);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [visibleHistory]);

  const runSync = useCallback(async (activeSession: Session) => {
    if (!activeSession?.user) return;
    setMessage("Synchronisiere …");
    const [entries, ids] = await Promise.all([
      syncHistory(activeSession.user),
      syncProviders(activeSession.user, loadProviderIds()),
    ]);
    setHistory(entries); setProviderIds(ids); setMessage("Alles synchronisiert.");
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      setHistory(loadHistory());
      setProviderIds(loadProviderIds());
    });
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) runSync(data.session).catch((error) => setMessage(error.message));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) runSync(next).catch((error) => setMessage(error.message));
    });
    return () => data.subscription.unsubscribe();
  }, [runSync]);

  useEffect(() => {
    if (tab !== "profile" || providers.length) return;
    getProviders().then(setProviders).catch((error) => setMessage(error.message));
  }, [providers.length, tab]);

  async function suggest(nextHistory = visibleHistory) {
    if (!genreProfile.length) { setTab("import"); setMessage("Importiere zuerst deinen Verlauf."); return; }
    setBusy(true); setMessage("");
    try {
      setRecommendation(await recommend(nextHistory, genreProfile.slice(0, 3).map((g) => g.id), providerIds));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Vorschlag fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  async function addEntry(entry: HistoryEntry) {
    const next = [entry, ...history.filter((item) => item.tmdb_id !== entry.tmdb_id)];
    saveHistory(next); setHistory(next);
    if (session?.user) await syncHistory(session.user).then(setHistory);
  }

  async function markSeen() {
    if (!recommendation) return;
    setBusy(true);
    try {
      const entry = await enrichMovie(recommendation, "marked_from_suggestion");
      const next = [entry, ...history.filter((item) => item.tmdb_id !== entry.tmdb_id)];
      saveHistory(next); setHistory(next);
      if (session?.user) await syncHistory(session.user).then(setHistory);
      setMessage("Gespeichert – nächster Film …");
      await suggest(next);
    } finally { setBusy(false); }
  }

  async function importCsv(file: File) {
    setBusy(true); setMessage("CSV wird gelesen …");
    try {
      const rows = parseNetflixCsv(await file.text());
      const imported: HistoryEntry[] = [];
      for (let index = 0; index < rows.length; index += 1) {
        setMessage(`Erkenne Titel ${index + 1} von ${rows.length} …`);
        const movies = await searchMovies(rows[index].title);
        if (movies[0]) {
          const entry = await enrichMovie(movies[0], "netflix_csv");
          entry.watch_date = new Date(rows[index].date).toISOString();
          imported.push(entry);
        }
      }
      const next = [...imported, ...history.filter((old) => !imported.some((item) => item.tmdb_id === old.tmdb_id))];
      saveHistory(next); setHistory(next);
      if (session?.user) await syncHistory(session.user).then(setHistory);
      setMessage(`${imported.length} Titel importiert.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { setResults(await searchMovies(search)); } catch (error) { setMessage(error instanceof Error ? error.message : "Suche fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  async function authenticate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const supabase = getSupabase();
    const result = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
    if (result.error) setMessage(result.error.message);
    else setMessage(authMode === "signup" && !result.data.session ? "Bitte bestätige deine E-Mail." : "Angemeldet.");
    setBusy(false);
  }

  function remove(id: string) {
    const now = new Date().toISOString();
    const next = history.map((entry) => entry.id === id ? { ...entry, deleted_at: now, updated_at: now } : entry);
    saveHistory(next); setHistory(next);
    if (session?.user) syncHistory(session.user).then(setHistory).catch((error) => setMessage(error.message));
  }

  function clearAllHistory() {
    if (!confirm("Gesamten Verlauf lokal und in Supabase löschen?")) return;
    const now = new Date().toISOString();
    const next = history.map((entry) => ({ ...entry, deleted_at: now, updated_at: now }));
    saveHistory(next); setHistory(next);
    if (session?.user) syncHistory(session.user).then(setHistory).catch((error) => setMessage(error.message));
  }

  function toggleProvider(id: number) {
    const next = providerIds.includes(id) ? providerIds.filter((item) => item !== id) : [...providerIds, id];
    saveProviderIds(next); localStorage.setItem("moviematch:web:providers:updated", new Date().toISOString());
    setProviderIds(next);
    if (session?.user) syncProviders(session.user, next).then(setProviderIds).catch((error) => setMessage(error.message));
  }

  const filteredProviders = providers.filter((p) => p.provider_name.toLowerCase().includes(providerQuery.toLowerCase()));

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">MOVIEMATCH</Link>
        <nav className={styles.nav}>
          {([["home", "Für dich"], ["import", "Import"], ["history", "Verlauf"], ["profile", "Profil"]] as [Tab, string][]).map(([id, label]) => (
            <button className={tab === id ? styles.active : ""} key={id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <p>{session?.user.email ?? "Gastmodus"}</p>
      </aside>
      <main className={styles.main}>
        {message && <div className={styles.notice}>{message}</div>}
        {tab === "home" && <section>
          <p className={styles.eyebrow}>DEIN NÄCHSTER FILM</p>
          <h1>Was schauen wir heute?</h1>
          <div className={styles.dashboard}>
            <article className={styles.card}>
              <div className={styles.cardHead}><h2>Dein Filmgeschmack</h2><span>{visibleHistory.length} Titel</span></div>
              {genreProfile.slice(0, 5).map((genre) => <div className={styles.genre} key={genre.id}>
                <span>{genre.name}</span><div><i style={{ width: `${genre.count / Math.max(genreProfile[0]?.count ?? 1, 1) * 100}%` }} /></div>
              </div>)}
              {!genreProfile.length && <p className={styles.muted}>Importiere deinen Netflix-Verlauf, um loszulegen.</p>}
              <button className={styles.primary} disabled={busy || !genreProfile.length} onClick={() => suggest()}>
                {busy ? "Suche …" : "Film vorschlagen"}
              </button>
            </article>
          </div>
        </section>}

        {tab === "import" && <section>
          <p className={styles.eyebrow}>DEINE DATEN</p><h1>Verlauf importieren</h1>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h2>Netflix CSV</h2><p className={styles.muted}>Bis zu 50 Einträge, lokal verarbeitet und optional synchronisiert.</p>
              <label className={styles.upload}>CSV-Datei auswählen<input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} /></label>
            </article>
            <article className={styles.card}>
              <h2>Film manuell hinzufügen</h2>
              <form onSubmit={submitSearch} className={styles.search}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filmtitel suchen" /><button>Suche</button></form>
              <div className={styles.results}>{results.map((movie) => <button key={movie.id} onClick={() => enrichMovie(movie, "manual").then(addEntry)}>
                {movie.poster_path && <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} alt="" />}<span>{movie.title}<small>★ {movie.vote_average.toFixed(1)}</small></span><b>＋</b>
              </button>)}</div>
            </article>
          </div>
        </section>}

        {tab === "history" && <section>
          <p className={styles.eyebrow}>BIBLIOTHEK</p><h1>Dein Verlauf</h1>
          <div className={styles.history}>{visibleHistory.map((entry) => <article key={entry.id}>
            {entry.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${entry.poster_path}`} alt="" /> : <div />}
            <span><h3>{entry.parsed_title}</h3><p>{entry.release_year} · {entry.genre_names.slice(0, 2).join(", ")}</p><small>{entry.watch_providers.slice(0, 2).map((p) => p.provider_name).join(", ")}</small></span>
            <button onClick={() => remove(entry.id)}>Löschen</button>
          </article>)}</div>
        </section>}

        {tab === "profile" && <section>
          <p className={styles.eyebrow}>KONTO & SYNC</p><h1>Dein Profil</h1>
          {!session ? <form className={styles.card} onSubmit={authenticate}>
            <h2>{authMode === "login" ? "Anmelden" : "Konto erstellen"}</h2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort" minLength={6} required />
            <button className={styles.primary} disabled={busy}>{authMode === "login" ? "Anmelden" : "Registrieren"}</button>
            <button type="button" className={styles.link} onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>Modus wechseln</button>
          </form> : <div className={styles.grid}>
            <article className={styles.card}><h2>{session.user.email}</h2><button className={styles.primary} onClick={() => runSync(session)}>Jetzt synchronisieren</button><button className={styles.link} onClick={() => getSupabase().auth.signOut()}>Abmelden</button></article>
            <article className={styles.card}><h2>Streaming-Anbieter</h2><input value={providerQuery} onChange={(e) => setProviderQuery(e.target.value)} placeholder="Anbieter suchen" />
              <div className={styles.providers}>{filteredProviders.slice(0, providerQuery ? 100 : 25).map((provider) => <button className={providerIds.includes(provider.provider_id) ? styles.selected : ""} key={provider.provider_id} onClick={() => toggleProvider(provider.provider_id)}>
                {provider.logo_path && <img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt="" />}<span>{provider.provider_name}</span>
              </button>)}</div><small className={styles.muted}>Streamingdaten von JustWatch · Schweiz</small>
            </article>
            <article className={styles.danger}><h2>Verlauf zurücksetzen</h2><button onClick={clearAllHistory}>Gesamten Verlauf löschen</button></article>
          </div>}
        </section>}
      </main>

      {recommendation && <div className={styles.modalBackdrop}><article className={styles.modal}>
        <button className={styles.close} onClick={() => setRecommendation(null)}>×</button>
        {recommendation.poster_path && <img className={styles.heroPoster} src={`https://image.tmdb.org/t/p/w500${recommendation.poster_path}`} alt="" />}
        <div><p className={styles.eyebrow}>DEIN MATCH</p><h2>{recommendation.title}</h2><p className={styles.muted}>{recommendation.release_date?.slice(0, 4)} · ★ {recommendation.vote_average.toFixed(1)}</p>
          <p>{recommendation.overview}</p><div className={styles.providerTags}>{recommendation.watch_providers.map((p) => <span key={`${p.provider_id}-${p.type}`}>{p.provider_name}</span>)}</div>
          <button className={styles.primary} disabled={busy} onClick={markSeen}>{busy ? "Speichere …" : "Als gesehen markieren"}</button>
          <button className={styles.secondary} disabled={busy} onClick={() => suggest()}>Anderen Film zeigen</button>
        </div>
      </article></div>}
    </div>
  );
}
