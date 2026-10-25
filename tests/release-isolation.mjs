import{mkdtemp,writeFile,mkdir,cp,readFile,rm}from'node:fs/promises';
import{join}from'node:path';import{tmpdir}from'node:os';import assert from'node:assert/strict';
import{publicDocumentation,privatePackagePath}from'../scripts/public-files.mjs';
const taskDir=await mkdtemp(join(tmpdir(),'semantic-public-docs-'));
try{
 const source=join(taskDir,'docs'),target=join(taskDir,'evidence');
 await mkdir(join(source,'materials/user-inputs'),{recursive:true});await mkdir(join(source,'research'),{recursive:true});
 await writeFile(join(source,'materials/user-inputs/private.md'),'PRIVATE-PROVENANCE');await writeFile(join(source,'research/public.md'),'Public research');await writeFile(join(source,'materials-guide.md'),'Public guide');
 await cp(source,target,{recursive:true,filter:entry=>publicDocumentation(entry,source)});
 await assert.rejects(readFile(join(target,'materials/user-inputs/private.md')),{code:'ENOENT'});
 assert.equal(await readFile(join(target,'research/public.md'),'utf8'),'Public research');assert.equal(await readFile(join(target,'materials-guide.md'),'utf8'),'Public guide');
 for(const name of['docs/materials','docs/materials/input.md','actions/private.md','.handoff/receipt.json','docs\\materials\\input.md'])assert(privatePackagePath(name),name);
 for(const name of['docs/SEMANTICS.zh-CN.md','docs/materials-guide.md','dist/host.js'])assert(!privatePackagePath(name),name);
 console.log(JSON.stringify({privateProvenanceExcluded:true,publicDocumentationRetained:true,archivePathGuards:true}));
}finally{await rm(taskDir,{recursive:true,force:true});}
