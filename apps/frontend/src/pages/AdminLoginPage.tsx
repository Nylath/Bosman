import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router";

import {
  ApiError,
  getAdminSession,
  loginAdmin,
} from "../api";

function ArrowLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      className="nautical-back-link__icon"
      viewBox="0 0 24 24"
    >
      <path
        d="M19 12H6m5-5-5 5 5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="admin-nautical-button__icon"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h13m-5-5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm4 4v3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export function AdminLoginPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let requestIsActive = true;

    void getAdminSession()
      .then(() => {
        if (requestIsActive) {
          void navigate("/admin", {
            replace: true,
          });
        }
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof ApiError &&
          caughtError.status === 401
        ) {
          return;
        }

        if (requestIsActive) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Nie udało się sprawdzić sesji.",
          );
        }
      });

    return () => {
      requestIsActive = false;
    };
  }, [navigate]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      await loginAdmin(password);

      void navigate("/admin", {
        replace: true,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się zalogować.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="nautical-page admin-nautical-page">
      <p className="home-logo">Bosman</p>

      <Link className="nautical-back-link" to="/">
        <ArrowLeftIcon />

        <span>Wróć do menu głównego</span>
      </Link>

      <section className="admin-login-layout">
        <div className="admin-login-layout__intro">
          <p className="admin-nautical-eyebrow">
            Panel administratora
          </p>

          <h1>Zarządzaj egzaminami</h1>

          <p>
            Importuj paczki ZIP, konfiguruj wersje
            robocze i publikuj gotowe egzaminy.
          </p>
        </div>

        <section className="admin-login-card">
          <div className="admin-login-card__icon">
            <LockIcon />
          </div>

          <h2>Zaloguj się</h2>

          <p>
            Podaj hasło administratora, aby przejść
            do panelu zarządzania.
          </p>

          <form
            className="admin-nautical-form"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <label>
              <span>Hasło administratora</span>

              <input
                type="password"
                value={password}
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
              />
            </label>

            {error && (
              <p className="home-message home-message--error">
                {error}
              </p>
            )}

            <button
              className="admin-nautical-button"
              type="submit"
              disabled={
                isSubmitting || password.length === 0
              }
            >
              <span>
                {isSubmitting
                  ? "Logowanie…"
                  : "Zaloguj się"}
              </span>

              <ArrowRightIcon />
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}