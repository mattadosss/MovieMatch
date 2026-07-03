"use client";
/* eslint-disable @next/next/no-img-element */

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseNetflixCsv } from "@/lib/csv";
import { getSupabase } from "@/lib/supabase";
import {
  loadHistory,
  loadProviderIds,
  loadWatchlist,
  recommendationToWatchlist,
  saveHistory,
  saveProviderIds,
  saveWatchlist,
  syncHistory,
  syncProviders,
  syncWatchlist,
} from "@/lib/storage";
import {
  enrichMovie,
  getGenres,
  getProviders,
  recommend,
  recommendRewatch,
  recommendSimilar,
  searchMovies,
} from "@/lib/tmdb";
import type { HistoryEntry, Movie, Provider, Recommendation, RecommendationMode, WatchlistEntry } from "@/lib/types";
import styles from "./movie-match.module.css";

type Tab = "home" | "import" | "history" | "watchlist" | "profile";
type ModePanel = "similar" | "genres" | "together" | null;

export default function MovieMatchWeb() {
  const [tab, setTab] = useState<Tab>("home");
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [providerIds, setProviderIds] = useState<number[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [providerQuery, setProviderQuery] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [prefetchedRecommendation, setPrefetchedRecommendation] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [modePanel, setModePanel] = useState<ModePanel>(null);
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>({ type: "profile" });
  const [modeQuery, setModeQuery] = useState("");
  const [modeResults, setModeResults] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [partnerUsername, setPartnerUsername] = useState("");
  const shownMovieIds = useRef(new Set<number>());

  const visibleHistory = useMemo(() => history.filter((entry) => !entry.deleted_at), [history]);
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
    const [entries, ids, saved] = await Promise.all([
      syncHistory(activeSession.user),
      syncProviders(activeSession.user, loadProviderIds()),
      syncWatchlist(activeSession.user),
    ]);
    setHistory(entries); setProviderIds(ids); setWatchlist(saved); setMessage("Alles synchronisiert.");
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      setHistory(loadHistory());
      setProviderIds(loadProviderIds());
      setWatchlist(loadWatchlist());
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
    if (!session?.user.email) return;
    const user = session.user;
    async function loadProfile() {
      try {
        const { data, error } = await getSupabase().from("profiles")
          .upsert({ user_id: user.id, email: user.email! }, { onConflict: "user_id" })
          .select("username").single();
        if (error) throw error;
        const value = data.username ?? "";
        setUsername(value); setUsernameInput(value);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Profil konnte nicht geladen werden.");
      }
    }
    void loadProfile();
  }, [session]);

  useEffect(() => {
    if (tab !== "profile" || providers.length) return;
    getProviders().then(setProviders).catch((error) => setMessage(error.message));
  }, [providers.length, tab]);

  const fetchRecommendation = useCallback(async (
    nextHistory: HistoryEntry[],
    mode: RecommendationMode,
    excludeMovieId?: number,
  ) => {
    const now = new Date().toISOString();
    const excludedEntries: HistoryEntry[] = [...shownMovieIds.current].map((id) => ({
      id: `shown-${id}`, raw_title: "", parsed_title: "", watch_date: now,
      tmdb_id: id, media_type: "movie", genre_ids: [], genre_names: [], runtime_minutes: null,
      vote_average: null, release_year: null, poster_path: null, watch_providers: [],
      watch_provider_link: null, match_status: "matched", source: "manual",
      created_at: now, updated_at: now, deleted_at: null,
    }));
    if (mode.type === "similar") {
      return recommendSimilar(mode.movieId, [...nextHistory, ...excludedEntries], providerIds);
    }
    if (mode.type === "rewatch") {
      const remaining = nextHistory.filter((entry) =>
        entry.tmdb_id == null || !shownMovieIds.current.has(entry.tmdb_id));
      return recommendRewatch(remaining, excludeMovieId, providerIds);
    }
    const partnerEntries: HistoryEntry[] = mode.type === "together"
      ? mode.partnerMovieIds.map((id) => ({
        id: `partner-${id}`, raw_title: "", parsed_title: "", watch_date: now,
        tmdb_id: id, media_type: "movie", genre_ids: [], genre_names: [], runtime_minutes: null,
        vote_average: null, release_year: null, poster_path: null, watch_providers: [],
        watch_provider_link: null, match_status: "matched", source: "manual",
        created_at: now, updated_at: now, deleted_at: null,
      }))
      : [];
    const genreIds = mode.type === "genres"
      ? mode.genreIds
      : genreProfile.slice(0, 3).map((genre) => genre.id);
    return recommend([...nextHistory, ...excludedEntries, ...partnerEntries], genreIds, providerIds);
  }, [genreProfile, providerIds]);

  async function suggest(nextHistory = visibleHistory, mode = recommendationMode) {
    if (!genreProfile.length && mode.type !== "genres") {
      setTab("import"); setMessage("Importiere zuerst deinen Verlauf."); return;
    }
    setBusy(true); setMessage("");
    setPrefetchedRecommendation(null);
    try {
      setRecommendation(await fetchRecommendation(nextHistory, mode, recommendation?.id));
      setRecommendationMode(mode);
      setModePanel(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Vorschlag fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!recommendation) return;
    shownMovieIds.current.add(recommendation.id);
    const now = new Date().toISOString();
    const currentEntry: HistoryEntry = {
      id: `prefetch-${recommendation.id}`, raw_title: recommendation.title,
      parsed_title: recommendation.title, watch_date: now, tmdb_id: recommendation.id,
      media_type: "movie", genre_ids: recommendation.genre_ids, genre_names: recommendation.genre_names,
      runtime_minutes: recommendation.runtime_minutes, vote_average: recommendation.vote_average,
      release_year: recommendation.release_date ? Number(recommendation.release_date.slice(0, 4)) : null,
      poster_path: recommendation.poster_path, watch_providers: recommendation.watch_providers,
      watch_provider_link: recommendation.watch_provider_link, match_status: "matched",
      source: "marked_from_suggestion", created_at: now, updated_at: now, deleted_at: null,
    };
    let cancelled = false;
    fetchRecommendation([currentEntry, ...visibleHistory], recommendationMode, recommendation.id)
      .then((next) => { if (!cancelled) setPrefetchedRecommendation(next); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [fetchRecommendation, recommendation, recommendationMode, visibleHistory]);

  useEffect(() => {
    if (modePanel !== "similar" || modeQuery.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      searchMovies(modeQuery).then(setModeResults).catch((error) => setMessage(error.message));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [modePanel, modeQuery]);

  async function openGenreMode() {
    setModePanel("genres");
    if (!genres.length) {
      setBusy(true);
      try { setGenres((await getGenres()).genres); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Genres konnten nicht geladen werden."); }
      finally { setBusy(false); }
    }
  }

  async function suggestTogether() {
    if (!session) { setTab("profile"); setMessage("Melde dich für gemeinsame Vorschläge an."); return; }
    if (!username) { setTab("profile"); setMessage("Lege zuerst deinen Benutzernamen fest."); return; }
    setBusy(true); setMessage("");
    const { data, error } = await getSupabase().rpc("get_partner_watch_history", {
      partner_username: partnerUsername.trim().toLowerCase(),
    });
    if (error) {
      setMessage(error.message.replace(/^.*?:\s*/, ""));
      setBusy(false);
      return;
    }
    const partner = (data as { username: string; watched_tmdb_ids: number[] }[] | null)?.[0];
    if (!partner) {
      setMessage("Benutzername nicht gefunden.");
      setBusy(false);
      return;
    }
    setBusy(false);
    await suggest(visibleHistory, {
      type: "together",
      partnerUsername: partner.username,
      partnerMovieIds: partner.watched_tmdb_ids,
    });
  }

  async function addEntry(entry: HistoryEntry) {
    const next = [entry, ...history.filter((item) => item.tmdb_id !== entry.tmdb_id)];
    saveHistory(next); setHistory(next);
    if (session?.user) await syncHistory(session.user).then(setHistory);
  }

  async function markSeen() {
    if (!recommendation) return;
    const previousRecommendation = recommendation;
    const optimisticNext = prefetchedRecommendation;
    setBusy(true);
    setMessage("Wird gespeichert …");
    if (optimisticNext) {
      setPrefetchedRecommendation(null);
      setRecommendation(optimisticNext);
    }
    try {
      const entry = await enrichMovie(previousRecommendation, "marked_from_suggestion");
      const next = [entry, ...history.filter((item) => item.tmdb_id !== entry.tmdb_id)];
      saveHistory(next); setHistory(next);
      if (session?.user) await syncHistory(session.user).then(setHistory);
      if (watchlist.some((item) => item.tmdb_id === previousRecommendation.id)) {
        await toggleWatchlist(previousRecommendation);
      }
      setMessage("Im Verlauf gespeichert.");
      if (!optimisticNext) {
        try {
          setRecommendation(await fetchRecommendation(next, recommendationMode, previousRecommendation.id));
        } catch {
          setRecommendation(null);
        }
      }
    } catch (error) {
      if (optimisticNext) setRecommendation(previousRecommendation);
      setMessage(error instanceof Error ? error.message : "Der Film konnte nicht gespeichert werden.");
    } finally { setBusy(false); }
  }

  async function showAnother() {
    if (prefetchedRecommendation) {
      const next = prefetchedRecommendation;
      setPrefetchedRecommendation(null);
      setRecommendation(next);
      return;
    }
    setBusy(true); setMessage("");
    try {
      setRecommendation(await fetchRecommendation(visibleHistory, recommendationMode, recommendation?.id));
    } catch {
      setRecommendation(null);
    } finally {
      setBusy(false);
    }
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
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
        email: email.trim(), password,
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

  async function toggleWatchlist(movie: Recommendation) {
    const existing = watchlist.find((entry) => entry.tmdb_id === movie.id);
    let next: WatchlistEntry[];
    if (existing) {
      const now = new Date().toISOString();
      next = [
        ...watchlist.filter((entry) => entry.tmdb_id !== movie.id),
        { ...existing, deleted_at: now, updated_at: now },
      ];
    } else {
      next = [...watchlist, recommendationToWatchlist(movie)];
    }
    saveWatchlist(next);
    setWatchlist(next.filter((entry) => !entry.deleted_at));
    if (session?.user) {
      try { setWatchlist(await syncWatchlist(session.user)); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Watchlist-Sync fehlgeschlagen."); }
    }
  }

  function openWatchlistEntry(entry: WatchlistEntry) {
    setPrefetchedRecommendation(null);
    setRecommendation({
      id: entry.tmdb_id,
      title: entry.title,
      overview: entry.overview,
      genre_ids: entry.genre_ids,
      genre_names: entry.genre_names,
      runtime_minutes: entry.runtime_minutes,
      vote_average: entry.vote_average,
      release_date: entry.release_year ? `${entry.release_year}` : undefined,
      poster_path: entry.poster_path,
      watch_providers: entry.watch_providers,
      watch_provider_link: entry.watch_provider_link,
    });
    setRecommendationMode({ type: "profile" });
  }

  async function saveUsername() {
    if (!session?.user) return;
    const value = usernameInput.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(value)) {
      setMessage("Der Benutzername braucht 3–24 Buchstaben, Zahlen oder Unterstriche.");
      return;
    }
    const { error } = await getSupabase().from("profiles")
      .update({ username: value, updated_at: new Date().toISOString() })
      .eq("user_id", session.user.id);
    if (error?.code === "23505") setMessage("Dieser Benutzername ist bereits vergeben.");
    else if (error) setMessage(error.message);
    else { setUsername(value); setMessage("Benutzername gespeichert."); }
  }

  const filteredProviders = providers.filter((p) => p.provider_name.toLowerCase().includes(providerQuery.toLowerCase()));
  const filteredHistory = visibleHistory.filter((entry) => {
    const needle = historyQuery.trim().toLowerCase();
    return !needle
      || entry.parsed_title.toLowerCase().includes(needle)
      || entry.genre_names.some((genre) => genre.toLowerCase().includes(needle));
  });

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">MOVIEMATCH</Link>
        <nav className={styles.nav}>
          {([["home", "Für dich"], ["import", "Import"], ["history", "Verlauf"], ["watchlist", "Watchlist"], ["profile", "Profil"]] as [Tab, string][]).map(([id, label]) => (
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
          <div className={styles.modes}>
            <button onClick={() => setModePanel("similar")}><b>Ähnlicher Film</b><span>Ausgehend von einem Lieblingstitel</span></button>
            <button onClick={openGenreMode}><b>Genre selbst wählen</b><span>Passend zu deiner Stimmung</span></button>
            <button onClick={() => setModePanel("together")}><b>Zusammen schauen</b><span>Ein Film, den ihr beide noch nicht kennt</span></button>
            <button disabled={busy} onClick={() => suggest(visibleHistory, { type: "rewatch" })}><b>Lange nicht gesehen</b><span>Einen früheren Film wiederentdecken</span></button>
          </div>
          {modePanel && <article className={`${styles.card} ${styles.modePanel}`}>
            <button className={styles.panelClose} onClick={() => setModePanel(null)}>×</button>
            {modePanel === "similar" && <>
              <h2>Ähnlichen Film finden</h2>
              <input value={modeQuery} onChange={(event) => { setModeQuery(event.target.value); if (event.target.value.trim().length < 2) setModeResults([]); }} placeholder="Lieblingstitel suchen …" autoFocus />
              <div className={styles.results}>{modeResults.map((movie) => <button key={movie.id} disabled={busy} onClick={() => suggest(visibleHistory, { type: "similar", movieId: movie.id })}>
                {movie.poster_path && <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} alt="" />}
                <span>{movie.title}<small>★ {movie.vote_average.toFixed(1)}</small></span><b>›</b>
              </button>)}</div>
            </>}
            {modePanel === "genres" && <>
              <h2>Worauf hast du Lust?</h2>
              <div className={styles.genreChips}>{genres.map((genre) => <button key={genre.id} className={selectedGenres.includes(genre.id) ? styles.selected : ""} onClick={() => setSelectedGenres((current) => current.includes(genre.id) ? current.filter((id) => id !== genre.id) : [...current, genre.id])}>{genre.name}</button>)}</div>
              <button className={styles.primary} disabled={busy || !selectedGenres.length} onClick={() => suggest(visibleHistory, { type: "genres", genreIds: selectedGenres })}>Film finden</button>
            </>}
            {modePanel === "together" && <>
              <h2>Zusammen schauen</h2>
              <p className={styles.muted}>Gib den Benutzernamen der anderen Person ein.</p>
              <input value={partnerUsername} onChange={(event) => setPartnerUsername(event.target.value)} placeholder="Benutzername" />
              <button className={styles.primary} disabled={busy || !partnerUsername.trim()} onClick={suggestTogether}>Gemeinsamen Film finden</button>
            </>}
          </article>}
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
          <input className={styles.filterInput} value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Titel oder Genre suchen" />
          <div className={styles.history}>{filteredHistory.map((entry) => <article key={entry.id}>
            {entry.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${entry.poster_path}`} alt="" /> : <div />}
            <span><h3>{entry.parsed_title}</h3><p>{entry.release_year} · {entry.genre_names.slice(0, 2).join(", ")}</p><small>{entry.watch_providers.slice(0, 2).map((p) => p.provider_name).join(", ")}</small></span>
            <button onClick={() => remove(entry.id)}>Löschen</button>
          </article>)}</div>
        </section>}

        {tab === "watchlist" && <section>
          <p className={styles.eyebrow}>SPÄTER ANSEHEN</p><h1>Deine Watchlist</h1>
          {!watchlist.length && <article className={styles.card}><p className={styles.muted}>Speichere Filmvorschläge, die du später ansehen möchtest.</p></article>}
          <div className={styles.history}>{watchlist.map((entry) => <article key={entry.id} onClick={() => openWatchlistEntry(entry)}>
            {entry.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${entry.poster_path}`} alt="" /> : <div />}
            <span><h3>{entry.title}</h3><p>{entry.release_year} · {entry.genre_names.slice(0, 2).join(", ")}</p><small>{entry.watch_providers.slice(0, 2).map((provider) => provider.provider_name).join(", ")}</small></span>
            <button onClick={(event) => { event.stopPropagation(); toggleWatchlist({ ...entry, id: entry.tmdb_id }); }}>Entfernen</button>
          </article>)}</div>
        </section>}

        {tab === "profile" && <section>
          <p className={styles.eyebrow}>KONTO & SYNC</p><h1>Dein Profil</h1>
          {!session ? <form className={styles.card} onSubmit={authenticate}>
            <h2>{authMode === "login" ? "Anmelden" : "Konto erstellen"}</h2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort" minLength={6} required />
            <button className={styles.primary} disabled={busy}>{authMode === "login" ? "Anmelden" : "Registrieren"}</button>
            <button type="button" className={styles.link} onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setMessage(""); }}>Modus wechseln</button>
          </form> : <div className={styles.grid}>
            <article className={styles.card}><h2>{session.user.email}</h2><button className={styles.primary} onClick={() => runSync(session)}>Jetzt synchronisieren</button><button className={styles.link} onClick={() => getSupabase().auth.signOut()}>Abmelden</button></article>
            <article className={styles.card}><h2>Dein Benutzername</h2><p className={styles.muted}>Andere finden dich damit für gemeinsame Vorschläge.</p><input value={usernameInput} maxLength={24} onChange={(event) => setUsernameInput(event.target.value)} placeholder="z. B. movie_fan" /><button className={styles.primary} disabled={usernameInput.trim().toLowerCase() === username} onClick={saveUsername}>{username ? "Benutzername ändern" : "Benutzername festlegen"}</button></article>
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
        <button className={styles.close} onClick={() => { setRecommendation(null); setPrefetchedRecommendation(null); }}>×</button>
        {recommendation.poster_path && <img className={styles.heroPoster} src={`https://image.tmdb.org/t/p/w500${recommendation.poster_path}`} alt="" />}
        <div><p className={styles.eyebrow}>{recommendationMode.type === "together" ? `MATCH FÜR DICH & @${recommendationMode.partnerUsername}` : "DEIN MATCH"}</p><h2>{recommendation.title}</h2><p className={styles.muted}>{recommendation.release_date?.slice(0, 4)} · ★ {recommendation.vote_average.toFixed(1)}</p>
          <p>{recommendation.overview}</p><div className={styles.providerTags}>{recommendation.watch_providers.map((p) => <span key={`${p.provider_id}-${p.type}`}>{p.provider_name}</span>)}</div>
          <button className={styles.primary} disabled={busy} onClick={markSeen}>{busy ? "Speichere …" : "Als gesehen markieren"}</button>
          <button className={styles.secondary} disabled={busy} onClick={() => toggleWatchlist(recommendation)}>{watchlist.some((entry) => entry.tmdb_id === recommendation.id) ? "Aus Watchlist entfernen" : "Zur Watchlist hinzufügen"}</button>
          <button className={styles.secondary} disabled={busy} onClick={showAnother}>Anderen Film zeigen</button>
        </div>
      </article></div>}
    </div>
  );
}
