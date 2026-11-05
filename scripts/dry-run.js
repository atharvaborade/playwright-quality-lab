import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
// A planning run must never overwrite a real run's Cucumber/Allure evidence.
const directory=resolve('reports','dry-run');
rmSync(directory,{recursive:true,force:true});
mkdirSync(directory,{recursive:true});
const result=spawnSync(process.execPath,['node_modules/@cucumber/cucumber/bin/cucumber.js','--config','cucumber.mjs','--dry-run','--format','summary'],{
  stdio:'inherit',env:{...process.env,BDD_REPORT_DIR:directory},
});
process.exitCode=result.status??1;
