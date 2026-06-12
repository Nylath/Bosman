import { Router } from "express";
import { z } from "zod";

import {
  createAdminSessionCookie,
  createClearedAdminSessionCookie,
  getActiveAdminSession,
  loginAdmin,
  logoutAdmin,
} from "./auth.js";

const loginRequestSchema = z
  .object({
    password: z.string().min(1).max(500),
  })
  .strict();

export const adminAuthRouter = Router();

adminAuthRouter.post("/login", async (request, response, next) => {
  try {
    const parsedBody = loginRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        message: "Podaj hasło administratora.",
      });

      return;
    }

    const result = await loginAdmin(
      parsedBody.data.password,
      request,
    );

    if (result.status === "blocked") {
      response.status(429).json({
        message:
          "Zbyt wiele nieudanych prób logowania. Spróbuj ponownie później.",
      });

      return;
    }

    if (result.status === "invalid_credentials") {
      response.status(401).json({
        message: "Nieprawidłowe hasło administratora.",
      });

      return;
    }

    response.setHeader(
      "Set-Cookie",
      createAdminSessionCookie(
        result.token,
        result.expiresAt,
      ),
    );

    response.json({
      authenticated: true,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.get("/session", async (request, response, next) => {
  try {
    const session = await getActiveAdminSession(request);

    if (!session) {
      response.status(401).json({
        authenticated: false,
      });

      return;
    }

    response.json({
      authenticated: true,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.post("/logout", async (request, response, next) => {
  try {
    await logoutAdmin(request);

    response.setHeader(
      "Set-Cookie",
      createClearedAdminSessionCookie(),
    );

    response.json({
      authenticated: false,
    });
  } catch (error) {
    next(error);
  }
});
