import type { PoolClient } from "pg";

import { assetStorage } from "../assets/index.js";
import { pool } from "../db/client.js";

const LOCAL_ORGANIZATION_SLUG = "bosman-local";

type LocalContextRow = {
  participant_id: string;
};

type ResultRow = {
  id: string;
  status: "completed" | "expired";
  exam_slug: string;
  exam_name: string;
  score: number | null;
  total_questions: number;
  passed: boolean | null;
  elapsed_seconds: number | null;
  started_at: Date;
  finished_at: Date | null;
};

type HistoryRow = ResultRow;

type MistakeRow = {
  position: number;
  external_id: string;
  question_text: string;
  image_path: string | null;
  selected_answer_id: string | null;
  selected_answer_text: string | null;
  correct_answer_id: string;
  correct_answer_text: string;
};

export type AttemptResultView = {
  id: string;
  status: "completed" | "expired";

  exam: {
    slug: string;
    name: string;
  };

  score: number;
  totalQuestions: number;
  passed: boolean;
  elapsedSeconds: number;
  startedAt: Date;
  finishedAt: Date;
};

export type AttemptMistakeView = {
  number: number;
  externalId: string;
  text: string;
  imageUrl: string | null;

  selectedAnswer: null | {
    id: string;
    text: string;
  };

  correctAnswer: {
    id: string;
    text: string;
  };
};

export type AttemptHistoryItem = AttemptResultView;

export type ReadAttemptResult =
  | {
      status: "not_found";
    }
  | {
      status: "not_finished";
    }
  | {
      status: "ready";
      result: AttemptResultView;
    };

export type ReadAttemptMistakesResult =
  | {
      status: "not_found";
    }
  | {
      status: "not_finished";
    }
  | {
      status: "ready";
      mistakes: AttemptMistakeView[];
    };

async function getLocalContext(
  client: PoolClient,
): Promise<LocalContextRow> {
  const result = await client.query<LocalContextRow>(
    `
      SELECT
        p.id AS participant_id
      FROM organizations organization
      INNER JOIN participants p
        ON p.organization_id = organization.id
       AND p.kind = 'local'
       AND p.is_active = TRUE
      WHERE organization.slug = $1
        AND organization.is_active = TRUE
      LIMIT 1;
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

async function finalizeExpiredAttempts(
  client: PoolClient,
  participantId: string,
): Promise<void> {
  await client.query(
    `
      WITH stale_attempts AS (
        SELECT
          attempt.id,
          version.passing_score,
          COUNT(response.id) FILTER (
            WHERE selected_answer.is_correct = TRUE
          )::integer AS score
        FROM attempts attempt
        INNER JOIN exam_versions version
          ON version.id = attempt.exam_version_id
        LEFT JOIN attempt_questions attempt_question
          ON attempt_question.attempt_id = attempt.id
        LEFT JOIN attempt_responses response
          ON response.attempt_question_id = attempt_question.id
        LEFT JOIN answers selected_answer
          ON selected_answer.id = response.selected_answer_id
        WHERE attempt.participant_id = $1
          AND (
            (
              attempt.status = 'in_progress'::attempt_status
              AND attempt.expires_at <= NOW()
            )
            OR (
              attempt.status = 'expired'::attempt_status
              AND (
                attempt.score IS NULL
                OR attempt.passed IS NULL
                OR attempt.elapsed_seconds IS NULL
                OR attempt.finished_at IS NULL
              )
            )
          )
        GROUP BY
          attempt.id,
          version.passing_score
      )
      UPDATE attempts attempt
      SET
        status = 'expired'::attempt_status,
        score = stale_attempt.score,
        passed =
          stale_attempt.score >= stale_attempt.passing_score,
        elapsed_seconds = GREATEST(
          0,
          FLOOR(
            EXTRACT(
              EPOCH FROM (
                LEAST(NOW(), attempt.expires_at) -
                attempt.started_at
              )
            )
          )::integer
        ),
        finished_at = COALESCE(
          attempt.finished_at,
          NOW()
        ),
        updated_at = NOW()
      FROM stale_attempts stale_attempt
      WHERE attempt.id = stale_attempt.id;
    `,
    [participantId],
  );
}

function mapResult(row: ResultRow): AttemptResultView {
  if (
    row.score === null ||
    row.passed === null ||
    row.elapsed_seconds === null ||
    row.finished_at === null
  ) {
    throw new Error(
      `Próba "${row.id}" nie ma kompletnego wyniku.`,
    );
  }

  return {
    id: row.id,
    status: row.status,

    exam: {
      slug: row.exam_slug,
      name: row.exam_name,
    },

    score: row.score,
    totalQuestions: row.total_questions,
    passed: row.passed,
    elapsedSeconds: row.elapsed_seconds,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

async function loadAttemptStatus(
  client: PoolClient,
  attemptId: string,
  participantId: string,
): Promise<
  | "in_progress"
  | "completed"
  | "expired"
  | "cancelled"
  | null
> {
  const result = await client.query<{
    status:
      | "in_progress"
      | "completed"
      | "expired"
      | "cancelled";
  }>(
    `
      SELECT status
      FROM attempts
      WHERE id = $1
        AND participant_id = $2
      LIMIT 1;
    `,
    [attemptId, participantId],
  );

  return result.rows[0]?.status ?? null;
}

async function loadResult(
  client: PoolClient,
  attemptId: string,
  participantId: string,
): Promise<AttemptResultView | null> {
  const result = await client.query<ResultRow>(
    `
      SELECT
        attempt.id,
        attempt.status,
        exam.slug AS exam_slug,
        exam.name AS exam_name,
        attempt.score,
        attempt.total_questions,
        attempt.passed,
        attempt.elapsed_seconds,
        attempt.started_at,
        attempt.finished_at
      FROM attempts attempt
      INNER JOIN exams exam
        ON exam.id = attempt.exam_id
      WHERE attempt.id = $1
        AND attempt.participant_id = $2
        AND attempt.status IN (
          'completed'::attempt_status,
          'expired'::attempt_status
        )
      LIMIT 1;
    `,
    [attemptId, participantId],
  );

  const row = result.rows[0];

  return row ? mapResult(row) : null;
}

export async function getLocalAttemptResult(
  attemptId: string,
): Promise<ReadAttemptResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const context = await getLocalContext(client);

    await finalizeExpiredAttempts(
      client,
      context.participant_id,
    );

    const status = await loadAttemptStatus(
      client,
      attemptId,
      context.participant_id,
    );

    if (!status) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    if (
      status !== "completed" &&
      status !== "expired"
    ) {
      await client.query("ROLLBACK");

      return {
        status: "not_finished",
      };
    }

    const result = await loadResult(
      client,
      attemptId,
      context.participant_id,
    );

    if (!result) {
      throw new Error(
        "Nie udało się odczytać wyniku próby.",
      );
    }

    await client.query("COMMIT");

    return {
      status: "ready",
      result,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getLocalAttemptMistakes(
  attemptId: string,
): Promise<ReadAttemptMistakesResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const context = await getLocalContext(client);

    await finalizeExpiredAttempts(
      client,
      context.participant_id,
    );

    const status = await loadAttemptStatus(
      client,
      attemptId,
      context.participant_id,
    );

    if (!status) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    if (
      status !== "completed" &&
      status !== "expired"
    ) {
      await client.query("ROLLBACK");

      return {
        status: "not_finished",
      };
    }

    const result = await client.query<MistakeRow>(
      `
        SELECT
          attempt_question.position,
          question.external_id,
          question.text AS question_text,
          question.image_path,
          selected_answer.id AS selected_answer_id,
          selected_answer.text AS selected_answer_text,
          correct_answer.id AS correct_answer_id,
          correct_answer.text AS correct_answer_text
        FROM attempts attempt
        INNER JOIN attempt_questions attempt_question
          ON attempt_question.attempt_id = attempt.id
        INNER JOIN questions question
          ON question.id = attempt_question.question_id
        LEFT JOIN attempt_responses response
          ON response.attempt_question_id = attempt_question.id
        LEFT JOIN answers selected_answer
          ON selected_answer.id = response.selected_answer_id
        INNER JOIN answers correct_answer
          ON correct_answer.question_id = question.id
         AND correct_answer.is_correct = TRUE
        WHERE attempt.id = $1
          AND attempt.participant_id = $2
          AND attempt.status IN (
            'completed'::attempt_status,
            'expired'::attempt_status
          )
          AND (
            response.id IS NULL
            OR selected_answer.is_correct = FALSE
          )
        ORDER BY attempt_question.position;
      `,
      [attemptId, context.participant_id],
    );

    await client.query("COMMIT");

    return {
      status: "ready",

      mistakes: result.rows.map((row) => ({
        number: row.position + 1,
        externalId: row.external_id,
        text: row.question_text,

        imageUrl:
          row.image_path === null
            ? null
            : assetStorage.getPublicUrl(row.image_path),

        selectedAnswer:
          row.selected_answer_id === null ||
          row.selected_answer_text === null
            ? null
            : {
                id: row.selected_answer_id,
                text: row.selected_answer_text,
              },

        correctAnswer: {
          id: row.correct_answer_id,
          text: row.correct_answer_text,
        },
      })),
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getLocalAttemptHistory(): Promise<
  AttemptHistoryItem[]
> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const context = await getLocalContext(client);

    await finalizeExpiredAttempts(
      client,
      context.participant_id,
    );

    const result = await client.query<HistoryRow>(
      `
        SELECT
          attempt.id,
          attempt.status,
          exam.slug AS exam_slug,
          exam.name AS exam_name,
          attempt.score,
          attempt.total_questions,
          attempt.passed,
          attempt.elapsed_seconds,
          attempt.started_at,
          attempt.finished_at
        FROM attempts attempt
        INNER JOIN exams exam
          ON exam.id = attempt.exam_id
        WHERE attempt.participant_id = $1
          AND attempt.status IN (
            'completed'::attempt_status,
            'expired'::attempt_status
          )
        ORDER BY
          attempt.finished_at DESC NULLS LAST,
          attempt.started_at DESC;
      `,
      [context.participant_id],
    );

    await client.query("COMMIT");

    return result.rows.map(mapResult);
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getParticipantAttemptResult(input: {
  participantId: string;
  attemptId: string;
}): Promise<ReadAttemptResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await finalizeExpiredAttempts(
      client,
      input.participantId,
    );

    const status = await loadAttemptStatus(
      client,
      input.attemptId,
      input.participantId,
    );

    if (!status) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    if (
      status !== "completed" &&
      status !== "expired"
    ) {
      await client.query("ROLLBACK");

      return {
        status: "not_finished",
      };
    }

    const result = await loadResult(
      client,
      input.attemptId,
      input.participantId,
    );

    if (!result) {
      throw new Error(
        "Nie udało się odczytać wyniku próby.",
      );
    }

    await client.query("COMMIT");

    return {
      status: "ready",
      result,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getParticipantAttemptMistakes(input: {
  participantId: string;
  attemptId: string;
}): Promise<ReadAttemptMistakesResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await finalizeExpiredAttempts(
      client,
      input.participantId,
    );

    const status = await loadAttemptStatus(
      client,
      input.attemptId,
      input.participantId,
    );

    if (!status) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    if (
      status !== "completed" &&
      status !== "expired"
    ) {
      await client.query("ROLLBACK");

      return {
        status: "not_finished",
      };
    }

    const result = await client.query<MistakeRow>(
      `
        SELECT
          attempt_question.position,
          question.external_id,
          question.text AS question_text,
          question.image_path,
          selected_answer.id AS selected_answer_id,
          selected_answer.text AS selected_answer_text,
          correct_answer.id AS correct_answer_id,
          correct_answer.text AS correct_answer_text
        FROM attempts attempt
        INNER JOIN attempt_questions attempt_question
          ON attempt_question.attempt_id = attempt.id
        INNER JOIN questions question
          ON question.id = attempt_question.question_id
        LEFT JOIN attempt_responses response
          ON response.attempt_question_id = attempt_question.id
        LEFT JOIN answers selected_answer
          ON selected_answer.id = response.selected_answer_id
        INNER JOIN answers correct_answer
          ON correct_answer.question_id = question.id
         AND correct_answer.is_correct = TRUE
        WHERE attempt.id = $1
          AND attempt.participant_id = $2
          AND attempt.status IN (
            'completed'::attempt_status,
            'expired'::attempt_status
          )
          AND (
            response.id IS NULL
            OR selected_answer.is_correct = FALSE
          )
        ORDER BY attempt_question.position;
      `,
      [input.attemptId, input.participantId],
    );

    await client.query("COMMIT");

    return {
      status: "ready",

      mistakes: result.rows.map((row) => ({
        number: row.position + 1,
        externalId: row.external_id,
        text: row.question_text,

        imageUrl:
          row.image_path === null
            ? null
            : assetStorage.getPublicUrl(row.image_path),

        selectedAnswer:
          row.selected_answer_id === null ||
          row.selected_answer_text === null
            ? null
            : {
                id: row.selected_answer_id,
                text: row.selected_answer_text,
              },

        correctAnswer: {
          id: row.correct_answer_id,
          text: row.correct_answer_text,
        },
      })),
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getParticipantAttemptHistory(input: {
  participantId: string;
}): Promise<AttemptHistoryItem[]> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await finalizeExpiredAttempts(
      client,
      input.participantId,
    );

    const result = await client.query<HistoryRow>(
      `
        SELECT
          attempt.id,
          attempt.status,
          exam.slug AS exam_slug,
          exam.name AS exam_name,
          attempt.score,
          attempt.total_questions,
          attempt.passed,
          attempt.elapsed_seconds,
          attempt.started_at,
          attempt.finished_at
        FROM attempts attempt
        INNER JOIN exams exam
          ON exam.id = attempt.exam_id
        WHERE attempt.participant_id = $1
          AND attempt.status IN (
            'completed'::attempt_status,
            'expired'::attempt_status
          )
        ORDER BY
          attempt.finished_at DESC NULLS LAST,
          attempt.started_at DESC;
      `,
      [input.participantId],
    );

    await client.query("COMMIT");

    return result.rows.map(mapResult);
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}