import {z} from 'zod';
import {bounded,validateEnvelope,usesReviewedPolicy,type Decision} from './protocol';
import {decisionFacts} from './facts';
import {sourceMetadata,SOURCE_LIMITS,type SourceSnapshot,type SourceIssue} from './source-graph';

type Kind='capability'|'actor-updates'|'maintenance-need'|'price'|'capability-need'|'actor-available'|'preference'|'condition';
type Span={textByteStart:number;textByteEnd:number};
export interface DecisionConditionalNeed{name:string;condition:string;whenTrue:boolean;whenFalse:boolean;current:boolean|null;currentSpans:Span[];spans:{condition:Span;whenTrue:Span;whenFalse:Span};derivedNeed:boolean|null}
export interface DecisionSourceFact{kind:Kind;option:string|null;name:string|null;actor:string|null;value:boolean|null;spans:Span[];derivation?:{condition:string;whenTrue:boolean;whenFalse:boolean;current:boolean|null}}
export interface DecisionSource{options:[string,string];facts:DecisionSourceFact[];clauses:{kind:string;span:Span}[];conditionalNeeds?:DecisionConditionalNeed[]}
const label=z.string().min(1).max(80),id=z.string().min(1).max(80);
const literal=(s:string)=>/^[\p{L}\p{N}][\p{L}\p{N}_ -]{0,79}$/u.test(s)&&!['它','他们','其','我们','前者','后者'].includes(s)&&!/(需要|支持|没有|未知|负责|如果|但是|但|且|以及|或者|因为|因此|可能|以后|只要|只由|同时|不由|是否|与|和)/u.test(s);
const key=(kind:Kind,option:string|null,name:string|null,actor:string|null)=>JSON.stringify([kind,option,name,actor]);
const bytes=(s:string)=>new TextEncoder().encode(s).length;
/** Chooses the existing finite grammar; it does not extract or authorize facts. */
export const decisionSourcePrefix=(text:string)=>/^\s*[\p{L}\p{N}_-]{1,40}在(?:选择|比较|选)/u.test(text);

/** Deliberately finite Chinese grammar, with complete clause coverage. No model/ID lookup. */
export function parseDecisionSource(text:string,offset=0):{status:'ready';value:DecisionSource}|{status:'unsupported';issues:SourceIssue[]}{
 const fail=(code:string,reason:string)=>({status:'unsupported' as const,issues:[{code,path:'$.source.excerpt',reason}]});
 if(bytes(text)>SOURCE_LIMITS.excerptBytes)return fail('SOURCE_LIMIT','Decision source exceeds the selected-text byte limit.');
 const chunks=[...text.matchAll(/[^。！？?!；;，,、\r\n]+/gu)].filter(m=>m[0].trim());
 if(!chunks.length||chunks.length>64)return fail('SOURCE_SYNTAX','Supply one bounded two-option comparison, not an empty or oversized document.');
 const first=chunks[0][0].trim().match(/^([\p{L}\p{N}_-]{1,40})在(?:选择|比较|选)(.+)$/u);
 const options=first?.[2].split(/[与和]/u).map(s=>s.trim());
 if(!options||options.length!==2||options[0]===options[1]||!options.every(literal))return fail('SOURCE_REFERENCE','Start with a literal subject 在选/在选择/在比较 two distinct named options separated by 与/和. Former/latter references require this order.');
 const source:DecisionSource={options:options as [string,string],facts:[],clauses:[]},facts=new Map<string,DecisionSourceFact>();let subject:string|null=null;
 const conditional:DecisionConditionalNeed[]=[],currents=new Map<string,{value:boolean|null;spans:Span[]}>(),consumed=new Set<number>();
 const spanOf=(chunk:typeof chunks[number]):Span=>({textByteStart:offset+bytes(text.slice(0,chunk.index)),textByteEnd:offset+bytes(text.slice(0,chunk.index+chunk[0].length))});
 const put=(kind:Kind,option:string|null,name:string|null,actor:string|null,value:boolean|null,span:Span)=>{
  if(name&&!literal(name)||actor&&!literal(actor))throw Error('SOURCE_REFERENCE');
  const k=key(kind,option,name,actor),old=facts.get(k);
  if(old&&old.value!==value)throw Error('SOURCE_CONTRADICTION');
  if(old)old.spans.push(span);else facts.set(k,{kind,option,name,actor,value,spans:[span]});
 };
 try{for(const [i,chunk] of chunks.entries()){
  let clause=chunk[0].trim();const span=spanOf(chunk);
  if(consumed.has(i))continue;
  if(i&&/[。！？?!；;\r\n]/u.test(text.slice(chunks[i-1].index+chunks[i-1][0].length,chunk.index)))subject=null;
  if(i===0){source.clauses.push({kind:'selection',span});continue;}
  const explicitOption=options.some(o=>clause.startsWith(o));
  let m:RegExpMatchArray|null;
  if(!explicitOption&&clause.startsWith('只有'))throw Error('SOURCE_CONDITION_DIRECTION');
  if(!explicitOption&&(m=clause.match(/^若(.+)$/u))){
   subject=null;const condition=m[1],yes=chunks[i+1],no=chunks[i+2];
   const a=yes?.[0].trim().match(/^则我们(不需要|需要)(.+)$/u),b=no?.[0].trim().match(/^否则我们(不需要|需要)(.+)$/u);
   if(!literal(condition)||/若|则|否则|当前/u.test(condition)||!a||!b||a[2]!==b[2]||!literal(a[2]))throw Error('SOURCE_CONDITION_BRANCH');
   if(conditional.some(c=>c.name===a[2]))throw Error('SOURCE_CONDITION_DUPLICATE');
   conditional.push({name:a[2],condition,whenTrue:a[1]==='需要',whenFalse:b[1]==='需要',current:null,currentSpans:[],spans:{condition:span,whenTrue:spanOf(yes),whenFalse:spanOf(no)},derivedNeed:null});
   source.clauses.push({kind:'condition',span},{kind:'condition-true-branch',span:spanOf(yes)},{kind:'condition-false-branch',span:spanOf(no)});consumed.add(i+1);consumed.add(i+2);continue;
  }
  if(!explicitOption&&(m=clause.match(/^当前(.+?)(?:为(是|否|未知)|(未知))$/u))&&literal(m[1])){
   subject=null;const name=m[1],value=(m[2]??m[3])==='未知'?null:m[2]==='是',old=currents.get(name);
   if(!literal(name))throw Error('SOURCE_REFERENCE');
   if(old&&old.value!==value)throw Error('SOURCE_CONTRADICTION');
   if(old)old.spans.push(span);else currents.set(name,{value,spans:[span]});
   source.clauses.push({kind:'current-condition',span});continue;
  }
  if(['该怎样权衡','如何权衡','该如何权衡','应该怎样选择','该怎样选择','怎么选','请比较'].includes(clause)){subject=null;source.clauses.push({kind:'comparison-request',span});continue;}
  if(/^(两边|两者)价格都?未知$/u.test(clause)){subject=null;for(const o of options)put('price',o,null,null,null,span);source.clauses.push({kind:'fact',span});continue;}
  if((m=clause.match(/^我们(?:暂时|目前|现在)?(不需要|需要)(.+)$/u))){subject=null;put('capability-need',null,m[2],null,m[1]==='需要',span);}
  else if((m=clause.match(/^我们(?:目前|现在|暂时)?(?:更看重|偏好)(.+)$/u))){subject=null;put('preference',null,m[1],null,true,span);}
  else if((m=clause.match(/^我们对(.+)的需求未知$/u))){subject=null;put('capability-need',null,m[1],null,null,span);}
  else if((m=clause.match(/^(.+?)(有|没有)维护余力$/u))){subject=null;if(![...facts.values()].some(f=>f.actor===m![1]))throw Error('SOURCE_REFERENCE');put('actor-available',null,null,m[1],m[2]==='有',span);}
  else if((m=clause.match(/^(.+?)维护余力(?:未知|未说明)$/u))){subject=null;if(![...facts.values()].some(f=>f.actor===m![1]))throw Error('SOURCE_REFERENCE');put('actor-available',null,null,m[1],null,span);}
  else{
   if(clause.startsWith('前者')){subject=options[0];clause=clause.slice(2);}
   else if(clause.startsWith('后者')){subject=options[1];clause=clause.slice(2);}
   else{const named=[...options].sort((a,b)=>b.length-a.length).find(o=>clause.startsWith(o));if(named){subject=named;clause=clause.slice(named.length);}}
   if(!subject)throw Error('SOURCE_REFERENCE');
   if((m=clause.match(/^(不由|由)(.+?)更新$/u)))put('actor-updates',subject,null,m[2],m[1]==='由',span);
   else if((m=clause.match(/^(不需要|需要)(.+?)维护$/u)))put('maintenance-need',subject,null,m[2],m[1]==='需要',span);
   else if((m=clause.match(/^(不支持|没有|支持)(.+)$/u)))put('capability',subject,m[2],null,m[1]==='支持',span);
   else if((m=clause.match(/^(.+?)支持未知$/u)))put('capability',subject,m[1],null,null,span);
   else if((m=clause.match(/^(.+?)维护需求未知$/u)))put('maintenance-need',subject,null,m[1],null,span);
   else if((m=clause.match(/^(.+?)更新责任未知$/u)))put('actor-updates',subject,null,m[1],null,span);
   else if(clause==='价格未知')put('price',subject,null,null,null,span);
   else throw Error('SOURCE_SYNTAX');
  }
  source.clauses.push({kind:'fact',span});
 }
 for(const name of currents.keys())if(!conditional.some(c=>c.condition===name))throw Error('SOURCE_CONDITION_REFERENCE');
 for(const c of conditional){
  if(facts.has(key('capability-need',null,c.name,null)))throw Error('SOURCE_CONDITION_OVERLAP');
  const current=currents.get(c.condition);c.current=current?.value??null;c.currentSpans=current?.spans??[];
  c.derivedNeed=c.current===null?(c.whenTrue===c.whenFalse?c.whenTrue:null):c.current?c.whenTrue:c.whenFalse;
  for(const span of [...Object.values(c.spans),...c.currentSpans])put('capability-need',null,c.name,null,c.derivedNeed,span);
  facts.get(key('capability-need',null,c.name,null))!.derivation={condition:c.condition,whenTrue:c.whenTrue,whenFalse:c.whenFalse,current:c.current};
 }
 if(conditional.length)source.conditionalNeeds=conditional;
 }catch(error){return fail(error instanceof Error?error.message:'SOURCE_SYNTAX','A contradictory fact, unresolved subject/actor or unsupported/incomplete conditional clause prevents complete parsing. Both branches must be explicit; only-if is not if-and-only-if. No clause was silently skipped.');}
 source.facts=[...facts.values()];
 if(!source.facts.length)return fail('SOURCE_EMPTY','The comparison contains no supported facts or conditions.');
 return {status:'ready',value:source};
}

const dimensionBinding=z.strictObject({id,kind:z.enum(['capability','actor-updates','maintenance-need','price']),name:label.optional(),actor:label.optional()}).superRefine((b,ctx)=>{if(!(b.kind==='capability'?!!b.name&&!b.actor:b.kind==='price'?!b.name&&!b.actor:!!b.actor&&!b.name))ctx.addIssue({code:'custom',message:'Bind capability by name, responsibility by actor, and price without a name or actor.'});});
const inputBinding=z.strictObject({id,kind:z.enum(['capability-need','actor-available']),name:label.optional(),actor:label.optional()}).superRefine((b,ctx)=>{if(!(b.kind==='capability-need'?!!b.name&&!b.actor:!!b.actor&&!b.name))ctx.addIssue({code:'custom',message:'Bind a capability need by name or actor availability by actor.'});});
const knownKinds=new Set(['capability','actor-updates','maintenance-need','price','capability-need','actor-available','preference','condition','conditional-need']);
const claim=z.strictObject({kind:label,option:label.optional(),name:label.optional(),actor:label.optional(),value:z.boolean().nullable().optional(),text:z.string().max(1200).optional(),condition:label.optional(),whenTrue:z.boolean().optional(),whenFalse:z.boolean().optional()}).superRefine((c,ctx)=>{
 if(c.kind==='conditional-need'){
  if(!c.name||!c.condition||c.whenTrue===undefined||c.whenFalse===undefined||c.option!==undefined||c.actor!==undefined||c.value!==undefined||c.text!==undefined)ctx.addIssue({code:'custom',message:'A conditional-need claim names its capability, literal condition and both boolean branches; no missing/implicit else branch.'});return;
 }
 let valid=!knownKinds.has(c.kind)?!!c.text&&c.option===undefined&&c.name===undefined&&c.actor===undefined&&c.value===undefined:c.text===undefined&&c.value!==undefined;
 valid&&=c.condition===undefined&&c.whenTrue===undefined&&c.whenFalse===undefined;
 if(knownKinds.has(c.kind))valid&&=c.kind==='capability'?!!c.option&&!!c.name&&!c.actor:c.kind==='price'?!!c.option&&!c.name&&!c.actor:c.kind==='actor-updates'||c.kind==='maintenance-need'?!!c.option&&!!c.actor&&!c.name:c.kind==='actor-available'?!!c.actor&&!c.option&&!c.name:!!c.name&&!c.option&&!c.actor;
 if(!valid)ctx.addIssue({code:'custom',message:'Known claims contain only their literal source coordinates and boolean/null value. Unsupported prose claims contain only kind/text.'});
});
export const sourceDecisionRequestSchema=z.strictObject({view:z.unknown().optional(),mapping:z.strictObject({dimensions:z.array(dimensionBinding).max(12),inputs:z.array(inputBinding).max(12)}).optional(),claims:z.array(claim).max(32).optional(),prose:z.string().max(20000).optional()});
type DimensionBinding=z.infer<typeof dimensionBinding>;
type InputBinding=z.infer<typeof inputBinding>;
const concept=(b:{kind:string;name?:string;actor?:string})=>JSON.stringify([b.kind,b.name??null,b.actor??null]);
const getFact=(s:DecisionSource,kind:Kind,option:string|null,name:string|null,actor:string|null):DecisionSourceFact=>{
 if(kind==='condition'){const c=s.conditionalNeeds?.find(c=>c.condition===name);return {kind,option:null,name,actor:null,value:c?.current??null,spans:c?.currentSpans??[]};}
 return s.facts.find(f=>key(f.kind,f.option,f.name,f.actor)===key(kind,option,name,actor))??{kind,option,name,actor,value:null,spans:[]};
};
function expectedLabels(b:DimensionBinding|InputBinding):string[]{
 const n=b.name,a=b.actor;
 switch(b.kind){
  case'capability':return [n!,`支持${n}`,`${n}支持`,`是否支持${n}`];
  case'actor-updates':return [`由${a}更新`,`${a}更新`,`${a}负责更新`,`是否由${a}更新`];
  case'maintenance-need':return [`需要${a}维护`,`需${a}维护`,`需${a}自行维护`,`${a}维护需求`,`是否需要${a}维护`];
  case'price':return ['价格'];
  case'capability-need':return [`需要${n}`,`当前需要${n}`,`是否需要${n}`,`${n}需求`,`当前${n}需求`];
  case'actor-available':return [`${a}有维护余力`,`${a}维护余力`,`${a}是否有维护余力`];
 }
}
function canonical(s:DecisionSource):string{
 const words=(f:DecisionSourceFact)=>f.kind==='price'?'价格声明未知':f.kind==='capability'?`${f.name}支持=${f.value===null?'未知':f.value}`:f.kind==='actor-updates'?`由${f.actor}更新=${f.value===null?'未知':f.value}`:f.kind==='maintenance-need'?`需要${f.actor}维护=${f.value===null?'未知':f.value}`:f.kind==='capability-need'?`当前需要${f.name}=${f.value===null?'未知':f.value}${f.value===false?'（不据此排除缺少该能力的方案）':''}`:f.kind==='actor-available'?`${f.actor}维护余力=${f.value===null?'未知':f.value}`:`偏好${f.name}（不等于硬需求）`;
 const actors=[...new Set(s.facts.filter(f=>f.kind==='maintenance-need'||f.kind==='actor-available').map(f=>f.actor!))];
 const updaters=[...new Set(s.facts.filter(f=>f.kind==='actor-updates').map(f=>f.actor!))];
 const lines=s.options.map(o=>`${o}：${s.facts.filter(f=>f.option===o).map(words).join('；')||'未给出方案事实'}。`);
 for(const o of s.options)for(const actor of actors)if(!getFact(s,'maintenance-need',o,null,actor).spans.length)lines.push(`${o}是否需要${actor}维护未声明；不能由其它更新责任推定需要或不需要。`);
 for(const o of s.options)for(const actor of updaters)if(!getFact(s,'actor-updates',o,null,actor).spans.length)lines.push(`${o}是否由${actor}更新未声明，不能自动取反。`);
 lines.push(...s.facts.filter(f=>f.option===null).map(f=>words(f)+'。'));
 for(const c of s.conditionalNeeds??[]){
  const branch=(need:boolean)=>!need?'本项不排除两种方案':s.options.map(o=>{const support=getFact(s,'capability',o,c.name,null).value;return `${o}${support===true?'满足本项':support===false?'不满足本项':'该能力未知，能否满足本项未知'}`;}).join('；');
  lines.push(`来源两分支：若${c.condition}=true，则需要${c.name}=${c.whenTrue}；否则需要${c.name}=${c.whenFalse}。`,
   `当前${c.condition}=${c.current===null?'未知':c.current}${c.currentSpans.length?'（来源明确声明）':'（来源未声明）'}，所以当前需要${c.name}=${c.derivedNeed===null?'未知':c.derivedNeed}；${c.derivedNeed===null?'条件未定，不能按false或不需要处理':branch(c.derivedNeed)}。`,
   `若本地假设${c.condition}=true：${branch(c.whenTrue)}；若本地假设${c.condition}=false：${branch(c.whenFalse)}。`,
   '这些结论只针对本项要求，不表示整体可行、唯一赢家或推荐。本地需求控件是假设，不改变原始条件或来源；其初值是上面的派生当前需求。');
 }
 for(const actor of actors)if(!getFact(s,'actor-available',null,null,actor).spans.length)lines.push(`${actor}维护余力未声明，保持未知。`);
 lines.push('以上只对应来源中的有限声明；未给反面保持未知，不提供成本排序、推荐或任意正文认证。');
 return lines.join('\n');
}

export function checkSourceDecision(snapshot:SourceSnapshot,input:unknown):Record<string,unknown>{
 const common={sourceCheckVersion:'1.0',sourceCheckKind:'decision-zh',source:{...sourceMetadata(snapshot),scope:'bounded two-option decision-zh grammar in the selected text; source identity, unselected context and arbitrary prose are not assessed'},sourceFactsVerified:false,unverified:['source author/original human identity','general natural-language meaning outside the documented grammar','component annotations and arbitrary free prose','cost ranking, recommendation, exclusivity or inferred opposite responsibilities']};
 const finish=(r:Record<string,unknown>)=>bounded(r)?{...common,status:'check-limit',issues:[{code:'SOURCE_CHECK_LIMIT',path:'$',reason:'Complete comparison exceeds the receipt budget; no partial approval is returned.'}]}:r;
 const inputIssue=bounded(input);if(inputIssue)return {...common,status:'validation-failed',issues:[inputIssue]};
 const request=sourceDecisionRequestSchema.safeParse(input);if(!request.success)return {...common,status:'validation-failed',issues:request.error.issues.map(i=>({code:'SOURCE_REQUEST',path:'$.'+i.path.join('.'),reason:i.message}))};
 const parsed=parseDecisionSource(snapshot.excerpt,snapshot.textByteStart);if(parsed.status!=='ready')return {...common,status:'source-unsupported',issues:parsed.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
 const source=parsed.value,issues:SourceIssue[]=[],fieldChecks:Record<string,unknown>[]=[],inputChecks:Record<string,unknown>[]=[],add=(code:string,path:string,reason:string)=>issues.push({code,path,reason});
 const capabilities=new Set(source.facts.filter(f=>f.name).map(f=>f.name!)),actors=new Set(source.facts.filter(f=>f.actor).map(f=>f.actor!));
 let comparison:Record<string,unknown>={status:'not-requested'},computed:ReturnType<typeof decisionFacts>|undefined;
 const {view,mapping,claims=[],prose}=request.data;
 if(view!==undefined){
  const checked=validateEnvelope(view);if(!checked.ok)return finish({...common,status:'validation-failed',sourceDecision:source,issues:checked.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}});
  if(checked.value.component!=='DecisionExplorer')return {...common,status:'source-unsupported',issues:[{code:'SOURCE_COMPONENT',path:'$.view.component',reason:'decision-zh compares DecisionExplorer only.'}],comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
  const p:Decision=checked.value.payload;
  if(!mapping)add('SOURCE_MAPPING_REQUIRED','$.mapping','Explicit coordinates are required; source facts are not inferred from IDs or prose.');
  const ds=mapping?.dimensions??[],ins=mapping?.inputs??[];
  if(p.options.length!==2||new Set(p.options.map(o=>o.label)).size!==2||p.options.some(o=>!source.options.includes(o.label)))add('SOURCE_OPTIONS','$.view.payload.options','Use the two exact source labels, with arbitrary distinct IDs. Aliases and additional options are unsupported.');
  const seenD=new Set<string>(),seenI=new Set<string>();
  for(const [i,d] of ds.entries()){
   const field=p.dimensions.find(x=>x.id===d.id),path=`$.mapping.dimensions.${i}`;
   if(!field||seenD.has(d.id)||ds.filter(x=>concept(x)===concept(d)).length!==1){add('SOURCE_MAPPING',path,'Each real dimension and source concept must be bound once.');continue;}seenD.add(d.id);
   if(d.name&&!capabilities.has(d.name)||d.actor&&!actors.has(d.actor)){add('SOURCE_BINDING_UNKNOWN',path,'The named capability or actor is not present in this source.');continue;}
   if(!expectedLabels(d).includes(field.label))add('SOURCE_FIELD_LABEL',path,'The literal field label does not express the selected bounded source concept; no synonym or role guess was made.');
   if(d.kind==='price'?(field.kind!==undefined||field.unit!==undefined):(field.kind!=='boolean'||field.unit!==undefined))add('SOURCE_FIELD_TYPE',path,'Boolean facts are unitless; an unknown price does not establish a currency, billing period or numeric type.');
   const role=d.kind==='capability'?'capability-support':d.kind==='maintenance-need'?'resource-need':undefined;
   if(field.semanticRole!==undefined&&field.semanticRole!==role)add('SOURCE_ROLE',path,'The declared role conflicts with the source concept.');
   for(const [j,o] of p.options.entries())if(source.options.includes(o.label)){
    const expected=getFact(source,d.kind,o.label,d.name??null,d.actor??null),actual=o.values[d.id];
    fieldChecks.push({optionId:o.id,sourceOption:o.label,dimensionId:d.id,sourceKind:d.kind,expected:expected.value,actual,sourceDeclared:!!expected.spans.length,sourceSpans:expected.spans,status:actual!==expected.value?'mismatch':expected.value===null?(expected.derivation?'derived-unknown':expected.spans.length?'declared-unknown':'unknown'):'matched'});
    if(actual!==expected.value)add('SOURCE_VALUE',`$.view.payload.options.${j}.values.${d.id}`,'The value differs from the source. A missing fact remains null; a stated responsibility does not establish its opposite.');
   }
  }
  for(const d of p.dimensions)if(!seenD.has(d.id))add('SOURCE_MAPPING_MISSING','$.mapping.dimensions',`Dimension ${d.id} has no checked source coordinate.`);
  const neededDimensions=new Map<string,{kind:string;name?:string;actor?:string}>();
  for(const f of source.facts)if(['capability','actor-updates','maintenance-need','price'].includes(f.kind)){const c={kind:f.kind,...(f.name?{name:f.name}:{}),...(f.actor?{actor:f.actor}:{})};neededDimensions.set(concept(c),c);}
  for(const f of source.facts)if(f.kind==='capability-need'){const c={kind:'capability',name:f.name!};neededDimensions.set(concept(c),c);}
  for(const k of neededDimensions.keys())if(!ds.some(d=>concept(d)===k))add('SOURCE_FACT_MISSING','$.mapping.dimensions','A declared source column is absent from the comparison mapping.');
  for(const [i,b] of ins.entries()){
   const field=p.inputs.find(x=>x.id===b.id),path=`$.mapping.inputs.${i}`;
   if(!field||seenI.has(b.id)||ins.filter(x=>concept(x)===concept(b)).length!==1){add('SOURCE_MAPPING',path,'Each real input and source condition must be bound once.');continue;}seenI.add(b.id);
   if(b.name&&!capabilities.has(b.name)||b.actor&&!actors.has(b.actor)){add('SOURCE_BINDING_UNKNOWN',path,'Input refers to an unknown source capability or actor.');continue;}
   if(!expectedLabels(b).includes(field.label))add('SOURCE_FIELD_LABEL',path,'Input label does not match the explicit source role.');
   if(field.type!=='boolean'||field.unit!==undefined||field.choices!==undefined)add('SOURCE_FIELD_TYPE',path,'Only unitless boolean conditions are supported here.');
   const expected=getFact(source,b.kind,null,b.name??null,b.actor??null);
   inputChecks.push({inputId:field.id,sourceKind:b.kind,expected:expected.value,actual:field.initial,sourceDeclared:!!expected.spans.length,sourceSpans:expected.spans,...(expected.derivation?{sourceDerivation:expected.derivation}:{}),status:field.initial!==expected.value?'mismatch':expected.value===null?(expected.derivation?'derived-unknown':expected.spans.length?'declared-unknown':'unknown'):'matched'});
   if(field.initial!==expected.value)add('SOURCE_INITIAL',`$.view.payload.inputs.${p.inputs.indexOf(field)}.initial`,'Initial conditions must match the source; an unstated availability/need is null.');
   const role=b.kind==='capability-need'?'capability-need':'resource-available';if(field.semanticRole!==undefined&&field.semanticRole!==role)add('SOURCE_ROLE',path,'Input role contradicts the source condition.');
  }
  for(const i of p.inputs)if(!seenI.has(i.id))add('SOURCE_MAPPING_MISSING','$.mapping.inputs',`Input ${i.id} has no source condition binding.`);
  const neededInputs=[...source.facts.filter(f=>f.kind==='capability-need').map(f=>({kind:'capability-need',name:f.name!})),...source.facts.filter(f=>f.kind==='maintenance-need').map(f=>({kind:'actor-available',actor:f.actor!}))];
  for(const b of neededInputs)if(!ins.some(i=>concept(i)===concept(b)))add('SOURCE_CONDITION_MISSING','$.mapping.inputs','A source need or required actor availability is absent from the checked conditions.');
  for(const [i,r] of (p.requirements??[]).entries()){
   const d=ds.find(x=>x.id===r.dimension),b=ins.find(x=>x.id===r.input),path=`$.view.payload.requirements.${i}`;
   const valid=d&&b&&(d.kind==='capability'&&b.kind==='capability-need'&&d.name===b.name&&r.relation==='supports'||d.kind==='maintenance-need'&&b.kind==='actor-available'&&d.actor===b.actor&&r.relation==='requires-availability');
   if(!valid)add('SOURCE_REQUIREMENT_ROLE',path,'Source capability support pairs with need; an actor maintenance burden pairs with that actor availability via requires-availability.');
   if(d?.kind==='capability'&&!source.facts.some(f=>f.kind==='capability-need'&&f.name===d.name))add('SOURCE_NEED_NOT_DECLARED',path,'Capability support or preference does not itself establish a hard need.');
   if(d?.kind==='maintenance-need'&&!source.facts.some(f=>f.kind==='maintenance-need'&&f.actor===d.actor))add('SOURCE_BURDEN_NOT_DECLARED',path,'Actor availability or updating responsibility alone does not establish a maintenance burden.');
   if(r.when)add('SOURCE_CONDITION_UNSUPPORTED',path+'.when','Use the source-derived current need as a normal supports input; source two-branch conditions are normalized, not arbitrary component when policies.');
   if(d?.kind==='capability'&&source.facts.some(f=>f.kind==='preference'&&f.name===d.name)&&!source.facts.some(f=>f.kind==='capability-need'&&f.name===d.name))add('SOURCE_PREFERENCE_AS_REQUIREMENT',path,'A preference alone does not establish a hard capability need.');
  }
  for(const b of neededInputs){const i=ins.find(x=>concept(x)===concept(b)),d=ds.find(x=>b.kind==='capability-need'?x.kind==='capability'&&x.name===('name'in b?b.name:undefined):x.kind==='maintenance-need'&&x.actor===('actor'in b?b.actor:undefined));if(!i||!d||!(p.requirements??[]).some(r=>r.dimension===d.id&&r.input===i.id))add('SOURCE_REQUIREMENT_MISSING','$.view.payload.requirements','A declared need/burden condition lacks its corresponding requirement.');}
  for(const b of ins)if(!(p.requirements??[]).some(r=>r.input===b.id))add('SOURCE_INPUT_EFFECT','$.view.payload.inputs','A source-bound local condition has no checked requirement effect.');
  if(p.rules.length||p.constraints.length)add('SOURCE_POLICY_UNSUPPORTED','$.view.payload','This grammar supplies no recommendation policy or arbitrary exclusion rule. Source facts/needs do not authorize one.');
  comparison={status:issues.length?'mismatch':'matched',scope:'exact bounded source fields, original conditions and requirement direction; component prose is unverified'};
  if(!issues.length)computed=decisionFacts(p,usesReviewedPolicy(checked.value.protocolVersion));
 }else if(mapping)add('SOURCE_VIEW_REQUIRED','$.view','A mapping without a view cannot verify a generated comparison.');
 const claimChecks=claims.map((c,i)=>{
  if(!knownKinds.has(c.kind))return {index:i,kind:c.kind,status:'not-assessed',code:'SOURCE_CLAIM_UNSUPPORTED'};
  if(c.kind==='conditional-need'){
   const rule=source.conditionalNeeds?.find(r=>r.name===c.name&&r.condition===c.condition);
   return rule?{index:i,kind:c.kind,status:c.whenTrue===rule.whenTrue&&c.whenFalse===rule.whenFalse?'supported':'unsupported-by-source',expected:{whenTrue:rule.whenTrue,whenFalse:rule.whenFalse},sourceSpans:Object.values(rule.spans)}:{index:i,kind:c.kind,status:'not-assessed',code:'SOURCE_BINDING_UNKNOWN'};
  }
  if(c.option&&!source.options.includes(c.option)||c.name&&!(c.kind==='condition'?source.conditionalNeeds?.some(r=>r.condition===c.name):capabilities.has(c.name))||c.actor&&!actors.has(c.actor))return {index:i,kind:c.kind,status:'not-assessed',code:'SOURCE_BINDING_UNKNOWN'};
  const fact=getFact(source,c.kind as Kind,c.option??null,c.name??null,c.actor??null);
  return {index:i,kind:c.kind,status:c.value!==fact.value?'unsupported-by-source':fact.value===null?(fact.derivation?'derived-unknown':fact.spans.length?'declared-unknown':'unknown'):'supported',expected:fact.value,sourceSpans:fact.spans,...(fact.derivation?{sourceDerivation:fact.derivation}:{})};
 });
 const explain=!issues.length&&claimChecks.every(c=>['supported','declared-unknown','derived-unknown','unknown'].includes(c.status));
 return finish({...common,status:'compared',sourceDecision:source,comparison,issues,fieldChecks,inputChecks,claimChecks,...(computed?{computedDecision:computed}:{}),freeProse:{status:'not-verified',provided:prose!==undefined,characters:prose?.length??0},canonicalExplanation:explain?{status:'available',basis:'bounded parsed source declarations; not general natural-language certification',text:canonical(source)}:{status:'withheld',reason:'Resolve unsupported mappings, policies or source claims first.'}});
}
