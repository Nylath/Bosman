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
      <main className="page">
        <p className="message">
          Ładowanie wersji egzaminu…
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <Link className="text-link" to="/admin">
        ← Wróć do panelu administratora
      </Link>

      <section className="page-heading">
        <p className="eyebrow">
          Panel administratora
        </p>

        <h1>
          {exam?.name ?? "Wersje egzaminu"}
        </h1>

        <p>
          Każdy ponowny import paczki ZIP tworzy
          nową wersję roboczą. Opublikowana wersja
          jest widoczna dla użytkowników.
        </p>
      </section>

      {error && (
        <p className="message message--error">
          {error}
        </p>
      )}

      {!error && versions.length === 0 && (
        <p className="message">
          Ten egzamin nie ma jeszcze żadnych wersji.
        </p>
      )}

      <section className="admin-version-list">
        {versions.map((version) => (
          <article
            className={`admin-version-card admin-version-card--${version.status}`}
            key={version.id}
          >
            <div>
              <p className="admin-version-card__status">
                {translateStatus(version.status)}
              </p>

              <h2>
                Wersja {version.versionNumber}
              </h2>

              <p>
                Utworzono: {formatDate(version.createdAt)}
              </p>

              {version.publishedAt && (
                <p>
                  Opublikowano:{" "}
                  {formatDate(version.publishedAt)}
                </p>
              )}
            </div>

            <dl className="admin-version-card__details">
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
              className="button button--secondary"
              to={`/admin/wersje/${version.id}`}
            >
              Otwórz konfigurację
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}