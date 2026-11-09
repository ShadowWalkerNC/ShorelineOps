import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CampusProfileSchema } from '../src/campus/index.js';
import { buildRossWorksheetHtml, renderRossWorksheetPdf, countPdfPages } from '../src/renderer/index.js';
const profile=CampusProfileSchema.parse(JSON.parse(await fs.readFile('fixtures/campus-profile.json','utf8')));
test('photo-derived blanks preserve sections without menu facts or resident/diet fields',()=>{
 const prep=buildRossWorksheetHtml(profile,'ross_manor','2026-10-29','prep-list',true);
 for(const label of ['Breakfast','Lunch','Dinner','Early pulls - section 1','Early pulls - section 2','<th>Ross</th>','<th>Sylvia</th>','<th>EP</th>','Initials'])assert.ok(prep.includes(label),label);
 assert.ok(!prep.includes('10AM'));assert.ok(!prep.includes('type="checkbox"'));
 const service=buildRossWorksheetHtml(profile,'ross_manor','2026-10-29','meal-service',false);
 assert.ok(service.includes('Foods / accompaniments'));assert.ok(service.includes('Drinks'));
 assert.ok(!service.includes('Resident name'));assert.ok(!service.includes('Room'));assert.ok(!service.includes('CHICKEN'));
});
test('blank worksheet scopes are validated and headings escaped',()=>{
 assert.throws(()=>buildRossWorksheetHtml(profile,'missing','2026-10-29','prep-list',true));
 assert.throws(()=>buildRossWorksheetHtml(profile,'ross_manor','2026-02-30','prep-list',true));
 const custom=structuredClone(profile);custom.residentAreas[0]!.name='<script>test</script>';
 const html=buildRossWorksheetHtml(custom,custom.residentAreas[0]!.id,'2026-10-29','prep-list',true);
 assert.ok(html.includes('&lt;script&gt;test&lt;/script&gt;'));assert.ok(!html.includes('<script>'));
});
test('both blank worksheet formats print as one Letter page with normal renderer bounds checks',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ross-worksheets-'));
 try{for(const format of ['prep-list','meal-service'] as const){
  const file=path.join(directory,format+'.pdf');await renderRossWorksheetPdf(profile,'ross_manor','2026-10-29',format,true,file);
  assert.equal(await countPdfPages(file),1);
 }}finally{await fs.rm(directory,{recursive:true,force:true});}
});
