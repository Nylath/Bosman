import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router";

import { PiChartBar } from "react-icons/pi";

import {
  ApiError,
  getParticipantExams,
  getParticipantSession,
  getPublishedExams,
  logoutParticipant,
  type PublicExam,
} from "../api";

import { organizationBranding } from "../organizationBranding";

const appMode = import.meta.env.VITE_APP_MODE;

const isSchoolMode = appMode === "SCHOOL";

type ParticipantInfo = {
  id: string;
  label: string;
};



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
        <div className="home-topbar">
  <p className="home-logo">
  {organizationBranding.appName}
</p>

{participant && (
  <div className="home-participant-panel">
    <p className="home-participant-greeting">
      <span>Witaj,</span>

      <strong title={participant.label}>
        {participant.label}
      </strong>
    </p>

    <button
      className="home-participant-action"
      type="button"
      disabled={isLoggingOut}
      onClick={() => {
        void handleParticipantLogout();
      }}
    >
      {isLoggingOut
        ? "Wylogowywanie…"
        : "Wyloguj się"}
    </button>
  </div>
)}

</div>

        <p className="home-hero__organization">
  {organizationBranding.organizationName}
</p>

<h1>{organizationBranding.homeTitle}</h1>

<p className="home-hero__description">
  {organizationBranding.homeDescription}
</p>

        <div className="home-hero-actions">
  <Link
    className="home-history-button"
    to="/historia"
  >
    <span
  aria-hidden="true"
  className="home-history-button__icon"
>
  <PiChartBar />
</span>

<span>Historia wyników</span>
  </Link>
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