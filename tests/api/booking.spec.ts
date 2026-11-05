import { test, expect } from '../fixtures/lab.js';

test('books a valid future slot and persists it in the account list', async ({ account, slot }) => {
  const response = await account.api.post('/api/appointments', { data: { provider: 'maya', slot } });
  expect(response.status()).toBe(201);
  const { appointment } = await response.json();
  expect(appointment).toMatchObject({ provider: 'maya', slot, status: 'confirmed' });
  expect((await (await account.api.get('/api/appointments')).json()).appointments).toContainEqual(appointment);
});

test('rejects an occupied slot across accounts', async ({ account, other, slot }) => {
  expect((await account.api.post('/api/appointments', { data: { provider: 'maya', slot } })).status()).toBe(201);
  const conflict = await other.api.post('/api/appointments', { data: { provider: 'maya', slot } });
  expect(conflict.status(), 'An occupied provider/time must return 409').toBe(409);
  expect((await conflict.json()).error).toContain('just booked');
});

test('allows only one winner when requests compete concurrently', async ({ account, other, slot }) => {
  const results = await Promise.all([account.api, other.api].map(api => api.post('/api/appointments', { data: { provider: 'alex', slot } })));
  expect(results.map(r => r.status()).sort()).toEqual([201,409]);
});

test('prevents cancellation of another account’s booking', async ({ account, other, slot }) => {
  const { appointment } = await (await account.api.post('/api/appointments', { data: { provider: 'maya', slot } })).json();
  const forbidden = await other.api.delete(`/api/appointments/${appointment.id}`);
  expect(forbidden.status(), 'Another account must not cancel this booking').toBe(404);
  expect((await (await account.api.get('/api/appointments')).json()).appointments[0].status).toBe('confirmed');
});

test('cancellation releases a slot and cannot be repeated', async ({ account, other, slot }) => {
  const { appointment } = await (await account.api.post('/api/appointments', { data: { provider: 'sam', slot } })).json();
  expect((await account.api.delete(`/api/appointments/${appointment.id}`)).status()).toBe(204);
  expect((await account.api.delete(`/api/appointments/${appointment.id}`)).status()).toBe(409);
  expect((await other.api.post('/api/appointments', { data: { provider: 'sam', slot } })).status()).toBe(201);
});

for (const slot of ['2020-01-01T09:00:00.000Z','not-a-date','2099-01-01T09:00:00.000Z','2027-02-30T09:00:00.000Z']) {
  test(`rejects invalid or out-of-window slot: ${slot}`, async ({ account }) => {
    expect((await account.api.post('/api/appointments', { data: { provider: 'maya', slot } })).status()).toBe(400);
    expect((await (await account.api.get('/api/appointments')).json()).appointments).toEqual([]);
  });
}

test('permits the same time with different providers', async ({ account, other, slot }) => {
  expect((await account.api.post('/api/appointments', { data: { provider: 'maya', slot } })).status()).toBe(201);
  expect((await other.api.post('/api/appointments', { data: { provider: 'alex', slot } })).status()).toBe(201);
});
