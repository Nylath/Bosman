import type { PoolClient } from "pg";

import { pool } from "../db/client.js";

type ExamVersionStatus = "draft" | "published" | "archived";

type VersionRow = {
  id: string;
  exam_id: string;
  exam_slug: string;
  exam_name: string;
  version_number: number;
  status: ExamVersionStatus;
  duration_minutes: number | null;
  questions_per_attempt: number | null;
  passing_score: number | null;
  answers_per_question: number;
  random_questions: number | null;
  created_at: Date;
  published_at: Date | null;
};

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  position: number;
  minimum_questions: number | null;
  question_count: number;
};

type InvalidQuestionRow = {
  external_id: string;
  answer_count: number;
  correct_answer_count: number;
};

export type ExamVersionConfiguration = {
  durationMinutes: number | null;
  questionsPerAttempt: number | null;
  passingScore: number | null;
  randomQuestions: number | null;
  categories: Array<{
    id: string;
    minimumQuestions: number | null;
  }>;
};

export type PublicationValidation = {
  canPublish: boolean;
  blockers: string[];
  statistics: {
    categories: number;
    questions: number;
    invalidQuestions: number;
  };
};

export type ExamVersionDetails = {
  id: string;
  exam: {
    id: string;
    slug: string;
    name: string;
  };
  versionNumber: number;
  status: ExamVersionStatus;
  durationMinutes: number | null;
  questionsPerAttempt: number | null;
  passingScore: number | null;
  answersPerQuestion: number;
  randomQuestions: number | null;
  createdAt: Date;
  publishedAt: Date | null;
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    position: number;
    minimumQuestions: number | null;
    questionCount: number;
  }>;
  publication: PublicationValidation;
};

async function loadVersion(
  client: PoolClient,
  organizationId: string,
  versionId: string,
): Promise<VersionRow | null> {
  const result = await client.query<VersionRow>(
    `
      SELECT
        ev.id,
        ev.exam_id,
        e.slug AS exam_slug,
        e.name AS exam_name,
        ev.version_number,
        ev.status,
        ev.duration_minutes,
        ev.questions_per_attempt,
        ev.passing_score,
        ev.answers_per_question,
        ev.random_questions,
        ev.created_at,
        ev.published_at
      FROM exam_versions ev
      INNER JOIN exams e
        ON e.id = ev.exam_id
      WHERE ev.id = $1
        AND e.organization_id = $2
      LIMIT 1;
    `,
    [versionId, organizationId],
  );

  return result.rows[0] ?? null;
}

async function loadCategories(
  client: PoolClient,
  versionId: string,
): Promise<CategoryRow[]> {
  const result = await client.query<CategoryRow>(
    `
      SELECT
        c.id,
        c.slug,
        c.name,
        c.position,
        c.minimum_questions,
        COUNT(q.id)::integer AS question_count
      FROM categories c
      LEFT JOIN questions q
        ON q.category_id = c.id
      WHERE c.exam_version_id = $1
      GROUP BY
        c.id,
        c.slug,
        c.name,
        c.position,
        c.minimum_questions
      ORDER BY c.position;
    `,
    [versionId],
  );

  return result.rows;
}

async function loadInvalidQuestions(
  client: PoolClient,
  versionId: string,
  answersPerQuestion: number,
): Promise<InvalidQuestionRow[]> {
  const result = await client.query<InvalidQuestionRow>(
    `
      SELECT
        q.external_id,
        COUNT(a.id)::integer AS answer_count,
        COUNT(a.id) FILTER (
          WHERE a.is_correct = TRUE
        )::integer AS correct_answer_count
      FROM questions q
      LEFT JOIN answers a
        ON a.question_id = q.id
      WHERE q.exam_version_id = $1
      GROUP BY q.id, q.external_id
      HAVING COUNT(a.id) <> $2
        OR COUNT(a.id) FILTER (
          WHERE a.is_correct = TRUE
        ) <> 1
      ORDER BY q.external_id
      LIMIT 20;
    `,
    [versionId, answersPerQuestion],
  );

  return result.rows;
}

async function validateLoadedVersion(
  client: PoolClient,
  version: VersionRow,
): Promise<{
  categories: CategoryRow[];
  publication: PublicationValidation;
}> {
  const blockers: string[] = [];

  const categories = await loadCategories(client, version.id);

  const invalidQuestions = await loadInvalidQuestions(
    client,
    version.id,
    version.answers_per_question,
  );

  const totalQuestions = categories.reduce(
    (sum, category) => sum + category.question_count,
    0,
  );

  if (version.status !== "draft") {
    blockers.push(
      "Publikować można wyłącznie wersję roboczą egzaminu.",
    );
  }

  if (version.duration_minutes === null) {
    blockers.push("Nie ustawiono czasu trwania egzaminu.");
  }

  if (version.questions_per_attempt === null) {
    blockers.push("Nie ustawiono liczby pytań w jednej próbie.");
  }

  if (version.passing_score === null) {
    blockers.push("Nie ustawiono progu zaliczenia.");
  }

  if (version.random_questions === null) {
    blockers.push("Nie ustawiono liczby dodatkowych pytań losowych.");
  }

  if (categories.length === 0) {
    blockers.push("Egzamin nie zawiera żadnego działu.");
  }

  const categoriesWithoutMinimum = categories.filter(
    (category) => category.minimum_questions === null,
  );

  if (categoriesWithoutMinimum.length > 0) {
    blockers.push(
      "Nie ustawiono minimalnej liczby pytań dla wszystkich działów.",
    );
  }

  if (
    version.questions_per_attempt !== null &&
    version.questions_per_attempt > totalQuestions
  ) {
    blockers.push(
      "Liczba pytań w jednej próbie przekracza liczbę pytań w bazie.",
    );
  }

  if (
    version.questions_per_attempt !== null &&
    version.passing_score !== null &&
    version.passing_score > version.questions_per_attempt
  ) {
    blockers.push(
      "Próg zaliczenia przekracza liczbę pytań w jednej próbie.",
    );
  }

  for (const category of categories) {
    if (
      category.minimum_questions !== null &&
      category.minimum_questions > category.question_count
    ) {
      blockers.push(
        `Dział "${category.name}" zawiera zbyt mało pytań dla ustawionego minimum.`,
      );
    }
  }

  const allMinimumsConfigured = categories.every(
    (category) => category.minimum_questions !== null,
  );

  if (
    allMinimumsConfigured &&
    version.questions_per_attempt !== null &&
    version.random_questions !== null
  ) {
    const minimumQuestionsTotal = categories.reduce(
      (sum, category) =>
        sum + (category.minimum_questions ?? 0),
      0,
    );

    if (
      minimumQuestionsTotal + version.random_questions !==
      version.questions_per_attempt
    ) {
      blockers.push(
        "Suma minimów działów i pytań losowych musi być równa liczbie pytań w jednej próbie.",
      );
    }

    const remainingQuestions =
      totalQuestions - minimumQuestionsTotal;

    if (remainingQuestions < version.random_questions) {
      blockers.push(
        "Po wybraniu minimów działów pozostaje zbyt mało pytań do losowego uzupełnienia próby.",
      );
    }
  }

  if (invalidQuestions.length > 0) {
    blockers.push(
      `Wykryto nieprawidłowe pytania: ${invalidQuestions
        .map((question) => question.external_id)
        .join(", ")}.`,
    );
  }

  return {
    categories,
    publication: {
      canPublish: blockers.length === 0,
      blockers,
      statistics: {
        categories: categories.length,
        questions: totalQuestions,
        invalidQuestions: invalidQuestions.length,
      },
    },
  };
}

function mapDetails(
  version: VersionRow,
  categories: CategoryRow[],
  publication: PublicationValidation,
): ExamVersionDetails {
  return {
    id: version.id,

    exam: {
      id: version.exam_id,
      slug: version.exam_slug,
      name: version.exam_name,
    },

    versionNumber: version.version_number,
    status: version.status,
    durationMinutes: version.duration_minutes,
    questionsPerAttempt: version.questions_per_attempt,
    passingScore: version.passing_score,
    answersPerQuestion: version.answers_per_question,
    randomQuestions: version.random_questions,
    createdAt: version.created_at,
    publishedAt: version.published_at,

    categories: categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      position: category.position,
      minimumQuestions: category.minimum_questions,
      questionCount: category.question_count,
    })),

    publication,
  };
}

export async function getExamVersionDetails(
  organizationId: string,
  versionId: string,
): Promise<ExamVersionDetails | null> {
  const client = await pool.connect();

  try {
    const version = await loadVersion(
      client,
      organizationId,
      versionId,
    );

    if (!version) {
      return null;
    }

    const { categories, publication } =
      await validateLoadedVersion(client, version);

    return mapDetails(version, categories, publication);
  } finally {
    client.release();
  }
}

export async function updateExamVersionConfiguration(input: {
  organizationId: string;
  versionId: string;
  configuration: ExamVersionConfiguration;
}): Promise<
  | {
      status: "updated";
      version: ExamVersionDetails;
    }
  | {
      status: "not_found";
    }
  | {
      status: "not_editable";
    }
  | {
      status: "invalid_categories";
    }
> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const versionResult = await client.query<{
      id: string;
      status: ExamVersionStatus;
    }>(
      `
        SELECT ev.id, ev.status
        FROM exam_versions ev
        INNER JOIN exams e
          ON e.id = ev.exam_id
        WHERE ev.id = $1
          AND e.organization_id = $2
        FOR UPDATE OF ev;
      `,
      [input.versionId, input.organizationId],
    );

    const version = versionResult.rows[0];

    if (!version) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    if (version.status !== "draft") {
      await client.query("ROLLBACK");

      return {
        status: "not_editable",
      };
    }

    const categoriesResult = await client.query<{
      id: string;
    }>(
      `
        SELECT id
        FROM categories
        WHERE exam_version_id = $1;
      `,
      [input.versionId],
    );

    const existingCategoryIds = new Set(
      categoriesResult.rows.map((category) => category.id),
    );

    const submittedCategoryIds = new Set(
      input.configuration.categories.map(
        (category) => category.id,
      ),
    );

    const categorySetsMatch =
      existingCategoryIds.size === submittedCategoryIds.size &&
      [...existingCategoryIds].every((categoryId) =>
        submittedCategoryIds.has(categoryId),
      );

    if (!categorySetsMatch) {
      await client.query("ROLLBACK");

      return {
        status: "invalid_categories",
      };
    }

    await client.query(
      `
        UPDATE exam_versions
        SET
          duration_minutes = $2,
          questions_per_attempt = $3,
          passing_score = $4,
          random_questions = $5
        WHERE id = $1;
      `,
      [
        input.versionId,
        input.configuration.durationMinutes,
        input.configuration.questionsPerAttempt,
        input.configuration.passingScore,
        input.configuration.randomQuestions,
      ],
    );

    for (const category of input.configuration.categories) {
      await client.query(
        `
          UPDATE categories
          SET minimum_questions = $2
          WHERE id = $1
            AND exam_version_id = $3;
        `,
        [
          category.id,
          category.minimumQuestions,
          input.versionId,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }

  const version = await getExamVersionDetails(
    input.organizationId,
    input.versionId,
  );

  if (!version) {
    throw new Error(
      "Nie znaleziono wersji egzaminu po zapisaniu konfiguracji.",
    );
  }

  return {
    status: "updated",
    version,
  };
}

export async function publishExamVersion(input: {
  organizationId: string;
  versionId: string;
}): Promise<
  | {
      status: "published";
      version: ExamVersionDetails;
    }
  | {
      status: "not_found";
    }
  | {
      status: "blocked";
      publication: PublicationValidation;
    }
> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const versionLockResult = await client.query<{
      id: string;
    }>(
      `
        SELECT ev.id
        FROM exam_versions ev
        INNER JOIN exams e
          ON e.id = ev.exam_id
        WHERE ev.id = $1
          AND e.organization_id = $2
        FOR UPDATE OF ev;
      `,
      [input.versionId, input.organizationId],
    );

    if (!versionLockResult.rows[0]) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    const version = await loadVersion(
      client,
      input.organizationId,
      input.versionId,
    );

    if (!version) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    const { publication } = await validateLoadedVersion(
      client,
      version,
    );

    if (!publication.canPublish) {
      await client.query("ROLLBACK");

      return {
        status: "blocked",
        publication,
      };
    }

    await client.query(
      `
        UPDATE exam_versions
        SET status = 'archived'
        WHERE exam_id = $1
          AND status = 'published'
          AND id <> $2;
      `,
      [version.exam_id, version.id],
    );

    await client.query(
      `
        UPDATE exam_versions
        SET
          status = 'published',
          published_at = NOW()
        WHERE id = $1;
      `,
      [version.id],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }

  const version = await getExamVersionDetails(
    input.organizationId,
    input.versionId,
  );

  if (!version) {
    throw new Error(
      "Nie znaleziono wersji egzaminu po publikacji.",
    );
  }

  return {
    status: "published",
    version,
  };
}