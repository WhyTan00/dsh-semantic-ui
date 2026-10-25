import { z } from 'zod';
import {presentationSchema} from './theme';

export const VERSION = '1.2' as const;
export const LIMITS = { bytes: 131072, depth: 12, nodes: 80, edges: 240, rows: 2000, observations: 10000 } as const;
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/);
const text = z.string().min(1).max(1200);
const label = z.string().min(1).max(80);
const evidence = z.array(text).max(12).default([]);
const finite = z.number().finite();
export const architectureSchema = z.strictObject({
  title: label,
  nodes: z.array(z.strictObject({ id, label, responsibility: text, constraints: z.array(text).max(8).default([]), evidence })).max(LIMITS.nodes),
  edges: z.array(z.strictObject({ id, source: id, target: id, directed: z.boolean(), type: label, label: label.optional(), evidence })).max(LIMITS.edges),
  scenarios: z.array(z.strictObject({ id, label, nodeIds: z.array(id).min(1).max(80), edgeIds: z.array(id).max(79), explanation: text })).max(12).default([]),
});
const primitive = z.union([finite, z.boolean(), z.string().max(120)]);
const clause = z.strictObject({ input: id, op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']), value: primitive });
const condition = z.strictObject({ mode: z.enum(['all', 'any']), clauses: z.array(clause).min(1).max(12) });
export const decisionSchema = z.strictObject({
  title: label,
  dimensions: z.array(z.strictObject({ id, label, kind:z.enum(['number','boolean']).optional(), unit:label.optional() })).min(1).max(12),
  options: z.array(z.strictObject({ id, label, values: z.record(id, z.union([text,finite,z.boolean()]).nullable()), advantages: z.array(text).max(8), disadvantages: z.array(text).max(8), suitableWhen: text, evidence })).min(2).max(8),
  inputs: z.array(z.strictObject({ id, label, type: z.enum(['number', 'boolean', 'choice']), unit: label.optional(), choices: z.array(label).max(12).optional(), initial: primitive.nullable() })).max(12).default([]),
  rules: z.array(z.strictObject({ id, priority: z.number().int().min(0).max(100), when: condition, recommend: z.array(id).min(1).max(8), reason: text, origin: z.enum(['given', 'model-judgment']), evidence })).max(24).default([]),
  constraints: z.array(z.strictObject({ id, optionId: id, when: condition, reason: text, evidence })).max(24).default([]),
  requirements:z.array(z.strictObject({id,dimension:id,input:id,relation:z.enum(['at-least','at-most','supports']),when:condition.optional()})).max(24).optional(),
});
const seriesSchema = z.array(z.strictObject({ id, label })).min(1).max(8);
const boundaries = z.array(finite).min(2).max(81);
const histSource = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('observations'), boundaries, groups: z.array(z.strictObject({ id, label, observations: z.array(finite.nullable()).max(LIMITS.observations) })).min(1).max(8) }),
  z.strictObject({ mode: z.literal('prebinned'), boundaries, groups: z.array(z.strictObject({ id, label, counts: z.array(z.number().int().nonnegative()).max(80), missing: z.number().int().nonnegative() })).min(1).max(8) }),
]);
export const chartSchema = z.discriminatedUnion('chartType', [
  z.strictObject({ chartType: z.enum(['line', 'bar']), title: label, unit: label, x: z.strictObject({ kind: z.enum(['time', 'category']), timezone: label.optional(), granularity: label.optional(), order: z.enum(['ascending', 'input']) }), series: seriesSchema, rows: z.array(z.strictObject({ id, x: text, values: z.record(id, finite.nullable()) })).max(LIMITS.rows), fullDataExplanation: text.optional() }),
  z.strictObject({ chartType: z.literal('histogram'), title: label, unit: label, display: z.enum(['count', 'proportion']), source: histSource, fullDataExplanation: text.optional() }),
]);
export const components = { ArchitectureExplorer: architectureSchema, DecisionExplorer: decisionSchema, DataChart: chartSchema } as const;
export type ComponentName = keyof typeof components;
const base = { protocolVersion: z.enum(['1.0','1.1',VERSION]), displayId: id, revision: z.number().int().min(1).max(100000), summary: z.string().min(1).max(500), presentation:presentationSchema.optional() };
export const envelopeSchema = z.discriminatedUnion('component', [
  z.strictObject({ ...base, component: z.literal('ArchitectureExplorer'), payload: architectureSchema }),
  z.strictObject({ ...base, component: z.literal('DecisionExplorer'), payload: decisionSchema }),
  z.strictObject({ ...base, component: z.literal('DataChart'), payload: chartSchema }),
]);
export type Envelope = z.infer<typeof envelopeSchema>;
export type Architecture = z.infer<typeof architectureSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Chart = z.infer<typeof chartSchema>;
export interface Issue { code: string; path: string; reason: string; hint: string }
export type Validation = { ok: true; value: Envelope } | { ok: false; issues: Issue[] };
export function bounded(input: unknown): Issue | undefined {
  let bytes = 0;
  const seen = new WeakSet<object>();
  function walk(v: unknown, depth: number): void {
    if (depth > LIMITS.depth) throw Error('DEPTH_LIMIT');
    if (v === null) { bytes += 4; return; }
    if (typeof v === 'string') { bytes += new TextEncoder().encode(JSON.stringify(v)).length; }
    else if (typeof v === 'boolean') bytes += 5;
    else if (typeof v === 'number' && Number.isFinite(v)) bytes += String(v).length;
    else if (typeof v === 'object' && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)) {
      if (seen.has(v)) throw Error('NON_JSON'); seen.add(v); bytes += 2;
      const descriptors=Object.getOwnPropertyDescriptors(v);if(Object.getOwnPropertySymbols(v).length||Object.values(descriptors).some(d=>'get'in d||'set'in d))throw Error('NON_JSON');
      const entries = Object.entries(descriptors).filter(([k])=>!Array.isArray(v)||k!=='length').map(([k,d])=>[k,d.value]as const);
      for (const [k, child] of entries) { if (['__proto__', 'constructor', 'prototype'].includes(k)) throw Error('NON_JSON'); bytes += Array.isArray(v)?1:new TextEncoder().encode(JSON.stringify(k)).length+2; walk(child, depth + 1); if (bytes > LIMITS.bytes) throw Error('BYTE_LIMIT'); }
      seen.delete(v);
    } else throw Error('NON_JSON');
    if (bytes > LIMITS.bytes) throw Error('BYTE_LIMIT');
  }
  try { walk(input, 0); } catch(e) { return { code: (e as Error).message, path: '$', reason: 'Input must be bounded, finite, plain JSON data.', hint: `Use at most ${LIMITS.bytes} bytes and ${LIMITS.depth} levels; remove scripts, cycles, and unsupported values.` }; }
}
export function validateEnvelope(input: unknown): Validation {
  const budget = bounded(input); if (budget) return { ok: false, issues: [budget] };
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map(i => ({ code: i.path[0] === 'protocolVersion' ? 'UNSUPPORTED_VERSION' : 'STRUCTURE', path: '$.' + i.path.join('.'), reason: i.message, hint: 'Call dsh_semantic_ui with action=describe for the component schema; submit pure data matching it.' })) };
  const v = parsed.data; const issues: Issue[] = [];
  if(v.protocolVersion==='1.0'&&v.presentation)issues.push({code:'UNSUPPORTED_VERSION',path:'$.presentation',reason:'Presentation snapshots require protocol 1.1.',hint:'Use protocolVersion 1.1; existing 1.0 checkpoints remain readable.'});
  const fail = (path: string, reason: string, code = 'SEMANTIC') => issues.push({ code, path: '$.payload.' + path, reason, hint: 'Correct the source facts or explicitly mark the value unknown. Do not invent replacements.' });
  const unique = (items: {id:string}[], path:string) => { const ids=new Set<string>(); for(const item of items) { if(ids.has(item.id)) fail(path,`Duplicate ID: ${item.id}`,'DUPLICATE_ID');ids.add(item.id); } return ids; };
  if (v.component === 'ArchitectureExplorer') {
    const p = v.payload; const nodes=unique(p.nodes,'nodes');unique(p.edges,'edges');unique(p.scenarios,'scenarios');const edges = new Map(p.edges.map(e=>[e.id,e]));
    for(const e of p.edges) if(!nodes.has(e.source)||!nodes.has(e.target)) fail('edges',`Edge ${e.id} references an unknown node.`,'REFERENCE');
    for(const s of p.scenarios) {
      if(s.edgeIds.length !== s.nodeIds.length-1) fail('scenarios',`Scenario ${s.id} needs one edge between each pair of nodes.`,'PATH');
      s.nodeIds.forEach(n=>{if(!nodes.has(n))fail('scenarios',`Unknown scenario node ${n}.`,'PATH');});
      s.edgeIds.forEach((eid,i)=>{const e=edges.get(eid),a=s.nodeIds[i],b=s.nodeIds[i+1];if(!e||!((e.source===a&&e.target===b)||(!e.directed&&e.target===a&&e.source===b))) fail('scenarios',`Scenario ${s.id}: edge ${eid} does not connect ${a} to ${b} in its declared direction.`,'PATH');});
    }
  } else if(v.component==='DecisionExplorer') {
    const p=v.payload;const dims=unique(p.dimensions,'dimensions'),opts=unique(p.options,'options'),inputs=unique(p.inputs,'inputs');unique(p.rules,'rules');unique(p.constraints,'constraints');unique(p.requirements??[],'requirements');
    const defs=new Map(p.inputs.map(i=>[i.id,i]));
    for(const o of p.options) {for(const k of Object.keys(o.values))if(!dims.has(k))fail('options',`Unknown dimension ${k}.`,'REFERENCE');for(const k of dims)if(!(k in o.values))fail('options',`Option ${o.id} must explicitly set dimension ${k} to a fact or null.`);}
    if(v.protocolVersion!==VERSION&&(p.requirements||p.dimensions.some(d=>d.kind||d.unit)||p.options.some(o=>Object.values(o.values).some(v=>typeof v==='number'))))fail('dimensions','Typed numeric comparisons require protocol 1.2.','UNSUPPORTED_VERSION');
    for(const d of p.dimensions){
      if(d.kind==='number'&&!d.unit)fail('dimensions',`Numeric dimension ${d.id} needs an explicit unit.`);
      if(d.kind==='boolean'&&d.unit)fail('dimensions',`Boolean dimension ${d.id} must not carry a numeric unit.`);
      if(d.unit&&!d.kind)fail('dimensions',`Dimension ${d.id} must declare kind=number when a unit is supplied.`);
      for(const o of p.options){const value=o.values[d.id];if(v.protocolVersion===VERSION&&typeof value==='string'&&/^(unknown|未知|不详|未给|未提供|未确认|not (given|known|provided))/i.test(value.trim()))fail('options',`Option ${o.id}, dimension ${d.id}: unknown values must be null, not prose.`);if(value!==null&&value!==undefined&&typeof value!==(d.kind??'string'))fail('options',`Option ${o.id}, dimension ${d.id}: use ${d.kind??'text'} or null.`);}
    }
    for(const r of p.requirements??[]){const d=p.dimensions.find(d=>d.id===r.dimension),i=defs.get(r.input);if(!d||!i)fail('requirements',`Requirement ${r.id} references an unknown dimension or input.`,'REFERENCE');else if(r.relation==='supports'?(d.kind!=='boolean'||i.type!=='boolean'||!!d.unit||!!i.unit):(d.kind!=='number'||i.type!=='number'||!d.unit||d.unit!==i.unit))fail('requirements',`Requirement ${r.id} needs matching typed facts and input: supports uses unitless booleans; numeric comparisons use exactly the same explicit unit. No implicit conversion.`);}
    const validInput=(i:Decision['inputs'][number],value:unknown)=>value===null||(i.type==='number'?typeof value==='number':i.type==='boolean'?typeof value==='boolean':typeof value==='string'&&i.choices?.includes(value));
    for(const i of p.inputs){if(i.type==='choice'&&(!i.choices?.length||new Set(i.choices).size!==i.choices.length))fail('inputs',`Choice input ${i.id} needs unique choices.`);if(!validInput(i,i.initial))fail('inputs',`Initial value of ${i.id} does not match its type.`);}
    for(const r of [...p.rules,...p.constraints,...(p.requirements??[]).filter(r=>r.when).map(r=>({when:r.when!}))]) for(const c of r.when.clauses){const i=defs.get(c.input);if(!inputs.has(c.input)||!i)fail('rules',`Unknown condition input ${c.input}.`,'REFERENCE');else if(!validInput(i,c.value)||(!['eq','ne'].includes(c.op)&&i.type!=='number'))fail('rules',`Invalid comparison for ${c.input}.`);}
    for(const r of p.rules)for(const o of r.recommend)if(!opts.has(o))fail('rules',`Unknown recommended option ${o}.`,'REFERENCE');
    for(const c of p.constraints)if(!opts.has(c.optionId))fail('constraints',`Unknown constrained option ${c.optionId}.`,'REFERENCE');

  } else {
    const p=v.payload;
    if(p.chartType==='histogram') {
      const b=p.source.boundaries; if(b.some((x,i)=>i>0&&x<=b[i-1]))fail('source.boundaries','Bin boundaries must be strictly increasing.');
      const width=b[1]-b[0];
      if(!Number.isFinite(width)||b.some((x,i)=>i>0&&Math.abs((x-b[i-1])-width)>Math.abs(width)*1e-9))fail('source.boundaries','This version supports equal-width histogram bins only. Unequal widths require density semantics and a different axis; do not relabel them as equal-width bins.','BIN_WIDTH');
      unique(p.source.groups,'source.groups');
      let count=0;
      for(const g of p.source.groups)if('observations'in g){count+=g.observations.length;if(g.observations.some(n=>n!==null&&(n<b[0]||n>b[b.length-1])))fail('source.groups',`Group ${g.id} has observations outside the declared bins.`);}else if(g.counts.length!==b.length-1||g.counts.some(n=>!Number.isSafeInteger(n))||!Number.isSafeInteger(g.counts.reduce((a,n)=>a+n,0)))fail('source.groups','Prebinned counts must match bins and remain safe integers.');
      if(count>LIMITS.observations)fail('source.groups','Combined observation count exceeds the limit.','COMPUTE_LIMIT');
    } else {
      const ss=unique(p.series,'series');unique(p.rows,'rows');
      if(p.x.kind==='time'&&(!p.x.timezone||!p.x.granularity))fail('x','Time data needs timezone and granularity.');
      if(p.x.kind==='time'){try{new Intl.DateTimeFormat('en',{timeZone:p.x.timezone});}catch{fail('x.timezone','Use an IANA timezone.');}}
      const xs=new Set<string>();
      for(const row of p.rows){const xKey=p.x.kind==='time'?String(Date.parse(row.x)):row.x;if(xs.has(xKey))fail('rows',`Repeated x value ${row.x}; pre-aggregate with an explicit method instead.`);xs.add(xKey);
        if(p.x.kind==='time'&&(!z.iso.datetime({offset:true}).safeParse(row.x).success||!Number.isFinite(Date.parse(row.x))))fail('rows',`Time ${row.x} needs a valid ISO timestamp with explicit offset.`);
        for(const s of ss)if(!(s in row.values))fail('rows',`Row ${row.id}: series ${s} must be a number or explicit null.`);
        for(const s of Object.keys(row.values))if(!ss.has(s))fail('rows',`Unknown series ${s}.`,'REFERENCE');
      }
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: v };
}
