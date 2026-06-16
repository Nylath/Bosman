import { randomInt } from "node:crypto";

import type { PoolClient } from "pg";

import { assetStorage } from "../assets/index.js";
import { pool } from "../db/client.js";

const LOCAL_ORGANIZATION_SLUG = "bosman-local";

type LocalContextRow = {
  organization_id: string;
  participant_id: string;
};

type PublishedExamRow = {
  exam_id: string;
  exam_slug: string;
  exam_name: string;
  version_id: string;
  duration_minutes: number;
  questions_per_attempt: number;
  random_questions: number;
};

type CategoryRow = {
  id: string;
  minimum_questions: number;
};

type QuestionSelectionRow = {
  id: string;
  category_id: string;
};

type AnswerSelectionRow = {
  id: string;
  question_id: string;
  text: string;
};

type AttemptRow = {
  id: string;
  status:
    | "in_progress"
    | "completed"
    | "expired"
    | "cancelled";
  exam_slug: string;
  exam_name: string;
  total_questions: number;
  current_question_position: number;
  started_at: Date;
  expires_at: Date;
};

type CurrentQuestionRow = {
  attempt_question_id: string;
  position: number;
  external_id: string;
  text: string;
  image_path: string | null;
};

type CurrentOptionRow = {
  id: string;
  text: string;
};

export type AttemptView = {
  id: string;
  status:
    | "in_progress"
    | "completed"
    | "expired"
    | "cancelled";

  exam: {
    slug: string;
    name: string;
  };

  totalQuestions: number;
  currentQuestionPosition: number;
  startedAt: Date;
  expiresAt: Date;

  currentQuestion: null | {
    attemptQuestionId: string;
    externalId: string;
    position: number;
    number: number;
    text: string;
    imageUrl: string | null;

    answers: Array<{
      id: string;
      text: string;
    }>;
  };
};

export type StartAttemptResult =
  | {
      status: "not_found";
    }
  | {
      status: "ready";
      created: boolean;
      attempt: AttemptView;
    };

function shuffle<T>(values: T[]): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(index + 1);

    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index],
    ];
  }

  return result;
}

function pickRandom<T>(values: T[], count: number): T[] {
  if (count > values.length) {
    throw new Error(
      `Nie można wylosować ${count} elementów z puli zawierającej ${values.length} elementów.`,
    );
  }

  return shuffle(values).slice(0, count);
}

async function getLocalContext(
  client: PoolClient,
  lockParticipant: boolean,
): Promise<LocalContextRow> {
  const lockSql = lockParticipant
    ? "FOR UPDATE OF p"
    : "";

  const result = await client.query<LocalContextRow>(
    `
      SELECT
        o.id AS organization_id,
        p.id AS participant_id
      FROM organizations o
      INNER JOIN participants p
        ON p.organization_id = o.id
       AND p.kind = 'local'
       AND p.is_active = TRUE
      WHERE o.slug = $1
        AND o.is_active = TRUE
      LIMIT 1
      ${lockSql};
    `,
    [LOCAL_ORGANIZATION_SLUG],
  );

  const context = result.rows[0];

  if (!context) {
    throw new Error(
      "Nie znaleziono aktywnego lokalnego profilu użytkownika.",
    );
  }

  return context;
}

async function loadAttemptView(
  client: PoolClient,
  attemptId: string,
  participantId: string,
): Promise<AttemptView | null> {
  const attemptResult = await client.query<AttemptRow>(
    `
      SELECT
        a.id,
        a.status,
        e.slug AS exam_slug,
        e.name AS exam_name,
        a.total_questions,
        a.current_question_position,
        a.started_at,
        a.expires_at
      FROM attempts a
      INNER JOIN exams e
        ON e.id = a.exam_id
      WHERE a.id = $1
        AND a.participant_id = $2
      LIMIT 1;
    `,
    [attemptId, participantId],
  );

  const attempt = attemptResult.rows[0];

  if (!attempt) {
    return null;
  }

  if (
    attempt.status === "in_progress" &&
    attempt.expires_at.getTime() <= Date.now()
  ) {
    await client.query(
      `
        UPDATE attempts
        SET
          status = 'expired',
          finished_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
          AND status = 'in_progress';
      `,
      [attempt.id],
    );

    attempt.status = "expired";
  }

  if (attempt.status !== "in_progress") {
    return {
      id: attempt.id,
      status: attempt.status,

      exam: {
        slug: attempt.exam_slug,
        name: attempt.exam_name,
      },

      totalQuestions: attempt.total_questions,
      currentQuestionPosition:
        attempt.current_question_position,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      currentQuestion: null,
    };
  }

  const questionResult = await client.query<CurrentQuestionRow>(
    `
      SELECT
        aq.id AS attempt_question_id,
        aq.position,
        q.external_id,
        q.text,
        q.image_path
      FROM attempt_questions aq
      INNER JOIN questions q
        ON q.id = aq.question_id
      WHERE aq.attempt_id = $1
        AND aq.position = $2
      LIMIT 1;
    `,
    [
      attempt.id,
      attempt.current_question_position,
    ],
  );

  const question = questionResult.rows[0];

  if (!question) {
    throw new Error(
      "Nie znaleziono aktualnego pytania w rozpoczętej próbie.",
    );
  }

  const optionResult = await client.query<CurrentOptionRow>(
    `
      SELECT
        a.id,
        a.text
      FROM attempt_question_options aqo
      INNER JOIN answers a
        ON a.id = aqo.answer_id
      WHERE aqo.attempt_question_id = $1
      ORDER BY aqo.position;
    `,
    [question.attempt_question_id],
  );

  return {
    id: attempt.id,
    status: attempt.status,

    exam: {
      slug: attempt.exam_slug,
      name: attempt.exam_name,
    },

    totalQuestions: attempt.total_questions,
    currentQuestionPosition:
      attempt.current_question_position,
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at,

    currentQuestion: {
      attemptQuestionId: question.attempt_question_id,
      externalId: question.external_id,
      position: question.position,
      number: question.position + 1,
      text: question.text,

      imageUrl:
        question.image_path === null
          ? null
          : assetStorage.getPublicUrl(
              question.image_path,
            ),

      answers: optionResult.rows.map((option) => ({
        id: option.id,
        text: option.text,
      })),
    },
  };
}

export async function startOrResumeLocalAttempt(
  examSlug: string,
): Promise<StartAttemptResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const context = await getLocalContext(client, true);

    const examResult =
      await client.query<PublishedExamRow>(
        `
          SELECT
            e.id AS exam_id,
            e.slug AS exam_slug,
            e.name AS exam_name,
            ev.id AS version_id,
            ev.duration_minutes,
            ev.questions_per_attempt,
            ev.random_questions
          FROM exams e
          INNER JOIN LATERAL (
            SELECT
              id,
              duration_minutes,
              questions_per_attempt,
              random_questions
            FROM exam_versions
            WHERE exam_id = e.id
              AND status = 'published'
            ORDER BY version_number DESC
            LIMIT 1
          ) ev ON TRUE
          WHERE e.organization_id = $1
            AND e.slug = $2
            AND e.is_active = TRUE
          LIMIT 1;
        `,
        [context.organization_id, examSlug],
      );

    const exam = examResult.rows[0];

    if (!exam) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    const activeAttemptResult = await client.query<{
      id: string;
      expires_at: Date;
    }>(
      `
        SELECT
          id,
          expires_at
        FROM attempts
        WHERE participant_id = $1
          AND exam_id = $2
          AND status = 'in_progress'
        ORDER BY started_at DESC
        LIMIT 1
        FOR UPDATE;
      `,
      [context.participant_id, exam.exam_id],
    );

    const activeAttempt = activeAttemptResult.rows[0];

    if (activeAttempt) {
      if (activeAttempt.expires_at.getTime() > Date.now()) {
        const attempt = await loadAttemptView(
          client,
          activeAttempt.id,
          context.participant_id,
        );

        if (!attempt) {
          throw new Error(
            "Nie udało się odczytać aktywnej próby.",
          );
        }

        await client.query("COMMIT");

        return {
          status: "ready",
          created: false,
          attempt,
        };
      }

      await client.query(
        `
          UPDATE attempts
          SET
            status = 'expired',
            finished_at = NOW(),
            updated_at = NOW()
          WHERE id = $1;
        `,
        [activeAttempt.id],
      );
    }

    const categoryResult = await client.query<CategoryRow>(
      `
        SELECT
          id,
          minimum_questions
        FROM categories
        WHERE exam_version_id = $1
        ORDER BY position;
      `,
      [exam.version_id],
    );

    const questionResult =
      await client.query<QuestionSelectionRow>(
        `
          SELECT
            id,
            category_id
          FROM questions
          WHERE exam_version_id = $1;
        `,
        [exam.version_id],
      );

    const selectedQuestionIds = new Set<string>();

    const minimumQuestions: QuestionSelectionRow[] = [];

    for (const category of categoryResult.rows) {
      const categoryPool = questionResult.rows.filter(
        (question) =>
          question.category_id === category.id &&
          !selectedQuestionIds.has(question.id),
      );

      const selectedFromCategory = pickRandom(
        categoryPool,
        category.minimum_questions,
      );

      for (const question of selectedFromCategory) {
        selectedQuestionIds.add(question.id);
        minimumQuestions.push(question);
      }
    }

    const remainingPool = questionResult.rows.filter(
      (question) =>
        !selectedQuestionIds.has(question.id),
    );

    const additionalQuestions = pickRandom(
      remainingPool,
      exam.random_questions,
    );

    const selectedQuestions = shuffle([
      ...minimumQuestions,
      ...additionalQuestions,
    ]);

    if (
      selectedQuestions.length !==
      exam.questions_per_attempt
    ) {
      throw new Error(
        "Wylosowana liczba pytań nie odpowiada konfiguracji egzaminu.",
      );
    }

    const answerResult =
      await client.query<AnswerSelectionRow>(
        `
          SELECT
            id,
            question_id,
            text
          FROM answers
          WHERE question_id = ANY($1::uuid[])
          ORDER BY question_id, position;
        `,
        [
          selectedQuestions.map(
            (question) => question.id,
          ),
        ],
      );

    const answersByQuestionId = new Map<
      string,
      AnswerSelectionRow[]
    >();

    for (const answer of answerResult.rows) {
      const existingAnswers =
        answersByQuestionId.get(answer.question_id) ?? [];

      existingAnswers.push(answer);

      answersByQuestionId.set(
        answer.question_id,
        existingAnswers,
      );
    }

    const attemptResult = await client.query<{
      id: string;
    }>(
      `
        INSERT INTO attempts (
          organization_id,
          participant_id,
          course_id,
          exam_id,
          exam_version_id,
          status,
          total_questions,
          current_question_position,
          started_at,
          expires_at
        )
        VALUES (
          $1,
          $2,
          NULL,
          $3,
          $4,
          'in_progress',
          $5,
          0,
          NOW(),
          NOW() + make_interval(mins => $6)
        )
        RETURNING id;
      `,
      [
        context.organization_id,
        context.participant_id,
        exam.exam_id,
        exam.version_id,
        selectedQuestions.length,
        exam.duration_minutes,
      ],
    );

    const attempt = attemptResult.rows[0];

    if (!attempt) {
      throw new Error(
        "Nie udało się utworzyć próby egzaminacyjnej.",
      );
    }

    for (
      let questionPosition = 0;
      questionPosition < selectedQuestions.length;
      questionPosition += 1
    ) {
      const selectedQuestion =
        selectedQuestions[questionPosition];

      const attemptQuestionResult = await client.query<{
        id: string;
      }>(
        `
          INSERT INTO attempt_questions (
            attempt_id,
            question_id,
            position
          )
          VALUES ($1, $2, $3)
          RETURNING id;
        `,
        [
          attempt.id,
          selectedQuestion.id,
          questionPosition,
        ],
      );

      const attemptQuestion =
        attemptQuestionResult.rows[0];

      if (!attemptQuestion) {
        throw new Error(
          "Nie udało się zapisać pytania próby.",
        );
      }

      const questionAnswers =
        answersByQuestionId.get(selectedQuestion.id) ?? [];

      for (const [
        optionPosition,
        answer,
      ] of shuffle(questionAnswers).entries()) {
        await client.query(
          `
            INSERT INTO attempt_question_options (
              attempt_question_id,
              answer_id,
              position
            )
            VALUES ($1, $2, $3);
          `,
          [
            attemptQuestion.id,
            answer.id,
            optionPosition,
          ],
        );
      }
    }

    const attemptView = await loadAttemptView(
      client,
      attempt.id,
      context.participant_id,
    );

    if (!attemptView) {
      throw new Error(
        "Nie udało się odczytać utworzonej próby.",
      );
    }

    await client.query("COMMIT");

    return {
      status: "ready",
      created: true,
      attempt: attemptView,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getLocalAttempt(
  attemptId: string,
): Promise<AttemptView | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const context = await getLocalContext(client, false);

    const attempt = await loadAttemptView(
      client,
      attemptId,
      context.participant_id,
    );

    await client.query("COMMIT");

    return attempt;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getActiveLocalAttemptForExam(
  examSlug: string,
): Promise<AttemptView | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const context = await getLocalContext(
      client,
      false,
    );

    const activeAttemptResult =
      await client.query<{
        id: string;
      }>(
        `
          SELECT
            a.id
          FROM attempts a
          INNER JOIN exams e
            ON e.id = a.exam_id
          WHERE a.participant_id = $1
            AND e.organization_id = $2
            AND e.slug = $3
            AND e.is_active = TRUE
            AND a.status = 'in_progress'
          ORDER BY a.started_at DESC
          LIMIT 1
          FOR UPDATE OF a;
        `,
        [
          context.participant_id,
          context.organization_id,
          examSlug,
        ],
      );

    const activeAttempt =
      activeAttemptResult.rows[0];

    if (!activeAttempt) {
      await client.query("COMMIT");

      return null;
    }

    const attempt = await loadAttemptView(
      client,
      activeAttempt.id,
      context.participant_id,
    );

    await client.query("COMMIT");

    if (
      !attempt ||
      attempt.status !== "in_progress"
    ) {
      return null;
    }

    return attempt;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function startOrResumeParticipantAttempt(input: {
  organizationId: string;
  participantId: string;
  examSlug: string;
}): Promise<StartAttemptResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const examResult =
      await client.query<PublishedExamRow>(
        `
          SELECT
            e.id AS exam_id,
            e.slug AS exam_slug,
            e.name AS exam_name,
            ev.id AS version_id,
            ev.duration_minutes,
            ev.questions_per_attempt,
            ev.random_questions
          FROM participant_exam_accesses pea
          INNER JOIN exams e
            ON e.id = pea.exam_id
          INNER JOIN LATERAL (
            SELECT
              id,
              duration_minutes,
              questions_per_attempt,
              random_questions
            FROM exam_versions
            WHERE exam_id = e.id
              AND status = 'published'
              AND duration_minutes IS NOT NULL
              AND questions_per_attempt IS NOT NULL
              AND passing_score IS NOT NULL
            ORDER BY
              published_at DESC NULLS LAST,
              version_number DESC
            LIMIT 1
          ) ev ON TRUE
          WHERE pea.participant_id = $1
            AND e.organization_id = $2
            AND e.slug = $3
            AND e.is_active = TRUE
            AND pea.is_active = TRUE
            AND pea.revoked_at IS NULL
            AND pea.valid_from <= NOW()
            AND (
              pea.valid_until IS NULL
              OR pea.valid_until > NOW()
            )
          LIMIT 1;
        `,
        [
          input.participantId,
          input.organizationId,
          input.examSlug,
        ],
      );

    const exam = examResult.rows[0];

    if (!exam) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    const activeAttemptResult = await client.query<{
      id: string;
      expires_at: Date;
    }>(
      `
        SELECT
          id,
          expires_at
        FROM attempts
        WHERE participant_id = $1
          AND exam_id = $2
          AND status = 'in_progress'
        ORDER BY started_at DESC
        LIMIT 1
        FOR UPDATE;
      `,
      [
        input.participantId,
        exam.exam_id,
      ],
    );

    const activeAttempt = activeAttemptResult.rows[0];

    if (activeAttempt) {
      if (activeAttempt.expires_at.getTime() > Date.now()) {
        const attempt = await loadAttemptView(
          client,
          activeAttempt.id,
          input.participantId,
        );

        if (!attempt) {
          throw new Error(
            "Nie udało się odczytać aktywnej próby.",
          );
        }

        await client.query("COMMIT");

        return {
          status: "ready",
          created: false,
          attempt,
        };
      }

      await client.query(
        `
          UPDATE attempts
          SET
            status = 'expired',
            finished_at = NOW(),
            updated_at = NOW()
          WHERE id = $1;
        `,
        [activeAttempt.id],
      );
    }

    const categoryResult = await client.query<CategoryRow>(
      `
        SELECT
          id,
          minimum_questions
        FROM categories
        WHERE exam_version_id = $1
        ORDER BY position;
      `,
      [exam.version_id],
    );

    const questionResult =
      await client.query<QuestionSelectionRow>(
        `
          SELECT
            id,
            category_id
          FROM questions
          WHERE exam_version_id = $1;
        `,
        [exam.version_id],
      );

    const selectedQuestionIds = new Set<string>();

    const minimumQuestions: QuestionSelectionRow[] = [];

    for (const category of categoryResult.rows) {
      const categoryPool = questionResult.rows.filter(
        (question) =>
          question.category_id === category.id &&
          !selectedQuestionIds.has(question.id),
      );

      const selectedFromCategory = pickRandom(
        categoryPool,
        category.minimum_questions,
      );

      for (const question of selectedFromCategory) {
        selectedQuestionIds.add(question.id);
        minimumQuestions.push(question);
      }
    }

    const remainingPool = questionResult.rows.filter(
      (question) =>
        !selectedQuestionIds.has(question.id),
    );

    const additionalQuestions = pickRandom(
      remainingPool,
      exam.random_questions,
    );

    const selectedQuestions = shuffle([
      ...minimumQuestions,
      ...additionalQuestions,
    ]);

    if (
      selectedQuestions.length !==
      exam.questions_per_attempt
    ) {
      throw new Error(
        "Wylosowana liczba pytań nie odpowiada konfiguracji egzaminu.",
      );
    }

    const answerResult =
      await client.query<AnswerSelectionRow>(
        `
          SELECT
            id,
            question_id,
            text
          FROM answers
          WHERE question_id = ANY($1::uuid[])
          ORDER BY question_id, position;
        `,
        [
          selectedQuestions.map(
            (question) => question.id,
          ),
        ],
      );

    const answersByQuestionId = new Map<
      string,
      AnswerSelectionRow[]
    >();

    for (const answer of answerResult.rows) {
      const existingAnswers =
        answersByQuestionId.get(answer.question_id) ?? [];

      existingAnswers.push(answer);

      answersByQuestionId.set(
        answer.question_id,
        existingAnswers,
      );
    }

    const attemptResult = await client.query<{
      id: string;
    }>(
      `
        INSERT INTO attempts (
          organization_id,
          participant_id,
          course_id,
          exam_id,
          exam_version_id,
          status,
          total_questions,
          current_question_position,
          started_at,
          expires_at
        )
        VALUES (
          $1,
          $2,
          NULL,
          $3,
          $4,
          'in_progress',
          $5,
          0,
          NOW(),
          NOW() + make_interval(mins => $6)
        )
        RETURNING id;
      `,
      [
        input.organizationId,
        input.participantId,
        exam.exam_id,
        exam.version_id,
        selectedQuestions.length,
        exam.duration_minutes,
      ],
    );

    const attempt = attemptResult.rows[0];

    if (!attempt) {
      throw new Error(
        "Nie udało się utworzyć próby egzaminacyjnej.",
      );
    }

    for (
      let questionPosition = 0;
      questionPosition < selectedQuestions.length;
      questionPosition += 1
    ) {
      const selectedQuestion =
        selectedQuestions[questionPosition];

      const attemptQuestionResult = await client.query<{
        id: string;
      }>(
        `
          INSERT INTO attempt_questions (
            attempt_id,
            question_id,
            position
          )
          VALUES ($1, $2, $3)
          RETURNING id;
        `,
        [
          attempt.id,
          selectedQuestion.id,
          questionPosition,
        ],
      );

      const attemptQuestion =
        attemptQuestionResult.rows[0];

      if (!attemptQuestion) {
        throw new Error(
          "Nie udało się zapisać pytania próby.",
        );
      }

      const questionAnswers =
        answersByQuestionId.get(selectedQuestion.id) ?? [];

      for (const [
        optionPosition,
        answer,
      ] of shuffle(questionAnswers).entries()) {
        await client.query(
          `
            INSERT INTO attempt_question_options (
              attempt_question_id,
              answer_id,
              position
            )
            VALUES ($1, $2, $3);
          `,
          [
            attemptQuestion.id,
            answer.id,
            optionPosition,
          ],
        );
      }
    }

    const attemptView = await loadAttemptView(
      client,
      attempt.id,
      input.participantId,
    );

    if (!attemptView) {
      throw new Error(
        "Nie udało się odczytać utworzonej próby.",
      );
    }

    await client.query("COMMIT");

    return {
      status: "ready",
      created: true,
      attempt: attemptView,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getParticipantAttempt(input: {
  participantId: string;
  attemptId: string;
}): Promise<AttemptView | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const attempt = await loadAttemptView(
      client,
      input.attemptId,
      input.participantId,
    );

    await client.query("COMMIT");

    return attempt;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getActiveParticipantAttemptForExam(input: {
  organizationId: string;
  participantId: string;
  examSlug: string;
}): Promise<AttemptView | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const activeAttemptResult =
      await client.query<{
        id: string;
      }>(
        `
          SELECT
            a.id
          FROM attempts a
          INNER JOIN exams e
            ON e.id = a.exam_id
          INNER JOIN participant_exam_accesses pea
            ON pea.exam_id = e.id
           AND pea.participant_id = a.participant_id
          WHERE a.participant_id = $1
            AND e.organization_id = $2
            AND e.slug = $3
            AND e.is_active = TRUE
            AND a.status = 'in_progress'
            AND pea.is_active = TRUE
            AND pea.revoked_at IS NULL
            AND pea.valid_from <= NOW()
            AND (
              pea.valid_until IS NULL
              OR pea.valid_until > NOW()
            )
          ORDER BY a.started_at DESC
          LIMIT 1
          FOR UPDATE OF a;
        `,
        [
          input.participantId,
          input.organizationId,
          input.examSlug,
        ],
      );

    const activeAttempt =
      activeAttemptResult.rows[0];

    if (!activeAttempt) {
      await client.query("COMMIT");

      return null;
    }

    const attempt = await loadAttemptView(
      client,
      activeAttempt.id,
      input.participantId,
    );

    await client.query("COMMIT");

    if (
      !attempt ||
      attempt.status !== "in_progress"
    ) {
      return null;
    }

    return attempt;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}