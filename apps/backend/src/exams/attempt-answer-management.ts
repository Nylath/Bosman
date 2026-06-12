import type { PoolClient } from "pg";

import { pool } from "../db/client.js";

import {
  getLocalAttempt,
  type AttemptView,
} from "./attempt-management.js";

const LOCAL_ORGANIZATION_SLUG = "bosman-local";

type LocalContextRow = {
  organization_id: string;
  participant_id: string;
};

type LockedAttemptRow = {
  id: string;
  status:
    | "in_progress"
    | "completed"
    | "expired"
    | "cancelled";
  total_questions: number;
  current_question_position: number;
  expires_at: Date;
};

type ResultRow = {
  id: string;
  status:
    | "completed"
    | "expired";
  exam_slug: string;
  exam_name: string;
  score: number;
  total_questions: number;
  passed: boolean;
  elapsed_seconds: number;
  started_at: Date;
  finished_at: Date;
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

export type SubmitAttemptAnswerResult =
  | {
      status: "not_found";
    }
  | {
      status: "not_in_progress";
    }
  | {
      status: "invalid_question";
    }
  | {
      status: "invalid_answer";
    }
  | {
      status: "already_answered";
    }
  | {
      status: "next_question";
      attempt: AttemptView;
    }
  | {
      status: "finished";
      result: AttemptResultView;
    };

async function getLocalContext(
  client: PoolClient,
): Promise<LocalContextRow> {
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

async function finalizeAttempt(
  client: PoolClient,
  attemptId: string,
  status: "completed" | "expired",
): Promise<void> {
  const scoreResult = await client.query<{
    score: number;
    passing_score: number;
  }>(
    `
      SELECT
        COUNT(ar.id) FILTER (
          WHERE selected_answer.is_correct = TRUE
        )::integer AS score,
        ev.passing_score
      FROM attempts attempt
      INNER JOIN exam_versions ev
        ON ev.id = attempt.exam_version_id
      LEFT JOIN attempt_questions aq
        ON aq.attempt_id = attempt.id
      LEFT JOIN attempt_responses ar
        ON ar.attempt_question_id = aq.id
      LEFT JOIN answers selected_answer
        ON selected_answer.id = ar.selected_answer_id
      WHERE attempt.id = $1
      GROUP BY ev.passing_score;
    `,
    [attemptId],
  );

  const scoreData = scoreResult.rows[0];

  if (!scoreData) {
    throw new Error(
      "Nie udało się obliczyć wyniku próby.",
    );
  }

  await client.query(
    `
      UPDATE attempts
SET
  status = $2::attempt_status,
  score = $3,
  passed = $4,
  elapsed_seconds = GREATEST(
    0,
    FLOOR(
      EXTRACT(
        EPOCH FROM (
          LEAST(NOW(), expires_at) - started_at
        )
      )
    )::integer
  ),
  current_question_position = CASE
    WHEN $2::attempt_status = 'completed'::attempt_status
      THEN total_questions
    ELSE current_question_position
  END,
  finished_at = NOW(),
  updated_at = NOW()
WHERE id = $1;
    `,
    [
      attemptId,
      status,
      scoreData.score,
      scoreData.score >= scoreData.passing_score,
    ],
  );
}

async function loadFinishedResult(
  client: PoolClient,
  attemptId: string,
  participantId: string,
): Promise<AttemptResultView> {
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
        AND attempt.status IN ('completed', 'expired')
      LIMIT 1;
    `,
    [attemptId, participantId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error(
      "Nie udało się odczytać zakończonej próby.",
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

export async function submitLocalAttemptAnswer(input: {
  attemptId: string;
  attemptQuestionId: string;
  selectedAnswerId: string;
}): Promise<SubmitAttemptAnswerResult> {
  const client = await pool.connect();

  let shouldLoadNextQuestion = false;

  try {
    await client.query("BEGIN");

    const context = await getLocalContext(client);

    const attemptResult =
      await client.query<LockedAttemptRow>(
        `
          SELECT
            id,
            status,
            total_questions,
            current_question_position,
            expires_at
          FROM attempts
          WHERE id = $1
            AND participant_id = $2
          LIMIT 1
          FOR UPDATE;
        `,
        [
          input.attemptId,
          context.participant_id,
        ],
      );

    const attempt = attemptResult.rows[0];

    if (!attempt) {
      await client.query("ROLLBACK");

      return {
        status: "not_found",
      };
    }

    if (attempt.status !== "in_progress") {
      await client.query("ROLLBACK");

      return {
        status: "not_in_progress",
      };
    }

    if (attempt.expires_at.getTime() <= Date.now()) {
      await finalizeAttempt(
        client,
        attempt.id,
        "expired",
      );

      const result = await loadFinishedResult(
        client,
        attempt.id,
        context.participant_id,
      );

      await client.query("COMMIT");

      return {
        status: "finished",
        result,
      };
    }

    const questionResult = await client.query<{
      id: string;
    }>(
      `
        SELECT id
        FROM attempt_questions
        WHERE id = $1
          AND attempt_id = $2
          AND position = $3
        LIMIT 1;
      `,
      [
        input.attemptQuestionId,
        attempt.id,
        attempt.current_question_position,
      ],
    );

    if (!questionResult.rows[0]) {
      await client.query("ROLLBACK");

      return {
        status: "invalid_question",
      };
    }

    const optionResult = await client.query<{
      exists: boolean;
    }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM attempt_question_options
          WHERE attempt_question_id = $1
            AND answer_id = $2
        ) AS exists;
      `,
      [
        input.attemptQuestionId,
        input.selectedAnswerId,
      ],
    );

    if (!optionResult.rows[0]?.exists) {
      await client.query("ROLLBACK");

      return {
        status: "invalid_answer",
      };
    }

    const insertedResponse = await client.query<{
      id: string;
    }>(
      `
        INSERT INTO attempt_responses (
          attempt_question_id,
          selected_answer_id
        )
        VALUES ($1, $2)
        ON CONFLICT (attempt_question_id)
        DO NOTHING
        RETURNING id;
      `,
      [
        input.attemptQuestionId,
        input.selectedAnswerId,
      ],
    );

    if (!insertedResponse.rows[0]) {
      await client.query("ROLLBACK");

      return {
        status: "already_answered",
      };
    }

    const nextQuestionPosition =
      attempt.current_question_position + 1;

    if (
      nextQuestionPosition >= attempt.total_questions
    ) {
      await finalizeAttempt(
        client,
        attempt.id,
        "completed",
      );

      const result = await loadFinishedResult(
        client,
        attempt.id,
        context.participant_id,
      );

      await client.query("COMMIT");

      return {
        status: "finished",
        result,
      };
    }

    await client.query(
      `
        UPDATE attempts
        SET
          current_question_position = $2,
          updated_at = NOW()
        WHERE id = $1;
      `,
      [
        attempt.id,
        nextQuestionPosition,
      ],
    );

    await client.query("COMMIT");

    shouldLoadNextQuestion = true;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }

  if (!shouldLoadNextQuestion) {
    throw new Error(
      "Nie udało się ustalić kolejnego kroku próby.",
    );
  }

  const attempt = await getLocalAttempt(input.attemptId);

  if (!attempt) {
    throw new Error(
      "Nie udało się odczytać kolejnego pytania próby.",
    );
  }

  return {
    status: "next_question",
    attempt,
  };
}