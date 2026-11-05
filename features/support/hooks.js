import { After, AfterAll, AfterStep, Before, BeforeAll, BeforeStep, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { safeName, setWorkerBrowser } from './world.js';

let browser;
setDefaultTimeout(30000);

BeforeAll({ timeout: 60000 }, async function () {
  browser = await chromium.launch({
    headless: process.env.BDD_HEADED !== 'true',
    slowMo: Number(process.env.PLAYWRIGHT_SLOW_MO || 0),
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  setWorkerBrowser(browser);
});

Before({ name: 'Fresh scenario browser context', timeout: 60000 }, async function ({ pickle }) {
  await this.initialize(pickle);
});

BeforeStep(async function ({ pickleStep }) {
  this.stepNumber++;
  this.currentStep = `${String(this.stepNumber).padStart(2, '0')}. ${pickleStep.text}`;
  for (const record of this.contexts) {
    await record.context.tracing.group(this.currentStep);
    await record.apiTracing.group(this.currentStep);
    record.grouped = true;
  }
});

AfterStep(async function ({ pickleStep, result }) {
  // Full DOM snapshots live in the trace; the PNG is also directly visible in Allure.
  const errors = [];
  for (const [index, page] of this.context.pages().entries()) {
    if (page.isClosed() || page.url() === 'about:blank') continue;
    try {
      const fileName = `${String(this.stepNumber).padStart(2, '0')}-${safeName(pickleStep.text)}-page-${index + 1}.png`;
      const headed = process.env.BDD_HEADED === 'true';
      if (headed) await page.bringToFront();
      let buffer;
      try {
        buffer = await page.screenshot({ path: join(this.artifactDir, fileName), fullPage: !headed, timeout: 10000 });
      } catch (error) {
        if (!headed || !error.message.includes('Unable to capture screenshot')) throw error;
        // Some Xvfb compositors expose the native view but not a screenshot surface.
        // Capture that real viewport through Chromium's supported CDP view mode.
        const session = await this.context.newCDPSession(page);
        try {
          const { windowId } = await session.send('Browser.getWindowForTarget');
          await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
          await page.bringToFront();
          const capture = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
          buffer = Buffer.from(capture.data, 'base64');
          if (buffer.length < 100) throw new Error('Native view did not produce a usable PNG');
          await writeFile(join(this.artifactDir, fileName), buffer);
          await this.attach('Native Chromium viewport capture used after a virtual-display surface error.', { mediaType: 'text/plain', fileName: 'capture-mode.txt' });
        } catch (fallbackError) {
          let diagnostic = {};
          try { diagnostic = await page.evaluate(() => ({ visibility: document.visibilityState, width: innerWidth, height: innerHeight })); } catch {}
          throw new Error(`Headed screenshot capture failed: ${fallbackError.message}; viewport=${JSON.stringify(diagnostic)}`);
        } finally { await session.detach(); }
      }
      await this.attach(buffer, { mediaType: 'image/png', fileName });
    } catch (error) { errors.push(`Screenshot: ${error.message}`); }
  }
  this.data.lastStepStatus = result.status;
  for (const record of this.contexts) {
    if (record.grouped) {
      for (const tracing of [record.context.tracing, record.apiTracing]) {
        try { await tracing.groupEnd(); } catch (error) { errors.push(`Step group: ${error.message}`); }
      }
      record.grouped = false;
    }
  }
  this.currentStep = undefined;
  if (errors.length) {
    await this.attach(errors.join('\n'), { mediaType: 'text/plain', fileName: 'step-evidence-errors.txt' });
    // Keep the original assertion as the reported failure when evidence capture also fails.
    if (result.status === 'PASSED') throw new Error(errors.join('\n'));
  }
});

After({ name: 'Save scenario evidence and dispose contexts', timeout: 60000 }, async function ({ pickle, result, testCaseStartedId }) {
  if (!this.artifactDir) return;
  const errors = [];
  const metadata = {
    name: pickle.name, scenario: pickle.name, scenarioId: this.scenarioId, testCaseStartedId,
    workerId: this.workerId, processId: process.pid, status: result?.status,
    contextId: this.contexts[0]?.id, startedAt: this.startedAt, finishedAt: new Date().toISOString(),
    baseURL: this.baseURL, tags: pickle.tags.map(tag => tag.name),
    contexts: this.contexts.map(({ id, alias }) => ({ id, alias })),
    note: 'Synthetic test accounts. API summaries redact credentials; Playwright traces contain synthetic request data.',
  };
  try {
    for (const [index, record] of this.contexts.entries()) {
      const prefix = index === 0 ? 'trace' : `trace-${index}-${safeName(record.alias)}`;
      for (const [tracing, fileName] of [[record.context.tracing, `${prefix}.zip`], [record.apiTracing, `${prefix}-api.zip`]]) {
        try {
          if (record.grouped) await tracing.groupEnd();
          const path = join(this.artifactDir, fileName);
          await tracing.stop({ path });
          await this.attach(await readFile(path), { mediaType: 'application/zip', fileName });
        } catch (error) { errors.push(`Trace ${record.alias} (${fileName}): ${error.message}`); }
      }
    }
    for (const [fileName, value] of [['network.json', this.network], ['metadata.json', metadata]]) {
      const json = JSON.stringify(value, null, 2);
      await writeFile(join(this.artifactDir, fileName), json);
      await this.attach(json, { mediaType: 'application/json', fileName });
    }
  } finally {
    for (const { context } of this.contexts) {
      try { await context.close(); } catch (error) { errors.push(`Context cleanup: ${error.message}`); }
    }
  }
  if (errors.length) {
    await this.attach(errors.join('\n'), { mediaType: 'text/plain', fileName: 'scenario-evidence-errors.txt' });
    if (result?.status === 'PASSED') throw new Error(errors.join('\n'));
  }
});

AfterAll({ timeout: 30000 }, async function () {
  await browser?.close();
});
