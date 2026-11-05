import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
const ignored = new Set(['node_modules','.git','reports','allure-report','test-results','playwright-report']);
const files=[];
async function scan(directory='.') {
  for(const item of await readdir(directory,{withFileTypes:true})) {
    if(ignored.has(item.name)) continue;
    const path=join(directory,item.name);
    if(item.isDirectory()) await scan(path);
    else if(/\.tsx?$/.test(item.name)) throw new Error(`Authored TypeScript remains: ${path}`);
    else if(/\.m?js$/.test(item.name)) files.push(path);
  }
}
await scan();
for(const file of files) {
  const run=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(run.status!==0) process.exit(run.status||1);
}
console.log(`JavaScript syntax verified for ${files.length} authored files; no authored TypeScript remains.`);
