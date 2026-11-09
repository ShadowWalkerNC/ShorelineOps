import { z } from 'zod';
import { createHash } from 'node:crypto';
import { MenuSchema, type Menu } from '../schema/index.js';
import { ScanInputSchema,validateScanDates,confirmScan,countsFromScan,scanOverview,type ScanRecord } from '../production/scans.js';
import { menuContentHash,validateMenu } from '../validation/index.js';
const CountTransferSchema=z.object({menuHash:z.string().regex(/^[a-f0-9]{64}$/),areaId:z.string(),input:ScanInputSchema,source:z.object({extension:z.enum(['jpg','png','pdf']),base64:z.string().max(4*1024*1024),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()}).strict();
const TransferSchema=z.object({format:z.literal('ross-paperwork-menu'),version:z.union([z.literal(1),z.literal(2)]),menu:MenuSchema,source:z.object({extension:z.enum(['jpg','png','pdf']),base64:z.string().max(4*1024*1024)}).strict(),counts:CountTransferSchema.optional()}).strict();
function extensionOf(bytes:Buffer):'jpg'|'png'|'pdf'{
  if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return 'jpg';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
  if(bytes.subarray(0,5).toString()==='%PDF-')return 'pdf';
  throw new Error('Unsupported source image/PDF');
}
export function createTransfer(menu:Menu,bytes:Buffer,scan?:{record:ScanRecord;bytes:Buffer}){
  const extension=extensionOf(bytes),copy=structuredClone(menu),file=`menu-source.${extension}`;
  if(createHash('sha256').update(bytes).digest('hex')!==menu.source.sha256)throw new Error('Source mismatch');
  const visit=(value:unknown):void=>{if(!value||typeof value!=='object')return;const object=value as Record<string,unknown>;
    if(object.source&&typeof object.source==='object'&&'file' in object.source)(object.source as {file:string}).file=file;
    for(const child of Object.values(object))visit(child);
  };visit(copy);copy.source.file=file;copy.approval=null;
  let counts;
  if(scan){countsFromScan(scan.record,menu,menu.facility);const sha256=createHash('sha256').update(scan.bytes).digest('hex');if(sha256!==scan.record.source.sha256)throw new Error('Count source mismatch');counts={menuHash:menuContentHash(copy),areaId:menu.facility,input:scan.record.input,source:{extension:extensionOf(scan.bytes),base64:scan.bytes.toString('base64'),sha256}};}
  return readTransfer({format:'ross-paperwork-menu',version:scan?2:1,menu:copy,source:{extension,base64:bytes.toString('base64')},...(counts?{counts}:{})}).transfer;
}
export function readTransfer(input:unknown){
  const transfer=TransferSchema.parse(input),{source}=transfer;
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(source.base64))throw new Error('Invalid source encoding');
  const bytes=Buffer.from(source.base64,'base64');
  if(extensionOf(bytes)!==source.extension||createHash('sha256').update(bytes).digest('hex')!==transfer.menu.source.sha256)throw new Error('Source integrity mismatch');
  if(transfer.menu.source.file!==`menu-source.${source.extension}`)throw new Error('Source paths are not accepted');
  transfer.menu.approval=null; // Imported approval never carries across applications.
  const valid=validateMenu(transfer.menu);if(!valid.ok)throw new Error('Invalid menu dates, options or component agreement');
  if(transfer.version===1&&transfer.counts)throw new Error('Counts require transfer version 2');
  let countReview;
  if(transfer.counts){
    const bundle=transfer.counts;
    if(bundle.areaId!==valid.menu.facility||bundle.menuHash!==menuContentHash(valid.menu))throw new Error('Counts belong to another menu or area');
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bundle.source.base64))throw new Error('Invalid count source encoding');
    const scanBytes=Buffer.from(bundle.source.base64,'base64');
    if(extensionOf(scanBytes)!==bundle.source.extension||createHash('sha256').update(scanBytes).digest('hex')!==bundle.source.sha256)throw new Error('Count source integrity mismatch');
    validateScanDates(bundle.input,valid.menu);
    const scan:ScanRecord={id:'transfer-validation',menuId:'transfer',menuHash:bundle.menuHash,areaId:bundle.areaId,input:bundle.input,source:{file:`count-source.${bundle.source.extension}`,sha256:bundle.source.sha256},createdAt:'',confirmation:null};
    // A fresh destination confirmation is required; this validation is not an imported approval.
    const counts=countsFromScan(confirmScan(scan,'transfer-validation'),valid.menu,bundle.areaId);
    countReview={hash:createHash('sha256').update(JSON.stringify(bundle)).digest('hex'),overview:scanOverview(scan.input),counts};
  }
  return {transfer,menu:valid.menu,bytes,countReview};
}
