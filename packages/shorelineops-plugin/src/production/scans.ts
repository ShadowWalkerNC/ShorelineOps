import { z } from 'zod';
import { createHash,randomUUID } from 'node:crypto';
import type { Menu } from '../schema/index.js';
import { menuContentHash } from '../validation/index.js';
export const meals=['breakfast','lunch','dinner'] as const;
export const CountFieldSchema=z.object({originalText:z.string().min(1).max(200),value:z.number().int().min(0).max(9999).nullable(),confidence:z.number().min(0).max(1).nullable(),needsReview:z.boolean(),cell:z.string().min(1).max(150)}).strict();
const ChoiceFieldSchema=z.object({originalText:z.string().min(1).max(200),value:z.enum(['a','b','missing','ambiguous']),confidence:z.number().min(0).max(1).nullable(),needsReview:z.boolean(),cell:z.string().min(1).max(150)}).strict();
const countMeal=z.object({a:CountFieldSchema,b:CountFieldSchema,staff:CountFieldSchema.optional(),extra:CountFieldSchema.optional(),expected:CountFieldSchema.optional().describe('Explicit expected resident A+B choices only, excluding staff/extra. Unknown is not zero.')}).strict();
const countDay=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),meals:z.object({breakfast:countMeal,lunch:countMeal,dinner:countMeal}).strict()}).strict();
const selectionDay=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),meals:z.object({breakfast:ChoiceFieldSchema,lunch:ChoiceFieldSchema,dinner:ChoiceFieldSchema}).strict()}).strict();
export const ScanInputSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('tally'),scope:z.enum(['day','week']),days:z.array(countDay).min(1).max(7)}).strict(),
 z.object({kind:z.literal('selections'),scope:z.enum(['day','week']),sheets:z.array(z.object({days:z.array(selectionDay).min(1).max(7)}).strict()).min(1).max(100)}).strict(),
]);
export type ScanInput=z.infer<typeof ScanInputSchema>;
export type ScanRecord={id:string;menuId:string;menuHash:string;areaId:string;source:{file:string;sha256:string};input:ScanInput;createdAt:string;parentId?:string;confirmation:null|{reviewer:string;at:string;hash:string}};
export type ScanIssue={path:string;code:'missing_count'|'uncertain'|'missing_selection'|'ambiguous_selection'|'total_mismatch';cell?:string};
export type MealCounts={a:number;b:number;staff?:number;extra?:number};
export type DayCounts=Record<'breakfast'|'lunch'|'dinner',MealCounts>;
export type ConfirmedCounts={menuHash:string;areaId:string;days:Record<string,DayCounts>};
const outputMeal=z.object({a:z.number().int().min(0).max(9999),b:z.number().int().min(0).max(9999),staff:z.number().int().min(0).max(9999).optional(),extra:z.number().int().min(0).max(9999).optional()}).strict();
const outputCounts=z.object({menuHash:z.string().regex(/^[a-f0-9]{64}$/),areaId:z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),days:z.record(z.string(),z.object({breakfast:outputMeal,lunch:outputMeal,dinner:outputMeal}).strict())}).strict();
export function assertRenderCounts(menu:Menu,counts:ConfirmedCounts,areaId:string):void{
 outputCounts.parse(counts);
 if(counts.menuHash!==menuContentHash(menu)||counts.areaId!==areaId)throw new Error('Counts belong to another menu revision or area');
 const dates=Object.keys(counts.days);if(!dates.length||dates.some(date=>!menu.days.some(day=>day.date.value===date)))throw new Error('Counts contain unsupported dates');
}
function fields(input:ScanInput):Map<string,z.infer<typeof CountFieldSchema>|z.infer<typeof ChoiceFieldSchema>>{
 const found=new Map<string,z.infer<typeof CountFieldSchema>|z.infer<typeof ChoiceFieldSchema>>();
 if(input.kind==='tally')input.days.forEach((day,di)=>{for(const meal of meals)for(const key of ['a','b','staff','extra','expected'] as const){const field=day.meals[meal][key];if(field)found.set(`days[${di}].meals.${meal}.${key}`,field);}});
 else input.sheets.forEach((sheet,si)=>sheet.days.forEach((day,di)=>{for(const meal of meals)found.set(`sheets[${si}].days[${di}].meals.${meal}`,day.meals[meal]);}));
 return found;
}
export function validateScanDates(input:ScanInput,menu:Menu):void{
 const expected=input.scope==='week'?7:1,days=menu.days.map(day=>day.date.value);
 const groups=input.kind==='tally'?[input.days]:input.sheets.map(sheet=>sheet.days);
 for(const group of groups){if(group.length!==expected||new Set(group.map(day=>day.date)).size!==group.length||group.some(day=>!days.includes(day.date)))throw new Error('Scan dates must match the selected menu and day/week scope');}
 const first=groups[0]!.map(day=>day.date).sort().join();
 if(groups.some(group=>group.map(day=>day.date).sort().join()!==first))throw new Error('Anonymous sheets must cover the same selected dates');
 if(input.kind==='selections'){
  const cells=input.sheets.map(sheet=>JSON.stringify(sheet.days.flatMap(day=>meals.map(meal=>day.meals[meal].cell)).sort()));
  if(new Set(cells).size!==cells.length)throw new Error('Duplicate source-sheet locations. Use page-specific cell references and do not transcribe the same sheet twice.');
 }
}
export function scanHash(scan:ScanRecord):string{
 return createHash('sha256').update(JSON.stringify({id:scan.id,menuId:scan.menuId,menuHash:scan.menuHash,areaId:scan.areaId,sourceSha:scan.source.sha256,input:scan.input})).digest('hex');
}
export function scanIssues(input:ScanInput):ScanIssue[]{
 const issues:ScanIssue[]=[];
 for(const [path,field]of fields(input)){
  const requiredCount=/\.(a|b)$/.test(path);
  if(field.value===null&&requiredCount)issues.push({path,code:'missing_count',cell:field.cell});
  if(field.value==='missing')issues.push({path,code:'missing_selection',cell:field.cell});
  if(field.value==='ambiguous')issues.push({path,code:'ambiguous_selection',cell:field.cell});
  if(field.needsReview&&(field.value!==null||requiredCount))issues.push({path,code:'uncertain',cell:field.cell});
 }
 if(input.kind==='tally')input.days.forEach((day,di)=>{for(const meal of meals){const values=day.meals[meal];if(values.expected?.value!==undefined&&values.expected.value!==null&&values.a.value!==null&&values.b.value!==null&&values.a.value+values.b.value!==values.expected.value)issues.push({path:`days[${di}].meals.${meal}`,code:'total_mismatch'});}});
 return issues;
}
export function scanOverview(input:ScanInput):{date:string;meals:Record<string,Record<string,number|null>>}[]{
 if(input.kind==='tally')return input.days.map(day=>({date:day.date,meals:Object.fromEntries(meals.map(meal=>[meal,Object.fromEntries(Object.entries(day.meals[meal]).map(([key,field])=>[key,field?.value??null]))]))}));
 const result=new Map<string,{date:string;meals:Record<string,Record<string,number|null>>}>();
 for(const sheet of input.sheets)for(const day of sheet.days){let output=result.get(day.date);if(!output){output={date:day.date,meals:Object.fromEntries(meals.map(meal=>[meal,{a:0,b:0,missing:0,ambiguous:0,uncertain:0}]))};result.set(day.date,output);}
  for(const meal of meals){const field=day.meals[meal],key=field.value==='missing'||field.value==='ambiguous'?field.value:field.needsReview?'uncertain':field.value;output.meals[meal]![key]=(output.meals[meal]![key]??0)+1;}
 }
 return [...result.values()];
}
export function createScan(input:ScanInput,menu:Menu,menuId:string,areaId:string,source:ScanRecord['source']):ScanRecord{
 const copy=ScanInputSchema.parse(input);validateScanDates(copy,menu);
 // This threshold is a review policy, not a calibrated OCR accuracy claim.
 for(const field of fields(copy).values())if(field.confidence!==null&&field.confidence<0.9)field.needsReview=true;
 return {id:`scan-${randomUUID()}`,menuId,menuHash:menuContentHash(menu),areaId,source,input:copy,createdAt:new Date().toISOString(),confirmation:null};
}
export const ScanCorrectionSchema=z.object({path:z.string().min(1).max(200),value:z.union([z.number().int().min(0).max(9999),z.null(),z.enum(['a','b','missing','ambiguous'])])}).strict();
export function correctScan(scan:ScanRecord,changes:z.infer<typeof ScanCorrectionSchema>[]):ScanRecord{
 const next=structuredClone(scan),available=fields(next.input),seen=new Set<string>();
 for(const change of changes){const field=available.get(change.path);if(!field||seen.has(change.path))throw new Error('Unsupported or duplicate count/choice field');seen.add(change.path);
  if(next.input.kind==='tally'){if(change.value!==null&&typeof change.value!=='number')throw new Error('Tally corrections need a verified integer or explicit unknown');}
  else if(change.value===null||typeof change.value==='number')throw new Error('Selection corrections need a verified choice');
  Object.assign(field,{value:change.value,needsReview:false});
 }
 next.input=ScanInputSchema.parse(next.input);next.parentId=scan.id;next.id=`scan-${randomUUID()}`;next.createdAt=new Date().toISOString();next.confirmation=null;return next;
}
export function confirmScan(scan:ScanRecord,reviewer:string):ScanRecord{
 if(scanIssues(scan.input).length)throw new Error('Resolve missing, ambiguous, uncertain or inconsistent entries before confirmation');
 const copy=structuredClone(scan);copy.confirmation={reviewer,at:new Date().toISOString(),hash:scanHash(copy)};return copy;
}
export function countsFromScan(scan:ScanRecord,menu:Menu,areaId:string,date?:string):ConfirmedCounts{
 if(scan.menuHash!==menuContentHash(menu)||scan.areaId!==areaId)throw new Error('Counts belong to another area or menu revision');
 validateScanDates(scan.input,menu);
 if(!scan.confirmation||scan.confirmation.hash!==scanHash(scan)||scanIssues(scan.input).length)throw new Error('Current scan needs explicit confirmation');
 const days:Record<string,DayCounts>={};
 if(scan.input.kind==='tally')for(const day of scan.input.days){
  const result={} as DayCounts;for(const meal of meals){const values=day.meals[meal];result[meal]={a:values.a.value!,b:values.b.value!,...(values.staff?.value!==null&&values.staff?.value!==undefined?{staff:values.staff.value}:{}),...(values.extra?.value!==null&&values.extra?.value!==undefined?{extra:values.extra.value}:{})};}days[day.date]=result;
 }else for(const sheet of scan.input.sheets)for(const day of sheet.days){
  const result=days[day.date]??{breakfast:{a:0,b:0},lunch:{a:0,b:0},dinner:{a:0,b:0}};
  for(const meal of meals){const choice=day.meals[meal].value;if(choice==='a'||choice==='b')result[meal][choice]++;}days[day.date]=result;
 }
 if(date&&!days[date])throw new Error('This scan does not cover the requested date');
 return {menuHash:menuContentHash(menu),areaId,days};
}
