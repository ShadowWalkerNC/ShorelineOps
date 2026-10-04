import OpenAI from 'openai'
import { pathToFileURL } from 'node:url'

// This intentionally accepts no prompts, files, records, or tool calls.
// A production advisory feature requires a separate approved data boundary.
export const SYNTHETIC_INPUT = 'Synthetic SDK connectivity test. Reply with the single word OK.'
export function createSparkClient(apiKey, fetchImpl) {
  if (!apiKey?.trim()) throw new Error('MODEL_API_KEY is not configured; no request sent.')
  return new OpenAI({ apiKey, baseURL: 'https://api.meta.ai/v1', timeout: 15000, maxRetries: 0, ...(fetchImpl && { fetch: fetchImpl }) })
}
export async function syntheticSmoke(client) {
  const response = await client.responses.create({ model: 'muse-spark-1.3', input: SYNTHETIC_INPUT, max_output_tokens: 128, store: false })
  if (response.status !== 'completed' || response.output_text?.trim() !== 'OK') {
    throw new Error('Synthetic response was not the expected completed OK; provider response was not printed.')
  }
  return { status: 'PASS', model: response.model, syntheticOnly: true }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--live-synthetic') {
    console.error('Use --live-synthetic for the fixed connectivity probe. Arbitrary input is not accepted.')
    process.exitCode = 1
  } else {
    try { console.log(JSON.stringify(await syntheticSmoke(createSparkClient(process.env.MODEL_API_KEY)))) }
    catch { console.error('Spark connectivity NOT VERIFIED. Check credentials, access, quota and model support locally; no provider response or credentials printed.'); process.exitCode = 1 }
  }
}
