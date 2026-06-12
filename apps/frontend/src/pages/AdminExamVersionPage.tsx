import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";

import {
  ApiError,
  getAdminExamVersion,
  publishAdminExamVersion,
  updateAdminExamVersionConfiguration,
  type AdminExamVersionDetails,
  type AdminExamVersionStatus,
} from "../api";

type EditableCategory = {
  id: string;
  slug: string;
  name: string;
  questionCount: number;
  minimumQuestions: string;
};

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

function toInputValue(
  value: number | null,
): string {
  return value === null ? "" : String(value);
}

function parseNullableInteger(
  value: string,
  label: string,
  minimumValue: number,
): number | null {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < minimumValue
  ) {
    throw new Error(
      `${label}: wpisz liczbę całkowitą nie mniejszą niż ${minimumValue}.`,
    );
  }

  return parsedValue;
}

export function AdminExamVersionPage() {
  const { versionId } = useParams();
  const navigate = useNavigate();

  const [version, setVersion] =
    useState<AdminExamVersionDetails | null>(null);

  const [durationMinutes, setDurationMinutes] =
    useState("");

  const [
    questionsPerAttempt,
    setQuestionsPerAttempt,
  ] = useState("");

  const [passingScore, setPassingScore] =
    useState("");

  const [randomQuestions, setRandomQuestions] =
    useState("");

  const [categories, setCategories] = useState<
    EditableCategory[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isPublishing, setIsPublishing] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  function applyVersion(
    loadedVersion: AdminExamVersionDetails,
  ): void {
    setVersion(loadedVersion);

    setDurationMinutes(
      toInputValue(loadedVersion.durationMinutes),
    );

    setQuestionsPerAttempt(
      toInputValue(
        loadedVersion.questionsPerAttempt,
      ),
    );

    setPassingScore(
      toInputValue(loadedVersion.passingScore),
    );

    setRandomQuestions(
      toInputValue(loadedVersion.randomQuestions),
    );

    setCategories(
      loadedVersion.categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        questionCount: category.questionCount,
        minimumQuestions: toInputValue(
          category.minimumQuestions,
        ),
      })),
    );
  }

  useEffect(() => {
    if (!versionId) {
      setError(
        "Brakuje identyfikatora wersji egzaminu.",
      );

      setIsLoading(false);

      return;
    }

    let requestIsActive = true;

    void getAdminExamVersion(versionId)
      .then((loadedVersion) => {
        if (requestIsActive) {
          applyVersion(loadedVersion);
        }
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
  }, [navigate, versionId]);

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

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!versionId) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      const updatedVersion =
        await updateAdminExamVersionConfiguration(
          versionId,
          {
            durationMinutes: parseNullableInteger(
              durationMinutes,
              "Czas trwania",
              1,
            ),

            questionsPerAttempt:
              parseNullableInteger(
                questionsPerAttempt,
                "Liczba pytań w próbie",
                1,
              ),

            passingScore: parseNullableInteger(
              passingScore,
              "Próg zaliczenia",
              1,
            ),

            randomQuestions: parseNullableInteger(
              randomQuestions,
              "Dodatkowe pytania losowe",
              0,
            ),

            categories: categories.map(
              (category) => ({
                id: category.id,

                minimumQuestions:
                  parseNullableInteger(
                    category.minimumQuestions,
                    `Minimum działu „${category.name}”`,
                    0,
                  ),
              }),
            ),
          },
        );

      applyVersion(updatedVersion);

      setMessage("Konfiguracja została zapisana.");
    } catch (caughtError) {
      if (handleUnauthorized(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się zapisać konfiguracji.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish(): Promise<void> {
    if (!versionId) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsPublishing(true);

    try {
      const publishedVersion =
        await publishAdminExamVersion(versionId);

      applyVersion(publishedVersion);

      setMessage(
        "Wersja została opublikowana i jest widoczna dla użytkowników.",
      );
    } catch (caughtError) {
      if (handleUnauthorized(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się opublikować wersji.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <p className="message">
          Ładowanie konfiguracji…
        </p>
      </main>
    );
  }

  if (error && !version) {
    return (
      <main className="page">
        <p className="message message--error">
          {error}
        </p>

        <Link className="text-link" to="/admin">
          ← Wróć do panelu administratora
        </Link>
      </main>
    );
  }

  if (!version) {
    return null;
  }

  const isEditable = version.status === "draft";

  return (
    <main className="page">
      <Link
        className="text-link"
        to={`/admin/egzaminy/${version.exam.id}/wersje`}
      >
        ← Wróć do listy wersji
      </Link>

      <header className="admin-header">
        <div>
          <p className="eyebrow">
            Panel administratora
          </p>

          <h1>
            {version.exam.name} — wersja{" "}
            {version.versionNumber}
          </h1>

          <p>
            Status:{" "}
            <strong>
              {translateStatus(version.status)}
            </strong>
          </p>
        </div>
      </header>

      {message && (
        <p className="message message--success">
          {message}
        </p>
      )}

      {error && (
        <p className="message message--error">
          {error}
        </p>
      )}

      {!isEditable && (
        <p className="message">
          Ta wersja nie jest już edytowalna.
          Zmiany wprowadź przez ponowny import
          paczki ZIP jako nowy szkic.
        </p>
      )}

      <form
        className="admin-version-form"
        onSubmit={(event) => {
          void handleSave(event);
        }}
      >
        <section className="admin-section">
          <h2>Podstawowe parametry</h2>

          <div className="admin-fields-grid">
            <label>
              <span>Czas trwania w minutach</span>

              <input
                type="number"
                min="1"
                value={durationMinutes}
                disabled={!isEditable || isSaving}
                onChange={(event) => {
                  setDurationMinutes(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label>
              <span>Liczba pytań w jednej próbie</span>

              <input
                type="number"
                min="1"
                value={questionsPerAttempt}
                disabled={!isEditable || isSaving}
                onChange={(event) => {
                  setQuestionsPerAttempt(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label>
              <span>Próg zaliczenia</span>

              <input
                type="number"
                min="1"
                value={passingScore}
                disabled={!isEditable || isSaving}
                onChange={(event) => {
                  setPassingScore(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label>
              <span>Dodatkowe pytania losowe</span>

              <input
                type="number"
                min="0"
                value={randomQuestions}
                disabled={!isEditable || isSaving}
                onChange={(event) => {
                  setRandomQuestions(
                    event.target.value,
                  );
                }}
              />
            </label>
          </div>
        </section>

        <section className="admin-section">
          <h2>Minimalna liczba pytań z działów</h2>

          <div className="admin-category-list">
            {categories.map((category) => (
              <label
                className="admin-category-row"
                key={category.id}
              >
                <span>
                  <strong>{category.name}</strong>

                  <small>
                    Dostępne pytania:{" "}
                    {category.questionCount}
                  </small>
                </span>

                <input
                  type="number"
                  min="0"
                  value={category.minimumQuestions}
                  disabled={!isEditable || isSaving}
                  onChange={(event) => {
                    const newValue =
                      event.target.value;

                    setCategories(
                      (currentCategories) =>
                        currentCategories.map(
                          (currentCategory) =>
                            currentCategory.id ===
                            category.id
                              ? {
                                  ...currentCategory,
                                  minimumQuestions:
                                    newValue,
                                }
                              : currentCategory,
                        ),
                    );
                  }}
                />
              </label>
            ))}
          </div>
        </section>

        {isEditable && (
          <div className="admin-version-actions">
            <button
              className="button"
              type="submit"
              disabled={isSaving || isPublishing}
            >
              {isSaving
                ? "Zapisywanie…"
                : "Zapisz konfigurację"}
            </button>
          </div>
        )}
      </form>

      <section className="admin-section">
        <h2>Gotowość do publikacji</h2>

        <dl className="import-report__summary">
          <div>
            <dt>Działy</dt>

            <dd>
              {
                version.publication.statistics
                  .categories
              }
            </dd>
          </div>

          <div>
            <dt>Pytania</dt>

            <dd>
              {
                version.publication.statistics
                  .questions
              }
            </dd>
          </div>

          <div>
            <dt>Nieprawidłowe pytania</dt>

            <dd>
              {
                version.publication.statistics
                  .invalidQuestions
              }
            </dd>
          </div>
        </dl>

        {version.publication.blockers.length > 0 ? (
          <section className="import-report__section import-report__section--warning">
            <h3>Blokady publikacji</h3>

            <ul>
              {version.publication.blockers.map(
                (blocker) => (
                  <li key={blocker}>{blocker}</li>
                ),
              )}
            </ul>
          </section>
        ) : (
          <p className="message message--success">
            Wersja spełnia warunki publikacji.
          </p>
        )}

        {isEditable && (
          <button
            className="button"
            type="button"
            disabled={
              !version.publication.canPublish ||
              isSaving ||
              isPublishing
            }
            onClick={() => {
              void handlePublish();
            }}
          >
            {isPublishing
              ? "Publikowanie…"
              : "Opublikuj wersję"}
          </button>
        )}
      </section>
    </main>
  );
}