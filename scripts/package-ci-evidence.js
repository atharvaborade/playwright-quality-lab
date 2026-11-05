import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const output='reports/ci-evidence';
rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});
const copy=(source,destination)=>{if(existsSync(source))cpSync(source,destination,{recursive:true});};
if(existsSync('reports/allure-report/index.html')) {
 copy('reports/allure-report',join(output,'allure-report'));
} else {
 // Preserve debugging evidence when HTML generation itself fails.
 copy('reports/allure-results',join(output,'allure-results'));
 copy('reports/artifacts',join(output,'artifacts'));
}
for(const name of ['cucumber.json','run-summary.json','verified-evidence.json'])copy(join('reports',name),join(output,name));
for(const group of ['headed-smoke','faults']) {
 const target=join(output,group);mkdirSync(target,{recursive:true});
 if(group==='faults')copy(join('reports',group),target);
 else {
  for(const name of ['cucumber.json','run-summary.json','verified-evidence.json','artifacts'])copy(join('reports',group,name),join(target,name));
 }
}
writeFileSync(join(output,'READ-ME.txt'),`Open the Allure report with: npx allure open allure-report\nIts attachments include each baseline scenario's screenshots, network summary, metadata and browser/API trace ZIPs. Download a trace from Allure and open it with Playwright Trace Viewer.\nThe local reports/artifacts and raw Allure results are not duplicated here when the HTML report exists.\nCucumber JSON, isolation summaries, headed smoke and seeded-fault evidence are retained separately.\nAll test accounts are synthetic; do not publish production-session traces.\n`);
console.log('Packaged self-contained Allure report and execution evidence without duplicate baseline attachments.');
