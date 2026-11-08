import {z} from 'zod';
import {bounded,decisionSchema,type Decision,type Envelope} from '../protocol';
import {themeSchema,layoutSchema} from '../theme';
import {validateConditionDraft} from '../condition-form';
import {matches,type InputValues} from '../math';
import {exportSchema,parseBounded} from '../templates';

const id=z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/),label=z.string().trim().min(1).max(80),digest=z.string().regex(/^[a-f0-9]{64}$/);
const common={id,label,required:z.boolean(),hint:z.string().max(400)};
const field=z.discriminatedUnion('type',[
 z.strictObject({...common,type:z.literal('boolean')}),
 z.strictObject({...common,type:z.literal('number'),unit:label,min:z.number().finite().optional(),max:z.number().finite().optional()}),
 z.strictObject({...common,type:z.literal('choice'),choices:z.array(label).min(1).max(12)}),
 z.strictObject({...common,type:z.literal('text'),maxLength:z.number().int().min(1).max(800)}),
]);
export const taskTemplateSchema=z.strictObject({format:z.literal('dsh-semantic-ui-task-template'),version:z.literal(1),id:z.string().uuid(),revision:z.number().int().min(1).max(100000),name:label,description:z.string().max(1200),fields:z.array(field).min(1).max(12),rules:z.array(z.strictObject({id,label,when:decisionSchema.shape.rules.unwrap().element.shape.when})).max(24),theme:themeSchema,layout:layoutSchema}).superRefine((t,c)=>{
 const issue=(message:string)=>c.addIssue({code:'custom',message});
 if(new Set(t.fields.map(f=>f.id)).size!==t.fields.length||new Set(t.rules.map(r=>r.id)).size!==t.rules.length)issue('字段和规则ID必须唯一。');
 for(const f of t.fields){if(f.type==='number'&&f.min!==undefined&&f.max!==undefined&&f.min>f.max)issue('数值范围无效。');if(f.type==='choice'&&new Set(f.choices).size!==f.choices.length)issue('枚举选项必须唯一。');}
 for(const r of t.rules)for(const clause of r.when.clauses){const f=t.fields.find(f=>f.id===clause.input);if(!f){issue('规则引用未知字段。');continue;}if(!['eq','ne'].includes(clause.op)&&f.type!=='number')issue('大小比较仅适用于数值。');if(f.type==='number'?typeof clause.value!=='number':f.type==='boolean'?typeof clause.value!=='boolean':typeof clause.value!=='string'||f.type==='choice'&&!f.choices.includes(clause.value))issue('规则值与字段类型/选项不符。');}
});
export type TaskTemplate=z.infer<typeof taskTemplateSchema>;
/** Explicitly import an existing data-free field/style export; it has no task rules or required flags. */
export function taskTemplateFromLegacy(raw:unknown,uuid=()=>crypto.randomUUID()):TaskTemplate{
 const legacy=parseBounded(exportSchema,raw).template,d=legacy.definition;if(d.component!=='DecisionExplorer')throw Error('TASK_TEMPLATE_KIND: 仅可转换决策字段合同；其他组件请另写任务模板。');
 return taskParse(taskTemplateSchema,{format:'dsh-semantic-ui-task-template',version:1,id:uuid(),revision:1,name:legacy.name,description:'从既有纯字段/外观模板显式转换。旧合同没有必填声明或任务规则；没有猜测或带入答案，请按需编辑新模板。',fields:d.inputs.map(f=>({id:f.id,label:f.label,required:false,hint:'旧合同未声明必填。',type:f.type,...(f.type==='number'?{unit:f.unit??'未注明'}:f.type==='choice'?{choices:f.choices}:{})})),rules:[],theme:legacy.theme,layout:legacy.layout});
}
export const taskSourceSchema=z.strictObject({id:z.string().uuid(),revision:z.number().int().min(1).max(100000),title:label,text:z.string().max(4000)});
export type TaskSource=z.infer<typeof taskSourceSchema>;
const draftField=z.strictObject({mode:z.enum(['unknown','value']),text:z.string().max(800)});
export const taskDraftSchema=z.record(id,draftField).refine(d=>Object.keys(d).length<=12);
export type TaskDraft=z.infer<typeof taskDraftSchema>;
export const lineageSchema=z.strictObject({seriesId:z.string().uuid(),revision:z.number().int().min(1).max(100000),parentConfirmationSha256:digest.nullable()}).superRefine((v,c)=>{if((v.revision===1)!==(v.parentConfirmationSha256===null))c.addIssue({code:'custom',message:'首修订无父确认，后续修订必须引用父确认。'});});
export type TaskLineage=z.infer<typeof lineageSchema>;
const recordBase={version:z.literal(1),template:taskTemplateSchema,source:taskSourceSchema,draft:taskDraftSchema,lineage:lineageSchema};
export const taskRecordSchema=z.discriminatedUnion('status',[
 z.strictObject({...recordBase,status:z.literal('draft')}),
 z.strictObject({...recordBase,status:z.literal('confirmed'),confirmation:z.strictObject({id:z.string().uuid(),at:z.iso.datetime(),previewSha256:digest,authority:z.literal('local acknowledgement only; no model, permission, approval or external submission')})}),
]);
export type TaskRecord=z.infer<typeof taskRecordSchema>;
export const taskParse=<T>(schema:z.ZodType<T>,value:unknown):T=>{if(bounded(value))throw Error('TASK_LIMIT');return schema.parse(value);};
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
export const taskDigest=async(value:unknown)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value)))))].map(v=>v.toString(16).padStart(2,'0')).join('');
export const blankTaskDraft=(t:TaskTemplate):TaskDraft=>Object.fromEntries(t.fields.map(f=>[f.id,{mode:'unknown',text:''}]));
function decimalKey(text:string){const [m,e='0']=text.toLowerCase().split('e'),u=m.replace(/^[+-]/,''),point=u.indexOf('.');let digits=u.replace('.','').replace(/^0+/,''),power=Number(e)-(point<0?0:u.length-point-1);if(!digits)return '0';while(digits.endsWith('0')){digits=digits.slice(0,-1);power++;}return (m.startsWith('-')?'-':'')+digits+'e'+power;}
export function validateTaskDraft(template:TaskTemplate,draft:TaskDraft){
 taskParse(taskTemplateSchema,template);taskParse(taskDraftSchema,draft);
 if(Object.keys(draft).length!==template.fields.length||template.fields.some(f=>!Object.hasOwn(draft,f.id)))throw Error('TASK_FIELDS');
 const inputs=template.fields.filter(f=>f.type!=='text').map(f=>({id:f.id,label:f.label,type:f.type,initial:null,...(f.type==='number'?{unit:f.unit}:f.type==='choice'?{choices:f.choices}:{})}));
 // The existing parser owns decimal/boolean/enum syntax; text stays literal.
 const p={title:template.name,dimensions:[],options:[],inputs,rules:[],constraints:[]} as Decision;
 const old=validateConditionDraft(p,{version:1,fields:Object.fromEntries(inputs.map(f=>[f.id,draft[f.id]]))});
 const errors:Record<string,string>=Object.assign(Object.create(null),Object.fromEntries(Object.entries(old.errors).map(([id,code])=>[id,({empty:'请填值，或明确选未知。',number:'请输入有限十进制数值，不执行公式。',boolean:'请选择是或否。',choice:'请选择模板声明的选项。',capacity:'容量无效。'} as const)[code]]))),values:InputValues=Object.create(null);
 if(old.ok)Object.assign(values,old.values);
 for(const f of template.fields){const d=draft[f.id];
  if(d.mode==='unknown'){values[f.id]=null;if(f.required)errors[f.id]='必填：请提供已知值。';continue;}
  if(f.type==='text'){if(!d.text.trim())errors[f.id]='请输入普通文本，或明确选未知。';else if(d.text.length>f.maxLength)errors[f.id]=`最多${f.maxLength}字符。`;else values[f.id]=d.text;}
  if(f.type==='number'&&!errors[f.id]){const n=values[f.id];if(typeof n==='number'){
   if(Number.isInteger(n)&&!Number.isSafeInteger(n)||decimalKey(d.text)!==decimalKey(String(n)))errors[f.id]='数值超出可无损表示范围；未静默取整或变成零。';
   else if(f.min!==undefined&&n<f.min||f.max!==undefined&&n>f.max)errors[f.id]=`超出声明范围（${f.min??'不限'} 至 ${f.max??'不限'} ${f.unit}）。`;
  }}
 }
 return {values,errors,valid:Object.keys(errors).length===0,unknown:template.fields.filter(f=>draft[f.id].mode==='unknown').map(f=>f.id)};
}
export async function previewTask(template:TaskTemplate,source:TaskSource,draft:TaskDraft,lineage:TaskLineage){
 const t=taskParse(taskTemplateSchema,template),s=taskParse(taskSourceSchema,source),l=taskParse(lineageSchema,lineage),validation=validateTaskDraft(t,draft);
 if(!s.text.trim())throw Error('TASK_SOURCE_REQUIRED: 请填写本地来源文字。草稿仍可保存。');
 if(!validation.valid)throw Error('TASK_INPUT: '+Object.entries(validation.errors).map(([k,v])=>`${k}: ${v}`).join('; '));
 const rules=t.rules.map(r=>({id:r.id,label:r.label,truth:matches(r.when,validation.values)}));
 const snapshot={template:t,source:s,draft:taskParse(taskDraftSchema,draft),lineage:l};
 return {...structuredClone(snapshot),values:validation.values,unknown:validation.unknown,rules,sha256:await taskDigest(snapshot),templateSha256:await taskDigest(t),sourceSha256:await taskDigest(s)};
}
export type TaskPreview=Awaited<ReturnType<typeof previewTask>>;
export async function confirmTask(current:{template:TaskTemplate;source:TaskSource;draft:TaskDraft;lineage:TaskLineage},preview:TaskPreview,acknowledged:boolean,uuid=()=>crypto.randomUUID(),now=()=>new Date().toISOString()):Promise<TaskRecord>{
 if(!acknowledged)throw Error('TASK_ACK_REQUIRED');
 const fresh=await previewTask(current.template,current.source,current.draft,current.lineage);
 if(fresh.sha256!==preview.sha256||await taskDigest(fresh)!==await taskDigest(preview))throw Error('TASK_PREVIEW_STALE');
 return taskParse(taskRecordSchema,{version:1,status:'confirmed',...current,confirmation:{id:uuid(),at:now(),previewSha256:fresh.sha256,authority:'local acknowledgement only; no model, permission, approval or external submission'}});
}
export async function assertTaskRecord(raw:unknown):Promise<TaskRecord>{
 const r=taskParse(taskRecordSchema,raw);validateTaskDraft(r.template,r.draft);
 if(r.status==='confirmed'){const p=await previewTask(r.template,r.source,r.draft,r.lineage);if(p.sha256!==r.confirmation.previewSha256)throw Error('TASK_CONFIRMATION_CHANGED');}
 return r;
}
export async function continueTask(r:TaskRecord):Promise<TaskLineage>{return r.status==='confirmed'?{seriesId:r.lineage.seriesId,revision:r.lineage.revision+1,parentConfirmationSha256:await taskDigest(r.confirmation)}:structuredClone(r.lineage);}
export function replaceTaskTemplate(old:TaskTemplate,next:unknown){const t=taskParse(taskTemplateSchema,next);if(t.id===old.id&&t.revision<=old.revision&&JSON.stringify(canonical(t))!==JSON.stringify(canonical(old)))throw Error('TASK_TEMPLATE_STALE: 同一模板的结构/规则/主题变更必须提高修订号。');return t;}
/** Ordinary semantic context; the task appendix carries the form, not graph callbacks. */
export function taskView(r:TaskRecord):Envelope{return {protocolVersion:'1.4',displayId:'task-'+r.lineage.seriesId,revision:r.lineage.revision,component:'ArchitectureExplorer',summary:`${r.template.name} · 本地${r.status==='confirmed'?'确认记录':'草稿'}，修订${r.lineage.revision}。仅记录所填输入与模板规则，不代表模型接受、权限或外部提交。`,payload:{title:r.template.name,nodes:[{id:'inputs',label:'填写条件',responsibility:'显式提供输入；未知保持未知。',constraints:[],evidence:[]},{id:'preview',label:'核对本地预览',responsibility:'按这份模板的有限规则计算，不执行表达式。',constraints:[],evidence:[]},{id:'record',label:r.status==='confirmed'?'本地确认记录':'未确认草稿',responsibility:'保存副本可重开继续；新修订不覆盖旧确认。',constraints:[],evidence:[]}],edges:[{id:'to-preview',source:'inputs',target:'preview',directed:true,type:'本地处理',evidence:[]},{id:'to-record',source:'preview',target:'record',directed:true,type:r.status==='confirmed'?'明确确认':'尚未确认',evidence:[]}],scenarios:[]}};}
