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

import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  exams,
  examVersions,
} from "../db/schema.js";
import { importExamPackage } from "../exams/import-package.js";

import { requireAdminSession } from "./middleware.js";

const packageExtensionError = new Error(
  "PACKAGE_EXTENSION_NOT_ALLOWED",
);

const examIdSchema = z.string().uuid();

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
  requireAdminSession,
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

adminExamRouter.get(
  "/:examId/versions",
  requireAdminSession,
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
  requireAdminSession,
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