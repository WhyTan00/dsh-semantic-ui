import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {exampleTaskTemplate,exampleSourceA,exampleSourceB,exampleAnswersA,exampleAnswersB} from '../fixtures/task-form/example.ts';
const cli=resolve(process.env.TASK_FORM_CLI??'.handoff/task-form-20261108/build/task-form.mjs'),dir=mkdtempSync(join(tmpdir(),'semantic-task-form-')),path=n=>join(dir,n+'.json'),read=n=>JSON.parse(readFileSync(path(n))),write=(n,v)=>writeFileSync(path(n),JSON.stringify(v)),hash=n=>createHash('sha256').update(readFileSync(path(n))).digest('hex');
const run=(args,expected=0)=>{const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});assert.equal(r.status,expected,r.stderr);return r;};
const args=['--template',path('template'),'--source',path('source'),'--answers',path('answers')];
try{
 write('template',exampleTaskTemplate);write('source',exampleSourceA);write('answers',exampleAnswersA);
 run(['preview',...args,'--out',path('preview')]);assert.deepEqual(read('preview').rules.map(r=>r.truth),[true,false,'unknown']);
 run(['confirm',...args,'--preview',path('preview'),'--out',path('rejected')],1);
 run(['confirm',...args,'--preview',path('preview'),'--ack-local','--out',path('confirmed')]);const firstHash=hash('confirmed');assert.equal(read('confirmed').manifest.version,5);
 const inspected=run(['inspect','--result',path('confirmed')]);assert(inspected.stdout.includes('历史本地确认'));assert(inspected.stdout.includes('false'));
 write('source',{...exampleSourceA,revision:2,text:'公开合成来源修订，容量120 GiB。'});write('answers',{...exampleAnswersA,size:{mode:'value',text:'120'}});
 assert(run(['confirm',...args,'--preview',path('preview'),'--ack-local','--out',path('stale')],1).stderr.includes('TASK_PREVIEW_STALE'));
 run(['preview',...args,'--continue-from',path('confirmed'),'--out',path('preview2')]);run(['confirm',...args,'--continue-from',path('confirmed'),'--preview',path('preview2'),'--ack-local','--out',path('confirmed2')]);assert.equal(read('confirmed2').content.taskForm.lineage.revision,2);assert.equal(hash('confirmed'),firstHash);
 run(['confirm',...args,'--continue-from',path('confirmed'),'--preview',path('preview2'),'--ack-local','--out',path('confirmed')],1);assert.equal(hash('confirmed'),firstHash);
 run(['template-from-result','--result',path('confirmed'),'--out',path('pure-template')]);assert.deepEqual(read('pure-template'),exampleTaskTemplate);
 run(['blank','--template',path('pure-template'),'--out',path('blank')]);assert(Object.values(read('blank')).every(f=>f.mode==='unknown'&&f.text===''));
 write('source',exampleSourceB);write('answers',exampleAnswersB);run(['preview',...args,'--out',path('preview-b')]);assert.deepEqual(read('preview-b').rules.map(r=>r.truth),[false,true,true]);assert.notEqual(read('preview-b').lineage.seriesId,read('preview').lineage.seriesId);
 write('answers',{...exampleAnswersB,size:{mode:'value',text:'NaN'}});run(['draft',...args,'--out',path('draft')]);assert.equal(read('draft').content.taskForm.status,'draft');assert.equal(read('draft').content.taskForm.draft.size.text,'NaN');
 console.log(JSON.stringify({passed:true,normalCompiledCli:true,previewConfirmReopenRevise:true,explicitAckAndStalePreviewRejection:true,oldConfirmedFileUnchanged:true,templateAndAnswersSeparate:true,secondInputFresh:true,invalidDraftPreserved:true,browserUsed:false,remoteOrModelCalls:0}));
}finally{rmSync(dir,{recursive:true,force:true});}
