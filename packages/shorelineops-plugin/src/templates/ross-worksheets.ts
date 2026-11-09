import { escapeHtml } from './html.js';

export type RossWorksheet = 'prep-list' | 'meal-service';
export function renderRossWorksheet(kind:RossWorksheet,areaName:string,date:string,legacyColumns=false):string {
  const header=(title:string,code:string)=>`<div class="sheet-head"><div><p class="facility">${escapeHtml(areaName)}</p><p class="sheet-title">${code} - ${title}</p><p class="sheet-sub">Date: ${escapeHtml(date)}</p></div><div class="sheet-meta">Staff initials ______</div></div>`;
  const rows=(count:number,columns:number)=>Array.from({length:count},()=>`<tr>${'<td style="height:0.28in">&nbsp;</td>'.repeat(columns)}</tr>`).join('');
  const quantityHeaders=legacyColumns?'<th>Ross</th><th>Sylvia</th><th>EP</th>':'<th>Qty</th>';
  const quantityCols=legacyColumns?'<col style="width:0.55in"><col style="width:0.55in"><col style="width:0.55in">':'<col style="width:1in">';
  const prepSection=(title:string,color:string,count:number)=>`<section style="margin-top:0.12in"><h3 class="section-heading ${color}" style="margin:0">${title}</h3><table class="grid"><colgroup><col>${quantityCols}<col style="width:0.85in"></colgroup><thead><tr><th>Item / task</th>${quantityHeaders}<th>Initials</th></tr></thead><tbody>${rows(count,legacyColumns?5:3)}</tbody></table></section>`;
  if(kind==='prep-list')return header('Daily Prep List','RM-10')+`<p class="band-specials" style="padding:0.06in;margin:0.08in 0">Check salad fixings before: ______ &nbsp; Questions / contact: ______<br>Double-check this list.${legacyColumns?' Ross = Ross Manor; Sylvia = Sylvia Ross; EP = Engel Place.':' Quantities apply to the selected service area only.'}</p>`+
    prepSection('Breakfast','meal-breakfast',4)+prepSection('Lunch','meal-lunch',4)+prepSection('Dinner','meal-dinner',4)+
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.12in">${prepSection('Early pulls - section 1','band-prep',3)}${prepSection('Early pulls - section 2','band-prep',3)}</div>`+
    `<p style="margin-top:0.12in">Notes / handover: ____________________________________________________</p>`;
  if(kind!=='meal-service')throw new Error('Unknown worksheet');
  const column=(meal:string,color:string)=>`<section style="border:1px solid #111;padding:0.08in"><h3 class="${color}" style="margin:0 0 0.12in;padding:0.06in;text-align:center">${meal}</h3><p>Foods / accompaniments</p>${'<div style="height:0.43in;border-bottom:1px solid #777">&nbsp;</div>'.repeat(9)}<p style="margin-top:0.18in">Drinks</p>${'<div style="height:0.38in;border-bottom:1px solid #777">&nbsp;</div>'.repeat(3)}<p style="margin-top:0.22in">Service initials ______</p><p>Time ______</p></section>`;
  return header('Blank Meal-Service Worksheet','RM-11')+`<p>No resident information. Complete menu/service details manually.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.1in">${column('Breakfast','meal-breakfast')}${column('Lunch','meal-lunch')}${column('Dinner','meal-dinner')}</div><p style="margin-top:0.18in">General handover: __________________________________________________</p>`;
}
