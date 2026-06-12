import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { config } from "../config.js";
import { submitLocalAttemptAnswer } from "../exams/attempt-answer-management.js";
import {
  getLocalAttempt,
  startOrResumeLocalAttempt,
} from "../exams/attempt-management.js";
import {
  getLocalAttemptHistory,
  getLocalAttemptMistakes,
  getLocalAttemptResult,
} from "../exams/attempt-review-management.js";

const examSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const attemptIdSchema = z.string().uuid();

const submitAnswerSchema = z
  .object({
    attemptQuestionId: z.string().uuid(),
    selectedAnswerId: z.string().uuid(),
  })
  .strict();

function ensureLocalMode(response: Response): boolean {
  if (config.appMode === "LOCAL") {
    return true;
  }

  response.status(501).json({
    message:
      "Próby w trybie SCHOOL zostaną włączone razem z logowaniem kursantów.",
  });

  return false;
}

export const publicAttemptRouter = Router();

publicAttemptRouter.post(
  "/exams/:slug/attempts",
  async (request, response, next) => {
    try {
      if (!ensureLocalMode(response)) {
        return;
      }

      const parsedSlug = examSlugSchema.safeParse(
        request.params.slug,
      );

      if (!parsedSlug.success) {
        response.status(400).json({
          message: "Nieprawidłowy adres egzaminu.",
        });

        return;
      }

      const result = await startOrResumeLocalAttempt(
        parsedSlug.data,
      );

      if (result.status === "not_found") {
        response.status(404).json({
          message:
            "Nie znaleziono opublikowanego egzaminu.",
        });

        return;
      }

      response
        .status(result.created ? 201 : 200)
        .json(result);
    } catch (error) {
      next(error);
    }
  },
);

publicAttemptRouter.get(
  "/attempts/:attemptId",
  async (request, response, next) => {
    try {
      if (!ensureLocalMode(response)) {
        return;
      }

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const attempt = await getLocalAttempt(
        parsedAttemptId.data,
      );

      if (!attempt) {
        response.status(404).json({
          message:
            "Nie znaleziono próby egzaminacyjnej.",
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

publicAttemptRouter.post(
  "/attempts/:attemptId/answers",
  async (request, response, next) => {
    try {
      if (!ensureLocalMode(response)) {
        return;
      }

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const parsedBody = submitAnswerSchema.safeParse(
        request.body,
      );

      if (!parsedBody.success) {
        response.status(400).json({
          message: "Nieprawidłowe dane odpowiedzi.",
          errors: parsedBody.error.issues,
        });

        return;
      }

      const result = await submitLocalAttemptAnswer({
        attemptId: parsedAttemptId.data,
        attemptQuestionId:
          parsedBody.data.attemptQuestionId,
        selectedAnswerId:
          parsedBody.data.selectedAnswerId,
      });

      if (result.status === "not_found") {
        response.status(404).json({
          message:
            "Nie znaleziono próby egzaminacyjnej.",
        });

        return;
      }

      if (result.status === "not_in_progress") {
        response.status(409).json({
          message:
            "Próba egzaminacyjna nie jest już aktywna.",
        });

        return;
      }

      if (result.status === "invalid_question") {
        response.status(409).json({
          message:
            "Możesz odpowiedzieć wyłącznie na aktualne pytanie.",
        });

        return;
      }

      if (result.status === "invalid_answer") {
        response.status(400).json({
          message:
            "Wybrana odpowiedź nie należy do aktualnego pytania.",
        });

        return;
      }

      if (result.status === "already_answered") {
        response.status(409).json({
          message:
            "Odpowiedź na to pytanie została już zapisana.",
        });

        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  },
);

publicAttemptRouter.get(
  "/attempts/:attemptId/result",
  async (request, response, next) => {
    try {
      if (!ensureLocalMode(response)) {
        return;
      }

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const result = await getLocalAttemptResult(
        parsedAttemptId.data,
      );

      if (result.status === "not_found") {
        response.status(404).json({
          message:
            "Nie znaleziono próby egzaminacyjnej.",
        });

        return;
      }

      if (result.status === "not_finished") {
        response.status(409).json({
          message:
            "Próba egzaminacyjna nie została jeszcze zakończona.",
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

publicAttemptRouter.get(
  "/attempts/:attemptId/mistakes",
  async (request, response, next) => {
    try {
      if (!ensureLocalMode(response)) {
        return;
      }

      const parsedAttemptId = attemptIdSchema.safeParse(
        request.params.attemptId,
      );

      if (!parsedAttemptId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator próby.",
        });

        return;
      }

      const result = await getLocalAttemptMistakes(
        parsedAttemptId.data,
      );

      if (result.status === "not_found") {
        response.status(404).json({
          message:
            "Nie znaleziono próby egzaminacyjnej.",
        });

        return;
      }

      if (result.status === "not_finished") {
        response.status(409).json({
          message:
            "Próba egzaminacyjna nie została jeszcze zakończona.",
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

publicAttemptRouter.get(
  "/history",
  async (_request, response, next) => {
    try {
      if (!ensureLocalMode(response)) {
        return;
      }

      const attempts = await getLocalAttemptHistory();

      response.json({
        attempts,
      });
    } catch (error) {
      next(error);
    }
  },
);