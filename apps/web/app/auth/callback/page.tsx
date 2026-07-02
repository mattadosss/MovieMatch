"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import styles from "./callback.module.css";

type ConfirmationState = {
  status: "loading" | "success" | "error";
  message: string;
};

function subscribeToUrl(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function getConfirmationState(url: string): ConfirmationState {
  if (!url) return { status: "loading", message: "Deine E-Mail wird bestätigt …" };

  const callbackUrl = new URL(url);
  const hash = new URLSearchParams(callbackUrl.hash.slice(1));
  const query = callbackUrl.searchParams;
  const error = hash.get("error_description") ?? query.get("error_description");
  const errorCode = hash.get("error_code") ?? query.get("error_code");

  if (error) {
    return {
      status: "error",
      message: errorCode === "otp_expired"
        ? "Dieser Bestätigungslink ist abgelaufen. Fordere in der App eine neue E-Mail an."
        : error.replaceAll("+", " "),
    };
  }

  const hasConfirmationPayload =
    hash.has("access_token")
    || query.has("code")
    || query.has("token_hash");

  if (!hasConfirmationPayload) {
    return {
      status: "error",
      message: "Dieser Aufruf enthält keinen gültigen Bestätigungslink.",
    };
  }

  return {
    status: "success",
    message: "Deine E-Mail-Adresse wurde bestätigt. Du kannst dich jetzt in MovieMatch anmelden.",
  };
}

export default function AuthCallbackPage() {
  const url = useSyncExternalStore(
    subscribeToUrl,
    () => window.location.href,
    () => "",
  );
  const state = getConfirmationState(url);
  const callbackUrl = url ? new URL(url) : null;
  const appUrl = `moviematch://auth-callback${callbackUrl?.search ?? ""}${callbackUrl?.hash ?? ""}`;

  return (
    <main className={styles.page}>
      <Link className={styles.brand} href="/">MOVIEMATCH</Link>
      <section className={styles.card}>
        <div className={`${styles.icon} ${styles[state.status]}`} aria-hidden="true">
          {state.status === "loading" ? "…" : state.status === "success" ? "✓" : "!"}
        </div>
        <p className={styles.eyebrow}>KONTOBESTÄTIGUNG</p>
        <h1>
          {state.status === "error"
            ? "Link ungültig"
            : state.status === "success"
              ? "E-Mail bestätigt"
              : "Einen Moment"}
        </h1>
        <p className={styles.message}>{state.message}</p>
        {state.status !== "loading" && (
          <div className={styles.actions}>
            {state.status === "success" && (
              <a className={styles.primary} href={appUrl}>
                MovieMatch öffnen
              </a>
            )}
            <Link className={styles.secondary} href="/">Zur Website</Link>
          </div>
        )}
        {state.status === "success" && (
          <p className={styles.hint}>
            Falls sich die App nicht öffnet, kehre manuell zurück und melde dich dort an.
          </p>
        )}
      </section>
    </main>
  );
}
