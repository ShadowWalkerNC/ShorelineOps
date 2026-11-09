import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { week1Expected } from '../fixtures/reviewed/week-1.expected.js';
import { validateMenu, assertApproved, menuContentHash } from '../src/validation/index.js';
import type { Menu } from '../src/schema/index.js';

const load = (name: string): unknown => JSON.parse(readFileSync(resolve('fixtures/reviewed', name), 'utf8')) as unknown;
function checked(input: unknown): Menu {
  const result = validateMenu(input);
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join('\n'));
  if (!result.ok) throw new Error('Invalid fixture');
  return result.menu;
}
const menu = checked(load('week-1.menu.json'));
const expected = checked(week1Expected);
const meals = ['breakfast', 'lunch', 'dinner'] as const;
const options = ['a', 'b'] as const;
function cells(value: Menu): string[] {
  return value.days.flatMap(day => meals.flatMap(meal => options.map(option => day.meals[meal][option].text.originalText)));
}
function matchesExpected(value: Menu): void {
  assert.deepEqual(value, expected, 'Week 1 content differs from source-checked expected fixture');
}

test('real fixture has 7 dates, 42 options, 166 ordered components and no production approval', () => {
  matchesExpected(menu);
  assert.equal(menu.days.length, 7);
  assert.equal(cells(menu).length, 42);
  assert.equal(menu.days.flatMap(d => meals.flatMap(m => options.flatMap(o => d.meals[m][o].items))).length, 166);
  assert.equal(menu.approval, null);
  assert.throws(() => assertApproved(menu), /approval.*missing/i);
  assert.deepEqual(menu.days.map(d => d.date.value), ['2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31']);
});

test('authoritative photograph hash and independent cell-review digests match preserved source', () => {
  const photoHash = createHash('sha256').update(readFileSync(resolve(menu.source.file))).digest('hex');
  assert.equal(photoHash, '088a1192246675ca6607bd4a37ff15c0e8dbb0d266dbf6a4264e7a2fe6dcebef');
  assert.equal(photoHash, menu.source.sha256);
  const manifest = load('week-1.source-review.json') as { options: { cell: string; originalText: string; sha256: string; components: string[] }[] };
  const actual = menu.days.flatMap(day => meals.flatMap(meal => options.map(option => day.meals[meal][option])));
  assert.equal(manifest.options.length, 42);
  actual.forEach((option, i) => {
    const row = manifest.options[i]!;
    assert.equal(option.text.source.cell, row.cell);
    assert.equal(option.text.originalText, row.originalText);
    assert.equal(createHash('sha256').update(option.text.originalText).digest('hex'), row.sha256);
    assert.deepEqual(option.items.map(item => item.text.originalText), row.components);
  });
});

test('expected source comparison catches changed, extra, removed and reassigned foods', () => {
  const changed = structuredClone(menu);
  changed.days[0]!.meals.lunch.a.text.value = 'INVENTED FOOD';
  assert.throws(() => matchesExpected(changed));
  const removed = structuredClone(menu);
  removed.days[0]!.meals.lunch.a.items.pop();
  assert.equal(validateMenu(removed).ok, false);
  const extra = structuredClone(menu);
  extra.days[0]!.meals.breakfast.a.items.push(structuredClone(extra.days[0]!.meals.breakfast.a.items[0]!));
  assert.equal(validateMenu(extra).ok, false);
  const reassigned = structuredClone(menu);
  const first = reassigned.days[0]!.meals.lunch.a;
  reassigned.days[0]!.meals.lunch.a = reassigned.days[0]!.meals.lunch.b;
  reassigned.days[0]!.meals.lunch.b = first;
  assert.throws(() => matchesExpected(reassigned));
});

test('review state changes invalidate content hash and unresolved fields block approval', () => {
  const altered = structuredClone(menu);
  const prior = menuContentHash(altered);
  altered.days[0]!.meals.breakfast.a.text.needsReview = true;
  assert.notEqual(menuContentHash(altered), prior);
  altered.approval = { reviewer: 'SYNTHETIC TEST ONLY', approvedAt: '2026-10-25T12:00:00Z', menuHash: menuContentHash(altered) };
  assert.throws(() => assertApproved(altered), /unresolved/i);
});
test('real fixture rejects a missing breakfast, lunch or dinner', () => {
  for (const meal of meals) {
    const incomplete = JSON.parse(JSON.stringify(menu)) as {days:{meals:Record<string,unknown>}[]};
    delete incomplete.days[0]!.meals[meal];
    assert.equal(validateMenu(incomplete).ok, false, `missing ${meal} must fail`);
  }
});
test('real fixture rejects missing A or B in every meal', () => {
  for (const meal of meals) for (const option of options) {
    const incomplete = JSON.parse(JSON.stringify(menu)) as {days:{meals:Record<string,Record<string,unknown>>}[]};
    delete incomplete.days[0]!.meals[meal]![option];
    assert.equal(validateMenu(incomplete).ok, false, `missing ${meal} ${option} must fail`);
  }
});
