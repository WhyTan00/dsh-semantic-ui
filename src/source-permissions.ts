import {z} from 'zod';
import {bounded,validateEnvelope} from './protocol';
import {SOURCE_LIMITS,sourceMetadata,type SourceSnapshot,type SourceIssue} from './source-graph';

type Span={textByteStart:number;textByteEnd:number};
type Mode='access'|'read-only'|'read-write';
type Access={from:string;to:string;mode:Mode;spans:Span[]};
type Prohibition={from:string;to:string;spans:Span[]};
type Only={from:string;targets:string[];spans:Span[]};
export interface PermissionSource{context:string;nodes:string[];accesses:Access[];prohibitions:Prohibition[];onlyTargets:Only[]}
const bytes=(s:string)=>new TextEncoder().encode(s).length;
const pair=(from:string,to:string)=>JSON.stringify([from,to]);
const namesEqual=(a:string[],b:string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const literalName=(s:string)=>s.length>0&&s.length<=80&&/^[\p{L}\p{N}_ ./:\-]+$/u.test(s)&&!/(访问|允许|禁止|读|写|如果|除非|否则|前者|后者|所有|任何|全局|全体|任意|不|未|无|仅|只|能|可|须|该|此|它|其|但|而|且|或|与|和|及|将|需)/u.test(s);
// Only chooses a grammar for a host message. It never extracts or trusts facts.
export const permissionsSourcePrefix=(s:string)=>/^\s*[^，,。；;\r\n]{1,80}中[，,]/u.test(s);

/** Complete, finite clauses only. No pronoun, alias, causal or conditional inference. */
export function parsePermissionSource(text:string,offset=0):{status:'ready';value:PermissionSource}|{status:'unsupported';issues:SourceIssue[]}{
 const fail=(code:string,reason:string)=>({status:'unsupported' as const,issues:[{code,path:'$.source.excerpt',reason}]});
 if(bytes(text)>SOURCE_LIMITS.excerptBytes)return fail('SOURCE_LIMIT','Permission source exceeds the selected-text byte limit.');
 const intro=/^\s*([^，,。；;\r\n]+?)中[，,]/u.exec(text);
 if(!intro||!literalName(intro[1].trim()))return fail('SOURCE_SYNTAX','Start with a literal context label followed by 中， and complete explicit access clauses.');
 const body=text.slice(intro[0].length),chunks=[...body.matchAll(/[^，,；;。\r\n]+/gu)].filter(m=>m[0].trim());
 if(!chunks.length||chunks.length>64)return fail('SOURCE_LIMIT','Supply one nonempty bounded access document.');
 const nodes=new Set<string>(),accesses=new Map<string,Access>(),prohibitions=new Map<string,Prohibition>(),only=new Map<string,Only>();let count=0;
 for(const [index,chunk]of chunks.entries()){
  const clause=chunk[0].trim();
  if(['请帮我理解边界与耦合','请解释访问边界','请说明访问边界'].includes(clause)){
   if(index!==chunks.length-1)return fail('SOURCE_SYNTAX','The optional supported question must be the last clause.');continue;
  }
  const negative=/^禁止\s*(.+?)\s*访问\s*(.+)$/u.exec(clause);
  const positive=negative?null:/^(.+?)\s*(只能访问|只读|读写|访问)\s*(.+)$/u.exec(clause);
  if(!negative&&!positive)return fail('SOURCE_SYNTAX','Every clause must explicitly name a subject and targets with 访问, 只能访问, 只读, 读写 or 禁止…访问. No clause is silently discarded.');
  const from=(negative?.[1]??positive![1]).trim(),verb=negative?'禁止':positive![2],targetText=negative?.[2]??positive![3];
  const targets=targetText.split(/与|和|、/u).map(s=>s.trim());
  if(!literalName(from)||!targets.length||targets.some(t=>!literalName(t))||new Set(targets).size!==targets.length)return fail('SOURCE_REFERENCE','Use distinct explicit literal entity names; aliases, pronouns and conditional/reference guesses are unsupported.');
  const charStart=intro[0].length+chunk.index!,span={textByteStart:offset+bytes(text.slice(0,charStart)),textByteEnd:offset+bytes(text.slice(0,charStart+chunk[0].length))};
  nodes.add(from);targets.forEach(t=>nodes.add(t));
  if(verb==='只能访问'){
   const old=only.get(from);if(old&&!namesEqual(old.targets,targets))return fail('SOURCE_CONTRADICTION','The same subject has incompatible explicit only-target sets.');
   if(old)old.spans.push(span);else only.set(from,{from,targets,spans:[span]});
  }
  for(const to of targets){
   if(++count>SOURCE_LIMITS.relations||nodes.size>80)return fail('SOURCE_LIMIT','Too many access assertions or entities.');
   const key=pair(from,to);
   if(negative){const old=prohibitions.get(key);if(old)old.spans.push(span);else prohibitions.set(key,{from,to,spans:[span]});continue;}
   const mode:Mode=verb==='只读'?'read-only':verb==='读写'?'read-write':'access',old=accesses.get(key);
   if(old){
    if(old.mode!==mode&&old.mode!=='access'&&mode!=='access')return fail('SOURCE_CONTRADICTION','A subject-target pair is declared both read-only and read-write.');
    if(mode!=='access')old.mode=mode;old.spans.push(span);
   }else accesses.set(key,{from,to,mode,spans:[span]});
  }
 }
 if(!count)return fail('SOURCE_EMPTY','No explicit access assertions were supplied.');
 for(const access of accesses.values()){
  if(prohibitions.has(pair(access.from,access.to)))return fail('SOURCE_CONTRADICTION','The same directed subject-target pair is both permitted and prohibited.');
  const limit=only.get(access.from);if(limit&&!limit.targets.includes(access.to))return fail('SOURCE_CONTRADICTION','An explicit positive access contradicts that subject’s only-target restriction.');
 }
 return {status:'ready',value:{context:intro[1].trim(),nodes:[...nodes],accesses:[...accesses.values()],prohibitions:[...prohibitions.values()],onlyTargets:[...only.values()]}};
}

const name=z.string().min(1).max(80),knownClaims=['access','read','write','only-targets'];
export const sourcePermissionsRequestSchema=z.strictObject({
 view:z.unknown().optional(),
 claims:z.array(z.union([
  z.strictObject({kind:z.enum(['access','read','write']),from:name,to:name,value:z.boolean()}),
  z.strictObject({kind:z.literal('only-targets'),from:name,targets:z.array(name).min(1).max(80)}),
  z.strictObject({kind:name,text:z.string().min(1).max(1200)}).refine(c=>!knownClaims.includes(c.kind),'Known permission claims require their exact typed coordinates; explanatory text is not certified.'),
 ])).max(SOURCE_LIMITS.claims).optional(),
 prose:z.string().max(20000).optional(),
});

function permission(s:PermissionSource,from:string,to:string,kind:'access'|'read'|'write'):{value:boolean|null;spans:Span[]}{
 const ban=s.prohibitions.find(a=>a.from===from&&a.to===to),limit=s.onlyTargets.find(a=>a.from===from);
 if(ban)return {value:false,spans:ban.spans};
 if(limit&&!limit.targets.includes(to))return {value:false,spans:limit.spans};
 const access=s.accesses.find(a=>a.from===from&&a.to===to);if(!access)return {value:null,spans:[]};
 return {value:kind==='access'?true:access.mode==='access'?null:kind==='read'?true:access.mode==='read-write',spans:access.spans};
}

function edgeMode(type:string,label?:string){
 const modes:Record<string,Mode|'read'>={call:'access',access:'access',访问:'access',调用:'access',read:'read',读取:'read','read-only':'read-only',只读:'read-only','read-write':'read-write',读写:'read-write'};
 const mode=modes[type],labelMode=label?modes[label]:undefined;
 if(mode==='read'&&labelMode==='read-only')return {mode:'read-only' as const};
 if(mode&&labelMode&&mode!==labelMode)return {conflict:true as const};
 return {mode};
}
function canonical(s:PermissionSource){
 const lines=s.accesses.map(a=>`${a.from} → ${a.to}：${a.mode==='read-only'?'该主体对该目标只读，不许可写入':a.mode==='read-write'?'该主体对该目标可读写':'明确访问关系；读写权限未声明'}。`);
 for(const a of s.prohibitions)lines.push(`禁止 ${a.from} → ${a.to}；这是方向性限制，不是正向访问边。`);
 for(const a of s.onlyTargets)lines.push(`${a.from} 的直接访问目标仅限 ${a.targets.join('、')}；不限制其它主体的访问目标。`);
 lines.push('未声明的关系和权限保持未知；已给读写不代表独占访问。任意注释、全局唯一入口、替代路径、事务或故障影响均未核对。');return lines.join('\n');
}

/** Source-derived permission comparison. Model annotations never establish facts. */
export function checkSourcePermissions(snapshot:SourceSnapshot,input:unknown):Record<string,unknown>{
 const common={sourceCheckVersion:'1.0',sourceCheckKind:'permissions-zh',source:sourceMetadata({...snapshot,kind:'permissions-zh'}),sourceFactsVerified:false,unverified:['source author/human identity','unselected context and general natural-language meaning','node annotations, unrecognized edge labels, scenario explanations, summary and arbitrary prose','global exclusivity, alternative paths, retries, transactions and real failure propagation']};
 const finish=(result:Record<string,unknown>)=>bounded(result)?{...common,status:'check-limit',issues:[{code:'SOURCE_CHECK_LIMIT',path:'$',reason:'Complete permission comparison exceeds the receipt budget; no partial approval.'}]}:result;
 const limited=bounded(input);if(limited)return {...common,status:'validation-failed',issues:[limited]};
 const request=sourcePermissionsRequestSchema.safeParse(input);if(!request.success)return {...common,status:'validation-failed',issues:request.error.issues.map(i=>({code:'SOURCE_REQUEST',path:'$.'+i.path.join('.'),reason:i.message}))};
 const parsed=parsePermissionSource(snapshot.excerpt,snapshot.textByteStart);if(parsed.status!=='ready')return {...common,status:'source-unsupported',issues:parsed.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
 const source=parsed.value,issues:SourceIssue[]=[],add=(code:string,path:string,reason:string)=>issues.push({code,path,reason});
 const {view,claims=[],prose}=request.data;let comparison:Record<string,unknown>={status:'not-requested'};
 if(view!==undefined){
  const checked=validateEnvelope(view);if(!checked.ok)return finish({...common,status:'validation-failed',sourcePermissions:source,issues:checked.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}});
  if(checked.value.component!=='ArchitectureExplorer')return {...common,status:'source-unsupported',issues:[{code:'SOURCE_COMPONENT',path:'$.view.component',reason:'permissions-zh compares ArchitectureExplorer only.'}],comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
  const p=checked.value.payload,labels=new Map(p.nodes.map(n=>[n.id,n.label])),names=new Set<string>(),covered=new Set<string>();let bindingGap=false;
  const nodeChecks=p.nodes.map((n,i)=>{
   const found=source.nodes.includes(n.label)&&!names.has(n.label);names.add(n.label);
   if(!found){bindingGap=true;add('SOURCE_BINDING_UNVERIFIED',`$.view.payload.nodes.${i}.label`,'No unique exact source label establishes this correspondence. Translation/aliases are not inferred; this does not prove the entity or its relations false.');}
   return {nodeId:n.id,label:n.label,status:found?'matched':'not-assessed'};
  });
  for(const name of source.nodes)if(!names.has(name))add('SOURCE_NODE_MISSING','$.view.payload.nodes',`Source entity ${JSON.stringify(name)} is not represented by an exact label.`);
  const edgeChecks=p.edges.map((e,i)=>{
   const from=labels.get(e.source)!,to=labels.get(e.target)!,path=`$.view.payload.edges.${i}`,declared=source.accesses.find(a=>a.from===from&&a.to===to),before=issues.length;
   if(!source.nodes.includes(from)||!source.nodes.includes(to))return {edgeId:e.id,from,to,status:'not-assessed'};
   if(!e.directed)add('SOURCE_DIRECTION',path+'.directed','The source assertion is directed.');
   if(!declared){const allowed=permission(source,from,to,'access');add(allowed.value===false?'SOURCE_ACCESS_PROHIBITED':'SOURCE_ACCESS_UNDECLARED',path,allowed.value===false?'An explicit prohibition or subject-local only-target rule forbids this direct positive edge. Negative conditions cannot be rendered as positive edges.':'This positive access is not declared. Missing access is unknown, not proof of prohibition.');}
   else{
    covered.add(pair(from,to));const mode=edgeMode(e.type,e.label);
    if(mode.conflict)add('SOURCE_EDGE_MODE_CONFLICT',path,'The finite type and mode label disagree. Neither becomes source truth.');
    else if(!mode.mode||mode.mode==='read')add('SOURCE_ACCESS_MODE_UNVERIFIED',path+'.type','Use access/call, read-only/只读 or read-write/读写; read plus label只读 is supported. A read assertion alone does not establish no write permission.');
    else if(mode.mode!==declared.mode)add('SOURCE_ACCESS_MODE',path+'.type','The view mode differs from the source-bound subject-target permission, or adds/omits a read/write restriction.');
   }
   return {edgeId:e.id,from,to,status:issues.length===before?'matched':'mismatch',...(declared?{expectedMode:declared.mode,sourceSpans:declared.spans}:{})};
  });
  for(const a of source.accesses)if(!covered.has(pair(a.from,a.to)))add('SOURCE_ACCESS_MISSING','$.view.payload.edges',`The declared positive access ${JSON.stringify(a.from)} → ${JSON.stringify(a.to)} is missing or unbound.`);
  comparison={status:bindingGap?'not-assessed':issues.length?'mismatch':'matched',scope:'all declared direct positive pairs and finite edge modes only; prohibitions/only-target conditions are listed in sourcePermissions and checked via typed claims, not inferred from view annotations',nodeChecks,edgeChecks,viewAnnotations:'not-verified'};
 }
 const claimChecks=claims.map((claim,index)=>{
  if('text'in claim)return {index,kind:claim.kind,status:'not-assessed',reason:'This claim kind is outside direct pair permissions and subject-local only-targets. Arbitrary prose is not certified.'};
  if(claim.kind==='only-targets'){
   const expected=source.onlyTargets.find(a=>a.from===claim.from),matched=!!expected&&new Set(claim.targets).size===claim.targets.length&&namesEqual(expected.targets,claim.targets);
   return {index,kind:claim.kind,from:claim.from,expected:expected?.targets??null,actual:claim.targets,status:expected?matched?'supported':'mismatch':'not-assessed',sourceSpans:expected?.spans??[]};
  }
  const expected=permission(source,claim.from,claim.to,claim.kind);
  return {index,kind:claim.kind,from:claim.from,to:claim.to,expected:expected.value,actual:claim.value,status:expected.value===null?'not-assessed':expected.value===claim.value?'supported':'mismatch',sourceSpans:expected.spans};
 });
 const canExplain=issues.length===0&&claimChecks.every(c=>c.status==='supported');
 return finish({...common,status:'compared',sourcePermissions:source,comparison,issues,claimChecks,freeProse:{status:'not-verified',provided:prose!==undefined,characters:prose?.length??0},canonicalExplanation:canExplain?{status:'available',basis:'bounded explicit source declarations; no global or causal inference',text:canonical(source)}:{status:'withheld',reason:'Resolve unsupported bindings, modes or claims before using a combined explanation.'}});
}
