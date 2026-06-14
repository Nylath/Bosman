import type {
  NextFunction,
  Request,
  Response,
} from "express";
import express from "express";

import { publicExamRouter } from "./public/exam-routes.js";
import { publicAttemptRouter } from "./public/attempt-routes.js";

import { adminExamVersionRouter } from "./admin/exam-version-routes.js";
import { adminExamRouter } from "./admin/exam-routes.js";
import { adminAuthRouter } from "./admin/routes.js";
import { adminParticipantRouter } from "./admin/participant-routes.js";
import { participantAuthRouter } from "./participant/routes.js";
import { participantExamRouter } from "./participant/exam-routes.js";

import { bootstrapApplication } from "./bootstrap/index.js";
import { config } from "./config.js";
import { pool } from "./db/client.js";

type JsonParseError = SyntaxError & {
  type?: string;
};

function isJsonParseError(
  error: unknown,
): error is JsonParseError {
  return (
    error instanceof SyntaxError &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}

const app = express();

app.use(express.json());

app.use("/assets", express.static(config.assetDirectory));

app.get("/health", async (_request, response) => {
  try {
    const result = await pool.query<{
      database: string;
      user_name: string;
    }>(
      "SELECT current_database() AS database, current_user AS user_name;",
    );

    response.json({
      status: "ok",
      application: "Bosman backend",
      database: {
        status: "connected",
        name: result.rows[0]?.database,
        user: result.rows[0]?.user_name,
      },
    });
  } catch (error) {
    console.error("Błąd połączenia z PostgreSQL:", error);

    response.status(503).json({
      status: "error",
      application: "Bosman backend",
      database: {
        status: "disconnected",
      },
    });
  }
});

app.get("/api/config/public", (_request, response) => {
  const schoolModeEnabled = config.appMode === "SCHOOL";

  response.json({
    appMode: config.appMode,
    participantLoginRequired: schoolModeEnabled,
    coursesManagementEnabled: schoolModeEnabled,
    participantCodesManagementEnabled: schoolModeEnabled,
  });
});

app.use("/api/exams", publicExamRouter);

app.use("/api", publicAttemptRouter);

app.use("/api/admin/auth", adminAuthRouter);

app.use("/api/admin/exams", adminExamRouter);

app.use("/api/admin/exam-versions", adminExamVersionRouter);

app.use("/api/admin/participants", adminParticipantRouter);

app.use("/api/participant/auth", participantAuthRouter);

app.use("/api/participant/exams", participantExamRouter);

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    if (isJsonParseError(error)) {
      response.status(400).json({
        message: "Przesłano nieprawidłowy JSON.",
      });

      return;
    }

    console.error("Nieobsłużony błąd backendu:", error);

    response.status(500).json({
      message: "Wystąpił wewnętrzny błąd serwera.",
    });
  },
);

async function start(): Promise<void> {
  await pool.query("SELECT 1;");
  await bootstrapApplication();

  app.listen(config.port, () => {
    console.log(
      `Bosman backend działa na http://localhost:${config.port}`,
    );

    console.log(`Tryb aplikacji: ${config.appMode}`);
    console.log("Połączenie z PostgreSQL działa poprawnie.");
  });
}

void start().catch((error: unknown) => {
  console.error("Nie udało się uruchomić backendu:", error);

  process.exit(1);
});