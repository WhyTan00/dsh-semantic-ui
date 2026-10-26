import {z} from 'zod';
import {bounded,validateEnvelope} from './protocol';

export const SOURCE_LIMITS={fileBytes:1_048_576,textBytes:32768,excerptBytes:16384,relations:80,claims:32} as const;
export interface SourceSnapshot{
 documentSha256:string;textSha256:string;excerptSha256:string;jsonPointer:string|null;
 textBytes:number;textByteStart:number;textByteEnd:number;excerpt:string;
}
export interface SourceIssue{code:string;path:string;reason:string}
type Span={textByteStart:number;textByteEnd:number};
type Relation={from:string;to:string;spans:Span[]};
const bytes=(s:string)=>new TextEncoder().encode(s).length;
const pair=(a:string,b:string)=>JSON.stringify([a,b]);
const name=z.string().min(1).max(80);
export const sourceCheckRequestSchema=z.strictObject({
 view:z.unknown().optional(),
 claims:z.array(z.strictObject({kind:name,from:name.optional(),to:name.optional(),nodes:z.array(name).min(1).max(80).optional(),text:z.string().max(1200).optional()}).superRefine((c,ctx)=>{
  const valid=c.kind==='edge'||c.kind==='reachability'?!!c.from&&!!c.to&&c.nodes===undefined&&c.text===undefined:c.kind==='path'?!!c.nodes&&c.from===undefined&&c.to===undefined&&c.text===undefined:!!c.text&&c.from===undefined&&c.to===undefined&&c.nodes===undefined;
  if(!valid)ctx.addIssue({code:'custom',message:'Use only from/to for edge or reachability, only nodes for path, or only text for an unsupported claim kind. Free text is never part of a supported relation claim.'});
 })).max(SOURCE_LIMITS.claims).optional(),
 prose:z.string().max(20000).optional(),
});
export type SourceClaim=NonNullable<z.infer<typeof sourceCheckRequestSchema>['claims']>[number];

/** Literal arrow syntax only. No extraction of natural-language assertions. */
export function parseExplicitRelations(text:string,offset=0):{status:'ready';nodes:string[];relations:Relation[]}|{status:'unsupported';issues:SourceIssue[]}{
 const fail=(code:string,reason:string)=>({status:'unsupported' as const,issues:[{code,path:'$.source.excerpt',reason}]});
 if(!text.trim())return fail('SOURCE_EMPTY','The selected source excerpt is empty.');
 if(bytes(text)>SOURCE_LIMITS.excerptBytes)return fail('SOURCE_LIMIT','The selected source excerpt exceeds the byte limit.');
 const nodes=new Set<string>(),relations=new Map<string,Relation>();let assertions=0;
 for(const match of text.matchAll(/[^,，;；\r\n]+/gu)){
  if(!match[0].trim())continue;
  const parts=match[0].split(/→|->/u).map(s=>s.trim());
  if(parts.length<2||parts.some(s=>!/^\p{L}[\p{L}\p{N}_ ./:\-]{0,79}$/u.test(s)&&!/^\p{N}[\p{L}\p{N}_ ./:\-]{0,79}$/u.test(s)))return fail('SOURCE_SYNTAX','Every nonempty clause must be a complete literal arrow chain; headings, questions, conditions and prose are unsupported. Select an exact excerpt explicitly rather than silently discarding text.');
  const span={textByteStart:offset+bytes(text.slice(0,match.index)),textByteEnd:offset+bytes(text.slice(0,match.index+match[0].length))};
  for(let i=1;i<parts.length;i++){
   if(++assertions>SOURCE_LIMITS.relations)return fail('SOURCE_LIMIT','The source exceeds the bounded relation-assertion count.');
   const from=parts[i-1],to=parts[i],key=pair(from,to);nodes.add(from);nodes.add(to);
   const existing=relations.get(key);if(existing)existing.spans.push(span);else relations.set(key,{from,to,spans:[span]});
  }
 }
 if(!relations.size)return fail('SOURCE_EMPTY','No explicit directed relations were supplied.');
 return {status:'ready',nodes:[...nodes],relations:[...relations.values()]};
}

function sourceMetadata(s:SourceSnapshot){return {
 input:'caller-configured startup file snapshot; separate from tool arguments',
 documentSha256:s.documentSha256,textSha256:s.textSha256,excerptSha256:s.excerptSha256,jsonPointer:s.jsonPointer,
 selection:{textUTF8ByteStart:s.textByteStart,textUTF8ByteEnd:s.textByteEnd,textUTF8Bytes:s.textBytes},
 identityVerified:false,authorship:'unverified; a configured file does not certify its author or original user',
 scope:'literal directed relations in the selected excerpt only; text outside the excerpt and natural-language meaning are not assessed',
};}

/** Cross-document comparison, never a certificate of source identity or prose truth. */
export function checkSourceGraph(snapshot:SourceSnapshot,input:unknown):Record<string,unknown>{
 const common={sourceCheckVersion:'1.0',source:sourceMetadata(snapshot),sourceFactsVerified:false,
  unverified:['source identity/authorship','unselected source text','node responsibilities/constraints/evidence','edge type/label/evidence','scenario explanations','summary and free prose','causality, retry, rollback, exclusivity and operational guarantees']};
 const finish=(result:Record<string,unknown>):Record<string,unknown>=>bounded(result)?{...common,status:'check-limit',issues:[{code:'SOURCE_CHECK_LIMIT',path:'$',reason:'The complete source comparison exceeds the JSON receipt budget; no partial success or truncated checks are returned.'}]}:result;
 const inputIssue=bounded(input);if(inputIssue)return {...common,status:'validation-failed',issues:[inputIssue]};
 const request=sourceCheckRequestSchema.safeParse(input);
 if(!request.success)return {...common,status:'validation-failed',issues:request.error.issues.map(i=>({code:'SOURCE_REQUEST',path:'$.'+i.path.join('.'),reason:i.message}))};
 const parsed=parseExplicitRelations(snapshot.excerpt,snapshot.textByteStart);
 if(parsed.status!=='ready')return {...common,status:'source-unsupported',issues:parsed.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
 const sourcePairs=new Map(parsed.relations.map(r=>[pair(r.from,r.to),r]));
 const sourceNames=new Set(parsed.nodes),issues:SourceIssue[]=[];
 const add=(code:string,path:string,reason:string)=>issues.push({code,path,reason});
 const {view,claims=[],prose}=request.data;
 let comparison:Record<string,unknown>={status:'not-requested'};
 if(view!==undefined){
  const checked=validateEnvelope(view);
  if(!checked.ok)return finish({...common,status:'validation-failed',sourceRelations:parsed.relations,issues:checked.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}});
  if(checked.value.component!=='ArchitectureExplorer')return {...common,status:'source-unsupported',issues:[{code:'SOURCE_COMPONENT',path:'$.view.component',reason:'This source path compares ArchitectureExplorer only.'}],comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
  const p=checked.value.payload,labels=new Map(p.nodes.map(n=>[n.id,n.label])),seen=new Set<string>(),covered=new Set<string>();
  p.nodes.forEach((n,i)=>{
   if(seen.has(n.label))add('SOURCE_LABEL_AMBIGUOUS',`$.view.payload.nodes.${i}.label`,'Source correspondence requires unique, exact node labels; IDs or claimed aliases do not establish identity.');
   seen.add(n.label);
   if(!sourceNames.has(n.label))add('SOURCE_NODE_UNSUPPORTED',`$.view.payload.nodes.${i}.label`,'This exact node label is not present in the selected source relations. This is not a claim that the node cannot exist.');
  });
  const edgeChecks=p.edges.map((edge,i)=>{
   const from=labels.get(edge.source)!,to=labels.get(edge.target)!,key=pair(from,to),source=sourcePairs.get(key),path=`$.view.payload.edges.${i}`;
   let status='matched';
   if(!edge.directed){status='mismatch';add('SOURCE_DIRECTION',path+'.directed','A directed source relation cannot be verified as an undirected relationship.');}
   else if(!source){status='mismatch';add(sourcePairs.has(pair(to,from))?'SOURCE_RELATION_REVERSED':'SOURCE_RELATION_UNSUPPORTED',path,sourcePairs.has(pair(to,from))?'The selected source asserts the opposite direction.':'The selected source does not assert this directed relation; graph absence is not a prohibition.');}
   else covered.add(key);
   return {edgeId:edge.id,from,to,status,...(source&&edge.directed?{sourceSpans:source.spans}:{})};
  });
  const missing=parsed.relations.filter(r=>!covered.has(pair(r.from,r.to)));
  for(const r of missing)add('SOURCE_RELATION_MISSING','$.view.payload.edges',`The complete selected relation set requires ${JSON.stringify(r.from)} → ${JSON.stringify(r.to)}.`);
  comparison={status:issues.length?'mismatch':'matched',coverage:'all directed pairs in the selected excerpt; not all facts in the original document',edgeChecks,missingRelations:missing};
 }
 const adjacency=new Map(parsed.nodes.map(n=>[n,parsed.relations.filter(r=>r.from===n).map(r=>r.to)]));
 const pathBetween=(from:string,to:string):string[]|null=>{
  if(!sourceNames.has(from)||!sourceNames.has(to))return null;
  const queue=[[from]],visited=new Set([from]);
  for(let i=0;i<queue.length;i++){const path=queue[i],last=path.at(-1)!;if(last===to)return path;for(const next of adjacency.get(last)??[])if(!visited.has(next)){visited.add(next);queue.push([...path,next]);}}
  return null;
 };
 const claimChecks=claims.map((claim,i)=>{
  let nodes:string[]|null=null,code='SOURCE_CLAIM_UNSUPPORTED';
  if(claim.kind==='edge'&&claim.from&&claim.to){nodes=sourcePairs.has(pair(claim.from,claim.to))?[claim.from,claim.to]:null;code='SOURCE_RELATION_UNSUPPORTED';}
  else if(claim.kind==='path'&&claim.nodes){nodes=claim.nodes.every(n=>sourceNames.has(n))&&claim.nodes.every((n,j)=>j===0||sourcePairs.has(pair(claim.nodes![j-1],n)))?claim.nodes:null;code='SOURCE_PATH_UNSUPPORTED';}
  else if(claim.kind==='reachability'&&claim.from&&claim.to){nodes=pathBetween(claim.from,claim.to);code='SOURCE_PATH_UNSUPPORTED';}
  const supported=nodes!==null;
  return {index:i,kind:claim.kind,status:supported?'supported':'not-assessed',...(nodes?{nodes,sourceSpans:nodes.slice(1).flatMap((n,j)=>sourcePairs.get(pair(nodes![j],n))!.spans)}:{code,path:`$.claims.${i}`,reason:'Not established by the selected literal relation grammar. This does not prove the claim false.'})};
 });
 const mayExplain=comparison.status!=='mismatch'&&claimChecks.every(c=>c.status==='supported');
 return finish({...common,status:'compared',sourceRelations:parsed.relations,comparison,issues,claimChecks,
  conclusion:{selectedRelations:comparison.status,structuredClaims:claims.length?(claimChecks.every(c=>c.status==='supported')?'supported':'not-assessed'):'not-requested',sourceIdentity:'unverified',freeProse:'not-verified'},
  freeProse:{status:'not-verified',provided:prose!==undefined,characters:prose?.length??0,reason:'No keyword filtering or natural-language truth judgement was performed; a matched graph does not verify its prose.'},
  canonicalExplanation:mayExplain?{status:'available',basis:'computed only from the selected source syntax',text:'Selected source directed relations: '+parsed.relations.map(r=>`${JSON.stringify(r.from)} → ${JSON.stringify(r.to)}`).join('; ')+'. This establishes literal topology only; causal, retry, rollback and free-prose claims are not verified.'}:{status:'withheld',reason:'Resolve mismatched source relations or unsupported claims before using a checked explanation.'},
 });
}
