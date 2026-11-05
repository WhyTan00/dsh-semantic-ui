import {chromium,expect} from '@playwright/test';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {localConditions} from '../fixtures/local-conditions';
import {resultDigest} from '../src/results';

const output=process.env.HOST_OUTPUT,shared=process.env.HOST_SHARED,mode=process.env.TOOL_MODE;
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1100,height:2200}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
const auth=readFileSync(output+'/dsh-host.log','utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
const rpc=(method,payload)=>page.evaluate(async({method,payload})=>{
 const r=await fetch('/api/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload})});
 const b=await r.json();if(!b.result?.ok)throw Error('Owned form RPC failed '+method);return b.result.value;
},{method,payload});
const session=(method,request)=>rpc(method,{args:{request}}),library=()=>rpc('dsh-semantic-ui/results',{action:'list'});
const root=()=>page.locator('[data-semantic-ui] .semantic-root'),form=()=>root().locator('.condition-form');
const button=name=>root().getByRole('button',{name,exact:true}),field=name=>form().getByRole('textbox',{name:name+' · 草稿值',exact:true});
async function resultPanel(){await root().locator('.result-panel').evaluate(el=>el.open=true);}
async function exportResult(name){
 await resultPanel();const pending=page.waitForEvent('download');await button('导出完整结果').click();const download=await pending,path=output+'/evidence/'+name+'.json';await download.saveAs(path);return JSON.parse(readFileSync(path));
}
async function openSaved(id){await resultPanel();await button('读取已保存结果').click();await root().getByRole('combobox',{name:'已保存结果',exact:true}).selectOption(id);await button('打开已保存结果').click();}
try{
 await page.goto(auth);await page.waitForTimeout(500);if(await page.getByRole('button',{name:'Continue',exact:true}).isVisible())await page.getByRole('button',{name:'Continue',exact:true}).click();
 const {workspace}=await session('workspace/create',{path:process.cwd()}),wr=page.getByRole('treeitem',{name:workspace.title,exact:true});await wr.waitFor();if(await wr.getAttribute('aria-expanded')!=='true')await wr.click();
 const key='condition-form-'+mode;writeFileSync(process.env.SOURCE_HOST_CASE_FILE,JSON.stringify({key,argsSequence:[{action:'render',view:localConditions}]}));
 const {sessionId}=await session('session/create',{workspaceId:workspace.workspaceId}),title='Condition form '+mode+' '+Date.now();
 await session('session/rename',{sessionId,title});await session('session/selectModel',{sessionId,provider:'semantic-fixture',model:'semantic-fixture'});
 await session('session/prompt',{sessionId,requestId:randomUUID(),mode:'queue',content:[{type:'text',text:'显示公开合成的多条件比较，验证本地表单，不代表来源自然题。'}],clientTimeZone:'UTC'});
 await page.getByRole('treeitem',{name:new RegExp(title)}).click();await page.getByRole('banner').hover();await page.getByText('Local host source fixture '+key+' completed.',{exact:false}).waitFor({timeout:40000});await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:15000});
 await expect(root()).toHaveCount(1);await expect(root()).toHaveAttribute('data-locale','zh-CN');await expect(root().getByText('界面语言 / Language',{exact:true})).toBeVisible();
 const requestsBefore=readdirSync(shared+'/requests').length,original=(await exportResult('original')).content;
 await form().getByText('批量编辑本地条件',{exact:true}).click();await field('需求量').fill('');await expect(form().getByRole('alert')).toContainText('保留未知');await expect(button('预览差异')).toBeDisabled();await expect(button('应用到本地试算')).toBeDisabled();
 await field('需求量').fill('NaN');const invalid=await exportResult('invalid-draft');assert.equal(invalid.content.interaction.values.demand,100);assert.equal(invalid.content.interaction.conditionDraft.fields.demand.text,'NaN');assert.deepEqual(invalid.content.view,original.view);
 await button('保存草稿到当前配置').click();await expect(root().getByRole('status').filter({hasText:'草稿已另存为新结果'})).toBeVisible();const savedInvalid=(await library()).results.at(-1);assert.equal(savedInvalid.document.content.interaction.conditionDraft.fields.demand.text,'NaN');
 await page.reload();await expect(root()).toHaveAttribute('data-locale','zh-CN');await openSaved(savedInvalid.id);await expect(field('需求量')).toHaveValue('NaN');await expect(form()).toHaveAttribute('open','');await expect(button('应用到本地试算')).toBeDisabled();
 // Multiple supported types, explicit unknown, no coercion and an independent outcome.
 await field('需求量').fill('200');await form().getByRole('checkbox',{name:'维护人员可用 · 保留未知',exact:true}).uncheck();await form().getByRole('combobox',{name:'维护人员可用 · 草稿值',exact:true}).selectOption('true');await form().getByRole('combobox',{name:'工作模式 · 草稿值',exact:true}).selectOption('高并发');
 await button('预览差异').click();await expect(form().getByRole('region',{name:'条件差异预览',exact:true})).toContainText('自管方案');assert.equal((await exportResult('before-apply')).content.interaction.values.demand,100);
 // A quick control can change the base while a preview is visible; stale apply must be refused.
 await root().getByRole('spinbutton',{name:'需求量',exact:true}).fill('101');await expect(button('应用到本地试算')).toBeDisabled();await expect(form().getByRole('status')).toContainText('条件已变化');
 await button('预览差异').click();await button('应用到本地试算').click();const applied=await exportResult('applied');assert.deepEqual(applied.content.interaction.values,{networkNeeded:false,teamAvailable:true,demand:200,mode:'高并发'});assert.deepEqual(applied.content.view,original.view);assert.equal(applied.content.view.payload.options[1].values.price,null);
 await expect(root().getByText('满足当前需求：',{exact:false}).first()).toContainText('自管方案');
 // Draft unknown does not change the applied numeric 200 until reviewed and applied.
 await form().getByRole('checkbox',{name:'需求量 · 保留未知',exact:true}).check();await button('预览差异').click();await button('应用到本地试算').click();assert.equal((await exportResult('unknown-applied')).content.interaction.values.demand,null);
 await form().getByRole('checkbox',{name:'需求量 · 保留未知',exact:true}).uncheck();await field('需求量').fill('0');await button('预览差异').click();await button('应用到本地试算').click();assert.equal((await exportResult('zero-applied')).content.interaction.values.demand,0);
 await field('需求量').fill('NaN');await button('取消草稿').click();const cancelled=await exportResult('cancelled');assert.equal(cancelled.content.interaction.values.demand,0);assert.equal(cancelled.content.interaction.conditionDraft,undefined);
 await form().getByText('批量编辑本地条件',{exact:true}).click();await button('按原始声明重填').click();assert.equal((await exportResult('refilled-not-applied')).content.interaction.values.demand,0);await field('需求量').fill('250');
 await button('保存草稿到当前配置').click();await expect(form().getByRole('status')).toContainText('草稿已另存为新结果');const carry=(await library()).results.at(-1);assert.equal(carry.document.content.interaction.values.demand,0);assert.equal(carry.document.content.interaction.conditionDraft.fields.demand.text,'250');
 const beforeRefusal=await library(),beforeRefusalContent=(await exportResult('before-incompatible')).content;
 await root().getByLabel('导入完整结果',{exact:true}).setInputFiles({name:'unsupported.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...carry.document,manifest:{...carry.document.manifest,version:99}}))});await expect(root().getByRole('status').filter({hasText:'结果操作失败'})).toBeVisible();assert.deepEqual(await library(),beforeRefusal);assert.deepEqual((await exportResult('after-incompatible')).content,beforeRefusalContent);
 const portable=await exportResult('portable');if(process.env.FORM_CARRY_DIR&&mode==='native'){mkdirSync(process.env.FORM_CARRY_DIR,{recursive:true});writeFileSync(join(process.env.FORM_CARRY_DIR,'native-draft.json'),JSON.stringify(portable,null,2)+'\n');}await button('返回原消息').click();await resultPanel();await root().getByLabel('导入完整结果',{exact:true}).setInputFiles(output+'/evidence/portable.json');await expect(field('需求量')).toHaveValue('250');assert.deepEqual((await exportResult('portable-reopened')).content,portable.content);
 await page.reload();await openSaved(carry.id);await expect(field('需求量')).toHaveValue('250');await field('需求量').fill('200');await button('预览差异').click();await button('应用到本地试算').click();assert.equal((await exportResult('continued')).content.interaction.values.demand,200);
 // Preview.28 format 1 is readable. Its recorded English locale cannot overwrite the reader's Chinese.
 const old=JSON.parse(readFileSync('docs/evidence/result-package/examples/1.json'));old.content.locale='en';old.sha256=await resultDigest({manifest:old.manifest,content:old.content});
 await resultPanel();await root().getByLabel('导入完整结果',{exact:true}).setInputFiles({name:'preview28-english.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await expect(root().getByRole('heading',{name:old.content.view.payload.title,exact:true})).toBeVisible();await expect(root()).toHaveAttribute('data-locale','zh-CN');assert.equal((await library()).results.at(-1).document.content.locale,'en');
 await page.reload();const oldId=(await library()).results.at(-1).id;await openSaved(oldId);await expect(root()).toHaveAttribute('data-locale','zh-CN');
 await root().getByRole('combobox',{name:'界面语言',exact:true}).selectOption('en');await expect(root().getByText('界面语言 / Language',{exact:true})).toBeVisible();await page.reload();await expect(root()).toHaveAttribute('data-locale','en');await root().getByRole('combobox',{name:'Language',exact:true}).selectOption('zh-CN');await page.reload();await expect(root()).toHaveAttribute('data-locale','zh-CN');
 if(process.env.FORM_CARRY_DIR&&mode==='ptc'){
  await resultPanel();const transfer=JSON.parse(readFileSync(join(process.env.FORM_CARRY_DIR,'native-draft.json')));await root().getByLabel('导入完整结果',{exact:true}).setInputFiles(join(process.env.FORM_CARRY_DIR,'native-draft.json'));await expect(field('需求量')).toHaveValue('250');assert.deepEqual((await exportResult('fresh-profile-transfer')).content,transfer.content);await field('需求量').fill('220');await button('预览差异').click();await button('应用到本地试算').click();assert.equal((await exportResult('fresh-profile-continued')).content.interaction.values.demand,220);
 }
 await openSaved(carry.id);await root().locator('.result-panel').evaluate(el=>el.open=false);
 for(const width of [640,360]){await root().evaluate((el,width)=>{el.style.width=width+'px';el.style.maxWidth='100%';},width);await expect.poll(()=>root().evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);await root().screenshot({path:output+'/evidence/form-'+width+'.png'});}
 assert.equal(readdirSync(shared+'/requests').length,requestsBefore,'all form, save, import, reopen and language operations stay local');assert.deepEqual(errors,[]);
 const calls=new Map();for(const file of readdirSync(shared+'/requests'))for(const m of JSON.parse(readFileSync(shared+'/requests/'+file)).messages)for(const call of m.tool_calls??[])calls.set(call.id,call.function);
 assert(calls.size>0);assert([...calls.values()].every(c=>mode==='native'?c.name==='dsh_semantic_ui':c.name==='run_code'&&JSON.parse(c.arguments).code.includes('tools.dsh_semantic_ui')));
 writeFileSync(output+'/evidence/local-form.json',JSON.stringify({mode,fixtureOnly:true,newRealModelTurns:0,fields:4,types:['boolean','number','choice'],invalidRawDraftSavedAndReopened:true,previewBeforeApply:true,staleBaseRefused:true,multipleValuesAppliedTogether:true,sourceAndNullsUnchanged:true,unknownAndZeroDistinct:true,cancelAndRefillDoNotApply:true,incompatibleImportDoesNotOverwriteDraftOrResults:true,fullResultFormat:portable.manifest.version,draftRoundTripAndContinue:true,preview28Format1Readable:true,importAndReopenDoNotOverrideChinese:true,bilingualSelectorAndRefreshMemory:true,noModelRequestsDuringLocalActions:true,pageErrors:errors,widths:[640,360],noRootOverflow:true,executedToolCalls:calls.size,actualToolRoute:mode==='native'?'dsh_semantic_ui':'run_code -> tools.dsh_semantic_ui',archiveInstalled:!!process.env.INSTALL_PACKAGE,crossProfileDraft:process.env.FORM_CARRY_DIR?(mode==='native'?'exported-for-fresh-ptc-profile':'imported-and-edited-from-native-profile'):'not-requested'},null,2)+'\n');
 console.log(JSON.stringify({mode,localFormCases:1,fields:4,pageErrors:errors,newRealModelTurns:0}));
}catch(e){writeFileSync(output+'/local-form-failure.json',JSON.stringify({error:String(e),stack:e.stack,pageErrors:errors},null,2));try{writeFileSync(output+'/local-form-failure.txt',await page.locator('body').ariaSnapshot({timeout:2000}));}catch{}throw e;}finally{await browser.close();}
