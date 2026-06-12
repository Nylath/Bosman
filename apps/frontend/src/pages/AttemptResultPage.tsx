import { useEffect, useState } from "react";
import {
  Link,
  useParams,
} from "react-router";

import {
  getAttemptResult,
  type AttemptResult,
} from "../api";

function formatElapsedTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes} min ${remainingSeconds} s`;
}

export function AttemptResultPage() {
  const { attemptId } = useParams();

  const [result, setResult] =
    useState<AttemptResult | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) {
      setError("Brakuje identyfikatora próby.");
      setIsLoading(false);

      return;
    }

    let requestIsActive = true;

    void getAttemptResult(attemptId)
      .then((loadedResult) => {
        if (requestIsActive) {
          setResult(loadedResult);
        }
      })
      .catch((caughtError: unknown) => {
        if (!requestIsActive) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać wyniku.",
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
  }, [attemptId]);

  if (isLoading) {
    return (
      <main className="page page--narrow">
        <Link className="text-link" to="/">
          ← Wróć do menu głównego
        </Link>

        <p className="message">
          Obliczanie wyniku…
        </p>
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="page page--narrow">
        <Link className="text-link" to="/">
          ← Wróć do menu głównego
        </Link>

        <p className="message message--error">
          {error ?? "Nie udało się odczytać wyniku."}
        </p>
      </main>
    );
  }

  return (
    <main className="page page--narrow">
      <Link className="text-link" to="/">
        ← Wróć do menu głównego
      </Link>

      <section
        className={`result-card ${
          result.passed
            ? "result-card--passed"
            : "result-card--failed"
        }`}
      >
        <p className="eyebrow">
          {result.status === "expired"
            ? "Czas minął"
            : "Egzamin zakończony"}
        </p>

        <h1>
          {result.passed
            ? "Egzamin zaliczony"
            : "Egzamin niezaliczony"}
        </h1>

        <p>{result.exam.name}</p>

        <div className="result-score">
          <strong>{result.score}</strong>

          <span>
            / {result.totalQuestions} poprawnych odpowiedzi
          </span>
        </div>

        <dl className="result-details">
          <div>
            <dt>Wynik</dt>

            <dd>
              {Math.round(
                (result.score / result.totalQuestions) *
                  100,
              )}
              %
            </dd>
          </div>

          <div>
            <dt>Czas</dt>

            <dd>
              {formatElapsedTime(
                result.elapsedSeconds,
              )}
            </dd>
          </div>
        </dl>

        <div className="result-actions">
          <Link
            className="button"
            to={`/proby/${result.id}/bledy`}
          >
            Sprawdź błędne odpowiedzi
          </Link>

          <Link
            className="button button--secondary"
            to={`/egzaminy/${result.exam.slug}`}
          >
            Rozwiąż ponownie
          </Link>

          <Link
            className="button button--secondary"
            to="/historia"
          >
            Historia wyników
          </Link>
        </div>
      </section>
    </main>
  );
}