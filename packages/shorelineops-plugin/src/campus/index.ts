import { z } from 'zod';
import type { Menu } from '../schema/index.js';
import { menuContentHash } from '../validation/index.js';
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const label = z.string().trim().min(1).max(80);
export const WorkAreaKindSchema = z.enum(['hot','cold','pull','prep','dessert','bakery','other']);
export const CampusProfileSchema = z.object({
  schemaVersion:z.literal(1),
  name:label,
  status:z.enum(['draft','confirmed']),
  confirmedBy:z.string().trim().min(1).max(120).nullable(),
  residentAreasConfirmedBy:z.string().trim().min(1).max(120).optional(),
  source:z.string().trim().min(1).max(500),
  residentAreas:z.array(z.object({id,name:label,active:z.boolean()}).strict()).min(1).max(100),
  kitchens:z.array(z.object({id,name:label,active:z.boolean()}).strict()).max(30),
  workAreas:z.array(z.object({id,name:label,kitchenId:id.nullable(),kind:WorkAreaKindSchema,active:z.boolean()}).strict()).max(100),
  sharedMenus:z.array(z.object({menuHash:z.string().regex(/^[a-f0-9]{64}$/),residentAreaIds:z.array(id).min(1).max(100),confirmedBy:label}).strict()).max(100),
}).strict().superRefine((profile,ctx)=>{
  for(const group of ['residentAreas','kitchens','workAreas'] as const) {
    const ids=profile[group].map(row=>row.id);
    if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',path:[group],message:'IDs must be unique'});
  }
  if(profile.status==='confirmed'&&!profile.confirmedBy)ctx.addIssue({code:'custom',path:['confirmedBy'],message:'Confirmed configuration requires an actual reviewer'});
  for(const [index,area] of profile.workAreas.entries()) if(area.kitchenId&&!profile.kitchens.some(kitchen=>kitchen.id===area.kitchenId))ctx.addIssue({code:'custom',path:['workAreas',index,'kitchenId'],message:'Unknown kitchen'});
  for(const [index,sharing] of profile.sharedMenus.entries()) {
    if(new Set(sharing.residentAreaIds).size!==sharing.residentAreaIds.length)ctx.addIssue({code:'custom',path:['sharedMenus',index],message:'Duplicate resident areas'});
    for(const areaId of sharing.residentAreaIds)if(!profile.residentAreas.some(area=>area.id===areaId))ctx.addIssue({code:'custom',path:['sharedMenus',index],message:'Unknown resident area'});
  }
});
export type CampusProfile = z.infer<typeof CampusProfileSchema>;
export type WorkAreaKind = z.infer<typeof WorkAreaKindSchema>;
export type CampusScope = { profile:CampusProfile; residentAreaId:string };
export function resolveResidentArea(menu:Menu,scope:CampusScope,preview:boolean) {
  const profile=CampusProfileSchema.parse(scope.profile);
  const area=profile.residentAreas.find(area=>area.id===scope.residentAreaId&&area.active);
  if(!area)throw new Error('Unknown or inactive resident area');
  if(!preview&&profile.status!=='confirmed'&&!profile.residentAreasConfirmedBy)throw new Error('Resident-area configuration requires confirmation before production');
  if(area.id!==menu.facility) {
    const sharing=profile.sharedMenus.find(binding=>binding.menuHash===menuContentHash(menu)&&binding.residentAreaIds.includes(area.id));
    if(!sharing||(profile.status!=='confirmed'&&!profile.residentAreasConfirmedBy))throw new Error('This menu is not assigned to the selected area; use its own verified menu or explicitly confirm menu sharing');
  }
  return {profile,area,shared:area.id!==menu.facility};
}
export function resolveWorkArea(profileInput:CampusProfile,workAreaId:string,preview:boolean) {
  const profile=CampusProfileSchema.parse(profileInput);
  if(!preview&&profile.status!=='confirmed')throw new Error('Work-area configuration requires confirmation before production');
  const area=profile.workAreas.find(area=>area.id===workAreaId&&area.active);
  if(!area)throw new Error('Unknown or inactive work area');
  const kitchen=area.kitchenId?profile.kitchens.find(kitchen=>kitchen.id===area.kitchenId&&kitchen.active):undefined;
  if(area.kitchenId&&!kitchen)throw new Error('Work area belongs to an inactive kitchen');
  return {profile,area,kitchen};
}