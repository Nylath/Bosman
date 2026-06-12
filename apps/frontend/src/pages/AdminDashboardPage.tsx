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

function ReportList(props: {
  title: string;
  items: string[];
  variant:
    | "information"
    | "warning"
    | "error";
}) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <section
      className={`import-report__section import-report__section--${props.variant}`}
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
      <main className="page">
        <p className="message">
          Ładowanie panelu administratora…
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">
            Panel administratora
          </p>

          <h1>Zarządzanie egzaminami</h1>
        </div>

        <div className="admin-header__actions">
          <Link
            className="button button--secondary"
            to="/"
          >
            Menu główne
          </Link>

          <button
            className="button button--secondary"
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
        <p className="message message--error">
          {error}
        </p>
      )}

      <section className="admin-section">
        <h2>Import paczki ZIP</h2>

        <p>
          Wybierz paczkę zawierającą plik
          <code> exam.json </code>
          oraz opcjonalny katalog
          <code> assets/</code>.
        </p>

        <form
          className="admin-import-form"
          onSubmit={(event) => {
            void handleImport(event);
          }}
        >
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

          <button
            className="button"
            type="submit"
            disabled={
              isImporting || !selectedFile
            }
          >
            {isImporting
              ? "Importowanie…"
              : "Zaimportuj jako szkic"}
          </button>
        </form>
      </section>

      {importResult && (
        <section className="admin-section import-report">
          <h2>Raport ostatniego importu</h2>

          <dl className="import-report__summary">
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

      <section className="admin-section">
        <h2>Egzaminy</h2>

        {exams.length === 0 ? (
          <p className="message">
            Nie zaimportowano jeszcze żadnego
            egzaminu.
          </p>
        ) : (
          <div className="admin-exam-list">
            {exams.map((exam) => (
              <article
                className="admin-exam-card"
                key={exam.id}
              >
                <div>
                  <p className="admin-exam-card__slug">
                    {exam.slug}
                  </p>

                  <h3>{exam.name}</h3>

                  <p>
                    {exam.description ??
                      "Brak opisu egzaminu."}
                  </p>
                </div>

                <div className="admin-exam-card__aside">
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
    className="button button--secondary"
    to={`/admin/egzaminy/${exam.id}/wersje`}
  >
    Zarządzaj wersjami
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