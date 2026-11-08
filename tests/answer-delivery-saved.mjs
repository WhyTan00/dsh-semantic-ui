import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import * as core from '../src/core.ts';
import {checkResultPackage} from '../src/result-interop.ts';
import {readSourceSnapshot} from '../src/source-input.ts';
import {sourceReferenceFromSnapshot} from '../src/source-reference.mjs';
import {createResult,initialInteraction} from '../src/results.ts';
import {defaultTheme,defaultLayout} from '../src/theme.ts';

// Read only the six already-public fictional failures. No model, host or transport.
const {values}=parseArgs({options:{output:{type:'string'}}});
assert(values.output,'Explicit new output directory required');
const out=path.resolve(values.output);await mkdir(out,{mode:0o700});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>JSON.stringify(x,null,2)+'\n';
const variants={A2:'workflow-zh',A3:'permissions-zh',D1:'decision-zh',D2:'capacity-zh',N2:'observations-zh',T2:undefined},cases=[];
for(const [id,kind] of Object.entries(variants)){
 const file=`docs/evidence/natural/r9-${id}.json`,bytes=await readFile(file),original=JSON.parse(bytes);
 const snapshot=await readSourceSnapshot({file,jsonPointer:'/question',...(kind?{kind}:{})});
 const submitted=original.actualToolCalls.find(c=>c.name==='dsh_semantic_ui'&&c.arguments?.view)?.arguments;
 const originalDelivery=await core.checkAnswerDelivery({view:submitted?.view,...(submitted?.mapping?{mapping:submitted.mapping}:{}),answer:original.finalAnswer},snapshot);
 assert.equal(originalDelivery.wholeCandidateVerified,false,id);assert.equal(originalDelivery.originalAnswer,original.finalAnswer,id);
 assert.equal(originalDelivery.status,'refused',id);assert.equal(originalDelivery.text,null,id);
 const reference=sourceReferenceFromSnapshot(core,snapshot,kind);let programReference;
 if(reference.status==='ready'){
  const document=await createResult({view:reference.request.view,interaction:initialInteraction(reference.request.view),theme:defaultTheme,layout:defaultLayout,locale:'zh-CN'});
  const before=JSON.stringify(document),r=await checkResultPackage({document,...(reference.request.mapping?{mapping:reference.request.mapping}:{}),answer:original.finalAnswer},snapshot);
  assert.equal(r.status,'limited-delivery',id);assert.equal(r.answerDelivery.wholeCandidateVerified,false,id);assert.equal(r.answerDelivery.originalAnswer,original.finalAnswer,id);
  assert.equal(r.answerDelivery.textOrigin,'program-derived finite source projection',id);assert.equal(JSON.stringify(document),before,id);assert.deepEqual(r.document,document,id);
  const body=r.answerDelivery.coverage.representations.find(c=>c.origin==='answer');
  assert.deepEqual(body.unverifiedRanges,[{utf16Start:0,utf16End:original.finalAnswer.length}],id);
  programReference={authorship:'existing program source constructor; not repaired or new model answer',receipt:r};
 }else{assert.equal(id,'T2');programReference={status:'refused',reason:'No complete supported finite source grammar; no component fabricated.'};}
 assert.equal(sha(await readFile(file)),sha(bytes),id);
 const detail={id,originalFile:file,originalFileSha256:sha(bytes),sourceTextSha256:snapshot.textSha256,originalClassification:'fail; unchanged',originalFinalAnswer:original.finalAnswer,originalViewPresent:Boolean(submitted),originalDelivery,programReference};
 const name=id+'.json';await writeFile(path.join(out,name),json(detail),{mode:0o600,flag:'wx'});
 cases.push({id,originalFile:file,originalFileSha256:sha(bytes),originalFinalAnswerSha256:sha(original.finalAnswer),originalViewPresent:Boolean(submitted),originalStatus:originalDelivery.status,originalCode:originalDelivery.code,wholeCandidateVerified:false,programReferenceStatus:programReference.receipt?.status??programReference.status,detailFile:name,detailSha256:sha(json(detail))});
}
const receipt={scope:'offline saved failures; no natural rerun or regrading',originalResults:{pass:0,fail:6,requests:18},allOriginalFilesUnchanged:true,allOriginalCandidatesRetainedUnverified:true,originalDeliveriesRefused:cases.length,programFiniteReplacements:cases.filter(c=>c.programReferenceStatus==='limited-delivery').length,unsupportedSourceRefusals:cases.filter(c=>c.programReferenceStatus==='refused').length,cases,newModelTurns:0,newMcpConnections:0,browserOrDshAccess:false,globalInstallationPerformed:false};
await writeFile(path.join(out,'acceptance.json'),json(receipt),{mode:0o600,flag:'wx'});console.log(json(receipt));
