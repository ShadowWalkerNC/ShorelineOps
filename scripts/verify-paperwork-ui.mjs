import { createServer as createVite } from 'vite'
import { chromium } from 'playwright'
import express from 'express'
import { createRequire } from 'node:module'
import { promises as fs } from 'node:fs'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
const require=createRequire(import.meta.url)
const {createPaperworkRouter}=require('../server/dist/routes/paperwork.js')
const {campusFromFacility}=require('../server/dist/paperwork.js')
const paperworkRouter=createPaperworkRouter(async()=>campusFromFacility({facility_name:'Synthetic campus',is_initialized:true,wings:['Ross Manor','Sylvia Ross','Engel Place']}))
const app=express();app.use(express.json({limit:'1mb'}));app.use((req,_res,next)=>{req.userRole='dietary';req.userId='SYNTHETIC UI REVIEW';next()});app.use('/api/paperwork',paperworkRouter)
const api=app.listen(0,'127.0.0.1');await once(api,'listening');const address=api.address()
await fs.mkdir('docs/evidence/paperwork',{recursive:true})
const harness='.paperwork-acceptance.html'
await fs.writeFile(harness,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import React from "react";import {createRoot} from "react-dom/client";import Paperwork from "/src/features/production/PaperworkTab.tsx";import "/src/index.css";createRoot(document.getElementById("root")).render(React.createElement(Paperwork));</script></body></html>')
const vite=await createVite({server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${address.port}`}},define:{'import.meta.env.VITE_DEMO_MODE':'false'}})
await vite.listen();const port=vite.httpServer.address().port
const browser=await chromium.launch({headless:true,...(process.env.PAPERWORK_BROWSER_PATH?{executablePath:process.env.PAPERWORK_BROWSER_PATH}:{})})
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`http://127.0.0.1:${port}/${harness}`);await page.getByRole('option',{name:'Ross Manor',exact:true}).waitFor({state:'attached'})
 await page.getByLabel('Resident area').selectOption('ross_manor');await page.getByLabel('Paperwork',{exact:true}).selectOption('prep-list')
 await page.getByLabel('Date',{exact:true}).fill('2026-10-29');await page.getByRole('button',{name:'Prepare printable pages'}).click();await page.getByRole('button',{name:'Print / Save as PDF — 1 page',exact:true}).waitFor()
 const preview=page.frameLocator('iframe');await preview.getByRole('columnheader',{name:'Sylvia',exact:true}).first().waitFor()
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(150);await page.screenshot({path:`docs/evidence/paperwork/${width}.png`,fullPage:true})
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error(`Viewport overflow ${width}`)
  const child=page.frames().find(frame=>frame!==page.mainFrame());if(await child.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error(`Preview overflow ${width}`)
 }
 const child=page.frames().find(frame=>frame!==page.mainFrame());await child.evaluate(()=>{window.__printCalled=false;window.print=()=>{window.__printCalled=true}})
 await page.getByRole('button',{name:'Print / Save as PDF — 1 page',exact:true}).click();if(!await child.evaluate(()=>window.__printCalled))throw new Error('Print button did not invoke browser print')
 const bytes=Buffer.from('%PDF-SYNTHETIC-ONLY'),file='menu-source.pdf',field=value=>({originalText:value,value,confidence:null,needsReview:false,source:{file,cell:'synthetic'}}),option=()=>({text:field('Synthetic food'),items:[{text:field('Synthetic food'),kind:'unspecified'}]})
 const transfer={format:'ross-paperwork-menu',version:1,menu:{schemaVersion:1,facility:'sylvia_ross',week:1,startDate:'2026-10-25',source:{file,sha256:createHash('sha256').update(bytes).digest('hex')},metadata:{week:field('1'),startDate:field('2026-10-25')},days:Array.from({length:7},(_,i)=>({date:field(`2026-10-${25+i}`),meals:{breakfast:{a:option(),b:option()},lunch:{a:option(),b:option()},dinner:{a:option(),b:option()}}})),approval:null},source:{extension:'pdf',base64:bytes.toString('base64')}}
 await page.getByLabel('Paperwork',{exact:true}).selectOption('weekly');await page.getByLabel('Resident area',{exact:true}).selectOption('sylvia_ross');await page.getByLabel('I reviewed the source, filename and menu file').check()
 await page.getByLabel('Reviewed menu file',{exact:true}).setInputFiles({name:'synthetic.srmenu',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(transfer))})
 await page.getByText(/Week 1 · 2026-10-25/).waitFor()
 if(await page.getByRole('button',{name:'Prepare printable pages'}).isEnabled())throw new Error('Approval gate missing')
 await page.getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('button',{name:'Print draft / Save as PDF — 2 pages'}).waitFor();await page.getByText(/Review draft — not for production/).waitFor()
 await page.getByLabel('I checked all 42 choices').check();await page.getByRole('button',{name:'Prepare printable pages'}).click();await page.getByRole('button',{name:'Print / Save as PDF — 2 pages'}).waitFor()
 if(await page.frameLocator('iframe').getByText('REVIEW ONLY / NOT FOR PRODUCTION',{exact:true}).count())throw new Error('Production still draft')
 await page.getByLabel('Resident area').selectOption('ross_manor');if(await page.getByRole('button',{name:'Prepare printable pages'}).isEnabled())throw new Error('Area change retained approval')
 await page.getByLabel('Resident area').selectOption('sylvia_ross')
 const engine=require('../server/vendor/ross-paperwork/engine.cjs'),cf=value=>({originalText:String(value),value,confidence:.99,needsReview:false,cell:'synthetic cell'}),cm=()=>({a:cf(0),b:cf(12)}),countBytes=Buffer.from('%PDF-SYNTHETIC-COUNTS')
 transfer.version=2;transfer.counts={menuHash:engine.menuContentHash(transfer.menu),areaId:'sylvia_ross',input:{kind:'tally',scope:'day',days:[{date:'2026-10-25',meals:{breakfast:cm(),lunch:cm(),dinner:cm()}}]},source:{extension:'pdf',base64:countBytes.toString('base64'),sha256:createHash('sha256').update(countBytes).digest('hex')}}
 await page.getByLabel('Reviewed menu file',{exact:true}).setInputFiles({name:'counted.srmenu',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(transfer))})
 await page.getByRole('heading',{name:'Review imported counts'}).waitFor()
 await page.getByLabel('Paperwork',{exact:true}).selectOption('daily');await page.getByLabel('I checked all 42 choices').check()
 if(await page.getByRole('button',{name:'Prepare printable pages'}).isEnabled())throw new Error('Count confirmation gate missing')
 await page.getByLabel('I compared all imported counts').check();await page.getByRole('button',{name:'Prepare printable pages'}).click();await page.getByRole('button',{name:'Print / Save as PDF — 3 pages'}).waitFor()
 if(await page.frameLocator('iframe').locator('.option-count .blank-line').first().innerText()!=='0')throw new Error('Explicit zero lost')
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});await page.screenshot({path:`docs/evidence/paperwork/counts-${width}.png`,fullPage:true});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error(`Count review overflow ${width}`)}
 await page.getByLabel('Resident area').selectOption('ross_manor');if(await page.getByLabel('I compared all imported counts').isChecked())throw new Error('Area change retained count approval')

 if(errors.length)throw new Error(errors.join('; '))
 await fs.writeFile('docs/evidence/paperwork/browser.json',JSON.stringify({result:'PASS',viewports:[390,1280],blank:'1 page',weekly:'2 pages',source:'synthetic only',approvalGate:true,areaChangeClearsApproval:true,countConfirmationGate:true,explicitZero:true,countedDailyPages:3,consoleErrors:errors},null,2)+'\n')
 console.log('PASS: desktop/mobile, blank form, import, preview, explicit approval and area-change gate')
}finally{await browser.close();await vite.close();await new Promise(resolve=>api.close(resolve));await fs.rm(harness,{force:true})}
