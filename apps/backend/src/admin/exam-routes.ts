import path from "node:path";

import {
  and,
  desc,
  eq,
} from "drizzle-orm";
import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { assetStorage } from "../assets/index.js";
import { config } from "../config.js";
import { db, pool } from "../db/client.js";

import {
  exams,
  examVersions,
} from "../db/schema.js";
import { importExamPackage } from "../exams/import-package.js";

import { requireSystemAdminSession } from "./middleware.js";

const packageExtensionError = new Error(
  "PACKAGE_EXTENSION_NOT_ALLOWED",
);

const examIdSchema = z.string().uuid();

const updateExamActiveSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 1,
    fileSize: config.examPackageMaxBytes,
  },

  fileFilter: (_request, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (extension !== ".zip") {
      callback(packageExtensionError);

      return;
    }

    callback(null, true);
  },
});

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

function receiveExamPackage(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  upload.single("package")(request, response, (error) => {
    if (error === packageExtensionError) {
      response.status(400).json({
        message: "Prześlij plik z rozszerzeniem .zip.",
      });

      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        response.status(413).json({
          message: "Przesłana paczka ZIP jest zbyt duża.",
        });

        return;
      }

      response.status(400).json({
        message: "Nie udało się odebrać paczki ZIP.",
      });

      return;
    }

    if (error) {
      next(error);

      return;
    }

    next();
  });
}

export const adminExamRouter = Router();

adminExamRouter.get(
  "/",
  requireSystemAdminSession,
  async (_request, response, next) => {
    try {
      const organizationId = getOrganizationId(response);

      const examRows = await db
        .select({
          id: exams.id,
          slug: exams.slug,
          name: exams.name,
          description: exams.description,
          tileImagePath: exams.tileImagePath,
          isActive: exams.isActive,
          createdAt: exams.createdAt,
          updatedAt: exams.updatedAt,
        })
        .from(exams)
        .where(eq(exams.organizationId, organizationId))
        .orderBy(exams.name);

      response.json({
        exams: examRows,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminExamRouter.patch(
  "/:examId/active",
  requireSystemAdminSession,
  async (request, response, next) => {
    try {
      const organizationId = getOrganizationId(response);

      const parsedExamId = examIdSchema.safeParse(
        request.params.examId,
      );

      if (!parsedExamId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator egzaminu.",
        });

        return;
      }

      const parsedBody = updateExamActiveSchema.safeParse(
        request.body,
      );

      if (!parsedBody.success) {
        response.status(400).json({
          message:
            'Prześlij pole "isActive" o wartości true albo false.',
        });

        return;
      }

      const [updatedExam] = await db
        .update(exams)
        .set({
          isActive: parsedBody.data.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(exams.id, parsedExamId.data),
            eq(exams.organizationId, organizationId),
          ),
        )
        .returning({
          id: exams.id,
          slug: exams.slug,
          name: exams.name,
          description: exams.description,
          tileImagePath: exams.tileImagePath,
          isActive: exams.isActive,
          createdAt: exams.createdAt,
          updatedAt: exams.updatedAt,
        });

      if (!updatedExam) {
        response.status(404).json({
          message: "Nie znaleziono egzaminu.",
        });

        return;
      }

      response.json({
        exam: updatedExam,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminExamRouter.get(
  "/:examId/versions",
  requireSystemAdminSession,
  async (request, response, next) => {
    try {
      const organizationId = getOrganizationId(response);

      const parsedExamId = examIdSchema.safeParse(
        request.params.examId,
      );

      if (!parsedExamId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator egzaminu.",
        });

        return;
      }

      const versionRows = await db
        .select({
          id: examVersions.id,
          versionNumber: examVersions.versionNumber,
          status: examVersions.status,
          durationMinutes: examVersions.durationMinutes,
          questionsPerAttempt:
            examVersions.questionsPerAttempt,
          passingScore: examVersions.passingScore,
          answersPerQuestion:
            examVersions.answersPerQuestion,
          randomQuestions: examVersions.randomQuestions,
          createdAt: examVersions.createdAt,
          publishedAt: examVersions.publishedAt,
        })
        .from(examVersions)
        .innerJoin(
          exams,
          eq(examVersions.examId, exams.id),
        )
        .where(
          and(
            eq(examVersions.examId, parsedExamId.data),
            eq(exams.organizationId, organizationId),
          ),
        )
        .orderBy(desc(examVersions.versionNumber));

      response.json({
        versions: versionRows,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminExamRouter.post(
  "/import",
  requireSystemAdminSession,
  receiveExamPackage,
  async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({
          message:
            'Brakuje pliku ZIP w polu formularza "package".',
        });

        return;
      }

      const organizationId = getOrganizationId(response);

      const result = await importExamPackage({
        organizationId,
        zipBuffer: request.file.buffer,
      });

      const responseBody = {
        imported: result.imported,
        canImportAsDraft:
          result.validation.canImportAsDraft,
        canPublish: result.validation.canPublish,
        report: result.validation.report,
      };

      if (!result.imported) {
        response.status(422).json(responseBody);

        return;
      }

      response.status(201).json({
        ...responseBody,

        exam: {
          id: result.examId,
          versionId: result.examVersionId,
          versionNumber: result.versionNumber,
        },

        importedData: {
          categories: result.importedCategories,
          questions: result.importedQuestions,
          answers: result.importedAnswers,
          assets: result.savedAssets,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

adminExamRouter.delete(
  "/:examId",
  requireSystemAdminSession,
  async (request, response, next) => {
    const client = await pool.connect();

    try {
      const organizationId = getOrganizationId(response);

      const parsedExamId = examIdSchema.safeParse(
        request.params.examId,
      );

      if (!parsedExamId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator egzaminu.",
        });

        return;
      }

      await client.query("BEGIN");

      const examResult = await client.query<{
        id: string;
        name: string;
        slug: string;
      }>(
        `
          SELECT
            id,
            name,
            slug
          FROM exams
          WHERE id = $1
            AND organization_id = $2
          LIMIT 1
          FOR UPDATE;
        `,
        [
          parsedExamId.data,
          organizationId,
        ],
      );

      const exam = examResult.rows[0];

      if (!exam) {
        await client.query("ROLLBACK");

        response.status(404).json({
          message: "Nie znaleziono egzaminu.",
        });

        return;
      }

      const assetResult = await client.query<{
        path: string;
      }>(
        `
          SELECT DISTINCT path
          FROM (
            SELECT tile_image_path AS path
            FROM exams
            WHERE id = $1

            UNION

            SELECT tile_image_path AS path
            FROM exam_versions
            WHERE exam_id = $1

            UNION

            SELECT q.image_path AS path
            FROM questions q
            INNER JOIN exam_versions ev
              ON ev.id = q.exam_version_id
            WHERE ev.exam_id = $1
          ) asset_paths
          WHERE path IS NOT NULL;
        `,
        [exam.id],
      );

      const assetPaths = assetResult.rows.map(
        (row) => row.path,
      );

      await client.query(
        `
          DELETE FROM attempts
          WHERE exam_id = $1;
        `,
        [exam.id],
      );

      await client.query(
        `
          DELETE FROM participant_exam_accesses
          WHERE exam_id = $1;
        `,
        [exam.id],
      );

      await client.query(
        `
          DELETE FROM course_exams
          WHERE exam_id = $1;
        `,
        [exam.id],
      );

      await client.query(
        `
          DELETE FROM answers
          WHERE question_id IN (
            SELECT q.id
            FROM questions q
            INNER JOIN exam_versions ev
              ON ev.id = q.exam_version_id
            WHERE ev.exam_id = $1
          );
        `,
        [exam.id],
      );

      await client.query(
        `
          DELETE FROM questions
          WHERE exam_version_id IN (
            SELECT id
            FROM exam_versions
            WHERE exam_id = $1
          );
        `,
        [exam.id],
      );

      await client.query(
        `
          DELETE FROM categories
          WHERE exam_version_id IN (
            SELECT id
            FROM exam_versions
            WHERE exam_id = $1
          );
        `,
        [exam.id],
      );

      await client.query(
        `
          DELETE FROM exam_versions
          WHERE exam_id = $1;
        `,
        [exam.id],
      );

      await client.query(
        `
          DELETE FROM exams
          WHERE id = $1
            AND organization_id = $2;
        `,
        [
          exam.id,
          organizationId,
        ],
      );

      await client.query("COMMIT");

      const removedAssets: string[] = [];
      const failedAssets: string[] = [];

      const uniqueAssetPaths = [...new Set(assetPaths)];

      const removalResults = await Promise.allSettled(
        uniqueAssetPaths.map(async (assetPath) => {
          await assetStorage.remove(assetPath);

          return assetPath;
        }),
      );

      for (let index = 0; index < removalResults.length; index += 1) {
        const result = removalResults[index];
        const assetPath = uniqueAssetPaths[index];

        if (!assetPath) {
          continue;
        }

        if (result.status === "fulfilled") {
          removedAssets.push(assetPath);
        } else {
          failedAssets.push(assetPath);

          console.error(
            "Nie udało się usunąć assetu egzaminu:",
            assetPath,
            result.reason,
          );
        }
      }

      response.json({
        deleted: true,
        exam: {
          id: exam.id,
          name: exam.name,
          slug: exam.slug,
        },
        assets: {
          removed: removedAssets.length,
          failed: failedAssets,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");

      next(error);
    } finally {
      client.release();
    }
  },
);