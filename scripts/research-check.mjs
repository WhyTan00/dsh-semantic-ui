import{readFile,writeFile,access}from'node:fs/promises';import assert from'node:assert/strict';
const root='docs/research/';const data=JSON.parse(await readFile(root+'projects.json','utf8'));
const ids=new Set(),repos=new Set();const decisions=new Set(['existing-runtime','existing-interop','adopt-pattern','candidate','reference-only','defer']);
for(const p of data.projects){
 assert(!ids.has(p.id)&&!repos.has(p.repo),'Duplicate research project');ids.add(p.id);repos.add(p.repo);
 assert(decisions.has(p.decision),'Unknown adoption state '+p.id);assert(/^[a-f0-9]{40}$/.test(p.source.commit),'Missing immutable source pin '+p.id);
 assert(typeof p.source.archived==='boolean'&&p.source.files.length>=2,'Missing source evidence '+p.id);assert(p.license.expression&&p.license.sourceFiles.length,'Missing license review '+p.id);
 for(const f of p.source.files){assert(f.url===`https://github.com/${p.repo}/blob/${p.source.commit}/${f.path}`,'Unpinned source '+p.id);assert(/^[a-f0-9]{64}$/.test(f.sha256OfFetchedText),'Missing source digest');}
 for(const f of p.license.sourceFiles)assert(p.source.files.some(s=>s.path===f),'License evidence absent '+p.id);
 assert(p.strengths&&p.tradeoffs&&p.adoptionBoundary&&p.validation,'Incomplete selection rationale '+p.id);
 if(p.source.archived)assert(p.decision!=='existing-runtime','Archived project cannot become an unreviewed runtime default');
 for(const f of p.appliedTo){assert(!f.startsWith('/')&&!f.includes('..'),'Unsafe local reference');await access(f);}
}
assert(data.projects.length>0,'No research');
const labels={'existing-runtime':'保留已有引擎','existing-interop':'已有互通证据','adopt-pattern':'采用设计','candidate':'候选','reference-only':'参考','defer':'暂缓'};
const cell=s=>String(s).replaceAll('|',' / ').replaceAll('\n',' ');
let text='# 开源项目选型表\n\n本文件由 projects.json 派生；执行 `pnpm research:generate` 更新、`pnpm research:check` 核对。人工结论见 [研究说明](README.md) 与 [采用记录](ADOPTION.zh-CN.md)。\n\n';
text+=`核实日期：${data.asOf}。${data.projects.length} 个公开仓库，${data.projects.reduce((n,p)=>n+p.source.files.length,0)} 份固定源码文件。版本列来自 pinned HEAD 的 manifest，含 canary/private 根包，**不是最新稳定发行查询**。文档/源码研究不等于运行、性能或设备验收。\n\n`;
for(const layer of [...new Set(data.projects.map(p=>p.layer))]){
 text+=`## ${layer}\n\n| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |\n|---|---|---|---|---|---|\n`;
 for(const p of data.projects.filter(p=>p.layer===layer)){
  const versions=p.manifestObservations.map(v=>`${v.name}${v.version?' '+v.version:''}${v.private?' (private)':''}`).join('<br>')||'以固定源码为准';
  text+=`| [${p.repo}](https://github.com/${p.repo}/tree/${p.source.commit})${p.source.archived?' **archived**':''} | ${cell(versions)} | [${cell(p.license.expression)}](https://github.com/${p.repo}/blob/${p.source.commit}/${p.license.sourceFiles[0]}) | ${cell(p.strengths)} | **${labels[p.decision]}**：${cell(p.tradeoffs)} |\n`;
 }
 text+='\n';
}
text+='## 核验边界\n\n默认分支可能是 dev、unstable 或含预发布版本。源码 pin 用于复核设计，不能作为安装建议；既有运行依赖仍以本项目 package.json/lockfile 为准。项目主许可证不覆盖同品牌的所有商业产品、文档或素材。清单的源文件摘要为抓取文本的 UTF-8 SHA-256，不是上游签名证明。没有新增这些项目的运行依赖，也没有把其源代码复制进实现。\n';
const target=root+'PROJECTS.md';if(process.argv.includes('--write'))await writeFile(target,text);else assert.equal(await readFile(target,'utf8'),text,'Research inventory is stale; run pnpm research:generate');
console.log(JSON.stringify({projects:data.projects.length,pinnedSourceFiles:data.projects.reduce((n,p)=>n+p.source.files.length,0),licensesReviewed:data.projects.length,inventory:process.argv.includes('--write')?'generated':'consistent'}));
