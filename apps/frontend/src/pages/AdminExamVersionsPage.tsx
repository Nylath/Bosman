import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";

import {
  ApiError,
  getAdminExams,
  getAdminExamVersions,
  type AdminExam,
  type AdminExamVersionStatus,
  type AdminExamVersionSummary,
} from "../api";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function translateStatus(
  status: AdminExamVersionStatus,
): string {
  switch (status) {
    case "draft":
      return "Szkic";

    case "published":
      return "Opublikowana";

    case "archived":
      return "Archiwalna";
  }
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
      className="admin-nautical-button__icon"
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

function VersionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="M8 4h8m-8 5h8m-8 5h5m-7-12h10a2 2 0 0 1 2 2v16H6V4a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function AdminExamVersionsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] =
    useState<AdminExam | null>(null);

  const [versions, setVersions] = useState<
    AdminExamVersionSummary[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!examId) {
      setError("Brakuje identyfikatora egzaminu.");
      setIsLoading(false);

      return;
    }

    let requestIsActive = true;

    void Promise.all([
      getAdminExams(),
      getAdminExamVersions(examId),
    ])
      .then(([loadedExams, loadedVersions]) => {
        if (!requestIsActive) {
          return;
        }

        const loadedExam =
          loadedExams.find(
            (candidate) => candidate.id === examId,
          ) ?? null;

        setExam(loadedExam);
        setVersions(loadedVersions);
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof ApiError &&
          caughtError.status === 401
        ) {
          void navigate("/admin/logowanie", {
            replace: true,
          });

          return;
        }

        if (requestIsActive) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Nie udało się pobrać wersji.",
          );
        }
      })
      .finally(() => {
        if (requestIsActive) {
          setIsLoading(false);
        }
      });

    return () => {
      requestIsActive = false;
    };
  }, [examId, navigate]);

  if (isLoading) {
    return (
      <main className="nautical-page admin-nautical-page">
        <p className="home-message">
          Ładowanie wersji egzaminu…
        </p>
      </main>
    );
  }

  return (
    <main className="nautical-page admin-nautical-page">
      <p className="home-logo">Bosman</p>

      <Link className="nautical-back-link" to="/admin">
        <ArrowLeftIcon />

        <span>Wróć do panelu administratora</span>
      </Link>

      <header className="admin-versions-header">
        <p className="admin-nautical-eyebrow">
          Wersjonowanie egzaminu
        </p>

        <h1>
          {exam?.name ?? "Wersje egzaminu"}
        </h1>

        <p>
          Każdy import paczki ZIP tworzy nową wersję
          roboczą. Użytkownicy widzą wyłącznie wersję
          opublikowaną.
        </p>
      </header>

      {error && (
        <p className="home-message home-message--error">
          {error}
        </p>
      )}

      {!error && versions.length === 0 && (
        <p className="home-message">
          Ten egzamin nie ma jeszcze żadnych wersji.
        </p>
      )}

      <section className="admin-nautical-version-list">
        {versions.map((version) => (
          <article
            className={`admin-nautical-version-card admin-nautical-version-card--${version.status}`}
            key={version.id}
          >
            <div className="admin-nautical-version-card__heading">
              <div className="admin-nautical-version-card__icon">
                <VersionIcon />
              </div>

              <div>
                <p className="admin-nautical-version-card__status">
                  {translateStatus(version.status)}
                </p>

                <h2>
                  Wersja {version.versionNumber}
                </h2>

                <p>
                  Utworzono:{" "}
                  {formatDate(version.createdAt)}
                </p>

                {version.publishedAt && (
                  <p>
                    Opublikowano:{" "}
                    {formatDate(version.publishedAt)}
                  </p>
                )}
              </div>
            </div>

            <dl className="admin-nautical-version-card__details">
              <div>
                <dt>Pytania w próbie</dt>

                <dd>
                  {version.questionsPerAttempt ?? "—"}
                </dd>
              </div>

              <div>
                <dt>Czas</dt>

                <dd>
                  {version.durationMinutes === null
                    ? "—"
                    : `${version.durationMinutes} min`}
                </dd>
              </div>

              <div>
                <dt>Próg zaliczenia</dt>

                <dd>{version.passingScore ?? "—"}</dd>
              </div>
            </dl>

            <Link
              className="admin-nautical-button"
              to={`/admin/wersje/${version.id}`}
            >
              <span>Otwórz konfigurację</span>

              <ArrowRightIcon />
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}