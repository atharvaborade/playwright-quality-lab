import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const cases=[
  { fault:'double-booking', tag:'@fault-double-booking', title:'Another member cannot reserve an occupied coach and time', expected:409, actual:201 },
  { fault:'ownership', tag:'@fault-ownership', title:"A member cannot cancel another member's appointment", expected:404, actual:204 },
];
const summary=[];
for(const item of cases) {
  const directory=resolve('reports','faults',item.fault);
  const run=spawnSync(process.execPath,['scripts/run-bdd.js','--tags',item.tag,'--parallel','1'],{
    stdio:'inherit',env:{...process.env,LAB_FAULT:item.fault,BDD_REPORT_DIR:directory},
  });
  if(run.status!==1) throw new Error(`Expected one failing scenario for ${item.fault}; exit=${run.status}`);
  const report=JSON.parse(readFileSync(resolve(directory,'cucumber.json'),'utf8'));
  const scenarios=report.flatMap(feature=>feature.elements||[]).filter(element=>element.type==='scenario');
  const failed=scenarios.flatMap(scenario=>scenario.steps||[]).filter(step=>step.result?.status==='failed');
  const error=failed.map(step=>step.result.error_message||'').join('\n');
  if(scenarios.length!==1 || scenarios[0].name!==item.title || failed.length!==1 ||
      !new RegExp(`Expected HTTP ${item.expected}, received ${item.actual}`).test(error)) {
    throw new Error(`Failure was not the intended HTTP invariant assertion for ${item.fault}`);
  }
  summary.push({fault:item.fault,scenario:item.title,outcome:'detected',expected:item.expected,actual:item.actual});
  console.log(`Verified seeded-fault detection: ${item.fault}`);
}
mkdirSync('reports/faults',{recursive:true});
writeFileSync('reports/faults/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log('Both seeded faults were detected by their named BDD scenarios. Baseline evidence remains separate.');
