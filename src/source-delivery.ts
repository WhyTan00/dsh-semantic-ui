import {validateEnvelope,VERSION,type Envelope,type Issue} from './protocol';
import {checkSourcePermissions,parsePermissionSource} from './source-permissions';
import {checkSourceDecision,sourceDecisionRequestSchema} from './source-decision';
import type {SourceSnapshot} from './source-graph';

/** Make a fresh source projection, never a keyword edit of model-authored notes. */
export function bindPermissionView(snapshot:SourceSnapshot,input:Envelope):{ok:true;view:Envelope;explanation:string}|{ok:false;issues:Issue[]}{
 const mismatch=(result:Record<string,unknown>)=>({ok:false as const,issues:((result.issues as {code:string;path:string;reason:string}[]|undefined)??[]).map(i=>({...i,hint:'Use exact source labels, directed positive accesses and pair-bound modes. Inspect source-check; no prior receipt can authorize this render.'}))});
 const first=checkSourcePermissions(snapshot,{view:input});
 if((first.comparison as {status?:string}|undefined)?.status!=='matched'){
  const failed=mismatch(first);return failed.issues.length?failed:{ok:false,issues:[{code:'SOURCE_DELIVERY_UNSUPPORTED',path:'$.view',reason:'The complete current source/view cannot be bound by the permissions contract.',hint:'Inspect source-check. Do not deliver a partial or guessed source projection.'}]};
 }
 const parsed=parsePermissionSource(snapshot.excerpt,snapshot.textByteStart);if(parsed.status!=='ready'||input.component!=='ArchitectureExplorer')return mismatch(first);
 const source=parsed.value,labels=new Map(input.payload.nodes.map(n=>[n.id,n.label]));
 const view:Envelope={...input,protocolVersion:VERSION,summary:'当前来源声明的直接访问投影；权限范围见来源说明，未认证任意正文。',payload:{
  title:'来源声明的直接访问与权限',
  nodes:input.payload.nodes.map(n=>{
   const outgoing=source.accesses.filter(a=>a.from===n.label),only=source.onlyTargets.find(a=>a.from===n.label),bans=source.prohibitions.filter(a=>a.from===n.label);
   return {id:n.id,label:n.label,responsibility:outgoing.length?outgoing.map(a=>`${a.from} → ${a.to}：${a.mode==='read-only'?'只读':a.mode==='read-write'?'读写':'访问；读写权限未声明'}。`).join('\n'):'业务职责未声明；访问边界仅以明确的关系和限制为准。',constraints:[...(only?[`该主体直接访问目标仅限 ${only.targets.join('、')}。`]:[]),...(bans.length?[`禁止该主体直接访问 ${bans.map(a=>a.to).join('、')}。`]:[])],evidence:[]};
  }),
  edges:input.payload.edges.map(e=>{const a=source.accesses.find(a=>a.from===labels.get(e.source)&&a.to===labels.get(e.target))!;return {id:e.id,source:e.source,target:e.target,directed:true,type:a.mode,label:a.mode==='read-only'?'只读':a.mode==='read-write'?'读写':'访问',evidence:[]};}),
  scenarios:input.payload.scenarios.map((s,i)=>({id:s.id,label:`正向拓扑路径 ${i+1}`,nodeIds:[...s.nodeIds],edgeIds:[...s.edgeIds],explanation:`声明关系中的拓扑路径：${s.nodeIds.map(id=>labels.get(id)).join(' → ')}。不证明请求实际执行、替代路线或故障影响。`})),
 }};
 const checked=validateEnvelope(view);if(!checked.ok)return {ok:false,issues:checked.issues.map(i=>({...i,code:'SOURCE_DISPLAY_LIMIT',hint:'The complete derived display must fit the existing component limits; no notes or conditions were silently truncated.'}))};
 const final=checkSourcePermissions(snapshot,{view:checked.value}),canonical=final.canonicalExplanation as {status?:string;text?:string}|undefined;
 if((final.comparison as {status?:string}|undefined)?.status!=='matched'||canonical?.status!=='available'||!canonical.text)return mismatch(final);
 return {ok:true,view:checked.value,explanation:canonical.text};
}

/** Field mappings are coordinates only. All cells, conditions and effects were
 * checked against the current source before any new display is constructed. */
export function bindDecisionView(snapshot:SourceSnapshot,input:Envelope,mapping:unknown):{ok:true;view:Envelope;explanation:string}|{ok:false;issues:Issue[]}{
 const failed=(result:Record<string,unknown>)=>({ok:false as const,issues:((result.issues as {code:string;path:string;reason:string}[]|undefined)??[{code:'SOURCE_DELIVERY_UNSUPPORTED',path:'$.view',reason:'The complete Decision source/view could not be bound.'}]).map(i=>({...i,hint:'Inspect source-check and supply a complete field mapping. Unknown facts stay null; no old check or model policy authorizes this render.'}))});
 const first=checkSourceDecision(snapshot,{view:input,...(mapping===undefined?{}:{mapping})});if((first.comparison as {status?:string}|undefined)?.status!=='matched')return failed(first);
 const request=sourceDecisionRequestSchema.safeParse({view:input,mapping});if(!request.success||!request.data.mapping||input.component!=='DecisionExplorer')return failed(first);
 const bindings=request.data.mapping,p=input.payload;
 const view:Envelope={...input,protocolVersion:VERSION,summary:'来源声明的方案与原始条件；未知保持未知，本地假设不改变来源事实或建立推荐。',payload:{
  title:'来源声明的条件与取舍',
  dimensions:p.dimensions.map(d=>({...d})),
  options:p.options.map(o=>({id:o.id,label:o.label,values:Object.fromEntries(p.dimensions.map(d=>[d.id,o.values[d.id]])),advantages:[],disadvantages:[],suitableWhen:'来源未提供成本排序、迁移优势或推荐策略；原始条件与本地假设分别查看。',evidence:[]})),
  inputs:p.inputs.map(i=>({id:i.id,label:i.label,type:'boolean',initial:i.initial,semanticRole:i.semanticRole,expectedEffect:i.expectedEffect})),
  requirements:(p.requirements??[]).map(r=>({...r})),constraints:[],rules:[],
 }};
 const checked=validateEnvelope(view);if(!checked.ok)return {ok:false,issues:checked.issues};
 const final=checkSourceDecision(snapshot,{view:checked.value,mapping:bindings}),canonical=final.canonicalExplanation as {status?:string;text?:string}|undefined;
 if((final.comparison as {status?:string}|undefined)?.status!=='matched'||canonical?.status!=='available'||!canonical.text)return failed(final);
 return {ok:true,view:checked.value,explanation:canonical.text};
}
