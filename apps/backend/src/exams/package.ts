import JSZip from "jszip";
import { z } from "zod";

const slugSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug może zawierać wyłącznie małe litery, cyfry i pojedyncze myślniki.",
  );

const positiveIntegerOrNullSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .default(null);

const nonNegativeIntegerOrNullSchema = z
  .number()
  .int()
  .nonnegative()
  .nullable()
  .default(null);

const answerSchema = z
  .object({
    text: z.string().trim().min(1),
    isCorrect: z.boolean(),
    sourceLabel: z.string().trim().min(1).optional(),
  })
  .strict();

const questionSchema = z
  .object({
    externalId: z.string().trim().min(1),
    categorySlug: slugSchema,
    text: z.string().trim().min(1),
    image: z.string().trim().min(1).nullable().default(null),
    answers: z.array(answerSchema).min(1),
  })
  .strict();

const categorySchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1),
    minimumQuestions: nonNegativeIntegerOrNullSchema,
  })
  .strict();

export const examPackageSchema = z
  .object({
    schemaVersion: z.literal(1),

    exam: z
      .object({
        slug: slugSchema,
        name: z.string().trim().min(1),
        description: z
          .string()
          .trim()
          .min(1)
          .nullable()
          .default(null),
        tileImage: z
          .string()
          .trim()
          .min(1)
          .nullable()
          .default(null),
        durationMinutes: positiveIntegerOrNullSchema,
        questionsPerAttempt: positiveIntegerOrNullSchema,
        passingScore: positiveIntegerOrNullSchema,
        answersPerQuestion: z.number().int().positive(),
      })
      .strict(),

    sampling: z
      .object({
        randomQuestions: nonNegativeIntegerOrNullSchema,
        categories: z.array(categorySchema).min(1),
      })
      .strict(),

    questions: z.array(questionSchema).min(1),
  })
  .strict();

export type ExamPackage = z.infer<typeof examPackageSchema>;

export type ExamPackageValidationReport = {
  errors: string[];
  publicationBlockers: string[];
  warnings: string[];
  information: string[];
};

export type ExamPackageValidationResult = {
  archive: JSZip;
  data: ExamPackage | null;
  report: ExamPackageValidationReport;
  canImportAsDraft: boolean;
  canPublish: boolean;
};

const allowedImageExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

function createReport(): ExamPackageValidationReport {
  return {
    errors: [],
    publicationBlockers: [],
    warnings: [],
    information: [],
  };
}

export function normalizeArchivePath(filePath: string): string {
  return filePath
    .trim()
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/");
}

function isSafeArchivePath(filePath: string): boolean {
  const normalizedPath = normalizeArchivePath(filePath);

  if (!normalizedPath) {
    return false;
  }

  if (
    normalizedPath.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normalizedPath)
  ) {
    return false;
  }

  return !normalizedPath.split("/").includes("..");
}

export function getArchiveFile(
  archive: JSZip,
  archivePath: string,
) {
  const normalizedRequestedPath = normalizeArchivePath(archivePath);

  return (
    Object.values(archive.files).find(
      (entry) =>
        !entry.dir &&
        normalizeArchivePath(entry.name) === normalizedRequestedPath,
    ) ?? null
  );
}

function getExtension(filePath: string): string {
  const dotPosition = filePath.lastIndexOf(".");

  if (dotPosition === -1) {
    return "";
  }

  return filePath.slice(dotPosition).toLowerCase();
}

function validateReferencedImage(input: {
  imagePath: string;
  label: string;
  archive: JSZip;
  report: ExamPackageValidationReport;
}): void {
  const normalizedImagePath = normalizeArchivePath(
    input.imagePath,
  );

  if (!isSafeArchivePath(normalizedImagePath)) {
    input.report.errors.push(
      `${input.label}: nieprawidłowa ścieżka grafiki "${input.imagePath}".`,
    );

    return;
  }

  if (!normalizedImagePath.startsWith("assets/")) {
    input.report.errors.push(
      `${input.label}: grafika musi znajdować się w katalogu assets/.`,
    );
  }

  if (
    !allowedImageExtensions.has(
      getExtension(normalizedImagePath),
    )
  ) {
    input.report.errors.push(
      `${input.label}: niedozwolony format grafiki "${input.imagePath}".`,
    );
  }

  if (!getArchiveFile(input.archive, normalizedImagePath)) {
    input.report.errors.push(
      `${input.label}: brak grafiki "${input.imagePath}" w paczce ZIP.`,
    );
  }
}

function addDuplicateErrors(
  values: string[],
  label: string,
  report: ExamPackageValidationReport,
): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      report.errors.push(`${label}: powtórzona wartość "${value}".`);
    }

    seen.add(value);
  }
}

function validateConfiguration(
  data: ExamPackage,
  report: ExamPackageValidationReport,
): void {
  const {
    durationMinutes,
    questionsPerAttempt,
    passingScore,
  } = data.exam;

  const { randomQuestions, categories } = data.sampling;

  if (durationMinutes === null) {
    report.publicationBlockers.push(
      "Nie ustawiono czasu trwania egzaminu.",
    );
  }

  if (questionsPerAttempt === null) {
    report.publicationBlockers.push(
      "Nie ustawiono liczby pytań w jednej próbie.",
    );
  }

  if (passingScore === null) {
    report.publicationBlockers.push(
      "Nie ustawiono progu zaliczenia.",
    );
  }

  if (randomQuestions === null) {
    report.publicationBlockers.push(
      "Nie ustawiono liczby dodatkowych pytań losowych.",
    );
  }

  const allMinimumsConfigured = categories.every(
    (category) => category.minimumQuestions !== null,
  );

  if (!allMinimumsConfigured) {
    report.publicationBlockers.push(
      "Nie ustawiono minimalnej liczby pytań dla wszystkich działów.",
    );
  }

  if (
    questionsPerAttempt !== null &&
    passingScore !== null &&
    passingScore > questionsPerAttempt
  ) {
    report.errors.push(
      "Próg zaliczenia nie może przekraczać liczby pytań w jednej próbie.",
    );
  }

  if (
    questionsPerAttempt !== null &&
    questionsPerAttempt > data.questions.length
  ) {
    report.errors.push(
      "Liczba pytań w jednej próbie przekracza liczbę pytań w bazie.",
    );
  }

  if (
    questionsPerAttempt !== null &&
    randomQuestions !== null &&
    allMinimumsConfigured
  ) {
    const minimumQuestionsTotal = categories.reduce(
      (sum, category) => sum + (category.minimumQuestions ?? 0),
      0,
    );

    if (minimumQuestionsTotal + randomQuestions !== questionsPerAttempt) {
      report.errors.push(
        "Suma minimów działów i dodatkowych pytań losowych musi być równa liczbie pytań w jednej próbie.",
      );
    }

    const remainingQuestions =
      data.questions.length - minimumQuestionsTotal;

    if (remainingQuestions < randomQuestions) {
      report.errors.push(
        "Po wylosowaniu minimów działów pozostaje zbyt mało pytań do uzupełnienia puli losowej.",
      );
    }
  }
}

function validateQuestions(
  data: ExamPackage,
  archive: JSZip,
  report: ExamPackageValidationReport,
): void {
  const categorySlugs = new Set(
    data.sampling.categories.map(
      (category) => category.slug,
    ),
  );

  addDuplicateErrors(
    data.sampling.categories.map(
      (category) => category.slug,
    ),
    "Slug działu",
    report,
  );

  addDuplicateErrors(
    data.questions.map(
      (question) => question.externalId,
    ),
    "Identyfikator pytania",
    report,
  );

  if (data.exam.tileImage !== null) {
    validateReferencedImage({
      imagePath: data.exam.tileImage,
      label: "Grafika kafelka egzaminu",
      archive,
      report,
    });
  }

  for (const question of data.questions) {
    if (!categorySlugs.has(question.categorySlug)) {
      report.errors.push(
        `${question.externalId}: dział "${question.categorySlug}" nie istnieje.`,
      );
    }

    if (
      question.answers.length !==
      data.exam.answersPerQuestion
    ) {
      report.errors.push(
        `${question.externalId}: wykryto ${question.answers.length} odpowiedzi zamiast ${data.exam.answersPerQuestion}.`,
      );
    }

    const correctAnswers =
      question.answers.filter(
        (answer) => answer.isCorrect,
      );

    if (correctAnswers.length !== 1) {
      report.errors.push(
        `${question.externalId}: liczba poprawnych odpowiedzi wynosi ${correctAnswers.length} zamiast 1.`,
      );
    }

    if (question.image !== null) {
      validateReferencedImage({
        imagePath: question.image,
        label: question.externalId,
        archive,
        report,
      });
    }
  }

  for (const category of data.sampling.categories) {
    const questionsInCategory =
      data.questions.filter(
        (question) =>
          question.categorySlug === category.slug,
      ).length;

    report.information.push(
      `Dział "${category.name}": ${questionsInCategory} pytań`,
    );

    if (
      category.minimumQuestions !== null &&
      questionsInCategory <
        category.minimumQuestions
    ) {
      report.errors.push(
        `Dział "${category.name}" zawiera ${questionsInCategory} pytań, ale wymagane minimum wynosi ${category.minimumQuestions}.`,
      );
    }
  }
}

function validateArchiveEntries(
  archive: JSZip,
  report: ExamPackageValidationReport,
): void {
  for (const entry of Object.values(archive.files)) {
    if (!isSafeArchivePath(entry.name)) {
      report.errors.push(
        `Nieprawidłowa ścieżka wewnątrz ZIP-a: "${entry.name}".`,
      );
    }
  }
}

function addAssetInformation(
  archive: JSZip,
  data: ExamPackage,
  report: ExamPackageValidationReport,
): void {
  const assetFiles = Object.values(
    archive.files,
  ).filter(
    (entry) =>
      !entry.dir &&
      normalizeArchivePath(
        entry.name,
      ).startsWith("assets/"),
  );

  const referencedAssets = new Set([
    ...(data.exam.tileImage === null
      ? []
      : [
          normalizeArchivePath(
            data.exam.tileImage,
          ),
        ]),

    ...data.questions
      .map((question) => question.image)
      .filter(
        (image): image is string =>
          image !== null,
      )
      .map((image) =>
        normalizeArchivePath(image),
      ),
  ]);

  report.information.push(
    `Egzamin: ${data.exam.name}`,
  );

  report.information.push(
    `Działy: ${data.sampling.categories.length}`,
  );

  report.information.push(
    `Pytania: ${data.questions.length}`,
  );

  report.information.push(
    `Odpowiedzi na pytanie: ${data.exam.answersPerQuestion}`,
  );

  report.information.push(
    `Grafika kafelka egzaminu: ${
      data.exam.tileImage === null
        ? "NIE"
        : "TAK"
    }`,
  );

  report.information.push(
    `Grafiki w ZIP-ie: ${assetFiles.length}`,
  );

  report.information.push(
    `Grafiki używane przez egzamin: ${referencedAssets.size}`,
  );

  for (const asset of assetFiles) {
    const normalizedAssetName =
      normalizeArchivePath(asset.name);

    if (!referencedAssets.has(normalizedAssetName)) {
      report.warnings.push(
        `Grafika "${normalizedAssetName}" znajduje się w ZIP-ie, ale nie jest używana przez egzamin.`,
      );
    }
  }
}

function createResult(
  archive: JSZip,
  data: ExamPackage | null,
  report: ExamPackageValidationReport,
): ExamPackageValidationResult {
  const canImportAsDraft = report.errors.length === 0;

  return {
    archive,
    data,
    report,
    canImportAsDraft,
    canPublish:
      canImportAsDraft &&
      report.publicationBlockers.length === 0,
  };
}

export async function validateExamPackageBuffer(
  zipBuffer: Buffer,
): Promise<ExamPackageValidationResult> {
  const report = createReport();

  let archive: JSZip;

try {
  archive = await JSZip.loadAsync(zipBuffer, {
    checkCRC32: true,
    createFolders: false,
  });
} catch {
  archive = new JSZip();

  report.errors.push(
    "Przesłany plik nie jest poprawnym archiwum ZIP.",
  );

  return createResult(archive, null, report);
}

  validateArchiveEntries(archive, report);

  const jsonFile = getArchiveFile(archive, "exam.json");

  if (!jsonFile) {
    report.errors.push(
      'Brakuje wymaganego pliku "exam.json" w katalogu głównym ZIP-a.',
    );

    return createResult(archive, null, report);
  }

  let rawJson: unknown;

  try {
    const jsonText = (await jsonFile.async("string")).replace(
      /^\uFEFF/,
      "",
    );

    rawJson = JSON.parse(jsonText);
  } catch {
    report.errors.push(
      'Plik "exam.json" nie zawiera poprawnego JSON-a.',
    );

    return createResult(archive, null, report);
  }

  const parsedData = examPackageSchema.safeParse(rawJson);

  if (!parsedData.success) {
    for (const issue of parsedData.error.issues) {
      const field = issue.path.join(".") || "exam.json";

      report.errors.push(`${field}: ${issue.message}`);
    }

    return createResult(archive, null, report);
  }

  const data = parsedData.data;

  validateConfiguration(data, report);
  validateQuestions(data, archive, report);
  addAssetInformation(archive, data, report);

  return createResult(archive, data, report);
}

export function printExamPackageReport(
  result: ExamPackageValidationResult,
): void {
  console.log("\n=== RAPORT WALIDACJI PACZKI ===\n");

  for (const information of result.report.information) {
    console.log(`✓ ${information}`);
  }

  for (const warning of result.report.warnings) {
    console.log(`⚠ ${warning}`);
  }

  for (const blocker of result.report.publicationBlockers) {
    console.log(`⚠ Blokada publikacji: ${blocker}`);
  }

  for (const error of result.report.errors) {
    console.log(`✗ ${error}`);
  }

  console.log("");
  console.log(
    `Import jako szkic: ${result.canImportAsDraft ? "TAK" : "NIE"}`,
  );
  console.log(
    `Publikacja egzaminu: ${result.canPublish ? "TAK" : "NIE"}`,
  );
  console.log(
    `Błędy blokujące import: ${result.report.errors.length}`,
  );
  console.log(
    `Blokady publikacji: ${result.report.publicationBlockers.length}`,
  );
  console.log(
    `Pozostałe ostrzeżenia: ${result.report.warnings.length}`,
  );
}