import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";

import {
  getPublishedExam,
  startOrResumeAttempt,
  type PublicExam,
} from "../api";

export function ExamStartPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] =
    useState<PublicExam | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isStarting, setIsStarting] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!slug) {
      setError("Brakuje adresu egzaminu.");
      setIsLoading(false);

      return;
    }

    void getPublishedExam(slug)
      .then((publishedExam) => {
        setExam(publishedExam);
      })
      .catch((caughtError: unknown) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać egzaminu.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [slug]);

  async function handleStart(): Promise<void> {
    if (!slug) {
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const result =
        await startOrResumeAttempt(slug);

      await navigate(`/proby/${result.attempt.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się rozpocząć egzaminu.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <p className="message">
          Ładowanie egzaminu…
        </p>
      </main>
    );
  }

  if (error || !exam) {
    return (
      <main className="page">
        <p className="message message--error">
          {error ?? "Nie znaleziono egzaminu."}
        </p>

        <Link className="text-link" to="/">
          ← Wróć do listy egzaminów
        </Link>
      </main>
    );
  }

  return (
    <main className="page page--narrow">
      <Link className="text-link" to="/">
        ← Wróć do listy egzaminów
      </Link>

      <section className="exam-start">
        <p className="eyebrow">Próbny egzamin</p>

        <h1>{exam.name}</h1>

        <p>
          {exam.description ??
            "Sprawdź swoją wiedzę przed egzaminem."}
        </p>

        <dl className="exam-start__details">
          <div>
            <dt>Liczba pytań</dt>
            <dd>{exam.version.questionsPerAttempt}</dd>
          </div>

          <div>
            <dt>Czas trwania</dt>
            <dd>{exam.version.durationMinutes} min</dd>
          </div>

          <div>
            <dt>Próg zaliczenia</dt>
            <dd>
              {exam.version.passingScore}/
              {exam.version.questionsPerAttempt}
            </dd>
          </div>
        </dl>

        {error && (
          <p className="message message--error">
            {error}
          </p>
        )}

        <button
          className="button"
          type="button"
          disabled={isStarting}
          onClick={() => {
            void handleStart();
          }}
        >
          {isStarting
            ? "Rozpoczynanie…"
            : "Rozpocznij lub wznów próbę"}
        </button>
      </section>
    </main>
  );
}