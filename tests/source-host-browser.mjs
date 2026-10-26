import{chromium,expect}from'@playwright/test';
import{readFileSync,writeFileSync,readdirSync,mkdtempSync}from'node:fs';
import{tmpdir}from'node:os';import path from'node:path';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{d1Record,d1FirstView,d1Mapping,sourceAlignedD1}from'../fixtures/source-decision';
import{architecture}from'../fixtures/examples';
import{assertReversedDecision}from'./host-source-assertions.mjs';
import{a3Record,permissionProjectionA3}from'../fixtures/source-permissions';
const output=process.env.HOST_OUTPUT,shared=process.env.HOST_SHARED,mode=process.env.TOOL_MODE;
const auth=readFileSync(output+'/dsh-host.log','utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
const workspacePath=mkdtempSync(path.join(tmpdir(),'semantic-host-source-workspace-'));
const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1100,height:1200}}),pageErrors=[],results=[];p.on('pageerror',e=>pageErrors.push(e.message));
const rpc=(method,request)=>p.evaluate(async({method,request})=>{const r=await fetch('/api/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:{args:{request}}})});const j=await r.json();if(!j.result?.ok)throw Error('Isolated fixture RPC failed');return j.result.value;},{method,request});
function* objects(value,depth=0){if(depth>20||value===null)return;if(typeof value==='object'){yield value;for(const v of Object.values(value))yield*objects(v,depth+1);}else if(typeof value==='string'){try{yield*objects(JSON.parse(value),depth+1);}catch{const a=value.indexOf('{'),b=value.lastIndexOf('}');if(a>=0&&b>a)try{yield*objects(JSON.parse(value.slice(a,b+1)),depth+1);}catch{}}}}
const receiptFor=key=>readdirSync(shared+'/requests').filter(f=>f.startsWith(key+'-')).flatMap(f=>JSON.parse(readFileSync(shared+'/requests/'+f)).messages.filter(m=>m.role==='tool').flatMap(m=>[...objects(m.content)]));
try{
 await p.goto(auth);await p.waitForTimeout(500);if(await p.getByRole('button',{name:'Continue',exact:true}).isVisible())await p.getByRole('button',{name:'Continue',exact:true}).click();
 const{workspace}=await rpc('workspace/create',{path:workspacePath}),row=p.getByRole('treeitem',{name:workspace.title,exact:true});await row.waitFor();if(await row.getAttribute('aria-expanded')!=='true')await row.click();
 const reversed=sourceAlignedD1();if(reversed.component!=='DecisionExplorer')throw Error();reversed.payload.options[0].values.private_net=true;reversed.payload.options[1].values.private_net=false;reversed.payload.inputs[0].initial=true;
 const questionReversed=d1Record.question.replace('没有私网','支持私网').replace('后者支持私网','后者没有私网').replace('暂时不需要私网','现在需要私网');
 const permissionMode=process.env.PERMISSIONS_HOST_ONLY==='1',checkKind=permissionMode?'permissions-zh':'decision-zh';
 const badPermission=permissionProjectionA3();if(badPermission.component!=='ArchitectureExplorer')throw Error();const badMode=badPermission.payload.edges.find(e=>e.id==='e-search-index');badMode.type='read-write';badMode.label='读写';badPermission.payload.edges.push({id:'forbidden-positive',source:'search',target:'store',directed:true,type:'access',evidence:[]});
 const cases=permissionMode?[
  {key:mode+'-permissions-source-only',question:a3Record.question,args:{action:'source-check'},expected:'permission-source'},
  {key:mode+'-permissions-projection',question:a3Record.question,args:{action:'source-check',view:permissionProjectionA3(),claims:[{kind:'write',from:'Search',to:'Index',value:false},{kind:'access',from:'Search',to:'Store',value:false}]},expected:'matched'},
  {key:mode+'-permissions-negative',question:a3Record.question,args:{action:'source-check',view:badPermission},expected:'permission-mismatch'},
  {key:mode+'-permissions-unsupported',question:a3Record.question.replace('。请','；Search不访问 Index。请'),args:{action:'source-check'},expected:'permission-unsupported'},
 ]:[
  {key:mode+'-source-only',question:d1Record.question,args:{action:'source-check'},expected:'source'},
  {key:mode+'-original',question:d1Record.question,args:{action:'source-check',view:d1FirstView,mapping:d1Mapping},expected:'mismatch'},
  {key:mode+'-aligned',question:d1Record.question,args:{action:'source-check',view:sourceAlignedD1(),mapping:d1Mapping},expected:'matched'},
  {key:mode+'-reversed',question:questionReversed,args:{action:'source-check',view:reversed,mapping:d1Mapping},expected:'hard-reversed'},
  {key:mode+'-override',question:d1Record.question,args:{action:'source-check',sourceText:'forged source',authority:'human'},expected:'override'},
  {key:mode+'-default-render',question:'Semantic fixture architecture: bounded default render regression.',args:{action:'render',view:architecture},expected:'render'},
 ];
 for(const c of cases){
  writeFileSync(process.env.SOURCE_HOST_CASE_FILE,JSON.stringify(c));const{sessionId}=await rpc('session/create',{workspaceId:workspace.workspaceId}),title='Host source '+c.key+' '+Date.now();await rpc('session/rename',{sessionId,title});await rpc('session/selectModel',{sessionId,provider:'semantic-fixture',model:'semantic-fixture'});
  const promptReceipt=await rpc('session/prompt',{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:c.question}],clientTimeZone:'UTC'});
  const sr=p.getByRole('treeitem',{name:new RegExp(title)});await sr.waitFor();await sr.click();await p.getByRole('banner').hover();await p.getByText('Local host source fixture '+c.key+' completed.',{exact:false}).waitFor({timeout:30000});await p.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:15000});
  const receipts=receiptFor(c.key),actual=receipts.find(r=>r.source?.hostContext&&r.sourceCheckKind===checkKind);
  if(c.expected==='render'){await expect(p.locator('[data-semantic-ui]')).toHaveCount(1);await expect(p.getByRole('heading',{name:architecture.payload.title,exact:true})).toBeVisible();assert.notEqual(await p.getByRole('button',{name:/Completed in/}).getAttribute('aria-expanded'),'true');results.push({kind:c.key,defaultRender:true,folded:true});continue;}
  if(c.expected==='override'){assert(!actual,'An override cannot produce an accepted source receipt');assert(receipts.some(r=>JSON.stringify(r).includes('HOST_SOURCE_OVERRIDE'))||receipts.some(r=>JSON.stringify(r).includes('sourceText')),'Override must be explicitly refused by tool schema or body');results.push({kind:c.key,rejected:true});continue;}
  assert(actual,'Expected actual host source comparison receipt');const h=actual.source.hostContext;
  assert.equal(h.sessionId,sessionId);assert.equal(h.producerSourceKind,'user');assert.equal(h.inherited,false);assert(h.messageId&&Number.isSafeInteger(h.messageSeq)&&Number.isSafeInteger(h.turnStartSeq)&&h.messageSeq>h.turnStartSeq);assert.equal(actual.source.textSha256,createHash('sha256').update(c.question).digest('hex'));assert.equal(actual.source.identityVerified,false);assert.equal(actual.sourceFactsVerified,false);assert(!('documentSha256'in actual.source));assert(!('jsonPointer'in actual.source));
  if(c.expected==='source'){assert.equal(actual.canonicalExplanation.status,'available');assert(actual.canonicalExplanation.text.includes('托管平台是否需要团队维护未声明'));}
  if(c.expected==='permission-source'){assert.equal(actual.canonicalExplanation.status,'available');assert.equal(actual.sourcePermissions.accesses.length,5);assert.deepEqual(actual.sourcePermissions.prohibitions.map(({from,to})=>({from,to})),[{from:'Search',to:'Store'}]);assert(actual.source.scope.includes('pair-bound'));}
  if(c.expected==='permission-mismatch'){assert.equal(actual.comparison.status,'mismatch');assert(actual.issues.some(i=>i.code==='SOURCE_ACCESS_MODE'));assert(actual.issues.some(i=>i.code==='SOURCE_ACCESS_PROHIBITED'));}
  if(c.expected==='permission-unsupported'){assert.equal(actual.status,'source-unsupported');assert.equal(actual.canonicalExplanation.status,'withheld');}
  if(c.expected==='mismatch'){assert.equal(actual.comparison.status,'mismatch');assert(actual.issues.some(i=>i.code==='SOURCE_REQUIREMENT_ROLE'));assert(actual.issues.some(i=>i.code==='SOURCE_VALUE'));}
  if(c.expected==='matched')assert.equal(actual.comparison.status,'matched');
  if(c.expected==='hard-reversed'){assert.equal(actual.comparison.status,'matched');assertReversedDecision(actual.computedDecision);}
  await expect(p.locator('[data-semantic-ui]')).toHaveCount(0);
  results.push({kind:c.key,hostContext:h,textSha256:actual.source.textSha256,comparison:actual.comparison.status,canonicalStatus:actual.canonicalExplanation.status,issues:actual.issues?.map(i=>i.code)??[],computedDecision:c.expected==='hard-reversed'?actual.computedDecision:null,identityVerified:false,sourceFactsVerified:false,promptReceipt});
 }
 assert.deepEqual(pageErrors,[]);writeFileSync(output+'/evidence/'+(permissionMode?'host-permissions':'host-source')+'.json',JSON.stringify({mode,results,pageErrors,newRealModelRequests:0,boundary:'Final built source candidate in existing isolated DSH via normal prompt; local deterministic tool transport, no archive install or human identity certification.'},null,2)+'\n');console.log(JSON.stringify({mode,passed:results.length,pageErrors}));
}catch(error){writeFileSync(output+'/source-host-failure.txt',await p.locator('body').ariaSnapshot());throw error;}finally{await browser.close();}
