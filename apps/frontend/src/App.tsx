import { Route, Routes } from "react-router";

import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminExamVersionPage } from "./pages/AdminExamVersionPage";
import { AdminExamVersionsPage } from "./pages/AdminExamVersionsPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminParticipantsPage } from "./pages/AdminParticipantsPage";
import { AttemptMistakesPage } from "./pages/AttemptMistakesPage";
import { AttemptPage } from "./pages/AttemptPage";
import { AttemptResultPage } from "./pages/AttemptResultPage";
import { ExamStartPage } from "./pages/ExamStartPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ParticipantLoginPage } from "./pages/ParticipantLoginPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route path="/historia" element={<HistoryPage />} />

      <Route path="/dostep" element={<ParticipantLoginPage />} />

      <Route path="/egzaminy/:slug" element={<ExamStartPage />} />

      <Route path="/proby/:attemptId" element={<AttemptPage />} />

      <Route path="/proby/:attemptId/wynik" element={<AttemptResultPage />} />

      <Route path="/proby/:attemptId/bledy" element={<AttemptMistakesPage />} />

      <Route path="/admin/logowanie" element={<AdminLoginPage />} />

      <Route path="/admin" element={<AdminDashboardPage />} />

      <Route path="/admin/uczestnicy" element={<AdminParticipantsPage />} />

      <Route
        path="/admin/egzaminy/:examId/wersje"
        element={<AdminExamVersionsPage />}
      />

      <Route
        path="/admin/wersje/:versionId"
        element={<AdminExamVersionPage />}
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
