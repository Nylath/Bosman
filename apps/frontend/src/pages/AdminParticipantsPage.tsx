import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router";

import {
  ApiError,
  createAdminParticipant,
  deleteAdminParticipant,
  getAdminAvailableExams,
  getAdminParticipants,
  getAdminSession,
  logoutAdmin,
  updateAdminParticipantExamAccess,
  type AdminAvailableExam,
  type AdminParticipant,
  type AdminParticipantExamAccess,
  type AdminRole,
} from "../api";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "bez terminu";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getTodayDateInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateInputValue(daysFromToday: number): string {
  const date = new Date();

  date.setDate(date.getDate() + daysFromToday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toEndOfDayDateTime(value: string): string {
  return `${value}T23:59:59.999`;
}

async function copyTextToClipboard(
  value: string,
): Promise<void> {
  await navigator.clipboard.writeText(value);
}


function getAccessStatusLabel(
  access: AdminParticipantExamAccess,
): string {
  if (!access.isActive || access.revokedAt) {
    return "Dostęp cofnięty";
  }

  const now = Date.now();

  if (new Date(access.validFrom).getTime() > now) {
    return `Dostęp zaplanowany od ${formatDateOnly(
      access.validFrom,
    )}`;
  }

  if (
    access.validUntil &&
    new Date(access.validUntil).getTime() < now
  ) {
    return `Dostęp wygasł ${formatDateOnly(
      access.validUntil,
    )}`;
  }

  return `Dostęp aktywny · ważny do ${formatDateOnly(
    access.validUntil,
  )}`;
}

function findParticipantAccess(
  participant: AdminParticipant,
  exam: AdminAvailableExam,
): AdminParticipantExamAccess | null {
  return (
    participant.examAccesses.find(
      (access) => access.examId === exam.id,
    ) ?? null
  );
}

export function AdminParticipantsPage() {
  const navigate = useNavigate();

  const [participants, setParticipants] = useState<
    AdminParticipant[]
  >([]);

  const [adminRole, setAdminRole] =
  useState<AdminRole | null>(null);

  const [availableExams, setAvailableExams] = useState<
    AdminAvailableExam[]
  >([]);

  const [newParticipantLabel, setNewParticipantLabel] =
    useState("");

  const [generatedAccessCode, setGeneratedAccessCode] =
    useState<string | null>(null);

    const [copiedAccessCode, setCopiedAccessCode] =
  useState(false);

  const [selectedParticipantId, setSelectedParticipantId] =
    useState("");

  const [selectedExamId, setSelectedExamId] = useState("");

  const [validUntil, setValidUntil] = useState(
    getDateInputValue(60),
  );

  const [isLoading, setIsLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);

  const [isUpdatingAccess, setIsUpdatingAccess] =
    useState(false);

  const [participantToDelete, setParticipantToDelete] =
  useState<AdminParticipant | null>(null);

const [isDeletingParticipant, setIsDeletingParticipant] =
  useState(false);

  const [error, setError] = useState<string | null>(null);

  const selectedParticipant = useMemo(
    () =>
      participants.find(
        (participant) =>
          participant.id === selectedParticipantId,
      ) ?? null,
    [participants, selectedParticipantId],
  );

  const selectedExam = useMemo(
    () =>
      availableExams.find(
        (exam) => exam.id === selectedExamId,
      ) ?? null,
    [availableExams, selectedExamId],
  );

  const isSystemAdmin = adminRole === "system";

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

  async function loadData(): Promise<void> {
    const [
      loadedParticipants,
      loadedAvailableExams,
    ] = await Promise.all([
      getAdminParticipants(),
      getAdminAvailableExams(),
    ]);

    setParticipants(loadedParticipants);
    setAvailableExams(loadedAvailableExams);

    if (
      !selectedParticipantId &&
      loadedParticipants[0]
    ) {
      setSelectedParticipantId(
        loadedParticipants[0].id,
      );
    }

    if (!selectedExamId && loadedAvailableExams[0]) {
      setSelectedExamId(loadedAvailableExams[0].id);
    }
  }

  useEffect(() => {
    let requestIsActive = true;

    void getAdminSession()
  .then(async (session) => {
    setAdminRole(session.role);

    await loadData();
  })
      .catch((caughtError: unknown) => {
        if (handleUnauthorized(caughtError)) {
          return;
        }

        if (requestIsActive) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Nie udało się załadować uczestników.",
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

  async function handleCreateParticipant(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const label = newParticipantLabel.trim();

    if (!label) {
      setError("Podaj nazwę uczestnika.");

      return;
    }

    setError(null);
    setGeneratedAccessCode(null);
    setCopiedAccessCode(false);
    setIsCreating(true);

    try {
      const result =
        await createAdminParticipant(label);

      setParticipants((currentParticipants) => [
        result.participant,
        ...currentParticipants,
      ]);

      setSelectedParticipantId(result.participant.id);
      setGeneratedAccessCode(result.accessCode);
      setNewParticipantLabel("");
    } catch (caughtError) {
      if (handleUnauthorized(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się dodać uczestnika.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleGrantAccess(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!selectedParticipant || !selectedExam) {
      setError(
        "Wybierz uczestnika i egzamin próbny.",
      );

      return;
    }

    setError(null);
    setIsUpdatingAccess(true);

    try {
      await updateAdminParticipantExamAccess({
        participantId: selectedParticipant.id,
        examId: selectedExam.id,
        isActive: true,
        validFrom: `${getTodayDateInputValue()}T00:00:00.000`,
        validUntil: validUntil
          ? toEndOfDayDateTime(validUntil)
          : null,
      });

      await loadData();
    } catch (caughtError) {
      if (handleUnauthorized(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się nadać dostępu.",
      );
    } finally {
      setIsUpdatingAccess(false);
    }
  }

  async function handleRevokeAccess(
    participant: AdminParticipant,
    access: AdminParticipantExamAccess,
  ): Promise<void> {
    setError(null);
    setIsUpdatingAccess(true);

    try {
      await updateAdminParticipantExamAccess({
        participantId: participant.id,
        examId: access.examId,
        isActive: false,
        validFrom: access.validFrom,
        validUntil: access.validUntil,
      });

      await loadData();
    } catch (caughtError) {
      if (handleUnauthorized(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się cofnąć dostępu.",
      );
    } finally {
      setIsUpdatingAccess(false);
    }
  }

  async function handleDeleteParticipant(): Promise<void> {
  if (!participantToDelete || !isSystemAdmin) {
  return;
}

  const deletedParticipantId = participantToDelete.id;

  setError(null);
  setIsDeletingParticipant(true);

  try {
    await deleteAdminParticipant(deletedParticipantId);

    const remainingParticipants = participants.filter(
      (participant) =>
        participant.id !== deletedParticipantId,
    );

    setParticipants(remainingParticipants);

    if (selectedParticipantId === deletedParticipantId) {
      setSelectedParticipantId(
        remainingParticipants[0]?.id ?? "",
      );
    }

    setParticipantToDelete(null);
  } catch (caughtError) {
    if (handleUnauthorized(caughtError)) {
      return;
    }

    setError(
      caughtError instanceof Error
        ? caughtError.message
        : "Nie udało się trwale usunąć uczestnika.",
    );
  } finally {
    setIsDeletingParticipant(false);
  }
}

  async function handleLogout(): Promise<void> {
    await logoutAdmin();

    void navigate("/admin/logowanie", {
      replace: true,
    });
  }

  if (isLoading) {
    return (
      <main className="nautical-page">
        <p className="home-message">
          Ładowanie uczestników…
        </p>
      </main>
    );
  }

  return (
    <main className="nautical-page admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div>
          <p className="home-logo">Bosman</p>

          <p className="admin-nautical-eyebrow">
  {isSystemAdmin
    ? "Panel administratora"
    : "Panel szkółki"}
</p>

<h1>
  {isSystemAdmin
    ? "Uczestnicy"
    : "Kursanci i dostępy"}
</h1>

<p>
  {isSystemAdmin
    ? "Dodawaj kursantów, generuj kody dostępu i przypisuj egzaminy próbne z osobną datą ważności."
    : "Zarządzaj kodami dostępu dla kursantów i przypisuj im egzaminy próbne dostępne w aplikacji."}
</p>
        </div>

        <div className="admin-dashboard-header__actions">
          {isSystemAdmin && (
  <Link
    className="nautical-secondary-button"
    to="/admin"
  >
    Wróć do panelu
  </Link>
)}

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
        <p className="admin-nautical-eyebrow">
          Nowy uczestnik
        </p>

        <h2>Dodaj uczestnika</h2>

        <form
          className="admin-participant-form"
          onSubmit={(event) => {
            void handleCreateParticipant(event);
          }}
        >
          <label>
            <span>Nazwa uczestnika</span>

            <input
              type="text"
              value={newParticipantLabel}
              placeholder="np. Jan Kowalski"
              disabled={isCreating}
              onChange={(event) => {
                setNewParticipantLabel(
                  event.target.value,
                );
              }}
            />
          </label>

          <button
            className="admin-nautical-button"
            type="submit"
            disabled={isCreating}
          >
            {isCreating
              ? "Dodawanie…"
              : "Dodaj i wygeneruj kod"}
          </button>
        </form>

        {generatedAccessCode && (
  <button
    className="admin-access-code-box"
    type="button"
    onClick={() => {
      void copyTextToClipboard(generatedAccessCode).then(
        () => {
          setCopiedAccessCode(true);
        },
      );
    }}
  >
    <p>
      {copiedAccessCode
        ? "Skopiowano kod dostępu"
        : "Kliknij, aby skopiować kod dostępu"}
    </p>

    <strong>{generatedAccessCode}</strong>

    <span>
      Skopiuj ten kod teraz. Ze względów
      bezpieczeństwa nie będzie później
      wyświetlany w takiej postaci.
    </span>
  </button>
)}
      </section>

      <section className="admin-nautical-card">
        <p className="admin-nautical-eyebrow">
          Dostępy do egzaminów
        </p>

        <h2>Nadaj dostęp</h2>

        {participants.length === 0 ? (
          <p className="home-message">
            Najpierw dodaj uczestnika.
          </p>
        ) : availableExams.length === 0 ? (
          <p className="home-message">
            Brakuje aktywnych opublikowanych
            egzaminów do przypisania.
          </p>
        ) : (
          <form
            className="admin-access-form"
            onSubmit={(event) => {
              void handleGrantAccess(event);
            }}
          >
            <label>
              <span>Uczestnik</span>

              <select
                value={selectedParticipantId}
                disabled={isUpdatingAccess}
                onChange={(event) => {
                  setSelectedParticipantId(
                    event.target.value,
                  );
                }}
              >
                {participants.map((participant) => (
                  <option
                    key={participant.id}
                    value={participant.id}
                  >
                    {participant.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Egzamin próbny</span>

              <select
                value={selectedExamId}
                disabled={isUpdatingAccess}
                onChange={(event) => {
                  setSelectedExamId(event.target.value);
                }}
              >
                {availableExams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Dostęp ważny do</span>

              <input
                type="date"
                value={validUntil}
                disabled={isUpdatingAccess}
                onChange={(event) => {
                  setValidUntil(event.target.value);
                }}
              />
            </label>

            <button
              className="admin-nautical-button"
              type="submit"
              disabled={isUpdatingAccess}
            >
              {isUpdatingAccess
                ? "Zapisywanie…"
                : "Nadaj / zmień dostęp"}
            </button>
          </form>
        )}
      </section>

      <section className="admin-nautical-card">
        <p className="admin-nautical-eyebrow">
          Lista uczestników
        </p>

        <h2>Uczestnicy i dostępy</h2>

        {participants.length === 0 ? (
          <p className="home-message">
            Nie dodano jeszcze żadnych uczestników.
          </p>
        ) : (
          <div className="admin-participants-list">
            {participants.map((participant) => (
              <article
                className="admin-participant-card"
                key={participant.id}
              >
                <header>
                  <div>
                    <h3>{participant.label}</h3>

                    <p>
                      Dodano:{" "}
                      {formatDateTime(participant.createdAt)}
                    </p>
                  </div>

                  <div className="admin-participant-card__header-actions">
  <span
    className={
      participant.isActive
        ? "admin-status-pill admin-status-pill--active"
        : "admin-status-pill admin-status-pill--inactive"
    }
  >
    {participant.isActive
      ? "aktywny"
      : "nieaktywny"}
  </span>

  {isSystemAdmin && (
  <button
    className="admin-danger-outline-button"
    type="button"
    disabled={isDeletingParticipant}
    onClick={() => {
      setParticipantToDelete(participant);
    }}
  >
    Usuń trwale
  </button>
)}
</div>
                </header>

                <div className="admin-participant-access-grid">
                  {availableExams.map((exam) => {
                    const access =
                      findParticipantAccess(
                        participant,
                        exam,
                      );

                    

                    return (
                      <div
                        className="admin-participant-access-row"
                        key={exam.id}
                      >
                        <div>
                          <strong>{exam.name}</strong>

                          <span>{exam.slug}</span>
                        </div>

                        {access ? (
                          <>
                            <p>{getAccessStatusLabel(access)}</p>

                            <button
                              type="button"
                              className="admin-small-danger-button"
                              disabled={
                                isUpdatingAccess ||
                                !access.isActive
                              }
                              onClick={() => {
                                void handleRevokeAccess(
                                  participant,
                                  access,
                                );
                              }}
                            >
                              Cofnij dostęp
                            </button>
                          </>
                        ) : (
                          <p>Brak dostępu</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {participantToDelete && (
  <div className="admin-delete-modal-backdrop">
    <section
      aria-modal="true"
      className="admin-delete-modal"
      role="dialog"
    >
      <p className="admin-nautical-eyebrow">
        Trwałe usunięcie
      </p>

      <h2>Usunąć uczestnika?</h2>

      <p>
        Usuniesz uczestnika{" "}
        <strong>{participantToDelete.label}</strong>{" "}
        razem z jego kodami dostępu, sesjami,
        dostępami do egzaminów, podejściami i historią
        wyników.
      </p>

      <p>
        Tej operacji nie można cofnąć.
      </p>

      <div className="admin-delete-modal__actions">
        <button
          className="nautical-secondary-button"
          type="button"
          disabled={isDeletingParticipant}
          onClick={() => {
            setParticipantToDelete(null);
          }}
        >
          Anuluj
        </button>

        <button
          className="admin-danger-button"
          type="button"
          disabled={isDeletingParticipant}
          onClick={() => {
            void handleDeleteParticipant();
          }}
        >
          {isDeletingParticipant
            ? "Usuwanie…"
            : "Usuń trwale"}
        </button>
      </div>
    </section>
  </div>
)}
    </main>
  );
}