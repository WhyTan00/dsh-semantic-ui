import {readFileSync} from 'node:fs';
import type {Envelope} from '../src/protocol';
export const workflowExpectations=JSON.parse(readFileSync(new URL('./source-workflow-expectations.json',import.meta.url),'utf8'));
export const a2WorkflowSource=workflowExpectations.source.text as string;
/** Explicit data fixture; neither a model answer nor a parser implementation. */
export function workflowRequest(names=['入口','鉴权','库存','支付','通知'],suffix='fixture'){
 const id=(i:number)=>'node-'+suffix+'-'+i;
 const view:Extract<Envelope,{component:'ArchitectureExplorer'}>={protocolVersion:'1.4',component:'ArchitectureExplorer',displayId:'workflow-'+suffix,revision:1,summary:'UNVERIFIED_MODEL_SUMMARY',payload:{title:'UNVERIFIED_MODEL_TITLE',nodes:names.map((label,i)=>({id:id(i),label,responsibility:'UNVERIFIED_EXECUTION_COMPLETE',constraints:['UNVERIFIED_ROLLBACK_GUARANTEE'],evidence:[]})),edges:names.slice(1).map((_,i)=>({id:'edge-'+suffix+'-'+i,source:id(i),target:id(i+1),directed:true,type:'declared',label:'UNVERIFIED_CAUSAL_EDGE',evidence:[]})),scenarios:[{id:'path-'+suffix,label:'UNVERIFIED_FAILURE_PATH',nodeIds:names.map((_,i)=>id(i)),edgeIds:names.slice(1).map((_,i)=>'edge-'+suffix+'-'+i),explanation:'UNVERIFIED_REVERSE_PROPAGATION'}]}};
 return {view,mapping:{failurePolicies:[{trigger:id(names.length-1),retryOnly:[id(names.length-1)],noRollback:[id(names.length-2)]}]}};
}
