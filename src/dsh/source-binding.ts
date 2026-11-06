import type {Envelope,Issue} from '../protocol';
import {bounded} from '../protocol';
import {decisionSourcePrefix,parseDecisionSource} from '../source-decision';
import {bindCapacityView,bindWorkflowView,bindPermissionView,bindDecisionView,bindNumericView} from '../source-delivery';
import {sourceDeliverySchema,type SourceDelivery} from '../source-delivery-meta';
import {reviewProse} from '../prose';
import type {currentHostSource} from './source';

type CurrentSource=ReturnType<typeof currentHostSource>;
type Binding={ok:true;view:Envelope;sourceBinding:SourceDelivery}|{ok:false;issues:Issue[]};

/** WebCrypto review yields; do not return or stage a result after its turn/source was replaced. */
export function sameCurrentSource(before:CurrentSource,after:CurrentSource){
 if(!before.ok||!after.ok)return !before.ok&&!after.ok&&before.result.issues[0].code===after.result.issues[0].code;
 return before.snapshot.textSha256===after.snapshot.textSha256&&JSON.stringify(before.snapshot.hostContext)===JSON.stringify(after.snapshot.hostContext);
}

/** Check and render share the same fresh source binding; a previous receipt is never authority. */
export function bindCurrentView(source:CurrentSource,input:Envelope,mapping?:unknown,claims?:unknown):Binding{
 const decision=source.ok&&input.component==='DecisionExplorer'&&source.snapshot.kind==='decision-zh'&&(mapping!==undefined||decisionSourcePrefix(source.snapshot.excerpt)||parseDecisionSource(source.snapshot.excerpt).status==='ready');
 const capacity=source.ok&&source.snapshot.kind==='capacity-zh',numeric=source.ok&&source.snapshot.kind==='observations-zh',workflow=source.ok&&source.snapshot.kind==='workflow-zh';
 if(claims!==undefined&&!capacity&&!numeric&&!workflow)return {ok:false,issues:source.ok?[{code:'SOURCE_CLAIMS_COMPONENT',path:'$.claims',reason:'Claims require the complete current capacity, numeric or workflow source.',hint:'Use source-check for other source claim kinds; no claim supplies source authority.'}]:source.result.issues.map(i=>({...i,hint:'No typed claim supplies a missing current source; inspect source-check without replacing the source.'}))};
 if(source.ok&&(source.snapshot.kind==='permissions-zh'||capacity||decision||numeric||workflow)){
  if(source.snapshot.kind==='permissions-zh'&&mapping!==undefined)return {ok:false,issues:[{code:'SOURCE_MAPPING_COMPONENT',path:'$.mapping',reason:'Decision field mapping cannot authorize a permission graph.',hint:'Omit it; graph binding uses exact source labels.'}]};
  const bound=capacity?bindCapacityView(source.snapshot,input,mapping,claims):workflow?bindWorkflowView(source.snapshot,input,mapping,claims):numeric?bindNumericView(source.snapshot,input,mapping,claims):decision?bindDecisionView(source.snapshot,input,mapping):bindPermissionView(source.snapshot,input);
  if(!bound.ok)return bound;
  const meta=sourceDeliverySchema.safeParse({version:1,status:'bound',kind:capacity?'capacity-zh':workflow?'workflow-zh':numeric?'observations-zh':decision?'decision-zh':'permissions-zh',explanation:bound.explanation,sourceRef:{textSha256:source.snapshot.textSha256,hostContext:source.snapshot.hostContext},viewIdentity:{displayId:bound.view.displayId,revision:bound.view.revision,component:bound.view.component},sourceFactsVerified:false,identityVerified:false});
  if(!meta.success)return {ok:false,issues:[{code:'SOURCE_DELIVERY_LIMIT',path:'$.source',reason:'The complete source-bound explanation or reference exceeds the delivery contract.',hint:'No partial source approval is delivered.'}]};
  return {ok:true,view:bound.view,sourceBinding:meta.data};
 }
 if(mapping!==undefined)return {ok:false,issues:[{code:'SOURCE_MAPPING_UNAVAILABLE',path:'$.mapping',reason:'No supported current Decision or numeric source is available for these coordinates.',hint:'Mapping supplies no facts. Inspect source-check and keep unsupported source unverified.'}]};
 return {ok:true,view:input,sourceBinding:{version:1,status:'unverified',code:source.ok?'SOURCE_RENDER_SCOPE':source.result.issues[0].code,reason:source.ok?'本次未绑定该来源语法；结构化数据、模型摘要和注释均未作独立来源核对。':'当前来源不可用或不唯一；本次仅按通用结构合同核对，模型内容未核。',identityVerified:false,sourceFactsVerified:false}};
}

/** Optional model draft, reviewed against this call's host text, never against a chart or caller-supplied source. */
export async function reviewCurrentProse(source:CurrentSource,candidate:unknown){
 if(candidate===undefined)return undefined;
 const scope={candidateSelection:'tool-argument-only; the final assistant message is not intercepted',wholeCandidateVerified:false as const,identityVerified:false as const,newModelCalls:0 as const};
 if(!source.ok)return {status:'source-unavailable',...scope,issues:source.result.issues};
 if(typeof candidate!=='string'||new TextEncoder().encode(candidate).length>24000)return {status:'refused',...scope,reason:'正文草稿必须是最多24000字节的文本；未作部分核对。'};
 const review=await reviewProse(source.snapshot.excerpt,candidate);
 // The existing tool-value contract applies to the complete report, without truncating claims or locations.
 if(bounded(review))return {status:'refused',...scope,reason:'完整正文核对报告超过工具数据限制；未返回部分批准。'};
 return {status:review.status,...scope,sourceRef:{textSha256:source.snapshot.textSha256,hostContext:source.snapshot.hostContext},review};
}
