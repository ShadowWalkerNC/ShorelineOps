import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { ScanStore } from '../src/plugin/scan-store.js';
import { createScan,confirmScan,type ScanInput } from '../src/production/scans.js';
import { makeValidMenu } from './helpers.js';
test('scan store sorts recent records and rejects tampered confirmation, outside sources and blocked copies',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'scan-store-'));
 try{
  const store=new ScanStore(directory),bytes=Buffer.from('%PDF-synthetic'),sha256=createHash('sha256').update(bytes).digest('hex');await fs.mkdir(path.join(directory,'sources'));const file=path.join(directory,'sources',`${sha256}.pdf`);await fs.writeFile(file,bytes);
  const field={originalText:'1',value:1,confidence:.99,needsReview:false,cell:'synthetic'},meal={a:field,b:field};
  const input:ScanInput={kind:'tally',scope:'day',days:[{date:'2026-10-25',meals:{breakfast:meal,lunch:meal,dinner:meal}}]};
  const first=confirmScan(createScan(input,makeValidMenu(),'week-1-example','sylvia_ross',{file,sha256}),'SYNTHETIC');first.createdAt='2026-10-25T01:00:00Z';await store.write(first);
  const second=confirmScan(createScan(input,makeValidMenu(),'week-1-example','ross_manor',{file,sha256}),'SYNTHETIC');second.createdAt='2026-10-24T01:00:00Z';await store.write(second);
  assert.equal((await store.all())[1]!.id,first.id);await store.confirmedFingerprint(first.id);
  const tampered=structuredClone(first);if(tampered.input.kind==='tally')tampered.input.days[0]!.meals.lunch.a.value=2;await store.write(tampered);await assert.rejects(store.confirmedFingerprint(first.id));
  await store.write(first);const outside=path.join(directory,`${sha256}.pdf`);await fs.writeFile(outside,bytes);await assert.rejects(store.assertSourceAllowed({...first,source:{file:outside,sha256}}));
  await store.block(first.id);await assert.rejects(store.assertSourceAllowed(second));
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('only an explicit successor chain relates changed menus',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'menu-chain-'));try{
  const store=new ScanStore(directory),one=`menu-${'1'.repeat(64)}`,two=`menu-${'2'.repeat(64)}`,three=`menu-${'3'.repeat(64)}`;
  assert.equal(await store.isMenuSuccessor(one,two),false);await store.supersede('menus',one,two);await store.supersede('menus',two,three);
  assert.equal(await store.isMenuSuccessor(one,three),true);await assert.rejects(store.assertCurrentMenu(one));
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
