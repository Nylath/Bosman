import type { NextFunction, Request, Response } from "express";

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

export async function requireSystemAdminSession(
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

    if (session.role !== "system") {
      response.status(403).json({
        message:
          "Ta funkcja jest dostępna tylko dla administratora systemowego.",
      });

      return;
    }

    response.locals.adminSession = session;

    next();
  } catch (error) {
    next(error);
  }
}
