import {readFileSync} from 'node:fs';
import type {Envelope} from '../src/protocol';
export const capacityExpectations=JSON.parse(readFileSync(new URL('./source-capacity-expectations.json',import.meta.url),'utf8'));
/** Independently frozen data, not a parser-generated request or model observation. */
export function capacityRequest(index=0,suffix='fixture'){
 const s=capacityExpectations.cases[index];
 const mapping={capacityDimensionId:'limit-'+suffix,demandInputId:'quantity-'+suffix,requirementId:'cover-'+suffix};
 const view:Extract<Envelope,{component:'DecisionExplorer'}>={protocolVersion:'1.4',component:'DecisionExplorer',displayId:'capacity-'+suffix,revision:1,summary:'UNVERIFIED_MODEL_SUMMARY',payload:{title:'UNVERIFIED_MODEL_TITLE',dimensions:[{id:mapping.capacityDimensionId,label:'容量上限',kind:'number',unit:s.unit}],options:s.options.map((label:string,i:number)=>({id:'option-'+suffix+'-'+i,label,values:{[mapping.capacityDimensionId]:s.ceilings[i]},advantages:['UNVERIFIED_DEPLOYMENT_MAINTENANCE'],disadvantages:['UNVERIFIED_COST'],suitableWhen:'UNVERIFIED_FUTURE_PLAN',evidence:[]})),inputs:[{id:mapping.demandInputId,label:'需求容量',type:'number',unit:s.unit,initial:s.current,expectedEffect:'hard'}],requirements:[{id:mapping.requirementId,dimension:mapping.capacityDimensionId,input:mapping.demandInputId,relation:'at-least'}],rules:[],constraints:[]}};
 return {view,mapping};
}
