import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    // Each test file gets its own in-memory MongoDB; the first run downloads the
    // mongod binary, so allow generous hook time.
    hookTimeout: 120000,
    testTimeout: 30000,
    pool: 'forks',
    // Env is set before src/config is imported so the app boots in "test" mode
    // (no request logging, no rate limiting, deterministic JWT secrets).
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test_access_secret',
      JWT_REFRESH_SECRET: 'test_refresh_secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '30d',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/syt_test_placeholder',
      CORS_ORIGINS: 'http://localhost:5173',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      // Pure bootstrap/infra wiring not exercised by the in-memory harness.
      exclude: ['src/server.js', 'src/config/db.js'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
