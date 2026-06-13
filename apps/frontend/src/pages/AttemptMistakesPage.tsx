import { useEffect, useState } from "react";
import {
  Link,
  useParams,
} from "react-router";

import {
  getAttemptMistakes,
  type AttemptMistake,
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

export function AttemptMistakesPage() {
  const { attemptId } = useParams();

  const [mistakes, setMistakes] = useState<
    AttemptMistake[]
  >([]);

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

    void getAttemptMistakes(attemptId)
      .then((loadedMistakes) => {
        if (requestIsActive) {
          setMistakes(loadedMistakes);
        }
      })
      .catch((caughtError: unknown) => {
        if (!requestIsActive) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać błędów.",
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

  return (
    <main className="nautical-page nautical-page--mistakes">
      <p className="home-logo">Bosman</p>

      <Link
        className="nautical-back-link"
        to={`/proby/${attemptId}/wynik`}
      >
        <ArrowLeftIcon />

        <span>Wróć do wyniku</span>
      </Link>

      <section className="mistakes-nautical-heading">
        <p className="mistakes-nautical-heading__eyebrow">
          Powtórka materiału
        </p>

        <h1>Błędne odpowiedzi</h1>

        <p>
          Sprawdź pytania, które warto jeszcze raz
          przeanalizować przed egzaminem.
        </p>
      </section>

      {isLoading && (
        <p className="home-message">
          Ładowanie błędów…
        </p>
      )}

      {error && (
        <p className="home-message home-message--error">
          {error}
        </p>
      )}

      {!isLoading &&
        !error &&
        mistakes.length === 0 && (
          <section className="mistakes-nautical-empty">
            <div className="mistakes-nautical-empty__icon">
              <CheckIcon />
            </div>

            <h2>Brak błędnych odpowiedzi</h2>

            <p>
              Wszystkie zaznaczone odpowiedzi były
              poprawne.
            </p>

            <Link
  className="nautical-primary-button mistakes-nautical-empty__button"
  to="/historia"
>
  Historia wyników
</Link>
          </section>
        )}

      <section className="mistakes-nautical-list">
        {mistakes.map((mistake) => (
          <article
            className="mistakes-nautical-card"
            key={mistake.externalId}
          >
            <p className="mistakes-nautical-card__number">
              Pytanie {mistake.number}
            </p>

            {mistake.imageUrl && (
              <img
                alt=""
                className="mistakes-nautical-card__image"
                src={mistake.imageUrl}
              />
            )}

            <h2>{mistake.text}</h2>

            <div className="mistakes-nautical-answer mistakes-nautical-answer--wrong">
              <strong>Twoja odpowiedź</strong>

              <span>
                {mistake.selectedAnswer?.text ??
                  "Brak odpowiedzi"}
              </span>
            </div>

            <div className="mistakes-nautical-answer mistakes-nautical-answer--correct">
              <strong>Poprawna odpowiedź</strong>

              <span>
                {mistake.correctAnswer.text}
              </span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}