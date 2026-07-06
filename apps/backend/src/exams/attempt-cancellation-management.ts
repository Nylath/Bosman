import type { PoolClient } from "pg";

import { pool } from "../db/client.js";

const LOCAL_ORGANIZATION_SLUG = "bosman-local";

type LocalContextRow = {
  participant_id: string;
};

type LockedAttemptRow = {
  id: string;

  status: "in_progress" | "completed" | "expired" | "cancelled";
};

export type CancelLocalAttemptResult =
  | {
      status: "cancelled";
    }
  | {
      status: "not_found";
    }
  | {
      status: "not_in_progress";
    };

async function getLocalParticipantId(client: PoolClient): Promise<string> {
  const result = await client.query<LocalContextRow>(
    `
      SELECT
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
    throw new Error("Nie znaleziono aktywnego lokalnego profilu użytkownika.");
  }

  return context.participant_id;
}

export async function cancelLocalAttempt(
  attemptId: string,
): Promise<CancelLocalAttemptResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const participantId = await getLocalParticipantId(client);

    const attemptResult = await client.query<LockedAttemptRow>(
      `
          SELECT
            id,
            status
          FROM attempts
          WHERE id = $1
            AND participant_id = $2
          LIMIT 1
          FOR UPDATE;
        `,
      [attemptId, participantId],
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

    await client.query(
      `
        UPDATE attempts
        SET
          status = 'cancelled'::attempt_status,
          elapsed_seconds = GREATEST(
            0,
            FLOOR(
              EXTRACT(
                EPOCH FROM (
                  LEAST(NOW(), expires_at) -
                  started_at
                )
              )
            )::integer
          ),
          finished_at = NOW(),
          updated_at = NOW()
        WHERE id = $1;
      `,
      [attempt.id],
    );

    await client.query("COMMIT");

    return {
      status: "cancelled",
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export type CancelParticipantAttemptResult = CancelLocalAttemptResult;

export async function cancelParticipantAttempt(input: {
  participantId: string;
  attemptId: string;
}): Promise<CancelParticipantAttemptResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const attemptResult = await client.query<LockedAttemptRow>(
      `
          SELECT
            id,
            status
          FROM attempts
          WHERE id = $1
            AND participant_id = $2
          LIMIT 1
          FOR UPDATE;
        `,
      [input.attemptId, input.participantId],
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

    await client.query(
      `
        UPDATE attempts
        SET
          status = 'cancelled'::attempt_status,
          elapsed_seconds = GREATEST(
            0,
            FLOOR(
              EXTRACT(
                EPOCH FROM (
                  LEAST(NOW(), expires_at) -
                  started_at
                )
              )
            )::integer
          ),
          finished_at = NOW(),
          updated_at = NOW()
        WHERE id = $1;
      `,
      [attempt.id],
    );

    await client.query("COMMIT");

    return {
      status: "cancelled",
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}
