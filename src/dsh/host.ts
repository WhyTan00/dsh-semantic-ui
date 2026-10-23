import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-session-projection';
import type {} from '@deepseek-ai/dsh-system-prompt';
import type {} from '@deepseek-ai/dsh-skill';
import { z } from 'zod';
import { components, validateEnvelope, VERSION, type ComponentName } from '../protocol';
import { META } from './events';
import { GUIDANCE, TOOL_DESCRIPTION } from './guidance';
import {chartFacts,decisionFacts} from '../facts';
import {capabilityCatalog} from '../capabilities';
import {mountLibrary} from './library';
import {matchTemplate,newPresentation} from '../templates';
import type {Presentation} from '../theme';
export const name='dsh-semantic-ui';
export interface Config {generation:boolean}
export const Config:Schema<Config>=Schema.object({generation:Schema.boolean().default(true)});
export const inject=['tools','systemPrompt','sessionProjections'];
export const parameters={
  action:{type:'string',enum:['catalog','describe','templates','template','render'],required:true,description:'Discover capabilities/fields, list personal templates, inspect a template version, or deliver fresh validated data. Models cannot modify the library.'},
  component:{type:'string',enum:['ArchitectureExplorer','DecisionExplorer','DataChart'],description:'Required for describe.'},
  view:{type:'object',additionalProperties:true,description:'Required for render. Versioned view with component payload; get fields via describe first.'},
  templateId:{type:'string',description:'For template or render: use a personal template ID returned by templates. Render requires templateVersion.'},
  templateVersion:{type:'integer',description:'Exact immutable version. Required when rendering with templateId; inspect action=template first.'},
} as const;
// Both native tool/result and nested tool/ptc-dispatch persist presentation
// metadata in the pinned host. No custom event, log mutation or private API.
export function presentationMeta(args:unknown,value:unknown){
  const receipt=value as {status?:string;turn?:number;displayId?:string;issues?:unknown;presentation?:Presentation};
  if(!receipt||!Number.isSafeInteger(receipt.turn))return null;
  if(receipt.status==='delivered'){
    const input=(args as {view?:unknown})?.view;
    const checked=validateEnvelope(receipt.presentation&&input&&typeof input==='object'?{...input,protocolVersion:VERSION,presentation:receipt.presentation}:input);
    return checked.ok?JSON.parse(JSON.stringify({[META]:{turn:receipt.turn,view:checked.value}})):null;
  }
  if(receipt.status==='validation-failed')return JSON.parse(JSON.stringify({[META]:{turn:receipt.turn,displayId:receipt.displayId,issues:receipt.issues}}));
  return null;
}
export function describe(component:ComponentName){return {component,protocolVersion:VERSION,payloadSchema:z.toJSONSchema(components[component]),envelope:{protocolVersion:VERSION,displayId:'stable-subject-id',revision:1,component,summary:'A short readable conclusion.',payload:'Follow payloadSchema.'},delivery:'Call dsh_semantic_ui action=render with view. Do not output this JSON in prose.',semantics:component==='DecisionExplorer'?'The render receipt returns decisionFacts evaluated under original conditions. Check prose against its status and recommendedOptionIds; insufficient conditions must not be described as a winner. Declared origins are not independently verified. Rules use all/any clauses, highest priority wins; equal-priority matches combine recommendations. Missing values are unknown. Constraints exclude options. No scores are inferred. Preserve the supplied option set; seeking more information is an action, not an extra supplier or platform. Only explicitly supplied conditions may have non-null initial values; unspecified priorities, certainty and team capacity start null. A known value cannot be called better than an unknown value. A priority alone cannot resolve an unknown comparison: do not automatically prefer the known supplier. A hard constraint excludes its option when its predicate is true; never use it to express permission, a preference, or information-gathering. Its reason must agree with that exclusion. Capacity facts can exclude options, but do not establish costs or a preference. Mark proposed preference rules origin=model-judgment unless the user explicitly supplied that policy.':component==='DataChart'?'The render receipt returns deterministic full-data dataFacts; check prose against these facts, including endpoints, minimum, maximum and net change. Line/bar rows need explicit null for missing values. Time timestamps need offsets, timezone and granularity; duplicate instants need explicit upstream aggregation. Describe only the observed interval: do not invent irregular spacing, missing causes or trend forecasts. Histograms share increasing equal-width bin boundaries: [lower,upper), last bin includes upper. Unequal-width bins are unsupported; do not invent rebinning from pre-aggregated counts. Ratio denominator is valid observations in each group; missing is excluded. Weighted averages and quantiles are unsupported.':'Every edge and scenario path must reference existing IDs and preserve direction. A scenario is one continuous directed path: edgeIds.length = nodeIds.length - 1, with each edge joining adjacent nodes. A single-node failure has no edges. Branches are separate scenarios; unrelated affected nodes are not a path. Flat graph only; cycles are retained. A forbidden relation is not an actual edge: put prohibitions in node constraints, never in edges or scenario paths. Count nodes and allowed edges from the actual arrays. Preserve only supplied relationships, roles and constraints; no mandatory hidden links, replication, ordering or isolation mechanisms may be invented. State failure-propagation assumptions conditionally; a forward edge alone proves no rollback policy.'};}
export function apply(ctx:Context,config:Config={generation:true}){
  const library=mountLibrary(ctx);
  if(config.generation===false)return;
  ctx.inject(['skills'],skillCtx=>{skillCtx.skills.register({name:'dsh-semantic-ui',source:'runtime',description:'Explain relationships, tradeoffs and numbers through the semantic UI tool when useful.',content:GUIDANCE+'\n\nThe only delivery entry for these semantic components is dsh_semantic_ui. Get the chosen component fields with action=describe, then deliver action=render. Display IDs are turn-scoped; revisions increase for updates. Runtime checks enforce structure and declared graph, comparison and numeric consistency; they cannot establish that model claims or rules follow the user facts.'});});
  ctx.systemPrompt.section({name:'dsh-semantic-ui:delivery',order:850,text:GUIDANCE});
  ctx.tools.register(defineTool({name:'dsh_semantic_ui',description:TOOL_DESCRIPTION,parameters,output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}],presentationMeta},async execute(args,exec){
    exec.signal.throwIfAborted();
    if(args.action==='catalog')return {...capabilityCatalog(),personalLibraryAvailable:!!library()};
    if(args.action==='templates'||args.action==='template'){
      const store=library();if(!store)throw Error('LIBRARY_UNAVAILABLE: Personal storage is not ready. Retry later.');
      if(args.action==='templates')return {templates:store.snapshot().templates.map(t=>{const head=t.versions.find(v=>v.version===t.head)!;return {id:t.id,version:t.head,name:head.name,component:head.definition.component};}),usage:'Inspect action=template with templateId; supply fresh full view, templateId and exact templateVersion to render. Existing data, conclusions and rules are never reused.'};
      if(!args.templateId)throw Error('TEMPLATE_ID: Select an ID from action=templates.');
      return {templateId:args.templateId,...store.get(args.templateId,args.templateVersion),required:'Supply a fresh full view matching definition and describe schema, including new facts, unknowns and rules. Field labels may change; IDs, types, units and ordering must match. No old data is stored here.'};
    }
    if(args.action==='describe'){
      if(!args.component||!(args.component in components))throw Error('COMPONENT at $.component: select ArchitectureExplorer, DecisionExplorer, or DataChart.');
      return JSON.parse(JSON.stringify(describe(args.component)));
    }
    const checked=validateEnvelope(args.view);if(!checked.ok){
      const b=exec.agent?ctx.sessionProjections.stateOf(exec.agent.session,'turnBoundary'):undefined;
      const candidate=args.view?.displayId;const displayId=typeof candidate==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/.test(candidate)?candidate:'failed-'+String(exec.callId).replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,60);
      return JSON.parse(JSON.stringify({status:'validation-failed',...(b&&b.openTurnStartSeq!==null?{turn:b.lastTurn,displayId}:{}),issues:checked.issues.slice(0,30)}));
    }
    if(!exec.agent)throw Error('HOST_SESSION: delivery requires a real agent session.');
    const boundary=ctx.sessionProjections.stateOf(exec.agent.session,'turnBoundary');
    if(!boundary||boundary.openTurnStartSeq===null)throw Error('HOST_TURN: delivery requires an open turn.');
    let presentation:Presentation=checked.value.presentation??newPresentation(library()?.snapshot().defaultTheme);
    if(args.templateId){
      if(!Number.isSafeInteger(args.templateVersion))throw Error('TEMPLATE_VERSION: Render requires the exact version returned by action=template.');
      const store=library();if(!store)throw Error('LIBRARY_UNAVAILABLE');
      const template=store.get(args.templateId,args.templateVersion);matchTemplate(template,checked.value);
      presentation={version:1,theme:template.theme,layout:template.layout,template:{id:args.templateId,version:template.version,name:template.name}};
    }else if(args.templateVersion!==undefined)throw Error('TEMPLATE_ID: A version also requires templateId.');
    else if(presentation.template)throw Error('TEMPLATE_ID: Use templateId and templateVersion to claim template provenance.');
    return {status:'delivered',turn:boundary.lastTurn,displayId:checked.value.displayId,revision:checked.value.revision,component:checked.value.component,summary:checked.value.summary,presentation,...(checked.value.component==='DataChart'?{dataFacts:chartFacts(checked.value.payload)}:checked.value.component==='DecisionExplorer'?{decisionFacts:decisionFacts(checked.value.payload)}:{})};
  }}));
}
