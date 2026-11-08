import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
export async function buildTaskForm(out){
 await mkdir(out,{recursive:true});
 const js=await build({entryPoints:['src/task-form/standalone.tsx'],bundle:true,format:'iife',platform:'browser',write:false,minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'task-css',setup(b){b.onResolve({filter:/\.css\?inline$/},a=>({path:resolve(a.resolveDir,a.path.replace(/\?inline$/,'')),namespace:'task-css'}));b.onLoad({filter:/.*/,namespace:'task-css'},async a=>({contents:'export default '+JSON.stringify(await readFile(a.path,'utf8')),loader:'js'}));}}]});
 const script=js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'),hash=createHash('sha256').update(script).digest('base64');
 const noticePaths=['LICENSE','licenses/react@19.3.1/LICENSE','licenses/react-dom@19.3.1/LICENSE','licenses/scheduler@0.28.0/LICENSE','licenses/zod@4.4.3/LICENSE'];
 const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const notices=(await Promise.all(noticePaths.map(async p=>p+'\n'+await readFile(p,'utf8')))).join('\n\n');
 const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>DSH Semantic UI · 本地任务表单</title><style>body{margin:0;background:#eef3f8;color:#142432;font-family:system-ui}main{max-width:900px;margin:0 auto;padding:12px}header p{line-height:1.6}h1{font-size:1.5rem}button,textarea,input,select{font:inherit}</style></head><body><main><header><h1>本地任务表单</h1><p>补充条件、核对预览、明确确认、保存后继续。文件在本机处理；此页面没有网络连接，也不更新您现有的 DSH 页面。</p></header><div id="task-root"></div><noscript>需要浏览器允许本文件中固定的脚本，输入内容不作为脚本执行。</noscript></main><script>${script}</script></body></html>`;
 await writeFile(out+'/task-form.html',html.replace('</main>',`<details><summary>开源许可证</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px">${escape(notices)}</pre></details></main>`));
 await build({entryPoints:['scripts/task-form.ts'],bundle:true,platform:'node',format:'esm',outfile:out+'/task-form.mjs',minify:true,legalComments:'linked',banner:{js:"import {createRequire as __taskRequire} from 'node:module'; const require=__taskRequire(import.meta.url);"}});
 return {html:out+'/task-form.html',cli:out+'/task-form.mjs'};
}
