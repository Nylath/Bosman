import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="page page--narrow">
      <section className="exam-start">
        <p className="eyebrow">Błąd 404</p>

        <h1>Nie znaleziono strony</h1>

        <Link className="text-link" to="/">
          ← Wróć na ekran główny
        </Link>
      </section>
    </main>
  );
}