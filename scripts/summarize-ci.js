import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
const sections=[];
const read=path=>existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
const escape=value=>String(value).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
for(const [label,directory] of [['BDD baseline','reports'],['Headed parallel smoke','reports/headed-smoke']]) {
 const summary=read(join(directory,'run-summary.json'));
 if(!summary) { sections.push(`## ${label}\nNo execution summary was produced.\n`); continue; }
 sections.push(`## ${label}\n\nScenarios: **${summary.scenarioCount}**. Outcomes: ${JSON.stringify(summary.statusCounts)}. Requested workers: ${summary.parallelWorkers}.\n`);
 const evidence=read(join(directory,'verified-evidence.json'));
 if(evidence)sections.push(`Verified evidence:\n\n\`\`\`json\n${JSON.stringify(evidence,null,2)}\n\`\`\`\n`);
 const cucumber=read(join(directory,'cucumber.json'))||[];
 for(const feature of cucumber)for(const scenario of feature.elements||[]) {
  for(const step of [...(scenario.before||[]),...(scenario.steps||[]),...(scenario.after||[])]) {
   if(step.result?.status!=='failed')continue;
   const error=(step.result.error_message||'Unknown scenario failure').replace(/\u001b\[[0-9;]*m/g,'').slice(0,4000);
   sections.push(`### Failed: ${scenario.name}\n\nStep: ${step.name||'hook'}\n\n\`\`\`text\n${error}\n\`\`\`\n`);
   console.log(`::error title=${escape(label+': '+scenario.name)}::${escape(error)}`);
  }
 }
}
const faults=read('reports/faults/summary.json');
if(faults)sections.push(`## Seeded-fault experiments\n\n\`\`\`json\n${JSON.stringify(faults,null,2)}\n\`\`\`\n`);
const markdown=sections.join('\n');
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);
else console.log(markdown);
