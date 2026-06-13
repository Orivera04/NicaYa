import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { sendError } from '../utils/response';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });

    if (!result.success) {
      const messages = result.error.errors.map((e) => `${e.path.slice(1).join('.')}: ${e.message}`).join(', ');
      sendError(res, messages, 400, 'VALIDATION_ERROR');
      return;
    }

    next();
  };
}
