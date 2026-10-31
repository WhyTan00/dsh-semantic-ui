import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir,chmod,utimes} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {buildMcp} from './mcp-build.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const serverName='semantic-ui-checks',marketplaceName='dsh-semantic-ui-personal';
const skillFiles=['SKILL.md','references/relations.md'];
const safeRelative=value=>value&&!path.isAbsolute(value)&&!value.split('/').some(s=>!s||s==='.'||s==='..');

/** No installation, model, registry, account or global configuration operation. */
export async function packCodexPlugin({archive,manifest:manifestFile,output,version}){
 assert(archive&&manifestFile&&output,'需要明确的archive、manifest和新output目录');
 archive=path.resolve(archive);output=path.resolve(output);
 const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
 assert.equal(path.basename(archive),manifest.filename);
 assert.equal(sha(await readFile(archive)),manifest.sha256,'运行归档SHA-256不一致');
 version??=manifest.version.includes('-')?manifest.version+'.1':manifest.version+'-codex.1';
 assert(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version),'插件版本必须是无路径的semver');
 const extract=name=>execFileSync('tar',['-xOf',archive,'package/'+name],{maxBuffer:16*1024*1024});
 const originCore=extract('dist/core.js');assert.equal(sha(originCore),manifest.runtimeEntrypoints['dist/core.js']);
 const proof=await build({absWorkingDir:root,entryPoints:['src/core.ts'],bundle:true,format:'esm',platform:'node',outfile:path.join(root,'dist/core.js'),packages:'external',sourcemap:false,write:false});
 const currentCore=proof.outputFiles[0].contents;
 assert.equal(sha(currentCore),sha(originCore),'当前核对核心与所选归档不同；请先提供对应归档，不能借旧核心身份');
 await mkdir(path.dirname(output),{recursive:true});await mkdir(output,{mode:0o700});
 const tree=path.join(output,'marketplace'),plugin=path.join(tree,'plugins',serverName),written=[];
 async function put(relative,bytes){
  assert(safeRelative(relative));const file=path.join(tree,relative);await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file,bytes);await chmod(file,0o644);await utimes(file,new Date('1980-01-01T00:00:00Z'),new Date('1980-01-01T00:00:00Z'));written.push(relative);
 }
 const prefix='plugins/'+serverName+'/';
 const pluginManifest={$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:serverName,version,
  description:'关系、取舍与数值的只读语义核对；保留未知值，复用导出模板。此插件不提供图形渲染器。',
  extensions:{'com.openai':{requires_local_executor:true}}};
 const mcp={$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{[serverName]:{type:'stdio',command:'node',args:['${PLUGIN_ROOT}/dist/mcp.js'],cwd:'${PLUGIN_ROOT}'}}};
 const market={name:marketplaceName,interface:{displayName:'DSH语义核对（本地）'},plugins:[{name:serverName,source:{source:'local',path:'./plugins/'+serverName},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]};
 await put(prefix+'plugin.json',json(pluginManifest));await put(prefix+'mcp.json',json(mcp));
 await put(prefix+'package.json',json({name:'@whytan/semantic-ui-checks-codex',version,private:true,type:'module',engines:{node:'>=24'}}));
 await put('.agents/plugins/marketplace.json',json(market));
 const entry=path.join(plugin,'dist/mcp.js');await mkdir(path.dirname(entry),{recursive:true});
 await buildMcp({absWorkingDir:root,outfile:entry,version});
 for(const name of ['dist/mcp.js','dist/mcp.js.LEGAL.txt']){
  try{await put(prefix+name,await readFile(path.join(plugin,name)));}
  catch(error){if(error.code!=='ENOENT'||!name.endsWith('.LEGAL.txt'))throw error;}
 }
 for(const name of skillFiles)await put(prefix+'skills/'+serverName+'/'+name,await readFile(path.join(root,'skills',serverName,name)));
 const legal=manifest.files.map(f=>f.path).filter(name=>name==='LICENSE'||name==='THIRD_PARTY_NOTICES.md'||name.startsWith('licenses/'));
 for(const name of legal){assert(safeRelative(name));await put(prefix+name,extract(name));}
 const companionCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const sourceDirty=!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
 const provenance={version,sourceCommit:companionCommit,sourceWorkingTreeClean:!sourceDirty,
  origin:{version:manifest.version,sourceCommit:manifest.sourceCommit,archiveFilename:manifest.filename,archiveSha256:manifest.sha256,coreSha256:sha(originCore)},
  coreByteEqualToOrigin:true,mcpEntrySha256:sha(await readFile(entry)),
  buildVersion:version,defaultTools:['semantic_ui_schema','semantic_ui_check','semantic_ui_template_check'],
  sourceFileConfiguredByDefault:false,uiResources:false,modelRoute:false,globalInstallationPerformed:false,
  buildInputs:await Promise.all(['src/mcp.ts','scripts/mcp-build.mjs','scripts/pack-codex-plugin.mjs'].map(async name=>({path:name,sha256:sha(await readFile(path.join(root,name)))}))),
  skillFiles:await Promise.all(skillFiles.map(async name=>({path:'skills/'+serverName+'/'+name,sha256:sha(await readFile(path.join(root,'skills',serverName,name)))})))};
 await put(prefix+'PROVENANCE.json',json(provenance));
 const instructions=`# DSH语义核对：可选本地Codex插件\n\n版本${version}。Node24+；MCP和核心已编入包，无需安装DSH或npm依赖。\n\n先核对同页SHA256SUMS，再把ZIP解压到独立目录。在该目录执行：\n\n\`\`\`sh\ncodex plugin marketplace add .\ncodex plugin add ${serverName}@${marketplaceName}\n\`\`\`\n\n这两条命令由你选择执行，会登记/安装本地插件；打包命令不会执行它们。安装后用新本地会话验证工具已加载，保持你原来的模型与登录。也可按官方文档在桌面插件目录安装。\n\n默认三个工具：读取组件合同、核对结构/计算、核对显式导出模板。没有自定义图形UI、动作回传或私有模板库；使用宿主已有可视化、Mermaid、表格或文字。缺失null与实测0分别保留；统计/要求结果不认证作者、世界事实或任意模型正文。\n\n默认不读取项目文件、来源或账户。可选来源核对仍要求调用者在服务器启动时明确配置一个来源快照，工具参数不能换源。本插件配置不自动选择任何用户文件。\n\nMCP使用同一源码和核心；核心编译字节已与${manifest.version}归档核对，MCP自报本插件构建版本。详情见plugins/${serverName}/PROVENANCE.json。原DSH运行包保持不变。\n\n这是GitHub开源分发包，不代表已在当前聊天加载或已发布到OpenAI官方插件目录。官方资料：https://developers.openai.com/plugins/build/plugins 和 https://developers.openai.com/plugins/deploy/desktop-only 。\n`;
 await put('README.zh-CN.md',instructions);
 const filename='semantic-ui-checks-codex-'+version+'.zip',zip=path.join(output,filename);
 execFileSync('zip',['-X','-q','-9',zip,...written.sort()],{cwd:tree,env:{...process.env,TZ:'UTC'},maxBuffer:1024*1024});
 const archiveBytes=await readFile(zip);
 const result={version,filename,bytes:archiveBytes.length,sha256:sha(archiveBytes),...provenance,
  files:await Promise.all(written.map(async file=>{const bytes=await readFile(path.join(tree,file));return {path:file,bytes:bytes.length,sha256:sha(bytes)};}))};
 await writeFile(path.join(output,'plugin-package-manifest.json'),json(result));
 await writeFile(path.join(output,'SHA256SUMS'),result.sha256+'  '+filename+'\n');
 return result;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const {values}=parseArgs({options:{archive:{type:'string'},manifest:{type:'string'},output:{type:'string'},version:{type:'string'},help:{type:'boolean'}}});
 if(values.help)console.log('node scripts/pack-codex-plugin.mjs --archive <已核对运行包.tgz> --manifest <package-manifest.json> --output <新目录> [--version <插件版本>]\n只构建本地Codex插件ZIP；不下载、不安装、不改全局配置、不调用模型。');
 else{const result=await packCodexPlugin(values);console.log(json({version:result.version,filename:result.filename,sha256:result.sha256,files:result.files.length,coreByteEqualToOrigin:result.coreByteEqualToOrigin}));}
}
