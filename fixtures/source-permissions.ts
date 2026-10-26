import {readFileSync} from 'node:fs';
import type {Envelope} from '../src/protocol';
export const a3Record=JSON.parse(readFileSync(new URL('../docs/evidence/natural/r9-A3.json',import.meta.url),'utf8'));
export const a3FirstView:Envelope=a3Record.actualToolCalls.find((c:{arguments?:{view?:unknown}})=>c.arguments?.view).arguments.view;
// Explicit positive-projection fixture, not a regenerated natural answer or a
// certification of the old annotations. Negative/local limits live in source.
export function permissionProjectionA3():Envelope{
 const v=structuredClone(a3FirstView);if(v.component!=='ArchitectureExplorer')throw Error();
 v.summary='Explicit source positive-projection fixture; annotations and free prose are unverified.';
 v.payload.nodes.find(n=>n.id==='client')!.label='客户端';
 for(const n of v.payload.nodes){n.responsibility='Positive-projection fixture.';n.constraints=[];n.evidence=[];}
 for(const e of v.payload.edges){e.label=e.type==='read'?'只读':e.type==='read-write'?'读写':'访问';e.evidence=[];}
 v.payload.scenarios=[];return v;
}
