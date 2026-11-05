import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
const directory=resolve(process.env.BDD_REPORT_DIR||'reports');
const cucumber=JSON.parse(readFileSync(join(directory,'cucumber.json'),'utf8'));
const scenarios=cucumber.flatMap(feature=>feature.elements||[]).filter(element=>element.type==='scenario');
assert(scenarios.length>0,'No BDD scenarios were executed');
for(const scenario of scenarios) {
  const results=[...(scenario.before||[]),...(scenario.steps||[]),...(scenario.after||[])].map(step=>step.result?.status).filter(Boolean);
  assert(results.length && results.every(status=>status==='passed'),`Nonpassing scenario: ${scenario.name}: ${results.join(',')}`);
}
const metadata=[];
let traceCount=0,networkEntries=0,screenshots=0,nativeNetworkRecords=0,domSnapshots=0;
for(const folder of readdirSync(join(directory,'artifacts'))) {
  const path=join(directory,'artifacts',folder);
  const meta=JSON.parse(readFileSync(join(path,'metadata.json'),'utf8'));
  metadata.push(meta);
  assert.equal(meta.status,'PASSED',`Scenario evidence not passed: ${meta.name}`);
  const files=readdirSync(path);
  assert(files.includes('trace.zip'),`Missing primary trace: ${meta.name}`);
  const network=JSON.parse(readFileSync(join(path,'network.json'),'utf8'));
  networkEntries+=network.length;
  for(const name of files.filter(file=>file.endsWith('.zip'))) {
    const zip=unzipSync(readFileSync(join(path,name)));
    assert(Object.keys(zip).some(key=>key.endsWith('.trace')),`Invalid Playwright trace: ${name}`);
    const events=Object.entries(zip).filter(([name])=>name.endsWith('.trace')).flatMap(([,bytes])=>strFromU8(bytes).split('\n').filter(Boolean).map(line=>JSON.parse(line)));
    assert(events.some(event=>event.type==='before' && event.apiName==='tracing.group') || events.some(event=>String(event.title||'').includes('. ')),`No step groups in trace: ${name}`);
    domSnapshots+=events.filter(event=>event.type==='frame-snapshot').length;
    for (const [name,bytes] of Object.entries(zip)) {
      if(name.endsWith('.network')) nativeNetworkRecords+=strFromU8(bytes).split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(event=>event.type==='resource-snapshot').length;
    }
    traceCount++;
  }
  screenshots+=files.filter(file=>file.endsWith('.png')).length;
}
assert.equal(metadata.length,scenarios.length,'Scenario metadata count differs from executed scenarios');
assert.equal(new Set(metadata.map(item=>item.scenarioId)).size,metadata.length,'Scenario IDs were reused');
const contextIds=metadata.flatMap(item=>item.contexts.map(context=>context.id));
assert.equal(new Set(contextIds).size,contextIds.length,'A BrowserContext was shared across scenarios');
const workers=[...new Set(metadata.map(item=>item.workerId))];
const expected=Number(process.env.EXPECTED_WORKERS||3);
assert(workers.length>=Math.min(expected,metadata.length),`Expected ${expected} workers; observed ${workers.length}`);
const overlap=metadata.some((a,index)=>metadata.slice(index+1).some(b=>a.workerId!==b.workerId && Date.parse(a.startedAt)<Date.parse(b.finishedAt) && Date.parse(b.startedAt)<Date.parse(a.finishedAt)));
if(expected>1 && metadata.length>1) assert(overlap,'No cross-worker scenario overlap was observed');
const allureFiles=readdirSync(join(directory,'allure-results')).filter(name=>name.endsWith('-result.json'));
assert.equal(allureFiles.length,scenarios.length,'Allure result count differs from scenario count');
for(const file of allureFiles) assert.equal(JSON.parse(readFileSync(join(directory,'allure-results',file),'utf8')).status,'passed',`Allure recorded a nonpassing scenario: ${file}`);
assert(traceCount>=scenarios.length,'Missing traces');
assert(networkEntries>0,'Network evidence is empty');
assert(nativeNetworkRecords>0,'Native Trace Viewer network records are missing');
assert(domSnapshots>0,'Browser DOM snapshots are missing');
const summary={scenarios:scenarios.length,workers,overlappingWorkers:overlap,uniqueContexts:contextIds.length,traces:traceCount,screenshots,networkEntries,nativeNetworkRecords,domSnapshots,allureResults:allureFiles.length};
writeFileSync(join(directory,'verified-evidence.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
