import {z} from 'zod';
import {bounded,validateEnvelope,type Decision} from './protocol';
import {decisionFacts} from './facts';
import {decide} from './math';
import {CAPACITY_DOMAIN} from './capacity-domain';
import {sourceMetadata,SOURCE_LIMITS,type SourceSnapshot,type SourceSpan,type SourceIssue} from './source-graph';

const units=z.enum(['MB','GB','TB','MiB','GiB','TiB']);
const amount=z.number().finite().min(CAPACITY_DOMAIN.min).max(CAPACITY_DOMAIN.max);
const name=z.string().min(1).max(80);
type Quality='simple'|'complex'|null;
type Quantity={value:number;unit:z.infer<typeof units>;spans:SourceSpan[]};
export interface CapacitySource {
 options:{label:string;ceiling:Quantity;deployment:{value:Quality;spans:SourceSpan[]};maintenance:{value:Quality;spans:SourceSpan[]}}[];
 current:Quantity;
 possibleFuture:Quantity|null;
 confirmedFuturePlan:null;
}
const coordinates=z.strictObject({capacityDimensionId:name,demandInputId:name,requirementId:name});
const quantityKinds=['capacity-limit','current-demand','possible-future-demand'];
const qualityKinds=['deployment','maintenance'];
const claim=z.strictObject({kind:name,option:name.optional(),value:z.union([amount,z.boolean(),z.enum(['simple','complex'])]).nullable().optional(),unit:units.optional(),text:z.string().min(1).max(1200).optional()}).superRefine((c,ctx)=>{
 const quantity=quantityKinds.includes(c.kind),quality=qualityKinds.includes(c.kind),plan=c.kind==='confirmed-future-plan';
 const valid=quantity?(typeof c.value==='number'||c.value===null)&&!!c.unit&&(c.kind==='capacity-limit'?!!c.option:c.option===undefined)&&c.text===undefined:quality?!!c.option&&(c.value===null||c.value==='simple'||c.value==='complex')&&c.unit===undefined&&c.text===undefined:plan?(typeof c.value==='boolean'||c.value===null)&&c.option===undefined&&c.unit===undefined&&c.text===undefined:!!c.text&&c.option===undefined&&c.value===undefined&&c.unit===undefined;
 if(!valid)ctx.addIssue({code:'custom',message:'Quantity claims use value/exact unit (capacity-limit also option); deployment/maintenance use option and simple/complex/null; confirmed-future-plan uses boolean/null; unsupported kinds use only text.'});
});
export const sourceCapacityRequestSchema=z.strictObject({view:z.unknown().optional(),mapping:coordinates.optional(),claims:z.array(claim).max(SOURCE_LIMITS.claims).optional(),prose:z.string().max(20000).optional()});
export type CapacityCoordinates=z.infer<typeof coordinates>;
const bytes=(s:string)=>new TextEncoder().encode(s).length;
export const capacitySourcePrefix=(text:string)=>/^(?:虚构|合成)?存储选项/u.test(text.trim());
const literal=(s:string)=>/^[\p{L}\p{N}][\p{L}\p{N}_ -]{0,79}$/u.test(s);
const quantityPattern='((?:0|[1-9]\\d*)(?:\\.\\d{1,6})?)\\s*([A-Za-z]+)';

/** A complete, finite storage declaration. No unit conversion or dropped clauses. */
export function parseCapacitySource(text:string,offset=0):{status:'ready';value:CapacitySource}|{status:'unsupported';issues:SourceIssue[]}{
 const fail=(reason:string,code='SOURCE_CAPACITY_SYNTAX')=>({status:'unsupported' as const,issues:[{code,path:'$.source.excerpt',reason}]});
 if(!text.trim()||bytes(text)>SOURCE_LIMITS.excerptBytes)return fail('Empty or over-limit source.','SOURCE_LIMIT');
 const clauses=[...text.matchAll(/[^，,、；;。！？!?\r\n]+/gu)].map(m=>{const t=m[0].trim(),start=m.index+m[0].indexOf(t);return {text:t,index:m.index,start,span:{textByteStart:offset+bytes(text.slice(0,start)),textByteEnd:offset+bytes(text.slice(0,start+t.length))}};}).filter(c=>c.text);
 if(!clauses.length||clauses.length>24)return fail('Use one bounded two-option declaration.');
 const options:CapacitySource['options']=[];let subject:CapacitySource['options'][number]|undefined,current:Quantity|undefined,possibleFuture:Quantity|null=null;
 const quantity=(m:RegExpMatchArray,start:number,c:typeof clauses[number]):Quantity|undefined=>{
  const token=m[start],value=Number(token),normalized=token.includes('.')?token.replace(/0+$/u,'').replace(/\.$/u,''):token,unit=units.safeParse(m[start+1]);if(String(value)!==normalized||!amount.safeParse(value).success||!unit.success)return;
  const at=c.text.lastIndexOf(m[start]);return {value,unit:unit.data,spans:[{textByteStart:offset+bytes(text.slice(0,c.start))+bytes(c.text.slice(0,at)),textByteEnd:c.span.textByteEnd}]};
 };
 for(const [i,c] of clauses.entries()){
  let t=c.text;
  if(i===0){const h=t.match(/^(?:虚构|合成)?存储选项\s*/u);if(!h)return fail('Start with 存储选项 (optionally 虚构 or 合成).');t=t.slice(h[0].length);}
  if(i&&/[。！？!?；;\r\n]/u.test(text.slice(clauses[i-1].start+clauses[i-1].text.length,c.start)))subject=undefined;
  let m:RegExpMatchArray|null;
  if((m=t.match(new RegExp('^(.+?)\\s*上限\\s*'+quantityPattern+'$','u')))){
   const label=m[1].trim(),q=quantity(m,2,c);if(!literal(label)||!q||options.some(o=>o.label===label)||options.length===2)return fail('Two unique literal options and supported nonnegative ceilings are required.','SOURCE_CAPACITY_REFERENCE');
   subject={label,ceiling:q,deployment:{value:null,spans:[]},maintenance:{value:null,spans:[]}};options.push(subject);continue;
  }
  if((m=t.match(/^(部署|维护)(简单|复杂|未知)$/u))){
   if(!subject)return fail('A deployment or maintenance fact needs an unambiguous same-sentence option.');
   const field=m[1]==='部署'?'deployment':'maintenance';if(subject[field].spans.length)return fail('Repeated qualitative declarations are unsupported.');
   subject[field]={value:m[2]==='简单'?'simple':m[2]==='复杂'?'complex':null,spans:[c.span]};continue;
  }
  if((m=t.match(new RegExp('^(?:现在|当前)需求\\s*'+quantityPattern+'$','u')))){
   if(current)return fail('Repeated current demand is unsupported.');current=quantity(m,1,c);if(!current)return fail('Unsupported current quantity or exact unit.');subject=undefined;continue;
  }
  if((m=t.match(new RegExp('^(?:以后|未来)可能到\\s*'+quantityPattern+'$','u')))){
   if(possibleFuture)return fail('Repeated possible future demand is unsupported.');possibleFuture=quantity(m,1,c)??null;if(!possibleFuture)return fail('Unsupported possible-future quantity or exact unit.');subject=undefined;continue;
  }
  if(['不同需求下该如何选','不同需求下如何选','该如何选','请比较'].includes(t)){subject=undefined;continue;}
  return fail('Unsupported complete-source clause; no policy, price, qualifier or question was silently discarded.');
 }
 if(options.length!==2||!current)return fail('Two ceilings and an explicit current demand are required.');
 if([...options.map(o=>o.ceiling),...(possibleFuture?[possibleFuture]:[])].some(q=>q.unit!==current!.unit))return fail('All quantities must use exactly the same supported unit; no conversion is inferred.','SOURCE_CAPACITY_UNIT');
 return {status:'ready',value:{options,current,possibleFuture,confirmedFuturePlan:null}};
}

const qualityText=(value:Quality)=>value===null?'未声明':value==='simple'?'简单':'复杂';
/** Existing component fields only. The one numeric input actually drives at-least. */
export function capacityDecision(source:CapacitySource,c:CapacityCoordinates,optionIds=source.options.map((_,i)=>`option-${i}`)):Decision {
 return {title:'来源声明的容量与本地需求假设',dimensions:[{id:c.capacityDimensionId,label:'容量上限',kind:'number',unit:source.current.unit}],options:source.options.map((o,i)=>({id:optionIds[i],label:o.label,values:{[c.capacityDimensionId]:o.ceiling.value},advantages:[],disadvantages:[],suitableWhen:`来源部署：${qualityText(o.deployment.value)}；维护：${qualityText(o.maintenance.value)}。两类属性独立，不能由其中一项推断另一项、费用或整体适合程度。`,evidence:[]})),inputs:[{id:c.demandInputId,label:'需求容量（本地假设）',type:'number',unit:source.current.unit,initial:source.current.value,expectedEffect:'hard'}],requirements:[{id:c.requirementId,dimension:c.capacityDimensionId,input:c.demandInputId,relation:'at-least'}],rules:[],constraints:[]};
}
function calculations(source:CapacitySource,p:Decision){
 const initial=decisionFacts(p,true);
 const future=source.possibleFuture?decide(p,{[p.inputs[0].id]:source.possibleFuture.value},true):null;
 return {current:initial,possibleFutureHypothesis:future?{demand:source.possibleFuture!.value,unit:source.current.unit,scope:'explicit local hypothesis, not current source demand or confirmed plan',eligibleOptionIds:future.eligibleOptionIds,excludedOptionIds:future.excludedOptionIds,requirements:future.requirements}:null};
}
function canonical(source:CapacitySource,p:Decision){
 const computed=calculations(source,p),labels=(ids:string[])=>p.options.filter(o=>ids.includes(o.id)).map(o=>o.label).join('、')||'无';
 const lines=source.options.map(o=>`${o.label}容量上限 ${o.ceiling.value}${o.ceiling.unit}；部署：${qualityText(o.deployment.value)}；维护：${qualityText(o.maintenance.value)}。`);
 lines.push(`来源当前需求 ${source.current.value}${source.current.unit}：仅容量满足的方案为${labels(computed.current.eligibleOptionIds)}；容量不足的方案为${labels(computed.current.excludedOptionIds)}。`);
 if(computed.possibleFutureHypothesis){const f=computed.possibleFutureHypothesis;lines.push(`来源仅说以后可能到 ${f.demand}${f.unit}，不是已确认的当前需求或未来计划。若显式按 ${f.demand}${f.unit} 作本地需求假设：仅容量满足的方案为${labels(f.eligibleOptionIds)}；容量不足的方案为${labels(f.excludedOptionIds)}。`);}
 else lines.push('来源未声明未来可能需求点或已确认未来计划，保持未知。');
 lines.push('容量上限是可提供量，需求是所需量；同单位按上限 ≥ 需求计算。部署简单不证明维护简单，维护复杂不证明部署属性、具体费用或维护资源需求。', '本地数值控件只重算容量硬条件，显示改变的是假设，不更新原始来源或确认预留计划；刷新恢复原始需求。容量达标不等于整体胜出，价格、迁移代价和偏好未知。以上不认证世界事实、作者身份或任意模型正文。');
 return lines.join('\n');
}

export function checkSourceCapacity(snapshot:SourceSnapshot,input:unknown):Record<string,unknown>{
 const common={sourceCheckVersion:'1.0',sourceCheckKind:'capacity-zh',source:{...sourceMetadata(snapshot),scope:'complete bounded storage capacities, exact unit, current demand, possible future point and separate deployment/maintenance declarations'},sourceFactsVerified:false,identityVerified:false,freeProseVerified:false};
 const finish=(value:Record<string,unknown>)=>bounded(value)?{...common,status:'source-unsupported',issues:[{code:'RECEIPT_LIMIT',path:'$',reason:'The complete source comparison exceeds the receipt budget.'}],comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}}:value;
 const budget=bounded(input),request=sourceCapacityRequestSchema.safeParse(input);
 if(budget||!request.success)return finish({...common,status:'validation-failed',issues:budget?[budget]:request.error!.issues.map(i=>({code:'SOURCE_REQUEST',path:'$.'+i.path.join('.'),reason:i.message})),comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}});
 if(snapshot.textByteStart!==0||snapshot.textByteEnd!==snapshot.textBytes||snapshot.excerptSha256!==snapshot.textSha256)return {...common,status:'source-unsupported',issues:[{code:'SOURCE_CAPACITY_COMPLETE',path:'$.source',reason:'The whole selected text is required; an excerpt cannot drop current/future or qualitative declarations.'}],comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
 const parsed=parseCapacitySource(snapshot.excerpt,snapshot.textByteStart);if(parsed.status!=='ready')return {...common,status:'source-unsupported',issues:parsed.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
 const source=parsed.value,issues:SourceIssue[]=[],fieldChecks:Record<string,unknown>[]=[],inputChecks:Record<string,unknown>[]=[],add=(code:string,path:string,reason:string)=>issues.push({code,path,reason});
 const {view,mapping,claims=[],prose}=request.data;let comparison:{status:string}={status:'not-requested'},p=capacityDecision(source,{capacityDimensionId:'ceiling',demandInputId:'demand',requirementId:'capacity'});
 if(view!==undefined){
  const validated=validateEnvelope(view);if(!validated.ok)return finish({...common,status:'validation-failed',issues:validated.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}});
  if(validated.value.component!=='DecisionExplorer')return {...common,status:'source-unsupported',issues:[{code:'SOURCE_COMPONENT',path:'$.view.component',reason:'capacity-zh compares DecisionExplorer only.'}],comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
  p=validated.value.payload;
  if(!mapping)add('SOURCE_MAPPING_REQUIRED','$.mapping','Bind the real capacity dimension, demand input and hard requirement IDs.');
  const d=p.dimensions.find(d=>d.id===mapping?.capacityDimensionId),i=p.inputs.find(i=>i.id===mapping?.demandInputId),r=p.requirements?.find(r=>r.id===mapping?.requirementId);
  if(p.dimensions.length!==1||!d||d.label!=='容量上限'||d.kind!=='number'||d.unit!==source.current.unit||d.semanticRole!==undefined)add('SOURCE_CAPACITY_DIMENSION','$.view.payload.dimensions','Exactly one numeric 容量上限 column in the source unit; qualitative attributes remain separate source explanations.');
  if(p.inputs.length!==1||!i||!['需求容量','需求容量（本地假设）'].includes(i.label)||i.type!=='number'||i.unit!==source.current.unit||i.initial!==source.current.value||i.semanticRole!==undefined||i.expectedEffect!=='hard'||i.choices!==undefined)add('SOURCE_CURRENT_DEMAND','$.view.payload.inputs','One hard numeric demand input must start at the current source quantity in the exact unit, not the possible future point. Local edits are hypotheses.');
  if(i)inputChecks.push({inputId:i.id,role:'required-capacity',expected:source.current.value,actual:i.initial,unit:source.current.unit,sourceSpans:source.current.spans,status:i.initial===source.current.value&&i.unit===source.current.unit?'matched':'mismatch'});
  if(p.options.length!==2||p.options.some(o=>!source.options.some(s=>s.label===o.label))||new Set(p.options.map(o=>o.label)).size!==2)add('SOURCE_OPTIONS','$.view.payload.options','Use both exact source option labels; no aliases or extra options.');
  for(const [index,o] of p.options.entries()){
   const s=source.options.find(s=>s.label===o.label);if(!s)continue;const actual=mapping?o.values[mapping.capacityDimensionId]:undefined;
   fieldChecks.push({optionId:o.id,sourceOption:s.label,kind:'capacity-limit',dimensionId:mapping?.capacityDimensionId,role:'provided-capacity',expected:s.ceiling.value,actual:actual??null,unit:s.ceiling.unit,sourceSpans:s.ceiling.spans,status:actual===s.ceiling.value?'matched':'mismatch'});
   if(actual!==s.ceiling.value)add('SOURCE_CAPACITY_VALUE',`$.view.payload.options.${index}.values`,'The provided ceiling differs from this option in the current source.');
  }
  if(p.requirements?.length!==1||!r||r.dimension!==mapping?.capacityDimensionId||r.input!==mapping?.demandInputId||r.relation!=='at-least'||r.when!==undefined)add('SOURCE_CAPACITY_DIRECTION','$.view.payload.requirements','Exactly one unconditional capacity dimension >= numeric demand requirement is required; no reversed relation or preference-only control.');
  if(p.rules.length||p.constraints.length)add('SOURCE_POLICY_UNSUPPORTED','$.view.payload','No recommendation, cost, reserve-growth policy or arbitrary exclusion follows from these declarations.');
  comparison={status:issues.length?'mismatch':'matched'};
 }else if(mapping)add('SOURCE_VIEW_REQUIRED','$.view','Coordinates without a view cannot verify fields.');
 const claimChecks=claims.map((c,index)=>{
  const option=source.options.find(o=>o.label===c.option);
  if(c.option&&!option)return {index,kind:c.kind,status:'not-assessed',code:'SOURCE_BINDING_UNKNOWN'};
  const q=c.kind==='capacity-limit'?option?.ceiling:c.kind==='current-demand'?source.current:c.kind==='possible-future-demand'?source.possibleFuture:undefined;
  if(quantityKinds.includes(c.kind))return {index,kind:c.kind,expected:q?.value??null,unit:q?.unit??source.current.unit,sourceSpans:q?.spans??[],status:!q?(c.value===null&&c.unit===source.current.unit?'unknown':'unsupported-by-source'):c.value===q.value&&c.unit===q.unit?'supported':'contradicted'};
  if(qualityKinds.includes(c.kind)){const field=option![c.kind as 'deployment'|'maintenance'];return {index,kind:c.kind,expected:field.value,sourceSpans:field.spans,status:field.value===null?(c.value===null?'unknown':'unsupported-by-source'):c.value===field.value?'supported':'contradicted'};}
  if(c.kind==='confirmed-future-plan')return {index,kind:c.kind,expected:null,status:c.value===null?'unknown':'unsupported-by-source'};
  return {index,kind:c.kind,status:'not-assessed',code:'SOURCE_CLAIM_UNSUPPORTED'};
 });
 const available=!issues.length&&claimChecks.every(c=>['supported','unknown'].includes(c.status));
 return finish({...common,status:'compared',sourceCapacity:source,comparison,issues,fieldChecks,inputChecks,claimChecks,...(!issues.length?{computedCapacity:calculations(source,p)}:{}),freeProse:{status:'not-verified',provided:prose!==undefined},canonicalExplanation:available?{status:'available',basis:'complete finite capacity source and existing numeric hard-requirement core',text:canonical(source,p)}:{status:'withheld'}});
}
