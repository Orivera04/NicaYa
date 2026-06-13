import { Response } from 'express';
import { ApiResponse } from '../types';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  res.status(statusCode).json(body);
}

export function sendError(res: Response, message: string, statusCode = 400, code?: string): void {
  const body: ApiResponse = { success: false, error: message, code };
  res.status(statusCode).json(body);
}
