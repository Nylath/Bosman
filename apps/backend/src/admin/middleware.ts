import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { getActiveAdminSession } from "./auth.js";

export async function requireAdminSession(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await getActiveAdminSession(request);

    if (!session) {
      response.status(401).json({
        message: "Wymagane jest logowanie administratora.",
      });

      return;
    }

    response.locals.adminSession = session;

    next();
  } catch (error) {
    next(error);
  }
}
