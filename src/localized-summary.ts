import type{Envelope}from'./protocol';
import{analyzeValidated}from'./core';
import{chartFacts,decisionFacts,graphFacts}from'./facts';
import{translate,type Locale}from'./i18n';
/** Format existing deterministic facts; never translate or reinterpret source/model prose. */
export function localizedSummary(view:Envelope,locale:Locale):string{
 if(locale==='en')return analyzeValidated(view).canonicalSummary;
 if(view.component==='ArchitectureExplorer'){
  const f=graphFacts(view.payload),labels=f.sharedTargets.map(v=>view.payload.nodes.find(n=>n.id===v.nodeId)?.label??v.nodeId);
  return `已声明关系图：${f.nodeCount}个节点、${f.edgeCount}条关系。${labels.length?'共同指向的节点：'+labels.join('、')+'。':''}`;
 }
 if(view.component==='DecisionExplorer'){
  const f=decisionFacts(view.payload,true),labels=(ids:string[])=>ids.map(id=>view.payload.options.find(o=>o.id===id)?.label??id).join('、')||'无';
  return `已声明比较：${view.payload.options.length}个方案、${view.payload.dimensions.length}个维度。${f.requirements.length?`满足硬性需求：${labels(f.eligibleOptionIds)}；不满足：${labels(f.excludedOptionIds)}；待确认：${labels(f.unknownFeasibilityIds)}。`:''}${f.status==='matched'?`${f.resultBasis==='proposed-policy'?'建议规则':'声明规则'}的结果：${labels(f.recommendedOptionIds)}。`:'尚未建立偏好推荐。'}`;
 }
 const f=chartFacts(view.payload);
 if(f.chartType==='histogram')return `已声明分布，单位为${view.payload.unit}：${f.groups.map(g=>`${view.payload.chartType==='histogram'?view.payload.source.groups.find(s=>s.id===g.id)?.label??g.id:g.id}：${g.valid}个有效观测、${g.missing}个缺失`).join('；')}。`;
 return `已声明${translate(locale,view.payload.chartType)}图，单位为${view.payload.unit}：${f.series.map(s=>`${view.payload.chartType!=='histogram'?view.payload.series.find(v=>v.id===s.id)?.label??s.id:s.id}：${s.valid}个有效观测、${s.missing}个缺失，均值为${s.mean??'未知'}`).join('；')}。`;
}
