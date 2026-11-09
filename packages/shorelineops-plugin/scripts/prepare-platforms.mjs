import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),version=JSON.parse(await fs.readFile('package.json','utf8')).version,out=path.join(root,'output','release-'+version);
await fs.mkdir(out,{recursive:true});
const copy=async(dir)=>{await fs.mkdir(dir,{recursive:true});await fs.cp('plugin',dir,{recursive:true});await fs.mkdir(path.join(dir,'scripts'),{recursive:true});for(const f of ['configure-client.mjs']){let content=await fs.readFile('scripts/'+f,'utf8');content=content.replace("path.join(root,'plugin/server.mjs')","path.join(root,'server.mjs')");await fs.writeFile(path.join(dir,'scripts',f),content);}await fs.mkdir(path.join(dir,'docs'),{recursive:true});await fs.copyFile('docs/platforms.md',path.join(dir,'docs/platforms.md'));};
const local=path.join(out,'local-mcp');await copy(local);
// configure-client.mjs is written for the source tree. Point its release copy at the package root.
let config=await fs.readFile(path.join(local,'scripts/configure-client.mjs'),'utf8');config=config.replace("path.join(root,'plugin/server.mjs')","path.join(root,'server.mjs')");await fs.writeFile(path.join(local,'scripts/configure-client.mjs'),config);
await fs.copyFile('docs/platforms.md',path.join(local,'INSTALL.md'));
const manifest=JSON.parse(await fs.readFile('plugin/plugin.json','utf8'));
const archive=(dir,name)=>execFileSync(process.env.PYTHON??'python',['scripts/archive-release.py',dir,path.join(out,name)],{stdio:'inherit'});
archive(local,`shorelineops-local-mcp-${version}.zip`);
const claude=path.join(out,'claude-desktop');await copy(claude);
await fs.writeFile(path.join(claude,'manifest.json'),JSON.stringify({manifest_version:'0.3',name:'shorelineops',display_name:'ShorelineOps',version,description:'Review facility menus and counts, then print kitchen paperwork.',author:{name:'CulinaryOS'},icon:'assets/shorelineops-icon.png',server:{type:'node',entry_point:'server.mjs',mcp_config:{command:'node',args:['${__dirname}/server.mjs'],env:{SHORELINEOPS_IMPORT_DIR:'${user_config.import_directory}'}}},tools_generated:true,compatibility:{platforms:['win32','darwin','linux'],runtimes:{node:'>=22'}},user_config:{import_directory:{type:'directory',title:'Menu import folder',description:'A dedicated folder for redacted menus and tally scans; never select the home folder or a disk root.',required:true}}},null,2)+'\n');
await fs.writeFile(path.join(claude,'SETUP.md'),'Install the local renderer first: run node setup.mjs from the extracted local-MCP package. Then install this extension and select your redacted menu import folder. Host UI/marketplace acceptance remains separate.\n');
archive(claude,`shorelineops-${version}.mcpb`);
const publicDir=path.join(out,'chatgpt-public-candidate');await copy(publicDir);
const publicManifest=JSON.parse(JSON.stringify(manifest));publicManifest.extensions['com.openai'].interface.defaultPrompt=['Set up my facility and service areas.','Check this menu and show what needs fixing.','Make today’s cook sheets.'];
await fs.writeFile(path.join(publicDir,'plugin.json'),JSON.stringify(publicManifest,null,2)+'\n');
const overlay=JSON.parse(await fs.readFile(path.join(publicDir,'.codex-plugin/plugin.json'),'utf8'));overlay.interface=publicManifest.extensions['com.openai'].interface;await fs.writeFile(path.join(publicDir,'.codex-plugin/plugin.json'),JSON.stringify(overlay,null,2)+'\n');
archive(publicDir,`shorelineops-chatgpt-candidate-${version}.zip`);
const artifacts=[];for(const name of await fs.readdir(out)){if(/\.(zip|mcpb)$/.test(name)){const bytes=await fs.readFile(path.join(out,name));artifacts.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}
await fs.writeFile(path.join(out,'release-manifest.json'),JSON.stringify({version,publisher:'CulinaryOS',free:true,countries:'all supported',artifacts,readiness:{codex:'Local package; installed MCP smoke tests required',claude:'MCPB built; client UI and directory review not run',vscode:'Config generator built; actual VS Code UI acceptance not run',chatgpt:'Public candidate only: URLs, hosted/supported execution, demo and owner attestations pending'}},null,2)+'\n');console.log(JSON.stringify({out,artifacts},null,2));
