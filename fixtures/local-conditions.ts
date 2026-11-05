import {declaredResource} from './consistency';
import type {Envelope} from '../src/protocol';

/** Independent synthetic values for form QA; no model or private source. */
export const localConditions:Extract<Envelope,{component:'DecisionExplorer'}>=structuredClone(declaredResource) as Extract<Envelope,{component:'DecisionExplorer'}>;
localConditions.displayId='local-condition-form';
localConditions.summary='公开合成比较：托管方案容量120，自管方案容量300；自管维护可用性原为未知。本地表单不会补齐未知来源。';
const p=localConditions.payload;
p.title='多条件本地试算（公开合成）';
p.inputs[0].label='需要专用网络';p.inputs[1].label='维护人员可用';
p.dimensions[0].label='支持专用网络';p.dimensions[1].label='需要自行维护';p.dimensions[2].label='价格（未知）';
p.options[0].label='托管方案';p.options[1].label='自管方案';
p.options.forEach(o=>{o.evidence=['仅限公开合成输入。'];o.suitableWhen='逐项核对本地条件；价格未知，无偏好排序。';o.advantages=[];o.disadvantages=[];});
p.dimensions.push({id:'capacity',label:'处理能力',kind:'number',unit:'次/秒'});
p.options[0].values.capacity=120;p.options[1].values.capacity=300;
p.inputs.push({id:'demand',label:'需求量',type:'number',unit:'次/秒',initial:100,expectedEffect:'hard'},{id:'mode',label:'工作模式',type:'choice',choices:['常规','高并发'],initial:'常规',expectedEffect:'hard'});
p.requirements!.push({id:'capacity',dimension:'capacity',input:'demand',relation:'at-least'});
p.constraints.push({id:'high-mode',optionId:'managed',when:{mode:'all',clauses:[{input:'mode',op:'eq',value:'高并发'}]},reason:'合成声明：高并发模式排除托管方案。',evidence:['合成规则，仅用于本地表单验证。']});
