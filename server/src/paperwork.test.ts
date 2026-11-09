import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createPaperworkRouter } from './routes/paperwork'
import { paperworkEngine as engine,campusFromFacility } from './paperwork'
import type { AuthRequest,ApiRole } from './middleware/requireAuth'

function syntheticTransfer(){
 const bytes=Buffer.from('%PDF-SYNTHETIC-ONLY'),file='menu-source.pdf'
 const field=(value:string)=>({originalText:value,value,confidence:null,needsReview:false,source:{file,cell:'synthetic'}})
 const option=()=>({text:field('Synthetic food'),items:[{text:field('Synthetic food'),kind:'unspecified'}]})
 const menu={schemaVersion:1,facility:'sylvia_ross',week:1,startDate:'2026-10-25',source:{file,sha256:createHash('sha256').update(bytes).digest('hex')},metadata:{week:field('1'),startDate:field('2026-10-25')},days:Array.from({length:7},(_,i)=>({date:field(`2026-10-${25+i}`),meals:{breakfast:{a:option(),b:option()},lunch:{a:option(),b:option()},dinner:{a:option(),b:option()}}})),approval:null}
 return {format:'ross-paperwork-menu',version:1,menu,source:{extension:'pdf',base64:bytes.toString('base64')}}
}
test('paperwork adapter enforces capability, privacy, source, area and exact-revision approval',async t=>{
 const app=express();app.use(express.json({limit:'1mb'}));app.use((req:AuthRequest,_res,next)=>{req.userRole=(req.headers['x-test-role']??'dietary') as ApiRole;req.userId='SYNTHETIC';next()});app.use('/paperwork',createPaperworkRouter(async()=>campusFromFacility({facility_name:'Synthetic campus',is_initialized:true,wings:['Ross Manor','Sylvia Ross','Engel Place']})))
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())))
 const address=server.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}/paperwork`
 const call=(route:string,body:unknown,role='dietary')=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','x-test-role':role},body:JSON.stringify(body)})
 const transfer=syntheticTransfer(),privacy_review={source_content_reviewed:true,source_filename_reviewed:true,resident_information_found:false}
 assert.equal((await call('/inspect',{transfer,privacy_review},'distributor')).status,403)
 assert.equal((await call('/inspect',{transfer,privacy_review},'readonly')).status,403)
 assert.equal((await call('/inspect',{transfer})).status,400)
 const inspected=await call('/inspect',{transfer,privacy_review});assert.equal(inspected.status,200);const data=await inspected.json() as {menuHash:string;menu:{approval:unknown}}
 assert.equal(data.menu.approval,null)
 const render={format:'weekly',areaId:'sylvia_ross',transfer,privacy_review}
 const preview=await call('/render',render);assert.equal(preview.status,200);const draft=await preview.json() as {pages:number;html:string};assert.equal(draft.pages,2);assert.match(draft.html,/REVIEW ONLY/)
 assert.equal((await call('/render',{...render,areaId:'ross_manor'})).status,400)
 assert.equal((await call('/render',{...render,preview:false})).status,400)
 assert.equal((await call('/render',{...render,preview:false,confirmedAll42:true,expectedHash:'a'.repeat(64)})).status,400)
 const final=await call('/render',{...render,preview:false,confirmedAll42:true,expectedHash:data.menuHash});assert.equal(final.status,200);assert.doesNotMatch((await final.json() as {html:string}).html,/REVIEW ONLY/)
 const flagged=structuredClone(transfer);flagged.menu.days[0]!.date.needsReview=true
 assert.equal((await call('/render',{...render,transfer:flagged,preview:false,confirmedAll42:true,expectedHash:engine.menuContentHash(engine.readTransfer(flagged).menu)})).status,400)
 const bad=structuredClone(transfer);bad.source.base64=Buffer.from('%PDF-tampered').toString('base64');assert.equal((await call('/inspect',{transfer:bad,privacy_review})).status,400)
 for(const format of ['prep-list','meal-service']){const blank=await call('/render',{format,areaId:'ross_manor',date:'2026-10-29',preview:false});assert.equal(blank.status,200);assert.equal((await blank.json() as {pages:number}).pages,1)}
 assert.equal((await call('/render',{format:'prep-list',areaId:'ross_manor',date:'2026-02-30'})).status,400)
 const countBytes=Buffer.from('%PDF-SYNTHETIC-COUNTS'),field=(value:number)=>({originalText:String(value),value,confidence:0.99,needsReview:false,cell:'synthetic cell'}),meal=()=>({a:field(0),b:field(12)})
 const counted={...transfer,version:2,counts:{menuHash:data.menuHash,areaId:'sylvia_ross',input:{kind:'tally',scope:'day',days:[{date:'2026-10-25',meals:{breakfast:meal(),lunch:meal(),dinner:meal()}}]},source:{extension:'pdf',base64:countBytes.toString('base64'),sha256:createHash('sha256').update(countBytes).digest('hex')}}}
 const countInspect=await call('/inspect',{transfer:counted,privacy_review});assert.equal(countInspect.status,200)
 const countData=await countInspect.json() as {countReview:{hash:string};alerts:string[]};assert.ok(countData.alerts.length)
 const countedRender={...render,format:'daily',date:'2026-10-25',transfer:counted,preview:false,confirmedAll42:true,expectedHash:data.menuHash}
 assert.equal((await call('/render',countedRender)).status,400)
 assert.equal((await call('/render',{...countedRender,confirmedCountsHash:'a'.repeat(64)})).status,400)
 const countFinal=await call('/render',{...countedRender,confirmedCountsHash:countData.countReview.hash});assert.equal(countFinal.status,200)
 const countHtml=await countFinal.json() as {html:string;pages:number};assert.equal(countHtml.pages,3);assert.match(countHtml.html,/Option A[\s\S]*?blank-line">0<\/span>/);assert.match(countHtml.html,/Option B[\s\S]*?blank-line">12<\/span>/)
 const changed=structuredClone(counted);changed.counts.input.days[0]!.meals.breakfast.a.value=1
 assert.equal((await call('/render',{...countedRender,transfer:changed,confirmedCountsHash:countData.countReview.hash})).status,400)
 assert.equal((await call('/render',{...countedRender,date:'2026-10-26',confirmedCountsHash:countData.countReview.hash})).status,400)
 const mismatched=structuredClone(counted);mismatched.counts.areaId='ross_manor';assert.equal((await call('/inspect',{transfer:mismatched,privacy_review})).status,400)
 const unresolved=structuredClone(counted);unresolved.counts.input.days[0]!.meals.breakfast.a.needsReview=true;assert.equal((await call('/inspect',{transfer:unresolved,privacy_review})).status,400)

})

test('paperwork areas come from saved facility configuration and fail closed on ambiguous setup',()=>{
 assert.equal(campusFromFacility({facility_name:'SQLite facility',is_initialized:1,wings:['East']}).residentAreas[0]?.id,'east')
 const campus=campusFromFacility({facility_name:'Cedar Hospital',is_initialized:true,wings:JSON.stringify(['Cedar East','Cedar West'])})
 assert.deepEqual(campus.residentAreas.map(area=>area.id),['cedar_east','cedar_west'])
 assert.throws(()=>campusFromFacility({facility_name:'Cedar',is_initialized:false,wings:['East']}))
 assert.throws(()=>campusFromFacility({facility_name:'Cedar',is_initialized:true,wings:['East Wing','East-Wing']}))
 assert.throws(()=>campusFromFacility({facility_name:'Cedar',is_initialized:true,wings:[]}))
 assert.throws(()=>campusFromFacility(undefined))
})
