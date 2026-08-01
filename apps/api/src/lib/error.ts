export class AppError extends Error { constructor(public status: number, public code: string, message: string, public details: unknown = null) { super(message); } }
/**
 * Raises a domain error and explicitly never returns. Keeping this as a
 * function declaration (instead of an inferred callback) lets TypeScript
 * narrow nullable values after an error guard in strict mode.
 */
export function fail(status: number, code: string, message: string, details?: unknown): never {
  throw new AppError(status, code, message, details);
}
