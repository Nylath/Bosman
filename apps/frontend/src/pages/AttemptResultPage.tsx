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
      className="nautical-primary-button__icon"
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
      <main className="nautical-page nautical-page--result">
        <p className="home-message">
          Obliczanie wyniku…
        </p>
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="nautical-page nautical-page--result">
        <Link className="nautical-back-link" to="/">
          <ArrowLeftIcon />

          <span>Wróć do menu głównego</span>
        </Link>

        <p className="home-message home-message--error">
          {error ?? "Nie udało się odczytać wyniku."}
        </p>
      </main>
    );
  }

  const percentage = Math.round(
    (result.score / result.totalQuestions) * 100,
  );

  return (
    <main className="nautical-page nautical-page--result">
      <p className="home-logo">Bosman</p>

      <Link className="nautical-back-link" to="/">
        <ArrowLeftIcon />

        <span>Wróć do menu głównego</span>
      </Link>

      <section
        className={`nautical-result-card ${
          result.passed
            ? "nautical-result-card--passed"
            : "nautical-result-card--failed"
        }`}
      >
        <div className="nautical-result-card__icon">
          {result.passed ? (
            <CheckIcon />
          ) : (
            <CrossIcon />
          )}
        </div>

        <p className="nautical-result-card__eyebrow">
          {result.status === "expired"
            ? "Czas minął"
            : "Egzamin zakończony"}
        </p>

        <h1>
          {result.passed
            ? "Egzamin zaliczony"
            : "Egzamin niezaliczony"}
        </h1>

        <p className="nautical-result-card__exam">
          {result.exam.name}
        </p>

        <div className="nautical-result-score">
          <strong>{result.score}</strong>

          <span>
            / {result.totalQuestions}
          </span>

          <small>
            poprawnych odpowiedzi
          </small>
        </div>

        <dl className="nautical-result-details">
          <div>
            <dt>Wynik procentowy</dt>

            <dd>{percentage}%</dd>
          </div>

          <div>
            <dt>Czas rozwiązania</dt>

            <dd>
              {formatElapsedTime(
                result.elapsedSeconds,
              )}
            </dd>
          </div>
        </dl>

        <div className="nautical-result-actions">
          <Link
            className="nautical-primary-button"
            to={`/proby/${result.id}/bledy`}
          >
            <span>Sprawdź błędne odpowiedzi</span>

            <ArrowRightIcon />
          </Link>

          <Link
            className="nautical-secondary-button"
            to={`/egzaminy/${result.exam.slug}`}
          >
            Rozwiąż ponownie
          </Link>

          <Link
            className="nautical-secondary-button"
            to="/historia"
          >
            Historia wyników
          </Link>
        </div>
      </section>
    </main>
  );
}