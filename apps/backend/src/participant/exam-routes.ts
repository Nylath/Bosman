import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/client.js";

import { requireParticipantSession } from "./middleware.js";

const examSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

type ParticipantSessionContext = {
  participantId: string;
  organizationId: string;
};

type ParticipantExamRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tileImagePath: string | null;

  versionId: string;
  versionNumber: number;
  durationMinutes: number;
  questionsPerAttempt: number;
  passingScore: number;
  answersPerQuestion: number;
};

function getParticipantSession(
  response: Response,
): ParticipantSessionContext {
  const session =
    response.locals.participantSession;

  if (
    !session ||
    typeof session.participantId !== "string" ||
    typeof session.organizationId !== "string"
  ) {
    throw new Error(
      "Nie znaleziono sesji kursanta.",
    );
  }

  return {
    participantId: session.participantId,
    organizationId: session.organizationId,
  };
}

function getAssetUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return `/assets/${path}`;
}

function mapExam(row: ParticipantExamRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    tileImageUrl: getAssetUrl(row.tileImagePath),

    version: {
      id: row.versionId,
      number: row.versionNumber,
      durationMinutes: row.durationMinutes,
      questionsPerAttempt: row.questionsPerAttempt,
      passingScore: row.passingScore,
      answersPerQuestion: row.answersPerQuestion,
    },
  };
}

export const participantExamRouter = Router();

participantExamRouter.get(
  "/",
  requireParticipantSession,
  async (_request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const result =
        await pool.query<ParticipantExamRow>(
          `
            SELECT
              e.id,
              e.slug,
              e.name,
              e.description,
              COALESCE(
                ev.tile_image_path,
                e.tile_image_path
              ) AS "tileImagePath",
              ev.id AS "versionId",
              ev.version_number AS "versionNumber",
              ev.duration_minutes AS "durationMinutes",
              ev.questions_per_attempt AS "questionsPerAttempt",
              ev.passing_score AS "passingScore",
              ev.answers_per_question AS "answersPerQuestion"
            FROM participant_exam_accesses pea
            INNER JOIN exams e
              ON e.id = pea.exam_id
            INNER JOIN LATERAL (
              SELECT *
              FROM exam_versions latest_ev
              WHERE latest_ev.exam_id = e.id
                AND latest_ev.status = 'published'
                AND latest_ev.duration_minutes IS NOT NULL
                AND latest_ev.questions_per_attempt IS NOT NULL
                AND latest_ev.passing_score IS NOT NULL
              ORDER BY
                latest_ev.published_at DESC NULLS LAST,
                latest_ev.version_number DESC
              LIMIT 1
            ) ev ON TRUE
            WHERE pea.participant_id = $1
              AND e.organization_id = $2
              AND e.is_active = TRUE
              AND pea.is_active = TRUE
              AND pea.revoked_at IS NULL
              AND pea.valid_from <= NOW()
              AND (
                pea.valid_until IS NULL
                OR pea.valid_until > NOW()
              )
            ORDER BY e.name;
          `,
          [
            session.participantId,
            session.organizationId,
          ],
        );

      response.json({
        exams: result.rows.map(mapExam),
      });
    } catch (error) {
      next(error);
    }
  },
);

participantExamRouter.get(
  "/:slug",
  requireParticipantSession,
  async (request, response, next) => {
    try {
      const session = getParticipantSession(response);

      const parsedSlug = examSlugSchema.safeParse(
        request.params.slug,
      );

      if (!parsedSlug.success) {
        response.status(400).json({
          message: "Nieprawidłowy adres egzaminu.",
        });

        return;
      }

      const result =
        await pool.query<ParticipantExamRow>(
          `
            SELECT
              e.id,
              e.slug,
              e.name,
              e.description,
              COALESCE(
                ev.tile_image_path,
                e.tile_image_path
              ) AS "tileImagePath",
              ev.id AS "versionId",
              ev.version_number AS "versionNumber",
              ev.duration_minutes AS "durationMinutes",
              ev.questions_per_attempt AS "questionsPerAttempt",
              ev.passing_score AS "passingScore",
              ev.answers_per_question AS "answersPerQuestion"
            FROM participant_exam_accesses pea
            INNER JOIN exams e
              ON e.id = pea.exam_id
            INNER JOIN LATERAL (
              SELECT *
              FROM exam_versions latest_ev
              WHERE latest_ev.exam_id = e.id
                AND latest_ev.status = 'published'
                AND latest_ev.duration_minutes IS NOT NULL
                AND latest_ev.questions_per_attempt IS NOT NULL
                AND latest_ev.passing_score IS NOT NULL
              ORDER BY
                latest_ev.published_at DESC NULLS LAST,
                latest_ev.version_number DESC
              LIMIT 1
            ) ev ON TRUE
            WHERE pea.participant_id = $1
              AND e.organization_id = $2
              AND e.slug = $3
              AND e.is_active = TRUE
              AND pea.is_active = TRUE
              AND pea.revoked_at IS NULL
              AND pea.valid_from <= NOW()
              AND (
                pea.valid_until IS NULL
                OR pea.valid_until > NOW()
              )
            LIMIT 1;
          `,
          [
            session.participantId,
            session.organizationId,
            parsedSlug.data,
          ],
        );

      const exam = result.rows[0];

      if (!exam) {
        response.status(404).json({
          message:
            "Nie znaleziono egzaminu albo nie masz do niego dostępu.",
        });

        return;
      }

      response.json({
        exam: mapExam(exam),
      });
    } catch (error) {
      next(error);
    }
  },
);