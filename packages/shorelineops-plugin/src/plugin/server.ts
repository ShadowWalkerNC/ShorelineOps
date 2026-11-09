import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { CampusProfileSchema, resolveResidentArea, type CampusProfile, type CampusScope } from '../campus/index.js';
import { MenuSchema, type Menu } from '../schema/index.js';
import { validateMenu, listUnresolvedFields, menuContentHash, assertApproved } from '../validation/index.js';
import { renderPreview, renderProduction, renderWorkArea, renderRossWorksheetPdf, countPdfPages, verifySource, type PacketSelection } from '../renderer/index.js';

import { PrivacyReviewSchema, requirePrivate, privacyFingerprint, readiness, correctMenu, CorrectionSchema } from './workflow.js';
import { ScanStore } from './scan-store.js';
import { registerScanTools,resolvedScan } from './scan-tools.js';
import { buildPacketHtml,renderPdfFromHtml } from '../renderer/index.js';
import { scanHash } from '../production/scans.js';
import { createTransfer } from '../integration/transfer.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const runtimeVersion=z.string().regex(/^\d+\.\d+\.\d+$/).parse(JSON.parse(await fs.readFile(path.join(root,'plugin.json'),'utf8')).version);
const data = process.env.SHORELINEOPS_DATA_DIR || process.env.SYLVIA_DATA_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ...(process.platform === 'win32' ? ['AppData','Local'] : ['.local','share'])), 'SylviaRossMenuProcessor', 'data');
const scanStore=new ScanStore(data);
const menuIds = z.string().regex(/^(week-1-example|menu-[a-f0-9]{64})$/);
const readOnly = { readOnlyHint:true, destructiveHint:false, openWorldHint:false };
const write = { readOnlyHint:false, destructiveHint:false, openWorldHint:false };
const result = (value: Record<string, unknown>) => ({ content:[{type:'text' as const,text:JSON.stringify(value)}], structuredContent:value });
function checked(input: unknown): Menu {
  const validation = validateMenu(input);
  if (!validation.ok) throw new Error('Menu validation failed; check dates, fields and component agreement.');
  return validation.menu;
}
function bindSource(menu: Menu, file: string, sha256: string): Menu {
  const copy = structuredClone(menu);
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if (object.originalText !== undefined && object.source && typeof object.source === 'object') (object.source as {file:string}).file = file;
    for (const child of Object.values(object)) visit(child);
  };
  visit(copy);
  copy.source = {file,sha256};
  copy.approval = null;
  return checked(copy);
}
async function load(id: string): Promise<Menu> {
  menuIds.parse(id);
  if (id === 'week-1-example') {
    const menu = checked(JSON.parse(await fs.readFile(path.join(root,'fixtures/reviewed/week-1.menu.json'),'utf8')));
    return bindSource(menu,path.join(root,menu.source.file),menu.source.sha256);
  }
  return checked(JSON.parse(await fs.readFile(path.join(data,'menus',`${id}.json`),'utf8')));
}
async function save(menu: Menu): Promise<string> {
  const id = `menu-${menuContentHash(menu)}`;
  const folder = path.join(data,'menus');
  await fs.mkdir(folder,{recursive:true});
  const file = path.join(folder,`${id}.json`);
  // Imports never erase an existing approval or earlier transcription.
  try { await fs.writeFile(file,JSON.stringify(menu,null,2)+'\n',{flag:'wx'}); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  return id;
}
async function sourceFile(file: string, persist=true): Promise<{file:string;sha256:string}> {
  const real = await fs.realpath(file);
  const allowed = [path.join(root,'fixtures/source'),path.join(data,'sources'),path.join(os.homedir(),'.codex','codex-remote-attachments')];
  const importDirectory=process.env.SHORELINEOPS_IMPORT_DIR;
  if(importDirectory){const resolved=await fs.realpath(importDirectory),home=await fs.realpath(os.homedir());const normalize=(value:string)=>process.platform==='win32'?value.toLowerCase():value;if(normalize(resolved)===normalize(path.parse(resolved).root)||normalize(resolved)===normalize(home))throw new Error('Choose a dedicated menu import folder, not the home folder or disk root');allowed.push(resolved);}
  let permitted = false;
  for (const directory of allowed) {
    try {
      const base = await fs.realpath(directory);
      const relative = path.relative(base,real);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) permitted = true;
    } catch { /* A missing allowed directory grants no access. */ }
  }
  if (!permitted) throw new Error('Source must be an attached menu or a preserved menu source; arbitrary filesystem reads are refused.');
  const stat = await fs.stat(real);
  if (!stat.isFile() || stat.size > 20*1024*1024) throw new Error('Menu source must be a file under 20 MB.');
  const bytes = await fs.readFile(real);
  const extension = bytes.subarray(0,3).equals(Buffer.from([255,216,255])) ? 'jpg' : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : bytes.subarray(0,5).toString() === '%PDF-' ? 'pdf' : null;
  if (!extension) throw new Error('Source must be an original JPEG, PNG or PDF.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await scanStore.assertNotBlockedSource(sha256);
  const folder = path.join(data,'sources');
  const target = path.join(folder,`${sha256}.${extension}`);
  if(!persist)return {file:target,sha256};
  await fs.mkdir(folder,{recursive:true});
  try { await fs.writeFile(target,bytes,{flag:'wx'}); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  if (createHash('sha256').update(await fs.readFile(target)).digest('hex') !== sha256) throw new Error('Preserved source hash mismatch.');
  return {file:target,sha256};
}
async function loadCampus(): Promise<CampusProfile> {
  const file=path.join(data,'campus.json');
  let text:string;
  try { text=await fs.readFile(file,'utf8'); }
  catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error; let legacy=false;try{const files=(await fs.readdir(path.join(data,'menus'))).filter(name=>/^menu-[a-f0-9]{64}\.json$/.test(name));const areas=await Promise.all(files.map(async name=>JSON.parse(await fs.readFile(path.join(data,'menus',name),'utf8')).facility as string));legacy=areas.length>0&&areas.every(area=>['ross_manor','sylvia_ross','engel_place'].includes(area));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    text=await fs.readFile(path.join(root,legacy?'fixtures/campus-profile.json':'fixtures/default-campus.json'),'utf8'); }
  return CampusProfileSchema.parse(JSON.parse(text));
}
async function writeCampus(profile:CampusProfile): Promise<void> {
  await fs.mkdir(data,{recursive:true});
  const file=path.join(data,'campus.json'), temporary=`${file}.${randomUUID()}.tmp`;
  const encoded=JSON.stringify(profile,null,2)+'\n';
  const history=path.join(data,'campus-history');
  await fs.mkdir(history,{recursive:true});
  const hash=createHash('sha256').update(encoded).digest('hex');
  await fs.writeFile(path.join(history,`${hash}.json`),encoded);
  await fs.writeFile(temporary,encoded);
  await fs.rename(temporary,file);
}
async function pdfResult(id:string,kind:string,pdf:string,preview:boolean,date?:string) {
  const uri=`sylvia-ross://packets/${id}`;
  return {content:[{type:'text' as const,text:JSON.stringify({packet_id:id,packet:kind,date,pages:await countPdfPages(pdf),preview,file_path:pdf,resource_uri:uri})},{type:'resource_link' as const,uri,name:`Kitchen ${kind}${date?' '+date:''}${preview?' - REVIEW':''}.pdf`,mimeType:'application/pdf'}]};
}

async function recordPrivacy(id:string,menu:Menu,pass:boolean){
  const folder=path.join(data,'privacy');await fs.mkdir(folder,{recursive:true});
  const file=path.join(folder,`${id}.json`),temp=`${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp,JSON.stringify({fingerprint:privacyFingerprint(menu),pass,reviewedAt:new Date().toISOString(),method:'host-source-filename-transcription-review'}));await fs.rename(temp,file);
}
async function privacyPass(id:string,menu:Menu):Promise<boolean>{
  try{await scanStore.assertNotBlockedSource(menu.source.sha256);}catch{return false;}
  let receipt:{fingerprint:string;pass:boolean};
  try{receipt=JSON.parse(await fs.readFile(path.join(data,'privacy',`${id}.json`),'utf8'));}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')return false;
    if(id!=='week-1-example')return false;
    receipt=JSON.parse(await fs.readFile(path.join(root,'fixtures/reviewed/week-1.privacy.json'),'utf8'));
  }
  return receipt.pass===true&&receipt.fingerprint===privacyFingerprint(menu);
}
async function requirePrivacy(id:string,menu:Menu){if(!await privacyPass(id,menu))throw new Error('Privacy review pending or blocked. Review a redacted source, filename and transcription before using this menu.');}
function flaggedFields(menu:Menu){
  const fields:Record<string,unknown>={};
  const visit=(value:unknown,prefix:string):void=>{if(!value||typeof value!=='object')return;
    if('needsReview' in value&&value.needsReview){fields[prefix]=value;return;}
    for(const [key,child]of Object.entries(value))visit(child,Array.isArray(value)?`${prefix}[${key}]`:prefix?`${prefix}.${key}`:key);
  };visit(menu,'');return fields;
}

const server = new McpServer({name:'sylvia-ross-menu-processor',version:runtimeVersion},{maxToolInputElements:20000});
server.registerTool('sylvia_status',{description:'Check the ShorelineOps facility renderer, packet choices and approval boundary. No menu is approved by this check.',inputSchema:{},annotations:readOnly},async()=>result({version:runtimeVersion,display_name:'ShorelineOps',setup_tool:'facility_setup',supported_menu_format:'7 Sunday-Saturday dates; breakfast/lunch/dinner A/B',runtime:'local Node.js / Chromium',packets:{weekly:2,daily:3,complete:44},optional_daily:['summary','prep','dessert'],example_menu:'week-1-example',production_requires:'explicit human menu review',chatgpt_web_backend:'not hosted',campus_configuration:'campus_review',scan_workflow:'count_scan_import -> review/correct -> confirm; host vision required',combined_packets:'selected independent areas only',alerts:'in-workflow; no background pushes',work_area_types:['hot','cold','pull','prep','dessert','bakery','other']}));
server.registerTool('shoreline_status',{description:'Check the ShorelineOps facility renderer, packet choices and approval boundary. No menu is approved by this check.',inputSchema:{},annotations:readOnly},async()=>result({version:runtimeVersion,display_name:'ShorelineOps',setup_tool:'facility_setup',supported_menu_format:'7 Sunday-Saturday dates; breakfast/lunch/dinner A/B',runtime:'local Node.js / Chromium',packets:{weekly:2,daily:3,complete:44},optional_daily:['summary','prep','dessert'],example_menu:'week-1-example',production_requires:'explicit human menu review',chatgpt_web_backend:'not hosted',campus_configuration:'campus_review',scan_workflow:'count_scan_import -> review/correct -> confirm; host vision required',combined_packets:'selected independent areas only',alerts:'in-workflow; no background pushes',work_area_types:['hot','cold','pull','prep','dessert','bakery','other']}));
server.registerTool('menu_import',{description:'Preserve an attached source menu and save its canonical transcription. The model extracts the image first; this tool never OCRs it. Approval is always unset for new content.',inputSchema:{source_path:z.string().min(1),privacy_review:PrivacyReviewSchema,replaces_menu_id:menuIds.optional(),menu:MenuSchema.omit({source:true,approval:true,revision:true})},annotations:write},async({source_path,menu,privacy_review,replaces_menu_id})=>{
  requirePrivate(privacy_review);
  if(replaces_menu_id){await scanStore.assertCurrentMenu(replaces_menu_id);const old=await load(replaces_menu_id);if(old.facility!==menu.facility||old.startDate!==menu.startDate)throw new Error("A replacement must be for the same area and menu week");}
  const source = await sourceFile(source_path,false);
  const canonical = bindSource({...menu,source,approval:null,revision:{id:randomUUID(),createdAt:new Date().toISOString(),...(replaces_menu_id?{parentMenuId:replaces_menu_id}:{})}},source.file,source.sha256);
  if(!replaces_menu_id){
    let names:string[]=[];try{names=await fs.readdir(path.join(data,'menus'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    for(const file of names)if(/^menu-[a-f0-9]{64}\.json$/.test(file)){const oldId=file.slice(0,-5);if(await scanStore.replacement('menus',oldId))continue;const old=await load(oldId);if(old.facility===canonical.facility&&old.startDate===canonical.startDate)throw new Error('This area/week already has an active menu. Use its latest revision or explicitly replace it.');}
  }
  await sourceFile(source_path);
  const id = await save(canonical);
  await recordPrivacy(id,canonical,true);
  if(replaces_menu_id)await scanStore.supersede("menus",replaces_menu_id,id);
  const stored = await load(id);
  return result({menu_id:id,week:stored.week,start_date:stored.startDate,days:7,options:42,needs_review:listUnresolvedFields(stored),approved:stored.approval!==null});
});
server.registerTool('menu_readiness',{description:'Compact source, privacy, review and current approval status. Never approves a menu.',inputSchema:{menu_id:menuIds},annotations:readOnly},async({menu_id})=>{
  const menu=await load(menu_id);await verifySource(menu,root);
  const replacement=await scanStore.replacement("menus",menu_id);return result({menu_id,...readiness(menu,await privacyPass(menu_id,menu)),...(replacement?{approved:false,ready_for_production:false,ready_for_approval:false,superseded_by:replacement,alerts:["Menu changed; review new menu and counts before regenerating paperwork"]}:{})});
});
server.registerTool('menu_privacy_review',{description:'Record source, filename and transcription privacy review for legacy menus, or block an unsafe menu. This is a host attestation, not automatic image detection.',inputSchema:{menu_id:menuIds,privacy_review:PrivacyReviewSchema},annotations:write},async({menu_id,privacy_review})=>{
  const menu=await load(menu_id);await verifySource(menu,root);
  let pass=true;try{requirePrivate(privacy_review);}catch{pass=false;}
  if(!pass&&menu_id!=='week-1-example'){
    menu.approval=null;
    const target=path.join(data,'menus',`${menu_id}.json`),temp=`${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temp,JSON.stringify(menu,null,2)+'\n');await fs.rename(temp,target);
  }
  if(privacy_review.resident_information_found)await scanStore.blockSource(menu.source.sha256);
  await recordPrivacy(menu_id,menu,pass);
  return result({menu_id,...readiness(menu,pass&&await privacyPass(menu_id,menu))});
});
server.registerTool('menu_review',{description:'Compact review by default; flags shows unresolved fields, full shows the canonical transcription explicitly. Privacy pass is required for detailed content.',inputSchema:{menu_id:menuIds,detail:z.enum(['summary','flags','full']).default('summary')},annotations:readOnly},async({menu_id,detail})=>{
  const menu=await load(menu_id);await verifySource(menu,root);
  const pass=await privacyPass(menu_id,menu),replacement=await scanStore.replacement("menus",menu_id);
  if(detail!=='summary'&&!pass)throw new Error('Privacy review is required before exposing menu content.');
  return result({menu_id,...readiness(menu,pass),...(replacement?{approved:false,ready_for_production:false,superseded_by:replacement}:{}),...(detail==='full'?{canonical_menu:menu}:{}),...(detail==='flags'?{fields:flaggedFields(menu)}:{})});
});
server.registerTool('menu_correct',{description:'Apply reviewed field corrections without changing original extracted text, evidence or confidence. Creates a new unapproved revision. Review correction text for resident information first.',inputSchema:{menu_id:menuIds,privacy_review:PrivacyReviewSchema,changes:z.array(CorrectionSchema).min(1).max(100)},annotations:write},async({menu_id,privacy_review,changes})=>{
  requirePrivate(privacy_review);await scanStore.assertCurrentMenu(menu_id);const menu=await load(menu_id);await requirePrivacy(menu_id,menu);await verifySource(menu,root);
  const corrected=correctMenu(menu,changes,menu_id),id=await save(corrected);await recordPrivacy(id,corrected,true);await scanStore.supersede("menus",menu_id,id);
  return result({menu_id:id,...readiness(corrected,true),alerts:["Menu changed: previous counts and paperwork require review. No background push notification was sent."]});
});
server.registerTool('menu_approve',{description:'Record explicit human confirmation AFTER the user has checked all 42 options, dates, components and dessert labels. Never infer this from general trust or a request to print. This grants no clinical or prep-rule authority.',inputSchema:{menu_id:menuIds,reviewer:z.string().trim().min(1).max(120),confirmed_all_42_options:z.boolean()},annotations:write},async({menu_id,reviewer,confirmed_all_42_options})=>{
  await scanStore.assertCurrentMenu(menu_id);
  if (!confirmed_all_42_options) throw new Error('Explicit human source review confirmation is required.');
  const menu = await load(menu_id);
  await verifySource(menu,root);
  await requirePrivacy(menu_id,menu);
  if (listUnresolvedFields(menu).length) throw new Error('Unresolved fields prevent approval.');
  // Preserve the example fixture and place its approved copy in per-user state.
  const preserved = menu_id === 'week-1-example' ? await sourceFile(menu.source.file) : null;
  const imported = preserved ? bindSource(menu,preserved.file,preserved.sha256) : menu;
  imported.approval = {reviewer,approvedAt:new Date().toISOString(),menuHash:menuContentHash(imported)};
  assertApproved(imported);
  const id = await save(imported);
  await recordPrivacy(id,imported,true);
  const target = path.join(data,'menus',`${id}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary,JSON.stringify(imported,null,2)+'\n');
  await fs.rename(temporary,target);
  return result({menu_id:id,approved:true,reviewer,menu_hash:imported.approval.menuHash});
});
server.registerTool('packet_generate',{description:'Generate a printable PDF. Defaults to a watermarked 2-page weekly packet. Daily means 3 cook pages for an explicit date; summary/prep/dessert are optional extras. Complete is an explicit 44-page master packet. Production requires approved current data.',inputSchema:{menu_id:menuIds,packet:z.enum(['weekly','daily','complete']).default('weekly'),date:z.string().optional(),extras:z.array(z.enum(['summary','prep','dessert'])).max(3).default([]),preview:z.boolean().default(true),resident_area_id:z.string().optional(),scan_id:z.string().regex(/^scan-[a-f0-9-]{36}$/).optional()},annotations:write},async({menu_id,packet,date,extras,preview,resident_area_id,scan_id})=>{
  if (packet!=='daily' && (date!==undefined || extras.length)) throw new Error('Date and extras apply only to daily packets.');
  if (packet==='daily' && !date) throw new Error('Choose a menu date for the daily packet.');
  const selection: PacketSelection = packet==='daily' ? {kind:'daily',date:date!,extras} : {kind:packet};
  await scanStore.assertCurrentMenu(menu_id);
  const menu = await load(menu_id);
  await requirePrivacy(menu_id,menu);
  const id = randomUUID();
  const folder = path.join(data,'packets');
  await fs.mkdir(folder,{recursive:true});
  const pdf = path.join(folder,`${id}.pdf`);
  const scope:CampusScope|undefined=resident_area_id ? {profile:await loadCampus(),residentAreaId:resident_area_id} : undefined;
  const scan=scan_id?await resolvedScan(scanStore,scan_id,menu,resident_area_id??menu.facility,date):undefined;
  if(scan){await verifySource(menu,root);if(!preview)assertApproved(menu);await renderPdfFromHtml(buildPacketHtml(menu,{preview,selection,...(scope?{scope}:{}),counts:scan.counts}),pdf);}
  else if (preview) await renderPreview(menu,root,pdf,path.join(folder,`${id}.html`),selection,scope);
  else await renderProduction(menu,root,pdf,selection,scope);
  await fs.writeFile(path.join(folder,`${id}.json`),JSON.stringify({kind:'menu',menu_id,resident_area_id:resident_area_id??menu.facility,fingerprint:privacyFingerprint(menu),...(scan_id&&scan?{scan_id,scanHash:scanHash(scan.scan)}:{})}));
  return pdfResult(id,packet,pdf,preview,date);
});
server.registerTool('facility_setup',{description:'Set up any facility with user-supplied service-area and kitchen names. First-run only; show the proposed setup before explicit confirmation. No menus, routes, counts or clinical rules are inferred. Use campus_configure to edit an existing setup.',inputSchema:{facility_name:z.string().trim().min(1).max(80),areas:z.array(z.object({id:z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),name:z.string().trim().min(1).max(80)}).strict()).min(1).max(100),kitchens:z.array(z.object({id:z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),name:z.string().trim().min(1).max(80)}).strict()).max(30).default([]),confirmed:z.boolean().default(false),confirmed_by:z.string().trim().min(1).max(120).optional()},annotations:write},async({facility_name,areas,kitchens,confirmed,confirmed_by})=>{
 if(confirmed&&!confirmed_by)throw new Error('Saving facility setup requires an actual confirmer');
 const existing=await loadCampus();
 if(existing.residentAreas.some(area=>area.id!=='setup_required'))throw new Error('A facility is already configured. Review campus_review and use campus_configure; setup never overwrites existing facilities.');
 if(areas.some(area=>area.id==='setup_required'))throw new Error('Choose actual service-area IDs');
 const profile=CampusProfileSchema.parse({schemaVersion:1,name:facility_name,status:confirmed?'confirmed':'draft',confirmedBy:confirmed?confirmed_by:null,...(confirmed?{residentAreasConfirmedBy:confirmed_by}:{}),source:'Facility and service areas supplied by the user; no routes or menu sharing inferred.',residentAreas:areas.map(area=>({...area,active:true})),kitchens:kitchens.map(kitchen=>({...kitchen,active:true})),workAreas:[],sharedMenus:[]});
 if(confirmed)await writeCampus(profile);
 return result({configured:confirmed,needs_confirmation:!confirmed,profile,next:confirmed?'Upload this facility area’s own menu or ask for a blank worksheet.':'Confirm these facility/area names to save setup.'});
});
server.registerTool('campus_review',{description:'List configured resident areas, kitchens and work areas. Proposed setup is marked draft; do not infer routes or shared menus. Lists all configured wings, not a fixed three.',inputSchema:{},annotations:readOnly},async()=>{
  const profile=await loadCampus();
  const available:{menu_id:string;resident_area_id:string;approved:boolean}[]=[];
  try { for(const file of (await fs.readdir(path.join(data,'menus'))).filter(file=>/^menu-[a-f0-9]{64}\.json$/.test(file))) {
    const id=file.slice(0,-5),menu=await load(id);
    available.push({menu_id:id,resident_area_id:menu.facility,approved:menu.approval!==null&&!await scanStore.replacement('menus',id)});
  }}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  return result({profile,resident_areas_confirmed:profile.status==='confirmed'||!!profile.residentAreasConfirmedBy,production_structure_confirmed:profile.status==='confirmed',available_menus:available,menu_sharing:'disabled unless explicitly assigned to a menu content hash',routing:'not inferred',example_menu:'week-1-example is a historical Sylvia Ross example only; never a user facility menu',setup_required:profile.residentAreas.some(area=>area.id==='setup_required'),production_station_logs:'one blank page per selected meal-production work area; no prefilled tasks, routes or limits'});
});
server.registerTool('campus_configure',{description:'Save resident areas, kitchens and named work areas provided/confirmed by the user. Configuration changes do not approve menus or infer routes. No hardcoded three-wing limit.',inputSchema:{profile:CampusProfileSchema,confirmed:z.boolean(),confirmed_by:z.string().trim().min(1).max(120)},annotations:write},async({profile,confirmed,confirmed_by})=>{
  if(!confirmed)throw new Error('Confirm the actual names and structure before activating configuration');
  const existing=await loadCampus();
  if(JSON.stringify(profile.sharedMenus)!==JSON.stringify(existing.sharedMenus))throw new Error('Use campus_assign_menu for explicit menu sharing; configuration does not grant sharing');
  const approved=CampusProfileSchema.parse({...profile,status:'confirmed',confirmedBy:confirmed_by,residentAreasConfirmedBy:confirmed_by});
  await writeCampus(approved);
  return result({configured:true,profile:approved});
});
server.registerTool('campus_assign_menu',{description:'Explicitly share one exact menu revision with selected resident areas only after the user confirms that they use this menu. This never approves its foods, changes counts or infers kitchen routing.',inputSchema:{menu_id:menuIds,resident_area_ids:z.array(z.string()).min(1).max(100),confirmed:z.boolean(),confirmed_by:z.string().trim().min(1).max(80)},annotations:write},async({menu_id,resident_area_ids,confirmed,confirmed_by})=>{
  if(!confirmed)throw new Error('Explicit shared-menu confirmation is required');
  const profile=await loadCampus();
  if(profile.status!=='confirmed'&&!profile.residentAreasConfirmedBy)throw new Error('Confirm the resident-area configuration first');
  const menu=await load(menu_id);
  await requirePrivacy(menu_id,menu);
  await verifySource(menu,root);
  const menuHash=menuContentHash(menu);
  const updated=CampusProfileSchema.parse({...profile,sharedMenus:[...profile.sharedMenus.filter(binding=>binding.menuHash!==menuHash),{menuHash,residentAreaIds:resident_area_ids,confirmedBy:confirmed_by}]});
  await writeCampus(updated);
  return result({menu_id,menu_hash:menuHash,resident_area_ids,menu_approved:menu.approval!==null});
});
server.registerTool('work_area_generate',{description:'Print a one-page blank meal-production station log for hot/cold production, pull/prep, dessert/bakery or another configured meal-production work area. Does not invent food assignments, tasks, quantities, lead times or signatures. One selected work area only.',inputSchema:{work_area_id:z.string().min(1),date:z.string(),preview:z.boolean().default(true)},annotations:write},async({work_area_id,date,preview})=>{
  const profile=await loadCampus();
  const id=randomUUID(),folder=path.join(data,'packets');
  await fs.mkdir(folder,{recursive:true});
  const pdf=path.join(folder,`${id}.pdf`);
  await renderWorkArea(profile,work_area_id,date,preview,pdf);
  await fs.writeFile(path.join(folder,`${id}.json`),JSON.stringify({kind:'work-area'}));
  return pdfResult(id,'work-area',pdf,preview,date);
});
server.registerTool('ross_worksheet_generate',{description:'Generate one blank meal-production worksheet: prep-list (breakfast/lunch/dinner, early pulls, quantities and initials) or meal-service (three meal columns). No resident or menu data input. Generic facilities use quantity columns; the original Ross preset retains its confirmed labels. No shared menu or task inference. Existing packet presets unchanged.',inputSchema:{format:z.enum(['prep-list','meal-service']),resident_area_id:z.string().min(1),date:z.string(),preview:z.boolean().default(true)},annotations:write},async({format,resident_area_id,date,preview})=>{
  const profile=await loadCampus(),id=randomUUID(),folder=path.join(data,'packets');
  await fs.mkdir(folder,{recursive:true});const pdf=path.join(folder,`${id}.pdf`);
  await renderRossWorksheetPdf(profile,resident_area_id,date,format,preview,pdf);
  await fs.writeFile(path.join(folder,`${id}.json`),JSON.stringify({kind:'blank-worksheet'}));
  return pdfResult(id,format,pdf,preview,date);
});
server.registerTool('menu_export',{description:'Export a privacy-reviewed menu and original source to a .srmenu file for ShorelineOps. Optionally include a current confirmed scan_id. Import clears menu/count approval and requires fresh source/count review. No resident-specific data permitted.',inputSchema:{menu_id:menuIds,scan_id:z.string().regex(/^scan-[a-f0-9-]{36}$/).optional()},annotations:write},async({menu_id,scan_id})=>{
  await scanStore.assertCurrentMenu(menu_id);const menu=await load(menu_id);await requirePrivacy(menu_id,menu);await verifySource(menu,root);
  const scan=scan_id?await resolvedScan(scanStore,scan_id,menu,menu.facility):undefined;
  const transfer=createTransfer(menu,await fs.readFile(menu.source.file),scan?{record:scan.scan,bytes:await fs.readFile(scan.scan.source.file)}:undefined),id=randomUUID(),folder=path.join(data,'transfers');
  if(Buffer.byteLength(JSON.stringify(transfer))>900000)throw new Error('ShorelineOps transfer exceeds 900 KB. Reduce redacted menu/count source images before extraction and re-import; no evidence was dropped.');
  await fs.mkdir(folder,{recursive:true});const file=path.join(folder,`${id}.srmenu`);await fs.writeFile(file,JSON.stringify(transfer));
  await fs.writeFile(path.join(folder,`${id}.json`),JSON.stringify({menu_id,fingerprint:privacyFingerprint(menu),...(scan_id&&scan?{scan_id,scanHash:scanHash(scan.scan)}:{})}));
  const uri=`sylvia-ross://transfers/${id}`;
  return {content:[{type:'text' as const,text:JSON.stringify({file_path:file,resource_uri:uri,approval:'cleared for import; fresh review required',shoreline_import_limit:'900 KB'})},{type:'resource_link' as const,uri,name:`Week-${menu.week}.srmenu`,mimeType:'application/json'}]};
});
server.registerResource('menu-transfer',new ResourceTemplate('sylvia-ross://transfers/{id}',{list:undefined}),{mimeType:'application/json',description:'A privacy-gated menu transfer for ShorelineOps.'},async(uri,variables)=>{
  const id=z.string().uuid().parse(variables.id),folder=path.join(data,'transfers');
  const meta=JSON.parse(await fs.readFile(path.join(folder,`${id}.json`),'utf8')) as {menu_id:string;fingerprint:string;scan_id?:string;scanHash?:string};
  await scanStore.assertCurrentMenu(meta.menu_id);const menu=await load(meta.menu_id);await requirePrivacy(meta.menu_id,menu);await verifySource(menu,root);
  if(meta.fingerprint!==privacyFingerprint(menu))throw new Error('Transfer revision mismatch');
  if(meta.scan_id&&await scanStore.confirmedFingerprint(meta.scan_id)!==meta.scanHash)throw new Error('Counts changed; export a new transfer');
  return {contents:[{uri:uri.href,mimeType:'application/json',text:await fs.readFile(path.join(folder,`${id}.srmenu`),'utf8')}]};
});
server.registerResource('packet-pdf',new ResourceTemplate('sylvia-ross://packets/{id}',{list:undefined}),{mimeType:'application/pdf',description:'A generated Sylvia Ross print packet.'},async(uri,variables)=>{
  const id = z.string().uuid().parse(variables.id);
  const manifest=JSON.parse(await fs.readFile(path.join(data,'packets',`${id}.json`),'utf8')) as {kind:string;menu_id?:string;fingerprint?:string;resident_area_id?:string;scan_id?:string;scanHash?:string;bindings?:{menu_id:string;resident_area_id:string;scan_id?:string;scanHash?:string}[]};
  if(manifest.kind==='combined'){if(!manifest.bindings?.length)throw new Error('Missing area bindings');for(const binding of manifest.bindings){await scanStore.assertCurrentMenu(binding.menu_id);const menu=await load(binding.menu_id);await requirePrivacy(binding.menu_id,menu);resolveResidentArea(menu,{profile:await loadCampus(),residentAreaId:binding.resident_area_id},true);await verifySource(menu,root);if(binding.scan_id&&await scanStore.confirmedFingerprint(binding.scan_id)!==binding.scanHash)throw new Error('Counts changed; regenerate this packet');}}
  else if(manifest.kind==='menu'&&manifest.menu_id){await scanStore.assertCurrentMenu(manifest.menu_id);const menu=await load(manifest.menu_id);await requirePrivacy(manifest.menu_id,menu);resolveResidentArea(menu,{profile:await loadCampus(),residentAreaId:manifest.resident_area_id??menu.facility},true);await verifySource(menu,root);if(manifest.fingerprint!==privacyFingerprint(menu))throw new Error('Packet revision mismatch');}
  else if(manifest.kind!=='work-area'&&manifest.kind!=='blank-worksheet')throw new Error('Unverified packet');
  if(manifest.scan_id&&await scanStore.confirmedFingerprint(manifest.scan_id)!==manifest.scanHash)throw new Error('Counts changed; regenerate this packet');
  const bytes = await fs.readFile(path.join(data,'packets',`${id}.pdf`));
  return {contents:[{uri:uri.href,mimeType:'application/pdf',blob:bytes.toString('base64')}]};
});
registerScanTools({server,root,data,store:scanStore,loadMenu:load,loadCampus,requirePrivacy,sourceFile,pdfResult});
await server.connect(new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:2*1024*1024}));
