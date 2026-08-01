import type { CookieOptions, Request, Response } from "express";
import { Role } from "@prisma/client";
import { loginSchema, registerSchema } from "@motoya/shared";
import { z } from "zod";
import { env } from "../config.js";
import { prisma } from "../db.js";
import { hashPassword, hashToken, makeTokens, readRefresh, verifyPassword } from "../lib/auth.js";
import { fail } from "../lib/error.js";
import { authenticate } from "../middleware/auth.js";
import { safeRouter } from "../middleware/safe-router.js";

export const authRouter = safeRouter();

const refreshLifetimeMs = 7 * 24 * 60 * 60 * 1_000;
const rememberCookieName = `${env.COOKIE_NAME}_remember`;
const cookieOptions = (remember: boolean): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE,
  path: "/api/auth",
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  ...(remember ? { maxAge: refreshLifetimeMs } : {}),
});

const expiry = () => new Date(Date.now() + refreshLifetimeMs);
const userResponse = (user: { id: string; name: string; email: string; role: Role }) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

function readCookie(req: Request, name: string): string | null {
  const value = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, cookieOptions(false));
  res.clearCookie(rememberCookieName, cookieOptions(false));
}

async function issueSession(user: { id: string; name: string; email: string; role: Role }) {
  const tokens = makeTokens({ id: user.id, role: user.role, email: user.email });
  await prisma.refreshToken.create({ data: { tokenHash: hashToken(tokens.refreshToken), userId: user.id, expiresAt: expiry() } });
  return { session: { user: userResponse(user), accessToken: tokens.accessToken }, refreshToken: tokens.refreshToken };
}

function sendSession(res: Response, session: Awaited<ReturnType<typeof issueSession>>, remember: boolean): void {
  res.cookie(env.COOKIE_NAME, session.refreshToken, cookieOptions(remember));
  if (remember) res.cookie(rememberCookieName, "1", cookieOptions(true));
  else res.clearCookie(rememberCookieName, cookieOptions(false));
  res.json(session.session);
}

async function register(role: Role, body: unknown) {
  const data = registerSchema.parse(body);
  const passwordHash = await hashPassword(data.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone,
        role,
        ...(role === "CLIENT" ? { clientProfile: { create: { activationStatus: "ACTIVE" } } } : { riderProfile: { create: { onboardingStatus: "PROFILE_INCOMPLETE" } } }),
      },
    });
    const tokens = makeTokens({ id: user.id, role: user.role, email: user.email });
    await tx.refreshToken.create({ data: { tokenHash: hashToken(tokens.refreshToken), userId: user.id, expiresAt: expiry() } });
    return { session: { user: userResponse(user), accessToken: tokens.accessToken }, refreshToken: tokens.refreshToken };
  }, { isolationLevel: "Serializable" });
}

authRouter.post("/register/client", async (req, res) => sendSession(res.status(201), await register("CLIENT", req.body), false));
authRouter.post("/register/rider", async (req, res) => sendSession(res.status(201), await register("RIDER", req.body), false));

authRouter.post("/login", async (req, res) => {
  const data = loginSchema.extend({ remember: z.boolean().optional() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
    return fail(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
  }
  if (user.status !== "ACTIVE") {
    return fail(403, "ACCOUNT_INACTIVE", "Tu cuenta no está activa.");
  }
  sendSession(res, await issueSession(user), data.remember ?? true);
});

authRouter.post("/refresh", async (req, res) => {
  // Body support is temporary for clients still running the previous web build.
  // The new web client never reads or sends a refresh token from JavaScript.
  const legacy = z.object({ refreshToken: z.string().min(1).optional() }).safeParse(req.body);
  const token = readCookie(req, env.COOKIE_NAME) || (legacy.success ? legacy.data.refreshToken : undefined);
  if (!token) return fail(401, "INVALID_REFRESH_TOKEN", "Sesión expirada.");

  try {
    const payload = readRefresh(token);
    const tokenHash = hashToken(token);
    const response = await prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!record || record.revokedAt || record.expiresAt < new Date()) {
        return fail(401, "INVALID_REFRESH_TOKEN", "Sesión expirada.");
      }
      const revoked = await tx.refreshToken.updateMany({ where: { id: record.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (revoked.count !== 1) {
        return fail(401, "REFRESH_TOKEN_REUSED", "La sesión ya fue renovada.");
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: payload.id } });
      const nextTokens = makeTokens({ id: user.id, role: user.role, email: user.email });
      await tx.refreshToken.create({ data: { tokenHash: hashToken(nextTokens.refreshToken), userId: user.id, expiresAt: expiry() } });
      return { session: { user: userResponse(user), accessToken: nextTokens.accessToken }, refreshToken: nextTokens.refreshToken };
    }, { isolationLevel: "Serializable" });
    sendSession(res, response, readCookie(req, rememberCookieName) === "1");
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

authRouter.post("/logout", async (req, res) => {
  const legacy = z.object({ refreshToken: z.string().min(1).optional() }).safeParse(req.body);
  const token = readCookie(req, env.COOKIE_NAME) || (legacy.success ? legacy.data.refreshToken : undefined);
  if (token) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: {
      id: true, name: true, email: true, role: true, status: true, phone: true, createdAt: true,
      riderProfile: { include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1 } } },
      clientProfile: true,
    },
  });
  res.json(user);
});
