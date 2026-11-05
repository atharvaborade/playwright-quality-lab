import { test, expect } from '../fixtures/lab.js';
import { randomUUID } from 'node:crypto';

test('protected endpoints reject anonymous clients', async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, storageState: {cookies:[],origins:[]} });
  for (const path of ['/api/me','/api/appointments','/api/admin/summary']) expect((await api.get(path)).status()).toBe(401);
  expect((await api.post('/api/appointments', { data: { provider:'maya', slot:'2030-01-01T09:00:00.000Z' } })).status()).toBe(401);
  await api.dispose();
});

test('signs in with secure cookie attributes and invalidates logout session', async ({ account, playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, storageState: {cookies:[],origins:[]} });
  const response = await api.post('/api/login', { data: {email:account.email,password:account.password} });
  expect(response.status()).toBe(200);
  const cookie = response.headers()['set-cookie'];
  expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Strict');
  expect((await response.json()).user).not.toHaveProperty('password');
  const cookies = (await api.storageState()).cookies;
  expect((await api.post('/api/logout')).status()).toBe(204);
  const replay = await playwright.request.newContext({baseURL, storageState:{ cookies, origins:[] }});
  expect((await replay.get('/api/me')).status()).toBe(401);
  await replay.dispose(); await api.dispose();
});

test('incorrect password does not authenticate', async ({ account, playwright, baseURL }) => {
  const api=await playwright.request.newContext({baseURL,storageState:{cookies:[],origins:[]}});
  expect((await api.post('/api/login',{data:{email:account.email,password:'Incorrect-password-2026'}})).status()).toBe(401);
  expect((await api.get('/api/me')).status()).toBe(401); await api.dispose();
});

test('rejects weak passwords and client-supplied admin role', async ({ request }) => {
  const email=`invalid-${randomUUID()}@example.test`;
  expect((await request.post('/api/register',{data:{name:'Demo',email,password:'short'}})).status()).toBe(400);
  expect((await request.post('/api/register',{data:{name:'Demo',email,password:'Long-enough-password',role:'admin'}})).status()).toBe(400);
});

test('handles duplicate email without creating another identity', async ({ account }) => {
  expect((await account.api.post('/api/register',{data:{name:'Duplicate',email:account.email,password:account.password}})).status()).toBe(409);
});

test('member cannot access administrator summary', async ({ account }) => {
  expect((await account.api.get('/api/admin/summary')).status()).toBe(403);
});

test('administrator can access summary', async ({ playwright, baseURL }) => {
  const api=await playwright.request.newContext({baseURL,storageState:{cookies:[],origins:[]}});
  expect((await api.post('/api/login',{data:{email:'admin@example.test',password:'Local-test-admin-2026!'}})).status()).toBe(200);
  const response=await api.get('/api/admin/summary'); expect(response.status()).toBe(200);
  expect((await response.json()).users).toBeGreaterThan(0); await api.dispose();
});

test('rejects cross-origin writes even with an authenticated session', async ({ account, slot }) => {
  expect((await account.api.post('/api/appointments',{headers:{Origin:'https://untrusted.example'},data:{provider:'maya',slot}})).status()).toBe(403);
});
