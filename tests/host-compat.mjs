import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from '@playwright/test';

// Real isolated DSH and the unmodified public GenUI package. All responses
// are deterministic fixtures; this never measures a model's expression choice.
const root=process.cwd();
const run=path.join(root,'artifacts/local/compat-'+Date.now());
const home=path.join(run,'home');
const profile=path.join(home,'profiles/web');
await mkdir(profile,{recursive:true});
await mkdir(path.join(run,'documents'),{recursive:true});
const freePort=()=>new Promise(resolve=>{
  const server=createServer();server.listen(0,'127.0.0.1',()=>{
    const port=server.address().port;server.close(()=>resolve(port));
  });
});
const port=await freePort(),fixturePort=await freePort();
const env={...process.env,DSH_HOME:home,DSH_SEMANTIC_FIXTURE_KEY:'local-fixture-placeholder',FIXTURE_PORT:String(fixturePort),FIXTURE_OUTPUT_DIR:path.join(run,'requests')};
await writeFile(path.join(profile,'package.json'),JSON.stringify({name:'semantic-compat-profile',private:true,dependencies:{},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']}}}));
await writeFile(path.join(profile,'cordis.yml'),'[]\n');
const cli=path.join(root,'node_modules/@deepseek-ai/dsh/lib/bin.js');
const install=spawn(process.execPath,[cli,'plugin','--profile','web','add',process.env.GENUI_PACKAGE??'@changfenhuang/dsh-genui@0.14.0'],{env,stdio:['ignore','pipe','pipe']});
let installLog='';install.stdout.on('data',b=>installLog+=b);install.stderr.on('data',b=>installLog+=b);
const installCode=await new Promise(resolve=>install.once('exit',resolve));
await writeFile(path.join(run,'install.log'),installLog);
assert.equal(installCode,0,'Public GenUI installation failed; inspect the private compatibility run log.');
const base=`- id: workspace-controller\n  config:\n    documentsDirectory: ${JSON.stringify(path.join(run,'documents'))}\n- id: llm-pi-ai\n  config:\n    providers:\n      semantic-fixture:\n        api: openai-completions\n        apiKeyEnv: DSH_SEMANTIC_FIXTURE_KEY\n        baseURL: http://127.0.0.1:${fixturePort}/v1\n        models:\n          - id: semantic-fixture\n            name: Deterministic fixture (not a real model)\n            contextWindow: 32768\n            maxTokens: 4096\n- id: tools\n  config:\n    mode: native\n- id: genui\n  config:\n    renderUiTool: false\n    fenceFeedback: false\n`;
await writeFile(path.join(profile,'cordis.patch.yml'),base);
const overlay=path.join(run,'semantic.patch.yml');
const fixture=spawn(process.execPath,['--import','tsx','tests/fixtures/llm-server.ts'],{env,stdio:['ignore','pipe','pipe']});
let fixtureLog='';fixture.stdout.on('data',b=>fixtureLog+=b);fixture.stderr.on('data',b=>fixtureLog+=b);
let host,browser,context,page;
const errors=[];
async function stop(child){
  if(!child||child.exitCode!==null)return;
  child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);
  if(child.exitCode===null)child.kill('SIGKILL');
}
async function start(generation){
  await writeFile(overlay,generation===null?'[]\n':`- insert:\n    - id: dsh-semantic-ui\n      name: ${JSON.stringify(path.join(root,'dist/host.js'))}\n      config:\n        generation: ${generation}\n`);
  host=spawn(process.execPath,[cli,'--profile','web','--patch',overlay,'--no-open','--port',String(port)],{env,stdio:['ignore','pipe','pipe']});
  let log='';host.stdout.on('data',b=>log+=b);host.stderr.on('data',b=>log+=b);
  for(let i=0;i<300&&!/dsh web: http/.test(log);i++){
    if(host.exitCode!==null)break;await delay(100);
  }
  await writeFile(path.join(run,`host-generation-${generation}.log`),log);
  const auth=log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)?.[0];
  assert(auth,'Isolated compatibility host did not become ready; inspect its private log.');
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(auth);await page.waitForTimeout(900);
  const cont=page.getByRole('button',{name:'Continue',exact:true});if(await cont.isVisible())await cont.click();
}
const rpc=(method,args={})=>page.evaluate(async({method,args})=>{
  const response=await fetch('/api/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:{args}})});
  const json=await response.json();if(!json.result?.ok)throw Error('Host RPC refused '+method);
  return json.result.value;
},{method,args});
const prompt=(sessionId,text)=>rpc('session/prompt',{request:{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text}],clientTimeZone:'UTC'}});
const legacy=()=>page.locator('.genui-dom-fence').getByText('Legacy renderer still owns this saved message.',{exact:true});
const semantic=()=>page.getByRole('heading',{name:'Parcel service dependencies',exact:true});
try{
  browser=await chromium.launch();context=await browser.newContext({viewport:{width:1100,height:1600}});
  await start(true);
  const {workspace}=await rpc('workspace/create',{request:{path:root}});
  const row=page.getByRole('treeitem',{name:workspace.title,exact:true});await row.waitFor();
  if(await row.getAttribute('aria-expanded')!=='true')await row.click();
  const title='Semantic and public GenUI history fixture';
  const {sessionId}=await rpc('session/create',{request:{workspaceId:workspace.workspaceId}});
  await rpc('session/rename',{request:{sessionId,title}});
  await rpc('session/selectModel',{request:{sessionId,provider:'semantic-fixture',model:'semantic-fixture'}});
  await prompt(sessionId,'GENUI_HISTORY: deterministic saved-message fixture, not a natural-question test.');
  await page.getByRole('treeitem',{name:new RegExp(title)}).click();
  await legacy().waitFor({timeout:25000});
  await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden'});
  await prompt(sessionId,'Semantic fixture architecture: deterministic coexistence fixture.');
  await semantic().waitFor({timeout:25000});await legacy().waitFor();
  await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden'});
  await page.reload();await semantic().waitFor();await legacy().waitFor();
  assert.equal(await page.locator('[data-semantic-ui]').count(),1);
  await page.getByRole('button',{name:'New session',exact:true}).first().click();
  await page.getByRole('treeitem',{name:new RegExp(title)}).click();await semantic().waitFor();await legacy().waitFor();
  await page.locator('.genui-dom-fence').screenshot({path:path.join(run,'genui-history.png')});
  const scaleTitle='Semantic fixture 24-service graph';
  const {sessionId:scaleSession}=await rpc('session/create',{request:{workspaceId:workspace.workspaceId}});
  await rpc('session/rename',{request:{sessionId:scaleSession,title:scaleTitle}});
  await rpc('session/selectModel',{request:{sessionId:scaleSession,provider:'semantic-fixture',model:'semantic-fixture'}});
  await prompt(scaleSession,'Semantic fixture architecture ARCHITECTURE_SCALE: deterministic scale fixture.');
  await page.getByRole('treeitem',{name:new RegExp(scaleTitle)}).click();
  await page.getByRole('heading',{name:'Fictional 24-service dependencies',exact:true}).waitFor({timeout:25000});
  const large=page.locator('[data-semantic-ui]');await large.evaluate(el=>el.style.maxWidth='360px');
  await page.getByText('Showing 24/24 nodes',{exact:false}).waitFor();
  await page.getByRole('combobox',{name:'Locate node'}).selectOption('n12');
  await page.getByRole('checkbox',{name:'Immediate neighborhood'}).check();
  await page.getByText('Showing 5/24 nodes',{exact:false}).waitFor();
  await large.screenshot({path:path.join(run,'architecture-large-neighborhood-360.png')});
  await page.getByRole('button',{name:'Restore full graph',exact:true}).click();
  await page.getByText('Showing 24/24 nodes',{exact:false}).waitFor();
  const largeWidth=(await large.boundingBox()).width;
  const largeOverflow=await large.evaluate(el=>{const r=el.shadowRoot.querySelector('.semantic-root');return r.scrollWidth-r.clientWidth;});
  assert.equal(largeWidth,360);assert(largeOverflow<=1);
  await large.screenshot({path:path.join(run,'architecture-large-overview-360.png')});
  await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden'});
  await page.close();await stop(host);host=undefined;
  await start(false);
  await page.getByRole('treeitem',{name:new RegExp(title)}).click();await semantic().waitFor();await legacy().waitFor();
  assert.equal(await page.locator('[data-semantic-ui]').count(),1);
  await prompt(sessionId,'GUIDANCE_PROBE: deterministic tool and system-prompt inspection.');
  await page.getByText('Generation probe finished.',{exact:true}).waitFor({timeout:20000});
  await page.reload();await semantic().waitFor();await legacy().waitFor();
  const requests=await Promise.all((await readdir(path.join(run,'requests'))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(path.join(run,'requests',f),'utf8'))));
  const probe=requests.find(r=>JSON.stringify(r.messages.filter(m=>m.role==='user')).includes('GUIDANCE_PROBE'));
  assert(probe,'The model-visible probe request must be retained.');
  const tools=probe.tools.map(t=>t.function.name);
  const system=JSON.stringify(probe.messages.filter(m=>m.role==='system'||m.role==='developer'));
  assert(!tools.includes('dsh_semantic_ui'));assert(!system.includes('For relationships, tradeoffs, or numeric data'));
  assert(!system.includes('dsh-semantic-ui:delivery'));
  assert(!tools.includes('render_ui'));assert(tools.includes('validate_dsh_ui'));
  assert(system.includes('dsh-ui'),'Original GenUI instructions remain; do not claim renderUiTool disables all guidance.');
  await page.close();await stop(host);host=undefined;
  await start(null);
  await page.getByRole('treeitem',{name:new RegExp(title)}).click();await legacy().waitFor();
  await page.getByText('Deterministic fixture completed.',{exact:false}).waitFor();
  assert.equal(await page.locator('[data-semantic-ui]').count(),0);
  assert(!(await page.evaluate(()=>window.__DSH_BOOT__.entries.some(e=>e.id==='@whytan/dsh-semantic-ui'))));
  await page.close();await stop(host);host=undefined;
  await start(true);
  await page.getByRole('treeitem',{name:new RegExp(title)}).click();await legacy().waitFor();await semantic().waitFor();
  assert.equal(await page.locator('[data-semantic-ui]').count(),1);
  assert.equal(errors.length,0,'Browser page errors are recorded as compatibility failures.');
  const result={source:'real DSH 0.2.1-rc.2; deterministic fixture, not natural-question acceptance',genui:{package:'@changfenhuang/dsh-genui',version:'0.14.0',unmodifiedPublicPackage:true,renderUiTool:false,fenceFeedback:false},bothRenderersVisible:true,legacyMessageOwnedByOriginalRenderer:true,refresh:true,sessionSwitch:true,generationDisabled:{semanticToolAbsent:true,semanticResidentGuidanceAbsent:true,semanticHistoryRestored:true,genuiHistoryRestored:true},pluginOmittedFromComposition:{conversationStillReadable:true,semanticRendererAbsent:true,genuiHistoryRestored:true},reenablingRestoresSemanticHistory:true,genuiRemainingGuidance:true,genuiValidationToolStillPresent:true,largerGraph:{nodes:24,edges:45,narrowContainer:largeWidth,narrowOverflow:largeOverflow,searchAndNeighborhood:true,fullGraphRestored:true},pageErrors:errors,modelSelectionCompatibility:'not tested; deterministic fixtures do not establish expression choice',userExistingEnvironment:'not accessed or verified'};
  await writeFile(path.join(run,'compatibility.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}catch(error){
  if(page&&!page.isClosed()){
    await writeFile(path.join(run,'failure-snapshot.txt'),await page.locator('body').ariaSnapshot());
    await writeFile(path.join(run,'browser-errors.json'),JSON.stringify(errors));
    await writeFile(path.join(run,'client-entries.json'),JSON.stringify(await page.evaluate(()=>window.__DSH_BOOT__?.entries.map(e=>e.id))));
  }
  throw error;
}finally{
  await browser?.close();await stop(host);await stop(fixture);
  await writeFile(path.join(run,'fixture.log'),fixtureLog);
}
