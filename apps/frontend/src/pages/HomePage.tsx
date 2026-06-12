import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  getPublishedExams,
  type PublicExam,
} from "../api";

function ExamCard({ exam }: { exam: PublicExam }) {
  return (
    <article className="exam-card">
      {exam.tileImageUrl ? (
        <img
          className="exam-card__image"
          src={exam.tileImageUrl}
          alt=""
        />
      ) : (
        <div className="exam-card__placeholder">
          ⚓
        </div>
      )}

      <div className="exam-card__content">
        <h2>{exam.name}</h2>

        <p>
          {exam.description ??
            "Próbny egzamin żeglarski."}
        </p>

        <dl className="exam-card__details">
          <div>
            <dt>Pytania</dt>

            <dd>
              {exam.version.questionsPerAttempt}
            </dd>
          </div>

          <div>
            <dt>Czas</dt>

            <dd>
              {exam.version.durationMinutes} min
            </dd>
          </div>

          <div>
            <dt>Zaliczenie</dt>

            <dd>
              {exam.version.passingScore}/
              {exam.version.questionsPerAttempt}
            </dd>
          </div>
        </dl>

        <Link
          className="button"
          to={`/egzaminy/${exam.slug}`}
        >
          Przejdź do egzaminu
        </Link>
      </div>
    </article>
  );
}

export function HomePage() {
  const [exams, setExams] = useState<PublicExam[]>(
    [],
  );

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let requestIsActive = true;

    void getPublishedExams()
      .then((publishedExams) => {
        if (requestIsActive) {
          setExams(publishedExams);
        }
      })
      .catch((caughtError: unknown) => {
        if (!requestIsActive) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać egzaminów.",
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
      <section className="hero">
        <p className="eyebrow">Bosman</p>

        <h1>Próbne egzaminy żeglarskie</h1>

        <p>
          Wybierz egzamin i sprawdź swoją wiedzę
          przed właściwym testem.
        </p>

        <div className="hero__actions">
          <Link
            className="button button--secondary"
            to="/historia"
          >
            Historia wyników
          </Link>
        </div>
      </section>

      {isLoading && (
        <p className="message">
          Ładowanie egzaminów…
        </p>
      )}

      {error && (
        <p className="message message--error">
          {error}
        </p>
      )}

      {!isLoading && !error && exams.length === 0 && (
        <p className="message">
          Brak opublikowanych egzaminów.
        </p>
      )}

      <section className="exam-grid">
        {exams.map((exam) => (
          <ExamCard key={exam.id} exam={exam} />
        ))}
      </section>
    </main>
  );
}