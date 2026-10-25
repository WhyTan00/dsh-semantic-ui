import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {validateEnvelope,type Envelope,type Decision,VERSION} from '../src/protocol';
import {decide,requirementChecks,decisionInputEffects} from '../src/math';
import {analyzeEnvelope} from '../src/core';
import {DecisionExplorer} from '../src/components/DecisionExplorer';
import {AppearanceContext} from '../src/appearance';
import {presentationMeta} from '../src/dsh/host';
import {checkpointOf} from '../src/dsh/definition';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {defaultTheme,defaultLayout} from '../src/theme';
import {capability} from '../fixtures/grounding';
function saved(id:string):Envelope{
 const record=JSON.parse(readFileSync(new URL('../docs/evidence/natural/r9-'+id+'.json',import.meta.url),'utf8'));
 const call=record.actualToolCalls.find((c:any)=>c.name==='dsh_semantic_ui'&&c.arguments.action==='render');
 return structuredClone(call.arguments.view);
}
function correctedMaintenance(){
 const view=saved('D1');if(view.component!=='DecisionExplorer')throw Error();view.protocolVersion=VERSION;
 view.payload.requirements!.find(r=>r.dimension==='team_maint')!.relation='requires-availability';
 for(const r of view.payload.requirements!){const d=view.payload.dimensions.find(d=>d.id===r.dimension)!,i=view.payload.inputs.find(i=>i.id===r.input)!;d.semanticRole=r.relation==='requires-availability'?'resource-need':'capability-support';i.semanticRole=r.relation==='requires-availability'?'resource-available':'capability-need';}
 view.payload.inputs.forEach(i=>i.expectedEffect='hard');return view;
}
describe('boolean source mapping directions',()=>{
 it('preserves the original D1 counterexample and requires explicit source correction',()=>{
  const original=saved('D1');if(original.component!=='DecisionExplorer')throw Error();
  expect(validateEnvelope(original).ok).toBe(true);
  expect(decide(original.payload,{need_private_net:false,team_capacity:true},true).excludedOptionIds).toEqual(['hosted']);
  const corrected=correctedMaintenance();expect(validateEnvelope(corrected).ok).toBe(true);
  expect(decide(corrected.payload,{need_private_net:false,team_capacity:true},true).eligibleOptionIds).toEqual(['hosted','vm']);
  const noTeam=decide(corrected.payload,{need_private_net:false,team_capacity:false},true);
  expect(noTeam.eligibleOptionIds).toEqual(['hosted']);expect(noTeam.excludedOptionIds).toEqual(['vm']);expect(noTeam.recommendations).toEqual([]);
  const unknown=decide(corrected.payload,{need_private_net:false,team_capacity:null},true);
  expect(unknown.eligibleOptionIds).toEqual(['hosted']);expect(unknown.unknownFeasibilityIds).toEqual(['vm']);
 });
 it('covers requires-availability truth table without treating unknown as false',()=>{
  const p=structuredClone(capability.payload) as Decision;p.requirements![0].relation='requires-availability';
  const cases:[boolean|null,boolean|null,string][]=[[false,false,'inactive'],[false,true,'inactive'],[false,null,'inactive'],[true,false,'fail'],[true,true,'pass'],[true,null,'unknown'],[null,false,'unknown'],[null,true,'unknown'],[null,null,'unknown']];
  for(const [actual,available,status] of cases){p.options[0].values.network=actual;expect(requirementChecks(p,{needed:available})[0].status).toBe(status);}
 });
 it('keeps supported-capability direction and protocol1.2 history unchanged',()=>{
  const p=capability.payload as Decision;
  expect(validateEnvelope(capability).ok).toBe(true);expect(decide(p,{needed:true},true).eligibleOptionIds).toEqual(['vm']);
  const next=correctedMaintenance();expect(validateEnvelope({...next,protocolVersion:'1.2'}).ok).toBe(false);
  expect(analyzeEnvelope(next)).toHaveProperty('protocolVersion','1.4');
  expect(analyzeEnvelope(next)).toHaveProperty('sourceFactsVerified',false);
 });
 it('preserves conditional inactivity and rejects mixed boolean/numeric units',()=>{
  const x=correctedMaintenance();x.payload.requirements![1].when={mode:'all',clauses:[{input:'need_private_net',op:'eq',value:true}]};
  expect(requirementChecks(x.payload,{need_private_net:false,team_capacity:false}).filter(r=>r.dimensionId==='team_maint').map(r=>r.status)).toEqual(['inactive','inactive']);
  x.payload.inputs.find(i=>i.id==='team_capacity')!.unit='hours';expect(validateEnvelope(x).ok).toBe(false);
 });
});
describe('declared input effect coverage',()=>{
 it('exposes the saved D2 future-reserve control as preference-only, not a hard limit',()=>{
  const original=saved('D2');if(original.component!=='DecisionExplorer')throw Error();
  const before=JSON.stringify(original),effects=decisionInputEffects(original.payload);
  expect(effects.find(e=>e.inputId==='reserveNow')).toMatchObject({scope:'preference-only',affectsEligibility:false,requirementIds:[],constraintIds:[]});
  const a=decide(original.payload,{demand:50,reserveNow:false},true),b=decide(original.payload,{demand:50,reserveNow:true},true);
  expect(a.eligibleOptionIds).toEqual(['A','B']);expect(b.eligibleOptionIds).toEqual(a.eligibleOptionIds);expect(b.recommendations).toEqual([]);
  expect(JSON.stringify(original)).toBe(before);
 });
 it('includes activation clauses and constraints in hard effects, and preserves unused inputs',()=>{
  const p=structuredClone(capability.payload) as Decision;
  p.inputs.push({id:'confirmed',label:'Confirmed',type:'boolean',initial:null},{id:'unused',label:'Unused',type:'boolean',initial:null});
  p.requirements![0].when={mode:'all',clauses:[{input:'confirmed',op:'eq',value:true}]};
  p.constraints.push({id:'ban',optionId:'managed',when:{mode:'all',clauses:[{input:'confirmed',op:'eq',value:false}]},reason:'Declared constraint',evidence:[]});
  expect(decisionInputEffects(p).find(e=>e.inputId==='confirmed')).toMatchObject({scope:'hard',requirementIds:['network-support'],constraintIds:['ban']});
  expect(decisionInputEffects(p).find(e=>e.inputId==='unused')?.scope).toBe('unused');
 });
 it('renders preference-only explanation and explicit mapping, without claiming source verification',()=>{
  const x=saved('D2');if(x.component!=='DecisionExplorer')throw Error();
  const html=renderToStaticMarkup(createElement(AppearanceContext.Provider,{value:{theme:defaultTheme,layout:defaultLayout,strictPolicy:true}},createElement(DecisionExplorer,{data:x.payload})));
  expect(html).toContain('Preference exploration only; does not change hard eligibility.');expect(html).toContain('Condition mapping (declared, not source verified)');expect(html).toContain('preference-only');
 });
});

it('preserves current explicit predicate direction in both persisted tool-result paths',()=>{
 const view=correctedMaintenance(),meta=presentationMeta({view},{status:'delivered',turn:1,protocolVersion:VERSION});
 for(const type of ['tool/result','tool/ptc-dispatch']){
  const checkpoint=checkpointOf(JSON.parse(JSON.stringify({type,data:{meta,isError:false}})));
  expect(checkpoint?.view).toEqual(view);
 }
});
it('returns new requirement direction and input effects through actual MCP stdio',async()=>{
 const transport=new StdioClientTransport({command:process.execPath,args:['--import','tsx','src/mcp-main.ts'],stderr:'pipe'}),client=new Client({name:'direction-contract-check',version:'1.0.0'});
 try{await client.connect(transport);const result=await client.callTool({name:'semantic_ui_check',arguments:{view:correctedMaintenance()}});
  expect(result.structuredContent).toHaveProperty('protocolVersion','1.4');expect(result.structuredContent).toHaveProperty('decisionFacts.eligibleOptionIds',['hosted']);
  expect(result.structuredContent).toHaveProperty('decisionFacts.requirements.2.relation','requires-availability');expect(result.structuredContent).toHaveProperty('decisionFacts.inputEffects.1.affectsEligibility',true);
 }finally{await client.close();await transport.close();}
},20000);
