import { Router } from 'express'
import { z } from 'zod'
import type { AuthRequest } from '../middleware/requireAuth'
import { requireCapability } from '../middleware/permissions'
import { paperworkEngine as engine,loadPaperworkCampus,paperworkVersion,type PaperworkCampus } from '../paperwork'

export function createPaperworkRouter(getCampus:()=>Promise<PaperworkCampus>=loadPaperworkCampus){
const paperworkRouter=Router()
paperworkRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next()})
paperworkRouter.get('/catalog',requireCapability('production.read'),async(_req,res)=>{try{const campus=await getCampus();res.json({version:paperworkVersion,facility:campus.name,areas:campus.residentAreas.filter(area=>area.active),counts:'optional-reviewed-transfer',weeklyPages:2,dailyPages:3,completePages:44})}catch{res.status(503).json({error:'Complete facility setup with distinct service-area names before using paperwork.'})}})
const privacy=z.object({source_content_reviewed:z.literal(true),source_filename_reviewed:z.literal(true),resident_information_found:z.literal(false)}).strict()
const importSchema=z.object({transfer:z.unknown(),privacy_review:privacy}).strict()
paperworkRouter.post('/inspect',requireCapability('production.write'),async(req,res)=>{
  try{
    const campus=await getCampus();
    const input=importSchema.parse(req.body),{menu,transfer,countReview}=engine.readTransfer(input.transfer)
    if(!campus.residentAreas.some(area=>area.active&&area.id===menu.facility))throw new Error('Area unavailable')
    res.json({menu,transfer,menuHash:engine.menuContentHash(menu),readiness:engine.readiness(menu,true),countReview:countReview??null,alerts:['Transfers are offline snapshots. Re-export after any menu or count change; previously downloaded files cannot detect later revisions.',...(countReview?['Compare counts with the attached redacted source and confirm again before production.']:['No counts supplied; count fields remain blank.'])]})
  }catch{res.status(400).json({error:'Use a valid redacted menu transfer file. Review source privacy, seven dates and all 42 choices.'})}
})
const renderSchema=z.object({
  format:z.enum(['weekly','daily','complete','prep-list','meal-service']),areaId:z.string().min(1).max(64),date:z.string().optional(),
  extras:z.array(z.enum(['summary','prep','dessert'])).max(3).default([]),preview:z.boolean().default(true),
  transfer:z.unknown().optional(),privacy_review:privacy.optional(),expectedHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),confirmedAll42:z.boolean().default(false),confirmedCountsHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict()
paperworkRouter.post('/render',requireCapability('production.write'),async(req:AuthRequest,res)=>{
  try{
    const campus=await getCampus();
    const input=renderSchema.parse(req.body)
    if(!campus.residentAreas.some(area=>area.active&&area.id===input.areaId))throw new Error('Area unavailable')
    let html:string
    if(input.format==='prep-list'||input.format==='meal-service'){
      if(input.transfer!==undefined||input.extras.length)throw new Error('Blank sheets do not accept menu content')
      html=engine.buildRossWorksheetHtml(campus,input.areaId,input.date??'',input.format,input.preview)
    }else{
      privacy.parse(input.privacy_review)
      const {menu,countReview}=engine.readTransfer(input.transfer)
      if(menu.facility!==input.areaId)throw new Error('Each area needs its own menu')
      const hash=engine.menuContentHash(menu)
      if(!input.preview){
        if(countReview&&input.confirmedCountsHash!==countReview.hash)throw new Error('Current count confirmation required');
        if(!input.confirmedAll42||input.expectedHash!==hash)throw new Error('Current source review confirmation required')
        menu.approval={reviewer:req.userId??'authenticated-reviewer',approvedAt:new Date().toISOString(),menuHash:hash}
        engine.assertApproved(menu)
      }
      if(input.format!=='daily'&&(input.date!==undefined||input.extras.length))throw new Error('Daily date/extras only')
      const selection=input.format==='daily'?{kind:'daily',date:input.date,extras:input.extras}:{kind:input.format}
      html=engine.buildPacketHtml(menu,{preview:input.preview,selection,counts:countReview?.counts})
    }
    res.json({html,pages:(html.match(/class="page"/g)||[]).length,preview:input.preview})
  }catch{res.status(400).json({error:'Paperwork could not be generated. Check the area, date, privacy review and current menu/count confirmations. Areas cannot silently share menus.'})}
})

return paperworkRouter
}
export const paperworkRouter=createPaperworkRouter()
