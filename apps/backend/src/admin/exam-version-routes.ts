import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";

import {
  getExamVersionDetails,
  publishExamVersion,
  updateExamVersionConfiguration,
} from "../exams/version-management.js";

import { requireSystemAdminSession } from "./middleware.js";

const versionIdSchema = z.string().uuid();

const nullablePositiveInteger = z.number().int().positive().nullable();

const nullableNonNegativeInteger = z.number().int().nonnegative().nullable();

const configurationSchema = z
  .object({
    durationMinutes: nullablePositiveInteger,
    questionsPerAttempt: nullablePositiveInteger,
    passingScore: nullablePositiveInteger,
    randomQuestions: nullableNonNegativeInteger,

    categories: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            minimumQuestions: nullableNonNegativeInteger,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((configuration, context) => {
    const categoryIds = configuration.categories.map((category) => category.id);

    if (new Set(categoryIds).size !== categoryIds.length) {
      context.addIssue({
        code: "custom",
        path: ["categories"],
        message: "Lista działów zawiera duplikaty.",
      });
    }
  });

function getOrganizationId(response: Response): string {
  const organizationId = response.locals.adminSession?.organizationId;

  if (typeof organizationId !== "string") {
    throw new Error("Nie znaleziono organizacji w sesji administratora.");
  }

  return organizationId;
}

export const adminExamVersionRouter = Router();

adminExamVersionRouter.get(
  "/:versionId",
  requireSystemAdminSession,
  async (request, response, next) => {
    try {
      const parsedVersionId = versionIdSchema.safeParse(
        request.params.versionId,
      );

      if (!parsedVersionId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator wersji egzaminu.",
        });

        return;
      }

      const version = await getExamVersionDetails(
        getOrganizationId(response),
        parsedVersionId.data,
      );

      if (!version) {
        response.status(404).json({
          message: "Nie znaleziono wersji egzaminu.",
        });

        return;
      }

      response.json({
        version,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminExamVersionRouter.put(
  "/:versionId/configuration",
  requireSystemAdminSession,
  async (request, response, next) => {
    try {
      const parsedVersionId = versionIdSchema.safeParse(
        request.params.versionId,
      );

      if (!parsedVersionId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator wersji egzaminu.",
        });

        return;
      }

      const parsedBody = configurationSchema.safeParse(request.body);

      if (!parsedBody.success) {
        response.status(400).json({
          message: "Nieprawidłowa konfiguracja egzaminu.",
          errors: parsedBody.error.issues,
        });

        return;
      }

      const result = await updateExamVersionConfiguration({
        organizationId: getOrganizationId(response),
        versionId: parsedVersionId.data,
        configuration: parsedBody.data,
      });

      if (result.status === "not_found") {
        response.status(404).json({
          message: "Nie znaleziono wersji egzaminu.",
        });

        return;
      }

      if (result.status === "not_editable") {
        response.status(409).json({
          message: "Konfigurację można zmieniać wyłącznie w wersji roboczej.",
        });

        return;
      }

      if (result.status === "invalid_categories") {
        response.status(400).json({
          message:
            "Przesłana lista działów nie odpowiada działom wersji egzaminu.",
        });

        return;
      }

      response.json({
        version: result.version,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminExamVersionRouter.post(
  "/:versionId/publish",
  requireSystemAdminSession,
  async (request, response, next) => {
    try {
      const parsedVersionId = versionIdSchema.safeParse(
        request.params.versionId,
      );

      if (!parsedVersionId.success) {
        response.status(400).json({
          message: "Nieprawidłowy identyfikator wersji egzaminu.",
        });

        return;
      }

      const result = await publishExamVersion({
        organizationId: getOrganizationId(response),
        versionId: parsedVersionId.data,
      });

      if (result.status === "not_found") {
        response.status(404).json({
          message: "Nie znaleziono wersji egzaminu.",
        });

        return;
      }

      if (result.status === "blocked") {
        response.status(422).json({
          message: "Wersja egzaminu nie spełnia warunków publikacji.",
          publication: result.publication,
        });

        return;
      }

      response.json({
        version: result.version,
      });
    } catch (error) {
      next(error);
    }
  },
);
