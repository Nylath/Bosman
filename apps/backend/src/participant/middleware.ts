import type { NextFunction, Request, Response } from "express";

import { getActiveParticipantSession } from "./auth.js";

export async function requireParticipantSession(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await getActiveParticipantSession(request);

    if (!session) {
      response.status(401).json({
        message: "Zaloguj się kodem dostępu.",
      });

      return;
    }

    response.locals.participantSession = session;

    next();
  } catch (error) {
    next(error);
  }
}
