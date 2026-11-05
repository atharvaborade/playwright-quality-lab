import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/lab.js';

test('member books and cancels through the UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Who would you like to meet?'})).toBeVisible();
  await page.getByRole('button',{name:/Alex Morgan/}).click();
  await expect(page.locator('#selection')).toContainText('Alex Morgan');
  const selection=await page.getByLabel('Available appointment').inputValue();
  await page.getByRole('button',{name:'Confirm appointment'}).click();
  await expect(page.getByRole('status')).toContainText('Appointment confirmed');
  const appointment=page.getByRole('article',{name:'Appointment with Alex Morgan'});
  await expect(appointment).toContainText('Confirmed');
  await page.reload(); await expect(appointment).toContainText('Confirmed');
  await page.getByRole('button',{name:/Alex Morgan/}).click();
  await expect(page.locator('#selection')).toContainText('Alex Morgan');
  await appointment.getByRole('button',{name:'Cancel appointment'}).click();
  await expect(appointment).toContainText('Cancelled');
  await expect(page.getByLabel('Available appointment').locator(`option[value="${selection}"]`)).toHaveCount(1);
});

test('booking conflict is explained and does not create a second booking', async ({ page, other }) => {
  await page.goto('/');
  await expect(page.getByLabel('Available appointment')).toBeVisible();
  const slot=await page.getByLabel('Available appointment').inputValue();
  expect((await other.api.post('/api/appointments',{data:{provider:'maya',slot}})).status()).toBe(201);
  await page.getByRole('button',{name:'Confirm appointment'}).click();
  await expect(page.getByRole('status')).toContainText('just booked');
  await expect(page.getByRole('button',{name:'Confirm appointment'})).toBeEnabled();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('authenticated booking screen has no detected WCAG A/AA violations', async ({ page }) => {
  await page.goto('/'); await expect(page.getByLabel('Available appointment')).toBeVisible();
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('mobile layout fits without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await expect(page.getByRole('heading',{name:'Who would you like to meet?'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:'Confirm appointment'})).toBeVisible();
});

test('signed-out registration page is keyboard reachable and accessible', async ({ browser }) => {
  const context=await browser.newContext({storageState:{cookies:[],origins:[]}}); const page=await context.newPage();
  await page.goto('http://127.0.0.1:'+ (process.env.TEST_PORT || '3100'));
  await page.keyboard.press('Tab'); await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(result.violations).toEqual([]); await context.close();
});

test('new member registers, signs out and signs back in through forms', async ({ browser, baseURL }) => {
  const context=await browser.newContext({storageState:{cookies:[],origins:[]}});
  const page=await context.newPage();
  const email=`ui-${crypto.randomUUID()}@example.test`;
  await page.goto(baseURL!);
  await page.getByLabel('Your name').fill('Casey Demo');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Synthetic-password-2026!');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Who would you like to meet?'})).toBeVisible();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Already have an account? Sign in',exact:true}).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Synthetic-password-2026!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#identity')).toHaveText('Casey Demo');
  await context.close();
});
