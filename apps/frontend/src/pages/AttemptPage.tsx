import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";

import {
  getAttempt,
  submitAttemptAnswer,
  type Attempt,
} from "../api";

function calculateRemainingSeconds(
  expiresAt: string,
  currentTimestamp: number,
): number {
  const expirationTimestamp =
    new Date(expiresAt).getTime();

  return Math.max(
    0,
    Math.ceil(
      (expirationTimestamp - currentTimestamp) / 1000,
    ),
  );
}

function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);

  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
}

export function AttemptPage() {
  const { attemptId } = useParams();

  const navigate = useNavigate();

  const [attempt, setAttempt] =
    useState<Attempt | null>(null);

  const [selectedAnswerId, setSelectedAnswerId] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [currentTimestamp, setCurrentTimestamp] =
    useState(Date.now());

  const remainingSeconds = useMemo(() => {
    if (!attempt) {
      return 0;
    }

    return calculateRemainingSeconds(
      attempt.expiresAt,
      currentTimestamp,
    );
  }, [attempt, currentTimestamp]);

  useEffect(() => {
    if (!attemptId) {
      setError("Brakuje identyfikatora próby.");
      setIsLoading(false);

      return;
    }

    let requestIsActive = true;

    void getAttempt(attemptId)
      .then((loadedAttempt) => {
        if (!requestIsActive) {
          return;
        }

        if (loadedAttempt.status !== "in_progress") {
          void navigate(
            `/proby/${loadedAttempt.id}/wynik`,
            {
              replace: true,
            },
          );

          return;
        }

        setAttempt(loadedAttempt);
      })
      .catch((caughtError: unknown) => {
        if (!requestIsActive) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać próby.",
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
  }, [attemptId, navigate]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setSelectedAnswerId(null);
  }, [attempt?.currentQuestion?.attemptQuestionId]);

  useEffect(() => {
    if (
      attempt &&
      attempt.status === "in_progress" &&
      remainingSeconds === 0
    ) {
      void navigate(`/proby/${attempt.id}/wynik`, {
        replace: true,
      });
    }
  }, [attempt, navigate, remainingSeconds]);

  async function handleNext(): Promise<void> {
    if (
      !attempt ||
      !attempt.currentQuestion ||
      !selectedAnswerId
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitAttemptAnswer({
        attemptId: attempt.id,

        attemptQuestionId:
          attempt.currentQuestion.attemptQuestionId,

        selectedAnswerId,
      });

      if (result.status === "finished") {
        void navigate(`/proby/${attempt.id}/wynik`, {
          replace: true,
        });

        return;
      }

      setAttempt(result.attempt);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się zapisać odpowiedzi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="page page--narrow">
        <p className="message">
          Ładowanie próby…
        </p>
      </main>
    );
  }

  if (error && !attempt) {
    return (
      <main className="page page--narrow">
        <p className="message message--error">
          {error}
        </p>

        <Link className="text-link" to="/">
          ← Wróć na ekran główny
        </Link>
      </main>
    );
  }

  if (!attempt || !attempt.currentQuestion) {
    return (
      <main className="page page--narrow">
        <p className="message message--error">
          Nie udało się odczytać aktualnego pytania.
        </p>

        <Link className="text-link" to="/">
          ← Wróć na ekran główny
        </Link>
      </main>
    );
  }

  const question = attempt.currentQuestion;

  const progress =
    (question.number / attempt.totalQuestions) * 100;

  return (
    <main className="page page--exam">
      <header className="attempt-header">
        <div>
          <p className="eyebrow">Próbny egzamin</p>

          <h1>{attempt.exam.name}</h1>
        </div>

        <div className="timer">
          <span className="timer__label">
            Pozostały czas
          </span>

          <strong>{formatRemainingTime(remainingSeconds)}</strong>
        </div>
      </header>

      <section className="progress-section">
        <div className="progress-section__label">
          <span>
            Pytanie {question.number} z{" "}
            {attempt.totalQuestions}
          </span>

          <span>{Math.round(progress)}%</span>
        </div>

        <div className="progress-bar">
          <div
            className="progress-bar__value"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </section>

      <section className="question-card">
        {question.imageUrl && (
          <img
            className="question-card__image"
            src={question.imageUrl}
            alt=""
          />
        )}

        <p className="question-card__external-id">
          {question.externalId}
        </p>

        <h2>{question.text}</h2>

        <div className="answers">
          {question.answers.map((answer, index) => {
            const isSelected =
              selectedAnswerId === answer.id;

            return (
              <button
                className={`answer ${
                  isSelected
                    ? "answer--selected"
                    : ""
                }`}
                key={answer.id}
                type="button"
                aria-pressed={isSelected}
                disabled={isSubmitting}
                onClick={() => {
                  setSelectedAnswerId(answer.id);
                }}
              >
                <span className="answer__letter">
                  {String.fromCharCode(65 + index)}
                </span>

                <span>{answer.text}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="message message--error">
            {error}
          </p>
        )}

        <div className="question-card__footer">
          <button
            className="button"
            type="button"
            disabled={
              !selectedAnswerId ||
              isSubmitting ||
              remainingSeconds === 0
            }
            onClick={() => {
              void handleNext();
            }}
          >
            {isSubmitting
              ? "Zapisywanie…"
              : question.number ===
                  attempt.totalQuestions
                ? "Zakończ egzamin"
                : "Dalej"}
          </button>
        </div>
      </section>
    </main>
  );
}