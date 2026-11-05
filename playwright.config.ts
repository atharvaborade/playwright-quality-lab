import { defineConfig } from '@playwright/test';
const port = Number(process.env.TEST_PORT || 3100);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, workers: 3,
  outputDir: process.env.PW_OUTPUT_DIR || 'test-results/artifacts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: process.env.PW_HTML_FOLDER || 'playwright-report' }], ['json', { outputFile: process.env.PW_REPORT_PATH || 'test-results/results.json' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  projects: [{ name: 'api', testMatch: '**/api/*.spec.ts' }, { name: 'chromium', testMatch: '**/ui/*.spec.ts', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node scripts/test-server.js', url: `${baseURL}/api/health`, reuseExistingServer: false,
    env: { PORT: String(port), NODE_ENV: 'test', LAB_ADMIN_PASSWORD: 'Local-test-admin-2026!', ...process.env.LAB_FAULT ? { LAB_FAULT: process.env.LAB_FAULT } : {} },
  },
});
