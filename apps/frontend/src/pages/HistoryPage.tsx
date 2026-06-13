import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  getAttemptHistory,
  type AttemptResult,
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
      className="history-nautical-card__arrow"
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="m5 12 4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatElapsedTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes} min ${remainingSeconds} s`;
}

function calculatePercentage(
  score: number,
  totalQuestions: number,
): number {
  if (totalQuestions === 0) {
    return 0;
  }

  return Math.round((score / totalQuestions) * 100);
}

export function HistoryPage() {
  const [attempts, setAttempts] = useState<
    AttemptResult[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let requestIsActive = true;

    void getAttemptHistory()
      .then((loadedAttempts) => {
        if (requestIsActive) {
          setAttempts(loadedAttempts);
        }
      })
      .catch((caughtError: unknown) => {
        if (!requestIsActive) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać historii.",
        );
      })
      .finally(() => {
        if (requestIsActive) {
          setIsLoading(false);
        }
      });

    return () => {
      requestIsActive = false;
    };
  }, []);

  return (
    <main className="nautical-page nautical-page--history">
      <p className="home-logo">Bosman</p>

      <Link className="nautical-back-link" to="/">
        <ArrowLeftIcon />

        <span>Wróć do menu głównego</span>
      </Link>

      <section className="history-nautical-heading">
        <p className="history-nautical-heading__eyebrow">
          Twoje postępy
        </p>

        <h1>Historia wyników</h1>

        <p>
          Zobacz zakończone próby i wróć do pytań,
          które wymagają jeszcze powtórki.
        </p>
      </section>

      {isLoading && (
        <p className="home-message">
          Ładowanie historii…
        </p>
      )}

      {error && (
        <p className="home-message home-message--error">
          {error}
        </p>
      )}

      {!isLoading &&
        !error &&
        attempts.length === 0 && (
          <section className="history-nautical-empty">
            <h2>Brak zakończonych prób</h2>

            <p>
              Rozwiąż pierwszy egzamin, aby zobaczyć
              tutaj swój wynik.
            </p>

            <Link
              className="nautical-primary-button"
              to="/"
            >
              <span>Przejdź do egzaminów</span>

              <ArrowRightIcon />
            </Link>
          </section>
        )}

      <section className="history-nautical-list">
        {attempts.map((attempt) => {
          const percentage = calculatePercentage(
            attempt.score,
            attempt.totalQuestions,
          );

          return (
            <article
              className={`history-nautical-card ${
                attempt.passed
                  ? "history-nautical-card--passed"
                  : "history-nautical-card--failed"
              }`}
              key={attempt.id}
            >
              <div className="history-nautical-card__top">
                <div
                  className="history-nautical-card__icon"
                >
                  {attempt.passed ? (
                    <CheckIcon />
                  ) : (
                    <CrossIcon />
                  )}
                </div>

                <div>
                  <p className="history-nautical-card__date">
                    {formatDate(attempt.finishedAt)}
                  </p>

                  <h2>{attempt.exam.name}</h2>

                  <p className="history-nautical-card__status">
                    {attempt.status === "expired"
                      ? "Próba zakończona po upływie czasu"
                      : attempt.passed
                        ? "Egzamin zaliczony"
                        : "Egzamin niezaliczony"}
                  </p>
                </div>
              </div>

              <dl className="history-nautical-card__details">
                <div>
                  <dt>Wynik</dt>

                  <dd>
                    {attempt.score}/
                    {attempt.totalQuestions}
                  </dd>
                </div>

                <div>
                  <dt>Procent</dt>

                  <dd>{percentage}%</dd>
                </div>

                <div>
                  <dt>Czas</dt>

                  <dd>
                    {formatElapsedTime(
                      attempt.elapsedSeconds,
                    )}
                  </dd>
                </div>
              </dl>

              <div className="history-nautical-card__actions">
  <Link
    className="nautical-primary-button"
    to={`/proby/${attempt.id}/bledy`}
  >
    <span>Sprawdź błędy</span>

    <ArrowRightIcon />
  </Link>
</div>
            </article>
          );
        })}
      </section>
    </main>
  );
}