import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir,mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createResult,initialInteraction,readResult} from '../src/results.ts';
import {captureDecision} from '../src/scenarios.ts';
import {makeConditionDraft} from '../src/condition-form.ts';
import {defaultTheme,defaultLayout} from '../src/theme.ts';
const {values}=parseArgs({options:{package:{type:'string'},output:{type:'string'}}});assert(values.package&&values.output);
const root=process.cwd(),out=path.resolve(values.output),manifestFile=path.resolve(values.package),manifest=JSON.parse(await readFile(manifestFile)),zip=path.join(path.dirname(manifestFile),manifest.filename);await mkdir(out,{mode:0o700});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=value=>JSON.stringify(value,null,2)+'\n';assert.equal(sha(await readFile(zip)),manifest.sha256);assert(manifest.coreByteEqualToOrigin);
const target=await mkdtemp(path.join(tmpdir(),'semantic result package ')),calls=[];let closed=0;
async function write(name,value){const file=path.join(target,name);await writeFile(file,json(value),{mode:0o600});return file;}
async function using(sourceArgs,run){
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(target,'plugins/semantic-ui-checks/dist/mcp.js'),...sourceArgs],cwd:target,stderr:'pipe'}),client=new Client({name:'explicit-result-contract',version:'1.0.0'});let stderr='';transport.stderr?.on('data',b=>stderr+=String(b));
 try{await client.connect(transport);assert.equal(client.getServerVersion().version,manifest.version);const tool=(await client.listTools()).tools.find(t=>t.name==='semantic_ui_result_check');assert(tool.annotations.readOnlyHint&&tool.annotations.openWorldHint===false);assert.equal(client.getServerCapabilities()?.resources,undefined);
  const call=async args=>{const r=await client.callTool({name:'semantic_ui_result_check',arguments:args});assert(!r.isError);assert(r.content[0].text.includes('结果'));calls.push({status:r.structuredContent.status,source:r.structuredContent.layers?.sourceComparison?.comparison?.status??'unverified'});return r.structuredContent;};await run(call);assert.equal(stderr,'');
 }finally{await client.close();await transport.close();closed++;}
}
try{
 const names=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');assert.equal(new Set(names).size,names.length);assert.deepEqual([...names].sort(),manifest.files.map(f=>f.path).sort());assert(names.every(n=>!path.isAbsolute(n)&&!n.split('/').some(part=>part==='..')));execFileSync('unzip',['-q',zip,'-d',target]);for(const f of manifest.files)assert.equal(sha(await readFile(path.join(target,f.path))),f.sha256);
 const publicPair=JSON.parse(await readFile('docs/evidence/scenarios/examples/pair.json')),originalPairBytes=await readFile('docs/evidence/scenarios/examples/pair.json');
 await using([],async call=>{
  const r=await call({document:publicPair});assert.equal(r.status,'checked-unverified');assert.deepEqual(r.document,publicPair);assert.equal(r.layers.local.viewing,'a');assert.deepEqual(r.layers.local.aComputed.eligibleOptionIds,['managed']);assert.deepEqual(r.layers.local.bComputed.eligibleOptionIds,['vm']);assert.equal(r.identityVerified,false);
  for(const file of ['docs/evidence/result-package/examples/1.json','fixtures/result-compat/preview30.json']){const document=JSON.parse(await readFile(file));assert.deepEqual((await call({document})).document,document);}
  assert.equal((await call({document:{...publicPair,sha256:'0'.repeat(64)}})).status,'invalid-result');
 });
 const request=JSON.parse(await readFile('fixtures/source-capacity-request.json'))[0],view=request.view,interaction=initialInteraction(view),a=captureDecision(view.payload,interaction.values,interaction.dimensions,false);interaction.scenarioComparison={version:1,a,viewing:'a'};interaction.values['quantity-fixture']=120;interaction.conditionDraft=makeConditionDraft(view.payload,interaction.values);interaction.conditionDraft.fields['quantity-fixture'].text='NaN';const document=await createResult({view,interaction,theme:{...defaultTheme,mode:'dark'},layout:defaultLayout,locale:'en'});
 const input=await write('result.json',document),mapping=await write('mapping.json',request.mapping),badMapping=await write('bad-mapping.json',{...request.mapping,demandInputId:'limit-fixture'}),sourceText=JSON.parse(await readFile('fixtures/capacity-source.json')).text,source=path.join(target,'source.txt');await writeFile(source,sourceText,{mode:0o600});const inputBytes=await readFile(input);
 await using(['--source-file',source,'--source-kind','capacity-zh'],async call=>{
  const r=await call({document,mapping:request.mapping});assert.equal(r.status,'checked');assert.deepEqual(r.document,document);assert.equal(r.layers.local.draftValidation.ok,false);assert.deepEqual(r.layers.local.aComputed.eligibleOptionIds,['option-fixture-0','option-fixture-1']);assert.deepEqual(r.layers.local.bComputed.eligibleOptionIds,['option-fixture-1']);assert.equal(r.identityVerified,false);
  assert.equal((await call({document,mapping:{...request.mapping,demandInputId:'limit-fixture'}})).status,'source-mismatch');await writeFile(source,sourceText.replace('80GB','90GB'));const stable=await call({document,mapping:request.mapping});assert.equal(stable.status,'checked');assert.equal(stable.layers.sourceComparison.source.textSha256,sha(sourceText));
 });
 await writeFile(source,sourceText);const entry=path.join(target,'plugins/semantic-ui-checks/dist/result-readonly.js'),sourceArgs=['--source-file',source,'--source-kind','capacity-zh'];
 function runNode(args,expected=0){const p=spawnSync(process.execPath,[entry,'--result-file',input,...args],{encoding:'utf8',maxBuffer:2_000_000});assert.equal(p.status,expected,p.stderr||p.stdout);return JSON.parse(p.stdout);}
 const report=runNode([...sourceArgs,'--mapping-file',mapping,'--require-source']);assert.equal(report.status,'checked');assert.deepEqual(report.document,document);assert.equal(report.invocation.newCodexThreads,0);assert.equal(report.invocation.newModelTurns,0);const carried=runNode([...sourceArgs,'--mapping-file',mapping,'--require-source','--emit','document']);assert.deepEqual(carried,document);assert.deepEqual((await readResult(carried)).content,document.content);
 assert.equal(runNode([...sourceArgs,'--mapping-file',badMapping],2).status,'source-mismatch');assert.equal(runNode(['--require-source'],2).status,'source-required');
 // Existing Python entry works with only Node on PATH: no possible Codex subprocess or global registration.
 const python=execFileSync('python3',['-c','import sys; print(sys.executable)'],{encoding:'utf8'}).trim(),bin=path.join(target,'only-node-bin');await mkdir(bin);await symlink(process.execPath,path.join(bin,'node'));
 const p=spawnSync(python,[path.join(root,'examples/codex-readonly.py'),'--result-package',input,'--plugin-package',zip,'--plugin-manifest',manifestFile,...sourceArgs,'--mapping-file',mapping,'--require-source'],{encoding:'utf8',maxBuffer:2_000_000,env:{...process.env,PATH:bin}});assert.equal(p.status,0,p.stderr||p.stdout);const normal=JSON.parse(p.stdout);assert.equal(normal.status,'checked');assert.deepEqual(normal.document,document);assert.equal(normal.invocation.newCodexThreads,0);
 assert.equal(sha(await readFile(input)),sha(inputBytes));assert.equal(sha(await readFile('docs/evidence/scenarios/examples/pair.json')),sha(originalPairBytes));assert.equal(await readFile(source,'utf8'),sourceText);
 await writeFile(path.join(out,'carried-result.json'),json(carried));await writeFile(path.join(out,'report.json'),json(report));await writeFile(path.join(out,'acceptance.json'),json({version:manifest.version,sourceCommit:manifest.sourceCommit,zipSha256:manifest.sha256,origin:manifest.origin,filesVerified:manifest.files.length,extractedOutsideRepository:true,pathContainsSpaces:true,noNodeModulesRequired:true,actualStdioCalls:calls,closedServers:closed,normalBundledCli:true,normalExistingPythonEntry:true,pythonWorksWithoutCodexOnPath:true,sourcePinnedBeforeRequests:true,oldResultFormats:[1,2,3],rawDraftRetainedAndNotApplied:true,localA80B120AndSource80Separate:true,localeAndThemeRetained:true,unchangedInputBytes:true,carriedSameResultContract:true,newCodexThreads:0,newModelTurns:0,globalConfigurationChanged:false,currentMainChatToolRegistration:false,richUiVerified:false}));console.log(json({version:manifest.version,filesVerified:manifest.files.length,normalCli:true,normalPythonEntry:true,newCodexThreads:0,newModelTurns:0}));
}finally{await rm(target,{recursive:true,force:true});}
