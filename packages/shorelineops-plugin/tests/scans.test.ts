import test from 'node:test';
import assert from 'node:assert/strict';
import { makeValidMenu } from './helpers.js';
import { createScan,correctScan,confirmScan,countsFromScan,scanIssues,scanOverview,type ScanInput } from '../src/production/scans.js';
import { buildPacketHtml,countPacketPages,renderPdfFromHtml,countPdfPages } from '../src/renderer/index.js';
import { combinePackets } from '../src/renderer/combined.js';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const field=(value:number|null,confidence:number|null=0.99)=>({originalText:value===null?'blank':String(value),value,confidence,needsReview:false,cell:'synthetic row'});
function tally():ScanInput{const meal=()=>({a:field(0),b:field(12),staff:field(2),extra:field(1),expected:field(12)});return {kind:'tally',scope:'day',days:[{date:'2026-10-25',meals:{breakfast:meal(),lunch:meal(),dinner:meal()}}]};}
const context=()=>({menu:makeValidMenu(),source:{file:'synthetic.png',sha256:'a'.repeat(64)}});
test('counts preserve real zero, refuse unknowns and never allocate staff/extras to choices',()=>{
 const {menu,source}=context(),scan=createScan(tally(),menu,'week-1-example','sylvia_ross',source);
 assert.equal(scanIssues(scan.input).length,0);assert.throws(()=>countsFromScan(scan,menu,'sylvia_ross'));
 const confirmed=confirmScan(scan,'synthetic'),counts=countsFromScan(confirmed,menu,'sylvia_ross','2026-10-25');
 assert.deepEqual(counts.days['2026-10-25']!.lunch,{a:0,b:12,staff:2,extra:1});
 const unknown=tally();if(unknown.kind==='tally')unknown.days[0]!.meals.lunch.a.value=null;
 assert.throws(()=>confirmScan(createScan(unknown,menu,'week-1-example','sylvia_ross',source),'synthetic'));
 assert.throws(()=>countsFromScan(confirmed,menu,'ross_manor'));assert.throws(()=>countsFromScan(confirmed,menu,'sylvia_ross','2026-10-26'));
});
test('low confidence, total mismatches, corrections and stale menus require new confirmation',()=>{
 const {menu,source}=context(),input=tally();if(input.kind!=='tally')throw new Error();input.days[0]!.meals.lunch.b.confidence=.61;
 const scan=createScan(input,menu,'week-1-example','sylvia_ross',source);assert.ok(scanIssues(scan.input).some(issue=>issue.code==='uncertain'));assert.throws(()=>confirmScan(scan,'synthetic'));
 const fixed=correctScan(scan,[{path:'days[0].meals.lunch.b',value:12}]);assert.equal(fixed.confirmation,null);assert.notEqual(fixed.id,scan.id);
 if(fixed.input.kind==='tally'){assert.equal(fixed.input.days[0]!.meals.lunch.b.originalText,'12');assert.equal(fixed.input.days[0]!.meals.lunch.b.confidence,.61);}
 const confirmed=confirmScan(fixed,'synthetic');const changed=structuredClone(menu);changed.week=2;assert.throws(()=>countsFromScan(confirmed,changed,'sylvia_ross'));
 const mismatch=correctScan(confirmed,[{path:'days[0].meals.lunch.a',value:1}]);assert.ok(scanIssues(mismatch.input).some(issue=>issue.code==='total_mismatch'));assert.throws(()=>confirmScan(mismatch,'synthetic'));
 assert.throws(()=>correctScan(scan,[{path:'__proto__.value',value:3}]));
});
test('redacted anonymous selections flag blanks and both marks instead of guessing',()=>{
 const {menu,source}=context(),choice=(value:'a'|'b'|'missing'|'ambiguous')=>({originalText:value,value,confidence:.99,needsReview:false,cell:'synthetic choice'});
 const input:ScanInput={kind:'selections',scope:'day',sheets:[{days:[{date:'2026-10-25',meals:{breakfast:choice('a'),lunch:choice('missing'),dinner:choice('ambiguous')}}]}]};
 const scan=createScan(input,menu,'week-1-example','sylvia_ross',source);assert.deepEqual(scanIssues(scan.input).map(issue=>issue.code),['missing_selection','ambiguous_selection']);assert.throws(()=>confirmScan(scan,'synthetic'));
 assert.equal(scanOverview(scan.input)[0]!.meals.lunch!.missing,1);assert.equal(scanOverview(scan.input)[0]!.meals.dinner!.ambiguous,1);
 const fixed=correctScan(scan,[{path:'sheets[0].days[0].meals.lunch',value:'b'},{path:'sheets[0].days[0].meals.dinner',value:'a'}]);
 assert.deepEqual(countsFromScan(confirmScan(fixed,'synthetic'),menu,'sylvia_ross').days['2026-10-25']!.lunch,{a:0,b:1});
 const wrong=tally();if(wrong.kind==='tally')wrong.days[0]!.date='2026-11-01';assert.throws(()=>createScan(wrong,menu,'week-1-example','sylvia_ross',source));
  const duplicate=structuredClone(input);if(duplicate.kind==='selections')duplicate.sheets.push(structuredClone(duplicate.sheets[0]!));assert.throws(()=>createScan(duplicate,menu,'week-1-example','sylvia_ross',source),/Duplicate source-sheet/);
});
test('confirmed count rendering and area compilation preserve page contracts',async()=>{
 const {menu,source}=context(),counts=countsFromScan(confirmScan(createScan(tally(),menu,'week-1-example','sylvia_ross',source),'synthetic'),menu,'sylvia_ross');
 const html=buildPacketHtml(menu,{preview:true,selection:{kind:'daily',date:'2026-10-25',extras:['summary']},counts});
 assert.match(html,/Count <span class="blank-line">0<\/span>/);assert.match(html,/Count <span class="blank-line">12<\/span>/);assert.equal(countPacketPages(html),4);
 const combined=combinePackets([{areaId:'one',startDate:menu.startDate,html},{areaId:'two',startDate:menu.startDate,html}]);assert.equal(countPacketPages(combined),8);
 assert.throws(()=>combinePackets([{areaId:'one',startDate:menu.startDate,html},{areaId:'one',startDate:menu.startDate,html}]));
 assert.throws(()=>combinePackets([{areaId:'one',startDate:menu.startDate,html},{areaId:'two',startDate:'2026-11-01',html}]));
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ross-combined-'));try{const pdf=path.join(directory,'combined.pdf');await renderPdfFromHtml(combined,pdf);assert.equal(await countPdfPages(pdf),8);}finally{await fs.rm(directory,{recursive:true,force:true});}
});
