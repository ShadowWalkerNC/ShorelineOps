import { useEffect,useRef,useState } from 'react'
import { api } from '../../api/client'
type Area={id:string;name:string}
type Menu={facility:string;week:number;startDate:string;days:{date:{value:string};meals:Record<'breakfast'|'lunch'|'dinner',Record<'a'|'b',{text:{value:string}}>>}[]}
type CountReview={hash:string;overview:{date:string;meals:Record<string,Record<string,number|null>>}[]}
type Format='weekly'|'daily'|'complete'|'prep-list'|'meal-service'
const review={source_content_reviewed:true,source_filename_reviewed:true,resident_information_found:false}
const control='min-h-[48px] rounded border border-gray-400 bg-white px-3 text-gray-900 w-full'
export default function PaperworkTab(){
 const [areas,setAreas]=useState<Area[]>([]),[area,setArea]=useState(''),[format,setFormat]=useState<Format>('weekly')
 const [date,setDate]=useState(()=>new Date().toLocaleDateString('en-CA')),[extras,setExtras]=useState<string[]>([])
 const [privacy,setPrivacy]=useState(false),[approved,setApproved]=useState(false),[transfer,setTransfer]=useState<unknown>()
 const [menu,setMenu]=useState<Menu>(),[hash,setHash]=useState(''),[flags,setFlags]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [sourceImage,setSourceImage]=useState(''),[countSource,setCountSource]=useState(''),[countReview,setCountReview]=useState<CountReview|null>(null),[countsApproved,setCountsApproved]=useState(false),[alerts,setAlerts]=useState<string[]>([])
 const [html,setHtml]=useState(''),[pages,setPages]=useState(0),frame=useRef<HTMLIFrameElement>(null)
 const [renderedPreview,setRenderedPreview]=useState(true)
 function fitPreview(){const element=frame.current,root=element?.contentDocument?.documentElement;if(element&&root)root.style.setProperty('--paperwork-scale',String(Math.min(1,element.clientWidth/(7.7*96))))}
 useEffect(()=>{const element=frame.current;if(!element)return;const observer=new ResizeObserver(fitPreview);observer.observe(element);return()=>observer.disconnect()},[html])
 useEffect(()=>{api.get('/paperwork/catalog').then(r=>{setAreas(r.data.areas);setArea(previous=>r.data.areas.some((a:Area)=>a.id===previous)?previous:(r.data.areas[0]?.id??''))}).catch(()=>setError('Connect the ShorelineOps service and complete facility setup before importing or printing paperwork. The demo site cannot process your files.'))},[])
 const blank=format==='prep-list'||format==='meal-service'
 function reset(){setHtml('');setApproved(false);setCountsApproved(false)}
 async function loadFile(file:File|undefined){
  reset();setMenu(undefined);setTransfer(undefined);setHash('');setSourceImage('');setCountSource('');setCountReview(null);setAlerts([]);if(!file)return
  if(!privacy){setError('Confirm that the file and source contain no resident information before importing.');return}
  if(file.size>900000){setError('Use a menu transfer file under 900 KB. Reduce the source image before extraction/export if necessary.');return}
  setBusy(true);setError('')
  try{
   const input=JSON.parse(await file.text()) as unknown
   const {data}=await api.post('/paperwork/inspect',{transfer:input,privacy_review:review})
   reset()
   setTransfer(data.transfer);setMenu(data.menu);setHash(data.menuHash);setFlags(data.readiness.review_flags);setCountReview(data.countReview);setAlerts(data.alerts)
   const source=data.transfer.source as {extension:string;base64:string}
   setSourceImage(source.extension==='pdf'?'':`data:image/${source.extension==='jpg'?'jpeg':'png'};base64,${source.base64}`)
   const countSource=data.transfer.counts?.source as {extension:string;base64:string}|undefined
   if(countSource)setCountSource(`data:${countSource.extension==='pdf'?'application/pdf':`image/${countSource.extension==='jpg'?'jpeg':'png'}`};base64,${countSource.base64}`)
   setDate(data.menu.startDate)
  }catch{setError('Import failed. Use an exported redacted menu file from the ShorelineOps companion; photos require extraction and review in the plugin first.')}
  finally{setBusy(false)}
 }
 async function generate(preview:boolean){
  setBusy(true);setError('');setHtml('')
  try{
   const payload={format,areaId:area,preview,...((blank||format==='daily')?{date}:{}),...(format==='daily'?{extras}:{}),...(!blank?{transfer,privacy_review:review,expectedHash:hash,confirmedAll42:approved,...(countsApproved&&countReview?{confirmedCountsHash:countReview.hash}:{})}:{})}
   const {data}=await api.post('/paperwork/render',payload);setHtml(data.html);setPages(data.pages);setRenderedPreview(data.preview)
  }catch{setError('Generation failed. Check this area’s menu, selected date and review confirmation.')}
  finally{setBusy(false)}
 }
 return <section className="space-y-4" aria-label="Kitchen paperwork">
  <div className="flex gap-3 items-start"><img src={`${import.meta.env.BASE_URL}icon-192.png`} width="48" height="48" alt="ShorelineOps"/><div><h2 className="text-xl font-semibold">Kitchen paperwork</h2><p>Print resident-selection masters, tallies, cook sheets and blank prep forms. Import reviewed counts when available; otherwise counts stay blank. Resident details stay blank.</p></div></div>
  <ol aria-label="Paperwork steps" className="flex flex-wrap gap-4 text-sm"><li>1. Choose your area</li><li>2. Import and review</li><li>3. Confirm and print</li></ol>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  <div className="grid gap-4 sm:grid-cols-2">
   <label>Resident area<select aria-label="Resident area" disabled={busy} className={control} value={area} onChange={e=>{setArea(e.target.value);reset()}}>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   <label>Paperwork<select aria-label="Paperwork" disabled={busy} className={control} value={format} onChange={e=>{setFormat(e.target.value as Format);setHtml('')}}>
    <option value="weekly">Weekly selection + tally — 2 pages</option><option value="daily">Daily cook sheets — 3 pages</option><option value="prep-list">Blank prep list — 1 page</option><option value="meal-service">Blank meal-service sheet — 1 page</option><option value="complete">Complete week — 44 pages</option>
   </select></label>
  </div>
  {!blank&&<div className="space-y-3">
   <p>In the ShorelineOps companion, review your redacted menu and ask “Export this menu for ShorelineOps.” Import that menu file here. Each area needs its own menu.</p>
   <label className="flex min-h-[48px] items-center gap-3"><input type="checkbox" checked={privacy} disabled={busy} onChange={e=>{setPrivacy(e.target.checked);setTransfer(undefined);setMenu(undefined);reset()}}/>I reviewed the source, filename and menu file, including any count scans; none contains resident information.</label>
   <label className="block">Reviewed menu file<input aria-label="Reviewed menu file" className={control+' py-3'} type="file" accept=".srmenu" disabled={!privacy||busy} onChange={e=>void loadFile(e.target.files?.[0])}/></label>
   {menu&&<>{alerts.map(alert=><p role="status" key={alert}>{alert}</p>)}<p role="status">Week {menu.week} · {menu.startDate} · 7 days · 42 choices · {flags} review flags · {approved?'source review confirmed':'approval pending until confirmed below'}</p>
    <details><summary className="min-h-[48px] cursor-pointer py-3">Review the original menu and all choices</summary>
     {sourceImage?<img src={sourceImage} alt="Original redacted menu source" className="max-w-full"/>:<p>Compare with the original PDF source supplied in the plugin.</p>}
     {menu.days.map(day=><section key={day.date.value} className="border-b py-3"><h3 className="font-semibold">{day.date.value}</h3>{(['breakfast','lunch','dinner'] as const).map(meal=><div key={meal}><strong>{meal}</strong><p>A: {day.meals[meal].a.text.value}</p><p>B: {day.meals[meal].b.text.value}</p></div>)}</section>)}
    </details>
    {countReview&&<section aria-label="Imported counts" className="space-y-3">
     <h3 className="font-semibold">Review imported counts</h3>
     <p>Compare every number with the redacted scan. Staff and extras are unallocated; component quantities remain blank.</p>
     {countSource.startsWith('data:application/pdf')?<a href={countSource} download="redacted-count-source.pdf" className="inline-block min-h-[48px] underline py-3">Download count source PDF to review</a>:countSource&&<img src={countSource} alt="Redacted count source" className="max-w-full"/>}
     {countReview.overview.map(day=><section key={day.date} className="border-b py-2"><h4 className="font-semibold">{day.date}</h4>{Object.entries(day.meals).map(([meal,values])=><p key={meal}>{meal}: {Object.entries(values).map(([key,value])=>`${key.toUpperCase()} ${value??'blank'}`).join(' / ')}</p>)}</section>)}
     <label className="flex min-h-[48px] items-center gap-3"><input type="checkbox" checked={countsApproved} disabled={busy||area!==menu.facility} onChange={e=>{setCountsApproved(e.target.checked);setHtml('')}}/>I compared all imported counts with the source and confirm them for this menu revision and area.</label>
    </section>}
    {area!==menu.facility&&<p role="alert">This file belongs to another area. Import this area’s own menu.</p>}
    <label className="flex min-h-[48px] items-center gap-3"><input type="checkbox" checked={approved} disabled={busy||flags>0||area!==menu.facility} onChange={e=>{setApproved(e.target.checked);setHtml('')}}/>I checked all 42 choices, dates and components against the original and approve this revision for printing.</label>
   </>}
  </div>}
  {(blank||format==='daily')&&<label className="block max-w-sm">Date<input type="date" disabled={busy} className={control} value={date} onChange={e=>{setDate(e.target.value);setHtml('')}}/></label>}
  {format==='daily'&&<fieldset className="flex flex-wrap gap-4" disabled={busy}><legend>Optional extra pages</legend>{['summary','prep','dessert'].map(extra=><label key={extra} className="flex min-h-[48px] items-center gap-2"><input type="checkbox" checked={extras.includes(extra)} onChange={e=>{setExtras(e.target.checked?[...extras,extra]:extras.filter(x=>x!==extra));setHtml('')}}/>{extra}</label>)}</fieldset>}
  <div className="flex flex-wrap gap-3">
   <button className={control+' sm:w-auto'} disabled={busy||!areas.length||(!blank&&(!transfer||!privacy||area!==menu?.facility))} onClick={()=>void generate(true)}>Preview</button>
   <button className={control+' sm:w-auto'} disabled={busy||!areas.length||(!blank&&(!approved||(!!countReview&&!countsApproved)||!privacy||flags>0||area!==menu?.facility))} onClick={()=>void generate(false)}>Prepare printable pages</button>
   {html&&<button className={control+' sm:w-auto'} onClick={()=>{frame.current?.contentWindow?.focus();frame.current?.contentWindow?.print()}}>{renderedPreview?'Print draft / Save as PDF':'Print / Save as PDF'} — {pages} {pages===1?'page':'pages'}</button>}
  </div>
  {html&&<><p role="status">{renderedPreview?'Review draft — not for production.':'Printable pages prepared.'} {pages} {pages===1?'page':'pages'}. Choose US Letter and 100% scale. Browser print and PDF saving depend on your device.</p><iframe ref={frame} title="Paperwork print preview" sandbox="allow-same-origin allow-modals" onLoad={fitPreview} srcDoc={html.replace('</head>','<style>@media screen { .packet { zoom:var(--paperwork-scale,1); } }</style></head>')} className="w-full border" style={{height:'70vh',background:'white'}}/></>}
 </section>
}
