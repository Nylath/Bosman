import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";

import { pool, db } from "../db/client.js";
import { organizations } from "../db/schema.js";
import { importExamPackage } from "../exams/import-package.js";
import { printExamPackageReport } from "../exams/package.js";

const repositoryRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);

const LOCAL_ORGANIZATION_SLUG = "bosman-local";

async function getLocalOrganizationId(): Promise<string> {
  const [organization] = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(eq(organizations.slug, LOCAL_ORGANIZATION_SLUG))
    .limit(1);

  if (!organization) {
    throw new Error(
      'Nie znaleziono organizacji "bosman-local". Uruchom wcześniej backend, aby wykonać bootstrap trybu LOCAL.',
    );
  }

  return organization.id;
}

async function run(): Promise<number> {
  const zipPath = process.argv[2];

  if (!zipPath) {
    console.error(
      'Podaj ścieżkę do ZIP-a, np. npm run import:package --workspace=@bosman/backend -- "tmp/exam-package-test.zip"',
    );

    return 1;
  }

  const resolvedPath = path.isAbsolute(zipPath)
    ? zipPath
    : path.resolve(repositoryRoot, zipPath);

  const zipBuffer = await readFile(resolvedPath);

  const organizationId = await getLocalOrganizationId();

  const result = await importExamPackage({
    organizationId,
    zipBuffer,
  });

  printExamPackageReport(result.validation);

  if (!result.imported) {
    console.error("\nImport przerwany.");
    return 1;
  }

  console.log("\n=== IMPORT ZAKOŃCZONY ===\n");
  console.log(`Id egzaminu: ${result.examId}`);
  console.log(`Id wersji: ${result.examVersionId}`);
  console.log(`Numer wersji: ${result.versionNumber}`);
  console.log(`Zaimportowane działy: ${result.importedCategories}`);
  console.log(`Zaimportowane pytania: ${result.importedQuestions}`);
  console.log(`Zaimportowane odpowiedzi: ${result.importedAnswers}`);
  console.log(`Zapisane grafiki: ${result.savedAssets}`);

  return 0;
}

void run()
  .then(async (exitCode) => {
    await pool.end();
    process.exit(exitCode);
  })
  .catch(async (error: unknown) => {
    console.error("Nie udało się zaimportować paczki ZIP:", error);

    await pool.end();
    process.exit(1);
  });