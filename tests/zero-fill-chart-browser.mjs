import {chromium,expect} from '@playwright/test';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {numericRequest} from '../fixtures/source-numeric';
import {checkpointOf} from '../src/dsh/definition';
import {translate} from '../src/i18n';
import {captureHostComponent} from '../examples/host-component-capture.mjs';

const output=process.env.HOST_OUTPUT,shared=process.env.HOST_SHARED,mode=process.env.TOOL_MODE,t=key=>translate('zh-CN',key);
const auth=readFileSync(output+'/dsh-host.log','utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1180,height:3200}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
const write=(name,value)=>writeFileSync(output+'/'+name,JSON.stringify(value,null,2)+'\n');
const rpc=(method,request)=>page.evaluate(async({method,request})=>{
 const response=await fetch('/api/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:{args:{request}}})});
 const result=await response.json();if(!result.result?.ok)throw Error('Owned zero-fill RPC failed: '+method);return result.result.value;
},{method,request});
function* objects(value,depth=0){
 if(depth>24||value===null)return;
 if(typeof value==='object'){yield value;for(const v of Object.values(value))yield*objects(v,depth+1);}
 else if(typeof value==='string')try{yield*objects(JSON.parse(value),depth+1);}catch{
  const a=value.indexOf('{'),b=value.lastIndexOf('}');if(a>=0&&b>a)try{yield*objects(JSON.parse(value.slice(a,b+1)),depth+1);}catch{}
 }
}
async function journal(sessionId,key){
 const baseline=await rpc('session/projections',{sessionId});assert.equal(baseline.kind,'sequenced');
 const body=await rpc('session/page',{address:{kind:'session',sessionId},throughSeq:baseline.asOfSeq,maxMessages:100,turnWindow:{minMessages:1,minTurns:1}});
 write('journal-'+key+'.json',{baseline,body});return {asOfSeq:baseline.asOfSeq,events:[...new Map([...objects(body)].filter(v=>typeof v.seq==='number'&&typeof v.type==='string'&&v.data!==undefined).map(v=>[v.seq+':'+v.type,v])).values()]};
}
try{
 await page.goto(auth);await page.waitForTimeout(300);if(await page.getByRole('button',{name:'Continue',exact:true}).isVisible())await page.getByRole('button',{name:'Continue',exact:true}).click();
 const {workspace}=await rpc('workspace/create',{path:shared+'/documents'}),item=page.getByRole('treeitem',{name:workspace.title,exact:true});await item.waitFor();if(await item.getAttribute('aria-expanded')!=='true')await item.click();
 for(const c of [{id:'all-missing',values:[null,null,null],observedCount:0,observedMean:null},{id:'missing-slice',values:[4,null,-4],observedCount:2,observedMean:0}]){
  const key='numeric-baseline-zero-fill-'+mode+'-'+c.id,source=`图形探针3次电流读数是${c.values.map(v=>v===null?'缺失':v).join('、')} 毫安。请解释这批数据，能计算平均值吗？`,request=numericRequest(c.values,'电流','毫安',key);
  const sequence=[{action:'source-check'}];
  if(c.id==='all-missing'){const bad=structuredClone(request);for(const row of bad.view.payload.rows)row.values[bad.mapping.seriesId]=0;sequence.push({action:'render',...bad});request.view.revision=2;}
  sequence.push({action:'render',...request});writeFileSync(process.env.SOURCE_HOST_CASE_FILE,JSON.stringify({key,sourceText:source,argsSequence:sequence}));
  const {sessionId}=await rpc('session/create',{workspaceId:workspace.workspaceId}),title='全缺失补零图形 '+c.id+' '+Date.now(),requestId=randomUUID();
  await rpc('session/rename',{sessionId,title});await rpc('session/selectModel',{sessionId,provider:'semantic-fixture',model:'semantic-fixture'});
  await rpc('session/prompt',{sessionId,requestId,mode:'queue',content:[{type:'text',text:source}],clientTimeZone:'UTC'});
  await page.getByRole('treeitem',{name:title,exact:false}).click();await page.getByRole('banner').hover();
  await page.getByText('Local host source fixture '+key+' completed.',{exact:false}).waitFor({timeout:45000});await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:15000});
  const before=await journal(sessionId,c.id),input=before.events.find(v=>v.type==='user/message'&&v.data?.source?.rpcId===requestId);assert(input);assert.equal(input.data.source.kind,'user');
  const checkpointEvent=before.events.find(v=>checkpointOf(v)?.view?.displayId===request.view.displayId),checkpoint=checkpointOf(checkpointEvent);assert(checkpoint);
  assert.deepEqual(checkpoint.view.payload.rows.map(r=>r.values[request.mapping.seriesId]),c.values);
  assert.equal(checkpoint.sourceDelivery.sourceRef.hostContext.messageId,input.data.id);
  const values=readdirSync(shared+'/requests').filter(f=>f.startsWith(key+'-')).flatMap(f=>JSON.parse(readFileSync(shared+'/requests/'+f)).messages.filter(m=>m.role==='tool').flatMap(m=>[...objects(m.content)]));
  const inspected=values.find(v=>v.sourceCheckKind==='observations-zh'&&v.sourceStatistics),delivered=values.findLast(v=>v.status==='delivered'&&v.deliveryId);assert(inspected&&delivered);
  assert.equal(inspected.source.textSha256,createHash('sha256').update(source).digest('hex'));assert.deepEqual(inspected.sourceStatistics.values,c.values);
  assert.equal(inspected.sourceStatistics.observed.count,c.observedCount);assert.equal(inspected.sourceStatistics.complete.mean,null);
  const f=delivered.dataFacts.series[0];assert.equal(f.mean,c.observedMean);assert.equal(f.zeroFillIllustration.mean,0);assert.equal(f.zeroFillIllustration.sum,0);assert.equal(f.zeroFillIllustration.completeDataMeanKnown,false);assert.equal(f.zeroFillIllustration.completeDataSumKnown,false);if(c.id==='all-missing'){assert.equal(f.sum,null);assert.equal(f.zeroFillIllustration.differenceFromObservedMean,null);assert.equal(f.zeroFillIllustration.directionRelativeToObservedMean,'unknown');}
  const missingnessRejected=c.id!=='all-missing'||values.some(v=>v.status==='validation-failed'&&v.issues?.some(i=>i.code==='SOURCE_MISSINGNESS'));assert(missingnessRejected);
  let frame=page.locator('[data-semantic-ui]').last();await expect(frame.locator('[data-locale="zh-CN"]')).toHaveCount(1);
  const explanation=await frame.locator('.source-explanation p').first().innerText();assert(explanation.includes('完整3次读数的平均值：未知'));
  await frame.getByText(t('Computed missing-value comparison'),{exact:true}).click();
  if(c.id==='missing-slice'){await frame.getByRole('spinbutton',{name:'起始位置',exact:true}).fill('1');await frame.getByRole('spinbutton',{name:'结束位置',exact:true}).fill('1');}
  const count=c.id==='all-missing'?3:1,region=()=>frame.getByRole('region',{name:t('Computed missing-value comparison'),exact:true});
  await expect(region()).toContainText(t('Observed: n=')+'0'+t(', missing=')+count+t('; mean=')+t('unknown')+' 毫安'+t('; subtotal=')+t('unknown')+' 毫安');
  await expect(region()).toContainText(t('Hypothesis: count=')+count+t('; mean=')+'0 毫安'+t('; sum=')+'0 毫安');
  await expect(region()).toContainText(t('Mean:')+' '+t('unknown')+t('; difference=')+t('unknown')+' 毫安');
  const comparisonText=await region().innerText();
  const pending=page.waitForEvent('download');await frame.getByRole('button',{name:t('Download this table'),exact:true}).click();const download=await pending,exported=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.equal(exported.unit,'毫安');assert.equal(exported.scope,'filtered-source-rows');assert.equal(exported.rows.length,count);assert(exported.rows.every(row=>row[1]===null));
  const images=[];for(const width of [640,360]){const file='numeric-baseline-zero-fill-'+c.id+'-'+width+'.png';images.push({file,...await captureHostComponent(frame,width,output+'/evidence/'+file)});}
  const requestsBefore=readdirSync(shared+'/requests').length;
  await frame.getByRole('spinbutton',{name:'起始位置',exact:true}).fill('2');await frame.getByRole('spinbutton',{name:'结束位置',exact:true}).fill('0');
  await expect(region()).toContainText(t('Hypothesis: count=')+'0'+t('; mean=')+t('unknown')+' 毫安'+t('; sum=')+t('unknown')+' 毫安');
  await frame.getByRole('combobox',{name:t('Table scope'),exact:true}).selectOption('all');
  await expect(region()).toContainText(t('Hypothesis: count=')+'3'+t('; mean=')+'0 毫安'+t('; sum=')+'0 毫安');
  assert.equal(await frame.locator('.source-explanation p').first().innerText(),explanation);const after=await journal(sessionId,c.id+'-local');assert.deepEqual(after,before);assert.equal(readdirSync(shared+'/requests').length,requestsBefore);
  await page.reload();frame=page.locator('[data-semantic-ui]').last();await expect(frame.locator('.source-explanation')).toBeVisible();assert.equal(await frame.locator('.source-explanation p').first().innerText(),explanation);
  await expect(frame.getByRole('spinbutton',{name:'起始位置',exact:true})).toHaveValue('0');await expect(frame.getByRole('spinbutton',{name:'结束位置',exact:true})).toHaveValue('2');await expect(frame.getByRole('combobox',{name:t('Table scope'),exact:true})).toHaveValue('filtered');assert.equal(readdirSync(shared+'/requests').length,requestsBefore);
  results.push({case:c.id,source,sourceSha256:inspected.source.textSha256,inputEvent:input,checkpointEvent,checkpoint,inspected,delivered,renderArguments:request,sourceValues:c.values,comparisonText,exported,images,allMissingSourceImputationRefused:c.id==='all-missing'?missingnessRejected:null,journalAndSourceUnchanged:true,emptyHypothesisUnknown:true,allScopeHypothesisZero:true,refreshRestored:true,noExtraRequestsOnLocalInteraction:true,sourceFactsVerified:false,identityVerified:false,freeProseVerified:false});
 }
 assert.deepEqual(errors,[]);write('evidence/numeric-baseline-zero-fill.json',{mode,results,pageErrors:errors,fixtureTurns:results.length,newRealModelTurns:0,archiveInstallation:!!process.env.INSTALL_PACKAGE});
 console.log(JSON.stringify({mode,passed:results.length,pageErrors:errors,newRealModelTurns:0}));
}catch(error){writeFileSync(output+'/zero-fill-chart-failure.txt',await page.locator('body').ariaSnapshot());throw error;}finally{await browser.close();}
