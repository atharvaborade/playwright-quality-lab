import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const directory=mkdtempSync(join(tmpdir(),'slotwise-demo-'));
const server=spawn(process.execPath,['src/server.js'],{stdio:'inherit',env:{...process.env,PORT:'3300',DB_PATH:join(directory,'demo.sqlite'),NODE_ENV:'development',LAB_FAULT:'',LAB_ADMIN_PASSWORD:''}});
let browser;
try {
  let ready=false;
  for(let attempt=0;attempt<50;attempt++) {
    try { if((await fetch('http://127.0.0.1:3300/api/health')).ok) {ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!ready) throw new Error('Demo server did not start');
  browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{});
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  await page.goto('http://127.0.0.1:3300');
  mkdirSync('docs/screenshots',{recursive:true});
  await page.screenshot({path:'docs/screenshots/welcome.png',fullPage:true});
  await page.getByLabel('Your name').fill('Taylor Demo');
  await page.getByLabel('Email address').fill(`showcase-${randomUUID()}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill(randomUUID());
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.getByLabel('Available appointment').waitFor();
  await page.getByRole('button',{name:'Confirm appointment'}).click();
  await page.getByRole('article',{name:'Appointment with Maya Shah'}).waitFor();
  await page.screenshot({path:'docs/screenshots/booking.png',fullPage:true});
  console.log('Saved two screenshots of the real product with a disposable database.');
} finally {
  if(browser) await browser.close();
  const exited=new Promise(resolve=>server.once('exit',resolve));
  server.kill('SIGTERM'); await exited;
  rmSync(directory,{recursive:true,force:true});
}
