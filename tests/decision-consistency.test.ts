import{LocaleContext}from'../src/i18n';
import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {declaredDecision,currentGroundingFixtures,declaredResource,declaredScope} from '../fixtures/consistency';
import {decision} from '../fixtures/examples';
import {extractDefinition,matchTemplate,exportTemplate,parseBounded,exportSchema} from '../src/templates';
import {resource,capability} from '../fixtures/grounding';
import {validateEnvelope,bounded,VERSION,type Decision} from '../src/protocol';
import {analyzeEnvelope,analyzeValidated,validateForDelivery,describeSemantic} from '../src/core';
import {decide,requirementChecks} from '../src/math';
import {DecisionExplorer} from '../src/components/DecisionExplorer';
import {AppearanceContext} from '../src/appearance';
import {defaultTheme,defaultLayout} from '../src/theme';
const fresh=()=>{const v=structuredClone(declaredResource);if(v.component!=='DecisionExplorer')throw Error();return v;};
const scoped=()=>{const v=structuredClone(declaredScope);if(v.component!=='DecisionExplorer')throw Error();return v;};
const issues=(view:unknown)=>{const r=validateForDelivery(view);expect(r.ok).toBe(false);if(r.ok)throw Error();return r.issues;};
it('publishes a real current contract and checks lossless declaration mapping with unverified sources',()=>{
 expect(VERSION).toBe('1.4');const view=fresh(),before=JSON.stringify(view),r=analyzeEnvelope(view);expect(r.status).toBe('validated');expect(r).toHaveProperty('declarationMapping.requirements.1',{requirementId:'team-maintenance',dimensionId:'maintenance',dimensionRole:'resource-need',inputId:'teamAvailable',inputRole:'resource-available',relation:'requires-availability',unit:null});expect(r).toHaveProperty('sourceFactsVerified',false);expect(r).toHaveProperty('declarationMapping.sourceFactsVerified',false);expect(JSON.parse(JSON.stringify(r))).toEqual(r);expect(bounded(r)).toBeUndefined();expect(JSON.stringify(view)).toBe(before);expect(describeSemantic('DecisionExplorer').payloadSchema).toHaveProperty('properties.inputs.items.required',expect.arrayContaining(['expectedEffect']));
});
it('preserves the existing boolean/null truth tables for both directions',()=>{
 const p=fresh().payload,values=[false,true,null] as const;
 for(const relation of ['supports','requires-availability'] as const)for(const actual of values)for(const input of values){const x=structuredClone(p);x.requirements=[{id:'r',dimension:relation==='supports'?'network':'maintenance',input:relation==='supports'?'networkNeeded':'teamAvailable',relation}];x.options.forEach(o=>o.values[x.requirements![0].dimension]=actual);const expected=relation==='supports'?(input===false?'inactive':actual===null||input===null?'unknown':actual?'pass':'fail'):(actual===false?'inactive':actual===null||input===null?'unknown':input?'pass':'fail');expect(requirementChecks(x,{networkNeeded:input,teamAvailable:input}).map(r=>r.status)).toEqual([expected,expected]);}
});
it('rejects the wrong relation and missing roles at stable field paths without rewriting',()=>{
 let x=fresh();x.payload.requirements![1].relation='supports';const before=JSON.stringify(x);expect(issues(x)).toContainEqual(expect.objectContaining({code:'ROLE_RELATION',path:'$.payload.requirements.1.relation'}));expect(JSON.stringify(x)).toBe(before);x=fresh();delete x.payload.dimensions[1].semanticRole;delete x.payload.inputs[1].semanticRole;expect(issues(x).filter(i=>i.code==='DECLARATION_MISSING').map(i=>i.path)).toEqual(['$.payload.dimensions.1.semanticRole','$.payload.inputs.1.semanticRole']);x=fresh();x.payload.inputs[1].semanticRole='capability-need';expect(issues(x).some(i=>i.code==='ROLE_RELATION')).toBe(true);
});
it('checks role types, including unused unit annotations rather than guessing meaning from a label',()=>{
 const x=fresh();x.payload.inputs[1].unit='hours';expect(issues(x)).toContainEqual(expect.objectContaining({code:'ROLE_TYPE',path:'$.payload.inputs.1.semanticRole'}));
});
it('rejects claimed hard effects on actual preference-only controls; genuine preference-only remains legal',()=>{
 const x=scoped();expect(validateForDelivery(x).ok).toBe(true);x.payload.inputs[1].expectedEffect='hard';expect(issues(x)).toContainEqual(expect.objectContaining({code:'INPUT_EFFECT',path:'$.payload.inputs.1.expectedEffect',reason:expect.stringContaining('actual preference-only')}));delete x.payload.inputs[1].expectedEffect;expect(issues(x)).toContainEqual(expect.objectContaining({code:'DECLARATION_MISSING',path:'$.payload.inputs.1.expectedEffect'}));
});
it('counts conditional hard links and exact combined effects without changing rules',()=>{
 const x=scoped();x.payload.requirements![0].when={mode:'all',clauses:[{input:'reserve',op:'eq',value:true}]};x.payload.inputs[1].expectedEffect='hard-and-preference';expect(validateForDelivery(x).ok).toBe(true);expect(analyzeEnvelope(x)).toHaveProperty('declarationMapping.inputs.1.scope','hard-and-preference');x.payload.rules=[];x.payload.inputs[1].expectedEffect='hard';expect(validateForDelivery(x).ok).toBe(true);x.payload.inputs[1].expectedEffect='preference-only';expect(issues(x).some(i=>i.code==='INPUT_EFFECT')).toBe(true);
});
it('works after arbitrary ID/label/value changes and preserves unknowns and preference withholding',()=>{
 const x=scoped();x.payload.dimensions[0].id='temperature';x.payload.dimensions[0].label='Renamed';x.payload.dimensions[0].unit='C';x.payload.options.forEach((o,n)=>{delete o.values.capacity;o.values.temperature=n===0?-2:4;});x.payload.inputs[0]={...x.payload.inputs[0],id:'ceiling',label:'Unknown ceiling',unit:'C',initial:null};x.payload.requirements![0]={id:'bounds',dimension:'temperature',input:'ceiling',relation:'at-most'};x.payload.inputs[1].id='mood';x.payload.inputs[1].label='任意标签';x.payload.rules[0].when.clauses[0].input='mood';expect(validateForDelivery(x).ok).toBe(true);expect(analyzeEnvelope(x)).toHaveProperty('decisionFacts.unknownFeasibilityIds',['a','b']);const result=decide(x.payload,{ceiling:0,mood:true},true);expect(result.eligibleOptionIds).toEqual(['a']);expect(result.recommendations).toEqual([]);expect(result.requiresPolicyReview).toBe(true);x.payload.inputs[1].expectedEffect='hard';expect(issues(x).some(i=>i.code==='INPUT_EFFECT')).toBe(true);
});
it('preserves all prior protocol payloads and refuses new deliveries that try to bypass declarations',()=>{
 for(const v of [capability,resource]){expect(validateEnvelope(v).ok).toBe(true);expect(analyzeValidated(v)).not.toHaveProperty('declarationMapping');expect(validateForDelivery(v).ok).toBe(false);}const x=fresh();x.protocolVersion='1.3';expect(issues(x).some(i=>i.code==='UNSUPPORTED_VERSION')).toBe(true);
});
it('shows exact fields, roles and expected/actual scope in the existing UI without certifying prose',()=>{
 const x=fresh();const html=renderEnglish(createElement(AppearanceContext.Provider,{value:{theme:defaultTheme,layout:defaultLayout,strictPolicy:true}},createElement(DecisionExplorer,{data:x.payload})));expect(html).toContain('Declaration checks — source unverified');expect(html).toContain('field maintenance (resource-need, unitless)');expect(html).toContain('input teamAvailable (resource-available)');expect(html).toContain('declared expected effect: hard');expect(html).toContain('do not certify the source or model prose');
});

it('retains 1.0/1.1/1.2/1.3 histories without inserting declarations',()=>{
 for(const version of ['1.0','1.1'] as const){const saved={...decision,protocolVersion:version};expect(validateEnvelope(saved).ok).toBe(true);expect(analyzeValidated(saved)).not.toHaveProperty('declarationMapping');}
 expect(validateEnvelope(capability).ok).toBe(true);expect(validateEnvelope(resource).ok).toBe(true);
});
it('keeps roles and expected effects in portable template contracts without transferring data',()=>{
 const view=fresh(),revision={version:1,name:'Explicit fields',definition:extractDefinition(view),theme:defaultTheme,layout:defaultLayout};const doc=parseBounded(exportSchema,exportTemplate(revision));expect(JSON.stringify(doc)).toContain('resource-available');expect(JSON.stringify(doc)).toContain('expectedEffect');expect(JSON.stringify(doc)).not.toContain('Provider handles updates');expect(()=>matchTemplate({...doc.template,version:1},view)).not.toThrow();const changed=fresh();changed.payload.inputs[1].expectedEffect='preference-only';expect(()=>matchTemplate(revision,changed)).toThrow('TEMPLATE_INPUT');
});
it('rejects receipt expansion losslessly before delivery instead of truncating links or throwing',()=>{
 const x=fresh(),long=(prefix:string,n:number)=>(prefix+n).padEnd(80,'x');x.payload.dimensions=Array.from({length:12},(_,n)=>({id:long('d',n),label:'Feature '+n,kind:'boolean' as const,semanticRole:'capability-support' as const}));x.payload.inputs=Array.from({length:12},(_,n)=>({id:long('i',n),label:'Need '+n,type:'boolean' as const,semanticRole:'capability-need' as const,expectedEffect:'hard-and-preference' as const,initial:null}));x.payload.options=Array.from({length:8},(_,n)=>({id:long('o',n),label:'Option '+n,values:Object.fromEntries(x.payload.dimensions.map(d=>[d.id,null])),advantages:[],disadvantages:[],suitableWhen:'Declared only',evidence:[]}));x.payload.requirements=Array.from({length:24},(_,n)=>({id:long('q',n),dimension:x.payload.dimensions[n%12].id,input:x.payload.inputs[n%12].id,relation:'supports' as const}));const when={mode:'all' as const,clauses:x.payload.inputs.map(i=>({input:i.id,op:'eq' as const,value:true}))};x.payload.rules=Array.from({length:24},(_,n)=>({id:long('r',n),priority:1,when:structuredClone(when),recommend:[x.payload.options[0].id],reason:'Unverified policy',origin:'model-judgment' as const,evidence:[]}));x.payload.constraints=Array.from({length:24},(_,n)=>({id:long('c',n),optionId:x.payload.options[n%8].id,when:structuredClone(when),reason:'Declared constraint',evidence:[]}));expect(validateEnvelope(x).ok).toBe(true);const result=analyzeEnvelope(x);expect(result).toHaveProperty('status','validation-failed');expect(result).toHaveProperty('issues.0.code','RECEIPT_LIMIT');expect(bounded(result)).toBeUndefined();
});

it('does not certify a consistently mislabeled source or pretend the original translation was fixed',()=>{
 const x=fresh();x.payload.dimensions[1].semanticRole='capability-support';x.payload.inputs[1].semanticRole='capability-need';x.payload.requirements![1].relation='supports';const r=analyzeEnvelope(x);expect(r.status).toBe('validated');expect(r).toHaveProperty('sourceFactsVerified',false);expect(r).toHaveProperty('declarationMapping.sourceFactsVerified',false);expect(JSON.stringify(r)).toContain('not independent source facts');
});

it('supplies current declared fixtures for future focused host suites without mutating old history sources',()=>{
 for(const view of [declaredDecision,...Object.values(currentGroundingFixtures).filter(Boolean)])expect(analyzeEnvelope(view)).toHaveProperty('status','validated');expect(resource.protocolVersion).toBe('1.3');expect(resource.payload).not.toHaveProperty('inputs.0.expectedEffect');
});

function renderEnglish(node:Parameters<typeof renderToStaticMarkup>[0]){return renderToStaticMarkup(createElement(LocaleContext.Provider,{value:'en'},node));}
