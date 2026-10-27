import {z} from 'zod';
import {bounded,validateEnvelope} from './protocol';
import {compareDirectedView,parseExplicitRelations,sourceMetadata,SOURCE_LIMITS,type SourceSnapshot,type SourceSpan,type SourceRelation,type SourceIssue} from './source-graph';

const name=z.string().min(1).max(80),ids=z.array(name).max(80);
const policy=z.strictObject({trigger:name,retryOnly:ids.min(1),noRollback:ids.min(1)});
const claim=z.strictObject({kind:name,trigger:name.optional(),nodes:ids.optional(),target:name.optional(),value:z.boolean().optional(),text:z.string().min(1).max(1200).optional()}).superRefine((c,ctx)=>{
 const good=c.kind==='retry-only'?!!c.trigger&&!!c.nodes?.length&&c.target===undefined&&c.value===undefined&&c.text===undefined:c.kind==='rollback'?!!c.trigger&&!!c.target&&c.value!==undefined&&c.nodes===undefined&&c.text===undefined:!!c.text&&c.trigger===undefined&&c.nodes===undefined&&c.target===undefined&&c.value===undefined;
 if(!good)ctx.addIssue({code:'custom',message:'retry-only uses trigger/nodes; rollback uses trigger/target/value; unsupported kinds use only text and remain not-assessed.'});
});
export const sourceWorkflowRequestSchema=z.strictObject({view:z.unknown().optional(),mapping:z.strictObject({failurePolicies:z.array(policy).max(12)}).optional(),claims:z.array(claim).max(SOURCE_LIMITS.claims).optional(),prose:z.string().max(20000).optional()});
export interface FailurePolicy{trigger:string;retryOnly:string[];noRollback:string[];triggerSpans:SourceSpan[];retrySpans:SourceSpan[];noRollbackSpans:SourceSpan[]}
export interface WorkflowSource{nodes:string[];relations:SourceRelation[];failurePolicies:FailurePolicy[];questions:{triggers:string[];span:SourceSpan}[]}
const bytes=(s:string)=>new TextEncoder().encode(s).length;
const valid=(s:string)=>/^[\p{L}\p{N}][\p{L}\p{N}_ ./:\-]{0,79}$/u.test(s);
const header=/^(?:(?:虚构|合成)?[\p{L}\p{N}_ ]{0,40}?(?:流程|处理链)(?:为|：|:))/u;
export const workflowSourcePrefix=(text:string)=>header.test(text.trim())||/^[^，,；;。\r\n]+(?:→|->)[^，,；;。\r\n]+[，,；;。\r\n][\s\S]*(?:失败|出错)/u.test(text.trim());

/** Complete finite grammar, never a search that silently drops unsupported prose. */
export function parseWorkflowSource(text:string,offset=0):{status:'ready';value:WorkflowSource}|{status:'unsupported';issues:SourceIssue[]}{
 const fail=(reason:string,code='SOURCE_WORKFLOW_SYNTAX')=>({status:'unsupported' as const,issues:[{code,path:'$.source.excerpt',reason}]});
 if(!text.trim()||bytes(text)>SOURCE_LIMITS.excerptBytes)return fail('Empty or over-limit complete workflow source.','SOURCE_LIMIT');
 const clauses=[...text.matchAll(/[^，,；;。！？!?\r\n]+/gu)].map(m=>{const trim=m[0].trim(),start=m.index+m[0].indexOf(trim);return {text:trim,start,span:{textByteStart:offset+bytes(text.slice(0,start)),textByteEnd:offset+bytes(text.slice(0,start+trim.length))}};}).filter(c=>c.text);
 const relations:SourceRelation[]=[],nodes=new Set<string>(),failurePolicies:FailurePolicy[]=[],questions:WorkflowSource['questions']=[];
 let relationCount=0;
 const action=(clause:typeof clauses[number])=>{const m=clause.text.match(/^(只|仅)重试(.+)$/u),n=clause.text.match(/^不回滚(.+)$/u);return m&&valid(m[2])?{kind:'retry' as const,node:m[2],span:clause.span}:n&&valid(n[1])?{kind:'noRollback' as const,node:n[1],span:clause.span}:null;};
 for(let i=0;i<clauses.length;i++){
  const c=clauses[i];let t=c.text,start=c.start;
  if(i===0){const h=t.match(header);if(h){t=t.slice(h[0].length);start+=h[0].length;}}
  if(t.includes('→')||t.includes('->')){
   const graph=parseExplicitRelations(t,offset+bytes(text.slice(0,start)));if(graph.status!=='ready')return fail('Every topology clause must be one complete literal directed chain.');
   relationCount+=graph.relations.length;if(relationCount>SOURCE_LIMITS.relations)return fail('Too many topology relations.','SOURCE_LIMIT');graph.nodes.forEach(n=>nodes.add(n));
   for(const r of graph.relations){const prior=relations.find(p=>p.from===r.from&&p.to===r.to);if(prior)prior.spans.push(...r.spans);else relations.push(r);}continue;
  }
  const query=t.match(/^(.+?)(?:出错|失败)与(.+?)(?:出错|失败)分别会影响哪里$/u)||t.match(/^(.+?)(?:出错|失败)会影响哪里$/u);
  if(query){questions.push({triggers:query.slice(1),span:c.span});continue;}
  const trigger=t.match(/^(?:若)?(.+?)(?:失败|出错)(?:时)?(.*)$/u);
  if(!trigger||!valid(trigger[1]))return fail('Unsupported non-topology clause. Only an explicit failure trigger, retry-only target, no-rollback target and documented question forms are supported.');
  const actions:NonNullable<ReturnType<typeof action>>[]=[];
  if(trigger[2]){const a=action({...c,text:trigger[2]});if(!a)return fail('The failure policy must explicitly state only-retry and no-rollback; opposite or extra policies are unsupported.');actions.push(a);}
  while(actions.length<2){const next=clauses[++i];if(!next)return fail('Incomplete failure policy.');const a=action(next);if(!a)return fail('A failure policy needs exactly one retry-only and one no-rollback clause.');actions.push(a);}
  const retry=actions.find(a=>a.kind==='retry'),noRollback=actions.find(a=>a.kind==='noRollback');if(!retry||!noRollback)return fail('Duplicate policy action is ambiguous.');
  if(failurePolicies.some(p=>p.trigger===trigger[1]))return fail('Duplicate trigger policies are unsupported.');
  failurePolicies.push({trigger:trigger[1],retryOnly:[retry.node],noRollback:[noRollback.node],triggerSpans:[c.span],retrySpans:[retry.span],noRollbackSpans:[noRollback.span]});if(failurePolicies.length>12)return fail('Too many failure policies.','SOURCE_LIMIT');
 }
 if(!relations.length)return fail('A complete workflow must include explicit topology.');
 if(nodes.size>80)return fail('Too many distinct topology nodes.','SOURCE_LIMIT');
 if(failurePolicies.some(p=>[p.trigger,...p.retryOnly,...p.noRollback].some(n=>!nodes.has(n)))||questions.some(q=>q.triggers.some(n=>!nodes.has(n))))return fail('Policy and question labels must occur exactly in the topology.');
 return {status:'ready',value:{nodes:[...nodes],relations,failurePolicies,questions}};
}

export function explainWorkflow(s:WorkflowSource){
 const lines=['来源明确给出的有向拓扑：'+s.relations.map(r=>`${r.from} → ${r.to}`).join('；')+'。'];
 for(const p of s.failurePolicies)lines.push(`明确异常规则：当${p.trigger}失败时，仅重试${p.retryOnly.join('、')}；此失败分支不回滚${p.noRollback.join('、')}。重试范围不扩展到整个流程。`);
 if(!s.failurePolicies.length)lines.push('来源未声明异常重试或回滚规则；不能从箭头补出策略。');
 for(const n of [...new Set(s.questions.flatMap(q=>q.triggers))])if(!s.failurePolicies.some(p=>p.trigger===n))lines.push(`${n}失败的重试、回滚或补偿策略未声明，保持未知。`);
 lines.push('拓扑可用于查看声明的正向连接，不保证故障传播、反向回传、实际执行/阻塞或上游已完成。重试次数、必成功、最终状态和未声明分支均未知。以上是合成来源的有限声明核对，不执行任何动作，也不认证世界事实或任意正文。');return lines.join('\n');
}

export function checkSourceWorkflow(snapshot:SourceSnapshot,input:unknown):Record<string,unknown>{
 const common={sourceCheckVersion:'1.0',sourceCheckKind:'workflow-zh',source:sourceMetadata(snapshot),identityVerified:false,sourceFactsVerified:false,freeProseVerified:false};
 const finish=(r:Record<string,unknown>):Record<string,unknown>=>bounded(r)?{...common,status:'check-limit',issues:[{code:'SOURCE_CHECK_LIMIT',path:'$',reason:'No partial workflow acceptance is returned beyond the receipt budget.'}]}:r;
 const budget=bounded(input);if(budget)return {...common,status:'validation-failed',issues:[budget]};
 if(snapshot.textByteStart!==0||snapshot.textByteEnd!==snapshot.textBytes||snapshot.textSha256!==snapshot.excerptSha256)return {...common,status:'source-unsupported',issues:[{code:'SOURCE_WORKFLOW_COMPLETE',path:'$.source.selection',reason:'workflow-zh requires the complete selected text value, not an arrow-only excerpt from a larger question.'}],comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
 const req=sourceWorkflowRequestSchema.safeParse(input);if(!req.success)return {...common,status:'validation-failed',issues:req.error.issues.map(i=>({code:'SOURCE_REQUEST',path:'$.'+i.path.join('.'),reason:i.message}))};
 const parsed=parseWorkflowSource(snapshot.excerpt,snapshot.textByteStart);if(parsed.status!=='ready')return {...common,status:'source-unsupported',issues:parsed.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
 const source=parsed.value,issues:SourceIssue[]=[],{view,mapping,claims=[]}=req.data;let comparison:Record<string,unknown>={status:'not-requested'};
 if(view!==undefined){
  const v=validateEnvelope(view);if(!v.ok)return {...common,status:'validation-failed',issues:v.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
  if(v.value.component!=='ArchitectureExplorer')return {...common,status:'source-unsupported',issues:[{code:'SOURCE_COMPONENT',path:'$.view',reason:'Workflow projection requires ArchitectureExplorer.'}]};
  const g=compareDirectedView(v.value,source);issues.push(...g.issues);const labels=new Map(v.value.payload.nodes.map(n=>[n.id,n.label]));
  if(!mapping)issues.push({code:'SOURCE_POLICY_MAPPING_REQUIRED',path:'$.mapping',reason:'A complete view comparison must explicitly map all failurePolicies, including an empty array when none are declared.'});
  const mapped=(mapping?.failurePolicies??[]).map((p,i)=>{const names=[p.trigger,...p.retryOnly,...p.noRollback];if(new Set(p.retryOnly).size!==p.retryOnly.length||new Set(p.noRollback).size!==p.noRollback.length||names.some(n=>!labels.has(n)))issues.push({code:'SOURCE_POLICY_COORDINATES',path:`$.mapping.failurePolicies.${i}`,reason:'Unique rule coordinates must reference actual view node IDs.'});return {trigger:labels.get(p.trigger),retryOnly:p.retryOnly.map(n=>labels.get(n)),noRollback:p.noRollback.map(n=>labels.get(n))};});
  const norm=(p:{trigger:unknown;retryOnly:unknown[];noRollback:unknown[]})=>JSON.stringify([p.trigger,[...p.retryOnly].sort(),[...p.noRollback].sort()]);
  for(const [i,p]of mapped.entries())if(!source.failurePolicies.some(s=>norm(s)===norm(p)))issues.push({code:'SOURCE_POLICY_MISMATCH',path:`$.mapping.failurePolicies.${i}`,reason:'This trigger/retry-only/no-rollback tuple is not the explicit source policy; topology cannot authorize it.'});
  const missing=source.failurePolicies.filter(p=>!mapped.some(m=>norm(m)===norm(p)));if(missing.length)issues.push({code:'SOURCE_POLICY_MISSING',path:'$.mapping.failurePolicies',reason:'Complete coverage includes every explicit failure policy, not just all arrows.'});
  if(new Set(mapped.map(p=>p.trigger)).size!==mapped.length)issues.push({code:'SOURCE_POLICY_DUPLICATE',path:'$.mapping.failurePolicies',reason:'A trigger must be mapped exactly once.'});
  comparison={...g.comparison,status:issues.length?'mismatch':'matched',coverage:'all explicit topology and failure policies in the complete selected workflow source',policyChecks:mapped,missingPolicies:missing};
 }else if(mapping)issues.push({code:'SOURCE_POLICY_VIEW_REQUIRED',path:'$.mapping',reason:'ID coordinates require the actual view.'});
 const claimChecks=claims.map((c,index)=>{
  const p=source.failurePolicies.find(p=>p.trigger===c.trigger);let status='not-assessed';
  if(p&&c.kind==='retry-only'&&c.nodes)status=new Set(c.nodes).size===c.nodes.length&&c.nodes.length===p.retryOnly.length&&c.nodes.every(n=>p.retryOnly.includes(n))?'supported':'contradicted';
  if(p&&c.kind==='rollback'&&c.target&&p.noRollback.includes(c.target))status=c.value===false?'supported':'contradicted';
  return {index,kind:c.kind,status,...(p?{sourceSpans:[...p.triggerSpans,...p.retrySpans,...p.noRollbackSpans]}:{}),...(status==='supported'?{}:{code:status==='contradicted'?'SOURCE_RULE_CONTRADICTION':'SOURCE_CLAIM_NOT_ASSESSED',reason:status==='contradicted'?'Contradicts the explicit policy on this failure branch.':'No explicit policy establishes this claim; missing information is not false.'})};
 });
 const mayExplain=!issues.length&&comparison.status!=='mismatch'&&claimChecks.every(c=>c.status==='supported');
 return finish({...common,status:'compared',sourceWorkflow:source,comparison,issues,claimChecks,conclusion:{selectedSource:comparison.status,structuredClaims:claimChecks.some(c=>c.status==='contradicted')?'contradicted':claimChecks.some(c=>c.status==='not-assessed')?'not-assessed':claims.length?'supported':'not-requested',sourceIdentity:'unverified',freeProse:'not-verified'},freeProse:{status:'not-verified',provided:req.data.prose!==undefined,reason:'No keyword removal or arbitrary prose certification.'},canonicalExplanation:mayExplain?{status:'available',basis:'complete finite workflow syntax only',text:explainWorkflow(source)}:{status:'withheld'}});
}
