import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { assetStorage } from "../assets/index.js";
import { config } from "../config.js";
import { pool } from "../db/client.js";

const LOCAL_ORGANIZATION_SLUG = "bosman-local";

const examSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

type PublicExamRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tile_image_path: string | null;
  version_id: string;
  version_number: number;
  duration_minutes: number;
  questions_per_attempt: number;
  passing_score: number;
  answers_per_question: number;
};

function ensureLocalMode(response: Response): boolean {
  if (config.appMode === "LOCAL") {
    return true;
  }

  response.status(501).json({
    message:
      "Lista egzaminów dla trybu SCHOOL zostanie włączona razem z logowaniem kursantów.",
  });

  return false;
}

async function getLocalOrganizationId(): Promise<string> {
  const result = await pool.query<{
    id: string;
  }>(
    `
      SELECT id
      FROM organizations
      WHERE slug = $1
        AND is_active = TRUE
      LIMIT 1;
    `,
    [LOCAL_ORGANIZATION_SLUG],
  );

  const organization = result.rows[0];

  if (!organization) {
    throw new Error('Nie znaleziono aktywnej organizacji "bosman-local".');
  }

  return organization.id;
}

function getTileImageUrl(tileImagePath: string | null): string | null {
  if (!tileImagePath) {
    return null;
  }

  return assetStorage.getPublicUrl(tileImagePath);
}

function mapExam(row: PublicExamRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    tileImageUrl: getTileImageUrl(row.tile_image_path),

    version: {
      id: row.version_id,
      number: row.version_number,
      durationMinutes: row.duration_minutes,
      questionsPerAttempt: row.questions_per_attempt,
      passingScore: row.passing_score,
      answersPerQuestion: row.answers_per_question,
    },
  };
}

const selectPublishedExamSql = `
  SELECT
    e.id,
    e.slug,
    e.name,
    e.description,
    ev.tile_image_path,
    ev.id AS version_id,
    ev.version_number,
    ev.duration_minutes,
    ev.questions_per_attempt,
    ev.passing_score,
    ev.answers_per_question
  FROM exams e
  INNER JOIN LATERAL (
    SELECT
      id,
      version_number,
      tile_image_path,
      duration_minutes,
      questions_per_attempt,
      passing_score,
      answers_per_question
    FROM exam_versions
    WHERE exam_id = e.id
      AND status = 'published'
    ORDER BY version_number DESC
    LIMIT 1
  ) ev ON TRUE
`;

export const publicExamRouter = Router();

publicExamRouter.get("/", async (_request, response, next) => {
  try {
    if (!ensureLocalMode(response)) {
      return;
    }

    const organizationId = await getLocalOrganizationId();

    const result = await pool.query<PublicExamRow>(
      `
        ${selectPublishedExamSql}
        WHERE e.organization_id = $1
          AND e.is_active = TRUE
        ORDER BY e.name;
      `,
      [organizationId],
    );

    response.json({
      exams: result.rows.map(mapExam),
    });
  } catch (error) {
    next(error);
  }
});

publicExamRouter.get("/:slug", async (request, response, next) => {
  try {
    if (!ensureLocalMode(response)) {
      return;
    }

    const parsedSlug = examSlugSchema.safeParse(request.params.slug);

    if (!parsedSlug.success) {
      response.status(400).json({
        message: "Nieprawidłowy adres egzaminu.",
      });

      return;
    }

    const organizationId = await getLocalOrganizationId();

    const result = await pool.query<PublicExamRow>(
      `
          ${selectPublishedExamSql}
          WHERE e.organization_id = $1
            AND e.slug = $2
            AND e.is_active = TRUE
          LIMIT 1;
        `,
      [organizationId, parsedSlug.data],
    );

    const exam = result.rows[0];

    if (!exam) {
      response.status(404).json({
        message: "Nie znaleziono opublikowanego egzaminu.",
      });

      return;
    }

    response.json({
      exam: mapExam(exam),
    });
  } catch (error) {
    next(error);
  }
});
