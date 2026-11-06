import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-session-projection';
import type {} from '@deepseek-ai/dsh-system-prompt';
import type {} from '@deepseek-ai/dsh-skill';
import { components, validateEnvelope, type ComponentName } from '../protocol';
import type {Checkpoint} from './events';
import { GUIDANCE, TOOL_DESCRIPTION } from './guidance';
import {analyzeValidated,describeSemantic,validateForDelivery} from '../core';
import {capabilityCatalog} from '../capabilities';
import {mountLibrary} from './library';
import {mountResults} from './results';
import {matchTemplate,newPresentation} from '../templates';
import type {Presentation} from '../theme';
import {currentHostSource,currentSourceProjection} from './source';
import {checkSourceDecision} from '../source-decision';
import {checkSourcePermissions} from '../source-permissions';
import {checkSourceNumeric} from '../source-numeric';
import {checkSourceWorkflow} from '../source-workflow';
import {checkSourceCapacity} from '../source-capacity';
import {bindCurrentView,reviewCurrentProse,sameCurrentSource} from './source-binding';
import {createPresentationChannel} from './presentation';
import {mountSourceUpdates} from './source-update';
export const name='dsh-semantic-ui';
export interface Config {generation:boolean}
export const Config:Schema<Config>=Schema.object({generation:Schema.boolean().default(true)});
export const inject=['tools','systemPrompt','sessionProjections'];
export const parameters={
  action:{type:'string',enum:['catalog','describe','templates','template','check','source-check','render'],required:true,description:'Discover fields/templates, check current host source or deliver data. check and render recheck the current own-turn source using the same binding. source-check inspects the finite source contract; arguments cannot supply source/kind/identity. Optional prose is reviewed only within the existing finite Chinese assertion coverage; no whole-answer certification.'},
  component:{type:'string',enum:['ArchitectureExplorer','DecisionExplorer','DataChart'],description:'Required for describe.'},
  view:{type:'object',additionalProperties:true,description:'Required for check or render. Versioned view with component payload; get fields via describe first.'},
  mapping:{type:'object',additionalProperties:true,description:'For capacity-zh source-check/check/render use {capacityDimensionId,demandInputId,requirementId}; one exact-unit numeric capacity >= current demand. For workflow source-check/check/render use {failurePolicies:[{trigger:nodeId,retryOnly:[nodeId],noRollback:[nodeId]}]} covering every explicit source rule; labels come from the actual nodes. For Decision/numeric source-check, check or source-bound render: complete dimension/input coordinates or series ID and all sourceIndex/rowId coordinates. Inspect source-check first. Coordinates never provide truth or authorization.'},
  claims:{type:'array',items:{type:'object',additionalProperties:true},description:'Optional bounded source claims for source-check, or typed observed/complete mean claims for numeric render. Free claims and prose are not certified.'},
  prose:{type:'string',description:'Optional draft text for check, source-check or render, at most 24000 UTF-8 bytes. Returns finite assertion review against the same current host source. Unknown/uncovered text remains unverified. It does not intercept or certify the final assistant message.'},
  templateId:{type:'string',description:'For template or render: use a personal template ID returned by templates. Render requires templateVersion.'},
  templateVersion:{type:'integer',description:'Exact immutable version. Required when rendering with templateId; inspect action=template first.'},
} as const;
export function describe(component:ComponentName){return {...describeSemantic(component),delivery:'Call dsh_semantic_ui action=render with view. Do not output this JSON in prose.',...(component==='ArchitectureExplorer'?{currentWorkflowSourceContract:{grammar:'complete workflow-zh; not an arrow excerpt',mapping:'{failurePolicies:[{trigger:nodeId,retryOnly:[nodeId],noRollback:[nodeId]}]} with every explicit rule exactly once',claims:'retry-only {trigger:exactLabel,nodes:[exactLabel]}; rollback {trigger:exactLabel,target:exactLabel,value:boolean}; unsupported claims use kind/text and remain not-assessed',boundary:'A matched topology alone does not cover failure policy. No actual execution or world/prose certification.'}}:{}),...(component==='DecisionExplorer'?{currentCapacitySourceContract:{grammar:'complete capacity-zh storage declarations; source syntax chooses kind',viewContract:'Read source-check.viewContract first: literal label constraints and numeric role omissions are part of this finite API; field-specific errors distinguish label, unit and current quantity.',mapping:'{capacityDimensionId,demandInputId,requirementId} with actual IDs',representation:'exactly one numeric 容量上限 column, one numeric 需求容量 input initially equal to current source demand, one unconditional at-least hard requirement; exact units; no recommendation rules',boundary:'Future possible demand and local numeric edits are hypotheses, not confirmed plans or source updates. Deployment and maintenance are independent. Inspect source-check first; arbitrary prose remains unverified.'}}:{}),...(component==='DataChart'?{currentNumericSourceContract:{grammar:'observations-zh; one complete reading sentence, optionally followed by the documented mean question; selected from current input syntax, not tool arguments',statistics:'observed subtotal/mean versus complete total/mean; missing complete values stay unknown; core zeroFillIllustration is a separate hypothesis relative to observed values only',mapping:'{seriesId, rows:[{sourceIndex:0,rowId}, ...]} covering every position once',representation:'one bar/category/input series with exact source measurement label/unit; row.x is the literal 1-based position',claims:'optional mean claims: kind=mean, population=observed or complete, value=finite number or null for unknown, denominator=that range count, unit=exact source unit',boundary:'Inspect source-check first. Complete mean stays unknown if any reading is missing; generic unsupported source remains unverified or refuses coordinates.'}}:{})};}
export function apply(ctx:Context,config:Config={generation:true}){
  const library=mountLibrary(ctx);
  mountResults(ctx);
  if(config.generation===false)return;
  const channel=createPresentationChannel();
  ctx.sessionProjections.register(currentSourceProjection);
  mountSourceUpdates(ctx);
  ctx.inject(['skills'],skillCtx=>{skillCtx.skills.register({name:'dsh-semantic-ui',source:'runtime',description:'Explain relationships, tradeoffs and numbers through the semantic UI tool when useful.',content:GUIDANCE+'\n\nThe only delivery entry for these semantic components is dsh_semantic_ui. Get the chosen component fields with action=describe, then deliver action=render. Display IDs are turn-scoped; revisions increase for updates. Runtime checks enforce structure and declared graph, comparison and numeric consistency; they cannot establish that model claims or rules follow the user facts.'});});
  ctx.systemPrompt.section({name:'dsh-semantic-ui:delivery',order:850,text:GUIDANCE});
  ctx.tools.register(defineTool({name:'dsh_semantic_ui',description:TOOL_DESCRIPTION,parameters,output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}],presentationMeta:channel.presentationMeta},async execute(args,exec){
    exec.signal.throwIfAborted();
    const sourceChanged=()=>({code:'HOST_SOURCE_CHANGED',path:'$.source',reason:'The current host source or turn changed while the draft was being checked.',hint:'Inspect the current source; no earlier draft report or view was delivered.'});
    if(args.action==='check'){
      if(Object.entries(args).some(([k,v])=>v!==undefined&&!['action','view','mapping','claims','prose'].includes(k)))return {status:'validation-failed',issues:[{code:'HOST_SOURCE_OVERRIDE',path:'$',reason:'Check accepts a view, coordinates, typed claims and optional draft only; no supplied source or previous receipt authorizes this call.'}]};
      const checked=validateForDelivery(args.view);if(!checked.ok)return {status:'validation-failed',issues:checked.issues.slice(0,30)};
      const source=currentHostSource(ctx,exec),bound=bindCurrentView(source,checked.value,args.mapping,args.claims);if(!bound.ok)return {status:'validation-failed',issues:bound.issues.slice(0,30)};
      const proseReview=await reviewCurrentProse(source,args.prose);exec.signal.throwIfAborted();
      if(!sameCurrentSource(source,currentHostSource(ctx,exec)))return {status:'validation-failed',issues:[sourceChanged()]};
      return {status:'validated',...analyzeValidated(bound.view),sourceBinding:bound.sourceBinding,...(bound.sourceBinding.status==='bound'?{summarySource:'source-derived bounded projection',canonicalExplanation:bound.sourceBinding.explanation}:{}),...(proseReview?{proseReview}:{})};
    }
    if(args.action==='source-check'){
      if(Object.entries(args).some(([k,v])=>v!==undefined&&!['action','view','mapping','claims','prose'].includes(k)))return {status:'source-unavailable',sourceFactsVerified:false,identityVerified:false,issues:[{code:'HOST_SOURCE_OVERRIDE',path:'$',reason:'Source text, file, mode, message IDs and authority cannot be supplied or replaced through tool arguments.'}]};
      const source=currentHostSource(ctx,exec);if(!source.ok)return source.result;
      const check=source.snapshot.kind==='capacity-zh'?checkSourceCapacity:source.snapshot.kind==='workflow-zh'?checkSourceWorkflow:source.snapshot.kind==='permissions-zh'?checkSourcePermissions:source.snapshot.kind==='observations-zh'?checkSourceNumeric:checkSourceDecision;
      const result=check(source.snapshot,{...(args.view!==undefined?{view:args.view}:{}),...(args.mapping!==undefined?{mapping:args.mapping}:{}),...(args.claims!==undefined?{claims:args.claims}:{}),...(args.prose!==undefined?{prose:args.prose}:{})}),proseReview=await reviewCurrentProse(source,args.prose);exec.signal.throwIfAborted();
      if(!sameCurrentSource(source,currentHostSource(ctx,exec)))return {status:'source-unavailable',sourceFactsVerified:false,identityVerified:false,issues:[sourceChanged()]};
      return {...result,...(proseReview?{proseReview}:{})};
    }
    if(args.action==='catalog')return {...capabilityCatalog(),personalLibraryAvailable:!!library(),hostSourceComparison:{action:'source-check',kinds:['capacity-zh','workflow-zh','decision-zh','permissions-zh','observations-zh'],source:'single current own-turn user-source text via public projection; finite syntax chooses grammar',identityVerified:false}};
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
    const reject=(issues:Checkpoint['issues'])=>{
      const b=exec.agent?ctx.sessionProjections.stateOf(exec.agent.session,'turnBoundary'):undefined;
      const candidate=args.view?.displayId;const displayId=typeof candidate==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/.test(candidate)?candidate:'failed-'+String(exec.callId).replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,60);
      const current=b&&b.openTurnStartSeq!==null?{turn:b.lastTurn,displayId}:undefined,short=issues?.slice(0,30);
      return {status:'validation-failed',...current,issues:short,...(current?{deliveryId:channel.remember({...current,issues:short})}:{})};
    };
    if(Object.entries(args).some(([k,v])=>v!==undefined&&!['action','view','mapping','claims','prose','templateId','templateVersion'].includes(k)))return reject([{code:'RENDER_ARGUMENT',path:'$',reason:'Render accepts a fresh view/template, coordinates, typed claims and optional draft only; source, authority, prior checks and delivery handles cannot authorize this request.',hint:'Remove extra fields. The current host source is checked again during this render.'}]);
    const checked=validateForDelivery(args.view);if(!checked.ok)return reject(checked.issues);
    if(!exec.agent)throw Error('HOST_SESSION: delivery requires a real agent session.');
    const boundary=ctx.sessionProjections.stateOf(exec.agent.session,'turnBoundary');
    if(!boundary||boundary.openTurnStartSeq===null)throw Error('HOST_TURN: delivery requires an open turn.');
    const source=currentHostSource(ctx,exec),bound=bindCurrentView(source,checked.value,args.mapping,args.claims);if(!bound.ok)return reject(bound.issues);
    const view=bound.view,sourceDelivery=bound.sourceBinding,proseReview=await reviewCurrentProse(source,args.prose);exec.signal.throwIfAborted();
    const latestBoundary=ctx.sessionProjections.stateOf(exec.agent.session,'turnBoundary');
    if(!sameCurrentSource(source,currentHostSource(ctx,exec))||latestBoundary?.lastTurn!==boundary.lastTurn||latestBoundary.openTurnStartSeq!==boundary.openTurnStartSeq)return {status:'validation-failed',issues:[sourceChanged()]};
    let presentation:Presentation=view.presentation??newPresentation(library()?.snapshot().defaultTheme);
    if(args.templateId){
      if(!Number.isSafeInteger(args.templateVersion))throw Error('TEMPLATE_VERSION: Render requires the exact version returned by action=template.');
      const store=library();if(!store)throw Error('LIBRARY_UNAVAILABLE');
      const template=store.get(args.templateId,args.templateVersion);matchTemplate(template,view);
      presentation={version:1,theme:template.theme,layout:template.layout,template:{id:args.templateId,version:template.version,name:template.name}};
    }else if(args.templateVersion!==undefined)throw Error('TEMPLATE_ID: A version also requires templateId.');
    else if(presentation.template)throw Error('TEMPLATE_ID: Use templateId and templateVersion to claim template provenance.');
    const final=validateEnvelope({...view,presentation});if(!final.ok)return reject(final.issues);
    const checkpoint:Checkpoint={turn:boundary.lastTurn,view:final.value,sourceDelivery};
    return {status:'delivered',turn:boundary.lastTurn,displayId:final.value.displayId,revision:final.value.revision,summary:final.value.summary,presentation,...analyzeValidated(final.value),...(sourceDelivery.status==='bound'?{summarySource:'source-derived bounded projection',canonicalExplanation:sourceDelivery.explanation}:{}),sourceDeliveryStatus:sourceDelivery.status,...(proseReview?{proseReview}:{}),identityVerified:false,deliveryId:channel.remember(checkpoint)};
  }}));
}
