import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DietaryNutritionalEngine } from './engine/nutrition'

test('nutrition never substitutes generic values or guessed count/density weights', () => {
  for (const item of ['', 'unknown fixture food', 'breast', 'chicken breast with unknown sauce']) assert.equal(DietaryNutritionalEngine.lookupNutrientProfile(item), null)
  for (const qty of ['2 cups', '4 each', '1 case', 'to taste', '1/0 g']) {
    const analysis = DietaryNutritionalEngine.calculateRecipeNutrition([{ item: 'chicken breast', qty }], 10)
    assert.equal(analysis.perServing, null)
    assert.equal(analysis.totalBatch, null)
    assert.equal(analysis.nutritionProvenance.available, false)
  }
  const weighed = DietaryNutritionalEngine.calculateRecipeNutrition([{ item: 'chicken breast', qty: '100 g' }], 1)
  assert.equal(weighed.perServing?.calories, 165)
  assert.equal(weighed.nutritionProvenance.estimated, true)
  assert.equal(weighed.nutritionProvenance.source, 'local-reference')
  assert.equal(weighed.nutritionProvenance.requiresClinicalReview, true)
})
