import { Request, Response } from 'express';
import { prisma } from '../db';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';
import { AppError } from '../utils/AppError';
import { Role } from '../types';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, phone, password, role } = req.body as RegisterInput;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    sendError(res, 'Email already registered', 409, 'DUPLICATE_EMAIL');
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      role: role as Role,
      ...(role === Role.RIDER
        ? { riderProfile: { create: {} } }
        : {}),
    },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

  sendSuccess(res, { user, accessToken, refreshToken }, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    return;
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

  const { passwordHash: _, ...safeUser } = user;
  sendSuccess(res, { user: safeUser, accessToken, refreshToken });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken: token } = req.body as { refreshToken: string };

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AppError('User not found', 404);

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = signRefreshToken({ userId: user.id, role: user.role });

    sendSuccess(res, { accessToken, refreshToken: newRefreshToken });
  } catch {
    sendError(res, 'Invalid refresh token', 401, 'TOKEN_INVALID');
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      riderProfile: {
        select: {
          id: true,
          status: true,
          avgRating: true,
          totalRides: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          isAvailable: true,
        },
      },
    },
  });

  if (!user) {
    sendError(res, 'User not found', 404, 'NOT_FOUND');
    return;
  }

  sendSuccess(res, { user });
}
