import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport,getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { makeValidMenu,field } from './helpers.js';
import { CampusProfileSchema } from '../src/campus/index.js';
import { buildRossWorksheetHtml,renderRossWorksheetPdf,countPdfPages } from '../src/renderer/index.js';

test('new facility onboarding is neutral, confirmation-gated, persistent and protects existing setup',async t=>{
 const state=await fs.mkdtemp(path.join(os.tmpdir(),'shoreline-facility-')),root=process.env.SYLVIA_PLUGIN_ROOT??path.resolve('plugin');
 const client=new Client({name:'generic-facility-test',version:'1'},{capabilities:{}}),transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'server.mjs')],cwd:root,env:{...getDefaultEnvironment(),LOCALAPPDATA:process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),SHORELINEOPS_DATA_DIR:state,SHORELINEOPS_IMPORT_DIR:path.join(state,'imports')},stderr:'pipe'});
 t.after(async()=>{await client.close();await fs.rm(state,{recursive:true,force:true});});await client.connect(transport);
 const call=(name:string,args:Record<string,unknown>={})=>client.callTool({name,arguments:args});
 const ok=async(name:string,args:Record<string,unknown>={})=>{const r=await call(name,args);assert.equal(r.isError,undefined,JSON.stringify(r));return r;};
 const data=(r:Awaited<ReturnType<typeof call>>)=>r.structuredContent as Record<string,unknown>;
 const status=await ok('shoreline_status');assert.equal(data(status).display_name,'ShorelineOps');
 assert.equal((await call('packet_generate')).isError,true,'No menu defaults to the historical example');
 assert.equal((await call('menu_export')).isError,true,'Example export must be explicit');
 const before=await ok('campus_review');assert.equal(data(before).setup_required,true);assert.deepEqual(data(before).available_menus,[]);
 const importedBeforeSetup=makeValidMenu();importedBeforeSetup.facility='custom_before_setup';importedBeforeSetup.metadata.facility=field('Custom area','Custom area','synthetic facility');await fs.mkdir(path.join(state,'menus'));await fs.writeFile(path.join(state,'menus',`menu-${'a'.repeat(64)}.json`),JSON.stringify(importedBeforeSetup));
 assert.equal(data(await ok('campus_review')).setup_required,true,'Generic saved menus must not imply the historical Ross facility');
 const setup={facility_name:'SYNTHETIC Cedar Facility',areas:[{id:'cedar_east',name:'Cedar East'},{id:'cedar_west',name:'Cedar West'}]};
 const draft=await ok('facility_setup',setup);assert.equal(data(draft).configured,false);assert.equal(data(await ok('campus_review')).setup_required,true);
 const duplicate={...setup,confirmed_by:'SYNTHETIC reviewer',areas:[setup.areas[0],setup.areas[0]],confirmed:true};assert.equal((await call('facility_setup',duplicate)).isError,true);
 assert.equal((await call('facility_setup',{...setup,confirmed:true})).isError,true,'Saving needs a confirmer');
 await ok('facility_setup',{...setup,confirmed:true,confirmed_by:'SYNTHETIC reviewer'});const saved=JSON.parse(await fs.readFile(path.join(state,'campus.json'),'utf8'));assert.equal(saved.name,setup.facility_name);assert.equal(saved.sharedMenus.length,0);assert.equal(saved.workAreas.length,0);
 assert.equal((await call('facility_setup',{...setup,facility_name:'overwrite',confirmed:true,confirmed_by:'SYNTHETIC reviewer'})).isError,true);
 await fs.mkdir(path.join(state,'imports'));const image=path.join(state,'imports','synthetic.png');await fs.writeFile(image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=','base64'));
 const {source:_source,approval:_approval,...menu}=makeValidMenu();menu.facility='cedar_east';menu.metadata.facility=field('Cedar East','Cedar East','synthetic facility');
 const privacy_review={source_content_reviewed:true,source_filename_reviewed:true,resident_information_found:false};
 const outside=path.join(state,'outside.png');await fs.copyFile(image,outside);assert.equal((await call('menu_import',{source_path:outside,privacy_review,menu})).isError,true,'The import folder cannot expose adjacent files');
 const imported=await ok('menu_import',{source_path:image,privacy_review,menu}),menu_id=String(data(imported).menu_id);
 await ok('menu_approve',{menu_id,reviewer:'SYNTHETIC',confirmed_all_42_options:true});
 const packet=await ok('packet_generate',{menu_id,resident_area_id:'cedar_east',packet:'weekly',preview:false});assert.equal(JSON.parse((packet.content as {text:string}[])[0]!.text).pages,2);
 assert.equal((await call('packet_generate',{menu_id,resident_area_id:'cedar_west',preview:false})).isError,true);
 const blank=await ok('ross_worksheet_generate',{resident_area_id:'cedar_east',date:'2026-10-25',format:'prep-list',preview:false});assert.equal(JSON.parse((blank.content as {text:string}[])[0]!.text).pages,1);
});

test('generic prep sheet stays selected-area only, escaped and one Letter page',async()=>{
 const profile=CampusProfileSchema.parse({schemaVersion:1,name:'Cedar',status:'confirmed',confirmedBy:'SYNTHETIC',source:'Synthetic test',residentAreas:[{id:'cedar',name:'Cedar <East>',active:true},{id:'west',name:'West',active:true}],kitchens:[],workAreas:[],sharedMenus:[]});
 const html=buildRossWorksheetHtml(profile,'cedar','2026-10-25','prep-list',false);assert.match(html,/<th>Qty<\/th>/);assert.match(html,/Cedar &lt;East&gt;/);assert.doesNotMatch(html,/<th>Ross|<th>Sylvia|<th>EP/);
 const state=await fs.mkdtemp(path.join(os.tmpdir(),'shoreline-generic-prep-'));try{const pdf=path.join(state,'prep.pdf');await renderRossWorksheetPdf(profile,'cedar','2026-10-25','prep-list',false,pdf);assert.equal(await countPdfPages(pdf),1);}finally{await fs.rm(state,{recursive:true,force:true});}
});
