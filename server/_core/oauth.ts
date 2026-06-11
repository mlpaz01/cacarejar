import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { nanoid } from "nanoid";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function registerAuthRoutes(app: Express) {
  // ── Login ──────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: "email e senha são obrigatórios" });
    }

    try {
      const user = await db.getUserByEmail(email.toLowerCase().trim());
      if (!user || !user.password) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      await db.updateUserLastSignedIn(user.id);

      const token = await sdk.createSessionToken(user.id, user.email ?? email);
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return res.json({ ok: true, name: user.name, email: user.email, role: user.role });
    } catch (err: any) {
      console.error("[Auth] Login failed:", err);
      return res.status(500).json({ error: "Erro interno" });
    }
  });

  // ── Register (self-service) ────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { name, email, password, companyName } = req.body ?? {};

    if (!name || !email || !password || !companyName) {
      return res
        .status(400)
        .json({ error: "nome, email, senha e nome da empresa são obrigatórios" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres" });
    }

    try {
      const existing = await db.getUserByEmail(email.toLowerCase().trim());
      if (existing) {
        return res.status(409).json({ error: "Este e-mail já está cadastrado" });
      }

      // Generate unique org slug
      let baseSlug = slugify(companyName);
      if (!baseSlug) baseSlug = "empresa";
      let slug = baseSlug;
      let attempt = 0;
      while (await db.getOrgBySlug(slug)) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      const hash = await bcrypt.hash(password, 12);

      // Create org first (ownerId will be set after user creation)
      const orgId = await db.createOrganization({
        name: companyName.trim(),
        slug,
        ownerId: 0, // temp, updated below
        plan: "free",
        isActive: true,
      });

      const userId = await db.createUser({
        openId: `user-${nanoid()}`,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hash,
        loginMethod: "password",
        role: "admin",
        organizationId: orgId,
        lastSignedIn: new Date(),
      });

      // Update org ownerId
      await db.updateOrg(orgId, { ownerId: userId });

      // Créditos de boas-vindas (para o cliente já conseguir usar o estúdio)
      try {
        const credits = await import("../services/credits");
        await credits.credit(orgId, 300, "bonus", { description: "Créditos de boas-vindas 🐓", ref: `welcome:${orgId}` });
      } catch (e) {
        console.error("[register] erro ao creditar boas-vindas:", e);
      }

      const token = await sdk.createSessionToken(userId, email.toLowerCase().trim());
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return res.status(201).json({ ok: true, name, email, role: "admin" });
    } catch (err: any) {
      console.error("[Auth] Register failed:", err);
      return res.status(500).json({ error: "Erro ao criar conta" });
    }
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return res.json({ ok: true });
  });
}
