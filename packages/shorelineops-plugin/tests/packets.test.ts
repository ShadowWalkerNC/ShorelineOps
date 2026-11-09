import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildPacketHtml, countPacketPages, countPdfPages, renderPreview, renderProduction, type PacketSelection } from '../src/renderer/index.js';
import { menuContentHash } from '../src/validation/index.js';
import { makeValidMenu } from './helpers.js';
const run = promisify(execFile);
const sheets = (html: string) => [...html.matchAll(/data-sheet="(SR-\d\d)"/g)].map(match => match[1]);
async function scratch(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sylvia-packets-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
test('default packet contains just the two weekly forms and all seven menu days', () => {
  const html = buildPacketHtml(makeValidMenu(), { preview:true });
  assert.deepEqual(sheets(html), ['SR-01','SR-02']);
  assert.equal(countPacketPages(html), 2);
  assert.equal((html.match(/class="circle">A</g) ?? []).length, 21);
  assert.equal((html.match(/class="circle">B</g) ?? []).length, 21);
});
test('daily packet contains the selected date and three cook sheets with dessert components retained', () => {
  const menu = makeValidMenu();
  const html = buildPacketHtml(menu, { preview:true, selection:{kind:'daily',date:'2026-10-29'} });
  assert.deepEqual(sheets(html), ['SR-05','SR-06','SR-07']);
  assert.equal((html.match(/data-day-index="4"/g) ?? []).length, 3);
  assert.ok(!html.includes('data-day-index="0"'));
  assert.ok(html.includes('record initials and time in the item rows above'));
  assert.ok(!html.includes('use the same-day SR-08'));
  for (const meal of ['breakfast','lunch','dinner'] as const) for (const option of ['a','b'] as const) {
    for (const item of menu.days[4]!.meals[meal][option].items) {
      assert.ok(html.includes(item.text.value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')));
    }
  }
});
test('daily extras are opt-in, ordered by form ID, and issue the dessert handoff only when present', () => {
  const menu = makeValidMenu();
  const all = buildPacketHtml(menu, {preview:true,selection:{kind:'daily',date:'2026-10-25',extras:['dessert','prep','summary']}});
  assert.deepEqual(sheets(all), ['SR-03','SR-04','SR-05','SR-06','SR-07','SR-08']);
  assert.ok(all.includes('use the same-day SR-08'));
  const prep = buildPacketHtml(menu, {preview:true,selection:{kind:'daily',date:'2026-10-25',extras:['prep']}});
  assert.deepEqual(sheets(prep), ['SR-04','SR-05','SR-06','SR-07']);
});
test('invalid dates and ambiguous extras fail instead of choosing another day', () => {
  const menu = makeValidMenu();
  for (const date of ['', '2026-11-01', '2026-10-32', '10/25/2026']) {
    assert.throws(() => buildPacketHtml(menu,{preview:true,selection:{kind:'daily',date}}), /date/);
  }
  assert.throws(() => buildPacketHtml(menu,{preview:true,selection:{kind:'daily',date:'2026-10-25',extras:['prep','prep']}}), /unique/);
  assert.throws(() => buildPacketHtml(menu,{preview:true,selection:{kind:'unknown'} as unknown as PacketSelection}), /Packet must/);
});
test('weekly and daily previews render 2 and 3 PDF pages respectively', async t => {
  const directory = await scratch(t);
  const menu = makeValidMenu();
  for (const [name,selection,pages] of [
    ['weekly',{kind:'weekly'},2],
    ['daily',{kind:'daily',date:'2026-10-25'},3],
  ] as const) {
    const pdf = path.join(directory,`${name}.pdf`);
    await renderPreview(menu,process.cwd(),pdf,path.join(directory,`${name}.html`),selection);
    assert.equal(await countPdfPages(pdf), pages);
  }
});
test('daily production retains approval gates and renders only selected pages for approved synthetic data', async t => {
  const directory = await scratch(t);
  const menu = makeValidMenu();
  const selection: PacketSelection = {kind:'daily',date:'2026-10-25'};
  const pdf = path.join(directory,'daily.pdf');
  await assert.rejects(() => renderProduction(menu,process.cwd(),pdf,selection), /approval is missing/);
  menu.approval = {reviewer:'SYNTHETIC TEST ONLY',approvedAt:'2026-10-25T12:00:00Z',menuHash:menuContentHash(menu)};
  await renderProduction(menu,process.cwd(),pdf,selection);
  assert.equal(await countPdfPages(pdf), 3);
  menu.days[0]!.meals.breakfast.a.text.needsReview = true;
  await assert.rejects(() => renderProduction(menu,process.cwd(),pdf,selection), /unresolved/);
});
test('CLI rejects missing daily dates, out-of-week dates, unknown packets and inappropriate extras', async t => {
  const directory = await scratch(t);
  const menuFile = path.join(directory,'menu.json');
  await fs.writeFile(menuFile,JSON.stringify(makeValidMenu()));
  for (const args of [
    ['--packet','daily'],
    ['--packet','daily','--date','2026-11-01'],
    ['--packet','bad'],
    ['--include','prep'],
    ['--packet','daily','--date','2026-10-25','--include','unknown'],
  ]) {
    const output = path.join(directory,'invalid.pdf');
    await assert.rejects(() => run(process.execPath,[path.resolve('dist/src/cli/index.js'),'preview','--menu',menuFile,'--out',output,...args]));
    await assert.rejects(() => fs.access(output));
  }
});