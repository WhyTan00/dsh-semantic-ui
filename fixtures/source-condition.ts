import {readFileSync} from 'node:fs';
import type {Envelope} from '../src/protocol';
export const conditionSamples=JSON.parse(readFileSync(new URL('./source-condition.json',import.meta.url),'utf8')).samples as {id:string;source:string;question:string;sourceSha256:string;questionSha256:string}[];
/** Explicit fixture, not a generated model answer. Names/IDs do not select parsing. */
export function conditionRequest(options=['雪松','白桦'],name='离线',need:boolean|null=false,supports:(boolean|null)[]=[true,false],suffix='explicit'){
 const view:Extract<Envelope,{component:'DecisionExplorer'}>={protocolVersion:'1.4',component:'DecisionExplorer',displayId:'condition-'+suffix,revision:1,summary:'Explicit host/test projection; not a model candidate.',payload:{title:'来源当前需求',dimensions:[{id:'cap-'+suffix,label:name,kind:'boolean',semanticRole:'capability-support'},{id:'price-'+suffix,label:'价格'}],options:options.map((label,i)=>({id:'option-'+i+'-'+suffix,label,values:{['cap-'+suffix]:supports[i],['price-'+suffix]:null},advantages:[],disadvantages:[],suitableWhen:'仅本项来源，整体未知。',evidence:[]})),inputs:[{id:'need-'+suffix,label:'当前需要'+name,type:'boolean',initial:need,semanticRole:'capability-need',expectedEffect:'hard'}],requirements:[{id:'requirement-'+suffix,dimension:'cap-'+suffix,input:'need-'+suffix,relation:'supports'}],constraints:[],rules:[]}};
 return {view,mapping:{dimensions:[{id:'cap-'+suffix,kind:'capability',name},{id:'price-'+suffix,kind:'price'}],inputs:[{id:'need-'+suffix,kind:'capability-need',name}]}};
}
