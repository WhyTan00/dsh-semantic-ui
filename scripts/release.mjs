import{execFileSync}from'node:child_process';import{readFile,writeFile,mkdir,cp,rm}from'node:fs/promises';import{resolve}from'node:path';import{createHash}from'node:crypto';
const p=JSON.parse(await readFile('package.json','utf8'));await mkdir('artifacts',{recursive:true});
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
const result=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination','artifacts'],{encoding:'utf8'}))[0];
if(result.files.some(f=>f.path.startsWith('.handoff/')||f.path.startsWith('artifacts/')||f.path.includes('.env')))throw Error('Private file entered package');
if(result.files.some(f=>/^docs\/evidence\/(?:natural|coexistence)\/.+\.(?:json|png)$/.test(f.path)))throw Error('Bulk acceptance evidence entered runtime package');
const packed=new Set(result.files.map(f=>f.path));
for(const required of ['dist/host.js','dist/client.js','dist/protocol.js','dist/types/dsh/host.d.ts','docs/INSTALL.zh-CN.md','docs/GENUI.zh-CN.md','docs/VALIDATION.zh-CN.md','fixtures/questions.json'])if(!packed.has(required))throw Error('Required release file missing: '+required);
for(const file of result.files.filter(f=>/\.(?:md|json|js|ts|yml|txt)$/.test(f.path))){const content=await readFile(file.path,'utf8');if(/\/Users\/|\/home\/[^\s/]+\/|[?&]token=[A-Za-z0-9_-]{12}/.test(content))throw Error('Private path or bootstrap credential found in '+file.path);}
const bytes=await readFile('artifacts/'+result.filename);const hash=createHash('sha256').update(bytes).digest('hex');
// Keep reproducible model inputs and screenshots open, without making every
// installation download the entire acceptance archive. npm normalizes tar
// ownership and paths for this data-only artifact just as for the runtime.
const stage=resolve('.handoff/build/evidence-'+p.version);await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
await cp('docs',resolve(stage,'docs'),{recursive:true});
await mkdir(resolve(stage,'fixtures'),{recursive:true});await cp('fixtures/questions.json',resolve(stage,'fixtures/questions.json'));
await cp('LICENSE',resolve(stage,'LICENSE'));
await writeFile(resolve(stage,'README.md'),`# DSH Semantic UI acceptance evidence\n\nVersion ${p.version}. Full first attempts, including failures. See docs/natural-question-results.json and docs/evidence/genui-model-coexistence.json.\n\nSource: https://github.com/WhyTan00/dsh-semantic-ui/tree/v${p.version}\n\nThese records do not establish full semantic acceptance.\n`);
await writeFile(resolve(stage,'package.json'),JSON.stringify({name:'@whytan/dsh-semantic-ui-evidence',version:p.version,private:true,license:'MIT',files:['docs','fixtures/questions.json','README.md','LICENSE']}));
const archive=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination',resolve('artifacts')],{cwd:stage,encoding:'utf8'}))[0];
for(const file of archive.files.filter(f=>/\.(?:md|json|txt)$/.test(f.path))){const content=await readFile(resolve(stage,file.path),'utf8');if(/\/Users\/|\/home\/[^\s/]+\/|[?&]token=[A-Za-z0-9_-]{12}/.test(content))throw Error('Private data entered evidence archive: '+file.path);}
const evidenceBytes=await readFile('artifacts/'+archive.filename);const evidenceHash=createHash('sha256').update(evidenceBytes).digest('hex');
await writeFile('artifacts/SHA256SUMS',`${hash}  ${result.filename}\n${evidenceHash}  ${archive.filename}\n`);
const evidenceArchive={filename:archive.filename,bytes:evidenceBytes.length,sha256:evidenceHash,files:archive.files.length};
await writeFile('artifacts/package-manifest.json',JSON.stringify({version:p.version,filename:result.filename,sha256:hash,files:result.files.map(f=>({path:f.path,size:f.size})),evidenceArchive,status:'preview; see validation evidence'},null,2)+'\n');
console.log(JSON.stringify({filename:result.filename,bytes:bytes.length,sha256:hash,files:result.files.length,evidenceArchive}));
