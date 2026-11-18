// Runs before every test file, i.e. before src/config/env.ts is imported.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/englishbyear-test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-0123456789-abcdefghij";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-0123456789-abcdefghi";
process.env.CLIENT_URL ??= "http://localhost:3000";
