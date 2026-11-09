import fs from 'node:fs/promises';
import {renderPreview,renderWorkArea} from '../dist/src/renderer/index.js';
const menu=JSON.parse(await fs.readFile('fixtures/reviewed/week-1.menu.json','utf8'));
const profile=JSON.parse(await fs.readFile('fixtures/campus-profile.json','utf8'));
await renderPreview(menu,process.cwd(),'output/preview/campus-sylvia-weekly-review.pdf','output/preview/campus-sylvia-weekly.html',{kind:'weekly'},{profile,residentAreaId:'sylvia_ross'});
await renderWorkArea(profile,'ross_hot','2026-10-25',true,'output/preview/ross-hot-production-log-review.pdf');
console.log('Rendered 2-page source-backed Sylvia wing packet and 1-page proposed Ross Hot station log.');