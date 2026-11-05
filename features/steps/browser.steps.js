import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const coachNames = { maya: 'Maya Shah', alex: 'Alex Morgan', sam: 'Sam Patel' };
const credentials = () => ({ name: 'Casey Browser', email: `browser-${randomUUID()}@example.test`, password: 'Synthetic-password-2026!' });
const testTime = (day, hour) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + day);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};
const appointment = world => world.page.getByRole('article', { name: `Appointment with ${coachNames[world.data.selectedProvider]}`, exact: true });
async function openAnonymous(world) {
  world.data.uiCredentials ??= credentials();
  await world.page.goto(world.baseURL);
  await expect(world.page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
}
async function openMember(world, overrides = {}) {
  const account = await world.createAccount('member', { ...overrides, primary: true });
  world.data.uiCredentials = account;
  await world.page.goto(world.baseURL);
  await expect(world.page.getByRole('heading', { name: 'Who would you like to meet?' })).toBeVisible();
  await expect(world.page.getByLabel('Available appointment').locator('option')).not.toHaveCount(0);
}
async function selectCoach(world, provider) {
  await world.page.getByRole('button', { name: new RegExp(coachNames[provider]) }).click();
  await expect(world.page.locator('#selection')).toHaveText(`${coachNames[provider]} · 60 minutes`);
  await expect(world.page.getByRole('button', { name: new RegExp(coachNames[provider]) })).toHaveAttribute('aria-pressed', 'true');
  world.data.selectedProvider = provider;
}
async function fillIdentity(world, withName = false) {
  const account = world.data.uiCredentials;
  if (withName) await world.page.getByLabel('Your name').fill(account.name);
  await world.page.getByLabel('Email address').fill(account.email);
  await world.page.getByLabel('Password', { exact: true }).fill(account.password);
}

Given('an anonymous visitor opens Slotwise', async function () {
  await openAnonymous(this);
});
Given('a member opens their booking workspace', async function () {
  await openMember(this);
});
Given('a registered member opens the sign-in form', async function () {
  this.data.uiCredentials = await this.createAccount('registered');
  await openAnonymous(this);
  await this.page.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).click();
});
Given('a registered member opens the registration form', async function () {
  this.data.uiCredentials = await this.createAccount('registered');
  await openAnonymous(this);
});
When('the visitor registers through the form', async function () {
  await fillIdentity(this, true);
  await this.page.getByRole('button', { name: 'Create account', exact: true }).click();
});
Then('their booking workspace and name are displayed', async function () {
  await expect(this.page.getByRole('heading', { name: 'Who would you like to meet?' })).toBeVisible();
  await expect(this.page.locator('#identity')).toHaveText(this.data.uiCredentials.name);
  await expect(this.page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(this.page.getByLabel('Password', { exact: true })).toHaveValue('');
});
When('the member reloads the page', async function () {
  await this.page.reload();
  await expect(this.page.getByRole('heading', { name: 'Who would you like to meet?' })).toBeVisible();
  await expect(this.page.getByLabel('Available appointment').locator('option')).not.toHaveCount(0);
});
When('the member signs out through the navigation', async function () {
  await this.page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(this.page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
});
Then('the registration form is displayed', async function () {
  await expect(this.page.getByLabel('Your name')).toBeVisible();
  await expect(this.page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  assert.equal((await this.api.get('/api/me')).status(), 401);
});
When('the visitor signs back in through the form', async function () {
  if (await this.page.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).isVisible()) {
    await this.page.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).click();
  }
  await fillIdentity(this);
  await this.page.getByRole('button', { name: 'Sign in', exact: true }).click();
});
When('the visitor signs in with an incorrect password through the form', async function () {
  await fillIdentity(this);
  await this.page.getByLabel('Password', { exact: true }).fill('Incorrect-password-2026!');
  await this.page.getByRole('button', { name: 'Sign in', exact: true }).click();
});
Then('the form explains {string} and can be submitted again', async function (message) {
  await expect(this.page.getByRole('status')).toHaveText(message);
  await expect(this.page.locator('#auth-submit')).toBeEnabled();
});
Then('the booking workspace stays hidden', async function () {
  await expect(this.page.locator('#workspace')).toBeHidden();
});
When('the visitor switches to the sign-in form', async function () {
  await this.page.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).click();
});
When('the visitor switches back to registration', async function () {
  await this.page.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
});
Then('the name field is hidden and password completion is for an existing account', async function () {
  await expect(this.page.getByLabel('Your name')).toBeHidden();
  await expect(this.page.getByLabel('Your name')).not.toHaveAttribute('required', '');
  await expect(this.page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
  await expect(this.page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
Then('the name field is required and password completion is for a new account', async function () {
  await expect(this.page.getByLabel('Your name')).toBeVisible();
  await expect(this.page.getByLabel('Your name')).toHaveAttribute('required', '');
  await expect(this.page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
});
When('the visitor submits registration with an invalid {string} in the browser', async function (field) {
  await fillIdentity(this, true);
  const labels = { name: 'Your name', email: 'Email address', password: 'Password' };
  const values = { name: '', email: 'invalid-email', password: 'short' };
  await this.page.getByLabel(labels[field], { exact: true }).fill(values[field]);
  await this.page.getByRole('button', { name: 'Create account', exact: true }).click();
});
Then('the {string} field reports native validation failure', async function (field) {
  assert.equal(await this.page.locator(`#${field}`).evaluate(input => input.checkValidity()), false);
  await expect(this.page.locator(`#${field}`)).toBeFocused();
});
Then('the browser session is still anonymous', async function () {
  assert.equal((await this.api.get('/api/me')).status(), 401);
});

When('the member selects each coach in turn', async function () {
  for (const provider of ['alex', 'maya', 'sam']) {
    const response = this.page.waitForResponse(candidate => candidate.url().endsWith(`/api/slots?provider=${provider}`) && candidate.request().method() === 'GET');
    await selectCoach(this, provider);
    await expect(this.page.getByLabel('Available appointment').locator('option')).not.toHaveCount(0);
    this.data.lastAvailability = (await (await response).json()).slots;
  }
});
Then('the last coach is selected and only its times are displayed', async function () {
  await expect(this.page.locator('#selection')).toHaveText('Sam Patel · 60 minutes');
  await expect(this.page.getByRole('button', { name: /Maya Shah/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(this.page.getByRole('button', { name: /Alex Morgan/ })).toHaveAttribute('aria-pressed', 'false');
  const displayed = await this.page.getByLabel('Available appointment').locator('option').evaluateAll(options => options.map(option => option.value));
  assert.deepEqual(displayed, this.data.lastAvailability);
});
When('the member chooses their reserved test time with {string}', async function (provider) {
  const reserved = { alex: [2, 9], maya: [3, 10], sam: [6, 16] };
  await selectCoach(this, provider);
  this.data.selectedSlot = testTime(...reserved[provider]);
  await this.page.getByLabel('Available appointment').selectOption(this.data.selectedSlot);
});
When('the member confirms the appointment', async function () {
  await this.page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
});
Then('the selected appointment is shown as confirmed', async function () {
  await expect(appointment(this)).toContainText('Confirmed');
  await expect(appointment(this).getByRole('button', { name: 'Cancel appointment', exact: true })).toBeVisible();
  const response = await this.api.get('/api/appointments');
  assert.equal(response.status(), 200);
  const own = (await response.json()).appointments;
  assert.equal(own.length, 1);
  assert.equal(own[0].slot, this.data.selectedSlot);
  assert.equal(own[0].provider, this.data.selectedProvider);
  assert.equal(own[0].status, 'confirmed');
});
When('the member selects {string} and cancels that appointment', async function (provider) {
  await selectCoach(this, provider);
  await appointment(this).getByRole('button', { name: 'Cancel appointment', exact: true }).click();
});
Then('the selected appointment is shown as cancelled without a cancel button', async function () {
  await expect(appointment(this)).toContainText('Cancelled');
  await expect(appointment(this).getByRole('button', { name: 'Cancel appointment', exact: true })).toHaveCount(0);
  await expect(this.page.getByRole('status')).toContainText('Appointment cancelled');
});
Then('the selected time is available again', async function () {
  await expect(this.page.getByLabel('Available appointment').locator(`option[value="${this.data.selectedSlot}"]`)).toHaveCount(1);
});
Given('another member reserves that selected time', async function () {
  const other = await this.createAccount('competitor');
  const response = await other.api.post('/api/appointments', { data: { provider: this.data.selectedProvider, slot: this.data.selectedSlot } });
  assert.equal(response.status(), 201, 'The competing member must reserve the stale UI time first');
});
Then('the page explains the time was just booked and allows another attempt', async function () {
  await expect(this.page.getByRole('status')).toHaveText('That time was just booked. Choose another slot.');
  await expect(this.page.getByRole('button', { name: 'Confirm appointment', exact: true })).toBeEnabled();
});
Then("the member's appointment list is empty", async function () {
  await expect(this.page.getByRole('article')).toHaveCount(0);
  await expect(this.page.locator('#appointments')).toContainText('Your next conversation starts here.');
  assert.deepEqual((await (await this.api.get('/api/appointments')).json()).appointments, []);
});
Given('another member already has an appointment', async function () {
  const other = await this.createAccount('other');
  const response = await other.api.post('/api/appointments', { data: { provider: 'sam', slot: this.futureSlot('hidden-from-ui-member') } });
  assert.equal(response.status(), 201);
});

When('the member selects Sam while Alex availability is still loading', async function () {
  let releaseAlex;
  let alexArrived;
  let alexReleased;
  const gate = new Promise(resolve => { releaseAlex = resolve; });
  const arrived = new Promise(resolve => { alexArrived = resolve; });
  const released = new Promise(resolve => { alexReleased = resolve; });
  const marker = testTime(4, 14);
  await this.page.route('**/api/slots?provider=alex', async route => {
    alexArrived();
    await gate;
    await route.fulfill({ json: { slots: [marker] } });
    alexReleased();
  });
  await this.page.route('**/api/slots?provider=sam', route => route.fulfill({ json: { slots: [testTime(4, 15)] } }));
  try {
    await this.page.getByRole('button', { name: /Alex Morgan/ }).click();
    await arrived;
    await this.page.getByRole('button', { name: /Sam Patel/ }).click();
    await expect(this.page.locator('#selection')).toHaveText('Sam Patel · 60 minutes');
    await expect.poll(() => this.page.getByLabel('Available appointment').locator('option').evaluateAll(options => options.map(option => option.value))).toEqual([testTime(4, 15)]);
  } finally {
    releaseAlex();
    await released;
    await expect(this.page.getByRole('button', { name: /Alex Morgan/ })).toBeEnabled();
  }
  this.data.raceExpected = testTime(4, 15);
});
Then('Sam remains selected after the delayed Alex response arrives', async function () {
  await expect(this.page.getByRole('button', { name: /Sam Patel/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(this.page.getByRole('button', { name: /Alex Morgan/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(this.page.locator('#selection')).toHaveText('Sam Patel · 60 minutes');
  await expect.poll(() => this.page.getByLabel('Available appointment').locator('option').evaluateAll(options => options.map(option => option.value))).toEqual([this.data.raceExpected]);
});
When("the member books the coach's final available time", async function () {
  this.data.selectedProvider = 'sam';
  this.data.selectedSlot = testTime(5, 14);
  let booked = false;
  await this.page.route('**/api/slots?provider=sam', route => route.fulfill({ json: { slots: booked ? [] : [this.data.selectedSlot] } }));
  await this.page.route('**/api/appointments', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const response = await route.fetch();
    assert.equal(response.status(), 201, 'The final available appointment must be genuinely booked');
    booked = true;
    await route.fulfill({ response });
  });
  await selectCoach(this, 'sam');
  await this.page.getByLabel('Available appointment').selectOption(this.data.selectedSlot);
  await this.page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await expect(this.page.getByRole('status')).toContainText('Appointment confirmed');
});
Then('no available times are explained and the confirmation button stays disabled', async function () {
  await expect(this.page.getByLabel('Available appointment')).toContainText('No times available');
  await expect(this.page.getByRole('button', { name: 'Confirm appointment', exact: true })).toBeDisabled();
});

Given('a {string} visitor opens Slotwise on a mobile viewport', async function (state) {
  await this.page.setViewportSize({ width: 390, height: 844 });
  if (state === 'signed-in') await openMember(this);
  else await openAnonymous(this);
});
Given('a {string} visitor opens Slotwise', async function (state) {
  if (state === 'signed-in') await openMember(this);
  else await openAnonymous(this);
});
Then('the page fits without horizontal scrolling', async function () {
  assert.equal(await this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
});
Then('the primary {string} action is visible', async function (state) {
  const name = state === 'signed-in' ? 'Confirm appointment' : 'Create account';
  await expect(this.page.getByRole('button', { name, exact: true })).toBeVisible();
});
Then('the page has no detected WCAG A or AA violations', async function () {
  const results = await new AxeBuilder({ page: this.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  assert.deepEqual(results.violations, [], JSON.stringify(results.violations.map(({ id, nodes }) => ({ id, elements: nodes.map(node => node.target) }))));
});
When('the visitor begins keyboard navigation', async function () {
  await this.page.keyboard.press('Tab');
});
Then('the skip link receives focus', async function () {
  await expect(this.page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});
When('the visitor continues to the registration form using the keyboard', async function () {
  await this.page.keyboard.press('Tab');
  await this.page.keyboard.press('Tab');
});
Then('the name field receives focus', async function () {
  await expect(this.page.getByLabel('Your name')).toBeFocused();
});
When('the member confirms the appointment using the keyboard', async function () {
  await this.page.getByLabel('Available appointment').focus();
  await this.page.keyboard.press('Tab');
  await expect(this.page.getByRole('button', { name: 'Confirm appointment', exact: true })).toBeFocused();
  await this.page.keyboard.press('Enter');
});
When('the member cancels that appointment using the keyboard', async function () {
  const cancel = appointment(this).getByRole('button', { name: 'Cancel appointment', exact: true });
  await cancel.focus();
  await expect(cancel).toBeFocused();
  await this.page.keyboard.press('Enter');
});
Given('a member whose name contains markup opens their workspace', async function () {
  this.data.dialogs = [];
  this.page.on('dialog', async dialog => { this.data.dialogs.push(dialog.message()); await dialog.dismiss(); });
  await openMember(this, { name: '<img src=x onerror=alert(1)>' });
});
Then('the member name is visible as literal text without executable markup', async function () {
  await expect(this.page.locator('#identity')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(this.page.locator('#identity img')).toHaveCount(0);
  assert.deepEqual(this.data.dialogs, []);
});
