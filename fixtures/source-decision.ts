import {readFileSync} from 'node:fs';
import type {Envelope} from '../src/protocol';

// Offline first-attempt data is kept unchanged. This explicit new view is a
// source-comparison fixture, not a corrected natural-model run.
export const d1Record=JSON.parse(readFileSync(new URL('../docs/evidence/natural/r9-D1.json',import.meta.url),'utf8'));
export const d1FirstView:Envelope=d1Record.actualToolCalls.find((c:{arguments?:{view?:unknown}})=>c.arguments?.view).arguments.view;
export const d1Mapping={dimensions:[{id:'private_net',kind:'capability',name:'私网'},{id:'vendor_managed',kind:'actor-updates',actor:'供应商'},{id:'team_maint',kind:'maintenance-need',actor:'团队'},{id:'price',kind:'price'}],inputs:[{id:'need_private_net',kind:'capability-need',name:'私网'},{id:'team_capacity',kind:'actor-available',actor:'团队'}]};
export function sourceAlignedD1():Envelope{
 const view=structuredClone(d1FirstView);if(view.component!=='DecisionExplorer')throw Error('Expected recorded comparison.');
 view.protocolVersion='1.4';view.summary='Source-aligned offline fixture; free prose is not verified.';
 view.payload.dimensions[0].semanticRole='capability-support';view.payload.dimensions[2].semanticRole='resource-need';
 const price=view.payload.dimensions[3];price.label='价格';delete price.kind;delete price.unit;
 view.payload.options[0].values.team_maint=null;view.payload.options[1].values.vendor_managed=null;
 view.payload.inputs[0].semanticRole='capability-need';view.payload.inputs[0].expectedEffect='hard';view.payload.inputs[1].semanticRole='resource-available';view.payload.inputs[1].expectedEffect='hard';
 view.payload.requirements![1].relation='requires-availability';
 return view;
}
