import { Request, Response, NextFunction } from 'express';
import { Role } from '../types';
import { sendError } from '../utils/response';

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions', 403, 'FORBIDDEN');
      return;
    }

    next();
  };
}
