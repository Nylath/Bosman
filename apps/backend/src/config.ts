import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce.number().int().min(1).max(65535).default(3001),

    APP_MODE: z.enum(["LOCAL", "SCHOOL"]),

    DATABASE_URL: z.string().min(1, "Zmienna DATABASE_URL jest wymagana."),

    ASSET_STORAGE: z.literal("local"),

    ASSET_DIRECTORY: z.string().trim().min(1).default("data/assets"),

    ADMIN_PASSWORD: z.string().min(8).optional(),

    ADMIN_PASSWORD_HASH: z.string().min(1).optional(),

    SCHOOL_ADMIN_PASSWORD_HASH: z.string().min(1).optional(),

    ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(8),

    ADMIN_LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),

    ADMIN_LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

    EXAM_PACKAGE_MAX_MB: z.coerce
      .number()
      .int()
      .positive()
      .max(250)
      .default(50),
  })

  .superRefine((environment, context) => {
    if (environment.APP_MODE === "LOCAL" && !environment.ADMIN_PASSWORD) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_PASSWORD"],
        message: "W trybie LOCAL zmienna ADMIN_PASSWORD jest wymagana.",
      });
    }

    if (environment.APP_MODE === "SCHOOL" && !environment.ADMIN_PASSWORD_HASH) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_PASSWORD_HASH"],
        message: "W trybie SCHOOL zmienna ADMIN_PASSWORD_HASH jest wymagana.",
      });
    }
  });

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const errors = parsedEnvironment.error.issues
    .map((issue) => {
      const field = issue.path.join(".") || "konfiguracja";
      return `- ${field}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(`Nieprawidłowa konfiguracja środowiska:\n${errors}`);
}

const environment = parsedEnvironment.data;

export const config = {
  examPackageMaxBytes: environment.EXAM_PACKAGE_MAX_MB * 1024 * 1024,
  nodeEnv: environment.NODE_ENV,
  port: environment.PORT,
  appMode: environment.APP_MODE,
  databaseUrl: environment.DATABASE_URL,
  assetStorage: environment.ASSET_STORAGE,
  assetDirectory: path.resolve(repositoryRoot, environment.ASSET_DIRECTORY),
  adminPassword: environment.ADMIN_PASSWORD,
  adminPasswordHash: environment.ADMIN_PASSWORD_HASH,
  schoolAdminPasswordHash: environment.SCHOOL_ADMIN_PASSWORD_HASH,
  adminSessionTtlHours: environment.ADMIN_SESSION_TTL_HOURS,
  adminLoginMaxFailures: environment.ADMIN_LOGIN_MAX_FAILURES,
  adminLoginWindowMinutes: environment.ADMIN_LOGIN_WINDOW_MINUTES,
  isProduction: environment.NODE_ENV === "production",
} as const;

export type AppMode = typeof config.appMode;
