import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { ApiError, getParticipantSession, loginParticipant } from "../api";

import { organizationBranding } from "../organizationBranding";

function normalizeCodeInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

export function ParticipantLoginPage() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let requestIsActive = true;

    void getParticipantSession()
      .then(() => {
        if (requestIsActive) {
          void navigate("/", {
            replace: true,
          });
        }
      })
      .catch((caughtError: unknown) => {
        if (caughtError instanceof ApiError && caughtError.status === 401) {
          return;
        }

        if (requestIsActive) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Nie udało się sprawdzić sesji.",
          );
        }
      })
      .finally(() => {
        if (requestIsActive) {
          setIsCheckingSession(false);
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

    const normalizedCode = normalizeCodeInput(code);

    if (!normalizedCode) {
      setError("Podaj kod dostępu.");

      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await loginParticipant(normalizedCode);

      void navigate("/", {
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

  if (isCheckingSession) {
    return (
      <main className="nautical-page participant-login-page">
        <p className="home-message">Sprawdzanie dostępu…</p>
      </main>
    );
  }

  return (
    <main className="nautical-page participant-login-page">
      <section className="participant-login-card">
        <p className="home-logo">{organizationBranding.appName}</p>

        <p className="participant-login-card__eyebrow">
          {organizationBranding.organizationName}
        </p>

        <h1>{organizationBranding.loginTitle}</h1>

        <p>{organizationBranding.loginDescription}</p>

        <form
          className="participant-login-form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <label>
            <span>Kod dostępu</span>

            <input
              autoComplete="one-time-code"
              autoFocus
              type="text"
              value={code}
              placeholder="np. BOS-ABCD-1234"
              disabled={isSubmitting}
              onChange={(event) => {
                setCode(normalizeCodeInput(event.target.value));
              }}
            />
          </label>

          {error && <p className="home-message home-message--error">{error}</p>}

          <button
            className="nautical-primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logowanie…" : "Wejdź do egzaminów"}
          </button>
        </form>

        <Link
          className="participant-login-card__admin-link"
          to="/admin/logowanie"
        >
          Logowanie administratora
        </Link>
      </section>
    </main>
  );
}
