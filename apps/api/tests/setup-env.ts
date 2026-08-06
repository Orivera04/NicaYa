// Safe, deterministic configuration for unit tests. No real service credentials
// belong in the test runner or repository.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/motoya_test?schema=public";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-with-at-least-thirty-two-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-with-at-least-thirty-two-characters";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.NODE_ENV = "test";
process.env.FILE_ENCRYPTION_KEY ??= "test-file-encryption-key-that-is-long-enough-123";
