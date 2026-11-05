import {z} from 'zod';
import {readResult,type ResultPackage} from './results';
import {analyzeValidated,checkSourceGraph} from './core';
import {bounded,usesReviewedPolicy} from './protocol';
import {decide} from './math';
import {compareDecisionScenarios} from './scenarios';
import {validateConditionDraft} from './condition-form';
import type {SourceSnapshot} from './source-graph';
import {checkSourceDecision} from './source-decision';
import {checkSourcePermissions} from './source-permissions';
import {checkSourceNumeric} from './source-numeric';
import {checkSourceWorkflow} from './source-workflow';
import {checkSourceCapacity} from './source-capacity';

export const resultCheckRequestSchema=z.strictObject({document:z.unknown(),mapping:z.unknown().optional()});
const sourceCheckers={'decision-zh':checkSourceDecision,'permissions-zh':checkSourcePermissions,'observations-zh':checkSourceNumeric,'workflow-zh':checkSourceWorkflow,'capacity-zh':checkSourceCapacity,arrows:checkSourceGraph};
function checkOriginalSource(source:SourceSnapshot|undefined,view:ResultPackage['content']['view'],mapping:unknown):Record<string,unknown>{
 if(!source)return {status:'not-configured',identityVerified:false,sourceFactsVerified:false,reason:'No independent caller-configured source snapshot. Saved source records cannot supply one.'};
 const check=sourceCheckers[source.kind??'arrows'];
 return check(source,{view,...(mapping===undefined?{}:{mapping})});
}
const statuses:Record<string,string>={matched:'按给定政策匹配',insufficient:'条件不足',blocked:'无符合条件的方案','no-match':'无偏好规则匹配','review-required':'偏好政策尚未选择本地探索'};
function localDecision(document:ResultPackage){
 const {view,interaction:s,sourceRecord}=document.content;
 if(view.component!=='DecisionExplorer'||s.component!=='DecisionExplorer')return;
 const p=view.payload,strict=usesReviewedPolicy(view.protocolVersion),b=decide(p,s.values,strict,s.exploreProposals);
 const pair=s.scenarioComparison?compareDecisionScenarios(p,s.scenarioComparison.a,{values:s.values,dimensions:s.dimensions,exploreProposals:s.exploreProposals},strict):undefined;
 const draft=s.conditionDraft?validateConditionDraft(p,s.conditionDraft,sourceRecord?.status==='bound'&&sourceRecord.kind==='capacity-zh'?p.inputs[0]?.id:undefined):undefined;
 const names=(ids:string[])=>p.options.filter(o=>ids.includes(o.id)).map(o=>o.label).join('、')||'无';
 const explain=(label:string,result:typeof b)=>`${label}：满足当前要求 ${names(result.eligibleOptionIds)}；排除 ${names(result.excludedOptionIds)}；待确认 ${names(result.unknownFeasibilityIds)}。${statuses[result.status]}。`;
 return {structured:{scope:'local-hypotheses-only',bComputed:b,...(pair?{aComputed:pair.a,difference:{conditions:pair.conditions,outcomeChanged:pair.outcomeChanged,dimensionsChanged:pair.dimensionsChanged,policySelectionChanged:pair.policySelectionChanged,requirementChanges:pair.requirementChanges,constraintChanges:pair.constraintChanges}}:{}),draftValidation:draft??null,viewing:s.scenarioComparison?.viewing??'b',sourceOrPolicyApproved:false},
  explanation:[pair?explain('保留的A',pair.a):'',explain(pair?'本地B':'已应用的本地条件',b),pair?`当前查看${s.scenarioComparison!.viewing==='a'?'A（只读）':'B'}；${pair.outcomeChanged?'A/B计算状态有变化':'A/B计算状态相同'}，条件差异不自动成为新来源。`:'',draft?draft.ok?'B草稿有效但未自动应用。':`B草稿有${Object.keys(draft.errors).length}项无效输入，保留原文并与已应用值分开。`:'没有独立的未应用草稿。'].filter(Boolean).join('\n')};
}
/** One existing result protocol and core. No file, model, tool, source replacement or persistence operation. */
export async function checkResultPackage(raw:unknown,configuredSource?:SourceSnapshot):Promise<Record<string,unknown>>{
 let document:ResultPackage;
 const request=resultCheckRequestSchema.safeParse(raw);
 if(!request.success||request.data.mapping!==undefined&&bounded(request.data.mapping))return {status:'invalid-request',explanationZh:'核对请求无效；只接受完整结果和有界字段映射，不能通过请求替换固定来源或声明权限。'};
 try{document=await readResult(request.data.document);}catch(error){return {status:'invalid-result',explanationZh:'结果包损坏、字段无效或版本/依赖不兼容；未使用默认值替换，也未修改原件。',detail:error instanceof Error?error.message.slice(0,1200):'RESULT_INVALID'};}
 const source=configuredSource?structuredClone(configuredSource):undefined;
 const sourceComparison=checkOriginalSource(source,document.content.view,request.data.mapping),comparison=sourceComparison.comparison as {status?:string}|undefined;
 const recorded=document.content.sourceRecord;
 const recordedSourceConsistency=!source?'not-assessed':recorded?.status==='bound'?(recorded.sourceRef.textSha256===source.textSha256?'same-text-digest':'different-text-digest'):'no-bound-record';
 const status=!source?'checked-unverified':comparison?.status==='matched'&&recordedSourceConsistency!=='different-text-digest'?'checked':'source-mismatch';
 let declared:ReturnType<typeof analyzeValidated>|undefined,local:ReturnType<typeof localDecision>,analysisError:string|undefined;
 try{declared=analyzeValidated(document.content.view);local=localDecision(document);}catch(error){analysisError=error instanceof Error?error.message.slice(0,1200):'RESULT_ANALYSIS_UNAVAILABLE';}
 const sourceText=!source?'未配置独立固定来源；包内来源状态与摘要仅作历史记录，来源映射未核。':recordedSourceConsistency==='different-text-digest'?'当前固定来源与包内历史来源记录的文本摘要不同；没有改写旧记录或据此确认原来源。字段核对结果单列。':status==='checked'?'原始view与调用者固定来源在既有有限语法内匹配；未认证作者、现实事实、任意正文或政策。':'原始view的来源映射未匹配或不受该有限语法支持；没有换源、补值或升级为事实。';
 const componentName={ArchitectureExplorer:'架构关系图',DecisionExplorer:'决策比较',DataChart:'数据图表'}[document.content.view.component];
 const explanationZh=[`已读取${componentName}完整结果（格式${document.manifest.version}）。保存的语言、主题、选择、A/B与草稿保留在原合同内。`,sourceText,local?.explanation??'原始声明的完整范围计算与本地展示选择分开；筛选、搜索、情景和画布状态保留于原包，不作为新的来源事实。',analysisError?'派生计算不可用，未补造结果；原结果包仍完整保留。':'计算复用已有核心；规则、标签和模型注释仍是声明，不认证优选或世界事实。'].join('\n');
 const receipt={status:analysisError?'analysis-unavailable':status,explanationZh,document,retained:{format:document.manifest.version,locale:document.content.locale,theme:document.content.theme,layout:document.content.layout,recordedSourceStatus:document.content.sourceRecord?.status??'not-recorded'},layers:{recordedSource:'historical-data-only',recordedSourceConsistency,declarations:declared??null,local:local?.structured??{scope:'presentation-selection-only',selection:document.content.interaction,recomputedAsSource:false},sourceComparison},identityVerified:false,sourceFactsVerified:false,freeProseVerified:false,automaticModelOrToolCalls:0,...(analysisError?{analysisError}:{})};
 if(new TextEncoder().encode(JSON.stringify(receipt)).length>1_048_576)return {status:'analysis-unavailable',explanationZh:'结果包有效，但派生回执超过有界输出限制；完整原包保留，未截断数据或认证来源。',document,identityVerified:false,sourceFactsVerified:false,automaticModelOrToolCalls:0};
 return receipt;
}
