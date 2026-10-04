import OpenAI from 'openai'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
console.log(JSON.stringify({
  sparkSdk: typeof OpenAI === 'function' ? 'installed' : 'missing',
  modelApiKeyConfigured: Boolean(process.env.MODEL_API_KEY?.trim()),
  sparkLiveAcceptance: 'NOT RUN by this offline check',
  gadgetDependencyManifest: existsSync(fileURLToPath(new URL('./gadget-requirements.txt', import.meta.url))),
  gadgetRuntime: process.platform === 'linux' ? 'installation/pairing NOT VERIFIED' : 'Linux/ESP32 target required',
  gadgetCommercialUse: 'BLOCKED by current token terms',
  productionIntegration: 'disabled; developer lab has no application/database imports'
}, null, 2))
