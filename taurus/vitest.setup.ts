/** Shared vitest setup — keep side-effect free for unit tests. */
process.env.NEXTAUTH_SECRET ??= "test-secret-for-vitest-only";
process.env.NEXTAUTH_URL ??= "http://localhost:3000";
