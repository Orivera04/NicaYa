export class AppError extends Error { constructor(public status: number, public code: string, message: string, public details: unknown = null) { super(message); } }
export const fail = (status: number, code: string, message: string, details?: unknown) => { throw new AppError(status, code, message, details); };
