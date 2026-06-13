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

function NauticalPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="exam-start-cover__placeholder"
    >
      <svg viewBox="0 0 640 560">
        <defs>
          <linearGradient
            id="start-cover-background"
            x1="0"
            x2="1"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#d7f0f2" />
            <stop offset="100%" stopColor="#76bec7" />
          </linearGradient>

          <linearGradient
            id="start-cover-wave"
            x1="0"
            x2="1"
            y1="0"
            y2="0"
          >
            <stop offset="0%" stopColor="#208995" />
            <stop offset="100%" stopColor="#6cc0c7" />
          </linearGradient>
        </defs>

        <rect
          fill="url(#start-cover-background)"
          height="560"
          width="640"
        />

        <g
          fill="none"
          opacity="0.46"
          stroke="#ffffff"
          strokeWidth="1.2"
        >
          <circle cx="320" cy="230" r="110" />
          <circle cx="320" cy="230" r="165" />
          <circle cx="320" cy="230" r="215" />

          <path d="M320 20v410M105 230h430" />
        </g>

        <path
          d="M0 391c100-52 194 45 311 2 137-50 248-1 329 36v131H0Z"
          fill="url(#start-cover-wave)"
          opacity="0.7"
        />

        <path
          d="M0 450c113-62 205 37 332 2 108-30 215 4 308 48v60H0Z"
          fill="#127583"
          opacity="0.68"
        />

        <g
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="17"
        >
          <circle cx="320" cy="163" r="27" />
          <path d="M320 190v177" />
          <path d="M279 231h82" />
          <path d="M245 302c8 69 47 95 75 111 28-16 67-42 75-111" />
          <path d="m245 302-18 23" />
          <path d="m395 302 18 23" />
        </g>
      </svg>
    </div>
  );
}

function DetailIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="exam-start-detail__icon">
      {children}
    </span>
  );
}

export function ExamStartPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] =
    useState<PublicExam | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isStarting, setIsStarting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Brakuje adresu egzaminu.");
      setIsLoading(false);

      return;
    }

    let requestIsActive = true;

    void getPublishedExam(slug)
      .then((publishedExam) => {
        if (requestIsActive) {
          setExam(publishedExam);
        }
      })
      .catch((caughtError: unknown) => {
        if (!requestIsActive) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać egzaminu.",
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

      void navigate(`/proby/${result.attempt.id}`);
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
      <main className="nautical-page">
        <p className="home-message">
          Ładowanie egzaminu…
        </p>
      </main>
    );
  }

  if (error || !exam) {
    return (
      <main className="nautical-page">
        <Link className="nautical-back-link" to="/">
          <ArrowLeftIcon />
          <span>Wróć do menu głównego</span>
        </Link>

        <p className="home-message home-message--error">
          {error ?? "Nie znaleziono egzaminu."}
        </p>
      </main>
    );
  }

  return (
    <main className="nautical-page">
      <p className="home-logo">Bosman</p>

      <Link className="nautical-back-link" to="/">
        <ArrowLeftIcon />
        <span>Wróć do menu głównego</span>
      </Link>

      <section className="exam-start-layout">
        <article className="exam-start-content">
          <p className="exam-start-content__eyebrow">
            Próbny egzamin
          </p>

          <h1>{exam.name}</h1>

          <p className="exam-start-content__description">
            {exam.description ??
              "Sprawdź swoją wiedzę przed właściwym egzaminem."}
          </p>

          <dl className="exam-start-details">
            <div className="exam-start-detail">
              <DetailIcon>?</DetailIcon>

              <span>
                <dt>Liczba pytań</dt>

                <dd>
                  {exam.version.questionsPerAttempt}
                </dd>
              </span>
            </div>

            <div className="exam-start-detail">
              <DetailIcon>◷</DetailIcon>

              <span>
                <dt>Czas trwania</dt>

                <dd>
                  {exam.version.durationMinutes} min
                </dd>
              </span>
            </div>

            <div className="exam-start-detail">
              <DetailIcon>✓</DetailIcon>

              <span>
                <dt>Próg zaliczenia</dt>

                <dd>
                  {exam.version.passingScore}/
                  {exam.version.questionsPerAttempt}
                </dd>
              </span>
            </div>
          </dl>

          {error && (
            <p className="home-message home-message--error">
              {error}
            </p>
          )}

          <button
            className="nautical-primary-button"
            type="button"
            disabled={isStarting}
            onClick={() => {
              void handleStart();
            }}
          >
            <span>
              {isStarting
                ? "Rozpoczynanie…"
                : "Rozpocznij egzamin"}
            </span>

            <ArrowRightIcon />
          </button>
        </article>

        <aside className="exam-start-cover">
          {exam.tileImageUrl ? (
            <img
              alt=""
              className="exam-start-cover__image"
              src={exam.tileImageUrl}
            />
          ) : (
            <NauticalPlaceholder />
          )}
        </aside>
      </section>
    </main>
  );
}