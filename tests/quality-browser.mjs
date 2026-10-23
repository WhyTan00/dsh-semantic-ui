import {chromium,expect} from '@playwright/test';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.env.HOST_ORIGIN,output=process.env.HOST_OUTPUT,mode=process.env.TOOL_MODE,shared=process.env.HOST_SHARED;
const browser=await chromium.launch(),context=await browser.newContext({storageState:output+'/browser-state.json',viewport:{width:1100,height:2600},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
const rpc=(method,request)=>page.evaluate(async({method,request})=>{const r=await fetch('/api/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:{args:{request}}})});const j=await r.json();if(!j.result?.ok)throw Error('Fixture RPC failed');return j.result.value;},{method,request});
const cases=[['irregular','Irregular observation intervals'],['bars','Category comparison with long labels'],['missing','All observations missing'],['prebinned','Pre-aggregated proportions'],['graph','Cycles and parallel relationships']];
try{
 await page.goto(origin);const {workspace}=await rpc('workspace/create',{path:process.cwd()});const row=page.getByRole('treeitem',{name:workspace.title,exact:true});await row.waitFor();if(await row.getAttribute('aria-expanded')!=='true')await row.click();
 for(const [kind,title]of cases){
  const {sessionId}=await rpc('session/create',{workspaceId:workspace.workspaceId}),sessionTitle=`Quality ${kind} ${mode} ${Date.now()}`;await rpc('session/rename',{sessionId,title:sessionTitle});await rpc('session/selectModel',{sessionId,provider:'semantic-fixture',model:'semantic-fixture'});
  await rpc('session/prompt',{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:`Semantic fixture ${kind==='graph'?'architecture':'chart'} QUALITY_FIXTURE=${kind}. Deterministic quality regression, not a natural model test.`}],clientTimeZone:'UTC'});
  await page.getByRole('treeitem',{name:new RegExp(sessionTitle)}).click();await page.getByRole('banner').hover();await page.getByRole('heading',{name:title,exact:true}).waitFor({timeout:25000});await page.getByText('Deterministic fixture completed.',{exact:false}).waitFor();
  const host=page.locator('[data-semantic-ui]');assert.equal(await host.count(),1);await host.evaluate(el=>el.style.maxWidth='640px');const result={kind,toolMode:mode,deterministicFixture:true};
  await page.getByText('Templates & appearance',{exact:true}).click();await page.getByText('Library loaded.',{exact:true}).waitFor();await page.getByRole('combobox',{name:'Color mode',exact:true}).selectOption('light');await page.getByRole('combobox',{name:'Palette',exact:true}).selectOption('ocean');await page.getByText('Templates & appearance',{exact:true}).click();
  const requestsBefore=readdirSync(shared+'/requests').length;
  const downloadTable=async()=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download this table',exact:true}).click();return JSON.parse(readFileSync(await(await pending).path(),'utf8'));};
  if(kind==='irregular'){
   const points=()=>host.locator('.plot svg').evaluate(svg=>[...svg.querySelectorAll('path')].filter(e=>{const b=e.getBoundingClientRect();return e.getAttribute('fill')==='#245bb5'&&b.width>4&&b.width<10&&b.height>4&&b.height<10;}).map(e=>{const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};}).sort((a,b)=>a.x-b.x));
   await expect.poll(async()=>(await points()).length).toBe(3);const p=await points(),ratio=(p[1].x-p[0].x)/(p[2].x-p[1].x);assert(Math.abs(ratio-1/8)<0.01,'SVG distances must reflect one day versus eight days');result.timePixelIntervalRatio=ratio;
   await page.getByRole('spinbutton',{name:'From index'}).fill('1');await page.getByText('Observed signal: n=2, missing=0; mean=30',{exact:false}).waitFor();const downloaded=await downloadTable();assert.deepEqual(downloaded.rows,[['2026-01-02T00:00:00Z',20],['2026-01-10T00:00:00Z',40]]);result.filteredDownload=true;await page.getByRole('button',{name:'Reset range & series'}).click();
  }else if(kind==='bars'){
   await expect(host.locator('.plot')).toHaveAttribute('data-orientation','horizontal');await expect.poll(()=>host.locator('svg pattern').count()).toBeGreaterThan(1);
   const toggle=page.getByRole('checkbox',{name:'Period A',exact:true});await toggle.focus();await toggle.press('Space');assert(!(await toggle.isChecked()));const downloaded=await downloadTable();assert.deepEqual(downloaded.headers,['x (category)','Period B (requests)']);assert.equal(downloaded.rows[1][1],-100);await page.getByRole('combobox',{name:'Table scope'}).selectOption('all');const all=await downloadTable();assert.equal(all.rows[1][1],0);assert.equal(all.rows[3][1],null);assert.equal(all.rows[1][0],'南方地区 — 保留完整的中文类别名称');await page.getByRole('combobox',{name:'Table scope'}).selectOption('filtered');await page.getByRole('button',{name:'Reset range & series'}).click();result.patterns=true;result.signedValuesAndMissing=true;result.keyboardFilter=true;result.scopeDownloads=true;
  }else if(kind==='missing'){
   await page.getByRole('status').filter({hasText:'No valid observations'}).waitFor();assert.equal(await host.locator('.plot').count(),0);assert.equal(await page.getByRole('cell',{name:'Missing',exact:true}).count(),2);const downloaded=await downloadTable();assert.deepEqual(downloaded.rows,[['First',null],['Second',null]]);result.missingNotZero=true;
  }else if(kind==='prebinned'){
   await page.getByRole('spinbutton',{name:'From index'}).fill('1');await page.getByText('3 valid selected observations / 4 full valid',{exact:false}).waitFor();const filtered=await downloadTable();assert.deepEqual(filtered.rows,[['[10, 20)',1,1/3],['[20, 30]',0,2/3]]);assert.equal(filtered.measure,'proportion');await page.getByRole('combobox',{name:'Table scope'}).selectOption('all');const all=await downloadTable();assert.equal(all.scope,'pre-aggregated-bins');assert.deepEqual(all.rows[0],['[0, 10)',0,0.25]);result.selectedDenominators=true;result.zeroBinsRetained=true;
  }else{
   await expect(host.locator('.react-flow__edge-path')).toHaveCount(5);const paths=await host.locator('.react-flow__edge-path').evaluateAll(edges=>edges.map(e=>e.getAttribute('d')));assert.equal(new Set(paths).size,5);assert((await host.locator('[data-id="retry"] .react-flow__edge-path').getAttribute('d')).includes('C'));
   const worker=host.locator('.react-flow__node[data-id="b"]');await worker.focus();await worker.press('Enter');await expect(page.getByRole('combobox',{name:'Locate node'})).toHaveValue('b');await expect(host.locator('.detail')).toContainText('Process requests and retry locally.');await worker.press('Escape');await expect(page.getByRole('combobox',{name:'Locate node'})).toHaveValue('');
   await expect(worker.locator('.react-flow__handle-right')).toHaveCount(1);const viewport=host.locator('.react-flow__viewport');const before=await viewport.getAttribute('style');await host.locator('.graph').hover();await page.mouse.wheel(0,120);await page.waitForTimeout(150);assert.equal(await viewport.getAttribute('style'),before);result.keyboardDetails=true;result.wheelDoesNotZoom=true;result.distinctEdgePaths=paths.length;result.reducedMotion=true;
  }
  await host.scrollIntoViewIfNeeded();await host.screenshot({path:output+'/evidence/quality-'+kind+'-640.png'});
  await page.getByText('Templates & appearance',{exact:true}).click();await page.getByText('Library loaded.',{exact:true}).waitFor();await page.getByRole('combobox',{name:'Color mode',exact:true}).selectOption('dark');await page.getByText('Templates & appearance',{exact:true}).click();
  await host.evaluate(el=>el.style.maxWidth='360px');await expect.poll(()=>host.locator('.semantic-root').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  if(kind==='graph'){
   await expect(host.locator('.react-flow__node[data-id="b"] .react-flow__handle-bottom')).toHaveCount(1);
   const clipped=()=>host.locator('.graph').evaluate(el=>{const b=el.getBoundingClientRect();return [...el.querySelectorAll('.react-flow__node,.react-flow__edge-path')].some(e=>{const r=e.getBoundingClientRect();return r.left<b.left||r.right>b.right||r.top<b.top||r.bottom>b.bottom;});});
   await expect.poll(clipped).toBe(false);result.allNodesAndEdgesInNarrowViewport=true;
   await expect.poll(async()=>{const loop=await host.locator('[data-id="retry"] .react-flow__edge-path').boundingBox(),node=await host.locator('.react-flow__node[data-id="b"]').boundingBox();return loop.x+loop.width>node.x+node.width+10;}).toBe(true);result.selfLoopOutsideNode=true;
  }
  if(kind!=='missing'&&kind!=='graph')await expect.poll(()=>host.locator('.plot').evaluate(el=>Math.abs(el.querySelector('svg').getBoundingClientRect().width-el.clientWidth))).toBeLessThanOrEqual(1);
  await host.screenshot({path:output+'/evidence/quality-'+kind+'-360.png'});result.narrowWidth=(await host.boundingBox()).width;result.narrowOverflow=await host.locator('.semantic-root').evaluate(el=>el.scrollWidth-el.clientWidth);assert.equal(readdirSync(shared+'/requests').length,requestsBefore);result.localControlsMadeNoModelRequests=true;
  await page.reload();await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal(await host.count(),1);result.refresh=true;results.push(result);console.log(JSON.stringify(result));
 }
 assert.deepEqual(errors,[]);writeFileSync(output+'/evidence/quality.json',JSON.stringify({results,pageErrors:errors},null,2)+'\n');
}catch(error){writeFileSync(output+'/quality-failure.txt',await page.locator('body').ariaSnapshot());await page.screenshot({path:output+'/quality-failure.png'});throw error;}
finally{await browser.close();}
