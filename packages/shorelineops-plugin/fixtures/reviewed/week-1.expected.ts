/** Source-checked transcription, NOT human-approved production data.
 * Original photograph is the sole content authority. Layout references are excluded.
 * Confidence null means not calibrated/assessed; no invented confidence scores.
 */
import transcription from './week-1.source-transcription.json' with { type: 'json' };

const sourceFile = transcription.sourceFile;
const field = (originalText: string, cell: string, value = originalText) => ({
  originalText, value, confidence: null, source: { file: sourceFile, cell }, needsReview: false,
});
const dessertNames = new Set([
  'ICE CREAM SUNDAES', 'CHERRY CREAM CHEESE BAR', 'STRAWBERRY SHORTCAKE',
  'CHOC CHIP COOKIE', 'PINEAPPLE UPSIDE DOWN CAKE', 'PEACH COBBLER A LA MODE',
  'FRUITED GELATIN', 'SILVER WHITE CAKE', 'BLONDE BROWNIE', 'APPLESAUCE CAKE',
]);
function option(raw: string, cell: string) {
  // Wednesday breakfast has no printed comma between COLD CEREAL and OATMEAL.
  // Preserve its full cell verbatim; split the two visible foods without adding words.
  const componentText = raw === 'COLD CEREAL OATMEAL, FRUIT'
    ? ['COLD CEREAL', 'OATMEAL', 'FRUIT']
    : raw.split(',').map(text => text.trim()).filter(Boolean);
  return {
    text: field(raw, cell),
    items: componentText.map((text, index) => ({
      text: field(text, `${cell}; component ${index + 1}`),
      kind: dessertNames.has(text) ? 'dessert' as const : 'unspecified' as const,
    })),
  };
}
export const week1Expected = {
  schemaVersion: 1 as const,
  facility: 'sylvia_ross' as const,
  week: 1,
  startDate: transcription.startDate,
  source: { file: sourceFile, sha256: transcription.sha256 },
  metadata: {
    week: field('WEEK 1', 'left header: WEEK 1', '1'),
    startDate: field('10/25/2026', 'Sunday DATE', transcription.startDate),
  },
  days: transcription.days.map(day => ({
    date: field(`${day.date.slice(5, 7)}/${day.date.slice(8)}/${day.date.slice(0, 4)}`, `${day.date} DATE`, day.date),
    meals: Object.fromEntries((['breakfast', 'lunch', 'dinner'] as const).map(meal => [meal, {
      a: option(day[meal][0]!, `${day.date} ${meal.toUpperCase()} CHOICE 1`),
      b: option(day[meal][1]!, `${day.date} ${meal.toUpperCase()} CHOICE 2`),
    }])),
  })),
  approval: null,
};
export default week1Expected;