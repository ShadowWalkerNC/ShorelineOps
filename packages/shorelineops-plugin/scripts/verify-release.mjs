import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport,getDefaultEnvironment} from '@modelcontextprotocol/sdk/client/stdio.js';
const version=JSON.parse(await fs.readFile('package.json','utf8')).version,out=path.resolve('output/release-'+version),temp=await fs.mkdtemp(path.join(os.tmpdir(),'shoreline-release-')),evidence=[];
const extract=(name,dir)=>execFileSync(process.env.PYTHON??'python',['-c',`from pathlib import Path
import sys,zipfile
archive=Path(sys.argv[1]).resolve();target=Path(sys.argv[2]).resolve()
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for name in z.namelist():
  assert (target/name).resolve().is_relative_to(target)
 z.extractall(target)
`,path.join(out,name),dir]);
async function smoke(label,root,config){
 const state=path.join(temp,label+'-state'),client=new Client({name:'release-check',version:'1'},{capabilities:{}}),transport=new StdioClientTransport({command:config.command,args:config.args,cwd:root,env:{...getDefaultEnvironment(),...config.env,SHORELINEOPS_DATA_DIR:state,LOCALAPPDATA:process.env.LOCALAPPDATA??path.join(os.homedir(),'AppData','Local')},stderr:'pipe'});
 try{await client.connect(transport);assert.equal(client.getServerVersion().version,version);const tools=await client.listTools();for(const tool of tools.tools)for(const field of ['readOnlyHint','openWorldHint','destructiveHint'])assert.equal(typeof tool.annotations?.[field],'boolean');
 const status=await client.callTool({name:'shoreline_status',arguments:{}});assert.equal(status.isError,undefined);assert.equal(status.structuredContent.display_name,'ShorelineOps');const campus=await client.callTool({name:'campus_review',arguments:{}});assert.equal(campus.structuredContent.setup_required,true);evidence.push({client:label,result:'PASS',tools:tools.tools.length,scope:'packaged MCP launch/discovery, not actual host UI/store acceptance'});
 }finally{await client.close();}
}
try{
 const local=path.join(temp,'local');extract(`shorelineops-local-mcp-${version}.zip`,local);
 for(const client of ['claude','vscode']){const file=path.join(temp,client+'.json');execFileSync(process.execPath,[path.join(local,'scripts/configure-client.mjs'),client,file,path.join(temp,'imports')]);const value=JSON.parse(await fs.readFile(file,'utf8')),server=(client==='claude'?value.mcpServers:value.servers).shorelineops;assert.equal(server.args[0],path.join(local,'server.mjs'));await smoke(client,local,server);}
 const claude=path.join(temp,'mcpb');extract(`shorelineops-${version}.mcpb`,claude);const m=JSON.parse(await fs.readFile(path.join(claude,'manifest.json'),'utf8'));await smoke('mcpb',claude,{command:process.execPath,args:m.server.mcp_config.args.map(a=>a.replaceAll('${__dirname}',claude)),env:{SHORELINEOPS_IMPORT_DIR:path.join(temp,'imports')}});
 const pub=path.join(temp,'public');extract(`shorelineops-chatgpt-candidate-${version}.zip`,pub);const p=JSON.parse(await fs.readFile(path.join(pub,'plugin.json'),'utf8')),o=p.extensions['com.openai'];assert.equal(o.interface.defaultPrompt.length,3);assert.equal(o.review.test_cases.positive.length,5);assert.equal(o.review.test_cases.negative.length,3);assert.equal(p.author.name,'CulinaryOS');assert.equal(o.review.commerce,false);assert.deepEqual(o.publication.countries,[]);assert.equal(p.apps,undefined);assert.equal(o.apps,undefined);
 const original=await fs.readFile('../../public/icon-512.png');assert.equal(createHash('sha256').update(await fs.readFile(path.join(pub,o.interface.logo))).digest('hex'),createHash('sha256').update(original).digest('hex'));evidence.push({client:'chatgpt-public-candidate',result:'PASS package structure only',submissionReady:false,remaining:'verified liveURLs, supported execution/connection, intended-host recording/review, verified publisher and owner attestations'});
 await fs.writeFile('output/v0.13-release-check.json',JSON.stringify({version,evidence},null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{await fs.rm(temp,{recursive:true,force:true});}
