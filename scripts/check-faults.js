import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
const cases = [
  { fault:'double-booking', title:'rejects an occupied slot across accounts', expected:'409', actual:'201' },
  { fault:'ownership', title:'prevents cancellation of another account’s booking', expected:'404', actual:'204' },
];
function specs(suites) { return suites.flatMap(suite => [...(suite.specs || []), ...specs(suite.suites || [])]); }
const summary=[];
for (const [index, item] of cases.entries()) {
  const directory=`test-results/fault-${item.fault}`;
  rmSync(directory,{recursive:true,force:true}); mkdirSync(directory,{recursive:true});
  const reportPath=`${directory}/results.json`;
  const run=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--project=api','--grep',item.title,'--workers=1','--retries=0'],{
    stdio:'inherit',env:{...process.env,LAB_FAULT:item.fault,TEST_PORT:String(3201+index),PW_OUTPUT_DIR:`${directory}/artifacts`,PW_REPORT_PATH:reportPath,PW_HTML_FOLDER:`${directory}/html`},
  });
  if (run.status !== 1) throw new Error(`Expected one failing assertion for ${item.fault}; exit=${run.status}`);
  const report=JSON.parse(readFileSync(reportPath,'utf8'));
  const selected=specs(report.suites);
  const errors=selected.flatMap(spec=>spec.tests.flatMap(test=>test.results.flatMap(result=>result.errors || []))).map(error=>error.message || '').join('\n').replace(/\u001b\[[0-9;]*m/g,'');
  if (selected.length !== 1 || selected[0].title !== item.title || report.stats.unexpected !== 1 || report.stats.expected !== 0 || report.stats.skipped !== 0 || !new RegExp('Expected:\\s*'+item.expected+'\\b').test(errors) || !new RegExp('Received:\\s*'+item.actual+'\\b').test(errors) || !errors.includes('toBe')) {
    throw new Error(`Failure was not the intended invariant assertion for ${item.fault}`);
  }
  summary.push({fault:item.fault,test:item.title,outcome:'detected',expectedStatus:Number(item.expected),actualStatus:Number(item.actual)});
  console.log(`Verified fault detection: ${item.fault}`);
}
writeFileSync('test-results/fault-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log('Both seeded faults were detected by the intended assertions. This is a targeted experiment, not a mutation score.');
