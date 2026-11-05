import { World, setWorldConstructor } from '@cucumber/cucumber';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

let workerBrowser;
let allocatedSlots = 0;
const hours = [9, 10, 11, 14, 15, 16];
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'fetch']);
const secretKeys = /password|cookie|authorization|token/i;

export const safeName = value => String(value).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'scenario';
export function setWorkerBrowser(browser) { workerBrowser = browser; }

function redact(value, key = '') {
  if (secretKeys.test(key)) return '[redacted]';
  if (Buffer.isBuffer(value)) return `[${value.length} bytes]`;
  if (Array.isArray(value)) return value.map(item => redact(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  if (typeof value === 'string') {
    try { return redact(JSON.parse(value)); } catch { return value.slice(0, 12000); }
  }
  return value;
}

export class LabWorld extends World {
  constructor(options) {
    super(options);
    this.baseURL = process.env.BDD_BASE_URL || 'http://127.0.0.1:3100';
    this.workerId = Number(process.env.CUCUMBER_WORKER_ID || 0);
    this.scenarioId = randomUUID();
    this.accounts = new Map();
    this.contexts = [];
    this.data = {};
    this.response = undefined;
    this.network = [];
    this.slots = new Map();
    this.stepNumber = 0;
  }

  async initialize(pickle) {
    this.startedAt = new Date().toISOString();
    this.browser = workerBrowser;
    this.scenarioName = pickle.name;
    this.artifactDir = resolve(process.env.BDD_REPORT_DIR || 'reports', 'artifacts', `${safeName(pickle.name)}-${this.scenarioId}`);
    await mkdir(this.artifactDir, { recursive: true });
    this.context = await this.newContext('primary');
    this.api = this.clientFor(this.context);
    this.page = await this.context.newPage();
  }

  async newContext(alias = 'client') {
    if (!this.browser) throw new Error('The scenario browser has not been initialized.');
    const context = await this.browser.newContext({
      baseURL: this.baseURL,
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      timezoneId: 'UTC',
      reducedMotion: 'reduce',
    });
    context.setDefaultTimeout(10000);
    const record = { id: randomUUID(), alias, context, apiTracing: context.request.tracing, grouped: false };
    this.contexts.push(record);
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    // Playwright records APIRequestContext traffic separately from browser traffic.
    await record.apiTracing.start({ screenshots: true, snapshots: true, sources: true });
    if (this.currentStep) {
      await context.tracing.group(this.currentStep);
      await record.apiTracing.group(this.currentStep);
      record.grouped = true;
    }
    context.on('request', request => {
      const entry = {
        kind: 'browser', context: record.id, alias, step: this.currentStep,
        method: request.method(), url: request.url(), resourceType: request.resourceType(),
        requestHeaders: redact(request.headers()), requestBody: redact(request.postData()),
        startedAt: new Date().toISOString(),
      };
      this.network.push(entry);
      request.response().then(response => {
        if (response) { entry.status = response.status(); entry.responseHeaders = redact(response.headers()); }
      }).catch(() => {});
    });
    context.on('requestfailed', request => {
      const entry = this.network.findLast(item => item.kind === 'browser' && item.context === record.id && item.url === request.url() && !item.error);
      if (entry) entry.error = request.failure()?.errorText;
    });
    return context;
  }

  clientFor(context) {
    const record = this.contexts.find(item => item.context === context);
    if (record.api) return record.api;
    record.api = new Proxy(context.request, {
      get: (target, property) => {
        const value = Reflect.get(target, property, target);
        if (typeof value !== 'function') return value;
        if (!httpMethods.has(property)) return value.bind(target);
        return async (url, options = {}) => {
          const entry = {
            kind: 'api', context: record.id, alias: record.alias, step: this.currentStep,
            method: property === 'fetch' ? (options.method || 'GET') : property.toUpperCase(),
            url: typeof url === 'string' ? new URL(url, this.baseURL).href : url.url(),
            requestHeaders: redact(options.headers || {}), requestBody: redact(options.data),
            startedAt: new Date().toISOString(),
          };
          this.network.push(entry);
          try {
            const response = await value.call(target, url, options);
            entry.status = response.status();
            entry.responseHeaders = redact(response.headers());
            entry.responseBody = redact(await response.text());
            entry.finishedAt = new Date().toISOString();
            return response;
          } catch (error) {
            entry.error = error.message;
            throw error;
          }
        };
      },
    });
    return record.api;
  }

  async createClient(alias = 'anonymous') {
    const context = await this.newContext(alias);
    return { context, api: this.clientFor(context) };
  }

  async createAccount(alias, overrides = {}) {
    if (this.accounts.has(alias)) throw new Error(`Account alias already exists: ${alias}`);
    const context = overrides.primary ? this.context : await this.newContext(alias);
    const api = this.clientFor(context);
    const name = overrides.name ?? `${alias} Demo`;
    const email = overrides.email ?? `${safeName(alias)}-${this.scenarioId}@example.test`;
    const password = overrides.password ?? 'Synthetic-password-2026!';
    const response = await api.post('/api/register', { data: { name, email, password } });
    if (response.status() !== 201) throw new Error(`Could not create fixture account ${alias}: HTTP ${response.status()} ${await response.text()}`);
    const { user } = await response.json();
    const account = { api, context, email, password, name, user };
    this.accounts.set(alias, account);
    return account;
  }

  getAccount(alias) {
    const account = this.accounts.get(alias);
    if (!account) throw new Error(`Unknown account alias: ${alias}`);
    return account;
  }

  futureSlot(label = 'default') {
    if (this.slots.has(label)) return this.slots.get(label);
    // A worker owns a disjoint band of days, so parallel fixtures never race for a slot.
    // Cucumber sets CUCUMBER_PARALLEL='true' inside worker threads.
    const workers = Number(process.env.CUCUMBER_TOTAL_WORKERS || process.env.CUCUMBER_PARALLEL || 3);
    const daysPerWorker = Math.floor(80 / Math.max(1, workers));
    const sequence = allocatedSlots++;
    if (this.workerId >= workers || sequence >= daysPerWorker * hours.length) {
      throw new Error('Fixture slot capacity exceeded. Run fewer workers or divide the scenario run.');
    }
    const date = process.env.BDD_SLOT_DATE ? new Date(`${process.env.BDD_SLOT_DATE}T00:00:00.000Z`) : new Date();
    date.setUTCDate(date.getUTCDate() + 8 + this.workerId * daysPerWorker + Math.floor(sequence / hours.length));
    date.setUTCHours(hours[sequence % hours.length], 0, 0, 0);
    const slot = date.toISOString();
    this.slots.set(label, slot);
    return slot;
  }
}

setWorldConstructor(LabWorld);
