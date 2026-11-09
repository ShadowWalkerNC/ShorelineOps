import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Menu } from '../schema/index.js';
import { type CampusProfile,resolveResidentArea } from '../campus/index.js';
import { assertApproved,menuContentHash } from '../validation/index.js';
import { buildPacketHtml,renderPdfFromHtml,verifySource,type PacketSelection } from '../renderer/index.js';
import { combinePackets } from '../renderer/combined.js';
import { PrivacyReviewSchema,requirePrivate } from './workflow.js';
import { ScanInputSchema,ScanCorrectionSchema,createScan,correctScan,confirmScan,scanIssues,scanOverview,scanHash,countsFromScan,validateScanDates,type ScanRecord,type ConfirmedCounts } from '../production/scans.js';
import { ScanStore } from './scan-store.js';
const scanId=z.string().regex(/^scan-[a-f0-9-]{36}$/),menuId=z.string().regex(/^(week-1-example|menu-[a-f0-9]{64})$/);
const readOnly={readOnlyHint:true,destructiveHint:false,openWorldHint:false},write={readOnlyHint:false,destructiveHint:false,openWorldHint:false};
const result=(value:Record<string,unknown>)=>({content:[{type:'text' as const,text:JSON.stringify(value)}],structuredContent:value});
type Dependencies={server:McpServer;root:string;data:string;store:ScanStore;loadMenu(id:string):Promise<Menu>;loadCampus():Promise<CampusProfile>;requirePrivacy(id:string,menu:Menu):Promise<void>;sourceFile(file:string,persist?:boolean):Promise<{file:string;sha256:string}>;pdfResult(id:string,kind:string,pdf:string,preview:boolean,date?:string):Promise<CallToolResult>};
export async function resolvedScan(store:ScanStore,id:string,menu:Menu,areaId:string,date?:string):Promise<{scan:ScanRecord;counts:ConfirmedCounts}>{
 const scan=await store.read(id);await store.assertUsable(scan);return {scan,counts:countsFromScan(scan,menu,areaId,date)};
}
export function registerScanTools(d:Dependencies):void{
 const scoped=async(id:string,areaId:string)=>{const menu=await d.loadMenu(id);await d.store.assertCurrentMenu(id);await d.requirePrivacy(id,menu);await verifySource(menu,d.root);resolveResidentArea(menu,{profile:await d.loadCampus(),residentAreaId:areaId},true);return menu;};
 const summary=async(scan:ScanRecord)=>({scan_id:scan.id,menu_id:scan.menuId,resident_area_id:scan.areaId,kind:scan.input.kind,scope:scan.input.scope,issues:scanIssues(scan.input),counts_to_review:scanOverview(scan.input),confirmed:scan.confirmation!==null,coverage_note:"Aggregate missing-choice detection needs an explicit expected resident total; unknown optional counts stay blank",...(scan.input.kind==="selections"?{anonymous_sheet_count:scan.input.sheets.length}:{}),superseded_by:await d.store.replacement("scans",scan.id),menu_superseded_by:await d.store.replacement("menus",scan.menuId)});
 d.server.registerTool('count_scan_import',{description:'Save host-vision transcription from an aggregate tally or fully redacted anonymous selection sheets. Never guess unreadable counts/choices. Review privacy first. New scans are unconfirmed; batches are never added together automatically.',inputSchema:{menu_id:menuId,resident_area_id:z.string(),source_path:z.string().min(1),privacy_review:PrivacyReviewSchema,scan:ScanInputSchema},annotations:write},async({menu_id,resident_area_id,source_path,privacy_review,scan})=>{
  requirePrivate(privacy_review);const menu=await scoped(menu_id,resident_area_id),source=await d.sourceFile(source_path,false);
  await d.store.assertNotBlockedSource(source.sha256);const prior=await d.store.all();
  for(const old of prior)if(old.areaId===resident_area_id&&old.source.sha256===source.sha256&&!await d.store.replacement('scans',old.id)&&!await d.store.replacement('menus',old.menuId))throw new Error('This source was already imported for this area; review/correct the existing scan instead of counting it twice');
  const otherAreas=[...new Set(prior.filter(old=>old.areaId!==resident_area_id&&old.source.sha256===source.sha256).map(old=>old.areaId))];
  const record=createScan(scan,menu,menu_id,resident_area_id,source);await d.sourceFile(source_path);await d.store.write(record);return result({...await summary(record),alerts:scanIssues(record.input).length?'Review flagged cells before confirming counts':'Confirm all extracted counts before using them',...(otherAreas.length?{source_also_used_for_areas:otherAreas,source_warning:'Verify this area’s own columns. The same image may contain multiple areas; counts are never pooled automatically.'}:{})});
 });
 d.server.registerTool('count_scan_review',{description:'Review count totals/anonymous choice flags and source cells. No resident identities. Detailed transcription is explicit.',inputSchema:{scan_id:scanId,detail:z.enum(['summary','full']).default('summary')},annotations:readOnly},async({scan_id,detail})=>{
  const scan=await d.store.read(scan_id);await d.store.assertUsable(scan);await scoped(scan.menuId,scan.areaId);
  return result({...await summary(scan),...(detail==='full'?{transcription:scan.input}:{})});
 });
 d.server.registerTool('count_scan_correct',{description:'Apply user-verified count/choice corrections by reported field path. Preserve original text/confidence and create a new unconfirmed scan revision. Only a verified number or explicit A/B choice resolves ambiguity.',inputSchema:{scan_id:scanId,privacy_review:PrivacyReviewSchema,changes:z.array(ScanCorrectionSchema).min(1).max(200)},annotations:write},async({scan_id,privacy_review,changes})=>{
  requirePrivate(privacy_review);const scan=await d.store.read(scan_id);await d.store.assertUsable(scan);await scoped(scan.menuId,scan.areaId);
  const corrected=correctScan(scan,changes);await d.store.write(corrected);await d.store.supersede('scans',scan.id,corrected.id);return result({...await summary(corrected),alerts:'Counts changed. Review this new scan revision and confirm again.'});
 });
 d.server.registerTool('count_scan_confirm',{description:'Record explicit human confirmation after every extracted count/anonymous choice is checked against the redacted scan. Missing, ambiguous, uncertain or inconsistent entries block confirmation.',inputSchema:{scan_id:scanId,reviewer:z.string().trim().min(1).max(80),confirmed_all_counts:z.boolean()},annotations:write},async({scan_id,reviewer,confirmed_all_counts})=>{
  if(!confirmed_all_counts)throw new Error('Explicit count review confirmation required');const scan=await d.store.read(scan_id);await d.store.assertUsable(scan);await scoped(scan.menuId,scan.areaId);
  const confirmed=confirmScan(scan,reviewer),counts=countsFromScan(confirmed,await d.loadMenu(scan.menuId),scan.areaId);await d.store.write(confirmed);return result({...await summary(confirmed),counts,alerts:'A/B counts confirmed; only explicit staff/extra numbers are included. Unknown optional values remain blank. Food-menu approval remains separate.'});
 });
 d.server.registerTool('count_scan_block',{description:'Block a scan if resident/private information is discovered later. Stops future scan use and linked packet access; cannot revoke previously downloaded files.',inputSchema:{scan_id:scanId},annotations:write},async({scan_id})=>{await d.store.read(scan_id);await d.store.block(scan_id);return result({scan_id,blocked:true,alerts:'Do not reuse the stored scan. Redact the source before fresh intake; stored copies may require separate removal.'});});
 d.server.registerTool('count_scan_for_menu',{description:'Prepare an existing safe scan as a new UNCONFIRMED draft for a revised menu of the SAME area/week. No numerical changes or confirmation are carried automatically. Review all A/B meanings against the menu change, correct and explicitly reconfirm.',inputSchema:{scan_id:scanId,menu_id:menuId,confirmed_same_area_week:z.boolean()},annotations:write},async({scan_id,menu_id,confirmed_same_area_week})=>{
  if(!confirmed_same_area_week)throw new Error('Explicit same-area/week review request required');const old=await d.store.read(scan_id);await d.store.assertSourceAllowed(old);if(await d.store.replacement('scans',scan_id))throw new Error('Use the latest scan revision');
  const menu=await scoped(menu_id,old.areaId),previous=await d.loadMenu(old.menuId);if(menu.startDate!==previous.startDate||!await d.store.isMenuSuccessor(old.menuId,menu_id))throw new Error('Choose an explicit successor menu for the same area/week');validateScanDates(old.input,menu);
  const next:ScanRecord={...structuredClone(old),id:`scan-${randomUUID()}`,parentId:old.id,menuId:menu_id,menuHash:menuContentHash(menu),createdAt:new Date().toISOString(),confirmation:null};await d.store.write(next);await d.store.supersede('scans',old.id,next.id);
  return result({...await summary(next),alerts:'Draft only: review every A/B count against the revised foods; correct and reconfirm. Previous confirmation is cleared.'});
 });
 d.server.registerTool('workflow_status',{description:'In-workflow alerts for selected menus and count scans: changed menus, stale counts, missing/ambiguous choices, pending confirmation and unreadable sources. No background push service.',inputSchema:{menu_ids:z.array(menuId).max(30).default([]),scan_ids:z.array(scanId).max(100).default([])},annotations:readOnly},async({menu_ids,scan_ids})=>{
  if(!menu_ids.length&&!scan_ids.length){
   for(const scan of (await d.store.all()).slice(-30))if(!await d.store.replacement('scans',scan.id)){scan_ids.push(scan.id);if(!menu_ids.includes(scan.menuId))menu_ids.push(scan.menuId);}
   const latest=new Map<string,{id:string;menu:Menu}>();
   let names:string[]=[];try{names=await fs.readdir(path.join(d.data,'menus'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   for(const file of names)if(/^menu-[a-f0-9]{64}\.json$/.test(file)){const id=file.slice(0,-5);try{if(await d.store.replacement('menus',id))continue;const menu=await d.loadMenu(id),previous=latest.get(menu.facility);if(!previous||`${menu.startDate}|${menu.revision?.createdAt??''}`>`${previous.menu.startDate}|${previous.menu.revision?.createdAt??''}`)latest.set(menu.facility,{id,menu});}catch{if(!menu_ids.includes(id))menu_ids.push(id);}}
   for(const {id,menu}of latest.values()){if(!menu_ids.includes(id))menu_ids.push(id);const parent=menu.revision?.parentMenuId;if(parent&&!menu_ids.includes(parent))menu_ids.push(parent);}
   if(!menu_ids.length)menu_ids.push('week-1-example');
  }
  const alerts:Record<string,unknown>[]=[];
  for(const id of menu_ids){try{const replacement=await d.store.replacement('menus',id);if(replacement)alerts.push({menu_id:id,code:'menu_changed',replacement,action:'Review new menu; reconfirm counts and regenerate paperwork'});else{const menu=await d.loadMenu(id);await d.requirePrivacy(id,menu);if(!menu.approval)alerts.push({menu_id:id,code:'menu_approval_pending'});}}catch{alerts.push({menu_id:id,code:'menu_unavailable_or_privacy_pending'});}}
  for(const id of scan_ids){try{const scan=await d.store.read(id);await d.store.assertUsable(scan);const menu=await scoped(scan.menuId,scan.areaId);if(scan.menuHash!==menuContentHash(menu))alerts.push({scan_id:id,code:'counts_stale'});else{for(const issue of scanIssues(scan.input))alerts.push({scan_id:id,...issue});if(!scan.confirmation||scan.confirmation.hash!==scanHash(scan))alerts.push({scan_id:id,code:'count_confirmation_pending'});}}catch{alerts.push({scan_id:id,code:'scan_unavailable_or_stale',action:'Review latest menu/scan and privacy state before using counts'});}}
  return result({alerts,notification_mode:'during upload/status/generation; no background push',independent_areas:true,combination:'selected sections only; no automatic food pooling'});
 });
 d.server.registerTool('campus_packet_generate',{description:'Compile selected independent area packets into one PDF. Each keeps its own verified menu/counts. No cross-area food pooling, duplicate areas or different weeks. Blank counts remain supported; supplied scans must be confirmed and current.',inputSchema:{areas:z.array(z.object({menu_id:menuId,resident_area_id:z.string(),scan_id:scanId.optional()}).strict()).min(2).max(20),packet:z.enum(['weekly','daily','complete']).default('daily'),date:z.string().optional(),extras:z.array(z.enum(['summary','prep','dessert'])).max(3).default([]),preview:z.boolean().default(true)},annotations:write},async({areas,packet,date,extras,preview})=>{
  if(packet==='daily'&&!date)throw new Error('Choose a date for every selected area');if(packet!=='daily'&&(date||extras.length))throw new Error('Date/extras apply only to daily packets');
  const selection:PacketSelection=packet==='daily'?{kind:'daily',date:date!,extras}:{kind:packet},profile=await d.loadCampus();
  const sections:Parameters<typeof combinePackets>[0]=[],bindings:{menu_id:string;resident_area_id:string;scan_id?:string;scanHash?:string}[]=[];
  for(const area of areas){const menu=await scoped(area.menu_id,area.resident_area_id);if(!preview)assertApproved(menu);const counts=area.scan_id?(await resolvedScan(d.store,area.scan_id,menu,area.resident_area_id,date)).counts:undefined;
   sections.push({areaId:area.resident_area_id,startDate:menu.startDate,html:buildPacketHtml(menu,{preview,selection,scope:{profile,residentAreaId:area.resident_area_id},...(counts?{counts}:{})})});
   bindings.push({menu_id:area.menu_id,resident_area_id:area.resident_area_id,...(area.scan_id?{scan_id:area.scan_id,scanHash:await d.store.confirmedFingerprint(area.scan_id)}:{})});
  }
  const html=combinePackets(sections),id=randomUUID(),folder=path.join(d.data,'packets');await fs.mkdir(folder,{recursive:true});const pdf=path.join(folder,`${id}.pdf`);await renderPdfFromHtml(html,pdf);await fs.writeFile(path.join(folder,`${id}.json`),JSON.stringify({kind:'combined',bindings}));
  return d.pdfResult(id,'combined-'+packet,pdf,preview,date);
 });
}
