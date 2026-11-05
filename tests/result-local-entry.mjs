import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir,symlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

const {values}=parseArgs({options:{output:{type:'string'}}});assert(values.output,'Explicit new private output directory required');
const out=path.resolve(values.output);await mkdir(out,{mode:0o700});const cases=path.join(out,'cases with spaces');await mkdir(cases,{mode:0o700});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>JSON.stringify(x,null,2)+'\n';
const capacity='docs/evidence/codex-result-interop/examples/capacity-returned.json',pair='docs/evidence/scenarios/examples/pair.json',source='fixtures/capacity-source.json',mapping='fixtures/result-capacity-mapping.json';
const originals=[capacity,pair,source,mapping],before=await Promise.all(originals.map(async file=>({file,sha256:sha(await readFile(file))})));
const document=JSON.parse(await readFile(capacity)),pairDocument=JSON.parse(await readFile(pair)),map=JSON.parse(await readFile(mapping));
assert.deepEqual(map,JSON.parse(await readFile('fixtures/source-capacity-request.json'))[0].mapping);
const inputs=await Promise.all([document,pairDocument].map(async(d,i)=>{const file=path.join(cases,'valid '+i+'.json');await writeFile(file,json(d),{mode:0o600,flag:'wx'});return file;}));
const guard=path.join(out,'deny-external.mjs');await writeFile(guard,`
import * as module from 'node:module';import {createRequire} from 'node:module';import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),counts={networkAttempts:0,childProcessAttempts:0},deny=k=>()=>{counts[k]++;throw Error('LOCAL_ENTRY_FORBIDDEN_EXTERNAL_OPERATION');};
const net=require('node:net');net.connect=net.createConnection=net.Socket.prototype.connect=deny('networkAttempts');
for(const name of ['node:http','node:https']){const m=require(name);m.request=m.get=deny('networkAttempts');}
globalThis.fetch=deny('networkAttempts');
const cp=require('node:child_process');for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[k]=deny('childProcessAttempts');
module.syncBuiltinESMExports();process.on('exit',()=>writeFileSync(process.env.LOCAL_ENTRY_GUARD_RECEIPT,JSON.stringify(counts),{mode:0o600}));
`,{mode:0o600,flag:'wx'});
const sourceArgs=['--source-file',source,'--source-json-pointer','/text','--source-kind','capacity-zh','--mapping-file',mapping];
const rows=[];
async function run(name,args,status,expectedStatus){
 const guardReceipt=path.join(out,name+'-guard.json');
 const r=spawnSync(process.execPath,['--import','tsx','--import',pathToFileURL(guard).href,'scripts/result-local.ts',...args],{encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024,env:{...process.env,LOCAL_ENTRY_GUARD_RECEIPT:guardReceipt}});
 await writeFile(path.join(out,name+'.stdout'),r.stdout??'',{mode:0o600,flag:'wx'});await writeFile(path.join(out,name+'.stderr'),r.stderr??'',{mode:0o600,flag:'wx'});
 assert.equal(r.status,status,`${name}: exit, stderr=${(r.stderr??'').slice(0,500)}`);assert.equal(r.signal,null,name);assert.equal(r.stderr,'',name);
 const guardCounts=JSON.parse(await readFile(guardReceipt));assert.deepEqual(guardCounts,{networkAttempts:0,childProcessAttempts:0},name);
 const parsed=expectedStatus?JSON.parse(r.stdout):undefined;if(expectedStatus)assert.equal(parsed.status,expectedStatus,name);
 rows.push({name,exit:r.status,...(expectedStatus?{status:parsed.status}:{}),...guardCounts});return parsed??r.stdout;
}
const checked=await run('fixed-source',['--result-file',inputs[0],...sourceArgs,'--require-source'],0,'checked');assert.deepEqual(checked.document,document);assert.equal(checked.invocation.transport,'direct in-process function; no MCP');assert.equal(checked.invocation.entry.revision,1);assert.equal(checked.invocation.newMcpConnections,0);assert.equal(checked.layers.local.viewing,'a');assert.equal(checked.layers.local.draftValidation.ok,false);assert.deepEqual(checked.layers.local.aComputed.eligibleOptionIds,['option-fixture-0','option-fixture-1']);assert.deepEqual(checked.layers.local.bComputed.eligibleOptionIds,['option-fixture-1']);assert.equal(checked.identityVerified,false);assert.equal(checked.sourceFactsVerified,false);assert.equal(checked.freeProseVerified,false);
const unknown=await run('unverified-pair',['--result-file',inputs[1]],0,'checked-unverified');assert.deepEqual(unknown.document,pairDocument);assert.equal(unknown.layers.sourceComparison.status,'not-configured');assert.equal(unknown.document.content.interaction.scenarioComparison.a.values.teamAvailable,null);assert(unknown.document.content.view.payload.options.every(o=>o.values.price===null));assert.equal(unknown.document.content.interaction.scenarioComparison.a.values.demand,100);assert.equal(unknown.document.content.interaction.values.demand,220);
const emitted=JSON.parse(await run('carried-document',['--result-file',inputs[0],...sourceArgs,'--require-source','--emit','document'],0));assert.deepEqual(emitted,document);
const explanation=await run('chinese-explanation',['--result-file',inputs[0],...sourceArgs,'--require-source','--emit','explanation'],0);assert.equal(explanation,checked.explanationZh+'\n');assert.match(explanation,/当前查看A（只读）/u);assert.match(explanation,/无效输入/u);
const required=await run('missing-required-source',['--result-file',inputs[0],'--require-source','--emit','document'],2,'source-required');assert.equal(required.manifest,undefined);
const badMap=path.join(cases,'wrong mapping.json');await writeFile(badMap,json({...map,demandInputId:'limit-fixture'}),{mode:0o600});await run('wrong-mapping',['--result-file',inputs[0],...sourceArgs.slice(0,-2),'--mapping-file',badMap,'--require-source'],2,'source-mismatch');
for(const[name,mutate]of[
 ['damaged',d=>{d.sha256='0'.repeat(64);}],
 ['incompatible',d=>{d.manifest.version=99;}],
 ['dependency',d=>{d.manifest.dependencies[0].version='99.0.0';}],
 ['package-cannot-select-source',d=>{d.sourceFile='alternate-source.txt';}],
]){const d=structuredClone(document);mutate(d);const file=path.join(cases,name+'.json');await writeFile(file,json(d),{mode:0o600});await run(name,['--result-file',file,...sourceArgs,'--require-source'],2,'invalid-result');}
const broken=path.join(cases,'broken.json');await writeFile(broken,'{"broken":',{mode:0o600});const invalid=await run('bad-json',['--result-file',broken],2,'entry-error');assert.equal(invalid.detail,'RESULT_JSON');
await run('duplicate-source',['--result-file',inputs[0],...sourceArgs,'--source-file','never-read-alternate.json'],2,'entry-error');
await run('missing-source-file',['--result-file',inputs[0],'--source-file',path.join(cases,'never-created.json'),'--source-kind','capacity-zh','--require-source'],2,'entry-error');
const oversized=path.join(cases,'too-large.json');await writeFile(oversized,' '.repeat(131073),{mode:0o600});await run('oversized-file',['--result-file',oversized],2,'entry-error');
const link=path.join(cases,'result-link.json');await symlink(inputs[0],link);await run('symlink-file',['--result-file',link],2,'entry-error');
assert.deepEqual(await Promise.all(originals.map(async file=>({file,sha256:sha(await readFile(file))}))),before);
for(let i=0;i<inputs.length;i++)assert.equal(await readFile(inputs[i],'utf8'),json(i===0?document:pairDocument));
// Inspect only the new direct entry graph in memory: no SDK, server, transport or child-process import.
const proof=await build({entryPoints:['scripts/result-local.ts'],bundle:true,platform:'node',format:'esm',write:false,metafile:true});
const graph=JSON.stringify(proof.metafile);assert(!/@modelcontextprotocol|src\/mcp\.|client\/stdio|node:child_process|node:net|node:https?/u.test(graph));
const receipt={entry:'node --import tsx scripts/result-local.ts',revision:1,packageVersion:'0.1.0-preview.31',checkerContract:'Codex 0.1.0-preview.31.1',normalLocalDirectEntry:true,usesExistingCheckResultPackage:true,usesExistingReadSourceSnapshot:true,normalPublicInputs:originals,firstFixedSourceStatus:checked.status,unverifiedPairStatus:unknown.status,sourceAndHypothesesSeparate:true,a80Source80B120AndInvalidDraftRetained:true,a100B220UnknownPriceAndTeamRetained:true,localeThemeAndSelectionRetained:true,sameResultContractEmitted:true,originalFilesByteUnchanged:true,pathContainsSpaces:true,importGraphHasNoMcpSdkOrNetworkOrChildProcessModule:true,allChildEntryGuardsPassed:true,cases:rows,newMcpConnections:0,newCodexThreads:0,newModelTurns:0,globalConfigurationChanged:false,serviceStartedOrRestarted:false,mainChatAutomaticRegistrationVerified:false,richUiVerified:false};
await writeFile(path.join(out,'acceptance.json'),json(receipt),{mode:0o600,flag:'wx'});await writeFile(path.join(out,'report.json'),json(checked),{mode:0o600,flag:'wx'});await writeFile(path.join(out,'carried-result.json'),json(emitted),{mode:0o600,flag:'wx'});console.log(json({cases:rows.length,normalLocalDirectEntry:true,newMcpConnections:0,newModelTurns:0,unchangedInputs:true}));
