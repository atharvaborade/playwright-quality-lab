import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
type Account = { api: APIRequestContext; email: string; password: string; name: string };
let sequence = 0;
export const test = base.extend<{ account: Account; other: Account; slot: string }>({
  account: async ({ playwright, baseURL }, use) => {
    const api = await playwright.request.newContext({ baseURL, storageState: {cookies:[],origins:[]} });
    const account = { api, email: `member-${randomUUID()}@example.test`, password: 'Synthetic-password-2026!', name: 'Taylor Demo' };
    const response = await api.post('/api/register', { data: { name: account.name, email: account.email, password: account.password } });
    expect(response.status()).toBe(201); await use(account); await api.dispose();
  },
  other: async ({ playwright, baseURL }, use) => {
    const api = await playwright.request.newContext({ baseURL, storageState: {cookies:[],origins:[]} });
    const account = { api, email: `other-${randomUUID()}@example.test`, password: 'Synthetic-password-2026!', name: 'Jordan Demo' };
    expect((await api.post('/api/register', { data: { name: account.name, email: account.email, password: account.password } })).status()).toBe(201);
    await use(account); await api.dispose();
  },
  storageState: async ({ account }, use) => { await use(await account.api.storageState()); },
  slot: async ({}, use, info) => {
    const date = new Date(); date.setUTCDate(date.getUTCDate() + 8 + info.parallelIndex * 20 + sequence++);
    date.setUTCHours(9,0,0,0); await use(date.toISOString());
  },
});
export { expect };
