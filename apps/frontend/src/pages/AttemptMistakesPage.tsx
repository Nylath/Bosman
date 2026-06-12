import { useEffect, useState } from "react";
import {
  Link,
  useParams,
} from "react-router";

import {
  getAttemptMistakes,
  type AttemptMistake,
} from "../api";

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
    <main className="page page--narrow">
      <Link
        className="text-link"
        to={`/proby/${attemptId}/wynik`}
      >
        ← Wróć do wyniku
      </Link>

      <section className="page-heading">
        <p className="eyebrow">Powtórka materiału</p>

        <h1>Błędne odpowiedzi</h1>

        <p>
          Sprawdź pytania, które wymagają
          dodatkowej uwagi.
        </p>
      </section>

      {isLoading && (
        <p className="message">
          Ładowanie błędów…
        </p>
      )}

      {error && (
        <p className="message message--error">
          {error}
        </p>
      )}

      {!isLoading &&
        !error &&
        mistakes.length === 0 && (
          <section className="empty-success">
            <p className="empty-success__icon">
              ✓
            </p>

            <h2>Brak błędnych odpowiedzi</h2>

            <p>
              Wszystkie zaznaczone odpowiedzi były
              poprawne.
            </p>

            <Link className="button" to="/historia">
              Przejdź do historii
            </Link>
          </section>
        )}

      <section className="mistakes-list">
        {mistakes.map((mistake) => (
          <article
            className="mistake-card"
            key={mistake.externalId}
          >
            <p className="mistake-card__number">
              Pytanie {mistake.number}
            </p>

            {mistake.imageUrl && (
              <img
                className="mistake-card__image"
                src={mistake.imageUrl}
                alt=""
              />
            )}

            <h2>{mistake.text}</h2>

            <div className="mistake-answer mistake-answer--wrong">
              <strong>Twoja odpowiedź</strong>

              <span>
                {mistake.selectedAnswer?.text ??
                  "Brak odpowiedzi"}
              </span>
            </div>

            <div className="mistake-answer mistake-answer--correct">
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