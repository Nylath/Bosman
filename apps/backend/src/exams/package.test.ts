import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { type ExamPackage, validateExamPackageBuffer } from "./package.js";

function createValidExamPackage(): ExamPackage {
  return {
    schemaVersion: 1,

    exam: {
      slug: "egzamin-testowy",
      name: "Egzamin testowy",
      description: "Paczka używana w testach.",
      tileImage: null,
      durationMinutes: 30,
      questionsPerAttempt: 1,
      passingScore: 1,
      answersPerQuestion: 3,
    },

    sampling: {
      randomQuestions: 0,
      categories: [
        {
          slug: "dzial-testowy",
          name: "Dział testowy",
          minimumQuestions: 1,
        },
      ],
    },

    questions: [
      {
        externalId: "test-q001",
        categorySlug: "dzial-testowy",
        text: "Która odpowiedź jest poprawna?",
        image: null,
        answers: [
          {
            text: "Odpowiedź błędna A",
            isCorrect: false,
          },
          {
            text: "Odpowiedź poprawna",
            isCorrect: true,
          },
          {
            text: "Odpowiedź błędna B",
            isCorrect: false,
          },
        ],
      },
    ],
  };
}

async function createZipBuffer(
  data: unknown,
  files: Record<string, string | Buffer> = {},
): Promise<Buffer> {
  const archive = new JSZip();

  archive.file("exam.json", JSON.stringify(data));

  for (const [path, content] of Object.entries(files)) {
    archive.file(path, content);
  }

  return archive.generateAsync({
    type: "nodebuffer",
  });
}

describe("validateExamPackageBuffer", () => {
  it("akceptuje poprawną paczkę gotową do publikacji", async () => {
    const packageData = createValidExamPackage();

    const result = await validateExamPackageBuffer(
      await createZipBuffer(packageData),
    );

    expect(result.data).not.toBeNull();
    expect(result.data?.exam.slug).toBe("egzamin-testowy");

    expect(result.report.errors).toEqual([]);
    expect(result.report.publicationBlockers).toEqual([]);

    expect(result.canImportAsDraft).toBe(true);
    expect(result.canPublish).toBe(true);
  });

  it("odrzuca paczkę bez pliku exam.json", async () => {
    const archive = new JSZip();

    archive.file("readme.txt", "Brak pliku egzaminu.");

    const result = await validateExamPackageBuffer(
      await archive.generateAsync({
        type: "nodebuffer",
      }),
    );

    expect(result.data).toBeNull();
    expect(result.canImportAsDraft).toBe(false);
    expect(result.canPublish).toBe(false);

    expect(
      result.report.errors.some((error) => error.includes("exam.json")),
    ).toBe(true);
  });

  it("odrzuca niepoprawny JSON", async () => {
    const archive = new JSZip();

    archive.file("exam.json", "{ invalid json");

    const result = await validateExamPackageBuffer(
      await archive.generateAsync({
        type: "nodebuffer",
      }),
    );

    expect(result.data).toBeNull();
    expect(result.canImportAsDraft).toBe(false);

    expect(
      result.report.errors.some((error) => error.includes("exam.json")),
    ).toBe(true);
  });

  it("odrzuca paczkę z brakującą grafiką pytania", async () => {
    const packageData = createValidExamPackage();

    packageData.questions[0].image = "assets/missing.png";

    const result = await validateExamPackageBuffer(
      await createZipBuffer(packageData),
    );

    expect(result.data).not.toBeNull();
    expect(result.canImportAsDraft).toBe(false);
    expect(result.canPublish).toBe(false);

    expect(
      result.report.errors.some((error) =>
        error.includes("assets/missing.png"),
      ),
    ).toBe(true);
  });

  it("odrzuca niebezpieczną ścieżkę grafiki", async () => {
    const packageData = createValidExamPackage();

    packageData.questions[0].image = "../secret.png";

    const result = await validateExamPackageBuffer(
      await createZipBuffer(packageData),
    );

    expect(result.canImportAsDraft).toBe(false);
    expect(result.canPublish).toBe(false);

    expect(
      result.report.errors.some((error) => error.includes("../secret.png")),
    ).toBe(true);
  });

  it("akceptuje istniejącą grafikę z katalogu assets", async () => {
    const packageData = createValidExamPackage();

    packageData.questions[0].image = "assets/test.png";

    const result = await validateExamPackageBuffer(
      await createZipBuffer(packageData, {
        "assets/test.png": Buffer.from("test-image-content"),
      }),
    );

    expect(result.report.errors).toEqual([]);
    expect(result.canImportAsDraft).toBe(true);
    expect(result.canPublish).toBe(true);
  });

  it("odrzuca plik, który nie jest archiwum ZIP", async () => {
    const result = await validateExamPackageBuffer(
      Buffer.from("to nie jest zip"),
    );

    expect(result.data).toBeNull();
    expect(result.canImportAsDraft).toBe(false);
    expect(result.canPublish).toBe(false);
    expect(result.report.errors).toHaveLength(1);
  });

  it("pozwala zapisać szkic bez pełnej konfiguracji, ale blokuje publikację", async () => {
    const packageData = createValidExamPackage();

    packageData.exam.durationMinutes = null;
    packageData.exam.questionsPerAttempt = null;
    packageData.exam.passingScore = null;

    const result = await validateExamPackageBuffer(
      await createZipBuffer(packageData),
    );

    expect(result.report.errors).toEqual([]);
    expect(result.report.publicationBlockers).toHaveLength(3);

    expect(result.canImportAsDraft).toBe(true);
    expect(result.canPublish).toBe(false);
  });

  it("odrzuca próg zaliczenia większy od liczby pytań", async () => {
    const packageData = createValidExamPackage();

    packageData.exam.passingScore = 2;
    packageData.exam.questionsPerAttempt = 1;

    const result = await validateExamPackageBuffer(
      await createZipBuffer(packageData),
    );

    expect(result.data).not.toBeNull();
    expect(result.report.errors).toHaveLength(1);
    expect(result.canImportAsDraft).toBe(false);
    expect(result.canPublish).toBe(false);
  });

  it("odrzuca powtórzony identyfikator pytania", async () => {
    const packageData = createValidExamPackage();

    const duplicateQuestion = structuredClone(packageData.questions[0]);

    duplicateQuestion.text = "Drugie pytanie z tym samym identyfikatorem.";

    packageData.questions.push(duplicateQuestion);

    const result = await validateExamPackageBuffer(
      await createZipBuffer(packageData),
    );

    expect(result.data).not.toBeNull();

    expect(
      result.report.errors.some((error) => error.includes("test-q001")),
    ).toBe(true);

    expect(result.canImportAsDraft).toBe(false);
  });

  it("odrzuca pytanie z więcej niż jedną poprawną odpowiedzią", async () => {
    const packageData = createValidExamPackage();

    packageData.questions[0].answers[0].isCorrect = true;

    const result = await validateExamPackageBuffer(
      await createZipBuffer(packageData),
    );

    expect(result.data).not.toBeNull();

    expect(
      result.report.errors.some(
        (error) => error.includes("test-q001") && error.includes("2"),
      ),
    ).toBe(true);

    expect(result.canImportAsDraft).toBe(false);
    expect(result.canPublish).toBe(false);
  });
});
