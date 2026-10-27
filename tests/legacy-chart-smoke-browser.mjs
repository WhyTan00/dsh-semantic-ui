import{chromium,expect}from'@playwright/test';
import{readFileSync,writeFileSync,readdirSync}from'node:fs';
import assert from'node:assert/strict';
const origin=process.env.HOST_ORIGIN,output=process.env.HOST_OUTPUT,shared=process.env.HOST_SHARED,mode=process.env.TOOL_MODE;
assert.notEqual(new URL(origin).port,'3200');
const auth=readFileSync(output+'/dsh-host.log','utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1100,height:1600}}),p=await context.newPage(),errors=[];
p.on('pageerror',e=>errors.push(e.message));
const rpc=(method,request)=>p.evaluate(async({method,request})=>{const response=await fetch('/api/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:{args:{request}}})});const r=(await response.json()).result;if(!r.ok)throw Error('Isolated fixture RPC failed');return r.value;},{method,request});
try{
 await p.goto(auth);await p.waitForTimeout(700);if(await p.getByRole('button',{name:'Continue',exact:true}).isVisible())await p.getByRole('button',{name:'Continue',exact:true}).click();
 const {workspace}=await rpc('workspace/create',{path:process.cwd()}),wr=p.getByRole('treeitem',{name:workspace.title,exact:true});await wr.waitFor();if(await wr.getAttribute('aria-expanded')!=='true')await wr.click();
 const {sessionId}=await rpc('session/create',{workspaceId:workspace.workspaceId}),title='Legacy chart smoke '+mode+' '+Date.now();
 await rpc('session/rename',{sessionId,title});await rpc('session/selectModel',{sessionId,provider:'semantic-fixture',model:'semantic-fixture'});
 await rpc('session/prompt',{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:'PROTOCOL_CHART_HISTORY=1.0 deterministic single legacy chart restore smoke; no real inference.'}]});
 await p.getByRole('treeitem',{name:new RegExp(title)}).click();await p.getByRole('banner').hover();
 const host=p.locator('[data-semantic-ui]');await p.getByRole('heading',{name:'Historical chart protocol 1.0',exact:true}).waitFor({timeout:25000});await p.getByText('Deterministic fixture completed.',{exact:false}).waitFor();
 await expect(host).toHaveCount(1);await expect(host.locator('footer')).toContainText('protocol 1.0');await expect(host.locator('.plot svg')).toBeVisible();await expect(host.getByText('Sensor B: n=3, missing=1',{exact:false})).toBeVisible();
 assert.notEqual(await p.getByRole('button',{name:/Completed in/}).first().getAttribute('aria-expanded'),'true');
 const requests=readdirSync(shared+'/requests').length;await p.reload();await p.getByRole('heading',{name:'Historical chart protocol 1.0',exact:true}).waitFor();await expect(host).toHaveCount(1);await expect(host.locator('footer')).toContainText('protocol 1.0');await expect(host.locator('.plot svg')).toBeVisible();await expect(host.getByText('Sensor B: n=3, missing=1',{exact:false})).toBeVisible();assert.equal(readdirSync(shared+'/requests').length,requests);assert.deepEqual(errors,[]);
 await host.screenshot({path:output+'/evidence/legacy-chart-smoke.png'});
 const result={toolMode:mode,fixtureOnly:true,oldProtocol:'1.0',component:'DataChart',cases:1,standardCheckpoint:true,toolProcessFolded:true,refreshRestored:true,svgVisible:true,validAndMissingCountsPreserved:true,noNewFixtureRequestOnRefresh:true,pageErrors:errors,newRealModelTurns:0};writeFileSync(output+'/evidence/legacy-chart-smoke.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){writeFileSync(output+'/legacy-chart-smoke-failure.txt',await p.locator('body').ariaSnapshot());throw error;}finally{await browser.close();}
