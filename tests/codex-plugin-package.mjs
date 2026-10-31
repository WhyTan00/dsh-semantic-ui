import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir,mkdtemp,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import * as core from '../src/core.ts';
import {extractDefinition,exportTemplate} from '../src/templates.ts';
import {defaultTheme,defaultLayout} from '../src/theme.ts';
import {numericRequest} from '../fixtures/source-numeric.ts';
import {sourceReference} from '../examples/source-reference.mjs';
import {packCodexPlugin} from '../scripts/pack-codex-plugin.mjs';

const {values}=parseArgs({options:{package:{type:'string'},output:{type:'string'}}}),root=process.cwd();
const output=path.resolve(values.output??'artifacts/local/codex-plugin-check-'+Date.now());await mkdir(path.dirname(output),{recursive:true});await mkdir(output,{mode:0o700});
const json=value=>JSON.stringify(value,null,2)+'\n',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let packageFile=values.package;
if(!packageFile){
 const {version}=JSON.parse(await readFile('package.json')),dir=path.resolve('artifacts/releases',version),m=JSON.parse(await readFile(path.join(dir,'package-manifest.json')));
 await packCodexPlugin({archive:path.join(dir,m.filename),manifest:path.join(dir,'package-manifest.json'),output:path.join(output,'build')});packageFile=path.join(output,'build/plugin-package-manifest.json');
}
packageFile=path.resolve(packageFile);const manifest=JSON.parse(await readFile(packageFile)),zip=path.join(path.dirname(packageFile),manifest.filename),bytes=await readFile(zip);
assert.equal(sha(bytes),manifest.sha256);assert(manifest.coreByteEqualToOrigin);
const names=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');assert.equal(new Set(names).size,names.length);
assert.deepEqual([...names].sort(),manifest.files.map(f=>f.path).sort());
assert(names.every(n=>!path.isAbsolute(n)&&!n.split('/').includes('..')&&!n.endsWith('/')));
const target=await mkdtemp(path.join(tmpdir(),'semantic codex package ')),calls=[],sessions=[];
const read=async file=>JSON.parse(await readFile(file,'utf8'));
let closed=0;
async function connect(config,plugin,extra=[]){
 const replace=s=>s.replaceAll('${PLUGIN_ROOT}',plugin);
 const transport=new StdioClientTransport({command:config.command,args:[...config.args.map(replace),...extra],cwd:replace(config.cwd),stderr:'pipe'});
 const client=new Client({name:'codex-local-plugin-package-check',version:'1.0.0'});let stderr='';transport.stderr?.on('data',b=>stderr+=b);
 try{
  await client.connect(transport);assert.deepEqual(client.getServerVersion(),{name:'semantic-ui-checks',version:manifest.version});
  assert.equal(client.getServerCapabilities()?.resources,undefined);
  const tools=(await client.listTools()).tools;assert(tools.every(t=>t.annotations?.readOnlyHint&&t.annotations?.openWorldHint===false&&!t._meta?.ui));
  return {client,transport,tools,stderr:()=>stderr};
 }catch(error){await client.close();await transport.close();throw error;}
}
async function using(config,plugin,label,extra,run){
 const connection=await connect(config,plugin,extra);try{
  sessions.push({label,server:connection.client.getServerVersion(),tools:connection.tools.map(t=>t.name),uiResources:false});
  const call=async(name,args)=>{const result=await connection.client.callTool({name,arguments:args});assert(!result.isError);calls.push({session:label,tool:name,arguments:args,result:result.structuredContent});return result.structuredContent;};
  await run(call,connection);assert.equal(connection.stderr(),'');
 }finally{await connection.client.close();await connection.transport.close();closed++;}
}
try{
 execFileSync('unzip',['-q',zip,'-d',target]);
 for(const f of manifest.files){const file=path.join(target,f.path);assert((await stat(file)).isFile());assert.equal(sha(await readFile(file)),f.sha256);}
 const market=await read(path.join(target,'.agents/plugins/marketplace.json')),selected=market.plugins.find(p=>p.name==='semantic-ui-checks');assert(selected&&selected.source.path==='./plugins/semantic-ui-checks');
 const plugin=path.join(target,selected.source.path),p=await read(path.join(plugin,'plugin.json')),mcp=await read(path.join(plugin,'mcp.json')),config=mcp.mcpServers['semantic-ui-checks'];
 assert.equal(p.version,manifest.version);assert(p.extensions['com.openai'].requires_local_executor);assert.equal(config.type,'stdio');assert.equal(config.command,'node');
 assert.equal(config.cwd,'${PLUGIN_ROOT}');assert.deepEqual(config.args,['${PLUGIN_ROOT}/dist/mcp.js']);
 assert.equal(await stat(path.join(plugin,'node_modules')).then(()=>true,()=>false),false);
 const numeric=numericRequest([null,null,null],'电流','毫安','standalone-check').view;
 await using(config,plugin,'default',[],async(call,c)=>{
  assert.deepEqual(c.tools.map(t=>t.name),['semantic_ui_schema','semantic_ui_check','semantic_ui_template_check']);
  assert(!c.client.getInstructions().includes('semantic_ui_source_check'));
  const schema=await call('semantic_ui_schema',{component:'DataChart'});assert(schema.payloadSchema);
  const facts=await call('semantic_ui_check',{view:numeric});assert.equal(facts.status,'validated');assert.equal(facts.sourceFactsVerified,false);
  assert.equal(facts.dataFacts.series[0].mean,null);assert.equal(facts.dataFacts.series[0].zeroFillIllustration.mean,0);assert.equal(facts.dataFacts.series[0].zeroFillIllustration.completeDataMeanKnown,false);
  const document=exportTemplate({version:1,name:'本地数值形状',definition:extractDefinition(numeric),theme:defaultTheme,layout:defaultLayout});
  assert.equal((await call('semantic_ui_template_check',{document,view:numeric})).status,'compatible');
  const wrong=structuredClone(numeric);wrong.payload.series.push({id:'extra',label:'额外系列'});wrong.payload.rows.forEach(r=>r.values.extra=null);
  assert.equal((await call('semantic_ui_template_check',{document,view:wrong})).status,'incompatible');
 });
 const sources=[
  {kind:'workflow-zh',source:'虚构任务流程为入口→处理→发送，发送→归档；归档失败只重试归档，不回滚发送。归档出错与处理出错分别会影响哪里？'},
  {kind:'permissions-zh',source:'演示服务中，前端只能访问网关，网关只读索引；禁止前端访问索引。请解释访问边界。'},
 ];
 for(const s of sources){
  const file=path.join(target,s.kind+'.txt');await writeFile(file,s.source);const reference=sourceReference(core,s.source,s.kind);assert.equal(reference.status,'ready');
  await using(config,plugin,s.kind,['--source-file',file,'--source-kind',s.kind],async(call,c)=>{
   assert.equal(c.tools.length,4);const inspected=await call('semantic_ui_source_check',{});assert.equal(inspected.sourceCheckKind,s.kind);
   assert.equal(inspected.source.textSha256,sha(s.source));assert.equal((await call('semantic_ui_source_check',reference.request)).comparison.status,'matched');
   const wrong=structuredClone(reference.request);
   if(s.kind==='workflow-zh')wrong.mapping.failurePolicies=[];else wrong.view.payload.edges[1].type='read-write';
   const refused=await call('semantic_ui_source_check',wrong);assert.notEqual(refused.comparison?.status,'matched');assert.equal(refused.canonicalExplanation.status,'withheld');
  });
 }
 await writeFile(path.join(output,'stdio-receipts.json'),json({sessions,calls,closedServers:closed,newModelStarts:0,sourceFactsVerified:false,identityVerified:false,freeProseVerified:false}));
 await writeFile(path.join(output,'acceptance.json'),json({version:manifest.version,zipSha256:manifest.sha256,sourceCommit:manifest.sourceCommit,origin:manifest.origin,filesVerified:manifest.files.length,
  extractedOutsideRepository:true,extractionPathContainsSpaces:true,serverWithoutNodeModules:true,portableManifestAndMarketplace:true,defaultTools:3,sourceKindsVerified:sources.map(s=>s.kind),stdioToolCalls:calls.length,closedServers:closed,
  currentCodexClientInstalled:false,mainChatLoaded:false,nativeUiVerified:false,globalConfigChanged:false,newModelStarts:0}));
 console.log(json({version:manifest.version,filesVerified:manifest.files.length,stdioToolCalls:calls.length,closedServers:closed,newModelStarts:0}));
}finally{await rm(target,{recursive:true,force:true});}
