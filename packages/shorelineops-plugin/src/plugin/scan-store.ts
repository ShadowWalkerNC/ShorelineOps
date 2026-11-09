import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ScanInputSchema,scanHash,scanIssues,type ScanRecord } from '../production/scans.js';
const scanId=z.string().regex(/^scan-[a-f0-9-]{36}$/);
const menuId=z.string().regex(/^(week-1-example|menu-[a-f0-9]{64})$/);
export class ScanStore {
 constructor(readonly data:string){}
 async read(id:string):Promise<ScanRecord>{
  scanId.parse(id);const record=JSON.parse(await fs.readFile(path.join(this.data,'scans',`${id}.json`),'utf8')) as ScanRecord;
  if(record.id!==id)throw new Error('Scan identity mismatch');menuId.parse(record.menuId);record.input=ScanInputSchema.parse(record.input);return record;
 }
 async write(scan:ScanRecord):Promise<void>{
  scanId.parse(scan.id);await fs.mkdir(path.join(this.data,'scans'),{recursive:true});
  const file=path.join(this.data,'scans',`${scan.id}.json`),temp=`${file}.tmp`;
  await fs.writeFile(temp,JSON.stringify(scan,null,2)+'\n');await fs.rename(temp,file);
 }
 async all():Promise<ScanRecord[]>{
  let names:string[];try{names=await fs.readdir(path.join(this.data,'scans'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
  const result:ScanRecord[]=[];for(const name of names)if(/^scan-[a-f0-9-]{36}\.json$/.test(name))result.push(await this.read(name.slice(0,-5)));return result.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 }
 async replacement(kind:'menus'|'scans',id:string):Promise<string|null>{
  (kind==='menus'?menuId:scanId).parse(id);
  try{return (JSON.parse(await fs.readFile(path.join(this.data,'superseded',kind,`${id}.json`),'utf8')) as {replacement:string}).replacement;}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
 }
 async supersede(kind:'menus'|'scans',id:string,replacement:string):Promise<void>{
  const schema=kind==='menus'?menuId:scanId;schema.parse(id);schema.parse(replacement);
  if(id===replacement||await this.replacement(kind,id))throw new Error('Revision is already superseded');
  const folder=path.join(this.data,'superseded',kind);await fs.mkdir(folder,{recursive:true});
  await fs.writeFile(path.join(folder,`${id}.json`),JSON.stringify({replacement,at:new Date().toISOString()}),{flag:'wx'});
 }
 async assertCurrentMenu(id:string):Promise<void>{if(await this.replacement('menus',id))throw new Error('Menu changed. Review the latest revision, then reconfirm counts and regenerate paperwork.');}
 async isMenuSuccessor(oldId:string,newId:string):Promise<boolean>{let next=oldId;for(let index=0;index<100;index++){const replacement=await this.replacement('menus',next);if(!replacement)return false;if(replacement===newId)return true;next=replacement;}throw new Error('Invalid menu revision chain');}
 async assertUsable(scan:ScanRecord):Promise<void>{
  await this.assertCurrentMenu(scan.menuId);
  if(await this.replacement('scans',scan.id))throw new Error('Scan was replaced; review its latest revision');
  await this.assertSourceAllowed(scan);
 }
 async assertSourceAllowed(scan:ScanRecord):Promise<void>{
  await this.assertNotBlockedSource(scan.source.sha256);
  try{await fs.access(path.join(this.data,'blocked-scans',`${scan.id}.json`));throw new Error('Scan privacy review is blocked');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(!/^[a-f0-9]{64}$/.test(scan.source.sha256))throw new Error('Invalid scan source');
  const base=await fs.realpath(path.join(this.data,'sources')),real=await fs.realpath(scan.source.file),relative=path.relative(base,real);
  if(!new RegExp(`^${scan.source.sha256}\\.(jpg|png|pdf)$`).test(relative))throw new Error('Scan source must remain in the preserved source folder');
  const stat=await fs.stat(real);if(!stat.isFile()||stat.size>20*1024*1024)throw new Error('Invalid preserved scan size');
  const bytes=await fs.readFile(real);
  if(createHash('sha256').update(bytes).digest('hex')!==scan.source.sha256)throw new Error('Scan source integrity mismatch');
 }
 async assertNotBlockedSource(sha256:string):Promise<void>{
  if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Invalid source hash');
  try{await fs.access(path.join(this.data,'blocked-sources',`${sha256}.json`));throw new Error('This source was privacy-blocked; use a redacted source');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
 async blockSource(sha256:string):Promise<void>{if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Invalid source hash');const folder=path.join(this.data,'blocked-sources');await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,`${sha256}.json`),'{}');}
 async block(id:string):Promise<void>{scanId.parse(id);const scan=await this.read(id),folder=path.join(this.data,'blocked-scans');await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,`${id}.json`),'{}');await this.blockSource(scan.source.sha256);}
 async confirmedFingerprint(id:string):Promise<string>{const scan=await this.read(id);await this.assertUsable(scan);const hash=scanHash(scan);if(!scan.confirmation||scan.confirmation.hash!==hash||scanIssues(scan.input).length)throw new Error('Counts require fresh confirmation');return hash;}
}
