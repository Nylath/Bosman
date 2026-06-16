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
  cancelAttempt,
  getAttempt,
  shouldRedirectToParticipantLogin,
  submitAttemptAnswer,
  type Attempt,
} from "../api";
import { ConfirmCancelAttemptModal } from "../components/ConfirmCancelAttemptModal";

function calculateRemainingSeconds(
  expiresAt: string,
  currentTimestamp: number,
): number {
  return Math.max(
    0,
    Math.ceil(
      (new Date(expiresAt).getTime() -
        currentTimestamp) /
        1000,
    ),
  );
}

function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(
    2,
    "0",
  )}:${String(remainingSeconds).padStart(2, "0")}`;
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

  const [isCancelling, setIsCancelling] =
    useState(false);

  const [
    isCancelModalOpen,
    setIsCancelModalOpen,
  ] = useState(false);

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

        if (shouldRedirectToParticipantLogin(caughtError)) {
  void navigate("/dostep", {
    replace: true,
  });

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

      if (shouldRedirectToParticipantLogin(caughtError)) {
  void navigate("/dostep", {
    replace: true,
  });

  return;
}
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się zapisać odpowiedzi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!attempt) {
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      await cancelAttempt(attempt.id);

      void navigate(
        `/egzaminy/${attempt.exam.slug}`,
        {
          replace: true,
        },
      );
    } catch (caughtError) {
      if (shouldRedirectToParticipantLogin(caughtError)) {
  void navigate("/dostep", {
    replace: true,
  });

  return;
}

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się przerwać egzaminu.",
      );

      setIsCancelModalOpen(false);
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <main className="nautical-page nautical-page--exam">
        <p className="home-message">
          Ładowanie próby…
        </p>
      </main>
    );
  }

  if (error && !attempt) {
    return (
      <main className="nautical-page nautical-page--exam">
        <Link className="nautical-back-link" to="/">
          <ArrowLeftIcon />

          <span>Wróć do menu głównego</span>
        </Link>

        <p className="home-message home-message--error">
          {error}
        </p>
      </main>
    );
  }

  if (!attempt || !attempt.currentQuestion) {
    return (
      <main className="nautical-page nautical-page--exam">
        <Link className="nautical-back-link" to="/">
          <ArrowLeftIcon />

          <span>Wróć do menu głównego</span>
        </Link>

        <p className="home-message home-message--error">
          Nie udało się odczytać aktualnego pytania.
        </p>
      </main>
    );
  }

  const question = attempt.currentQuestion;

  const progress =
    (question.number / attempt.totalQuestions) * 100;

  return (
    <main className="nautical-page nautical-page--exam">
      <header className="attempt-nautical-header">
        <div>
          <p className="home-logo">Bosman</p>

          <div className="attempt-nautical-navigation">
            <Link className="nautical-back-link" to="/">
              <ArrowLeftIcon />

              <span>Wróć do menu głównego</span>
            </Link>

            <button
              className="attempt-stop-button"
              type="button"
              disabled={isSubmitting || isCancelling}
              onClick={() => {
                setIsCancelModalOpen(true);
              }}
            >
              Przerwij egzamin
            </button>
          </div>
        </div>

        <div className="attempt-nautical-timer">
          <span>Pozostały czas</span>

          <strong>
            {formatRemainingTime(remainingSeconds)}
          </strong>
        </div>
      </header>

      <section className="attempt-nautical-progress">
        <div>
          <strong>
            Pytanie {question.number}
          </strong>

          <span>
            z {attempt.totalQuestions}
          </span>
        </div>

        <span>{Math.round(progress)}%</span>
      </section>

      <div className="attempt-nautical-progress-bar">
        <div
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <section className="attempt-nautical-card">
        <p className="attempt-nautical-card__exam">
          {attempt.exam.name}
        </p>

        {question.imageUrl && (
          <img
            alt=""
            className="attempt-nautical-card__image"
            src={question.imageUrl}
          />
        )}

        <h1>{question.text}</h1>

        <div className="attempt-nautical-answers">
          {question.answers.map((answer, index) => {
            const isSelected =
              selectedAnswerId === answer.id;

            return (
              <button
                className={`attempt-nautical-answer ${
                  isSelected
                    ? "attempt-nautical-answer--selected"
                    : ""
                }`}
                key={answer.id}
                type="button"
                aria-pressed={isSelected}
                disabled={isSubmitting || isCancelling}
                onClick={() => {
                  setSelectedAnswerId(answer.id);
                }}
              >
                <span className="attempt-nautical-answer__letter">
                  {String.fromCharCode(65 + index)}
                </span>

                <span>{answer.text}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="home-message home-message--error">
            {error}
          </p>
        )}

        <footer className="attempt-nautical-card__footer">
          <button
            className="nautical-primary-button"
            type="button"
            disabled={
              !selectedAnswerId ||
              isSubmitting ||
              isCancelling ||
              remainingSeconds === 0
            }
            onClick={() => {
              void handleNext();
            }}
          >
            <span>
              {isSubmitting
                ? "Zapisywanie…"
                : question.number ===
                    attempt.totalQuestions
                  ? "Zakończ egzamin"
                  : "Następne pytanie"}
            </span>

            <ArrowRightIcon />
          </button>
        </footer>
      </section>

      <ConfirmCancelAttemptModal
        isOpen={isCancelModalOpen}
        isCancelling={isCancelling}
        onClose={() => {
          setIsCancelModalOpen(false);
        }}
        onConfirm={() => {
          void handleCancel();
        }}
      />
    </main>
  );
}