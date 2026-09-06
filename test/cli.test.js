import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const cli = new URL('../bin/inspect-session.js', import.meta.url);
const action = new URL('../bin/action.js', import.meta.url);
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'PRIVATE_PATH.jsonl');
  writeFileSync(file, JSON.stringify({type:'assistant',requestId:'PRIVATE_REQUEST',message:{model:'allowed',content:'PRIVATE_PROMPT'}})+'\n');
  return {dir,file};
}
function run(file, args=[], env={}) {
  return spawnSync(process.execPath, [file.pathname,...args],{encoding:'utf8',env:{...process.env,...env}});
}
test('CLI supports allowed, disallowed and unknown exit codes', t=>{
 const {file}=fixture(t);
 assert.equal(run(cli,['claude',file,'allowed']).status,0);
 assert.equal(run(cli,['claude',file,'other']).status,1);
 const missing=run(cli,['claude',file+'PRIVATE_MISSING','allowed']);
 assert.equal(missing.status,2);assert.equal(missing.stderr.includes('PRIVATE'),false);
 assert.equal(run(cli,['claude',file]).status,1);
});
test('CLI --help succeeds',()=>assert.equal(run(cli,['--help']).status,0));
test('action enforces, reports and exposes only fixed outputs',t=>{
 const {dir,file}=fixture(t);
 const output=join(dir,'outputs');
 const env={MODEL_GATE_AGENT:'claude',MODEL_GATE_SESSION:file,MODEL_GATE_ALLOWED:'allowed',MODEL_GATE_MODE:'enforce',GITHUB_OUTPUT:output};
 const accepted=run(action,[],env);assert.equal(accepted.status,0);
 assert.equal(accepted.stdout.includes('PRIVATE'),false);
 assert.equal(accepted.stdout.includes('"model"'),false);
 assert.equal(readFileSync(output,'utf8'),'verdict=observed-models-allowed\nevidence-level=local-unverified\n');
 assert.equal(run(action,[],{...env,MODEL_GATE_ALLOWED:'other'}).status,1);
 assert.equal(run(action,[],{...env,MODEL_GATE_ALLOWED:'other',MODEL_GATE_MODE:'report'}).status,0);
 assert.equal(run(action,[],{...env,MODEL_GATE_MODE:'typo'}).status,2);
 const unknown=run(action,[],{...env,MODEL_GATE_SESSION:file+'PRIVATE_MISSING'});
 assert.equal(unknown.status,2);assert.equal(unknown.stderr.includes('PRIVATE'),false);
});

test('default allowlist accepts Astra and Fable 5.1, rejects Fable 5 and display labels', t=>{
 const {file}=fixture(t);
 for (const [model, status] of [['gpt-6-astra',0],['claude-fable-5-1',0],['Astra',1],['Fable 5.1',1],['claude-fable-5-high',1],['claude-fable-5',1]]) {
  writeFileSync(file,JSON.stringify({type:'assistant',message:{model}})+'\n');
  assert.equal(run(cli,['claude',file]).status,status);
 }
});
test('Chinese help works without changing machine JSON',t=>{
 const {file}=fixture(t);
 const help=run(cli,['--lang','zh-CN','--help']);
 assert.equal(help.status,0);assert.ok(help.stdout.includes('用法'));
 assert.equal(JSON.parse(run(cli,['--lang','zh-CN','claude',file,'allowed']).stdout).observedPolicy,'observed-models-allowed');
 assert.equal(run(cli,['--lang','invalid','--help']).status,2);
});
