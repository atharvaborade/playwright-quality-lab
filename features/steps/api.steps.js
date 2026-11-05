import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Given, When, Then } from '@cucumber/cucumber';

const validCredentials = () => ({ name: 'Casey Example', email: `member-${randomUUID()}@example.test`, password: 'Synthetic-password-2026!' });
const json = response => response.json();
const history = async account => {
  const response = await account.api.get('/api/appointments');
  assert.equal(response.status(), 200, 'A signed-in member can read appointment history');
  return (await json(response)).appointments;
};
const remember = (world, name, appointment) => {
  world.data.appointments ??= {};
  world.data.appointments[name] = appointment;
  return appointment;
};
async function reserve(world, alias, provider, label, slot = world.futureSlot(label)) {
  const response = await world.getAccount(alias).api.post('/api/appointments', { data: { provider, slot } });
  assert.equal(response.status(), 201, `Fixture reservation ${label} must succeed`);
  return remember(world, label, (await json(response)).appointment);
}
async function visitor(world) {
  world.data.visitor = await world.createClient(`visitor-${randomUUID()}`);
  return world.data.visitor;
}
function registrationFor(problem) {
  const data = validCredentials();
  switch (problem) {
    case 'blank name': data.name = '   '; break;
    case 'missing name': delete data.name; break;
    case 'oversized name': data.name = 'N'.repeat(81); break;
    case 'invalid email': data.email = 'not-an-email'; break;
    case 'oversized email': data.email = `${'a'.repeat(250)}@example.test`; break;
    case 'short password': data.password = 'short'; break;
    case 'oversized password': data.password = 'p'.repeat(129); break;
    case 'client admin role': data.role = 'admin'; break;
    case 'unexpected field': data.unexpected = 'must not be accepted'; break;
    case 'a one-character name': data.name = 'C'; break;
    case 'an eighty-character name': data.name = 'N'.repeat(80); break;
    case 'a twelve-character password': data.password = 'p'.repeat(12); break;
    case 'a 128-character password': data.password = 'p'.repeat(128); break;
    default: throw new Error(`Unknown registration example: ${problem}`);
  }
  return data;
}

Given('a member named {string} exists', async function (alias) {
  await this.createAccount(alias);
});
Given('members named {string} and {string} exist', async function (first, second) {
  await this.createAccount(first);
  await this.createAccount(second);
});

When('an anonymous visitor sends {string} to {string}', async function (method, path) {
  const client = await visitor(this);
  const options = method === 'POST' && path === '/api/appointments'
    ? { data: { provider: 'maya', slot: this.futureSlot('anonymous') } } : {};
  this.response = await client.api.fetch(path, { method, ...options });
});
Then('the response status is {int}', function (expected) {
  const actual = this.response.status();
  assert.equal(actual, expected, `Expected HTTP ${expected}, received ${actual}`);
});
Then('the response error is {string}', async function (expected) {
  assert.equal((await json(this.response)).error, expected);
});
Then('the response content type is JSON', function () {
  assert.match(this.response.headers()['content-type'], /^application\/json\b/);
});

When('a visitor registers with a padded name and mixed-case email', async function () {
  const client = await visitor(this);
  this.data.registration = validCredentials();
  this.data.registration.name = '  Casey Example  ';
  this.data.registration.email = this.data.registration.email.toUpperCase();
  this.response = await client.api.post('/api/register', { data: this.data.registration });
});
When('a visitor submits registration with {string}', async function (problem) {
  const client = await visitor(this);
  this.response = await client.api.post('/api/register', { data: registrationFor(problem) });
});
When('a visitor registers with {string}', async function (boundary) {
  const client = await visitor(this);
  this.data.registration = registrationFor(boundary);
  this.response = await client.api.post('/api/register', { data: this.data.registration });
});
Then('the registered identity is normalized and contains no password', async function () {
  const { user } = await json(this.response);
  assert.equal(user.name, this.data.registration.name.trim());
  assert.equal(user.email, this.data.registration.email.toLowerCase());
  assert.equal(user.role, 'member');
  assert.equal(Number.isInteger(user.id), true);
  assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'name', 'role']);
});
Then('that visitor can retrieve the same member identity', async function () {
  const { user } = await json(this.response);
  const response = await this.data.visitor.api.get('/api/me');
  assert.equal(response.status(), 200);
  assert.deepEqual((await json(response)).user, user);
  assert.equal(user.role, 'member');
});
Then('the visitor remains signed out', async function () {
  assert.equal((await this.data.visitor.api.get('/api/me')).status(), 401);
});
When("another visitor registers with the owner's email in uppercase", async function () {
  const client = await visitor(this);
  this.response = await client.api.post('/api/register', { data: { ...validCredentials(), email: this.getAccount('owner').email.toUpperCase() } });
});
When('a visitor signs in with {string}', async function (problem) {
  const client = await visitor(this);
  const owner = this.getAccount('owner');
  const data = { email: owner.email, password: owner.password };
  switch (problem) {
    case 'wrong password': data.password = 'Incorrect-password-2026!'; break;
    case 'unknown email': data.email = `unknown-${randomUUID()}@example.test`; break;
    case 'invalid email': data.email = 'not-an-email'; break;
    case 'short password': data.password = 'short'; break;
    case 'missing password': delete data.password; break;
    default: throw new Error(`Unknown sign-in example: ${problem}`);
  }
  this.response = await client.api.post('/api/login', { data });
  if (['wrong password', 'unknown email'].includes(problem)) assert.equal((await json(this.response)).error, 'Email or password is incorrect');
});
When("a visitor signs in using the owner's email in uppercase", async function () {
  const client = await visitor(this);
  const owner = this.getAccount('owner');
  this.response = await client.api.post('/api/login', { data: { email: owner.email.toUpperCase(), password: owner.password } });
});
Then('the session cookie is HTTP-only and same-site strict', async function () {
  const setCookie = this.response.headers()['set-cookie'];
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const session = (await this.data.visitor.context.cookies()).find(cookie => cookie.name === 'session');
  assert.ok(session, 'Sign-in must set a session cookie');
  assert.equal(session.httpOnly, true);
  assert.equal(session.sameSite, 'Strict');
});
Then('the response identity contains no password', async function () {
  const { user } = await json(this.response);
  assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'name', 'role']);
});
When('that visitor signs out and replays the old session cookie', async function () {
  const client = this.data.visitor;
  const cookies = await client.context.cookies();
  assert.equal((await client.api.post('/api/logout')).status(), 204);
  assert.equal((await client.api.get('/api/me')).status(), 401);
  const replay = await this.createClient('replayed-session');
  await replay.context.addCookies(cookies);
  this.response = await replay.api.get('/api/me');
});
When('a visitor requests their identity with a fabricated session cookie', async function () {
  const client = await visitor(this);
  this.response = await client.api.get('/api/me', { headers: { Cookie: `session=${'a'.repeat(64)}` } });
});
When('{string} requests the administrator summary', async function (alias) {
  this.response = await this.getAccount(alias).api.get('/api/admin/summary');
});
Given('the configured administrator is signed in', async function () {
  this.data.administrator = await this.createClient('administrator');
  const response = await this.data.administrator.api.post('/api/login', { data: { email: 'admin@example.test', password: process.env.LAB_ADMIN_PASSWORD || 'Local-test-admin-2026!' } });
  assert.equal(response.status(), 200, 'The test server must seed the configured administrator');
});
When('the administrator requests the summary', async function () {
  this.response = await this.data.administrator.api.get('/api/admin/summary');
});
Then('the summary contains numeric user and confirmed-appointment totals', async function () {
  const body = await json(this.response);
  assert.equal(Number.isInteger(body.users), true);
  assert.ok(body.users >= 1);
  assert.equal(Number.isInteger(body.appointments), true);
  assert.ok(body.appointments >= 0);
  assert.deepEqual(Object.keys(body).sort(), ['appointments', 'users']);
});

When('{string} requests available times for {string}', async function (alias, provider) {
  this.response = await this.getAccount(alias).api.get(`/api/slots?provider=${provider}`);
});
Then('the available times are unique supported UTC hours in the next seven days', async function () {
  const { slots } = await json(this.response);
  assert.ok(slots.length > 0, 'Test fixtures leave some availability for each coach');
  assert.equal(new Set(slots).size, slots.length);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const slot of slots) {
    const date = new Date(slot);
    assert.equal(date.toISOString(), slot);
    assert.ok([9, 10, 11, 14, 15, 16].includes(date.getUTCHours()));
    assert.equal(date.getUTCMinutes() + date.getUTCSeconds() + date.getUTCMilliseconds(), 0);
    const day = Math.floor((date.getTime() - today.getTime()) / 86400000);
    assert.ok(day >= 1 && day <= 7, `Availability ${slot} must be in the next seven UTC days`);
  }
  assert.deepEqual(slots, [...slots].sort());
});
When('{string} requests availability with {string}', async function (alias, problem) {
  const path = problem === 'no provider' ? '/api/slots' : '/api/slots?provider=unknown';
  this.response = await this.getAccount(alias).api.get(path);
});
When('{string} books a future {string} appointment called {string}', async function (alias, provider, label) {
  this.response = await this.getAccount(alias).api.post('/api/appointments', { data: { provider, slot: this.futureSlot(label) } });
  if (this.response.status() === 201) remember(this, label, (await json(this.response)).appointment);
});
Given('{string} has a future {string} appointment called {string}', async function (alias, provider, label) {
  await reserve(this, alias, provider, label);
});
Then('{string} sees {string} as {string} in their appointment history', async function (alias, label, status) {
  const expected = this.data.appointments[label];
  assert.ok(expected, `Appointment fixture ${label} must exist`);
  const entries = await history(this.getAccount(alias));
  assert.deepEqual(entries.find(appointment => appointment.id === expected.id), { ...expected, status });
  for (const entry of entries) assert.deepEqual(Object.keys(entry).sort(), ['id', 'provider', 'slot', 'status']);
});
Then('{string} has no appointments', async function (alias) {
  assert.deepEqual(await history(this.getAccount(alias)), []);
});
Then('{string} sees exactly one appointment', async function (alias) {
  assert.equal((await history(this.getAccount(alias))).length, 1);
});
Given('{string} has two appointments created in reverse time order', async function (alias) {
  const times = [this.futureSlot('chronology-one'), this.futureSlot('chronology-two')].sort();
  await reserve(this, alias, 'alex', 'later', times[1]);
  await reserve(this, alias, 'sam', 'earlier', times[0]);
});
When('{string} cancels appointment {string}', async function (alias, label) {
  this.response = await this.getAccount(alias).api.delete(`/api/appointments/${this.data.appointments[label].id}`);
});
Then('{string} sees their appointments ordered by time', async function (alias) {
  const entries = await history(this.getAccount(alias));
  assert.deepEqual(entries.map(entry => entry.id), [this.data.appointments.earlier.id, this.data.appointments.later.id]);
});
When('{string} attempts to book the same coach and time as {string}', async function (alias, label) {
  const { provider, slot } = this.data.appointments[label];
  this.response = await this.getAccount(alias).api.post('/api/appointments', { data: { provider, slot } });
});
When('both members simultaneously request the same future {string} appointment', async function (provider) {
  const slot = this.futureSlot('concurrent');
  this.data.concurrentResponses = await Promise.all(['owner', 'other'].map(alias => this.getAccount(alias).api.post('/api/appointments', { data: { provider, slot } })));
});
Then('exactly one request succeeds with 201 and the other receives 409', function () {
  assert.deepEqual(this.data.concurrentResponses.map(response => response.status()).sort(), [201, 409]);
});
Then('exactly one confirmed appointment exists across those two accounts', async function () {
  const lists = await Promise.all(['owner', 'other'].map(alias => history(this.getAccount(alias))));
  const appointments = lists.flat();
  assert.equal(appointments.length, 1);
  assert.equal(appointments[0].status, 'confirmed');
});
When('the members reserve different coaches at the same future time', async function () {
  const slot = this.futureSlot('different-coaches');
  this.data.parallelResponses = await Promise.all(['owner', 'other'].map((alias, index) => this.getAccount(alias).api.post('/api/appointments', { data: { provider: ['maya', 'alex'][index], slot } })));
});
Then('both requests succeed with 201', function () {
  assert.deepEqual(this.data.parallelResponses.map(response => response.status()), [201, 201]);
});
Then('each member sees only their own confirmed appointment', async function () {
  for (const [index, alias] of ['owner', 'other'].entries()) {
    const { appointment } = await json(this.data.parallelResponses[index]);
    assert.deepEqual(await history(this.getAccount(alias)), [appointment]);
    assert.equal(appointment.status, 'confirmed');
  }
});
When('{string} cancels using {string}', async function (alias, identifier) {
  this.response = await this.getAccount(alias).api.delete(`/api/appointments/${identifier}`);
});
When('{string} requests an appointment with {string}', async function (alias, problem) {
  const data = { provider: 'maya', slot: this.futureSlot('invalid-booking') };
  const date = new Date(data.slot);
  switch (problem) {
    case 'a past date': data.slot = '2020-01-01T09:00:00.000Z'; break;
    case 'a malformed date': data.slot = 'not-a-date'; break;
    case 'a date beyond 90 days': date.setUTCDate(date.getUTCDate() + 100); data.slot = date.toISOString(); break;
    case 'an impossible date': data.slot = `${new Date().getUTCFullYear()}-02-30T09:00:00.000Z`; break;
    case 'a noncanonical timestamp': data.slot = data.slot.replace('.000Z', 'Z'); break;
    case 'an unsupported hour': date.setUTCHours(8); data.slot = date.toISOString(); break;
    case 'nonzero minutes': date.setUTCMinutes(30); data.slot = date.toISOString(); break;
    case 'an unknown provider': data.provider = 'unknown'; break;
    case 'no provider': delete data.provider; break;
    case 'no slot': delete data.slot; break;
    case 'client-supplied owner': data.user_id = this.getAccount(alias).user.id; break;
    case 'client-supplied status': data.status = 'cancelled'; break;
    default: throw new Error(`Unknown booking example: ${problem}`);
  }
  this.response = await this.getAccount(alias).api.post('/api/appointments', { data });
});
Given('{string} chooses a visible future time for {string}', function (alias, provider) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  date.setUTCHours(16, 0, 0, 0);
  this.data.visible = { alias, provider, slot: date.toISOString() };
});
When('{string} reserves that visible time', async function (alias) {
  const { provider, slot } = this.data.visible;
  await reserve(this, alias, provider, 'visible', slot);
});
Then('the time is absent from {string} availability for {string}', async function (provider, alias) {
  const response = await this.getAccount(alias).api.get(`/api/slots?provider=${provider}`);
  assert.equal(response.status(), 200);
  assert.equal((await json(response)).slots.includes(this.data.visible.slot), false);
});
Then('the time remains available for {string} to {string}', async function (provider, alias) {
  const response = await this.getAccount(alias).api.get(`/api/slots?provider=${provider}`);
  assert.equal(response.status(), 200);
  assert.ok((await json(response)).slots.includes(this.data.visible.slot));
});
Then('the time is available again for {string} to {string}', async function (provider, alias) {
  const response = await this.getAccount(alias).api.get(`/api/slots?provider=${provider}`);
  assert.equal(response.status(), 200);
  assert.ok((await json(response)).slots.includes(this.data.visible.slot));
});

When('a visitor checks application health and discovers coaches', async function () {
  const client = await visitor(this);
  const [healthResponse, catalogueResponse] = await Promise.all([client.api.get('/api/health'), client.api.get('/api/providers')]);
  assert.equal(healthResponse.status(), 200);
  assert.equal(catalogueResponse.status(), 200);
  this.data.health = await json(healthResponse);
  this.data.catalogue = await json(catalogueResponse);
});
Then('health is reported as {string}', function (status) {
  assert.deepEqual(this.data.health, { status });
});
Then('the catalogue contains all three distinct coaches and their specialties', function () {
  assert.deepEqual(this.data.catalogue.providers.map(({ id, name, specialty }) => ({ id, name, specialty })), [
    { id: 'maya', name: 'Maya Shah', specialty: 'Career coaching' },
    { id: 'alex', name: 'Alex Morgan', specialty: 'Portfolio review' },
    { id: 'sam', name: 'Sam Patel', specialty: 'Interview practice' }
  ]);
});
When('{string} sends malformed JSON to {string}', async function (alias, path) {
  this.response = await this.getAccount(alias).api.post(path, { headers: { 'Content-Type': 'application/json' }, data: '{"unclosed":' });
});
When('a visitor sends a JSON registration body larger than the supported limit', async function () {
  const client = await visitor(this);
  this.response = await client.api.post('/api/register', { data: { ...validCredentials(), name: 'N'.repeat(11 * 1024) } });
});
When('{string} attempts a cross-origin {string}', async function (alias, operation) {
  const account = this.getAccount(alias);
  const headers = { Origin: 'https://untrusted.example' };
  switch (operation) {
    case 'registration': this.response = await account.api.post('/api/register', { headers, data: validCredentials() }); break;
    case 'sign-in': this.response = await account.api.post('/api/login', { headers, data: { email: account.email, password: account.password } }); break;
    case 'sign-out': this.response = await account.api.post('/api/logout', { headers }); break;
    case 'booking': this.response = await account.api.post('/api/appointments', { headers, data: { provider: 'sam', slot: this.futureSlot('cross-origin') } }); break;
    case 'cancellation': this.response = await account.api.delete(`/api/appointments/${this.data.appointments.protected.id}`, { headers }); break;
    default: throw new Error(`Unknown cross-origin example: ${operation}`);
  }
});
Then('{string} is still signed in', async function (alias) {
  const account = this.getAccount(alias);
  const response = await account.api.get('/api/me');
  assert.equal(response.status(), 200);
  assert.equal((await json(response)).user.id, account.user.id);
});
Then('private responses are not cached and browser security headers are present', function () {
  const headers = this.response.headers();
  assert.equal(headers['cache-control'], 'no-store');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'SAMEORIGIN');
  assert.match(headers['content-security-policy'], /default-src 'self'/);
});
