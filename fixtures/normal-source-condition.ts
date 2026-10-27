import type{Envelope}from'../src/protocol';
/** Explicit QA request for a finite synthetic source, never a model candidate. */
export function normalConditionRequest(need:boolean|null,suffix:string){
 const view:Extract<Envelope,{component:'DecisionExplorer'}>={protocolVersion:'1.4',component:'DecisionExplorer',displayId:'normal-source-'+suffix,revision:1,summary:'显式确定性测试载荷；不属于模型正文。',payload:{
  title:'来源当前条件',
  dimensions:[{id:'private',label:'私网',kind:'boolean',semanticRole:'capability-support'},{id:'updates',label:'由供应商更新',kind:'boolean'},{id:'maintenance',label:'需要团队维护',kind:'boolean',semanticRole:'resource-need'},{id:'price',label:'价格'}],
  options:[{id:'hosted',label:'托管空间',values:{private:false,updates:true,maintenance:null,price:null},advantages:[],disadvantages:[],suitableWhen:'仅核来源范围，不提供整体赢家。',evidence:[]},{id:'self',label:'自建节点',values:{private:true,updates:null,maintenance:true,price:null},advantages:[],disadvantages:[],suitableWhen:'仅核来源范围，不提供整体赢家。',evidence:[]}],
  inputs:[{id:'need',label:'当前需要私网',type:'boolean',initial:need,semanticRole:'capability-need',expectedEffect:'hard'},{id:'team',label:'团队有维护余力',type:'boolean',initial:true,semanticRole:'resource-available',expectedEffect:'hard'}],
  requirements:[{id:'net',dimension:'private',input:'need',relation:'supports'},{id:'operations',dimension:'maintenance',input:'team',relation:'requires-availability'}],constraints:[],rules:[],
 }};
 return {view,mapping:{dimensions:[{id:'private',kind:'capability',name:'私网'},{id:'updates',kind:'actor-updates',actor:'供应商'},{id:'maintenance',kind:'maintenance-need',actor:'团队'},{id:'price',kind:'price'}],inputs:[{id:'need',kind:'capability-need',name:'私网'},{id:'team',kind:'actor-available',actor:'团队'}]}};
}
