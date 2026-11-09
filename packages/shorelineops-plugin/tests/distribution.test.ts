import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {parse} from 'yaml';
test('plugin uses the exact original ShorelineOps icon and preserves private prompts',async()=>{
 const original=await fs.readFile('../../public/icon-512.png'),icon=await fs.readFile('plugin/assets/shorelineops-icon.png');
 assert.equal(createHash('sha256').update(icon).digest('hex'),createHash('sha256').update(original).digest('hex'));
 assert.equal(icon.readUInt32BE(16),512);assert.equal(icon.readUInt32BE(20),512);
 const skillDir='plugin/skills/sylvia-ross-paperwork';
 const skill=parse(await fs.readFile(path.join(skillDir,'agents/openai.yaml'),'utf8'));
 for(const key of ['icon_small','icon_large']){
  const referenced=path.resolve(skillDir,skill.interface[key]);
  assert.ok(referenced.startsWith(path.resolve(skillDir)+path.sep),'Skill icon must be contained in the skill');
  assert.deepEqual(await fs.readFile(referenced),original,'Library skill icon must match the original app logo');
 }
 const manifest=JSON.parse(await fs.readFile('plugin/plugin.json','utf8'));assert.equal(manifest.author.name,'CulinaryOS');assert.equal(manifest.extensions['com.openai'].interface.logo,'./assets/shorelineops-icon.png');assert.equal(manifest.extensions['com.openai'].interface.defaultPrompt.length,4);
});
test('client config generator uses host-specific envelopes and refuses overwrite',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'shoreline-clients-'));try{for(const client of ['claude','vscode']){
 const file=path.join(dir,client+'.json');execFileSync(process.execPath,['scripts/configure-client.mjs',client,file,path.join(dir,'imports')]);const config=JSON.parse(await fs.readFile(file,'utf8')),server=(client==='claude'?config.mcpServers:config.servers).shorelineops;
 assert.equal(server.args[0],path.resolve('plugin/server.mjs'));assert.equal(server.env.SHORELINEOPS_IMPORT_DIR,path.join(dir,'imports'));
 assert.throws(()=>execFileSync(process.execPath,['scripts/configure-client.mjs',client,file,path.join(dir,'imports')],{stdio:'pipe'}));
 }}finally{await fs.rm(dir,{recursive:true,force:true});}
});
