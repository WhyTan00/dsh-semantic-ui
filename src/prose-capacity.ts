import {capacityDecision,checkSourceCapacity,type CapacitySource} from './source-capacity';
import {validCapacityAmount} from './capacity-domain';
import {decide} from './math';
import type {SourceSnapshot,SourceSpan} from './source-graph';
import type {ProseClaim,ProseEvidence,ProseStatus,Segment} from './prose';

type Time='current'|'future-possible'|'future-committed'|'hypothesis'|'unresolved';
interface Frame{time:Time;role:'demand'|null;amount:number|null;unit:string|null;sourcePointMatched:boolean;candidateSpan:{utf16Start:number;utf16End:number};text:string}
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const clean=(s:string)=>s.replace(/\*\*|`/g,'').replace(/^[\s\-#>*]+/u,'').trim();
const negatives='并非|不是|不会|没有|并未|不等于|不能|不';
const odd=(s:string)=>[...s.matchAll(new RegExp(negatives,'gu'))].length%2===1;
const inverse=(s:ProseStatus):ProseStatus=>s==='supported'?'contradicted':s==='contradicted'?'supported':s;
const quantities=()=>/([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([A-Za-z]{1,8})/gu;
const uncertainty=/未知|未提供|未声明|未确认|未承诺|尚未确认|尚未承诺|没有确认|不能确定|不能保证|不保证/u;
function clauses(text:string,names:string[]){const out:string[]=[];let start=0,i=0;while(i<text.length){const literal=names.find(n=>text.startsWith(n,i));if(literal){i+=literal.length;continue;}const d=text.slice(i).match(/^(?:[，,；;]|但是|然而|不过|并且|而且|而是|但|而|且)/u)?.[0];if(d){out.push(text.slice(start,i).trim());i+=d.length;start=i;}else i++;}out.push(text.slice(start).trim());return out.filter(Boolean);}

/** Finite temporal/quantity-role adapter; all numeric eligibility uses the existing capacity core. */
export function capacityProseClaims(source:CapacitySource,snapshot:SourceSnapshot,candidate:string,segments:Segment[]){
 const claims:ProseClaim[]=[],uncovered:{text:string;utf16Start:number;utf16End:number;reason:string}[]=[],seen=new Set<string>();
 const names=source.options.map(o=>o.label).sort((a,b)=>b.length-a.length),named=names.map(escape).join('|'),p=capacityDecision(source,{capacityDimensionId:'capacity',demandInputId:'demand',requirementId:'capacity'});
 const full:ProseEvidence={sourceTextSha256:snapshot.textSha256,path:'complete-capacity-source',spans:[{textByteStart:0,textByteEnd:snapshot.textBytes}],scope:'完整有限来源；不认证实际持有量、世界事实、身份或偏好政策'};
 const proof=(path:string,value:unknown,spans:SourceSpan[]=full.spans):ProseEvidence[]=>[{sourceTextSha256:snapshot.textSha256,path,value,spans,scope:'当前来源版本中的数量角色、时间与确定性；假设不更新来源'}];
 const currentProof=proof('source.current',source.current,source.current.spans),futureProof=proof('source.possibleFuture',source.possibleFuture,source.possibleFuture?.spans??full.spans);
 const revision=`来源当前所需量为${source.current.value}${source.current.unit}；${source.possibleFuture?'未来仅可能到'+source.possibleFuture.value+source.possibleFuture.unit:'未来可能需求点未声明'}，已确认未来计划未知。容量上限是可提供量，不是当前已拥有量，也不是需求。`;
 function typed(kind:string,fields:Record<string,unknown>,negated=false):ProseStatus{
  const r=checkSourceCapacity(snapshot,{claims:[{kind,...fields}]}),status=(r.claimChecks as {status:string}[]|undefined)?.[0]?.status;
  const mapped:ProseStatus=status==='supported'?'supported':status==='contradicted'?'contradicted':status==='unknown'?'supported':'unsupported';return negated?inverse(mapped):mapped;
 }
 let frame:Frame|undefined,previousEnd=0;
 for(const segment of segments){
  if(/\n\s*\n/u.test(candidate.slice(previousEnd,segment.start))||/^\s*[-*#>]\s/u.test(segment.text))frame=undefined;previousEnd=segment.end;
  const text=clean(segment.text);if(!text)continue;let found=false,anchored=false;
  const add=(kind:string,status:ProseStatus,reason:string,correction:string,evidence:ProseEvidence[],actual?:unknown,fragment=text)=>{
   const key=segment.start+'|'+kind+'|'+fragment+'|'+JSON.stringify(actual);if(seen.has(key))return;seen.add(key);found=true;
   claims.push({kind,quote:segment.quote??candidate.slice(segment.start,segment.end),extractedText:fragment,candidateSpan:{utf16Start:segment.start,utf16End:segment.end,...(segment.pointer?{jsonPointer:segment.pointer}:{})},status,reason,correction,evidence,...(actual===undefined?{}:{actual})});
  };
  if(text.length>1800){uncovered.push({text:segment.quote??segment.text,utf16Start:segment.start,utf16End:segment.end,reason:'超过有限容量正文片段长度。'});frame=undefined;continue;}
  for(const chunk of clauses(text,names)){
   const matches=[...chunk.matchAll(quantities())],span={utf16Start:segment.start,utf16End:segment.end},old=frame;
   const domainText=chunk.replace(new RegExp('(?:^|[^A-Za-z0-9_-])('+named+')(?=$|[^A-Za-z0-9_-])','gu'),(whole,label:string)=>whole.slice(0,whole.length-label.length)+'□');
   if(/安全|性能|延迟|合规|稳定|可用性|所有需求|全部需求|所有条件|整体需求/u.test(domainText)&&/需求|条件|满足|达标/u.test(domainText)){frame={time:'unresolved',role:null,amount:null,unit:null,sourcePointMatched:false,candidateSpan:span,text:chunk};anchored=true;add('capacity-noncapacity-requirement','unsupported','容量硬条件没有建立安全、性能、全部需求或整体适用性。','仅可核容量上限≥需求；其他维度与整体要求未建立。',[full],{requestedDomain:domainText},chunk);continue;}
   const conditional=/如果|假设|若(?:按|需求|需要)/u.test(chunk),negatedReserve=/(?:不|并非|不是|无需)按.{0,18}预留|不打算.{0,12}预留/u.test(chunk),assertedReserve=!conditional&&/(?:已|已经|确定|确认|决定).{0,24}(?:预留|扩容|升级)/u.test(chunk);
   const dated=/明年|后年|明天|后天|下周|下个月|\d{4}年|\d{4}-\d{2}-\d{2}/u.test(chunk);
   const explicitHypothesis=!negatedReserve&&!assertedReserve&&(conditional||/按.{0,18}(?:作|作为|预留|假设)|[A-Za-z]{1,8}\s*时/u.test(chunk)),current=/当前|现在|目前/u.test(chunk)&&!dated,future=/以后|未来|将来/u.test(chunk)||dated,anaphor=/届时|到时候|这个计划|该计划|这个阶段|该阶段|它|这个数值|该数值|此时/u.test(chunk);
   if(negatedReserve){frame={time:'unresolved',role:null,amount:null,unit:null,sourcePointMatched:false,candidateSpan:span,text:chunk};anchored=true;}
   else if(explicitHypothesis){frame={time:matches.length?'hypothesis':'unresolved',role:'demand',amount:null,unit:null,sourcePointMatched:false,candidateSpan:span,text:chunk};anchored=true;}
   else if(current){frame={time:'current',role:/需求|所需/u.test(chunk)||old?.role==='demand'?'demand':null,amount:source.current.value,unit:source.current.unit,sourcePointMatched:true,candidateSpan:span,text:chunk};anchored=true;}
   else if(future){frame={time:/可能|也许|或许|未必|不一定/u.test(chunk)?'future-possible':'future-committed',role:'demand',amount:null,unit:null,sourcePointMatched:false,candidateSpan:span,text:chunk};anchored=true;}
   else if(/^(?:如果|若|假设|当|一旦|在).+时/u.test(chunk)){frame={time:'unresolved',role:null,amount:null,unit:null,sourcePointMatched:false,candidateSpan:span,text:chunk};anchored=true;}
   else if(anaphor&&!old){frame={time:'unresolved',role:null,amount:null,unit:null,sourcePointMatched:false,candidateSpan:span,text:chunk};anchored=true;}
   for(const m of matches){
    const value=Number(m[1]),unit=m[2],before=chunk.slice(0,m.index),after=chunk.slice(m.index!+m[0].length),negated=/不可能/u.test(before)||odd(before.match(/(?:并非|不是|不等于)\s*$/u)?.[0]??'');
    const optionRefs=[...before.matchAll(new RegExp('(?:^|[^A-Za-z0-9_-])('+named+')(?=的|\\s|上限|容量|总容量|最大|现有|有|$)','gu'))],option=source.options.find(o=>o.label===optionRefs.at(-1)?.[1]);
    if((future||/届时|到时候/u.test(chunk))&&/有|拥有|具备|可提供|能提供|可用容量/u.test(before)&&!/需求|所需/u.test(before)&&!/^\s*(?:的)?需求/u.test(after)){add('capacity-future-provided','unsupported','来源的未来可能点是所需量，不是未来拥有或可提供的能力；相同数值也不能换角色。',revision,[...futureProof,...proof('source.confirmedFuturePlan',null)],{value,unit,role:'future-owned-or-provided'},chunk);if(frame)frame={...frame,role:null,amount:null,unit:null,sourcePointMatched:false};continue;}
    const ceiling=/上限|最大容量|总容量/u.test(before)||/^\s*(?:的)?上限/u.test(after);
    if(ceiling&&option){const index=source.options.indexOf(option),futureCapability=future||/届时|到时候/u.test(chunk);add('capacity-limit',futureCapability?'unsupported':typed('capacity-limit',{option:option.label,value,unit},negated),futureCapability?'当前声明的上限不保证未来能力持续或变化；来源没有未来方案容量承诺。':'核对可提供容量上限，不把它改成所需量或实际已持有量。',`${option.label}的来源容量上限为${option.ceiling.value}${option.ceiling.unit}；未来能力未承诺。`,proof('source.options.'+index+'.ceiling',option.ceiling,option.ceiling.spans),{option:option.label,value,unit,negated,futureCapability},chunk);continue;}
    if(assertedReserve||negatedReserve||/(?:当前|现在|目前).{0,8}(?:已有|拥有|具有|有)/u.test(before)||/已(?:预留|扩容|升级|拥有)/u.test(before)){add('capacity-owned-versus-demand','unsupported','来源给出当前需求和方案上限，没有给实际已拥有、已扩容、已预留或否定预留的政策。',revision,[...currentProof,...futureProof],{value,unit,role:'owned-or-committed-capacity'},chunk);continue;}
    const isDemand=/需求|所需/u.test(before)||/^[\s]*时/u.test(after)||frame?.role==='demand'&&/届时|到时候|这个数值|该数值|目前|当前|现在/u.test(chunk)||future&&/到/u.test(before)||explicitHypothesis;
    if(!isDemand)continue;
    if(!frame)frame={time:'unresolved',role:'demand',amount:null,unit:null,sourcePointMatched:false,candidateSpan:span,text:chunk};
    frame={...frame,role:'demand',amount:value,unit,candidateSpan:span,text:chunk};anchored=true;
    if(frame.time==='current')add('capacity-current-demand',typed('current-demand',{value,unit},negated),'当前需求只对照source.current；未来可能值不能填进当前字段。',revision,currentProof,{value,unit,negated,time:frame.time},chunk);
    else if(frame.time==='hypothesis'){const valid=validCapacityAmount(value)&&unit===source.current.unit;add('capacity-demand-hypothesis',valid?'supported-hypothesis':'unsupported','明确需求假设可参与本地容量求值，不修改当前需求或确认未来计划。',valid?`仅在需求假设${value}${unit}下比较容量；${revision}`:revision,[...currentProof,...futureProof],{value,unit,time:frame.time},chunk);}
    else if(frame.time==='future-possible'||frame.time==='future-committed'){
     const status=typed('possible-future-demand',{value,unit},negated),committed=frame.time==='future-committed';frame.sourcePointMatched=status==='supported'&&!negated&&source.possibleFuture!==null;
     add('capacity-future-demand',committed?'unsupported':status,committed?'来源只声明可能需求点，没有确认会发生、日期或未来计划。':'对照未来可能需求点；它不是现在已具备的容量或确认计划。',revision,[...futureProof,...proof('source.confirmedFuturePlan',null)],{value,unit,negated,time:frame.time},chunk);
    }else add('capacity-quantity-scope','unknown','数值的时间或数量角色未能明确绑定，不能默认为当前需求。',revision,[...currentProof,...futureProof],{value,unit,time:frame.time},chunk);
   }
   if(/(?:未来|以后|将来)(?:实际)?需求.{0,6}(?:未知|未定|未确认)|实际未来需求.{0,6}未知/u.test(chunk))add('capacity-actual-future-unknown','supported','可能需求点不是已确认的实际未来需求，后者仍未知。',revision,[...futureProof,...proof('source.confirmedFuturePlan',null)],{frame},chunk);
   if(current&&/需求.{0,6}(?:未知|未定|未确认)/u.test(chunk))add('capacity-current-demand-unknown',typed('current-demand',{value:null,unit:source.current.unit}),'来源已明确当前需求，不能把当前字段改为未知。',revision,currentProof,{frame},chunk);
   const planLanguage=/计划|承诺|扩容|预留|已确定|已确认|已经确定|已经确认|必然|一定|肯定|必定|将会|保证/u.test(chunk),futureContext=future||/这个计划|该计划/u.test(chunk)||anaphor&&!/价格|金额|费用|成本/u.test(chunk)&&(old?.time==='future-possible'||old?.time==='future-committed');
   if(planLanguage&&futureContext){const withheld=/计划(?:仍|尚)?未知|(?:未|尚未|没有)(?:确认|承诺)|不保证|不能保证|不能确定|不一定|未必/u.test(chunk),hyp=frame?.time==='hypothesis';if(!hyp){add('capacity-future-commitment',withheld?'supported':'unsupported','未承诺/未确认保持null；可能、否认计划和确定计划都不能互相代换。',revision,proof('source.confirmedFuturePlan',null),{withheld,frame},chunk);if(!withheld&&frame)frame={...frame,time:'future-committed'};}}
   if(/阶段.{0,14}(?:客观|必经|已确认|已确定|实际|必然|已经)|(?:客观|必经|已确认|已确定|必然).{0,8}阶段/u.test(chunk)&&!/假设|情景|容量条件/u.test(chunk))add('capacity-stage-promotion','unsupported','需求示例或可能点不是已确定的现实时间阶段；量值比较不能建立阶段或计划。','只描述当前需求与明确需求假设下的容量结果，未来阶段、日期和计划未建立。',[...currentProof,...futureProof,...proof('source.confirmedFuturePlan',null)],{frame},chunk);
   if(dated)add('capacity-future-date','unsupported','来源未给容量变化或声明的明确日期，不把未锚定的来源投射到指定日期。',revision,futureProof,{frame},chunk);
   const capacityWording=/容量|[0-9]\s*(?:MB|GB|TB|MiB|GiB|TiB)|需求/u.test(chunk),outcome=chunk.match(/(不(?:能|足以)?满足|不能满足|无法满足|不够用|不足|不达标|能满足|满足|够用|达标)/u);
   if(outcome&&capacityWording){
    const involved=names.filter(name=>new RegExp('(?:^|[^A-Za-z0-9_-])'+escape(name)+'(?=$|[^A-Za-z0-9_-])','u').test(chunk));
    const demand=frame?.time==='current'?source.current.value:frame?.time==='hypothesis'?frame.amount:frame?.time==='future-possible'&&frame.sourcePointMatched?source.possibleFuture?.value:undefined;
    const canCompute=demand!==undefined&&demand!==null&&validCapacityAmount(demand)&&(frame?.time==='current'||frame?.unit===source.current.unit),computed=canCompute?decide(p,{demand},true,false):undefined;
    const negative=odd(chunk.slice(Math.max(0,outcome.index!-8),outcome.index))!==/^(?:不|无法)/u.test(outcome[0]);
    for(const name of involved){const option=p.options.find(o=>o.label===name)!;const expected=computed?.eligibleOptionIds.includes(option.id),status:ProseStatus=!computed?'unknown':expected!==!negative?'contradicted':frame?.time==='current'?'supported':'supported-hypothesis';
     add('capacity-eligibility',status,computed?'仅用同一decide核心核容量上限≥所需量，不推出整体可用或优选。':'时间/需求前提未确认或无法绑定，不能沿用前一个容量场景。',computed?`在${frame?.time==='current'?'原始当前需求':'明确局部需求假设'}${demand}${source.current.unit}下，${name}仅容量${expected?'满足':'不足'}；不代表整体推荐。`:revision,[...proof('view.requirements.capacity',p.requirements),...currentProof,...futureProof],{option:name,expected:expected??null,positive:!negative,frame,evaluatedDemand:demand??null},chunk);
    }
   }
   for(const option of source.options){
    const name=escape(option.label);for(const field of ['deployment','maintenance'] as const){const label=field==='deployment'?'部署':'维护',m=chunk.match(new RegExp('(?:^|[^A-Za-z0-9_-])'+name+'.{0,10}'+label+'(?:是|为)?(简单|复杂|未知)','u'));if(m){const value=m[1]==='简单'?'simple':m[1]==='复杂'?'complex':null,index=source.options.indexOf(option);add('capacity-'+field,typed(field,{option:option.label,value}),'部署与维护分别核对，不从其中一项推出另一项、价格或资源。',`${option.label}${label}：${option[field].value==='simple'?'简单':option[field].value==='complex'?'复杂':'未声明'}。`,proof('source.options.'+index+'.'+field,option[field],option[field].spans),{option:option.label,value},chunk);}}
   }
   const noRanking=/不等于整体|不代表整体|不能.{0,12}(?:整体|推荐|更合适|更适合|最优)|不(?:应|能|要)推荐|整体.{0,8}未知/u.test(chunk);
   if(noRanking)add('capacity-no-overall-ranking','supported','容量条件只确定容量是否达标，源没有整体偏好政策。','容量达标不建立整体推荐。',[full],{frame},chunk);
   else if(/整体|最优|更合适|更适合|推荐|优先|只剩.{0,12}可行|只有.{0,12}可选|必须承受/u.test(chunk))add('capacity-overall-choice','unsupported','容量达标不能推出整体可行、唯一选择、必须承受的成本或最优政策。','只报告当前或明确需求假设下的容量条件；价格、迁移、偏好与整体适用性仍未建立。',[full,...currentProof,...futureProof],{frame},chunk);
   if(/价格|迁移代价|维护成本|必须承受|更贵|更便宜/u.test(chunk)){const withheld=/(?:价格|迁移代价|维护成本|费用)(?:等)?(?:仍|尚)?(?:未知|未提供|未声明)|(?:没有给出|未提供|未声明).{0,10}(?:价格|迁移代价|维护成本|费用)/u.test(chunk)||/多大|多少|是否/u.test(chunk)&&/条件.{0,8}(?:没有给出|未提供|未知)/u.test(text);add('capacity-cost-policy',withheld?'supported':/多大|多少|是否/u.test(chunk)?'unknown':'unsupported','来源没有价格、迁移成本或由维护复杂推定的必付成本政策。','费用、迁移代价和整体取舍未知；维护复杂只属于单独来源属性。',[full],{withheld},chunk);}
   if(/设置.{0,20}预留|控件.{0,20}预留|拖到|探索器/u.test(chunk))add('capacity-host-control','unsupported','来源数量不证明宿主存在某控件，或某控件实现了预留政策。','既有来源只核容量事实；本地需求假设不确认预留或更新原始来源。',[full],{frame},chunk);
  }
  if(!found){uncovered.push({text:segment.quote??segment.text,utf16Start:segment.start,utf16End:segment.end,reason:'未进入有限容量时间/数量角色正文合同。'});if(!anchored)frame=undefined;}
  if(claims.length>96||uncovered.length>128)return {claims:[],uncovered:[],refused:true};
 }
 return {claims,uncovered,refused:false};
}
