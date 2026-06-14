import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router";

import {
  ApiError,
  getParticipantExams,
  getParticipantSession,
  getPublishedExams,
  logoutParticipant,
  type PublicExam,
} from "../api";

const appMode = import.meta.env.VITE_APP_MODE;

const isSchoolMode = appMode === "SCHOOL";

type ParticipantInfo = {
  id: string;
  label: string;
};

function ClipboardIcon() {
  return (
    <svg
      aria-hidden="true"
      className="home-history-button__icon"
      viewBox="0 0 24 26"
    >
      <path
        d="M8.5 3.5h7a1 1 0 0 1 1 1v2h2a2 2 0 0 1 2 2V21a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h2v-2a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />

      <path
        d="M7.5 17l3.4-3.4 2.4 2.4L17 12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />

      <path
        d="M15.4 12H17v1.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="home-exam-card__arrow"
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

function ExamPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="home-exam-placeholder"
    >
      <svg
        className="home-exam-placeholder__art"
        viewBox="0 0 800 650"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient
            id="placeholder-background"
            x1="0"
            x2="1"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#d9f2f4" />
            <stop offset="100%" stopColor="#8acbd2" />
          </linearGradient>

          <linearGradient
            id="wave-one"
            x1="0"
            x2="1"
            y1="0"
            y2="0"
          >
            <stop offset="0%" stopColor="#68b9c2" />
            <stop offset="100%" stopColor="#a6d9dc" />
          </linearGradient>

          <linearGradient
            id="wave-two"
            x1="0"
            x2="1"
            y1="0"
            y2="0"
          >
            <stop offset="0%" stopColor="#2d96a2" />
            <stop offset="100%" stopColor="#76c2c9" />
          </linearGradient>

          <linearGradient
            id="wave-three"
            x1="0"
            x2="1"
            y1="0"
            y2="0"
          >
            <stop offset="0%" stopColor="#197b89" />
            <stop offset="100%" stopColor="#54aeb7" />
          </linearGradient>

          <filter id="anchor-shadow">
            <feDropShadow
              dx="0"
              dy="9"
              floodColor="#0d6571"
              floodOpacity="0.18"
              stdDeviation="8"
            />
          </filter>
        </defs>

        <rect
          fill="url(#placeholder-background)"
          height="650"
          width="800"
        />

        <g
          fill="none"
          opacity="0.6"
          stroke="#ffffff"
          strokeWidth="1.2"
        >
          <circle cx="400" cy="260" r="118" />
          <circle cx="400" cy="260" r="165" />
          <circle cx="400" cy="260" r="213" />

          <path d="M400 32v456M172 260h456" />
        </g>

        <g
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
          fontSize="22"
          opacity="0.85"
          textAnchor="middle"
        >
          <text x="400" y="56">
            N
          </text>
          <text x="400" y="484">
            S
          </text>
          <text x="182" y="268">
            W
          </text>
          <text x="618" y="268">
            E
          </text>
        </g>

        <g
          fill="none"
          opacity="0.65"
          stroke="#4eaab3"
          strokeLinecap="round"
          strokeWidth="4"
        >
          <path d="M636 116q18-15 36 0 18-15 36 0" />
          <path d="M696 174q14-12 28 0 14-12 28 0" />
          <path d="M96 215q11-9 22 0 11-9 22 0" />
        </g>

        <path
          d="M0 393C125 340 227 442 354 394c137-52 245-39 446 12v244H0Z"
          fill="url(#wave-one)"
          opacity="0.72"
        />

        <path
          d="M0 442c114-56 221 55 339 4 150-65 306-4 461 40v164H0Z"
          fill="url(#wave-two)"
          opacity="0.76"
        />

        <path
          d="M0 502c104-56 204 42 337 2 161-49 313 7 463 61v85H0Z"
          fill="url(#wave-three)"
          opacity="0.86"
        />

        <g
          fill="none"
          filter="url(#anchor-shadow)"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="19"
        >
          <circle cx="400" cy="173" r="30" />
          <path d="M400 203v190" />
          <path d="M354 246h92" />
          <path d="M319 318c8 74 50 103 81 119 31-16 73-45 81-119" />
          <path d="m319 318-20 26" />
          <path d="m481 318 20 26" />
        </g>
      </svg>
    </div>
  );
}

function ExamCard({ exam }: { exam: PublicExam }) {
  return (
    <article className="home-exam-card">
      {exam.tileImageUrl ? (
        <img
          alt=""
          className="home-exam-card__image"
          src={exam.tileImageUrl}
        />
      ) : (
        <ExamPlaceholder />
      )}

      <div className="home-exam-card__overlay" />

      <div className="home-exam-card__panel">
        <h2>{exam.name}</h2>

        <p>
          {exam.description ??
            "Próbny egzamin żeglarski."}
        </p>

        <Link
          className="home-exam-card__button"
          to={`/egzaminy/${exam.slug}`}
        >
          <span>Przejdź do egzaminu</span>

          <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}

export function HomePage() {
  const navigate = useNavigate();

  const [exams, setExams] = useState<PublicExam[]>(
    [],
  );

  const [participant, setParticipant] =
    useState<ParticipantInfo | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let requestIsActive = true;

    async function loadHome(): Promise<void> {
      if (isSchoolMode) {
        const session = await getParticipantSession();

        if (!requestIsActive) {
          return;
        }

        setParticipant(session.participant);

        const participantExams =
          await getParticipantExams();

        if (requestIsActive) {
          setExams(participantExams);
        }

        return;
      }

      const publishedExams = await getPublishedExams();

      if (requestIsActive) {
        setExams(publishedExams);
      }
    }

    void loadHome()
      .catch((caughtError: unknown) => {
        if (!requestIsActive) {
          return;
        }

        if (
          isSchoolMode &&
          caughtError instanceof ApiError &&
          caughtError.status === 401
        ) {
          void navigate("/dostep", {
            replace: true,
          });

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
  }, [navigate]);

  async function handleParticipantLogout(): Promise<void> {
    setIsLoggingOut(true);

    try {
      await logoutParticipant();

      void navigate("/dostep", {
        replace: true,
      });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="home-page">
      <section className="home-hero">
        <p className="home-logo">Bosman</p>

        {participant && (
          <p className="home-participant-badge">
            Zalogowano jako:{" "}
            <strong>{participant.label}</strong>
          </p>
        )}

        <h1>Próbne egzaminy żeglarskie</h1>

        <p className="home-hero__description">
          Wybierz egzamin i sprawdź swoją wiedzę
          przed właściwym testem.
        </p>

        <div className="home-hero-actions">
          {!isSchoolMode && (
            <Link
              className="home-history-button"
              to="/historia"
            >
              <ClipboardIcon />

              <span>Historia wyników</span>
            </Link>
          )}

          {isSchoolMode && (
            <button
              className="home-history-button"
              type="button"
              disabled={isLoggingOut}
              onClick={() => {
                void handleParticipantLogout();
              }}
            >
              <ClipboardIcon />

              <span>
                {isLoggingOut
                  ? "Wylogowywanie…"
                  : "Wyloguj się"}
              </span>
            </button>
          )}
        </div>
      </section>

      {isLoading && (
        <p className="home-message">
          Ładowanie egzaminów…
        </p>
      )}

      {error && (
        <p className="home-message home-message--error">
          {error}
        </p>
      )}

      {!isLoading && !error && exams.length === 0 && (
        <p className="home-message">
          {isSchoolMode
            ? "Nie masz obecnie aktywnego dostępu do żadnego egzaminu."
            : "Brak opublikowanych egzaminów."}
        </p>
      )}

      <section className="home-exam-grid">
        {exams.map((exam) => (
          <ExamCard key={exam.id} exam={exam} />
        ))}
      </section>
    </main>
  );
}