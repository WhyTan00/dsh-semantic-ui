import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {exampleTaskTemplate as t,exampleSourceA as a,exampleSourceB as b,exampleAnswersA as aa,exampleAnswersB as ab} from '../fixtures/task-form/example';
import {blankTaskDraft,previewTask,confirmTask,continueTask,taskParse,taskTemplateSchema,taskTemplateFromLegacy,replaceTaskTemplate,validateTaskDraft,type TaskRecord} from '../src/task-form/core';
import {packageTask,taskResults,taskResultName,TASK_RESULTS_KEY} from '../src/task-form/storage';
import {readResult,resultDigest} from '../src/results';
import {TaskFormPanel} from '../src/task-form/TaskFormPanel';
const lineage=()=>({seriesId:crypto.randomUUID(),revision:1,parentConfirmationSha256:null});
const working=()=>({template:structuredClone(t),source:structuredClone(a),draft:structuredClone(aa),lineage:lineage()});
async function confirmed(){const w=working(),p=await previewTask(w.template,w.source,w.draft,w.lineage);return confirmTask(w,p,true);}

it('supports text, numeric zero, boolean false, enum and optional unknown; required unknown blocks preview',async()=>{
 const w=working(),p=await previewTask(w.template,w.source,w.draft,w.lineage);expect(p.values).toMatchObject({purpose:'本地档案整理',size:0,share:false,location:'本地',budget:null});expect(p.rules.map(r=>r.truth)).toEqual([true,false,'unknown']);expect(validateTaskDraft(t,blankTaskDraft(t)).valid).toBe(false);
 await expect(previewTask(t,a,blankTaskDraft(t),w.lineage)).rejects.toThrow('TASK_INPUT');
});
it.each(['NaN','Infinity','=1+2','0x10','-1','10001','','1e-999','0.10000000000000001'])('rejects invalid/out-of-range numeric input without coercion: %s',async text=>{const w=working();w.draft.size={mode:'value',text};await expect(previewTask(t,a,w.draft,w.lineage)).rejects.toThrow('TASK_INPUT');});
it('keeps ordinary text literal and rejects invalid enum/boolean values and extra fields',async()=>{
 const w=working();w.draft.purpose.text='<script>alert(1)</script> ${process.env.SECRET}';const p=await previewTask(t,a,w.draft,w.lineage);expect(p.values.purpose).toBe(w.draft.purpose.text);
 for(const [key,text]of [['location','不存在'],['share','yes']]){const d=structuredClone(aa);d[key]={mode:'value',text};expect(validateTaskDraft(t,d).valid).toBe(false);}
 expect(()=>validateTaskDraft(t,{...aa,extra:{mode:'unknown',text:''}})).toThrow('TASK_FIELDS');
});
it('requires explicit acknowledgement and rejects edited answers, source revision or template version after preview',async()=>{
 const w=working(),p=await previewTask(t,a,w.draft,w.lineage);await expect(confirmTask(w,p,false)).rejects.toThrow('TASK_ACK_REQUIRED');
 for(const patch of [{draft:{...w.draft,size:{mode:'value' as const,text:'12'}}},{source:{...a,revision:2}},{template:{...t,revision:2}}])await expect(confirmTask({...w,...patch},p,true)).rejects.toThrow('TASK_PREVIEW_STALE');
});
it('saves, reloads and continues an immutable confirmation as a new revision using the existing result contract/library',async()=>{
 const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}},bridge=taskResults(storage,()=>crypto.randomUUID(),async job=>job());const record=await confirmed(),doc=await packageTask(record);expect(doc.manifest.version).toBe(5);
 const first=await bridge({action:'save',expectedRevision:0,name:'确认一',document:doc});const newBridge=taskResults(storage,()=>crypto.randomUUID(),async job=>job()),loaded=await newBridge({action:'list'});expect(loaded.results[0].document).toEqual(doc);
 const reopened=await readResult(JSON.parse(JSON.stringify(doc))),old=reopened.content.taskForm!,nextLineage=await continueTask(old),draft=structuredClone(old.draft);draft.size.text='120';const source={...old.source,revision:2,text:'合成来源修订：容量120 GiB。'},p=await previewTask(t,source,draft,nextLineage),next=await confirmTask({template:t,source,draft,lineage:nextLineage},p,true),second=await bridge({action:'save',expectedRevision:1,name:'确认二',document:await packageTask(next)});
 expect(second.results).toHaveLength(2);expect(second.results[0]).toEqual(first.results[0]);expect(next.lineage.revision).toBe(2);expect(next.lineage.parentConfirmationSha256).toMatch(/^[a-f0-9]{64}$/);expect(second.results[0].document.content.taskForm!.draft.size.text).toBe('0');
});
it('keeps old saved results on quota failure or stale library revision',async()=>{
 let bytes:string|null=null,fail=false;const store={getItem:()=>bytes,setItem:(_k:string,v:string)=>{if(fail)throw Error('QUOTA');bytes=v;}},bridge=taskResults(store,()=>crypto.randomUUID(),async job=>job()),doc=await packageTask(await confirmed());await bridge({action:'save',expectedRevision:0,name:'原副本',document:doc});const before=bytes;fail=true;await expect(bridge({action:'save',expectedRevision:1,name:'失败',document:doc})).rejects.toThrow('QUOTA');expect(bytes).toBe(before);fail=false;await expect(bridge({action:'save',expectedRevision:0,name:'过期',document:doc})).rejects.toThrow('RESULT_CONFLICT');expect(bytes).toBe(before);expect(TASK_RESULTS_KEY).not.toBe('dsh-semantic-ui.local-data-results.v1');
});
it('saves a maximum-length template name through the real result library without losing the full template name',async()=>{
 const w=working();w.template.name='长'.repeat(80);const document=await packageTask({version:1,status:'draft',...w}),map=new Map<string,string>(),bridge=taskResults({getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);}},()=>crypto.randomUUID(),async job=>job());const saved=await bridge({action:'save',expectedRevision:0,name:taskResultName(document),document});expect(saved.results[0].name).toHaveLength(80);expect(saved.results[0].document.content.taskForm!.template.name).toHaveLength(80);
});
it('saves invalid draft text as draft and rejects altered confirmations, downgrade and imported unknown schema',async()=>{
 const w=working();w.draft.size.text='NaN';const draft:TaskRecord={version:1,status:'draft',...w};expect((await readResult(await packageTask(draft))).content.taskForm).toEqual(draft);
 const doc=await packageTask(await confirmed()),changed=structuredClone(doc);changed.content.taskForm!.draft.size.text='100';changed.sha256=await resultDigest({manifest:changed.manifest,content:changed.content});await expect(readResult(changed)).rejects.toThrow('TASK_CONFIRMATION_CHANGED');
 const downgraded=structuredClone(doc);downgraded.manifest.version=3;downgraded.sha256=await resultDigest({manifest:downgraded.manifest,content:downgraded.content});await expect(readResult(downgraded)).rejects.toThrow('RESULT_FORMAT');expect(()=>taskParse(taskTemplateSchema,{...t,instructions:'execute'})).toThrow();
});
it('saves a wholly missing draft/source without calling it confirmed, and preserves the existing bounded-key refusal',async()=>{
 const w=working();w.source.text='';w.draft=blankTaskDraft(t);expect((await packageTask({version:1,status:'draft',...w})).content.taskForm?.status).toBe('draft');await expect(previewTask(t,w.source,w.draft,w.lineage)).rejects.toThrow('TASK_SOURCE_REQUIRED');
 const template=structuredClone(t);template.fields[1].id='constructor';template.rules[0].when.clauses[0].input='constructor';const d=Object.fromEntries(Object.entries(aa).map(([key,v])=>[key==='size'?'constructor':key,v]));expect(()=>validateTaskDraft(template,d)).toThrow('TASK_LIMIT');
});
it('converts an explicitly supplied existing field/style template without guessing task rules, requirements or answers',()=>{
 const v=taskTemplateFromLegacy({format:'dsh-semantic-ui-template',version:1,template:{name:'旧外观',definition:{component:'DecisionExplorer',dimensions:[{id:'d',label:'维度'}],inputs:[{id:'n',label:'容量',type:'number',unit:'GiB'}]},theme:t.theme,layout:t.layout}});expect(v.theme).toEqual(t.theme);expect(v.fields[0]).toMatchObject({id:'n',unit:'GiB',required:false});expect(v.rules).toEqual([]);expect(blankTaskDraft(v)).toEqual({n:{mode:'unknown',text:''}});
});
it('pure template has no answers; second public input starts a separate task and yields different declared checks',async()=>{
 const blank=blankTaskDraft(t);expect(Object.values(blank).every(f=>f.mode==='unknown'&&f.text==='')).toBe(true);expect(JSON.stringify(t)).not.toContain('本地档案整理');const p=await previewTask(t,b,ab,lineage());expect(p.rules.map(r=>r.truth)).toEqual([false,true,true]);expect(p.values).not.toEqual((await previewTask(t,a,aa,lineage())).values);expect(()=>replaceTaskTemplate({...t,revision:2},t)).toThrow('TASK_TEMPLATE_STALE');
});
it('renders the actual form component as Chinese accessible markup without a browser or private-page access',()=>{
 const html=renderToStaticMarkup(createElement(TaskFormPanel,{expanded:true}));expect(html).toContain('填写任务条件与确认结果');expect(html).toContain('aria-label="任务用途"');expect(html).toContain('aria-invalid="true"');expect(html).toContain('保存未确认草稿');expect(html).toContain('应用模板并开始空白任务');expect(html).not.toContain('dangerouslySetInnerHTML');
 const w=working();w.draft.purpose.text='<script>alert(1)</script>';const escaped=renderToStaticMarkup(createElement(TaskFormPanel,{expanded:true,initial:{version:1,status:'draft',...w}}));expect(escaped).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');expect(escaped).not.toContain('<script>alert(1)</script>');
});
