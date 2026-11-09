import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const directory=process.env.SYLVIA_RUNTIME_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),...(process.platform==='win32'?['AppData','Local']:['.local','share'])),'SylviaRossMenuProcessor','runtime-1.64.1');
await fs.mkdir(directory,{recursive:true});
const manifest=path.join(directory,'package.json');
try { await fs.access(manifest); } catch { await fs.writeFile(manifest,JSON.stringify({private:true,name:'sylvia-ross-local-runtime',version:'0.2.0',dependencies:{playwright:'1.64.1'}})); }
function run(command,args){ const result=spawnSync(command,args,{cwd:directory,stdio:['ignore','pipe','pipe'],shell:process.platform==='win32' && command.endsWith('.cmd')}); if(result.stdout) process.stderr.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr); if(result.status!==0) throw new Error(`Runtime setup failed: ${command}`); }
try { await fs.access(path.join(directory,'node_modules/playwright/package.json')); }
catch { run(process.platform==='win32'?'npm.cmd':'npm',['install','--omit=dev','--ignore-scripts','--no-audit','--no-fund']); }
run(process.execPath,[path.join(directory,'node_modules/playwright/cli.js'),'install','chromium']);
console.error(`Sylvia Ross local runtime ready: ${directory}`);