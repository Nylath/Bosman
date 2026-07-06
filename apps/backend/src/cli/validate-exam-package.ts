import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  printExamPackageReport,
  validateExamPackageBuffer,
} from "../exams/package.js";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

async function main(): Promise<void> {
  const zipPath = process.argv[2];

  if (!zipPath) {
    console.error(
      'Podaj ścieżkę do paczki ZIP, np. npm run validate:package --workspace=@bosman/backend -- "tmp/exam-package-test.zip"',
    );

    process.exit(1);
  }

  try {
    const resolvedPath = path.isAbsolute(zipPath)
      ? zipPath
      : path.resolve(repositoryRoot, zipPath);

    const zipBuffer = await readFile(resolvedPath);

    const result = await validateExamPackageBuffer(zipBuffer);

    printExamPackageReport(result);

    process.exit(result.canImportAsDraft ? 0 : 1);
  } catch (error) {
    console.error("Nie udało się sprawdzić paczki ZIP:", error);
    process.exit(1);
  }
}

void main();
