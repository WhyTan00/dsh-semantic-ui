import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createRequire} from 'node:module';

/** Same client closure and isolated React as the full build; no host/MCP build or process. */
export async function buildClient({outfile='dist/client.js',islandOut='.handoff/build/island.js'}={}){
 await mkdir(dirname(outfile),{recursive:true});await mkdir(dirname(islandOut),{recursive:true});
 const cssInline={name:'css-inline',setup(b){
  b.onResolve({filter:/\.css\?inline$/},a=>({path:a.path.replace(/\?inline$/,''),namespace:'inline-css',pluginData:{resolveDir:a.resolveDir}}));
  b.onLoad({filter:/.*/,namespace:'inline-css'},async a=>{const req=createRequire(join(a.pluginData.resolveDir,'entry.js'));const path=a.path.startsWith('.')?resolve(a.pluginData.resolveDir,a.path):req.resolve(a.path);return {contents:'export default '+JSON.stringify(await readFile(path,'utf8')),loader:'js'};});
 }};
 await build({entryPoints:['src/island.tsx'],bundle:true,format:'esm',platform:'browser',outfile:islandOut,minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"','import.meta.env.MODE':'"production"','import.meta.env':'{}'},plugins:[cssInline]});
 await writeFile(islandOut.replace(/\.js$/,'.d.ts'),"export {mount} from '../../src/island';\n");
 await build({entryPoints:['src/dsh/client.tsx'],bundle:true,format:'cjs',platform:'browser',outfile,external:['react','react/jsx-runtime'],plugins:[{name:'isolated-island',setup(b){b.onResolve({filter:/^\.\.\/host-island$/},()=>({path:resolve(islandOut)}));}}],minify:true,legalComments:'linked',banner:{js:'window.__ModuleLoader__.load({id:"@whytan/dsh-semantic-ui",factory:(require)=>{var module={exports:{}};var exports=module.exports;'},footer:{js:'return module.exports;}});'}});
 return {outfile,islandOut};
}
