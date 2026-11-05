import { resolve } from 'node:path';

const reportDir = resolve(process.env.BDD_REPORT_DIR || 'reports');

export default {
  paths: ['features/**/*.feature'],
  import: ['features/support/**/*.js', 'features/steps/**/*.js'],
  format: ['progress', `json:${resolve(reportDir, 'cucumber.json')}`, `allure-cucumberjs/reporter:${resolve(reportDir, 'allure-formatter.log')}`],
  formatOptions: { resultsDir: resolve(reportDir, 'allure-results') },
  parallel: Number(process.env.CUCUMBER_PARALLEL || 3),
  tags: process.env.BDD_TAGS || '',
  retry: 0,
};
