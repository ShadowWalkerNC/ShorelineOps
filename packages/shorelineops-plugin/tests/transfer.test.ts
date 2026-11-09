import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeValidMenu } from './helpers.js';
import { createScan,confirmScan } from '../src/production/scans.js';
import { createTransfer,readTransfer } from '../src/integration/transfer.js';
test('Shoreline transfer normalizes paths and clears approval while retaining evidence',()=>{
 const bytes=Buffer.from('%PDF-synthetic-source'),menu=makeValidMenu();menu.source.sha256=createHash('sha256').update(bytes).digest('hex');
 const transfer=createTransfer(menu,bytes),parsed=readTransfer(transfer);
 assert.equal(parsed.menu.approval,null);assert.equal(parsed.menu.source.file,'menu-source.pdf');
 assert.equal(parsed.menu.days[0]!.meals.breakfast.a.text.originalText,menu.days[0]!.meals.breakfast.a.text.originalText);
 assert.deepEqual(parsed.bytes,bytes);assert.equal(JSON.stringify(transfer).includes('tests/fixtures'),false);
 const bad=structuredClone(transfer);bad.source.base64=Buffer.from('%PDF-tampered').toString('base64');assert.throws(()=>readTransfer(bad));
 const paths=structuredClone(transfer);paths.menu.source.file='C:/private/source.pdf';assert.throws(()=>readTransfer(paths));
 assert.throws(()=>readTransfer({...transfer,resident:'forbidden'}));
});

test('count transfer preserves evidence, rebinds normalized menu and refuses unsafe counts',()=>{
 const bytes=Buffer.from('%PDF-synthetic-source'),scanBytes=Buffer.from('%PDF-synthetic-tally'),menu=makeValidMenu();menu.source.sha256=createHash('sha256').update(bytes).digest('hex');
 const field=(value:number)=>({originalText:String(value),value,confidence:0.99,needsReview:false,cell:'day/meal/choice'});
 const meal=()=>({a:field(0),b:field(12)});
 const scan=createScan({kind:'tally',scope:'day',days:[{date:menu.startDate,meals:{breakfast:meal(),lunch:meal(),dinner:meal()}}]},menu,'test',menu.facility,{file:'private-tally.pdf',sha256:createHash('sha256').update(scanBytes).digest('hex')});
 assert.throws(()=>createTransfer(menu,bytes,{record:scan,bytes:scanBytes}));
 const approved=confirmScan(scan,'synthetic'),transfer=createTransfer(menu,bytes,{record:approved,bytes:scanBytes}),parsed=readTransfer(transfer);
 assert.equal(transfer.version,2);assert.equal(parsed.menu.approval,null);assert.equal(parsed.countReview?.counts.days[menu.startDate]?.breakfast.a,0);
 assert.equal(JSON.stringify(transfer).includes('private-tally'),false);assert.equal(JSON.stringify(transfer).includes('synthetic"'),false);
 const wrongArea=structuredClone(transfer);wrongArea.counts!.areaId='ross_manor';assert.throws(()=>readTransfer(wrongArea));
 const changedMenu=structuredClone(transfer);changedMenu.menu.days[0]!.meals.breakfast.a.text.confidence=0.8;assert.throws(()=>readTransfer(changedMenu));
 const wrongSource=structuredClone(transfer);wrongSource.counts!.source.base64=bytes.toString('base64');assert.throws(()=>readTransfer(wrongSource));
 const uncertain=structuredClone(transfer);if(uncertain.counts!.input.kind==='tally')uncertain.counts!.input.days[0]!.meals.breakfast.a.needsReview=true;assert.throws(()=>readTransfer(uncertain));
 const legacy=structuredClone(transfer);legacy.version=1;assert.throws(()=>readTransfer(legacy));
});

test('anonymous choices transfer aggregates only this batch and refuses missing choices',()=>{
 const bytes=Buffer.from('%PDF-synthetic-menu'),scanBytes=Buffer.from('%PDF-anonymous-choices'),menu=makeValidMenu();menu.source.sha256=createHash('sha256').update(bytes).digest('hex');
 const choice=(value:'a'|'b',cell:string)=>({originalText:value,value,confidence:null,needsReview:false,cell});
 const sheets=([0,1] as const).map(index=>({days:[{date:menu.startDate,meals:{breakfast:choice('a',`page${index}/breakfast`),lunch:choice('b',`page${index}/lunch`),dinner:choice('a',`page${index}/dinner`)}}]}));
 const scan=confirmScan(createScan({kind:'selections',scope:'day',sheets},menu,'test',menu.facility,{file:'anonymous.pdf',sha256:createHash('sha256').update(scanBytes).digest('hex')}),'synthetic');
 const transfer=createTransfer(menu,bytes,{record:scan,bytes:scanBytes}),parsed=readTransfer(transfer);
 assert.equal(parsed.countReview?.counts.days[menu.startDate]?.breakfast.a,2);assert.equal(parsed.countReview?.counts.days[menu.startDate]?.lunch.b,2);
 const bad=structuredClone(transfer);if(bad.counts!.input.kind==='selections')bad.counts!.input.sheets[0]!.days[0]!.meals.dinner.value='missing';assert.throws(()=>readTransfer(bad));
});
