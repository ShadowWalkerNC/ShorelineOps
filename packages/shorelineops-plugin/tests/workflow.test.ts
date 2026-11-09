import test from 'node:test';
import assert from 'node:assert/strict';
import { makeValidMenu } from './helpers.js';
import { correctMenu, privacyFingerprint, requirePrivate, readiness } from '../src/plugin/workflow.js';
import { menuContentHash } from '../src/validation/index.js';
test('privacy attestation fails closed for every incomplete or unsafe review',()=>{
 for(const source_content_reviewed of [false,true])for(const source_filename_reviewed of [false,true])for(const resident_information_found of [false,true]){
  const review={source_content_reviewed,source_filename_reviewed,resident_information_found};
  if(source_content_reviewed&&source_filename_reviewed&&!resident_information_found)assert.doesNotThrow(()=>requirePrivate(review));
  else assert.throws(()=>requirePrivate(review),/Privacy review/);
 }
});
test('privacy fingerprint ignores install paths but binds transcription and source bytes',()=>{
 const menu=makeValidMenu(),copy=structuredClone(menu);
 copy.source.file='different-install';
 assert.equal(privacyFingerprint(menu),privacyFingerprint(copy));
 copy.source.sha256='a'.repeat(64);assert.notEqual(privacyFingerprint(menu),privacyFingerprint(copy));
});
test('corrections preserve extraction evidence and always create fresh unapproved revisions',()=>{
 const menu=makeValidMenu();menu.approval={reviewer:'synthetic',approvedAt:new Date().toISOString(),menuHash:menuContentHash(menu)};
 const original=structuredClone(menu.days[0]!.meals.breakfast.a.items[0]!.text);
 const changes=[{field:'days[0].meals.breakfast.a.items[0].text',value:'Synthetic replacement',needs_review:false}];
 const one=correctMenu(menu,changes,'synthetic-parent'),two=correctMenu(menu,changes,'synthetic-parent');
 assert.equal(one.approval,null);assert.notEqual(menuContentHash(one),menuContentHash(two));
 const field=one.days[0]!.meals.breakfast.a.items[0]!.text;
 assert.equal(field.originalText,original.originalText);assert.equal(field.confidence,original.confidence);assert.deepEqual(field.source,original.source);
 assert.match(one.days[0]!.meals.breakfast.a.text.value,/Synthetic replacement/);
 assert.throws(()=>correctMenu(menu,[{field:'__proto__.value',value:'bad',needs_review:false}],'parent'));
 assert.throws(()=>correctMenu(menu,[{field:'approval',value:'bad',needs_review:false}],'parent'));
});
test('readiness distinguishes review readiness from production approval',()=>{
 const menu=makeValidMenu();assert.equal(readiness(menu,true).ready_for_approval,true);assert.equal(readiness(menu,true).ready_for_production,false);
 menu.approval={reviewer:'synthetic',approvedAt:new Date().toISOString(),menuHash:menuContentHash(menu)};
 assert.equal(readiness(menu,true).ready_for_production,true);assert.equal(readiness(menu,false).ready_for_production,false);
 menu.days[0]!.date.needsReview=true;assert.equal(readiness(menu,true).ready_for_approval,false);
});
