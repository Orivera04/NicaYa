import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { loginSchema, registerSchema } from "@motoya/shared";
import { prisma } from "../db.js";
import { hashPassword, hashToken, makeTokens, readRefresh, verifyPassword } from "../lib/auth.js";
import { fail } from "../lib/error.js";
import { authenticate } from "../middleware/auth.js";

export const authRouter = Router();
const expiry = () => new Date(Date.now() + 7 * 864e5);
const userResponse = (user: { id: string; name: string; email: string; role: Role }) => ({ id: user.id, name: user.name, email: user.email, role: user.role });
async function issueSession(user: { id: string; name: string; email: string; role: Role }) {
  const tokens = makeTokens({ id: user.id, role: user.role, email: user.email });
  await prisma.refreshToken.create({ data: { tokenHash: hashToken(tokens.refreshToken), userId: user.id, expiresAt: expiry() } });
  return { user: userResponse(user), ...tokens };
}
async function register(role: Role, body: unknown) {
  const data = registerSchema.parse(body);
  const rider = role === "RIDER" ? z.object({ nationalId: z.string().min(5), driverLicense: z.string().min(5), vehiclePlate: z.string().min(3), vehicleModel: z.string().min(2) }).parse(body) : null;
  const passwordHash = await hashPassword(data.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: data.name, email: data.email, passwordHash, phone: data.phone, role, ...(role === "CLIENT" ? { clientProfile: { create: {} } } : { riderProfile: { create: rider! } }) } });
    const tokens = makeTokens({ id: user.id, role: user.role, email: user.email });
    await tx.refreshToken.create({ data: { tokenHash: hashToken(tokens.refreshToken), userId: user.id, expiresAt: expiry() } });
    return { user: userResponse(user), ...tokens };
  }, { isolationLevel: "Serializable" });
}
authRouter.post("/register/client", async (req, res) => res.status(201).json(await register("CLIENT", req.body)));
authRouter.post("/register/rider", async (req, res) => res.status(201).json(await register("RIDER", req.body)));
authRouter.post("/login", async (req, res) => { const data = loginSchema.parse(req.body); const user = await prisma.user.findUnique({ where: { email: data.email } }); if (!user || !(await verifyPassword(data.password, user.passwordHash))) fail(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos."); if (user.status !== "ACTIVE") fail(403, "ACCOUNT_INACTIVE", "Tu cuenta no está activa."); res.json(await issueSession(user)); });
authRouter.post("/refresh", async (req, res) => {
  const token = String(req.body.refreshToken || ""); const payload = readRefresh(token); const tokenHash = hashToken(token);
  const response = await prisma.$transaction(async (tx) => {
    const record = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) fail(401, "INVALID_REFRESH_TOKEN", "Sesión expirada.");
    const revoked = await tx.refreshToken.updateMany({ where: { id: record.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (revoked.count !== 1) fail(401, "REFRESH_TOKEN_REUSED", "La sesión ya fue renovada.");
    const user = await tx.user.findUniqueOrThrow({ where: { id: payload.id } }); const tokens = makeTokens({ id: user.id, role: user.role, email: user.email });
    await tx.refreshToken.create({ data: { tokenHash: hashToken(tokens.refreshToken), userId: user.id, expiresAt: expiry() } }); return tokens;
  }, { isolationLevel: "Serializable" });
  res.json(response);
});
authRouter.post("/logout", async (req, res) => { const token = String(req.body.refreshToken || ""); if (token) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } }); res.status(204).end(); });
authRouter.get("/me", authenticate, async (req, res) => res.json(await prisma.user.findUnique({ where: { id: req.user!.id }, include: { riderProfile: { include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1 } } }, clientProfile: true } })));
