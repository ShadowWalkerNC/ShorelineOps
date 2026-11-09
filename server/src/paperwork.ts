import path from 'node:path'
import { pool } from './db/pool'
import { z } from 'zod'
export interface PaperMenu {
  facility:string;week:number;startDate:string;approval:unknown
  days:{date:{value:string}}[]
}
export type PaperCounts={menuHash:string;areaId:string;days:Record<string,Record<string,{a:number;b:number;staff?:number;extra?:number}>>}
interface Engine {
  readTransfer(input:unknown):{menu:PaperMenu;transfer:unknown;bytes:Buffer;countReview?:{hash:string;overview:unknown[];counts:PaperCounts}}
  menuContentHash(menu:PaperMenu):string
  readiness(menu:PaperMenu,privacy:boolean):{ready_for_approval:boolean;review_flags:number}
  assertApproved(menu:PaperMenu):void
  buildPacketHtml(menu:PaperMenu,options:unknown):string
  buildRossWorksheetHtml(profile:unknown,areaId:string,date:string,format:string,preview:boolean):string
}
// Generated from the standalone plugin, with no Chromium or clinical dependency.
export const paperworkEngine:Engine=require(path.resolve(__dirname,'../vendor/ross-paperwork/engine.cjs'))
export const paperworkCampus:{residentAreas:{id:string;name:string;active:boolean}[]}=require(path.resolve(__dirname,'../vendor/ross-paperwork/campus.json'))
export const paperworkVersion:string=require(path.resolve(__dirname,'../vendor/ross-paperwork/manifest.json')).version

export type PaperworkCampus={schemaVersion:1;name:string;status:'draft'|'confirmed';confirmedBy:string|null;residentAreasConfirmedBy?:string;source:string;residentAreas:{id:string;name:string;active:boolean}[];kitchens:unknown[];workAreas:unknown[];sharedMenus:unknown[]}
export function campusFromFacility(input:unknown):PaperworkCampus {
 const config=z.object({facility_name:z.string().trim().min(1).max(80),is_initialized:z.union([z.literal(true),z.literal(1)]),wings:z.unknown()}).parse(input)
 const value=typeof config.wings==='string'?JSON.parse(config.wings):config.wings
 const names=z.array(z.string().trim().min(1).max(80)).min(1).max(100).parse(value)
 const areas=names.map(name=>({id:name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''),name,active:true}))
 if(areas.some(area=>!(/^[a-z][a-z0-9_-]{0,63}$/).test(area.id))||new Set(areas.map(area=>area.id)).size!==areas.length)throw new Error('Service areas need distinct supported names in facility settings')
 return {schemaVersion:1,name:config.facility_name,status:'confirmed',confirmedBy:'Saved ShorelineOps facility setup',residentAreasConfirmedBy:'Saved ShorelineOps facility setup',source:'Service-area names from this deployment�s initialized facility setup; no routes or sharing inferred',residentAreas:areas,kitchens:[],workAreas:[],sharedMenus:[]}
}
export async function loadPaperworkCampus():Promise<PaperworkCampus>{
 const {rows}=await pool.query('SELECT facility_name, wings, is_initialized FROM facility_config WHERE id = $1',['default'])
 return campusFromFacility(rows[0])
}
