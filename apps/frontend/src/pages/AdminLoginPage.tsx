import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router";

import {
  ApiError,
  getAdminSession,
  loginAdmin,
} from "../api";

export function AdminLoginPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let requestIsActive = true;

    void getAdminSession()
      .then(() => {
        if (requestIsActive) {
          void navigate("/admin", {
            replace: true,
          });
        }
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof ApiError &&
          caughtError.status === 401
        ) {
          return;
        }

        if (requestIsActive) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Nie udało się sprawdzić sesji.",
          );
        }
      });

    return () => {
      requestIsActive = false;
    };
  }, [navigate]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      await loginAdmin(password);

      void navigate("/admin", {
        replace: true,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się zalogować.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page page--narrow">
      <Link className="text-link" to="/">
        ← Wróć do menu głównego
      </Link>

      <section className="admin-login">
        <p className="eyebrow">
          Panel administratora
        </p>

        <h1>Zaloguj się</h1>

        <p>
          Podaj hasło administratora, aby zarządzać
          bazami pytań i wersjami egzaminów.
        </p>

        <form
          className="admin-form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <label>
            <span>Hasło administratora</span>

            <input
              type="password"
              value={password}
              autoComplete="current-password"
              disabled={isSubmitting}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
          </label>

          {error && (
            <p className="message message--error">
              {error}
            </p>
          )}

          <button
            className="button"
            type="submit"
            disabled={
              isSubmitting || password.length === 0
            }
          >
            {isSubmitting
              ? "Logowanie…"
              : "Zaloguj się"}
          </button>
        </form>
      </section>
    </main>
  );
}