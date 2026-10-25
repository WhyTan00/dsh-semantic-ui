import type {Context} from '@deepseek-ai/cordis';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {decision,chart} from '../../fixtures/examples';
import {proposal} from '../../fixtures/grounding';
export const name='semantic-history-fixture';
export const inject=['tools','sessionProjections'];
/** Fixture-only old-protocol checkpoints through the standard public output path.
 * Never edits saved logs or participates in production packages. */
export function apply(ctx:Context){ctx.tools.register(defineTool({name:'semantic_history_fixture',description:'Deterministic legacy protocol snapshot for isolated compatibility tests only.',parameters:{component:{type:'string',enum:['DecisionExplorer','DataChart']},version:{type:'string',enum:['1.0','1.1','1.2'],required:true}},output:{schema:{type:'object',additionalProperties:true},render:()=>[{type:'text',text:'Deterministic old-protocol checkpoint persisted.'}],presentationMeta:(_args,value)=>({dshSemanticUi:value})},async execute(args,exec){
 if(!exec.agent)throw Error('Fixture needs a real session');
 const view=structuredClone(args.component==='DataChart'?chart:args.version==='1.2'?proposal:decision);view.protocolVersion=args.version as '1.0'|'1.1'|'1.2';view.displayId='historical-'+args.version.replace('.','-');view.payload.title=(args.component==='DataChart'?'Historical chart protocol ':'Historical protocol ')+args.version;view.summary='Original '+args.version+' model summary, preserved without reinterpretation.';
 const boundary=ctx.sessionProjections.stateOf(exec.agent.session,'turnBoundary');if(!boundary||boundary.openTurnStartSeq===null)throw Error('Fixture needs an open turn');return {turn:boundary.lastTurn,view};
}}));}
