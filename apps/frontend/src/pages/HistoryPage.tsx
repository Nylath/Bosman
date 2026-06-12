import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  getAttemptHistory,
  type AttemptResult,
} from "../api";

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
    <main className="page">
      <Link className="text-link" to="/">
        ← Wróć do egzaminów
      </Link>

      <section className="page-heading">
        <p className="eyebrow">Bosman</p>

        <h1>Historia wyników</h1>

        <p>
          Zobacz zakończone próby i sprawdź
          pytania wymagające powtórki.
        </p>
      </section>

      {isLoading && (
        <p className="message">
          Ładowanie historii…
        </p>
      )}

      {error && (
        <p className="message message--error">
          {error}
        </p>
      )}

      {!isLoading &&
        !error &&
        attempts.length === 0 && (
          <p className="message">
            Nie masz jeszcze zakończonych prób.
          </p>
        )}

      <section className="history-list">
        {attempts.map((attempt) => (
          <article
            className={`history-card ${
              attempt.passed
                ? "history-card--passed"
                : "history-card--failed"
            }`}
            key={attempt.id}
          >
            <div>
              <p className="history-card__date">
                {formatDate(attempt.finishedAt)}
              </p>

              <h2>{attempt.exam.name}</h2>

              <p>
                {attempt.status === "expired"
                  ? "Próba zakończona po upływie czasu."
                  : "Próba zakończona poprawnie."}
              </p>
            </div>

            <dl className="history-card__details">
              <div>
                <dt>Wynik</dt>

                <dd>
                  {attempt.score}/
                  {attempt.totalQuestions}
                </dd>
              </div>

              <div>
                <dt>Procent</dt>

                <dd>
                  {calculatePercentage(
                    attempt.score,
                    attempt.totalQuestions,
                  )}
                  %
                </dd>
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

            <div className="history-card__actions">
              <Link
                className="button"
                to={`/proby/${attempt.id}/wynik`}
              >
                Zobacz wynik
              </Link>

              <Link
                className="button button--secondary"
                to={`/proby/${attempt.id}/bledy`}
              >
                Sprawdź błędy
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}