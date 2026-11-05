import {checkSourceWorkflow,type WorkflowSource} from './source-workflow';
import type {SourceSnapshot,SourceSpan} from './source-graph';
import type {ProseClaim,ProseEvidence,ProseStatus,Segment} from './prose';

interface Condition{trigger?:string;event:'failure'|'not-failure'|'ambiguous';necessary:boolean;global:boolean;candidateSpan:{utf16Start:number;utf16End:number};text:string}
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const clean=(s:string)=>s.replace(/\*\*|`/g,'').replace(/^[\s\-#>*]+/u,'').trim();
const unknownWords=/未知|未声明|未说明|尚未说明|未给出|未规定|不能(?:保证|确定|推断|断言)|无法(?:确定|保证|推断)|不保证|不能说/u;
const inverse=(s:ProseStatus):ProseStatus=>s==='supported'?'contradicted':s==='contradicted'?'supported':s;
const negatives='并非|不是|不会|没有|并未|无需|无须|不需|不得|不应|不要|不必|不能|未|不';
const negativePrefix='((?:(?:'+negatives+')(?:会|需要)?)*)';
const oddNegation=(s:string)=>[...s.matchAll(new RegExp(negatives,'gu'))].length%2===1;
function clauses(text:string,names:string[]){
 const chunks:string[]=[];let start=0,i=0;
 while(i<text.length){const literal=names.find(n=>text.startsWith(n,i));if(literal){i+=literal.length;continue;}
  const delimiter=text.slice(i).match(/^(?:[，,；;]|但是|然而|不过|并且|而且|而是|但|而|且)/u)?.[0];
  if(delimiter){chunks.push(text.slice(start,i).trim());i+=delimiter.length;start=i;}else i++;
 }chunks.push(text.slice(start).trim());return chunks.filter(Boolean);
}
function actionTargets(body:string,names:string[],whole:string[]){
 let rest=body.trim().replace(/^[“‘「"']/u,'');const targets:string[]=[];
 const global=rest.match(/^(?:整个流程|全流程|全部流程|所有(?:节点|步骤))/u);
 if(global){targets.push(...whole);rest=rest.slice(global[0].length);}
 while(!global){const node=names.find(n=>rest.startsWith(n));if(!node)return {targets,unresolved:true};targets.push(node);rest=rest.slice(node.length).replace(/^[”’」"']/u,'');
  const join=rest.match(/^(?:以及|和|与|及|、)/u);if(!join)break;rest=rest.slice(join[0].length).trim();if(!rest)break;
 }
 const suffix=/^(?:自身|本身|这个节点|该节点|这一步|即可|就好|[0-9一二三四五六七八九十]+次|无限次?|直到成功)?[。！？!?\s]*$/u;
 return {targets:[...new Set(targets)],unresolved:!suffix.test(rest)};
}

/** A finite discourse adapter to the existing workflow checker, never a runtime/causality model. */
export function workflowProseClaims(source:WorkflowSource,snapshot:SourceSnapshot,candidate:string,segments:Segment[]){
 const claims:ProseClaim[]=[],uncovered:{text:string;utf16Start:number;utf16End:number;reason:string}[]=[],seen=new Set<string>();
 const names=[...source.nodes].sort((a,b)=>b.length-a.length),named=names.map(escape).join('|');
 const allSpans:SourceSpan[]=[{textByteStart:0,textByteEnd:snapshot.textBytes}];
 let condition:Condition|undefined,previousEnd=0,subject:string|undefined;
 function evidence(trigger?:string):ProseEvidence[]{
  const index=source.failurePolicies.findIndex(p=>p.trigger===trigger),policy=source.failurePolicies[index];
  return [{sourceTextSha256:snapshot.textSha256,path:index<0?'source.failurePolicies.absent':'source.failurePolicies.'+index,spans:policy?[...policy.triggerSpans,...policy.retrySpans,...policy.noRollbackSpans]:allSpans,value:policy?{trigger:policy.trigger,retryOnly:policy.retryOnly,noRollback:policy.noRollback}:null,scope:policy?'仅此明确失败触发分支；不推正常路径或全局策略':'完整来源未声明此分支策略；未知不等于否'}];
 }
 const topology:ProseEvidence={sourceTextSha256:snapshot.textSha256,path:'source.relations',spans:source.relations.flatMap(r=>r.spans),value:source.relations.map(r=>[r.from,r.to]),scope:'声明的正向拓扑；不证明故障传播、实际执行或已完成'};
 for(const segment of segments){
  if(/\n\s*\n/u.test(candidate.slice(previousEnd,segment.start))||/^\s*[-*#>]\s/u.test(segment.text)){condition=undefined;subject=undefined;}
  previousEnd=segment.end;
  const text=clean(segment.text);if(!text)continue;let found=false,establishedCondition=false;
  if(text.length>1800){uncovered.push({text:segment.quote??segment.text,utf16Start:segment.start,utf16End:segment.end,reason:'片段超过有限工作流断言长度，未核对。'});continue;}
  const add=(kind:string,status:ProseStatus,reason:string,correction:string,proof:ProseEvidence[],actual?:unknown,extractedText?:string)=>{
   const key=segment.start+'|'+kind+'|'+JSON.stringify(actual);if(seen.has(key))return;seen.add(key);found=true;
   claims.push({kind,quote:segment.quote??candidate.slice(segment.start,segment.end),...(extractedText?{extractedText}:segment.quote?{extractedText:segment.text}:{}),candidateSpan:{utf16Start:segment.start,utf16End:segment.end,...(segment.pointer?{jsonPointer:segment.pointer}:{})},status,reason,correction,evidence:proof,...(actual===undefined?{}:{actual})});
  };
  const parts=clauses(text,names);
  const coupled=new RegExp('(?:'+named+')(?:失败|出错)(?:时|后)?\\s*(?:且|并且|同时|和|或|与)\\s*(?:'+named+')(?:失败|出错)','u').test(text);
  for(const [partIndex,part]of parts.entries()){
   const chunk=part.trim();if(!chunk)continue;
   const events=[...chunk.matchAll(new RegExp('('+named+')(?:出错|失败|未失败|没有失败|成功)(?:时|后)?','gu'))].filter(m=>{
    const prefix=chunk.slice(0,m.index).trim();return !prefix||/[:：]$/u.test(prefix)||/^(?:(?:如果|若|当|假如|假设|在|一旦|只有|仅在|即使|无论|不论|不管|除非|并非|不是说|不是|并不是说|并不是|例如)\s*)+$/u.test(prefix)||/[和或与、]$/u.test(prefix);
   });
   if(events.length){
    establishedCondition=true;
    const first=events[0],eventText=first[0],prefix=chunk.slice(0,first.index!+first[0].length),multi=coupled||events.length!==1||[...prefix.matchAll(new RegExp(named,'gu'))].length>1&&/[和或与]/u.test(prefix);
    condition={trigger:multi?undefined:first[1],event:multi?'ambiguous':/未失败|没有失败|成功/u.test(eventText)?'not-failure':'failure',necessary:/只有|才|除非/u.test(chunk),global:/无论|不论|任何|不管|所有/u.test(prefix),candidateSpan:{utf16Start:segment.start,utf16End:segment.end},text:chunk};
   }else if(/^(?:如果|若|当|假如|假设|在|一旦|只有|仅在|即使|无论|不论|不管|除非)/u.test(chunk)||/失败|出错|故障/u.test(chunk)&&!/(?:此|该|这个|当前)失败分支|(?:失败|出错)(?:的)?(?:重试|回滚|补偿|策略|次数)/u.test(chunk)){
    // An unresolved antecedent must not borrow the preceding branch.
    condition={event:'ambiguous',necessary:false,global:/任何|所有|无论|不管/u.test(chunk),candidateSpan:{utf16Start:segment.start,utf16End:segment.end},text:chunk};
   }
   const policy=source.failurePolicies.find(p=>p.trigger===condition?.trigger),proof=evidence(condition?.trigger);
   const correction=policy?'当'+policy.trigger+'失败时，仅重试'+policy.retryOnly.join('、')+'；此失败分支不回滚'+policy.noRollback.join('、')+'。不把此规则扩为其他分支或全局保证。':(condition?.trigger??'该')+'分支的重试、回滚、补偿或执行结果未由完整来源建立，保持未知。';
   const actionTail=chunk.slice(events.length?events.at(-1)!.index!+events.at(-1)![0].length:0).replace(/^[:：\s]+/u,'');
   const passive=actionTail.match(new RegExp('^('+named+'|整个流程|全流程)(?:将|会|也|仍)?((?:(?:'+negatives+')(?:会|需要)?)*)都?被?(重试|回滚)[。！？!?\\s]*$','u'));
   const actionText=passive?passive[2]+passive[3]+passive[1]:chunk;
   const firstAction=actionText.search(/重试|回滚/u),domain=actionText.slice(0,firstAction<0?actionText.length:firstAction);
   const scopeBlocked=!condition||condition.event!=='failure'||condition.necessary||condition.global||/永远|总是|无论|所有失败|任何失败/u.test(chunk)||!passive&&/整个流程都|全流程都/u.test(chunk)||/所有|全部|任何/u.test(domain)||/是否|会不会|要不要|需不需要|能否|[？?]/u.test(chunk);
   const reason=scopeBlocked?'条件缺失、否定/混合触发、必要条件或全局量词不等于来源的局部失败规则。':'用既有工作流求值核对当前失败分支的动作对象和范围。';
   const deniesImplication=events.length===1&&/并非|不是(?:说)?/u.test(chunk.slice(0,events[0].index))&&/就|时/u.test(chunk.slice(events[0].index!));
   const contextual=(action:string,targets:string[],negated:boolean)=>({condition:condition??null,action,targets,negated});
   for(const action of actionText.matchAll(new RegExp(negativePrefix+'((?:只|仅|仅仅)?重试)([^。！？]+)','gu'))){
    const body=action[3].split(/不回滚|回滚|但是|但|而|且|并且/u)[0],global=/整个流程|全流程|全部流程|所有(?:节点|步骤)|从头/u.test(body),binding=actionTargets(body,names,source.nodes),unique=binding.targets;
    if(binding.unresolved){add('workflow-action-target','unsupported','动作对象未能完整绑定到来源字面节点，不用名称子串猜测对象。',correction,proof,{action:'retry',unresolvedTarget:body},chunk);continue;}
    if(!unique.length)continue;const negated=oddNegation(action[1])!==deniesImplication,only=/只|仅/u.test(action[2])||global;
    let status:ProseStatus=scopeBlocked?'unknown':'unsupported';
    if(!scopeBlocked&&condition?.trigger){
     if(only){const r=checkSourceWorkflow(snapshot,{claims:[{kind:'retry-only',trigger:condition.trigger,nodes:unique}]}),s=(r.claimChecks as {status:string}[]|undefined)?.[0]?.status;status=s==='supported'?'supported':s==='contradicted'?'contradicted':'unsupported';}
     else if(policy)status=unique.every(n=>policy.retryOnly.includes(n))?'supported':'contradicted';
     if(negated)status=inverse(status);
    }
    add('workflow-retry-scope',status,reason,correction,proof,contextual(only?'retry-only':'retry',unique,negated),chunk);
   }
   for(const action of actionText.matchAll(new RegExp(negativePrefix+'回滚([^。！？]+)','gu'))){
    const body=action[2].split(/重试|但是|但|而|且|并且/u)[0],binding=actionTargets(body,names,source.nodes),targets=binding.targets;
    if(binding.unresolved){add('workflow-action-target','unsupported','动作对象未能完整绑定到来源字面节点，不用名称子串猜测对象。',correction,proof,{action:'rollback',unresolvedTarget:body},chunk);continue;}
    for(const target of new Set(targets)){
     const negated=oddNegation(action[1])!==deniesImplication;let status:ProseStatus=scopeBlocked?'unknown':'unsupported';
     if(!scopeBlocked&&condition?.trigger){const r=checkSourceWorkflow(snapshot,{claims:[{kind:'rollback',trigger:condition.trigger,target,value:!negated}]}),s=(r.claimChecks as {status:string}[]|undefined)?.[0]?.status;status=s==='supported'?'supported':s==='contradicted'?'contradicted':'unsupported';}
     add('workflow-rollback-scope',status,reason,correction,proof,contextual('rollback',[target],negated),chunk);
    }
   }
   const withheld=unknownWords.test(chunk),outcomeWithheld=withheld||/不一定/u.test(chunk);
   if(/重试.{0,10}(?:[0-9一二三四五六七八九十]+次|次数|无限|直到成功)|(?:必然|一定|保证|必).{0,8}(?:成功|恢复)/u.test(chunk))add('workflow-retry-outcome',outcomeWithheld?'supported':'unsupported','来源没有重试次数、成功或最终状态保证；可明确保留未知。','重试次数和最终成功状态未知；重试策略不是执行结果。',proof,{condition:condition??null,withheld:outcomeWithheld},chunk);
   const compensationUnknown=/补偿(?:策略|政策|方式|与否)?(?:尚)?(?:未知|未声明|未说明|未规定)|(?:不能确定|不能推断|不能保证|不确定|未声明|未说明).{0,12}补偿/u.test(chunk)||/是否补偿|如何补偿/u.test(chunk)&&/^(?:你|来源|这里|目前)?(?:尚|还)?未(?:说明|声明|规定)/u.test(parts[partIndex+1]??'');
   if(/补偿/u.test(chunk))add('workflow-compensation',compensationUnknown?'supported':'unsupported','当前完整来源未提供补偿政策，不能从重试或不回滚推得。',(condition?.trigger??'该')+'失败分支是否补偿及如何补偿未声明。',proof,{condition:condition??null,withheld:compensationUnknown},chunk);
   const causalUnknown=/(?:不能保证|不能确定|不能推断|不能断言|无法确定|不知道是否|不确定是否).{0,40}(?:到达|执行|已经完成|已完成|阻碍|反向传播|回传|影响)|(?:执行状态|故障影响范围|反向传播与否)(?:未知|未声明|未说明)/u.test(chunk);
   if(/无法到达|不能执行|无法执行|不会执行|不再执行|已经完成|已完成|阻碍|反向传播|回传|影响(?:只|仅)|影响范围/u.test(chunk))add('workflow-execution-causality',causalUnknown?'supported':'unsupported','声明拓扑不证明实际阻塞、反向传播、上游已完成或故障影响范围。','只保留声明的正向连接；实际执行、传播方向与故障影响范围未建立。',[topology,...proof],{condition:condition??null,withheld:causalUnknown},chunk);
   const terminal=chunk.match(new RegExp('^('+named+')(.{0,8})(?:末端|终点|终端|没有下游|无下游)','u'));
   if(terminal)subject=terminal[1];
   if(terminal||/^(?:没有下游|无下游)/u.test(chunk)&&subject){const node=terminal?.[1]??subject!,outgoing=source.relations.filter(r=>r.from===node),prefix=terminal?.[2]??'';let status:ProseStatus=outgoing.length===0?'supported':'contradicted';if(oddNegation(prefix))status=inverse(status);if(/是否|是不是|[？?]/u.test(chunk)||unknownWords.test(chunk))status='unknown';add('workflow-terminal-topology',status,'仅核对声明图的出边及明确极性，不把末端节点变成故障传播保证。',node+(outgoing.length?'有声明的正向连接：'+outgoing.map(r=>r.to).join('、'):'在声明图中没有下游')+'。',[topology],{node,outgoing:outgoing.map(r=>r.to)},chunk);}
  }
  if(!found){uncovered.push({text:segment.quote??segment.text,utf16Start:segment.start,utf16End:segment.end,reason:'未进入有限工作流正文合同；没有据拓扑推断因果或执行。'});if(!establishedCondition){condition=undefined;subject=undefined;}}
  if(claims.length>96||uncovered.length>128)return {claims:[],uncovered:[],refused:true};
 }
 return {claims,uncovered,refused:false};
}
