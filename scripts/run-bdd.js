import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = resolve(process.env.BDD_REPORT_DIR || join(root, 'reports'));
const argumentsForCucumber = [];
let parallel = process.env.CUCUMBER_PARALLEL || '3';
let headed = process.env.BDD_HEADED || 'false';
const tagFilters = [];
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === '--headed') headed = 'true';
  else if (argument === '--parallel') parallel = process.argv[++index];
  else if (argument.startsWith('--parallel=')) parallel = argument.slice('--parallel='.length);
  else if (argument === '--tags') {
    const tags = process.argv[++index];
    tagFilters.push(tags);
    argumentsForCucumber.push(argument, tags);
  } else if (argument.startsWith('--tags=')) {
    tagFilters.push(argument.slice('--tags='.length));
    argumentsForCucumber.push(argument);
  }
  else argumentsForCucumber.push(argument);
}
const workers = Number(parallel);
if (!Number.isInteger(workers) || workers < 1 || workers > 16) throw new Error('CUCUMBER_PARALLEL must be an integer between 1 and 16.');
const summary = {
  startedAt: new Date().toISOString(), parallelWorkers: workers, headed: headed === 'true',
  tags: [process.env.BDD_TAGS, ...tagFilters].filter(Boolean).map(tags => `(${tags})`).join(' and '),
  scenarioCount: 0, statusCounts: {}, scenarios: [],
};

let application;
let cucumber;
let temporaryDir;
let interrupted;
const waitForExit = child => new Promise(resolveExit => {
  if (child.exitCode !== null || child.signalCode !== null) return resolveExit({ code: child.exitCode, signal: child.signalCode });
  child.once('exit', (code, signal) => resolveExit({ code, signal }));
  child.once('error', error => resolveExit({ code: 1, error }));
});

async function freePort() {
  const listener = createServer();
  await new Promise((resolveListen, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolveListen); });
  const { port } = listener.address();
  await new Promise((resolveClose, reject) => listener.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  timer.unref();
  await waitForExit(child);
  clearTimeout(timer);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = signal;
    cucumber?.kill(signal);
    application?.kill('SIGTERM');
  });
}

async function ready(baseURL) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (interrupted) throw new Error(`Interrupted by ${interrupted}`);
    if (application.exitCode !== null || application.signalCode !== null) throw new Error('The test application exited before becoming ready.');
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch { /* The server may still be binding its port. */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  throw new Error('The test application did not become healthy within 20 seconds.');
}

async function summarize() {
  const features = JSON.parse(await readFile(join(reportDir, 'cucumber.json'), 'utf8'));
  const priority = ['failed', 'ambiguous', 'undefined', 'pending', 'skipped', 'passed'];
  const scenarios = features.flatMap(feature => feature.elements || []).filter(element => element.type === 'scenario');
  summary.scenarios = scenarios.map(scenario => {
    const statuses = [...(scenario.before || []), ...(scenario.steps || []), ...(scenario.after || [])].map(step => step.result?.status).filter(Boolean);
    const status = priority.find(candidate => statuses.includes(candidate)) || 'unknown';
    return { name: scenario.name, status, stepCount: scenario.steps?.length || 0 };
  });
  summary.scenarioCount = summary.scenarios.length;
  for (const { status } of summary.scenarios) summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
}

let exitCode = 1;
try {
  temporaryDir = await mkdtemp(join(tmpdir(), 'slotwise-bdd-'));
  await mkdir(reportDir, { recursive: true });
  // Each invocation produces one coherent run; a failed run cannot inherit old evidence.
  await Promise.all(['artifacts', 'allure-results', 'allure-report'].map(name => rm(join(reportDir, name), { recursive: true, force: true })));
  await rm(join(reportDir, 'cucumber.json'), { force: true });
  await rm(join(reportDir, 'run-summary.json'), { force: true });
  await mkdir(join(reportDir, 'allure-results'), { recursive: true });
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  summary.baseURL = baseURL;
  const env = {
    ...process.env,
    NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port),
    DB_PATH: join(temporaryDir, 'appointments.sqlite'),
    LAB_ADMIN_PASSWORD: process.env.LAB_ADMIN_PASSWORD || 'Synthetic-admin-password-2026!',
    BDD_BASE_URL: baseURL, BDD_REPORT_DIR: reportDir, CUCUMBER_PARALLEL: String(workers), BDD_HEADED: headed,
    BDD_SLOT_DATE: new Date().toISOString().slice(0, 10),
  };
  await writeFile(join(reportDir, 'allure-results', 'environment.properties'), [
    `Node=${process.version}`, 'Framework=Cucumber.js + Playwright', 'Language=JavaScript',
    `Parallel workers=${workers}`, `Browser=${env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'Playwright Chromium'}`,
    `Application=${baseURL}`, `Fault=${env.LAB_FAULT || 'none'}`, '',
  ].join('\n'));
  application = spawn(process.execPath, ['src/server.js'], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] });
  application.on('error', error => console.error(`Could not start test application: ${error.message}`));
  await ready(baseURL);
  console.log(`Cucumber: ${workers} workers, fresh database, evidence in ${reportDir}`);
  cucumber = spawn(process.execPath, [join(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js'), '--config', 'cucumber.mjs', ...argumentsForCucumber], {
    cwd: root, env, stdio: 'inherit',
  });
  const result = await waitForExit(cucumber);
  if (result.error) console.error(`Could not start Cucumber: ${result.error.message}`);
  exitCode = result.code ?? (result.signal === 'SIGINT' ? 130 : result.signal === 'SIGTERM' ? 143 : 1);
  const informationalRun = argumentsForCucumber.some(argument => ['--dry-run', '--help', '-h', '--version', '-v'].includes(argument));
  if (!informationalRun) {
    try {
      await summarize();
      if (exitCode === 0 && summary.scenarioCount === 0) throw new Error('Cucumber selected zero scenarios. Check the feature paths or tag filter.');
    } catch (error) {
      summary.reportError = error.message;
      if (exitCode === 0) throw error;
      console.error(`Could not summarize the Cucumber report: ${error.message}`);
    }
  }
} catch (error) {
  exitCode = 1;
  summary.error = error.message;
  console.error(error.message);
} finally {
  await stop(cucumber);
  await stop(application);
  if (temporaryDir) await rm(temporaryDir, { recursive: true, force: true });
  summary.finishedAt = new Date().toISOString();
  summary.exitCode = interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : exitCode;
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, 'run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}
process.exitCode = interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : exitCode;
