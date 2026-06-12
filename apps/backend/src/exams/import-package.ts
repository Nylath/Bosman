import path from "node:path";

import { eq, max } from "drizzle-orm";

import { assetStorage } from "../assets/index.js";
import { db } from "../db/client.js";
import {
  answers,
  categories,
  exams,
  examVersions,
  questions,
} from "../db/schema.js";

import {
  getArchiveFile,
  normalizeArchivePath,
  type ExamPackageValidationResult,
  validateExamPackageBuffer,
} from "./package.js";

export type ImportExamPackageInput = {
  organizationId: string;
  zipBuffer: Buffer;
};

export type ImportExamPackageResult =
  | {
      imported: false;
      validation: ExamPackageValidationResult;
    }
  | {
      imported: true;
      validation: ExamPackageValidationResult;
      examId: string;
      examVersionId: string;
      versionNumber: number;
      importedCategories: number;
      importedQuestions: number;
      importedAnswers: number;
      savedAssets: number;
    };

function createStoredAssetPath(
  examSlug: string,
  examVersionId: string,
  archiveAssetPath: string,
): string {
  const normalizedArchivePath = normalizeArchivePath(archiveAssetPath);

  const relativeAssetPath = normalizedArchivePath.slice(
    "assets/".length,
  );

  return path.posix.join(
    "exams",
    examSlug,
    "versions",
    examVersionId,
    relativeAssetPath,
  );
}

async function removeSavedAssets(
  assetPaths: string[],
): Promise<void> {
  const removalResults = await Promise.allSettled(
    assetPaths.map((assetPath) => assetStorage.remove(assetPath)),
  );

  for (const result of removalResults) {
    if (result.status === "rejected") {
      console.error(
        "Nie udało się usunąć pliku po nieudanym imporcie:",
        result.reason,
      );
    }
  }
}

export async function importExamPackage(
  input: ImportExamPackageInput,
): Promise<ImportExamPackageResult> {
  const validation = await validateExamPackageBuffer(
    input.zipBuffer,
  );

  if (!validation.canImportAsDraft || !validation.data) {
    return {
      imported: false,
      validation,
    };
  }

  const { data, archive } = validation;

  const savedAssetPaths: string[] = [];

  try {
    const importedData = await db.transaction(
      async (transaction) => {
        const [exam] = await transaction
          .insert(exams)
          .values({
            organizationId: input.organizationId,
            slug: data.exam.slug,
            name: data.exam.name,
            description: data.exam.description,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [exams.organizationId, exams.slug],
            set: {
              name: data.exam.name,
              description: data.exam.description,
              isActive: true,
              updatedAt: new Date(),
            },
          })
          .returning({
            id: exams.id,
          });

        if (!exam) {
          throw new Error("Nie udało się utworzyć egzaminu.");
        }

        const [latestVersion] = await transaction
          .select({
            value: max(examVersions.versionNumber),
          })
          .from(examVersions)
          .where(eq(examVersions.examId, exam.id));

        const versionNumber = (latestVersion?.value ?? 0) + 1;

        const [examVersion] = await transaction
          .insert(examVersions)
          .values({
            examId: exam.id,
            versionNumber,
            status: "draft",
            durationMinutes: data.exam.durationMinutes,
            questionsPerAttempt: data.exam.questionsPerAttempt,
            passingScore: data.exam.passingScore,
            answersPerQuestion: data.exam.answersPerQuestion,
            randomQuestions: data.sampling.randomQuestions,
          })
          .returning({
            id: examVersions.id,
          });

        if (!examVersion) {
          throw new Error(
            "Nie udało się utworzyć wersji egzaminu.",
          );
        }

        const referencedAssets = new Set(
          data.questions
            .map((question) => question.image)
            .filter(
              (image): image is string => image !== null,
            )
            .map((image) => normalizeArchivePath(image)),
        );

        const storedAssetPathByArchivePath = new Map<
          string,
          string
        >();

        for (const archiveAssetPath of referencedAssets) {
          const assetFile = getArchiveFile(
            archive,
            archiveAssetPath,
          );

          if (!assetFile) {
            throw new Error(
              `Brakuje grafiki "${archiveAssetPath}" w paczce ZIP.`,
            );
          }

          const storedAssetPath = createStoredAssetPath(
            data.exam.slug,
            examVersion.id,
            archiveAssetPath,
          );

          const assetBuffer = await assetFile.async("nodebuffer");

          await assetStorage.save(assetBuffer, storedAssetPath);

          savedAssetPaths.push(storedAssetPath);

          storedAssetPathByArchivePath.set(
            archiveAssetPath,
            storedAssetPath,
          );
        }

        const insertedCategories = await transaction
          .insert(categories)
          .values(
            data.sampling.categories.map(
              (category, position) => ({
                examVersionId: examVersion.id,
                slug: category.slug,
                name: category.name,
                position,
                minimumQuestions: category.minimumQuestions,
              }),
            ),
          )
          .returning({
            id: categories.id,
            slug: categories.slug,
          });

        const categoryIdBySlug = new Map(
          insertedCategories.map((category) => [
            category.slug,
            category.id,
          ]),
        );

        const questionPositionByCategory = new Map<
          string,
          number
        >();

        const questionRows = data.questions.map((question) => {
          const categoryId = categoryIdBySlug.get(
            question.categorySlug,
          );

          if (!categoryId) {
            throw new Error(
              `Nie znaleziono działu "${question.categorySlug}".`,
            );
          }

          const position =
            questionPositionByCategory.get(
              question.categorySlug,
            ) ?? 0;

          questionPositionByCategory.set(
            question.categorySlug,
            position + 1,
          );

          const normalizedImagePath =
            question.image === null
              ? null
              : normalizeArchivePath(question.image);

          const imagePath =
            normalizedImagePath === null
              ? null
              : storedAssetPathByArchivePath.get(
                  normalizedImagePath,
                );

          if (
            normalizedImagePath !== null &&
            !imagePath
          ) {
            throw new Error(
              `Nie zapisano grafiki "${normalizedImagePath}".`,
            );
          }

          return {
            examVersionId: examVersion.id,
            categoryId,
            externalId: question.externalId,
            text: question.text,
            imagePath,
            position,
          };
        });

        const insertedQuestions = await transaction
          .insert(questions)
          .values(questionRows)
          .returning({
            id: questions.id,
            externalId: questions.externalId,
          });

        const questionIdByExternalId = new Map(
          insertedQuestions.map((question) => [
            question.externalId,
            question.id,
          ]),
        );

        const answerRows = data.questions.flatMap(
          (question) => {
            const questionId = questionIdByExternalId.get(
              question.externalId,
            );

            if (!questionId) {
              throw new Error(
                `Nie zapisano pytania "${question.externalId}".`,
              );
            }

            return question.answers.map(
              (answer, position) => ({
                questionId,
                text: answer.text,
                isCorrect: answer.isCorrect,
                sourceLabel: answer.sourceLabel ?? null,
                position,
              }),
            );
          },
        );

        await transaction.insert(answers).values(answerRows);

        return {
          examId: exam.id,
          examVersionId: examVersion.id,
          versionNumber,
          importedCategories: insertedCategories.length,
          importedQuestions: insertedQuestions.length,
          importedAnswers: answerRows.length,
          savedAssets: savedAssetPaths.length,
        };
      },
    );

    return {
      imported: true,
      validation,
      ...importedData,
    };
  } catch (error) {
    await removeSavedAssets(savedAssetPaths);

    throw error;
  }
}