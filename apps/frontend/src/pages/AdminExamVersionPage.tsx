import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
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

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-3.5 2-1-2-3-2.2.6a7.8 7.8 0 0 0-1.4-.8L15 4.5h-6l-.4 2.3c-.5.2-1 .5-1.4.8L5 7l-2 3 2 1v2l-2 1 2 3 2.2-.6c.4.3.9.6 1.4.8L9 19.5h6l.4-2.3c.5-.2 1-.5 1.4-.8L19 17l2-3-2-1v-1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CategoriesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 6h14M5 12h14M5 18h14M3 6h.01M3 12h.01M3 18h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="m5 12 4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function PublishIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 16V4m0 0L8 8m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
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

  const applyVersion = useCallback(
  (
    loadedVersion: AdminExamVersionDetails,
  ): void => {
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
  },
  [],
);

  const handleUnauthorized = useCallback(
  (caughtError: unknown): boolean => {
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
  },
  [navigate],
);

  useEffect(() => {
  if (!versionId) {
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
      if (!requestIsActive) {
        return;
      }

      if (handleUnauthorized(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się pobrać wersji.",
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
}, [
  applyVersion,
  handleUnauthorized,
  versionId,
]);

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

  if (!versionId) {
  return (
    <main className="nautical-page admin-nautical-page">
      <p className="home-logo">Bosman</p>

      <Link
        className="nautical-back-link"
        to="/admin"
      >
        <ArrowLeftIcon />

        <span>Wróć do panelu administratora</span>
      </Link>

      <p className="home-message home-message--error">
        Brakuje identyfikatora wersji egzaminu.
      </p>
    </main>
  );
}

  if (isLoading) {
    return (
      <main className="nautical-page admin-nautical-page">
        <p className="home-message">
          Ładowanie konfiguracji…
        </p>
      </main>
    );
  }

  if (error && !version) {
    return (
      <main className="nautical-page admin-nautical-page">
        <p className="home-message home-message--error">
          {error}
        </p>

        <Link className="nautical-back-link" to="/admin">
          <ArrowLeftIcon />

          <span>Wróć do panelu administratora</span>
        </Link>
      </main>
    );
  }

  if (!version) {
    return null;
  }

  const isEditable = version.status === "draft";

  return (
    <main className="nautical-page admin-nautical-page">
      <p className="home-logo">Bosman</p>

      <Link
        className="nautical-back-link"
        to={`/admin/egzaminy/${version.exam.id}/wersje`}
      >
        <ArrowLeftIcon />

        <span>Wróć do listy wersji</span>
      </Link>

      <header className="admin-version-header">
        <p className="admin-nautical-eyebrow">
          Konfiguracja wersji
        </p>

        <h1>{version.exam.name}</h1>

        <div className="admin-version-header__meta">
          <span>
            Wersja {version.versionNumber}
          </span>

          <span
            className={`admin-version-status admin-version-status--${version.status}`}
          >
            {translateStatus(version.status)}
          </span>
        </div>
      </header>

      {message && (
        <p className="home-message admin-version-message--success">
          {message}
        </p>
      )}

      {error && (
        <p className="home-message home-message--error">
          {error}
        </p>
      )}

      {!isEditable && (
        <p className="home-message">
          Ta wersja nie jest już edytowalna. Zmiany
          wprowadź przez ponowny import paczki ZIP
          jako nowy szkic.
        </p>
      )}

      <form
        className="admin-version-nautical-form"
        onSubmit={(event) => {
          void handleSave(event);
        }}
      >
        <section className="admin-nautical-card">
          <div className="admin-nautical-card__heading">
            <div className="admin-nautical-card__icon">
              <SettingsIcon />
            </div>

            <div>
              <p className="admin-nautical-eyebrow">
                Ustawienia egzaminu
              </p>

              <h2>Podstawowe parametry</h2>
            </div>
          </div>

          <div className="admin-version-fields">
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

        <section className="admin-nautical-card">
          <div className="admin-nautical-card__heading">
            <div className="admin-nautical-card__icon">
              <CategoriesIcon />
            </div>

            <div>
              <p className="admin-nautical-eyebrow">
                Reguły losowania
              </p>

              <h2>
                Minimalna liczba pytań z działów
              </h2>
            </div>
          </div>

          <div className="admin-version-category-list">
            {categories.map((category) => (
              <label
                className="admin-version-category-row"
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
          <div className="admin-version-save-row">
            <button
              className="admin-nautical-button"
              type="submit"
              disabled={isSaving || isPublishing}
            >
              <span>
                {isSaving
                  ? "Zapisywanie…"
                  : "Zapisz konfigurację"}
              </span>

              <ArrowRightIcon />
            </button>
          </div>
        )}
      </form>

      <section className="admin-nautical-card">
        <div className="admin-nautical-card__heading">
          <div className="admin-nautical-card__icon">
            <PublishIcon />
          </div>

          <div>
            <p className="admin-nautical-eyebrow">
              Kontrola jakości
            </p>

            <h2>Gotowość do publikacji</h2>
          </div>
        </div>

        <dl className="admin-version-statistics">
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
          <section className="admin-report-section admin-report-section--warning">
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
          <div className="admin-version-ready">
            <div className="admin-version-ready__icon">
              <CheckIcon />
            </div>

            <span>
              Wersja spełnia warunki publikacji.
            </span>
          </div>
        )}

        {isEditable && (
          <button
            className="admin-nautical-button admin-version-publish-button"
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
            <span>
              {isPublishing
                ? "Publikowanie…"
                : "Opublikuj wersję"}
            </span>

            <PublishIcon />
          </button>
        )}
      </section>
    </main>
  );
}