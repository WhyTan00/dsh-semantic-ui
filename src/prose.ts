import * as core from './core';
import {sourceReferenceFromSnapshot} from './source-reference.mjs';
import {decide,numericStats} from './math';
import {countValue} from './source-numeric';
import {workflowProseClaims} from './prose-workflow';
import type {WorkflowSource} from './source-workflow';
import {capacityProseClaims} from './prose-capacity';
import type {CapacitySource} from './source-capacity';
import type {SourceSnapshot,SourceSpan} from './source-graph';
import type {DecisionSource,DecisionSourceFact} from './source-decision';
import type {Decision} from './protocol';

export const PROSE_VERSION=1;
export type ProseStatus='supported'|'supported-hypothesis'|'contradicted'|'unsupported'|'unknown';
export interface ProseEvidence{sourceTextSha256:string;path:string;spans:SourceSpan[];value?:unknown;scope:string}
export interface ProseClaim{kind:string;quote:string;extractedText?:string;candidateSpan:{utf16Start:number;utf16End:number;jsonPointer?:string};status:ProseStatus;reason:string;correction:string;evidence:ProseEvidence[];expected?:unknown;actual?:unknown;counterexample?:unknown}
export interface ProseReview{version:1;status:'reviewed'|'refused'|'source-unsupported';sourceTextSha256:string;candidateSha256:string;sourceKind?:string;originalCandidate:string;claims:ProseClaim[];uncovered:{text:string;utf16Start:number;utf16End:number;reason:string}[];groundedText:string;sourceExplanation:string;coverage:'finite-chinese-assertions-only';wholeCandidateVerified:false;identityVerified:false;worldFactsVerified:false;newModelCalls:0;reason?:string}
const bytes=(s:string)=>new TextEncoder().encode(s),hash=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(s)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const normalize=(s:string)=>s.replace(/\*\*|`/g,'').replace(/[−–]/g,'-').replace(/\s+/g,' ').trim();
const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const empty=(sourceSha:string,candidateSha:string,candidate:string):ProseReview=>({version:1,status:'reviewed',sourceTextSha256:sourceSha,candidateSha256:candidateSha,originalCandidate:candidate,claims:[],uncovered:[],groundedText:'',sourceExplanation:'',coverage:'finite-chinese-assertions-only',wholeCandidateVerified:false,identityVerified:false,worldFactsVerified:false,newModelCalls:0});
export interface Segment{text:string;start:number;end:number;pointer?:string;quote?:string}
/** Locations in already parsed JSON; retain original escaped tokens and repeated-value identity. */
function jsonLocations(text:string){
 let i=0;const locations=new Map<string,{start:number;end:number}>(),space=()=>{while(/\s/u.test(text[i]??'')&&i<text.length)i++;};
 function string(){const start=i++;while(i<text.length){const c=text[i++];if(c==='\\'){i++;continue;}if(c==='"')return JSON.parse(text.slice(start,i)) as string;}throw Error('JSON_LOCATION');}
 function value(path:string,depth:number){
  if(depth>32)throw Error('JSON_DEPTH');space();const start=i,c=text[i];
  if(c==='"')string();
  else if(c==='{'||c==='['){const object=c==='{',close=object?'}':']';i++;space();let index=0;
   while(text[i]!==close){let key=String(index++);if(object){key=string();space();if(text[i++]!==':')throw Error('JSON_LOCATION');}
    value(path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'),depth+1);space();if(text[i]===close)break;if(text[i++]!==',')throw Error('JSON_LOCATION');space();
   }i++;
  }else{while(i<text.length&&!/[\s,\]}]/u.test(text[i]))i++;if(i===start)throw Error('JSON_LOCATION');}
  locations.set(path,{start,end:i});
 }value('',0);return locations;
}
function segments(candidate:string):Segment[]{
 const result:Segment[]=[];
 for(const m of candidate.matchAll(/[^。！？\n]+[。！？]?/gu))if(m[0].trim())result.push({text:m[0],start:m.index!,end:m.index!+m[0].length});
 // Extract data strings and key/value labels from candidate JSON without executing its renderer.
 for(const block of candidate.matchAll(/```(?:dsh-ui|json)\s*([\s\S]*?)```/gu)){
  let data:unknown,locations:ReturnType<typeof jsonLocations>;try{data=JSON.parse(block[1]);locations=jsonLocations(block[1]);}catch{continue;}
  const base=block.index!+block[0].indexOf(block[1]);
  const record=(text:string,pointer:string)=>{const at=locations.get(pointer);if(at)result.push({text,pointer,start:base+at.start,end:base+at.end,quote:candidate.slice(base+at.start,base+at.end)});};
  const walk=(v:unknown,pointer:string,depth:number)=>{if(depth>8||result.length>160)return;if(!v||typeof v!=='object')return;
   if(!Array.isArray(v)){const x=v as Record<string,unknown>;if(typeof x.key==='string'&&typeof x.value==='string')record(x.key+'：'+x.value,pointer);else if(typeof x.content==='string')record(x.content,pointer+'/content');}
   for(const[k,x]of Object.entries(v).slice(0,80))if(x&&typeof x==='object')walk(x,pointer+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1'),depth+1);
  };walk(data,'',0);
 }
 return result;
}
const boolWord=(v:boolean|null)=>v===null?'未知':v?'是':'否';
/** Source-only facts and existing evaluators constrain the candidate; the visible chart is never evidence. */
export async function reviewProse(sourceText:string,candidate:string):Promise<ProseReview>{
 const sourceSha=await hash(sourceText),candidateSha=await hash(candidate),report=empty(sourceSha,candidateSha,candidate);
 if(!sourceText.trim()||bytes(sourceText).length>16384||!candidate.trim()||bytes(candidate).length>24000){return {...report,status:'refused',reason:'来源或候选为空/超过有限输入限制，未进行部分批准。'};}
 const snapshot:SourceSnapshot={documentSha256:sourceSha,textSha256:sourceSha,excerptSha256:sourceSha,jsonPointer:null,excerpt:sourceText,textBytes:bytes(sourceText).length,textByteStart:0,textByteEnd:bytes(sourceText).length};
 const ref=sourceReferenceFromSnapshot(core,snapshot);
 if(ref.status!=='ready'||!['decision-zh','observations-zh','workflow-zh','capacity-zh'].includes(ref.kind)){return {...report,status:'source-unsupported',reason:'当前正文断言合同支持完整的有限容量、工作流、两方案条件来源与逐项读数来源；没有用现有图表替代来源。'};}
 report.sourceKind=ref.kind;const canonical=ref.comparison.canonicalExplanation as {status?:string;text?:string};
 if(canonical?.status!=='available'||!canonical.text)return {...report,status:'refused',reason:'来源的完整有限说明不可用，没有补造正文。'};
 report.sourceExplanation=canonical.text;
 if(ref.kind==='workflow-zh'||ref.kind==='capacity-zh'){
  const workflow=ref.kind==='workflow-zh'?workflowProseClaims(ref.parsedSource as WorkflowSource,{...snapshot,kind:'workflow-zh'},candidate,segments(candidate)):capacityProseClaims(ref.parsedSource as CapacitySource,{...snapshot,kind:'capacity-zh'},candidate,segments(candidate));
  if(workflow.refused)return {...report,status:'refused',reason:'工作流断言或未覆盖片段超过有限限制，未返回部分批准。'};
  report.claims=workflow.claims;report.uncovered=workflow.uncovered;
  const hypotheses=workflow.claims.filter(c=>c.status==='supported-hypothesis').map(c=>c.correction);
  const changes=workflow.claims.filter(c=>c.status==='contradicted'||c.status==='unsupported'||c.status==='unknown').map(c=>c.correction);
  report.groundedText=[canonical.text,...new Set(hypotheses),...(changes.length?['候选中以下说法已被排除或限定：',...new Set(changes)]:[])].join('\n');return report;
 }
 const whole:ProseEvidence={sourceTextSha256:sourceSha,path:'complete-selected-source',spans:[{textByteStart:0,textByteEnd:bytes(sourceText).length}],scope:'完整有限来源；没有独立作者或现实事实认证'};
 const parsed=ref.parsedSource as DecisionSource;
 const factEvidence=(predicate:(f:DecisionSourceFact)=>boolean):ProseEvidence[]=>{const matches=(parsed.facts??[]).map((f,i)=>({f,i})).filter(x=>predicate(x.f));return matches.length?matches.map(({f,i})=>({sourceTextSha256:sourceSha,path:'source.facts.'+i,spans:f.spans,value:f.value,scope:f.kind})): [{...whole,path:'source.facts.absent',value:null,scope:'完整来源未声明，不能自动取反或补值'}];};
 const seen=new Set<string>();
 for(const segment of segments(candidate)){
  const text=normalize(segment.text);if(!text)continue;
  if(text.length>1800){report.uncovered.push({text:segment.text,utf16Start:segment.start,utf16End:segment.end,reason:'片段超过有限断言长度，未核对。'});continue;}
  let found=false;
  const add=(kind:string,status:ProseStatus,reason:string,correction:string,evidence:ProseEvidence[],extra:Partial<ProseClaim>={})=>{const key=kind+'|'+segment.start+'|'+text+'|'+status;if(seen.has(key))return;seen.add(key);found=true;report.claims.push({kind,quote:segment.quote??segment.text,...(segment.quote?{extractedText:segment.text}:{}),candidateSpan:{utf16Start:segment.start,utf16End:segment.end,...(segment.pointer?{jsonPointer:segment.pointer}:{})},status,reason,correction,evidence,...extra});};
  if(ref.kind==='decision-zh'&&ref.request.view.component==='DecisionExplorer'){
   const p=ref.request.view.payload,values=Object.fromEntries(p.inputs.map(i=>[i.id,i.initial])),hypotheses:string[]=[];
   const actorInput=p.inputs.find(i=>i.semanticRole==='resource-available');
   const actor=(ref.request.mapping as {inputs:{id:string;actor?:string}[]}).inputs.find(i=>i.id===actorInput?.id)?.actor;
   if(actorInput&&actor&&/如果|假设|若|当/u.test(text)){
    const m=text.match(new RegExp(escape(actor)+'(?:目前|当前|现在)?(没有|无|有)(?:足够的?|可用的?)?(?:维护)?(?:余力|能力)','u'));
    if(m){values[actorInput.id]=m[1]==='有';hypotheses.push(actor+'维护余力='+boolWord(values[actorInput.id] as boolean));}
   }
   const computed=decide(p,values,true,false),hypothesis=hypotheses.length>0;
   const rules:ProseEvidence[]=[whole,...(p.requirements??[]).map(r=>({sourceTextSha256:sourceSha,path:'view.requirements.'+r.id,spans:[],value:r,scope:'既有条件/资源求值；假设不改来源'}))];
   for(const input of p.inputs.filter(i=>i.semanticRole==='capability-need')){
    const binding=(ref.request.mapping as {inputs:{id:string;name?:string}[]}).inputs.find(x=>x.id===input.id),name=binding?.name;if(!name)continue;
    const m=text.match(new RegExp('(不需要|无需|需要)'+escape(name),'u'));
    if(m&&!/是否|需不需要/u.test(text)){const actual=m[1]==='需要',expected=input.initial as boolean|null;add('current-capability-need',expected===null?'unsupported':actual===expected?'supported':'contradicted','对照来源当前需要，而非方案是否支持该能力。','当前需要'+name+'='+boolWord(expected)+'。',factEvidence(f=>f.kind==='capability-need'&&f.name===name),{expected,actual});}
   }
   if(actor&&new RegExp(escape(actor)+'.{0,16}(?:维护余力|维护能力).{0,12}(?:未知|未声明|未确定)','u').test(text)){
    const f=parsed.facts.find(f=>f.kind==='actor-available'&&f.actor===actor),expected=f?.value??null;add('resource-availability-unknown',expected===null?'supported':'contradicted','未声明资源能力保持未知。',actor+'维护余力='+boolWord(expected)+'。',factEvidence(f=>f.kind==='actor-available'&&f.actor===actor),{expected,actual:null});
   }
   if(/价格.{0,10}(?:未知|未提供|未声明)|费用.{0,10}(?:未知|未提供|未声明)/u.test(text))add('unknown-price','supported','有限来源只提供未知价格，没有币种/周期或排序。','价格、币种、计费周期与成本排序均未建立。',factEvidence(f=>f.kind==='price'));
   if(/月费用|月费|每月|每年|每小时|元\/|人民币|美元|CNY|USD/u.test(text))add('price-period','unsupported','来源没有给计费周期或币种；不能从价格未知补成月费用。','只可说两方案价格未知；不要指定币种、月费或排序。',factEvidence(f=>f.kind==='price'));
   const noRecommendation=/不(?:产生|给出|做出)(?:任何|整体)?推荐|不宜先做选择|暂不推荐任何|没有.{0,12}依据.{0,8}推荐/u.test(text);
   if(noRecommendation)add('withheld-recommendation','supported','来源没有可核整体偏好政策，保留不作推荐。','当前不建立整体推荐。',rules);
   for(const option of p.options){
    const name=escape(option.label);
    if(!noRecommendation&&!/(?:不|勿|别)(?:应|要)?推荐|是否推荐|推荐.{0,40}[吗？?]/u.test(text)&&new RegExp('(?:推荐|建议|应该|应当|应优先|优先选择|更适合)(?:优先|直接|选择|采用|用|选)?\\s*'+name,'u').test(text))add('overall-recommendation','unsupported','可行性不等于优选；当前来源未给支持该整体推荐的成本/偏好政策。','可以核对硬性条件与未知项，不能据此推荐'+option.label+'。',rules,{actual:option.label,expected:'no grounded overall recommendation'});
    const maintenance=text.match(new RegExp(name+'.{0,8}(不需要|无需|不用|需要|必须)(?:由)?'+(actor?escape(actor):'[^，。]{1,8}')+'维护','u'));
    if(maintenance){const actual=['需要','必须'].includes(maintenance[1]),f=parsed.facts.find(f=>f.kind==='maintenance-need'&&f.option===option.label),expected=f?.value??null;add('maintenance-need',expected===null?'unsupported':actual===expected?'supported':'contradicted','更新责任不能被偷换成团队维护需求。',option.label+'需要'+(actor??'指定主体')+'维护='+boolWord(expected)+'。',factEvidence(f=>f.kind==='maintenance-need'&&f.option===option.label),{actual,expected});}
    const feasible=text.match(new RegExp(name+'(?:仍|当前|目前|已经|也)?(?:是)?(不可行|不满足(?:当前)?(?:需求|条件)?|被排除|可行|满足(?:当前)?(?:需求|条件))','u'));
    if(feasible){const expected=computed.eligibleOptionIds.includes(option.id)?true:computed.excludedOptionIds.includes(option.id)?false:null,actual=!/不可行|不满足|被排除/u.test(feasible[1]),status=expected===null?'unsupported':actual===expected?(hypothesis?'supported-hypothesis':'supported'):'contradicted';add('hard-feasibility',status,'复用decide求值，只判断已声明硬条件；未知不等于否。',(hypothesis?'在明确假设“'+hypotheses.join('，')+'”下，':'按原始来源条件，')+option.label+'可行性='+boolWord(expected)+'；不代表整体优选。',rules,{expected,actual});}
   }
   if(/两者|两边|两个方案/u.test(text)&&/可行性.{0,8}(?:未确定|未知|待确认)/u.test(text)){const allUnknown=computed.unknownFeasibilityIds.length===p.options.length;add('all-feasibility-unknown',allUnknown?'supported':'contradicted','两者状态由同一资源/能力条件核心计算。','当前待确认方案：'+(p.options.filter(o=>computed.unknownFeasibilityIds.includes(o.id)).map(o=>o.label).join('、')||'无')+'。',rules,{expected:allUnknown});}
  }
  if(ref.kind==='observations-zh'){
   const source=ref.parsedSource as {positions:{index:number;value:number|null;span:SourceSpan}[];unit:string},values=source.positions.map(p=>p.value),observed=numericStats(values),missing=values.filter(v=>v===null).length,total=values.length,complete=missing?null:observed.mean,zero=numericStats(values.map(v=>v??0));
   const evidence:ProseEvidence[]=[{sourceTextSha256:sourceSha,path:'source.positions',spans:source.positions.map(p=>p.span),value:values,scope:'原始顺序、实测值和null掩码'}, {sourceTextSha256:sourceSha,path:'numericStats.observed',spans:source.positions.filter(p=>p.value!==null).map(p=>p.span),value:observed,scope:'已观测范围；复用numericStats'}];
   const revision='已观测'+observed.n+'个读数的均值为'+(observed.mean??'未知')+' '+source.unit+'；完整'+total+'个位置含'+missing+'个缺失，均值'+(complete===null?'未知':complete+' '+source.unit)+'。';
   const imputation=/(?:零填充|补零|缺失.{0,18}(?:填|补|当作|视为).{0,10}(?:0|零))/u.test(text);
   if(/中位数.{0,12}(?:不受影响|不会改变|不变)/u.test(text))add('unsupported-median','unsupported','当前合同没有核对该中位数/缺失范围断言。',revision+'中位数的额外断言不进入有据说明。',evidence);
   if(/告警.{0,12}(?:消失|一定|必然)|报警.{0,12}(?:消失|一定|必然)/u.test(text))add('unsupported-alarm-causality','unsupported','来源没有给告警规则或因果机制。','告警行为取决于另行声明的规则；当前不能判断。',evidence);
   if(/缺失.{0,16}(?:无论|任意|不管).{0,20}(?:填|补)|(?:无论|任意|不管).{0,12}(?:填|补).{0,30}(?:都会|一定|必然).{0,12}改变/u.test(text)&&/均值|平均/u.test(text)){
    const fill=observed.mean,witness=fill===null?null:numericStats(values.map(v=>v??fill));const same=missing>0&&fill!==null&&witness?.mean!==null&&Math.abs(witness!.mean!-fill)<=1e-12*Math.max(1,Math.abs(fill)),negated=/并非|不是说|不能说/u.test(text);add('universal-fill-changes-mean',same?(negated?'supported':'contradicted'):'unknown','量词“无论填什么都会改变”必须经反例核对，不能由正确观测均值背书。',same?'反例：把缺失明确假设为'+fill+' '+source.unit+'，填后均值仍为'+witness!.mean+' '+source.unit+'。这不是实际观测；完整真实均值仍未知。':revision,evidence,{counterexample:same?{fillValue:fill,imputedMean:witness!.mean,observedMean:observed.mean}:null});
   }
   const direction=text.match(/均值.{0,12}(?:一定|必然|总会|会被)(?:被)?(拉低|降低|下降)/u);
   if(direction){const lowers=zero.mean!==null&&observed.mean!==null&&zero.mean<observed.mean;add('zero-fill-mean-direction',!imputation?'unknown':lowers?'supported-hypothesis':'contradicted','只对当前提供的数据及显式补零假设比较，不对未知完整均值作方向结论。','当前补零假设均值='+zero.mean+'，已观测均值='+observed.mean+'；完整真实均值'+(complete===null?'未知':complete)+'。',evidence,{expected:lowers,actual:'lower'});}
   if(/缺失(?:读数|值|位置)?(?:就)?(?:不等于|不是|等于|是)(?:实测)?(?:0|零)/u.test(text)){const correct=/不等于|不是/u.test(text);add('missing-versus-zero',correct?'supported':'contradicted','源位置的null与实测0是不同状态。','缺失保留未知，实测0只对应实际零读数的位置。',evidence,{expected:'null distinct from observed zero'});}
   const counts=[...text.matchAll(/([1-9]\d{0,2}|[一二三四五六七八九十]{1,3})(?:次|个)(?:温度|有效|已观测)?(?:读数|观测|位置)?/gu)].map(m=>countValue(m[1]));
   const hasMean=/均值|平均值|平均数/u.test(text),observedScope=/已观测|观测值|观测到|有效读数|有效观测/u.test(text),wholeScope=(/完整|全部|所有/u.test(text)||counts.includes(total))&&!/(?:不是|并非|不等于).{0,5}(?:全部|完整)/u.test(text),unknown=/未知|无法确定|不能确定|算不出来|不能算出/u.test(text);
   if(hasMean&&wholeScope&&!observedScope&&unknown){add('complete-mean-unknown',complete===null?'supported':'contradicted','完整范围是否可计算由缺失掩码决定。',revision,evidence,{expected:complete,actual:null});}
   const mean=text.match(new RegExp('(?:均值|平均值|平均数)(?:\\s*(不等于|不是|不为|为|是|=|:|：|等于|约为|约))?\\s*('+number+')','u'));
   const reverse=!mean?text.match(new RegExp('('+number+')\\s*(?:摄氏度|°C|℃|'+escape(source.unit)+')?.{0,14}(?:已观测|观测值).{0,12}(?:均值|平均值)','u')):null;
   if(mean||reverse){const actual=Number(mean?mean[2]:reverse![1]),negated=!!mean&&/不等于|不是|不为/u.test(mean[1]??''),scope=imputation?'hypothesis':observedScope||reverse?'observed':wholeScope?'complete':'ambiguous',expected=scope==='hypothesis'?zero.mean:scope==='observed'?observed.mean:scope==='complete'?complete:undefined;
    const denominator=scope==='observed'?observed.n:scope==='complete'||scope==='hypothesis'?total:undefined;
    const countMismatch=counts.length>0&&denominator!==undefined&&counts.some(n=>n!==denominator);
    const numericMatch=mean??reverse!,numberText=mean?mean[2]:reverse![1],tail=text.slice(numericMatch.index!+numericMatch[0].indexOf(numberText)+numberText.length);
    const declaredUnit=tail.match(new RegExp('^\\s*('+escape(source.unit)+'|摄氏度|华氏度|开尔文|千帕|伏特|安培|厘米|毫米|千米|千克|毫克|秒|米|克|℃|℉|°[CF]|[A-Za-zµμ%]+)(?=[，,；;。\\s]|$|的|但|而|并|不)','u'))?.[1]??(!/^\s*[的但而并不]/u.test(tail)?tail.match(/^\s*([\p{L}°%℃℉µμ]{1,24})(?=[，,；;。\s]|$)/u)?.[1]:undefined);
    const unitKey=(unit:string)=>['摄氏度','°C','℃'].includes(unit)?'celsius':unit;
    const unitMismatch=declaredUnit!==undefined&&unitKey(declaredUnit)!==unitKey(source.unit);
    if(countMismatch)add('mean-denominator','contradicted','候选声明的分母与该统计范围不一致，均值碰巧相同也不能通过。',revision,evidence,{expected:denominator,actual:counts});
    if(unitMismatch)add('mean-unit','contradicted','单位必须与来源相同；未进行温标或单位转换。',revision,evidence,{expected:source.unit,actual:declaredUnit});
    const approx=!!mean&&/约/u.test(mean[1]??''),digits=(String(numberText).split('.')[1]??'').length,normalizedExpected=typeof expected==='number'&&approx?Number(expected.toFixed(Math.min(digits,10))):expected,match=typeof normalizedExpected==='number'&&(negated?normalizedExpected!==actual:normalizedExpected===actual);const status:ProseStatus=countMismatch||unitMismatch?'contradicted':expected===undefined?'unknown':expected===null?'unsupported':match?(scope==='hypothesis'?'supported-hypothesis':'supported'):'contradicted';
    add('mean-value',status,scope==='ambiguous'?'候选没有明确统计范围，不能默认为已观测或完整。':scope==='hypothesis'?'补零只作为显式假设；原始读数与完整真实范围不变。':'逐项读数、单位和分母限定该均值。',scope==='hypothesis'?'在明确补零假设下，'+total+'个位置的均值为'+zero.mean+' '+source.unit+'；完整真实均值仍'+(complete===null?'未知':complete)+'。':revision,evidence,{expected:expected??null,actual:{value:actual,negated,scope}});
   }
   if(imputation&&/(?:必须|应该|应当|一律).{0,8}(?:补|填)/u.test(text))add('imputation-policy','unsupported','数值可计算不代表来源授权了补值政策。','可以单列补零假设，不能把缺失改称实际观测或强制补值。',evidence);
  }
  if(!found&&!segment.pointer&&!/^\s*```|^\s*[{}\[\]]/u.test(text))report.uncovered.push({text:segment.text,utf16Start:segment.start,utf16End:segment.end,reason:'不在已实现的有限断言语法内；原文保留，不进入有据修订。'});
  if(report.claims.length>96||report.uncovered.length>128)return {...empty(sourceSha,candidateSha,candidate),status:'refused',reason:'断言/未覆盖片段超过有界限制，没有部分全文批准。'};
 }
 const hypotheses=report.claims.filter(c=>c.status==='supported-hypothesis').map(c=>c.correction),corrections=report.claims.filter(c=>c.status==='contradicted'||c.status==='unsupported').map(c=>c.correction);
 report.groundedText=[canonical.text,...new Set(hypotheses),...(corrections.length?['候选中以下说法已被排除或限定：',...new Set(corrections)]:[])].join('\n');
 return report;
}
