import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSession } from '../src/session.js';
const lines = records => records.map(r => JSON.stringify(r)).join('\n');
test('Codex model only from context, never instructions or tool output', () => {
 const r = inspectSession(lines([
  {type:'session_meta',payload:{id:'s',cwd:'/repo',base_instructions:{model:'fake'}}},
  {type:'turn_context',payload:{turn_id:'t',model:'gpt-6-astra'}},
  {type:'token_usage_record',payload:{turn_id:'t',response_id:'r'}},
  {type:'response_item',payload:{model:'fake'}}
 ]),'codex',['gpt-6-astra']);
 assert.deepEqual(r.models.map(x=>x.model),['gpt-6-astra']);
 assert.equal(r.observedPolicy,'observed-models-allowed');
 assert.equal(r.mergeAuthorization,'not-established');
});
test('Claude ignores synthetic records, deduplicates request IDs and detects mixed models', () => {
 const r=inspectSession(lines([
  {type:'assistant',requestId:'r',message:{model:'claude-fable-5-high'}},
  {type:'assistant',requestId:'r',message:{model:'claude-fable-5-high'}},
  {type:'assistant',message:{model:'<synthetic>'}},
  {type:'assistant',requestId:'r2',message:{model:'other'}}
 ]),'claude',['claude-fable-5-high']);
 assert.equal(r.models.length,2);assert.equal(r.uniqueRecordedRequestOrResponseIds,2);
 assert.equal(r.observedPolicy,'observed-disallowed-model');
});
test('unknown evidence fails closed',()=>{
 assert.equal(inspectSession('broken','codex').observedPolicy,'unknown');
 assert.equal(inspectSession('{}','claude').observedPolicy,'unknown');
 assert.equal(inspectSession(lines([{type:'token_usage_record',payload:{turn_id:'missing',response_id:'r'}}]),'codex').unlinkedUsage,1);
});
test('model alias never implies a different version',()=>{
 const r=inspectSession(lines([{type:'assistant',message:{model:'claude-fable-5-high'}}]),'claude',['Fable 5.1']);
 assert.equal(r.models[0].allowed,false);
});
test('summary never exports private transcript data or identifiers',()=>{
 const secret='PRIVATE_SENTINEL_7842';
 const r=inspectSession(lines([
  {type:'session_meta',payload:{id:secret,cwd:secret}},
  {type:'turn_context',payload:{turn_id:secret,model:'gpt-6-astra'}},
  {type:'token_usage_record',payload:{turn_id:secret,response_id:secret}},
  {type:'response_item',payload:{content:secret}}
 ]),'codex',['gpt-6-astra']);
 assert.equal(JSON.stringify(r).includes(secret),false);
 assert.equal(Object.hasOwn(r,'sessionIds'),false);
 assert.equal(Object.hasOwn(r,'workingDirectories'),false);
});
