import { countPacketPages,checkNoExternalRefs } from './index.js';
export function combinePackets(packets:{areaId:string;startDate:string;html:string}[]):string{
 if(packets.length<2||packets.length>20)throw new Error('Select between two and twenty independent areas');
 if(new Set(packets.map(packet=>packet.areaId)).size!==packets.length)throw new Error('Choose each area only once');
 if(new Set(packets.map(packet=>packet.startDate)).size!==1)throw new Error('Combined area packets must cover the same menu week');
 const bodies=packets.map(packet=>{checkNoExternalRefs(packet.html);const match=packet.html.match(/<body><div class="packet"[^>]*>([\s\S]*)<\/div><\/body><\/html>/);if(!match)throw new Error('Invalid packet structure');return match[1]!;});
 const last=packets[0]!.html.lastIndexOf('</div></body></html>');
 const first=packets[0]!.html.indexOf('<body>');
 const head=packets[0]!.html.slice(0,first).replace(/<title>[\s\S]*?<\/title>/,'<title>Combined kitchen paperwork</title>');
 const combined=head+`<body><div class="packet">${bodies.join('\n')}</div></body></html>`;
 if(last<0||countPacketPages(combined)>200)throw new Error('Combined packet exceeds the 200-page print limit');
 return combined;
}
