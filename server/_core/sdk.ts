import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = {
  userId: number;
  email: string;
};

export type AuthenticatedUser = User;

class AuthService {
  private getSecretKey() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(userId: number, email: string): Promise<string> {
    const secretKey = this.getSecretKey();
    const expiresInMs = ONE_YEAR_MS;
    const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);

    return new SignJWT({ userId, email })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const secretKey = this.getSecretKey();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { userId, email } = payload as Record<string, unknown>;
      if (typeof userId !== "number" || typeof email !== "string") return null;
      return { userId, email };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const sessionCookie = cookies[COOKIE_NAME];
    const session = await this.verifySession(sessionCookie);

    if (!session) throw ForbiddenError("Invalid session");

    const user = await db.getUserById(session.userId);
    if (!user) throw ForbiddenError("User not found");

    return user;
  }
}

export const sdk = new AuthService();
