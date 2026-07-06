import { createHash, randomBytes } from "node:crypto";

import type { Request } from "express";

import { pool } from "../db/client.js";

const PARTICIPANT_SESSION_COOKIE_NAME = "bosman_participant_session";

const PARTICIPANT_SESSION_DAYS = 30;

type ParticipantSessionRow = {
  id: string;
  participant_id: string;
  organization_id: string;
  label: string;
  expires_at: Date;
};

export type ActiveParticipantSession = {
  sessionId: string;
  participantId: string;
  organizationId: string;
  label: string;
  expiresAt: Date;
};

export type ParticipantLoginResult =
  | {
      status: "invalid_code";
    }
  | {
      status: "success";
      token: string;
      expiresAt: Date;
      participant: {
        id: string;
        label: string;
      };
    };

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");

    if (rawName === name) {
      return decodeURIComponent(rawValueParts.join("="));
    }
  }

  return null;
}

export function createParticipantSessionCookie(
  token: string,
  expiresAt: Date,
): string {
  const parts = [
    `${PARTICIPANT_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function createClearedParticipantSessionCookie(): string {
  return [
    `${PARTICIPANT_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export async function loginParticipant(
  code: string,
): Promise<ParticipantLoginResult> {
  const normalizedCode = normalizeAccessCode(code);
  const codeHash = hashValue(normalizedCode);

  const participantResult = await pool.query<{
    participant_id: string;
    label: string;
  }>(
    `
        SELECT
          p.id AS participant_id,
          p.label
        FROM participant_access_codes pac
        INNER JOIN participants p
          ON p.id = pac.participant_id
        WHERE pac.code_hash = $1
          AND pac.is_active = TRUE
          AND pac.revoked_at IS NULL
          AND (
            pac.expires_at IS NULL
            OR pac.expires_at > NOW()
          )
          AND p.kind = 'course'
          AND p.is_active = TRUE
          AND (
            p.expires_at IS NULL
            OR p.expires_at > NOW()
          )
        LIMIT 1;
      `,
    [codeHash],
  );

  const participant = participantResult.rows[0];

  if (!participant) {
    return {
      status: "invalid_code",
    };
  }

  const token = createSessionToken();
  const tokenHash = hashValue(token);
  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + PARTICIPANT_SESSION_DAYS);

  await pool.query(
    `
      INSERT INTO participant_sessions (
        participant_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3);
    `,
    [participant.participant_id, tokenHash, expiresAt],
  );

  return {
    status: "success",
    token,
    expiresAt,
    participant: {
      id: participant.participant_id,
      label: participant.label,
    },
  };
}

export async function getActiveParticipantSession(
  request: Request,
): Promise<ActiveParticipantSession | null> {
  const token = getCookieValue(request, PARTICIPANT_SESSION_COOKIE_NAME);

  if (!token) {
    return null;
  }

  const tokenHash = hashValue(token);

  const sessionResult = await pool.query<ParticipantSessionRow>(
    `
        SELECT
          ps.id,
          ps.participant_id,
          p.organization_id,
          p.label,
          ps.expires_at
        FROM participant_sessions ps
        INNER JOIN participants p
          ON p.id = ps.participant_id
        WHERE ps.token_hash = $1
          AND ps.revoked_at IS NULL
          AND ps.expires_at > NOW()
          AND p.kind = 'course'
          AND p.is_active = TRUE
          AND (
            p.expires_at IS NULL
            OR p.expires_at > NOW()
          )
        LIMIT 1;
      `,
    [tokenHash],
  );

  const session = sessionResult.rows[0];

  if (!session) {
    return null;
  }

  await pool.query(
    `
      UPDATE participant_sessions
      SET last_seen_at = NOW()
      WHERE id = $1;
    `,
    [session.id],
  );

  return {
    sessionId: session.id,
    participantId: session.participant_id,
    organizationId: session.organization_id,
    label: session.label,
    expiresAt: session.expires_at,
  };
}

export async function logoutParticipant(request: Request): Promise<void> {
  const token = getCookieValue(request, PARTICIPANT_SESSION_COOKIE_NAME);

  if (!token) {
    return;
  }

  const tokenHash = hashValue(token);

  await pool.query(
    `
      UPDATE participant_sessions
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND revoked_at IS NULL;
    `,
    [tokenHash],
  );
}
