import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  isNull,
} from "drizzle-orm";
import {
  parseCookie,
  stringifySetCookie,
} from "cookie";
import type { Request } from "express";

import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  adminLoginAttempts,
  adminSessions,
  organizations,
} from "../db/schema.js";

const ADMIN_COOKIE_NAME = "bosman_admin_session";
const LOCAL_ORGANIZATION_SLUG = "bosman-local";

export type AdminRole = "system" | "school";

export type ActiveAdminSession = {
  id: string;
  organizationId: string;
  role: AdminRole;
  expiresAt: Date;
};

export type AdminLoginResult =
  | {
      status: "authenticated";
      token: string;
      role: AdminRole;
      expiresAt: Date;
    }
  | {
      status: "invalid_credentials";
    }
  | {
      status: "blocked";
    };

function hashValue(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function comparePlainSecrets(
  firstValue: string,
  secondValue: string,
): boolean {
  const firstHash = Buffer.from(hashValue(firstValue), "hex");
  const secondHash = Buffer.from(hashValue(secondValue), "hex");

  return timingSafeEqual(firstHash, secondHash);
}

function getClientKeyHash(request: Request): string {
  const userAgent = request.get("user-agent") ?? "unknown";

  return hashValue(`${request.ip}|${userAgent}`);
}

async function getAdminOrganizationId(): Promise<string> {
  if (config.appMode === "LOCAL") {
    const [organization] = await db
      .select({
        id: organizations.id,
      })
      .from(organizations)
      .where(
        and(
          eq(organizations.slug, LOCAL_ORGANIZATION_SLUG),
          eq(organizations.isActive, true),
        ),
      )
      .limit(1);

    if (!organization) {
      throw new Error(
        'Nie znaleziono aktywnej organizacji "bosman-local".',
      );
    }

    return organization.id;
  }

  const activeOrganizations = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(eq(organizations.isActive, true))
    .limit(2);

  if (activeOrganizations.length !== 1) {
    throw new Error(
      "Tryb SCHOOL wymaga dokładnie jednej aktywnej organizacji.",
    );
  }

  return activeOrganizations[0].id;
}

async function verifyAdminPassword(
  password: string,
): Promise<AdminRole | null> {
  if (config.appMode === "LOCAL") {
    if (!config.adminPassword) {
      throw new Error(
        "W trybie LOCAL brakuje konfiguracji ADMIN_PASSWORD.",
      );
    }

    return comparePlainSecrets(
      password,
      config.adminPassword,
    )
      ? "system"
      : null;
  }

  if (!config.adminPasswordHash) {
    throw new Error(
      "W trybie SCHOOL brakuje konfiguracji ADMIN_PASSWORD_HASH.",
    );
  }

  if (bcrypt.truncates(password)) {
    return null;
  }

  if (
    await bcrypt.compare(
      password,
      config.adminPasswordHash,
    )
  ) {
    return "system";
  }

  if (
    config.schoolAdminPasswordHash &&
    (await bcrypt.compare(
      password,
      config.schoolAdminPasswordHash,
    ))
  ) {
    return "school";
  }

  return null;
}

async function recordLoginAttempt(input: {
  organizationId: string;
  clientKeyHash: string;
  wasSuccessful: boolean;
}): Promise<void> {
  await db.insert(adminLoginAttempts).values(input);
}

async function isClientBlocked(input: {
  organizationId: string;
  clientKeyHash: string;
}): Promise<boolean> {
  const cutoff = new Date(
    Date.now() -
      config.adminLoginWindowMinutes * 60 * 1000,
  );

  const recentAttempts = await db
    .select({
      wasSuccessful: adminLoginAttempts.wasSuccessful,
    })
    .from(adminLoginAttempts)
    .where(
      and(
        eq(
          adminLoginAttempts.organizationId,
          input.organizationId,
        ),
        eq(
          adminLoginAttempts.clientKeyHash,
          input.clientKeyHash,
        ),
        gte(adminLoginAttempts.attemptedAt, cutoff),
      ),
    )
    .orderBy(desc(adminLoginAttempts.attemptedAt))
    .limit(config.adminLoginMaxFailures);

  let consecutiveFailures = 0;

  for (const attempt of recentAttempts) {
    if (attempt.wasSuccessful) {
      break;
    }

    consecutiveFailures += 1;
  }

  return consecutiveFailures >= config.adminLoginMaxFailures;
}

export async function loginAdmin(
  password: string,
  request: Request,
): Promise<AdminLoginResult> {
  const organizationId = await getAdminOrganizationId();
  const clientKeyHash = getClientKeyHash(request);

  if (
    await isClientBlocked({
      organizationId,
      clientKeyHash,
    })
  ) {
    return {
      status: "blocked",
    };
  }

  const adminRole = await verifyAdminPassword(password);
const passwordIsValid = adminRole !== null;

  await recordLoginAttempt({
    organizationId,
    clientKeyHash,
    wasSuccessful: passwordIsValid,
  });

  if (!passwordIsValid) {
    return {
      status: "invalid_credentials",
    };
  }

  const token = `${adminRole}.${randomBytes(32).toString(
  "base64url",
)}`;

  const expiresAt = new Date(
    Date.now() + config.adminSessionTtlHours * 60 * 60 * 1000,
  );

  await db.insert(adminSessions).values({
    organizationId,
    tokenHash: hashValue(token),
    expiresAt,
  });

  return {
    status: "authenticated",
    token,
    role: adminRole,
    expiresAt,
  };
}

function getAdminRoleFromToken(token: string): AdminRole {
  const [rolePrefix] = token.split(".");

  if (rolePrefix === "school") {
    return "school";
  }

  return "system";
}

function getAdminTokenFromRequest(
  request: Request,
): string | null {
  const cookies = parseCookie(request.headers.cookie ?? "");

  return cookies[ADMIN_COOKIE_NAME] ?? null;
}

export async function getActiveAdminSession(
  request: Request,
): Promise<ActiveAdminSession | null> {
  const token = getAdminTokenFromRequest(request);

  if (!token) {
    return null;
  }

  const [session] = await db
    .select({
      id: adminSessions.id,
      organizationId: adminSessions.organizationId,
      expiresAt: adminSessions.expiresAt,
    })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, hashValue(token)),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    return null;
  }

  await db
    .update(adminSessions)
    .set({
      lastSeenAt: new Date(),
    })
    .where(eq(adminSessions.id, session.id));

  return {
  ...session,
  role: getAdminRoleFromToken(token),
};
}

export async function logoutAdmin(
  request: Request,
): Promise<void> {
  const token = getAdminTokenFromRequest(request);

  if (!token) {
    return;
  }

  await db
    .update(adminSessions)
    .set({
      revokedAt: new Date(),
      lastSeenAt: new Date(),
    })
    .where(eq(adminSessions.tokenHash, hashValue(token)));
}

export function createAdminSessionCookie(
  token: string,
  expiresAt: Date,
): string {
  return stringifySetCookie({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    ),
  });
}

export function createClearedAdminSessionCookie(): string {
  return stringifySetCookie({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
