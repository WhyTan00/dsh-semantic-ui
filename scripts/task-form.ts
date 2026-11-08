#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {taskParse,taskTemplateSchema,taskSourceSchema,taskDraftSchema,blankTaskDraft,previewTask,confirmTask,continueTask,replaceTaskTemplate,type TaskRecord} from '../src/task-form/core';
import {readResult} from '../src/results';
import {packageTask} from '../src/task-form/storage';
const {positionals,values}=parseArgs({allowPositionals:true,options:{template:{type:'string'},source:{type:'string'},answers:{type:'string'},preview:{type:'string'},result:{type:'string'},'continue-from':{type:'string'},out:{type:'string'},'ack-local':{type:'boolean'},help:{type:'boolean'}}});
const help='用法：task-form preview|confirm|draft --template 模板.json --source 来源.json --answers 答案.json --out 新文件.json\nconfirm 另需 --preview 预览.json --ack-local；preview/draft 可加 --continue-from 旧结果.json。\n其他：inspect --result 结果.json；template-from-result --result 结果.json --out 模板.json；blank --template 模板.json --out 空白答案.json。\n只读显式文件；输出不覆盖已有文件，不联网、不调用模型。';
async function json(name:string){const path=values[name as keyof typeof values];if(typeof path!=='string')throw Error('缺少 --'+name);const bytes=await readFile(path);if(bytes.length>131072)throw Error('TASK_LIMIT');return JSON.parse(bytes.toString('utf8'));}
async function output(value:unknown){if(!values.out)throw Error('请指定 --out 新文件；不会覆盖旧文件。');await writeFile(values.out,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});console.log('已写入新文件：'+values.out);}
try{
 const command=positionals[0];if(values.help||!command){console.log(help);}
 else if(command==='inspect'||command==='template-from-result'){
  const document=await readResult(await json('result')),record=document.content.taskForm;if(!record)throw Error('TASK_RESULT_REQUIRED');
  if(command==='template-from-result')await output(record.template);
  else{const valid=record.status==='confirmed'?await previewTask(record.template,record.source,record.draft,record.lineage):undefined;console.log(JSON.stringify({状态:record.status==='confirmed'?'历史本地确认':'未确认草稿',修订:record.lineage.revision,来源:record.source,模板:{id:record.template.id,版本:record.template.revision},输入:valid?.values??record.draft,规则:valid?.rules,边界:'仅本地记录；不是身份、权限、模型接受或外部提交。'},null,2));}
 }else{
  const template=taskParse(taskTemplateSchema,await json('template'));
  if(command==='blank')await output(blankTaskDraft(template));
  else{
   const source=taskParse(taskSourceSchema,await json('source')),draft=taskParse(taskDraftSchema,await json('answers'));let parent:TaskRecord|undefined;
   if(values['continue-from']){parent=(await readResult(await json('continue-from'))).content.taskForm;if(!parent)throw Error('TASK_RESULT_REQUIRED');replaceTaskTemplate(parent.template,template);if(source.id===parent.source.id&&(source.revision<parent.source.revision||source.revision===parent.source.revision&&JSON.stringify(source)!==JSON.stringify(parent.source)))throw Error('TASK_SOURCE_STALE: 来源变更必须提高修订号。');}
   if(command==='confirm'){
    const previous=await json('preview') as Awaited<ReturnType<typeof previewTask>>;
    const lineage=parent?await continueTask(parent):previous.lineage;
    await output(await packageTask(await confirmTask({template,source,draft,lineage},previous,values['ack-local']===true)));
   }else{
    const lineage=parent?await continueTask(parent):{seriesId:crypto.randomUUID(),revision:1,parentConfirmationSha256:null};
    if(command==='preview')await output(await previewTask(template,source,draft,lineage));
    else if(command==='draft')await output(await packageTask({version:1,status:'draft',template,source,draft,lineage}));
    else throw Error(help);
   }
  }
 }
}catch(error){console.error(error instanceof Error?error.message:'任务表单操作失败。');process.exitCode=1;}
