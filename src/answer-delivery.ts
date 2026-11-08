import {z} from 'zod';
import {bounded,validateEnvelope,type Envelope} from './protocol';
import type {SourceSnapshot} from './source-graph';
import {checkSourceGraph} from './source-graph';
import {checkSourceWorkflow} from './source-workflow';
import {checkSourceCapacity} from './source-capacity';
import {checkSourceDecision} from './source-decision';
import {checkSourcePermissions} from './source-permissions';
import {checkSourceNumeric} from './source-numeric';
import {sourceReferenceFromSnapshot} from './source-reference.mjs';

const sha=z.string().regex(/^[a-f0-9]{64}$/);
export const answerBindingSchema=z.strictObject({checkerVersion:z.literal('answer-delivery-1'),sourceDocumentSha256:sha.nullable(),sourceTextSha256:sha.nullable(),sourceSnapshotSha256:sha.nullable(),viewSha256:sha,rulesSha256:sha,mappingSha256:sha,candidateBundleSha256:sha});
export type AnswerBinding=z.infer<typeof answerBindingSchema>;
export const answerInputSchema=z.string().min(1).max(24000).refine(v=>new TextEncoder().encode(v).length<=24000,'Answer exceeds 24 KB.');
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
const digest=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const checks={'workflow-zh':checkSourceWorkflow,'capacity-zh':checkSourceCapacity,'decision-zh':checkSourceDecision,'permissions-zh':checkSourcePermissions,'observations-zh':checkSourceNumeric,arrows:checkSourceGraph};
export function compareSourceView(source:SourceSnapshot|undefined,view:Envelope,mapping:unknown):Record<string,unknown>{
 if(!source)return {status:'not-configured',identityVerified:false,sourceFactsVerified:false,reason:'No independent caller-configured source snapshot. Saved source records cannot supply one.'};
 const check=checks[source.kind??'arrows'];return check?check(source,{view,...(mapping===undefined?{}:{mapping})}):{status:'unsupported-source-kind'};
}
export interface AnswerDeliveryInput{view:unknown;mapping?:unknown;answer?:string;expectedBinding?:AnswerBinding;recordedSourceTextSha256?:string}
/** A delivery gate, never a general natural-language verifier. No file or host access. */
export async function checkAnswerDelivery(input:AnswerDeliveryInput,source?:SourceSnapshot){
 const candidate=input.answer,checked=validateEnvelope(input.view);
 const base={version:1 as const,wholeCandidateVerified:false as const,wholeViewProseVerified:false as const,identityVerified:false as const,worldFactsVerified:false as const,externalAssistantBodyIntercepted:false as const,answerProvidedByCaller:candidate!==undefined,answerCompleteness:candidate===undefined?'not-supplied':'caller-supplied; completeness not independently established',...(candidate!==undefined&&answerInputSchema.safeParse(candidate).success?{originalAnswer:candidate}:{}),newModelCalls:0};
 const refuse=(code:string,reason:string,extra:Record<string,unknown>={})=>({...base,status:'refused' as const,code,reason,text:null,...extra});
 const raw={view:input.view,...(candidate===undefined?{}:{answer:candidate}),...(input.mapping===undefined?{}:{mapping:input.mapping}),...(input.expectedBinding===undefined?{}:{expectedBinding:input.expectedBinding})};
 if(bounded(raw)||!checked.ok||candidate!==undefined&&!answerInputSchema.safeParse(candidate).success)return refuse('ANSWER_INPUT','视图或候选超限/无效；没有返回部分全文批准。');
 const view=checked.value,viewJson=JSON.stringify(canonical(view)),viewSha256=await digest(viewJson),candidateBundleSha256=await digest(JSON.stringify({viewSha256,answer:candidate??null}));
 const rulesSha256=await digest(JSON.stringify(canonical(view.component==='DecisionExplorer'?{rules:view.payload.rules,constraints:view.payload.constraints,requirements:view.payload.requirements??[]}:null)));
 const binding:AnswerBinding={checkerVersion:'answer-delivery-1',sourceDocumentSha256:source?.documentSha256??null,sourceTextSha256:source?.textSha256??null,sourceSnapshotSha256:source?await digest(JSON.stringify(canonical(source))):null,viewSha256,rulesSha256,mappingSha256:await digest(JSON.stringify(canonical(input.mapping??null))),candidateBundleSha256};
 // Every byte of the canonical view and every supplied answer character is
 // accounted for. Recognizing one assertion never covers the whole sentence.
 const coverage={policy:'all-original-text-remains-unverified' as const,diagnosticSpansAreNotCoverage:true,allViewFieldsIncludedInDigest:true,
  representations:[{origin:'view',encoding:'canonical-json',sha256:viewSha256,utf16Length:viewJson.length,unverifiedRanges:[{utf16Start:0,utf16End:viewJson.length}]},
   ...(candidate===undefined?[]:[{origin:'answer',encoding:'original-text',sha256:await digest(candidate),utf16Length:candidate.length,unverifiedRanges:[{utf16Start:0,utf16End:candidate.length}]}])]};
 const retained={binding,viewIdentity:{displayId:view.displayId,revision:view.revision,component:view.component},coverage,...(candidate===undefined?{}:{originalAnswer:candidate})};
 if(input.expectedBinding){const expected=answerBindingSchema.safeParse(input.expectedBinding);if(!expected.success||JSON.stringify(canonical(expected.data))!==JSON.stringify(canonical(binding)))return refuse('ANSWER_BINDING_STALE','当前来源、视图/规则或候选与预期摘要不同；旧核对状态不能继承。',retained);}
 if(!source)return refuse('ANSWER_SOURCE_MISSING','没有调用者独立固定的当前来源。保存的bound/verified文字、摘要或图表不认证答复。',retained);
 const excerptSha256=await digest(source.excerpt),size=new TextEncoder().encode(source.excerpt).length;
 if(!sha.safeParse(source.documentSha256).success||excerptSha256!==source.excerptSha256||excerptSha256!==source.textSha256||source.textByteStart!==0||source.textByteEnd!==size||source.textBytes!==size)return refuse('ANSWER_SOURCE_SNAPSHOT','来源摘要或完整范围不一致；选段不能冒作完整来源，未复用旧通过状态。',retained);
 if(input.recordedSourceTextSha256!==undefined&&input.recordedSourceTextSha256!==source.textSha256)return refuse('ANSWER_RECORDED_SOURCE_STALE','包内历史来源摘要不同于当前来源；原记录保留，拒绝作为当前有据答复。',retained);
 const comparison=compareSourceView(source,view,input.mapping),sourceMatch=(comparison.comparison as {status?:string}|undefined)?.status==='matched';
 const {reviewProse}=await import('./prose');
 const candidates=[{path:'/view/summary',text:view.summary},...(view.component==='DataChart'&&view.payload.fullDataExplanation?[{path:'/view/payload/fullDataExplanation',text:view.payload.fullDataExplanation}]:[]),...(candidate===undefined?[]:[{path:'/answer',text:candidate}])];
 const diagnostics=await Promise.all(candidates.map(async c=>{const r=await reviewProse(source.excerpt,c.text);return {path:c.path,sourceTextSha256:r.sourceTextSha256,candidateSha256:r.candidateSha256,reviewStatus:r.status,wholeCandidateVerified:false,
  assertions:r.claims.map(({kind,status,candidateSpan,evidence,reason})=>({kind,status,candidateSpan,evidence,reason,quoteVerified:false})),uncovered:r.uncovered,recognizedAssertionsDoNotApproveRemainingText:true};}));
 const detail={...retained,diagnostics,structuredSourceMatch:sourceMatch};
 if(!sourceMatch)return refuse('ANSWER_VIEW_SOURCE_MISMATCH','原始结构没有匹配当前有限来源。没有用正确片段或本地假设替换原字段。',detail);
 const core=await import('./core'),reference=sourceReferenceFromSnapshot(core,source,source.kind);
 const explanation=reference.status==='ready'?reference.comparison.canonicalExplanation as {status?:string;text?:string}|undefined:undefined;
 if(reference.status!=='ready'||explanation?.status!=='available'||!explanation.text)return refuse('ANSWER_PROJECTION_UNAVAILABLE','当前来源没有可担保的完整有限程序说明；不从原候选中剪取片段充作有据全文。',detail);
 return {...base,...detail,status:'limited-source-output' as const,code:'ORIGINAL_CANDIDATE_NOT_APPROVED',reason:'原候选完整保留为未核数据；交付文本是当前来源的程序投影，不是修复后的模型原回答。',text:explanation.text,
  textSha256:await digest(explanation.text),textOrigin:'program-derived finite source projection' as const,sourceKind:reference.kind,sourceComparisonScope:'caller-selected complete finite text; no identity or world-fact certification'};
}
