import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router";

import {
  ApiError,
  getAdminExams,
  getAdminSession,
  importAdminExamPackage,
  logoutAdmin,
  type AdminExam,
  type AdminImportResult,
} from "../api";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ReportList(props: {
  title: string;
  items: string[];
  variant: "information" | "warning" | "error";
}) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <section
      className={`admin-report-section admin-report-section--${props.variant}`}
    >
      <h3>{props.title}</h3>

      <ul>
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function AdminDashboardPage() {
  const navigate = useNavigate();

  const [exams, setExams] = useState<AdminExam[]>(
    [],
  );

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [importResult, setImportResult] =
    useState<AdminImportResult | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isImporting, setIsImporting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  function handleUnauthorized(
    caughtError: unknown,
  ): boolean {
    if (
      caughtError instanceof ApiError &&
      caughtError.status === 401
    ) {
      void navigate("/admin/logowanie", {
        replace: true,
      });

      return true;
    }

    return false;
  }

  async function loadExams(): Promise<void> {
    const loadedExams = await getAdminExams();

    setExams(loadedExams);
  }

  useEffect(() => {
    let requestIsActive = true;

    void getAdminSession()
      .then(async () => {
        const loadedExams = await getAdminExams();

        if (requestIsActive) {
          setExams(loadedExams);
        }
      })
      .catch((caughtError: unknown) => {
        if (handleUnauthorized(caughtError)) {
          return;
        }

        if (requestIsActive) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Nie udało się załadować panelu.",
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
  }, []);

  async function handleImport(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!selectedFile) {
      setError("Wybierz paczkę ZIP.");

      return;
    }

    setError(null);
    setImportResult(null);
    setIsImporting(true);

    try {
      const result =
        await importAdminExamPackage(selectedFile);

      setImportResult(result);

      await loadExams();
    } catch (caughtError) {
      if (handleUnauthorized(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się zaimportować paczki.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await logoutAdmin();
    } finally {
      void navigate("/admin/logowanie", {
        replace: true,
      });
    }
  }

  if (isLoading) {
    return (
      <main className="nautical-page admin-nautical-page">
        <p className="home-message">
          Ładowanie panelu administratora…
        </p>
      </main>
    );
  }

  return (
    <main className="nautical-page admin-nautical-page">
      <header className="admin-dashboard-header">
        <div>
          <p className="home-logo">Bosman</p>

          <p className="admin-nautical-eyebrow">
            Panel administratora
          </p>

          <h1>Zarządzanie egzaminami</h1>

          <p>
            Importuj pytania, przeglądaj egzaminy
            i zarządzaj wersjami publikowanymi.
          </p>
        </div>

        <div className="admin-dashboard-header__actions">
          <Link
            className="nautical-secondary-button"
            to="/"
          >
            Menu główne
          </Link>

          <button
            className="nautical-secondary-button"
            type="button"
            onClick={() => {
              void handleLogout();
            }}
          >
            Wyloguj się
          </button>
        </div>
      </header>

      {error && (
        <p className="home-message home-message--error">
          {error}
        </p>
      )}

      <section className="admin-nautical-card">
        <div className="admin-nautical-card__heading">
          <div className="admin-nautical-card__icon">
            <UploadIcon />
          </div>

          <div>
            <p className="admin-nautical-eyebrow">
              Import danych
            </p>

            <h2>Import paczki ZIP</h2>
          </div>
        </div>

        <p>
          Wybierz paczkę zawierającą plik
          <code> exam.json </code>
          oraz opcjonalny katalog
          <code> assets/</code>.
        </p>

        <form
          className="admin-nautical-import-form"
          onSubmit={(event) => {
            void handleImport(event);
          }}
        >
          <label className="admin-file-input">
            <span>
              {selectedFile
                ? selectedFile.name
                : "Wybierz paczkę ZIP"}
            </span>

            <input
              type="file"
              accept=".zip,application/zip"
              disabled={isImporting}
              onChange={(event) => {
                setSelectedFile(
                  event.target.files?.[0] ?? null,
                );
              }}
            />
          </label>

          <button
            className="admin-nautical-button"
            type="submit"
            disabled={
              isImporting || !selectedFile
            }
          >
            <span>
              {isImporting
                ? "Importowanie…"
                : "Zaimportuj jako szkic"}
            </span>

            <ArrowRightIcon />
          </button>
        </form>
      </section>

      {importResult && (
        <section className="admin-nautical-card">
          <p className="admin-nautical-eyebrow">
            Walidacja paczki
          </p>

          <h2>Raport ostatniego importu</h2>

          <dl className="admin-report-summary">
            <div>
              <dt>Import jako szkic</dt>

              <dd>
                {importResult.canImportAsDraft
                  ? "TAK"
                  : "NIE"}
              </dd>
            </div>

            <div>
              <dt>Publikacja bez zmian</dt>

              <dd>
                {importResult.canPublish
                  ? "TAK"
                  : "NIE"}
              </dd>
            </div>

            <div>
              <dt>Numer wersji</dt>

              <dd>
                {importResult.exam?.versionNumber ??
                  "—"}
              </dd>
            </div>
          </dl>

          <ReportList
            title="Informacje"
            items={importResult.report.information}
            variant="information"
          />

          <ReportList
            title="Blokady publikacji"
            items={
              importResult.report.publicationBlockers
            }
            variant="warning"
          />

          <ReportList
            title="Ostrzeżenia"
            items={importResult.report.warnings}
            variant="warning"
          />

          <ReportList
            title="Błędy blokujące import"
            items={importResult.report.errors}
            variant="error"
          />
        </section>
      )}

      <section className="admin-nautical-card">
        <p className="admin-nautical-eyebrow">
          Baza egzaminów
        </p>

        <h2>Egzaminy</h2>

        {exams.length === 0 ? (
          <p className="home-message">
            Nie zaimportowano jeszcze żadnego
            egzaminu.
          </p>
        ) : (
          <div className="admin-nautical-exam-list">
            {exams.map((exam) => (
              <article
                className="admin-nautical-exam-card"
                key={exam.id}
              >
                <div>
                  <p className="admin-nautical-exam-card__slug">
                    {exam.slug}
                  </p>

                  <h3>{exam.name}</h3>

                  <p>
                    {exam.description ??
                      "Brak opisu egzaminu."}
                  </p>
                </div>

                <div className="admin-nautical-exam-card__aside">
                  <dl>
                    <div>
                      <dt>Status</dt>

                      <dd>
                        {exam.isActive
                          ? "Aktywny"
                          : "Nieaktywny"}
                      </dd>
                    </div>

                    <div>
                      <dt>Aktualizacja</dt>

                      <dd>
                        {formatDate(exam.updatedAt)}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    className="admin-nautical-button"
                    to={`/admin/egzaminy/${exam.id}/wersje`}
                  >
                    <span>Zarządzaj wersjami</span>

                    <ArrowRightIcon />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}