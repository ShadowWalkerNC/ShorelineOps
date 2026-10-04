import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSparkClient, syntheticSmoke, SYNTHETIC_INPUT } from './spark.mjs'
test('missing credentials reject before network activity', () => {
  let called=false
  assert.throws(()=>createSparkClient('',()=>{called=true}),/not configured/)
  assert.equal(called,false)
})
test('SDK transport is restricted to the fixed synthetic request and official host', async()=>{
  let calls=0
  const client=createSparkClient('synthetic-test-key',async(url,options)=>{
    calls++
    assert.equal(String(url),'https://api.meta.ai/v1/responses')
    const body=JSON.parse(options.body)
    assert.equal(body.input,SYNTHETIC_INPUT)
    assert.equal(body.store,false)
    assert.equal(body.model,'muse-spark-1.3')
    assert.equal(body.tools,undefined)
    return new Response(JSON.stringify({id:'synthetic-response',object:'response',created_at:0,status:'completed',model:'muse-spark-1.3',output:[{type:'message',id:'synthetic-message',role:'assistant',status:'completed',content:[{type:'output_text',text:'OK',annotations:[]}]}]}),{headers:{'content-type':'application/json'}})
  })
  assert.equal((await syntheticSmoke(client)).status,'PASS')
  assert.equal(calls,1)
})
test('incomplete and unexpected responses never count as successful connectivity',async()=>{
  for(const response of [{status:'incomplete',output_text:'OK'},{status:'completed',output_text:'unexpected'}]){
    await assert.rejects(syntheticSmoke({responses:{create:async()=>response}}),/not the expected/)
  }
})
