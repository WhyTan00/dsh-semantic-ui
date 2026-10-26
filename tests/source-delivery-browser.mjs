import{chromium,expect}from'@playwright/test';
import{readFileSync,writeFileSync,readdirSync,mkdtempSync}from'node:fs';
import{tmpdir}from'node:os';import path from'node:path';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{a3Record,a3FirstView,permissionProjectionA3}from'../fixtures/source-permissions';
import{architecture}from'../fixtures/examples';
const output=process.env.HOST_OUTPUT,shared=process.env.HOST_SHARED,mode=process.env.TOOL_MODE;
const auth=readFileSync(output+'/dsh-host.log','utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
const workspacePath=mkdtempSync(path.join(tmpdir(),'semantic-source-delivery-'));
const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1100,height:1200}}),pageErrors=[],results=[];p.on('pageerror',e=>pageErrors.push(e.message));
const rpc=(method,request)=>p.evaluate(async({method,request})=>{const r=await fetch('/api/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:{args:{request}}})});const j=await r.json();if(!j.result?.ok)throw Error('Isolated fixture RPC failed');return j.result.value;},{method,request});
function* objects(value,depth=0){if(depth>20||value===null)return;if(typeof value==='object'){yield value;for(const v of Object.values(value))yield*objects(v,depth+1);}else if(typeof value==='string'){try{yield*objects(JSON.parse(value),depth+1);}catch{const a=value.indexOf('{'),b=value.lastIndexOf('}');if(a>=0&&b>a)try{yield*objects(JSON.parse(value.slice(a,b+1)),depth+1);}catch{}}}}
const receipts=key=>readdirSync(shared+'/requests').filter(f=>f.startsWith(key+'-')).flatMap(f=>JSON.parse(readFileSync(shared+'/requests/'+f)).messages.filter(m=>m.role==='tool').flatMap(m=>[...objects(m.content)]));
function annotated(revision){const v=permissionProjectionA3();v.revision=revision;v.summary='UNVERIFIED_GLOBAL_SUMMARY_'+revision;v.payload.title='UNVERIFIED_CAUSAL_TITLE';for(const n of v.payload.nodes){n.responsibility='UNVERIFIED_EXCLUSIVE_OWNER';n.constraints=['UNVERIFIED_FAILURE_INDEPENDENCE'];n.evidence=['UNVERIFIED_EVIDENCE'];}v.payload.edges[0].label='UNVERIFIED_GLOBAL_ENTRY';v.payload.scenarios=[{id:'source-path',label:'UNVERIFIED_PATH_NAME',nodeIds:['client','gateway','search','index'],edgeIds:['e-client-gw','e-gw-search','e-search-index'],explanation:'UNVERIFIED_FAULT_PROPAGATION'}];return v;}
try{
 await p.goto(auth);await p.waitForTimeout(500);if(await p.getByRole('button',{name:'Continue',exact:true}).isVisible())await p.getByRole('button',{name:'Continue',exact:true}).click();
 const{workspace}=await rpc('workspace/create',{path:workspacePath}),row=p.getByRole('treeitem',{name:workspace.title,exact:true});await row.waitFor();if(await row.getAttribute('aria-expanded')!=='true')await row.click();
 const bad=annotated(2);bad.payload.edges[3].type='read-write';bad.payload.edges[3].label='读写';bad.payload.edges.push({id:'prohibited-positive',source:'search',target:'store',directed:true,type:'access',evidence:[]});
 const cases=[
  {key:mode+'-bound',question:a3Record.question,argsSequence:[{action:'render',view:annotated(1)},{action:'render',view:annotated(2)}],expected:'bound'},
  {key:mode+'-mismatch-after-check',question:a3Record.question,argsSequence:[{action:'source-check',view:permissionProjectionA3()},{action:'render',view:bad}],expected:'mismatch'},
  {key:mode+'-alias',question:a3Record.question,args:{action:'render',view:a3FirstView},expected:'alias'},
  {key:mode+'-unsupported',question:a3Record.question.replace('。请','；Search不访问Index。请'),args:{action:'render',view:annotated(1)},expected:'unsupported'},
  {key:mode+'-generic',question:'A generic fictional architecture for explicitly unverified structured rendering.',args:{action:'render',view:architecture},expected:'unverified'},
 ];
 let boundTitle;
 for(const c of cases.filter(c=>!process.env.SOURCE_DELIVERY_FINAL_ONLY||['bound','mismatch'].includes(c.expected))){
  writeFileSync(process.env.SOURCE_HOST_CASE_FILE,JSON.stringify(c));const{sessionId}=await rpc('session/create',{workspaceId:workspace.workspaceId}),title='Source delivery '+c.key+' '+Date.now();await rpc('session/rename',{sessionId,title});await rpc('session/selectModel',{sessionId,provider:'semantic-fixture',model:'semantic-fixture'});await rpc('session/prompt',{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:c.question}],clientTimeZone:'UTC'});
  const sr=p.getByRole('treeitem',{name:new RegExp(title)});await sr.waitFor();await sr.click();await p.getByRole('banner').hover();await p.getByText('Local host source fixture '+c.key+' completed.',{exact:false}).waitFor({timeout:30000});await p.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:15000});
  const frame=p.locator('[data-semantic-ui]');await expect(frame).toHaveCount(1);assert.notEqual(await p.getByRole('button',{name:/Completed in/}).getAttribute('aria-expanded'),'true');
  const values=receipts(c.key),delivered=values.filter(v=>v.status==='delivered'&&typeof v.deliveryId==='string'),failed=values.find(v=>v.status==='validation-failed'&&typeof v.deliveryId==='string');
  if(c.expected==='bound'){
   const r=delivered.find(v=>v.revision===2);assert(r);assert.equal(r.sourceDeliveryStatus,'bound');assert.equal(r.sourceFactsVerified,false);assert.equal(r.identityVerified,false);assert(!JSON.stringify(r).includes('UNVERIFIED_'));await expect(frame.getByRole('heading',{name:'来源声明的直接访问与权限',exact:true})).toBeVisible();await expect(frame.locator('footer')).toContainText('revision 2');await expect(frame.locator('.source-explanation')).toBeVisible();
   assert((await frame.locator('.source-explanation p').first().innerText()).includes(r.canonicalExplanation));assert(!(await frame.textContent()).includes('UNVERIFIED_'));
   await frame.getByRole('combobox',{name:'Locate node',exact:true}).selectOption('gateway');await expect(frame.locator('.detail')).toContainText('Gateway → Search');assert(!(await frame.locator('.detail').innerText()).includes('UNVERIFIED_'));
   await p.reload();await expect(p.locator('[data-semantic-ui] .source-explanation')).toBeVisible();await expect(p.locator('[data-semantic-ui] footer')).toContainText('revision 2');assert(!(await p.locator('[data-semantic-ui]').textContent()).includes('UNVERIFIED_'));
   await p.setViewportSize({width:1100,height:2600});await p.locator('[data-semantic-ui]').evaluate(el=>{el.style.width='360px';el.style.maxWidth='100%';});await p.locator('[data-semantic-ui] .semantic-root').scrollIntoViewIfNeeded();const size=await p.locator('[data-semantic-ui] .semantic-root').evaluate(el=>({width:el.getBoundingClientRect().width,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));assert(size.width>=359&&size.width<=361);assert(size.scrollWidth<=size.clientWidth+1);await p.locator('[data-semantic-ui] .semantic-root').screenshot({path:output+'/evidence/source-delivery.png'});
   results.push({kind:c.key,status:'bound',revisions:[1,2],folded:true,refresh:true,container:size,canonicalExplanation:r.canonicalExplanation,modelAnnotationsAbsent:true,sourceFactsVerified:false,identityVerified:false});boundTitle=title;
  }else if(c.expected==='unverified'){
   assert(delivered.some(v=>v.sourceDeliveryStatus==='unverified'));await expect(frame.locator('[data-source-unverified]')).toBeVisible();await expect(frame.locator('.source-explanation')).toHaveCount(0);await expect(frame.getByRole('heading',{name:architecture.payload.title,exact:true})).toBeVisible();results.push({kind:c.key,status:'unverified',folded:true});
  }else{
   assert(failed);assert.equal(delivered.length,0);await expect(frame.getByRole('alert')).toBeVisible();await expect(frame.locator('.source-explanation')).toHaveCount(0);await expect(frame.locator('.architecture')).toHaveCount(0);
   const codes=failed.issues.map(i=>i.code);if(c.expected==='mismatch'){assert(codes.includes('SOURCE_ACCESS_MODE'));assert(codes.includes('SOURCE_ACCESS_PROHIBITED'));assert(values.some(v=>v.sourceCheckKind==='permissions-zh'&&v.comparison?.status==='matched'));}if(c.expected==='alias')assert(codes.includes('SOURCE_BINDING_UNVERIFIED'));results.push({kind:c.key,status:'refused',codes,folded:true});
  }
 }
 await p.getByRole('treeitem',{name:new RegExp(boundTitle)}).click();await expect(p.locator('[data-semantic-ui] .source-explanation')).toBeVisible();await expect(p.locator('[data-semantic-ui] footer')).toContainText('revision 2');assert(!(await p.locator('[data-semantic-ui]').textContent()).includes('UNVERIFIED_'));results[0].historyReopened=true;
 assert.deepEqual(pageErrors,[]);writeFileSync(output+'/evidence/source-delivery.json',JSON.stringify({mode,results,pageErrors,newRealModelRequests:0,boundary:'Final built source candidate, normal render/session entry with local deterministic transport; no archive install, natural-model pass or independent human authentication.'},null,2)+'\n');console.log(JSON.stringify({mode,passed:results.length,pageErrors}));
}catch(error){writeFileSync(output+'/source-delivery-failure.txt',await p.locator('body').ariaSnapshot());throw error;}finally{await browser.close();}
