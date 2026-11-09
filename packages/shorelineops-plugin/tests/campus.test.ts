import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CampusProfileSchema, resolveResidentArea, type CampusProfile } from '../src/campus/index.js';
import { buildPacketHtml, buildWorkAreaHtml, renderPreview, renderWorkArea, countPdfPages } from '../src/renderer/index.js';
import { validateMenu, listUnresolvedFields, menuContentHash } from '../src/validation/index.js';
import { makeValidMenu, textField } from './helpers.js';
function profile():CampusProfile {
 return CampusProfileSchema.parse({schemaVersion:1,name:'SYNTHETIC CAMPUS',status:'confirmed',confirmedBy:'SYNTHETIC TEST ONLY',source:'Synthetic test fixture, not real operations',residentAreas:[{id:'sylvia_ross',name:'Sylvia Ross',active:true},{id:'ross_manor',name:'Ross Manor',active:true},{id:'engel_place',name:'Engel Place',active:true},{id:'custom_wing',name:'Custom <Wing>',active:true}],kitchens:[{id:'test_kitchen',name:'Synthetic Kitchen',active:true}],workAreas:[{id:'hot',name:'Synthetic Hot',kitchenId:'test_kitchen',kind:'hot',active:true},{id:'prep',name:'Synthetic Prep',kitchenId:'test_kitchen',kind:'prep',active:true}],sharedMenus:[]});
}
test('campus accepts additional wings and validates kitchen/work-area references and duplicate IDs',()=>{
 const campus=profile();
 assert.equal(campus.residentAreas.length,4);
 assert.equal(CampusProfileSchema.safeParse({...campus,residentAreas:[...campus.residentAreas,campus.residentAreas[0]]}).success,false);
 assert.equal(CampusProfileSchema.safeParse({...campus,workAreas:[{...campus.workAreas[0],kitchenId:'missing'}]}).success,false);
 assert.equal(CampusProfileSchema.safeParse({...campus,confirmedBy:null}).success,false);
 assert.equal(CampusProfileSchema.safeParse({...campus,workAreas:[{...campus.workAreas[0],kind:'dishroom'}]}).success,false,'Non-meal operations are outside this extension');
});
test('each new area requires source-bearing facility metadata and participates in review tracking',()=>{
 for(const area of ['ross_manor','engel_place','custom_wing']) {
  const menu=makeValidMenu(); menu.facility=area;
  assert.equal(validateMenu(menu).ok,false);
  menu.metadata.facility=textField(`Source header for ${area}`,'source heading');
  assert.equal(validateMenu(menu).ok,true);
  menu.metadata.facility.needsReview=true;
  assert.ok(listUnresolvedFields(menu).includes('metadata.facility'));
  menu.metadata.facility.source.file='wrong-source.jpg';
  assert.equal(validateMenu(menu).ok,false);
 }
});
test('unconfirmed menu sharing and stale sharing are rejected across resident areas',()=>{
 const menu=makeValidMenu(), campus=profile();
 assert.throws(()=>resolveResidentArea(menu,{profile:campus,residentAreaId:'ross_manor'},true),/not assigned/);
 campus.sharedMenus=[{menuHash:menuContentHash(menu),residentAreaIds:['ross_manor'],confirmedBy:'SYNTHETIC TEST ONLY'}];
 assert.equal(resolveResidentArea(menu,{profile:campus,residentAreaId:'ross_manor'},true).shared,true);
 assert.throws(()=>resolveResidentArea(menu,{profile:{...campus,status:'draft'},residentAreaId:'ross_manor'},true),/not assigned/);
 menu.metadata.week.originalText='Altered evidence';
 assert.throws(()=>resolveResidentArea(menu,{profile:campus,residentAreaId:'ross_manor'},true),/not assigned/);
});
test('native wings print their own headings and keep small packet defaults',()=>{
 for(const [id,name] of [['ross_manor','Ross Manor'],['engel_place','Engel Place'],['custom_wing','Custom <Wing>']]) {
  const menu=makeValidMenu(); menu.facility=id!; menu.metadata.facility=textField(name!,'original facility header');
  const campus=profile(), scope={profile:campus,residentAreaId:id!};
  const html=buildPacketHtml(menu,{preview:true,scope});
  assert.equal((html.match(/data-sheet=/g)||[]).length,2);
  assert.ok(!html.includes('SYLVIA ROSS HOME'));
  assert.ok(html.includes(name!.replace('<','&lt;').replace('>','&gt;')));
 }
});
test('explicitly shared headings identify both target wing and original menu source without altering approval',()=>{
 const menu=makeValidMenu(), campus=profile(), hash=menuContentHash(menu);
 campus.sharedMenus=[{menuHash:hash,residentAreaIds:['ross_manor'],confirmedBy:'SYNTHETIC TEST ONLY'}];
 const html=buildPacketHtml(menu,{preview:true,scope:{profile:campus,residentAreaId:'ross_manor'}});
 assert.ok(html.includes('class="facility">Ross Manor'));
 assert.ok(html.includes('Shared menu source: Sylvia Ross Home'));
 assert.equal(menuContentHash(menu),hash);
 assert.equal(menu.approval,null);
});
test('unknown/inactive areas and draft configuration cannot silently enter production',()=>{
 const menu=makeValidMenu(), campus=profile();
 assert.throws(()=>resolveResidentArea(menu,{profile:campus,residentAreaId:'missing'},true),/Unknown/);
 campus.residentAreas[0]!.active=false;
 assert.throws(()=>resolveResidentArea(menu,{profile:campus,residentAreaId:'sylvia_ross'},true),/inactive/);
 assert.throws(()=>resolveResidentArea(menu,{profile:{...profile(),status:'draft'},residentAreaId:'sylvia_ross'},false),/confirmation/);
});
test('work logs cover all configured kitchen kinds without adding menu items, tasks or safety limits',()=>{
 for(const kind of ['hot','cold','pull','prep','dessert','bakery','other'] as const) {
  const campus=profile(); campus.workAreas=[{id:kind,name:`Synthetic ${kind}`,kind,kitchenId:'test_kitchen',active:true}];
  const html=buildWorkAreaHtml(campus,kind,'2026-10-25',true);
  assert.equal((html.match(/data-sheet=/g)||[]).length,1);
  assert.ok(html.includes('K-09')&&html.includes(`Synthetic ${kind}`));
  assert.ok(!html.includes('Oatmeal')&&!html.includes('checkbox')&&!html.includes('165'));
 }
 assert.throws(()=>buildWorkAreaHtml(profile(),'missing','2026-10-25',true),/Unknown/);
 assert.throws(()=>buildWorkAreaHtml(profile(),'hot','2026-02-30',true),/real/);
 assert.throws(()=>buildWorkAreaHtml({...profile(),status:'draft'},'hot','2026-10-25',false),/confirmation/);
});
test('native-area weekly and kitchen work-area PDFs keep 2-page and 1-page print contracts',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'campus-print-'));
 t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const menu=makeValidMenu(); menu.facility='ross_manor'; menu.metadata.facility=textField('Ross Manor','original facility header');
 const weekly=path.join(directory,'weekly.pdf');
 await renderPreview(menu,process.cwd(),weekly,path.join(directory,'weekly.html'),{kind:'weekly'},{profile:profile(),residentAreaId:'ross_manor'});
 assert.equal(await countPdfPages(weekly),2);
 const work=path.join(directory,'work.pdf');
 await renderWorkArea(profile(),'prep','2026-10-25',true,work);
 assert.equal(await countPdfPages(work),1);
});
test('confirmed resident areas remain independent of unconfirmed kitchen structure',()=>{
 const menu=makeValidMenu();
 const campus={...profile(),status:'draft' as const,residentAreasConfirmedBy:'SYNTHETIC TEST ONLY'};
 assert.equal(resolveResidentArea(menu,{profile:campus,residentAreaId:'sylvia_ross'},false).area.id,'sylvia_ross');
 assert.throws(()=>buildWorkAreaHtml(campus,'hot','2026-10-25',false),/confirmation/);
});
