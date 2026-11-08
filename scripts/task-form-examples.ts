import {mkdir,writeFile} from 'node:fs/promises';
import {exampleTaskTemplate,exampleSourceA,exampleSourceB,exampleAnswersA,exampleAnswersB} from '../fixtures/task-form/example';
import {blankTaskDraft,previewTask,confirmTask} from '../src/task-form/core';
import {packageTask} from '../src/task-form/storage';
const out=process.argv[2];if(!out)throw Error('Provide explicit output directory.');await mkdir(out,{recursive:true});
const current={template:exampleTaskTemplate,source:exampleSourceA,draft:exampleAnswersA,lineage:{seriesId:'bd654bcb-2375-41dc-9da1-cd17f539f80d',revision:1,parentConfirmationSha256:null}},preview=await previewTask(current.template,current.source,current.draft,current.lineage),confirmed=await confirmTask(current,preview,true,()=> '1428cbda-bcb0-421f-b0c0-2746fc35f8ba',()=> '2026-11-08T00:00:00.000Z');
for(const [name,value]of Object.entries({'task-template':exampleTaskTemplate,'source-a':exampleSourceA,'answers-a':exampleAnswersA,'source-b':exampleSourceB,'answers-b':exampleAnswersB,'blank-answers':blankTaskDraft(exampleTaskTemplate),'synthetic-confirmed-a':await packageTask(confirmed)}))await writeFile(out+'/'+name+'.json',JSON.stringify(value,null,2)+'\n');
