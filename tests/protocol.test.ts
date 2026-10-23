import {describe,it,expect} from 'vitest';
import {validateEnvelope,LIMITS,type Architecture,type Decision,type Chart} from '../src/protocol';
import {architecture,decision,chart,distribution,examples} from '../fixtures/examples';
import {histogram,numericStats,decide} from '../src/math';
import {GUIDANCE,TOOL_DESCRIPTION} from '../src/dsh/guidance';
import {describe as describeComponent} from '../src/dsh/host';
const arch=()=>structuredClone(architecture) as typeof architecture&{component:'ArchitectureExplorer';payload:Architecture};
const dec=()=>structuredClone(decision) as typeof decision&{component:'DecisionExplorer';payload:Decision};
const hist=()=>structuredClone(distribution) as typeof distribution&{component:'DataChart';payload:Extract<Chart,{chartType:'histogram'}>};
const rejects=(x:unknown,code?:string)=>{const r=validateEnvelope(x);expect(r.ok).toBe(false);if(!r.ok&&code)expect(r.issues.some(i=>i.code===code)).toBe(true);};
describe('bounded protocol and semantic correctness',()=>{
 it('accepts all fictional reference cases',()=>examples.forEach(x=>expect(validateEnvelope(x).ok).toBe(true)));
 it('rejects unsupported protocol without silently migrating history',()=>rejects({...architecture,protocolVersion:'9.0'},'UNSUPPORTED_VERSION'));
 it('rejects unknown components and executable fields',()=>{rejects({...architecture,component:'Code'});rejects({...architecture,callback:'alert(1)'});rejects({...chart,payload:{...chart.payload,option:{}}});});
 it('rejects duplicate IDs and dangling references',()=>{const p=arch();p.payload.nodes.push(p.payload.nodes[0]);rejects(p,'DUPLICATE_ID');const q=arch();q.payload.edges[0].target='missing';rejects(q,'REFERENCE');});
 it('rejects fabricated or wrong-direction scenario paths',()=>{const p=arch();p.payload.scenarios[0].nodeIds.reverse();rejects(p,'PATH');const q=arch();q.payload.scenarios[0].edgeIds=['read'];rejects(q,'PATH');});
 it('retains cycles and undirected paths',()=>{const p=arch();p.payload.edges.push({id:'cycle',source:'db',target:'api',directed:true,type:'notify',evidence:[]});expect(validateEnvelope(p).ok).toBe(true);p.payload.edges[0].directed=false;p.payload.scenarios=[{id:'back',label:'Reverse undirected',nodeIds:['queue','api'],edgeIds:['enqueue'],explanation:'A supplied undirected relationship.'}];expect(validateEnvelope(p).ok).toBe(true);});
 it('rejects missing common dimensions and invented input types',()=>{const p=dec();delete p.payload.options[0].values.price;rejects(p);const q=dec();q.payload.rules[0].when.clauses[0].op='gt';rejects(q);});
 it('rejects incorrect row/series alignment, NaN, infinity and scripts',()=>{for(const value of [NaN,Infinity,()=>1])rejects({...chart,payload:{...chart.payload,rows:[{id:'x',x:'2026-01-01T00:00:00Z',values:{a:value,b:null}}]}});});
 it('rejects invalid timestamps, timezone and duplicated x values',()=>{const p=structuredClone(chart);if(p.component!=='DataChart'||p.payload.chartType==='histogram')return;p.payload.x.timezone='Not/AZone';rejects(p);p.payload.x.timezone='UTC';p.payload.rows[0].x='yesterday';rejects(p);});
 it('enforces byte, nesting and computational bounds',()=>{rejects({...architecture,summary:'x'.repeat(LIMITS.bytes)},'BYTE_LIMIT');let a:unknown={};for(let i=0;i<20;i++)a={child:a};rejects(a,'DEPTH_LIMIT');const p=arch();p.payload.nodes=Array.from({length:81},(_,i)=>({...p.payload.nodes[0],id:`n${i}`}));rejects(p);});
 it('rejects cycles and polluted keys',()=>{const v:{cycle?:unknown}={};v.cycle=v;rejects(v,'NON_JSON');rejects(JSON.parse('{"__proto__":{}}'),'NON_JSON');});
 it('rejects unequal bins, out-of-range observations and ambiguous counts',()=>{const p=hist();p.payload.source.boundaries=[0,1,1];rejects(p);const q=hist();q.payload.source={mode:'prebinned',boundaries:[0,1,2],groups:[{id:'a',label:'A',counts:[2],missing:0}]};rejects(q);});
 it('rejects unequal-width bins instead of drawing misleading equal-width bars',()=>{const p=hist();p.payload.source.boundaries=[0,2,6];rejects(p,'BIN_WIDTH');p.payload.source.boundaries=[1e16,1e16+2,1e16+6];rejects(p,'BIN_WIDTH');p.payload.source={mode:'observations',boundaries:[0,0.1,0.2,0.3],groups:[{id:'a',label:'A',observations:[0,0.1,0.3,null]}]};expect(validateEnvelope(p).ok).toBe(true);});
 it('rejects duplicate time instants even when offsets differ',()=>{const p=structuredClone(chart);if(p.component!=='DataChart'||p.payload.chartType==='histogram')return;p.payload.rows[1].x='2026-01-01T08:00:00+08:00';rejects(p);});
});
describe('deterministic comparisons',()=>{
 it('changes recommendation only when conditions change',()=>{const p=dec().payload;expect(decide(p,{private:false}).recommendations).toEqual(['managed']);expect(decide(p,{private:true}).recommendations).toEqual(['vm']);});
 it('keeps unknown distinct from false and zero',()=>{const p=dec().payload;expect(decide(p,{private:null}).status).toBe('insufficient');expect(decide(p,{}).recommendations).toEqual([]);});
 it('combines equal-priority recommendations and honors hard constraints',()=>{const p=dec().payload;p.rules.push({...p.rules[0],id:'tie',recommend:['vm']});expect(decide(p,{private:false}).recommendations).toEqual(['managed','vm']);p.rules=[{...p.rules[1],recommend:['managed']}];expect(decide(p,{private:true}).status).toBe('blocked');});
 it('withholds a known winner if an unknown higher-priority rule could override it',()=>{const p=dec().payload;p.rules[1].when.clauses=[{input:'budget',op:'gt',value:2}];expect(decide(p,{private:false,budget:null}).status).toBe('insufficient');});
 it('names unknown conditions that actually block a result without treating false or zero as missing',()=>{const p=dec().payload;p.inputs.push({id:'budget',label:'Available budget',type:'number',initial:null});p.rules[1].when.clauses=[{input:'budget',op:'gt',value:2}];expect(decide(p,{private:false,budget:null}).missingInputs).toEqual([{id:'budget',label:'Available budget'}]);expect(decide(p,{private:false,budget:0}).missingInputs).toEqual([]);p.rules[1].when.clauses=[{input:'private',op:'eq',value:true}];p.constraints[0].when.clauses=[{input:'budget',op:'lt',value:1}];p.constraints[0].optionId='managed';expect(decide(p,{private:false}).missingInputs).toEqual([{id:'budget',label:'Available budget'}]);});
});
describe('numeric semantics',()=>{
 it('preserves zero, negatives and null in mean and sample count',()=>expect(numericStats([null,0,-3,3])).toEqual({n:3,missing:1,sum:0,mean:0,min:-3,max:3}));
 it('returns unknown means for empty or all-missing selections',()=>{expect(numericStats([]).mean).toBe(null);expect(numericStats([null,null]).n).toBe(0);expect(numericStats([0,0]).mean).toBe(0);});
 it('bins exact boundaries once, including the upper edge only in the final bin',()=>{const p=hist().payload;const h=histogram(p.source);expect(h[0].counts).toEqual([2,3,3]);expect(h[0].n).toBe(8);expect(h[0].missing).toBe(1);expect(h[0].proportions.reduce<number>((a,x)=>a+(x??0),0)).toBe(1);});
 it('keeps prebinned counts explicit and handles zero-denominator groups',()=>{const h=histogram({mode:'prebinned',boundaries:[0,1,2],groups:[{id:'a',label:'A',counts:[0,0],missing:3}]});expect(h[0].proportions).toEqual([null,null]);});
});
describe('single tool-delivery contract',()=>{
 it('describes every catalog schema on demand',()=>{for(const c of ['ArchitectureExplorer','DecisionExplorer','DataChart']as const){const d=describeComponent(c);expect(JSON.stringify(d.payloadSchema)).toContain('"additionalProperties":false');expect(d.delivery).toContain('action=render');}});
 it('keeps its own delivery on the tool channel while allowing other plugin protocols',()=>{expect(GUIDANCE).toContain("Never output this plugin's UI specs or JSON/JSONL fences");expect(GUIDANCE).toContain('Other enabled plugins retain their own protocols');expect(TOOL_DESCRIPTION).toContain('action=describe');expect(GUIDANCE).not.toContain('catalog.prompt');});
});
it('rejects accessors without executing them and invalid calendar dates',()=>{let called=false;const v={get payload(){called=true;return {};}};rejects(v,'NON_JSON');expect(called).toBe(false);const p=structuredClone(chart);if(p.component==='DataChart'&&p.payload.chartType!=='histogram'){p.payload.rows[0].x='2026-02-31T00:00:00Z';rejects(p);}});
