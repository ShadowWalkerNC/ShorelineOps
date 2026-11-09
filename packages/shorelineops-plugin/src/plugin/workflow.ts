import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { type Menu, type Field } from '../schema/index.js';
import { menuContentHash, validateMenu, listUnresolvedFields, assertApproved } from '../validation/index.js';

export const PrivacyReviewSchema = z.object({source_content_reviewed:z.boolean(),source_filename_reviewed:z.boolean(),resident_information_found:z.boolean()}).strict();
export type PrivacyReview = z.infer<typeof PrivacyReviewSchema>;
export function requirePrivate(review: PrivacyReview): void {
  if (!review.source_content_reviewed || !review.source_filename_reviewed || review.resident_information_found) throw new Error('Privacy review must pass for the source, filename and transcription. Use a redacted source; no identifying or clinical resident details may be stored.');
}
// A source-bound attestation is not an automatic image privacy classifier.
export function privacyFingerprint(menu: Menu): string {
  const copy=structuredClone(menu);
  const visit=(value:unknown):void=>{
    if(!value||typeof value!=='object')return;
    const object=value as Record<string,unknown>;
    if(object.source&&typeof object.source==='object'&&'file' in object.source) (object.source as {file:string}).file='source';
    for(const child of Object.values(object))visit(child);
  };
  visit(copy); copy.source.file='source';
  return menuContentHash(copy);
}
export function readiness(menu:Menu,privacy:boolean) {
  const flags=listUnresolvedFields(menu);
  let approved=false;try{assertApproved(menu);approved=true;}catch{/* Pending or stale. */}
  return {week:menu.week,start_date:menu.startDate,resident_area_id:menu.facility,days:menu.days.length,options:42,privacy:privacy?'pass':'pending_or_blocked',review_flags:flags.length,needs_review:flags,approved:approved&&privacy,ready_for_approval:privacy&&!flags.length,ready_for_production:privacy&&approved&&!flags.length};
}
export const CorrectionSchema=z.object({field:z.string().max(180),value:z.string().trim().min(1).max(2000),needs_review:z.boolean()}).strict();
export function correctMenu(menu:Menu,changes:z.infer<typeof CorrectionSchema>[],parent:string):Menu {
  const copy=structuredClone(menu);
  const fields=new Map<string,Field>();
  fields.set('metadata.week',copy.metadata.week);fields.set('metadata.startDate',copy.metadata.startDate);
  if(copy.metadata.facility)fields.set('metadata.facility',copy.metadata.facility);
  copy.days.forEach((day,di)=>{
    fields.set(`days[${di}].date`,day.date);
    for(const meal of ['breakfast','lunch','dinner'] as const)for(const option of ['a','b'] as const){
      const opt=day.meals[meal][option],prefix=`days[${di}].meals.${meal}.${option}`;
      fields.set(`${prefix}.text`,opt.text);
      opt.items.forEach((item,ii)=>fields.set(`${prefix}.items[${ii}].text`,item.text));
    }
  });
  const seen=new Set<string>();
  for(const change of changes){
    const field=fields.get(change.field);
    if(!field||seen.has(change.field))throw new Error('Correction field is unsupported or duplicated. Component structure changes require a new import.');
    seen.add(change.field);field.value=change.value;field.needsReview=change.needs_review;
  }
  copy.week=Number(copy.metadata.week.value);copy.startDate=copy.metadata.startDate.value;
  copy.days.forEach((day,di)=>{for(const meal of ['breakfast','lunch','dinner'] as const)for(const option of ['a','b'] as const){
    const opt=day.meals[meal][option],prefix=`days[${di}].meals.${meal}.${option}`;
    if(changes.some(change=>change.field.startsWith(`${prefix}.items[`))&&!seen.has(`${prefix}.text`))opt.text.value=opt.items.map(item=>item.text.value).join(', ');
  }});
  copy.approval=null;copy.revision={id:randomUUID(),parentMenuId:parent,createdAt:new Date().toISOString()};
  const valid=validateMenu(copy);if(!valid.ok)throw new Error('Corrections leave inconsistent menu data. Review dates, option text and component agreement.');
  return valid.menu;
}
