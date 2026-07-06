import { Router } from "express";
import { z } from "zod";

import {
  createClearedParticipantSessionCookie,
  createParticipantSessionCookie,
  getActiveParticipantSession,
  loginParticipant,
  logoutParticipant,
} from "./auth.js";

const loginRequestSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
  })
  .strict();

export const participantAuthRouter = Router();

participantAuthRouter.post("/login", async (request, response, next) => {
  try {
    const parsedBody = loginRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        message: "Podaj kod dostępu.",
      });

      return;
    }

    const result = await loginParticipant(parsedBody.data.code);

    if (result.status === "invalid_code") {
      response.status(401).json({
        message: "Nieprawidłowy albo nieaktywny kod dostępu.",
      });

      return;
    }

    response.setHeader(
      "Set-Cookie",
      createParticipantSessionCookie(result.token, result.expiresAt),
    );

    response.json({
      authenticated: true,
      expiresAt: result.expiresAt,
      participant: result.participant,
    });
  } catch (error) {
    next(error);
  }
});

participantAuthRouter.get("/session", async (request, response, next) => {
  try {
    const session = await getActiveParticipantSession(request);

    if (!session) {
      response.status(401).json({
        authenticated: false,
      });

      return;
    }

    response.json({
      authenticated: true,
      expiresAt: session.expiresAt,
      participant: {
        id: session.participantId,
        label: session.label,
      },
    });
  } catch (error) {
    next(error);
  }
});

participantAuthRouter.post("/logout", async (request, response, next) => {
  try {
    await logoutParticipant(request);

    response.setHeader("Set-Cookie", createClearedParticipantSessionCookie());

    response.json({
      authenticated: false,
    });
  } catch (error) {
    next(error);
  }
});
