import { createHash, randomInt } from "node:crypto";

import type { Response } from "express";
import type { PoolClient } from "pg";
import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/client.js";

import { requireAdminSession } from "./middleware.js";

const participantIdSchema = z.string().uuid();
const examIdSchema = z.string().uuid();

const createParticipantSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
  })
  .strict();

const updateExamAccessSchema = z
  .object({
    isActive: z.boolean().optional(),
    validFrom: z.string().trim().min(1).nullable().optional(),
    validUntil: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const accessCodeAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getOrganizationId(response: Response): string {
  const organizationId =
    response.locals.adminSession?.organizationId;

  if (typeof organizationId !== "string") {
    throw new Error(
      "Nie znaleziono organizacji w sesji administratora.",
    );
  }

  return organizationId;
}

function hashAccessCode(code: string): string {
  return createHash("sha256")
    .update(code.trim().toUpperCase())
    .digest("hex");
}

function generateAccessCodeSegment(length: number): string {
  let segment = "";

  for (let index = 0; index < length; index += 1) {
    segment +=
      accessCodeAlphabet[
        randomInt(0, accessCodeAlphabet.length)
      ];
  }

  return segment;
}

function generateAccessCode(): string {
  return [
    "BOS",
    generateAccessCodeSegment(4),
    generateAccessCodeSegment(4),
  ].join("-");
}

async function createUniqueAccessCode(
  client: PoolClient,
  participantId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateAccessCode();
    const codeHash = hashAccessCode(code);

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO participant_access_codes (
          participant_id,
          code_hash,
          is_active
        )
        VALUES ($1, $2, TRUE)
        ON CONFLICT (code_hash)
        DO NOTHING
        RETURNING id;
      `,
      [
        participantId,
        codeHash,
      ],
    );

    if (result.rows[0]) {
      return code;
    }
  }

  throw new Error(
    "Nie udało się wygenerować unikalnego kodu dostępu.",
  );
}

function parseOptionalDate(
  value: string | null | undefined,
): Date | null {
  if (value === undefined || value === null) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export const adminParticipantRouter = Router();

adminParticipantRouter.get(
  "/",
  requireAdminSession,
  async (_request, response, next) => {
    try {
      const organizationId = getOrganizationId(response);

      const result = await pool.query(
        `
          SELECT
            p.id,
            p.label,
            p.is_active AS "isActive",
            p.expires_at AS "expiresAt",
            p.created_at AS "createdAt",
            p.updated_at AS "updatedAt",
            COALESCE(
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', pea.id,
                  'examId', e.id,
                  'examSlug', e.slug,
                  'examName', e.name,
                  'isActive', pea.is_active,
                  'validFrom', pea.valid_from,
                  'validUntil', pea.valid_until,
                  'revokedAt', pea.revoked_at,
                  'createdAt', pea.created_at,
                  'updatedAt', pea.updated_at
                )
                ORDER BY e.name
              ) FILTER (WHERE pea.id IS NOT NULL),
              '[]'::json
            ) AS "examAccesses"
          FROM participants p
          LEFT JOIN participant_exam_accesses pea
            ON pea.participant_id = p.id
          LEFT JOIN exams e
            ON e.id = pea.exam_id
           AND e.organization_id = p.organization_id
          WHERE p.organization_id = $1
            AND p.kind = 'course'
          GROUP BY p.id
          ORDER BY p.created_at DESC;
        `,
        [organizationId],
      );

      response.json({
        participants: result.rows,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminParticipantRouter.post(
  "/",
  requireAdminSession,
  async (request, response, next) => {
    try {
      const organizationId = getOrganizationId(response);

      const parsedBody =
        createParticipantSchema.safeParse(request.body);

      if (!parsedBody.success) {
        response.status(400).json({
          message: "Podaj nazwę uczestnika.",
          errors: parsedBody.error.issues,
        });

        return;
      }

      const existingParticipant = await pool.query<{
        id: string;
      }>(
        `
          SELECT id
          FROM participants
          WHERE organization_id = $1
            AND kind = 'course'
            AND LOWER(label) = LOWER($2)
          LIMIT 1;
        `,
        [
          organizationId,
          parsedBody.data.label,
        ],
      );

      if (existingParticipant.rows[0]) {
        response.status(409).json({
          message:
            "Uczestnik o takiej nazwie już istnieje.",
        });

        return;
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const participantResult = await client.query<{
          id: string;
          label: string;
          isActive: boolean;
          expiresAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }>(
          `
            INSERT INTO participants (
              organization_id,
              course_id,
              kind,
              label,
              is_active,
              expires_at
            )
            VALUES ($1, NULL, 'course', $2, TRUE, NULL)
            RETURNING
              id,
              label,
              is_active AS "isActive",
              expires_at AS "expiresAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt";
          `,
          [
            organizationId,
            parsedBody.data.label,
          ],
        );

        const participant = participantResult.rows[0];

        if (!participant) {
          throw new Error(
            "Nie udało się utworzyć uczestnika.",
          );
        }

        const code = await createUniqueAccessCode(
  client,
  participant.id,
);

        await client.query("COMMIT");

        response.status(201).json({
          participant: {
            ...participant,
            examAccesses: [],
          },
          accessCode: code,
        });
      } catch (error) {
        await client.query("ROLLBACK");

        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  },
);

adminParticipantRouter.get(
  "/available-exams",
  requireAdminSession,
  async (_request, response, next) => {
    try {
      const organizationId = getOrganizationId(response);

      const result = await pool.query(
        `
          SELECT
            e.id,
            e.slug,
            e.name,
            e.description,
            e.is_active AS "isActive"
          FROM exams e
          WHERE e.organization_id = $1
            AND e.is_active = TRUE
            AND EXISTS (
              SELECT 1
              FROM exam_versions ev
              WHERE ev.exam_id = e.id
                AND ev.status = 'published'
            )
          ORDER BY e.name;
        `,
        [organizationId],
      );

      response.json({
        exams: result.rows,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminParticipantRouter.put(
  "/:participantId/exam-access/:examId",
  requireAdminSession,
  async (request, response, next) => {
    try {
      const organizationId = getOrganizationId(response);

      const parsedParticipantId =
        participantIdSchema.safeParse(
          request.params.participantId,
        );

      if (!parsedParticipantId.success) {
        response.status(400).json({
          message:
            "Nieprawidłowy identyfikator uczestnika.",
        });

        return;
      }

      const parsedExamId = examIdSchema.safeParse(
        request.params.examId,
      );

      if (!parsedExamId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator egzaminu.",
        });

        return;
      }

      const parsedBody =
        updateExamAccessSchema.safeParse(request.body);

      if (!parsedBody.success) {
        response.status(400).json({
          message:
            "Nieprawidłowe dane dostępu do egzaminu.",
          errors: parsedBody.error.issues,
        });

        return;
      }

      const participantResult = await pool.query<{
        id: string;
      }>(
        `
          SELECT id
          FROM participants
          WHERE id = $1
            AND organization_id = $2
            AND kind = 'course'
          LIMIT 1;
        `,
        [
          parsedParticipantId.data,
          organizationId,
        ],
      );

      if (!participantResult.rows[0]) {
        response.status(404).json({
          message: "Nie znaleziono uczestnika.",
        });

        return;
      }

      const examResult = await pool.query<{
        id: string;
      }>(
        `
          SELECT id
          FROM exams
          WHERE id = $1
            AND organization_id = $2
            AND is_active = TRUE
          LIMIT 1;
        `,
        [
          parsedExamId.data,
          organizationId,
        ],
      );

      if (!examResult.rows[0]) {
        response.status(404).json({
          message: "Nie znaleziono aktywnego egzaminu.",
        });

        return;
      }

      const validFrom =
        parseOptionalDate(parsedBody.data.validFrom) ??
        new Date();

      const validUntil = parseOptionalDate(
        parsedBody.data.validUntil,
      );

      if (
        parsedBody.data.validUntil &&
        validUntil === null
      ) {
        response.status(400).json({
          message:
            "Nieprawidłowa data ważności dostępu.",
        });

        return;
      }

      if (
        validUntil &&
        validUntil.getTime() < validFrom.getTime()
      ) {
        response.status(400).json({
          message:
            "Data końca dostępu nie może być wcześniejsza niż data początku.",
        });

        return;
      }

      const isActive =
        parsedBody.data.isActive ?? true;

      const accessResult = await pool.query(
        `
          WITH upserted AS (
            INSERT INTO participant_exam_accesses (
              participant_id,
              exam_id,
              is_active,
              valid_from,
              valid_until,
              revoked_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              CASE WHEN $3 = TRUE THEN NULL ELSE NOW() END
            )
            ON CONFLICT (participant_id, exam_id)
            DO UPDATE SET
              is_active = EXCLUDED.is_active,
              valid_from = EXCLUDED.valid_from,
              valid_until = EXCLUDED.valid_until,
              revoked_at = CASE
                WHEN EXCLUDED.is_active = TRUE THEN NULL
                ELSE COALESCE(
                  participant_exam_accesses.revoked_at,
                  NOW()
                )
              END,
              updated_at = NOW()
            RETURNING *
          )
          SELECT
            upserted.id,
            upserted.participant_id AS "participantId",
            upserted.exam_id AS "examId",
            e.slug AS "examSlug",
            e.name AS "examName",
            upserted.is_active AS "isActive",
            upserted.valid_from AS "validFrom",
            upserted.valid_until AS "validUntil",
            upserted.revoked_at AS "revokedAt",
            upserted.created_at AS "createdAt",
            upserted.updated_at AS "updatedAt"
          FROM upserted
          INNER JOIN exams e
            ON e.id = upserted.exam_id;
        `,
        [
          parsedParticipantId.data,
          parsedExamId.data,
          isActive,
          validFrom,
          validUntil,
        ],
      );

      response.json({
        access: accessResult.rows[0],
      });
    } catch (error) {
      next(error);
    }
  },
);