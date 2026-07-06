import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";

import {
  getActiveParticipantAttemptForExam,
  getParticipantAttempt,
  startOrResumeParticipantAttempt,
} from "../exams/attempt-management.js";

import {
  getParticipantAttemptHistory,
  getParticipantAttemptMistakes,
  getParticipantAttemptResult,
} from "../exams/attempt-review-management.js";

import { requireParticipantSession } from "./middleware.js";
import { submitParticipantAttemptAnswer } from "./attempt-answer-management.js";
import { cancelParticipantAttempt } from "../exams/attempt-cancellation-management.js";

const examSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const attemptIdSchema = z.string().uuid();

const submitAnswerSchema = z.object({
  attemptQuestionId: z.string().uuid(),
  selectedAnswerId: z.string().uuid(),
});

type ParticipantSessionContext = {
  participantId: string;
  organizationId: string;
};

function getParticipantSession(response: Response): ParticipantSessionContext {
  const session = response.locals.participantSession;

  if (
    !session ||
    typeof session.participantId !== "string" ||
    typeof session.organizationId !== "string"
  ) {
    throw new Error("Nie znaleziono sesji kursanta.");
  }

  return {
    participantId: session.participantId,
    organizationId: session.organizationId,
  };
}

export const participantAttemptRouter = Router();

participantAttemptRouter.post(
  "/attempts/:attemptId/cancel",
  requireParticipantSession,
  async (request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const result = await cancelParticipantAttempt({
        participantId: session.participantId,
        attemptId: parsedAttemptId.data,
      });

      if (result.status === "not_found") {
        response.status(404).json({
          message: "Nie znaleziono próby egzaminacyjnej.",
        });

        return;
      }

      if (result.status === "not_in_progress") {
        response.status(409).json({
          message: "Próba egzaminacyjna nie jest już aktywna.",
        });

        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  },
);

participantAttemptRouter.post(
  "/exams/:slug/attempts",
  requireParticipantSession,
  async (request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const parsedSlug = examSlugSchema.safeParse(request.params.slug);

      if (!parsedSlug.success) {
        response.status(400).json({
          message: "Nieprawidłowy adres egzaminu.",
        });

        return;
      }

      const result = await startOrResumeParticipantAttempt({
        organizationId: session.organizationId,
        participantId: session.participantId,
        examSlug: parsedSlug.data,
      });

      if (result.status === "not_found") {
        response.status(404).json({
          message:
            "Nie znaleziono egzaminu albo nie masz do niego aktywnego dostępu.",
        });

        return;
      }

      response.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

participantAttemptRouter.get(
  "/exams/:slug/attempts/active",
  requireParticipantSession,
  async (request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const parsedSlug = examSlugSchema.safeParse(request.params.slug);

      if (!parsedSlug.success) {
        response.status(400).json({
          message: "Nieprawidłowy adres egzaminu.",
        });

        return;
      }

      const attempt = await getActiveParticipantAttemptForExam({
        organizationId: session.organizationId,
        participantId: session.participantId,
        examSlug: parsedSlug.data,
      });

      response.json({
        attempt,
      });
    } catch (error) {
      next(error);
    }
  },
);

participantAttemptRouter.get(
  "/attempts/:attemptId",
  requireParticipantSession,
  async (request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const attempt = await getParticipantAttempt({
        participantId: session.participantId,
        attemptId: parsedAttemptId.data,
      });

      if (!attempt) {
        response.status(404).json({
          message: "Nie znaleziono próby egzaminacyjnej.",
        });

        return;
      }

      response.json({
        attempt,
      });
    } catch (error) {
      next(error);
    }
  },
);

participantAttemptRouter.post(
  "/attempts/:attemptId/answers",
  requireParticipantSession,
  async (request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const parsedBody = submitAnswerSchema.safeParse(request.body);

      if (!parsedBody.success) {
        response.status(400).json({
          message: "Nieprawidłowe dane odpowiedzi.",
          errors: parsedBody.error.issues,
        });

        return;
      }

      const result = await submitParticipantAttemptAnswer({
        participantId: session.participantId,
        attemptId: parsedAttemptId.data,
        attemptQuestionId: parsedBody.data.attemptQuestionId,
        selectedAnswerId: parsedBody.data.selectedAnswerId,
      });

      if (result.status === "not_found") {
        response.status(404).json({
          message: "Nie znaleziono próby egzaminacyjnej.",
        });

        return;
      }

      if (result.status === "not_in_progress") {
        response.status(409).json({
          message: "Próba egzaminacyjna nie jest już aktywna.",
        });

        return;
      }

      if (result.status === "invalid_question") {
        response.status(409).json({
          message: "Możesz odpowiedzieć wyłącznie na aktualne pytanie.",
        });

        return;
      }

      if (result.status === "invalid_answer") {
        response.status(400).json({
          message: "Wybrana odpowiedź nie należy do aktualnego pytania.",
        });

        return;
      }

      if (result.status === "already_answered") {
        response.status(409).json({
          message: "Odpowiedź na to pytanie została już zapisana.",
        });

        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  },
);

participantAttemptRouter.get(
  "/attempts/:attemptId/result",
  requireParticipantSession,
  async (request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const result = await getParticipantAttemptResult({
        participantId: session.participantId,
        attemptId: parsedAttemptId.data,
      });

      if (result.status === "not_found") {
        response.status(404).json({
          message: "Nie znaleziono próby egzaminacyjnej.",
        });

        return;
      }

      if (result.status === "not_finished") {
        response.status(409).json({
          message: "Próba egzaminacyjna nie została jeszcze zakończona.",
        });

        return;
      }

      response.json({
        result: result.result,
      });
    } catch (error) {
      next(error);
    }
  },
);

participantAttemptRouter.get(
  "/attempts/:attemptId/mistakes",
  requireParticipantSession,
  async (request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const result = await getParticipantAttemptMistakes({
        participantId: session.participantId,
        attemptId: parsedAttemptId.data,
      });

      if (result.status === "not_found") {
        response.status(404).json({
          message: "Nie znaleziono próby egzaminacyjnej.",
        });

        return;
      }

      if (result.status === "not_finished") {
        response.status(409).json({
          message: "Próba egzaminacyjna nie została jeszcze zakończona.",
        });

        return;
      }

      response.json({
        mistakes: result.mistakes,
      });
    } catch (error) {
      next(error);
    }
  },
);

participantAttemptRouter.get(
  "/history",
  requireParticipantSession,
  async (_request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const attempts = await getParticipantAttemptHistory({
        participantId: session.participantId,
      });

      response.json({
        attempts,
      });
    } catch (error) {
      next(error);
    }
  },
);
