import{chromium,expect}from'@playwright/test';
import{readFileSync,writeFileSync,readdirSync,mkdirSync}from'node:fs';
import{join,resolve}from'node:path';import{randomUUID,createHash}from'node:crypto';import assert from'node:assert/strict';
import{examples}from'../fixtures/examples';import{declaredDecision}from'../fixtures/consistency';import{numericExpected}from'../fixtures/source-numeric';import{zhCN}from'../src/locales/zh-CN';
const t=k=>zhCN[k]??k,output=process.env.HOST_OUTPUT,shared=process.env.HOST_SHARED,mode=process.env.TOOL_MODE,phase=process.env.RESULT_PHASE;
const carry=resolve(process.env.RESULT_CARRY_DIR,mode);mkdirSync(carry,{recursive:true});
const auth=readFileSync(output+'/dsh-host.log','utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1100,height:2400},reducedMotion:'reduce'}),errors=[],cases=[],consoleErrors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&consoleErrors.length<30)consoleErrors.push(m.text());});p.setDefaultTimeout(15000);
const rpc=(method,payload)=>p.evaluate(async({method,payload})=>{const response=await fetch('/api/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload})});const body=await response.json();if(!body.result?.ok)throw Error(body.result?.error?.message??'RPC failed');return body.result.value;},{method,payload});
const session=(method,request)=>rpc(method,{args:{request}}),library=()=>rpc('dsh-semantic-ui/results',{action:'list'});
const views=examples.map((v,i)=>{v=structuredClone(v.component==='DecisionExplorer'?declaredDecision:v);v.displayId='portable-'+mode+'-'+i;v.payload.title='完整结果合成样本 '+i;return v;});
async function turn(workspaceId,key,argsSequence,text){
 writeFileSync(process.env.SOURCE_HOST_CASE_FILE,JSON.stringify({key,argsSequence}));const {sessionId}=await session('session/create',{workspaceId}),title='Portable '+key+' '+Date.now();
 await session('session/rename',{sessionId,title});await session('session/selectModel',{sessionId,provider:'semantic-fixture',model:'semantic-fixture'});await session('session/prompt',{sessionId,requestId:randomUUID(),mode:'queue',content:[{type:'text',text}],clientTimeZone:'UTC'});
 await p.getByRole('treeitem',{name:new RegExp(title)}).click();await p.getByRole('banner').hover();await p.getByText('Local host source fixture '+key+' completed.',{exact:false}).waitFor({timeout:40000});await p.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:15000});return sessionId;
}
const roots=()=>p.locator('[data-semantic-ui] .semantic-root');
async function panel(root){await root.locator('.result-panel').evaluate(el=>el.open=true);}
async function exported(root,path){await panel(root);const download=p.waitForEvent('download');await root.getByRole('button',{name:t('Export full result'),exact:true}).click();const file=await download;await file.saveAs(path);return JSON.parse(readFileSync(path));}
async function style(root){
 await root.locator('.template-panel').evaluate(el=>el.open=true);
 for(const [key,value]of [['Color mode','dark'],['Palette','forest'],['Typeface','mono'],['Density','compact'],['Text size','large']])await root.getByRole('combobox',{name:t(key),exact:true}).selectOption(value);
 if(await root.locator('.architecture').count())await root.getByRole('combobox',{name:t('Graph direction'),exact:true}).selectOption('vertical');
 await root.locator('.template-panel').evaluate(el=>el.open=false);
}
function equivalent(a,b){const x=structuredClone(a),y=structuredClone(b);const av=x.interaction.viewport,bv=y.interaction.viewport;if(av||bv){assert(av&&bv);for(const k of ['x','y','zoom'])assert(Math.abs(av[k]-bv[k])<0.02,`viewport ${k}: ${av[k]} vs ${bv[k]}`);delete x.interaction.viewport;delete y.interaction.viewport;}assert.deepEqual(x,y);}
try{
 await p.goto(auth);await p.waitForTimeout(500);if(await p.getByRole('button',{name:'Continue',exact:true}).isVisible())await p.getByRole('button',{name:'Continue',exact:true}).click();
 const {workspace}=await session('workspace/create',{path:process.cwd()}),wr=p.getByRole('treeitem',{name:workspace.title,exact:true});await wr.waitFor();if(await wr.getAttribute('aria-expanded')!=='true')await wr.click();
 const initial=await library();assert.equal(initial.results.length,0,'fresh result library');
 await turn(workspace.workspaceId,'portable-'+phase+'-'+mode,views.map(view=>({action:'render',view})),'请显示四个公开合成语义视图，用于完整结果包检查。');await expect(roots()).toHaveCount(4);
 const modelRequestsBefore=readdirSync(shared+'/requests').length;
 if(phase==='export'){
  for(const [i,v]of views.entries()){
   const root=roots().nth(i);await expect(root.getByRole('heading',{name:v.payload.title,exact:true})).toBeVisible();await style(root);
   if(v.component==='ArchitectureExplorer'){
    await root.getByRole('combobox',{name:t('Locate node'),exact:true}).selectOption(v.payload.nodes[0].id);await root.getByLabel(t('Immediate neighborhood'),{exact:true}).check();
    if(v.payload.scenarios.length)await root.getByRole('combobox',{name:t('Scenario'),exact:true}).selectOption(v.payload.scenarios[0].id);
    await root.getByPlaceholder(t('Search labels'),{exact:true}).fill(v.payload.nodes[0].label.slice(0,2));await p.waitForTimeout(250);
   }else if(v.component==='DecisionExplorer'){
    const input=v.payload.inputs.find(i=>i.type==='boolean');if(input)await root.getByRole('combobox',{name:input.label,exact:true}).selectOption('unknown');
    const dimensions=root.locator('.decision fieldset').first().getByRole('checkbox');if(await dimensions.count()>1)await dimensions.last().uncheck();
    if(v.payload.rules.length)await root.getByLabel(t('Explore preference policy (unverified)'),{exact:true}).check();
   }else{
    await root.getByRole('spinbutton',{name:t('From index'),exact:true}).fill('1');
    const boxes=root.locator('.chart fieldset input[type="checkbox"]');if(await boxes.count()>1)await boxes.last().uncheck();
    await root.getByRole('combobox',{name:t('Table scope'),exact:true}).selectOption(i===2?'all':'filtered');
   }
   const document=await exported(root,join(carry,i+'.json'));assert.equal(document.content.locale,'zh-CN');assert.equal(document.content.theme.mode,'dark');assert.equal(document.content.sourceRecord.status,'unverified');assert.deepEqual(document.content.view.payload,v.payload);
   cases.push({index:i,component:v.component,sourceStatus:document.content.sourceRecord.status,sha256:document.sha256});
  }
  assert.equal(readdirSync(shared+'/requests').length,modelRequestsBefore);
  const positive=JSON.parse(readFileSync('fixtures/source-numeric-request.json'))[0];await turn(workspace.workspaceId,'portable-bound-'+mode,[{action:'render',...positive}],numericExpected.question);await expect(roots()).toHaveCount(1);
  const root=roots().first();await expect(root.locator('[data-original-data-scope]')).toBeVisible();await root.getByRole('spinbutton',{name:t('From index'),exact:true}).fill('1');const document=await exported(root,join(carry,'4.json'));
  assert.equal(document.content.sourceRecord.status,'bound');assert.equal(document.content.sourceRecord.identityVerified,false);assert.equal(document.manifest.sourceState,'bound-record');cases.push({index:4,component:'DataChart',sourceStatus:'bound',sha256:document.sha256});
 }else{
  assert.equal(phase,'import');const names=[];
  for(let i=0;i<5;i++){
   const document=JSON.parse(readFileSync(join(carry,i+'.json'))),root=roots().nth(Math.min(i,3)),name='携带结果 '+i;names.push(name);await panel(root);await root.getByRole('textbox',{name:t('Result name'),exact:true}).fill(name);
   await root.getByLabel(t('Import full result'),{exact:true}).setInputFiles(join(carry,i+'.json'));await expect(root.locator('[data-imported-result]')).toBeVisible();await expect(root.getByRole('heading',{name:document.content.view.payload.title,exact:true})).toBeVisible();
   await expect(root.locator('[data-original-data-scope]')).toHaveCount(0);await expect(root.locator('.source-update')).toHaveCount(0);
   const actual=await exported(root,output+'/evidence/roundtrip-'+i+'.json');equivalent(actual.content,document.content);assert.equal(actual.manifest.sourceState,document.manifest.sourceState);
   const original=await library(),originalView=actual.content;
   if(i===0){
    for(const bad of [{...document,sha256:'0'.repeat(64)},{...document,manifest:{...document.manifest,version:99}}]){
     await root.getByLabel(t('Import full result'),{exact:true}).setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await expect(root.getByRole('status').filter({hasText:t('Result operation failed. Previous result is unchanged.')})).toBeVisible();assert.deepEqual(await library(),original);equivalent((await exported(root,output+'/evidence/after-refusal.json')).content,originalView);
    }
   }
   if(i===4){assert.equal(actual.content.view.payload.rows.filter(r=>Object.values(r.values).includes(null)).length,1);await root.getByRole('spinbutton',{name:t('From index'),exact:true}).fill('2');const changed=await exported(root,output+'/evidence/continued.json');assert.equal(changed.content.interaction.from,2);assert.deepEqual(changed.content.view,document.content.view);assert.deepEqual(changed.content.sourceRecord,document.content.sourceRecord);}
   cases.push({index:i,component:document.content.view.component,contentRestored:true,sourceState:document.manifest.sourceState});
  }
  await p.reload();await expect(roots()).toHaveCount(4);const root=roots().first();await panel(root);await root.getByRole('button',{name:t('Load saved results'),exact:true}).click();const saved=await library();assert.equal(saved.results.length,5);
  for(let i=0;i<5;i++){
   const document=JSON.parse(readFileSync(join(carry,i+'.json'))),id=saved.results.find(r=>r.name===names[i]).id;
   await root.getByRole('combobox',{name:t('Saved result'),exact:true}).selectOption(id);await root.getByRole('button',{name:t('Open saved result'),exact:true}).click();await expect(root.getByRole('heading',{name:document.content.view.payload.title,exact:true})).toBeVisible();
   const reopened=await exported(root,output+'/evidence/reopened-'+i+'.json');equivalent(reopened.content,document.content);
   if(document.content.view.component==='DecisionExplorer'){const input=document.content.view.payload.inputs.find(i=>i.type==='boolean');if(input){await root.getByRole('combobox',{name:input.label,exact:true}).selectOption('false');const edited=await exported(root,output+'/evidence/reopened-edited.json');assert.equal(edited.content.interaction.values[input.id],false);assert.deepEqual(edited.content.view,document.content.view);}}
   if(i===0||i===4){for(const width of [640,360]){await root.evaluate((el,width)=>{el.style.width=width+'px';el.style.maxWidth='100%';},width);await expect.poll(()=>root.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);await root.screenshot({path:output+'/evidence/result-'+i+'-'+width+'.png'});}}
  }
  assert.equal(readdirSync(shared+'/requests').length,modelRequestsBefore,'imports/reopen/local edits do not call model');
 }
 assert.deepEqual(errors,[]);const requestFiles=readdirSync(shared+'/requests'),calls=new Map();
 for(const file of requestFiles)for(const m of JSON.parse(readFileSync(shared+'/requests/'+file)).messages)for(const c of m.tool_calls??[])calls.set(c.id,c.function);
 assert(calls.size>0);assert([...calls.values()].every(c=>mode==='native'?c.name==='dsh_semantic_ui':c.name==='run_code'&&JSON.parse(c.arguments).code.includes('tools.dsh_semantic_ui')));
 writeFileSync(output+'/evidence/results-'+phase+'.json',JSON.stringify({mode,phase,cases,cleanResultLibraryAtStart:true,pageErrors:errors,fixtureOnly:true,newRealModelTurns:0,localHttpRequestsSoFar:requestFiles.length,executedToolCalls:calls.size,actualToolRoute:mode==='native'?'dsh_semantic_ui':'run_code -> tools.dsh_semantic_ui',archiveInstalled:!!process.env.INSTALL_PACKAGE,...(phase==='import'?{fiveSavedResultsReopenedAfterRefresh:true,localInteractionsContinue:true,corruptAndUnsupportedRefusedWithoutOverwrite:true,noRequestsDuringImportReopenAndLocalEdits:true,widths:[640,360],noRootOverflow:true}:{normalPluginFileDownloads:true})},null,2)+'\n');console.log(JSON.stringify({mode,phase,cases:cases.length,pageErrors:errors}));
}catch(e){writeFileSync(output+'/results-'+phase+'-error.json',JSON.stringify({error:String(e),stack:e.stack,pageErrors:errors,consoleErrors},null,2));try{writeFileSync(output+'/results-'+phase+'-failure.txt',await p.locator('body').ariaSnapshot({timeout:2000}));}catch{}throw e;}finally{await browser.close();}
