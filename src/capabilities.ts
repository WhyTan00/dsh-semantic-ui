import {components,VERSION,type ComponentName} from './protocol';

const descriptions:Record<ComponentName,{purpose:string;controls:string[];requires:string[]}>={
 ArchitectureExplorer:{purpose:'Declared relationships, dependencies and continuous scenario paths.',controls:['search','scenario highlighting','neighborhood focus','relationship list'],requires:['explicit nodes and edges','direction and declared roles']},
 DecisionExplorer:{purpose:'Compare common dimensions under finite declared rules and hard constraints.',controls:['focus dimensions','local condition changes','rule and missing-condition explanations'],requires:['supplied option set','unknown values kept null','declared policy origin']},
 DataChart:{purpose:'Inspect lines, category bars and equal-width histograms with source tables.',controls:['range','visible series','source table scope and pagination'],requires:['units and explicit missing values','time offset, timezone and granularity when relevant','shared histogram boundaries and denominator']},
};

/** Own renderer capabilities only; no inference about another enabled plugin. */
export function capabilityCatalog(){
 return {
  catalogVersion:'1.0',protocolVersion:VERSION,delivery:'dsh_semantic_ui describe/render; atomic checkpoints in native DSH conversation history',
  components:(Object.keys(components)as ComponentName[]).map(component=>({component,...structuredClone(descriptions[component])})),
  interaction:{localControls:true,feedbackToModel:false,interactionPreferencesPersist:false,contentPersistence:'DSH standard tool-result metadata; renderer required for replay'},
  personalTemplates:{version:1,modelAccess:'read-only list/inspect/use',storage:'private DSH profile; owner UI mutations',themes:['light/dark','three palettes','font','density','text size'],versions:'immutable; exact version recorded in history',exports:'field contracts and appearance only; no previous values, conclusions or rules'},
  notImplemented:['form submission','quiz feedback','arbitrary generated applications','3D scenes','geographic maps','arbitrary chart options','weighted averages','quantiles','unequal-width histograms'],
  selectionPolicy:'Choose the least complex expression that meets the task. For capabilities outside this catalog, use another actually available tool only when its documented features, host compatibility and state/feedback behavior fit. No provider is a universal fallback. If none is available, explain the limitation in text. Do not promise persistence or model feedback from local controls.',
 };
}
