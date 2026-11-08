import {defaultTheme,defaultLayout} from '../../src/theme';
import type {TaskTemplate,TaskSource,TaskDraft} from '../../src/task-form/core';
export const exampleTaskTemplate:TaskTemplate={format:'dsh-semantic-ui-task-template',version:1,id:'6aa13c61-d2cf-4fe9-8d3e-17692b66a438',revision:1,name:'资料整理任务',description:'公开合成演示。规则阈值由模板明示，仅用于记录核对，不构成推荐或行动许可。',theme:defaultTheme,layout:defaultLayout,fields:[
 {id:'purpose',label:'任务用途',type:'text',required:true,hint:'普通文字，不执行脚本。',maxLength:400},
 {id:'size',label:'容量需求',type:'number',required:true,hint:'零也是真实输入；不会从备注推断。',unit:'GiB',min:0,max:10000},
 {id:'location',label:'保存位置',type:'choice',required:true,hint:'明确选择，不自动决定。',choices:['本地','云端']},
 {id:'share',label:'来源允许外传',type:'boolean',required:true,hint:'仅记录本地答案，不认证真实权限。'},
 {id:'budget',label:'月预算',type:'number',required:false,hint:'不知道时保持未知。',unit:'元/月',min:0,max:20000},
 {id:'note',label:'补充说明',type:'text',required:false,hint:'可留未知；内容只作为文字。',maxLength:800},
 ],rules:[{id:'size-check',label:'容量需求不超过100 GiB',when:{mode:'all',clauses:[{input:'size',op:'lte',value:100}]}},{id:'share-check',label:'所填来源允许外传',when:{mode:'all',clauses:[{input:'share',op:'eq',value:true}]}},{id:'budget-check',label:'已知月预算至少50元/月',when:{mode:'all',clauses:[{input:'budget',op:'gte',value:50}]}}]};
export const exampleSourceA:TaskSource={id:'3eb57e7c-1822-4f5e-a5d8-ed5981451420',revision:1,title:'公开合成输入A',text:'本地档案整理：暂不需要新增容量（0 GiB），保存在本地，不允许外传，月预算未知。'};
export const exampleSourceB:TaskSource={id:'7463177d-4288-4554-a231-ce3e8b242f13',revision:1,title:'公开合成输入B',text:'公开演示整理：容量需求120 GiB，选择云端，允许外传，月预算80元/月。这是与A不同的任务。'};
export const exampleAnswersA:TaskDraft={purpose:{mode:'value',text:'本地档案整理'},size:{mode:'value',text:'0'},location:{mode:'value',text:'本地'},share:{mode:'value',text:'false'},budget:{mode:'unknown',text:''},note:{mode:'unknown',text:''}};
export const exampleAnswersB:TaskDraft={purpose:{mode:'value',text:'公开演示整理'},size:{mode:'value',text:'120'},location:{mode:'value',text:'云端'},share:{mode:'value',text:'true'},budget:{mode:'value',text:'80'},note:{mode:'value',text:'第二份新输入，不继承A的答案。'}};
